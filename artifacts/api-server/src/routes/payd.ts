import { Router, type IRouter } from "express";
import axios from "axios";
import {
  GetAccountResponse,
  GetTransactionsQueryParams,
  GetTransactionsResponse,
  InitiatePayinBody,
  InitiatePayinResponse,
  InitiatePayoutBody,
  InitiatePayoutResponse,
  GetSummaryResponse,
  InitiateMerchantPayoutBody,
  InitiateMerchantPayoutResponse,
  InitiateP2PTransferBody,
  InitiateP2PTransferResponse,
  GetTransactionStatusResponse,
} from "@workspace/api-zod";
import { paydGet, paydPost, getAccountUsername, getCallbackBase } from "../lib/payd";
import { logger } from "../lib/logger";

const router: IRouter = Router();

function paydError(err: unknown): { status: number; message: string } {
  if (axios.isAxiosError(err)) {
    const status = err.response?.status ?? 500;
    const data = err.response?.data;
    const message =
      (typeof data === "object" && data !== null && "message" in data
        ? String((data as Record<string, unknown>)["message"])
        : null) ||
      (typeof data === "object" && data !== null && "error" in data
        ? String((data as Record<string, unknown>)["error"])
        : null) ||
      (typeof data === "object" && data !== null && "error_message" in data
        ? String((data as Record<string, unknown>)["error_message"])
        : null) ||
      err.message ||
      "Unknown error";
    return { status, message };
  }
  return { status: 500, message: String(err) };
}

// GET /api/payd/account — fetch balances from Payd
router.get("/payd/account", async (req, res): Promise<void> => {
  try {
    const username = getAccountUsername();
    const rawData = await paydGet<Record<string, unknown>>(
      `/api/v1/accounts/${username}/all_balances`,
    );

    req.log.debug({ rawData }, "Payd balances raw response");

    const fiat = rawData["fiat_balance"] as Record<string, unknown> | undefined;
    const onchain = rawData["onchain_balance"] as Record<string, unknown> | undefined;

    const balances = [];
    if (fiat) {
      // fiat_balance is always the local KES wallet per Payd docs
      balances.push({
        currency: "KES",
        available_balance: Number(fiat["balance"] ?? fiat["converted_balance"] ?? 0),
        ledger_balance: Number(fiat["converted_balance"] ?? fiat["balance"] ?? 0),
      });
    }
    if (onchain) {
      // onchain_balance is always the USD wallet per Payd docs
      balances.push({
        currency: "USD",
        available_balance: Number(onchain["balance"] ?? onchain["converted_balance"] ?? 0),
        ledger_balance: Number(onchain["converted_balance"] ?? onchain["balance"] ?? 0),
      });
    }
    if (balances.length === 0) {
      balances.push({ currency: "KES", available_balance: 0, ledger_balance: 0 });
    }

    const result = GetAccountResponse.parse({
      username,
      email: null,
      first_name: null,
      last_name: null,
      account_id: username,
      balances,
      connected: true,
    });

    res.json(result);
  } catch (err) {
    const { status, message } = paydError(err);
    req.log.error({ err, status }, "Failed to fetch Payd account");
    res.status(status).json({ error: "Failed to fetch account", message });
  }
});

// GET /api/payd/transactions — transaction history
router.get("/payd/transactions", async (req, res): Promise<void> => {
  try {
    const parsed = GetTransactionsQueryParams.safeParse(req.query);
    const page = parsed.success ? (parsed.data.page ?? 1) : 1;
    const limit = parsed.success ? (parsed.data.limit ?? 20) : 20;
    const username = getAccountUsername();

    let rawItems: unknown[] = [];
    let total = 0;

    try {
      const rawData = await paydGet<Record<string, unknown>>(
        `/api/v1/accounts/${username}/history`,
        { page, limit, per_page: limit },
      );
      const items = rawData["transactions"] ?? rawData["data"] ?? rawData["items"] ?? rawData;
      rawItems = Array.isArray(items) ? items : [];
      total = Number(rawData["total"] ?? rawData["count"] ?? rawItems.length);
    } catch {
      logger.warn("History endpoint not found, trying alternative");
    }

    req.log.debug({ count: rawItems.length }, "Payd transactions raw response");

    const transactions = rawItems.map((t, i) => {
      const tx = t as Record<string, unknown>;
      return {
        id: String(tx["id"] ?? tx["code"] ?? tx["transaction_reference"] ?? tx["reference"] ?? i),
        type: String(tx["type"] ?? tx["transaction_type"] ?? "unknown"),
        amount: Number(tx["amount"] ?? 0),
        currency: String(tx["currency"] ?? tx["billing_currency"] ?? "KES"),
        status: String(
          (tx["transaction_details"] as Record<string, unknown>)?.["status"] ??
            tx["status"] ??
            "unknown",
        ),
        narration: (tx["narration"] ?? tx["description"] ?? tx["note"] ?? null) as string | null,
        created_at: String(tx["created_at"] ?? tx["createdAt"] ?? new Date().toISOString()),
        reference: (tx["code"] ?? tx["transaction_reference"] ?? tx["reference"] ?? null) as
          | string
          | null,
        channel: (
          (tx["transaction_details"] as Record<string, unknown>)?.["channel"] ??
          tx["channel"] ??
          null
        ) as string | null,
        phone_number: (
          (tx["transaction_details"] as Record<string, unknown>)?.["phone_number"] ??
          tx["phone_number"] ??
          null
        ) as string | null,
      };
    });

    const result = GetTransactionsResponse.parse({ transactions, total, page, limit });
    res.json(result);
  } catch (err) {
    const { status, message } = paydError(err);
    req.log.error({ err }, "Failed to fetch Payd transactions");
    res.status(status).json({ error: "Failed to fetch transactions", message });
  }
});

// POST /api/payd/payin — M-Pesa STK push collection
router.post("/payd/payin", async (req, res): Promise<void> => {
  try {
    const parsed = InitiatePayinBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const { phone_number, amount, currency = "KES", channel = "MPESA", narration } = parsed.data;
    const username = getAccountUsername();
    const callbackUrl = `${getCallbackBase()}/api/webhook/payd`;

    const rawData = await paydPost<Record<string, unknown>>("/api/v2/payments", {
      username,
      channel,
      amount,
      phone_number,
      narration: narration ?? "Payment",
      currency,
      callback_url: callbackUrl,
    });

    req.log.info({ rawData }, "Payd payin response");

    const result = InitiatePayinResponse.parse({
      success: rawData["success"] !== false && rawData["status"] !== "failed",
      reference: (rawData["transaction_reference"] ?? rawData["trackingId"] ?? null) as
        | string
        | null,
      message: String(rawData["message"] ?? rawData["description"] ?? "Payin initiated"),
      transaction_reference: (rawData["transaction_reference"] ?? null) as string | null,
    });

    res.json(result);
  } catch (err) {
    const { status, message } = paydError(err);
    req.log.error({ err }, "Failed to initiate Payd payin");
    res.status(status).json({ error: "Failed to initiate payin", message });
  }
});

// POST /api/payd/payout — M-Pesa withdrawal
router.post("/payd/payout", async (req, res): Promise<void> => {
  try {
    const parsed = InitiatePayoutBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const { phone_number, amount, currency = "KES", network_code = "MPESA", narration } =
      parsed.data;
    const username = getAccountUsername();
    const callbackUrl = `${getCallbackBase()}/api/webhook/payd`;

    const rawData = await paydPost<Record<string, unknown>>("/api/v2/withdrawal", {
      username,
      phone_number,
      amount,
      narration: narration ?? "Withdrawal",
      callback_url: callbackUrl,
      channel: network_code,
      currency,
    });

    req.log.info({ rawData }, "Payd payout response");

    const result = InitiatePayoutResponse.parse({
      success: rawData["success"] !== false && rawData["status"] !== "failed",
      reference: (rawData["correlator_id"] ?? rawData["transaction_reference"] ?? null) as
        | string
        | null,
      message: String(rawData["message"] ?? rawData["description"] ?? "Payout initiated"),
    });

    res.json(result);
  } catch (err) {
    const { status, message } = paydError(err);
    req.log.error({ err }, "Failed to initiate Payd payout");
    res.status(status).json({ error: "Failed to initiate payout", message });
  }
});

// GET /api/payd/summary — dashboard summary derived from balances
router.get("/payd/summary", async (req, res): Promise<void> => {
  try {
    const username = getAccountUsername();

    let transactions: unknown[] = [];
    try {
      const rawData = await paydGet<Record<string, unknown>>(
        `/api/v1/accounts/${username}/history`,
        { page: 1, limit: 100, per_page: 100 },
      );
      const items = rawData["transactions"] ?? rawData["data"] ?? rawData["items"] ?? rawData;
      transactions = Array.isArray(items) ? items : [];
    } catch {
      logger.warn("Could not fetch transaction history for summary");
    }

    type TxRecord = Record<string, unknown>;
    const payins = (transactions as TxRecord[]).filter(
      (t) =>
        String(t["type"] ?? "")
          .toLowerCase()
          .match(/payin|receipt|deposit|credit|top/),
    );
    const payouts = (transactions as TxRecord[]).filter(
      (t) =>
        String(t["type"] ?? "")
          .toLowerCase()
          .match(/payout|withdrawal|debit/),
    );

    const result = GetSummaryResponse.parse({
      total_payin: payins.reduce((sum, t) => sum + Number(t["amount"] ?? 0), 0),
      total_payout: payouts.reduce((sum, t) => sum + Number(t["amount"] ?? 0), 0),
      payin_count: payins.length,
      payout_count: payouts.length,
      currency: "KES",
      recent_activity_count: transactions.length,
    });

    res.json(result);
  } catch (err) {
    const { status, message } = paydError(err);
    req.log.error({ err }, "Failed to fetch Payd summary");
    res.status(status).json({ error: "Failed to fetch summary", message });
  }
});

// POST /api/payd/merchant — Pay to Paybill or Till
router.post("/payd/merchant", async (req, res): Promise<void> => {
  try {
    const parsed = InitiateMerchantPayoutBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const { amount, currency = "KES", phone_number, narration, business_account, business_number, wallet_type } = parsed.data;
    const username = getAccountUsername();
    const callbackUrl = `${getCallbackBase()}/api/webhook/payd`;

    const rawData = await paydPost<Record<string, unknown>>("/api/v2/payments", {
      username,
      amount,
      currency,
      phone_number,
      narration,
      transaction_channel: "bank",
      channel: "bank",
      business_account,
      business_number: business_number ?? "0000000000000",
      callback_url: callbackUrl,
      ...(wallet_type ? { wallet_type } : {}),
    });

    req.log.info({ rawData }, "Payd merchant payout response");

    const result = InitiateMerchantPayoutResponse.parse({
      success: rawData["success"] !== false && rawData["status"] !== "failed",
      correlator_id: (rawData["correlator_id"] ?? rawData["transaction_reference"] ?? null) as string | null,
      message: String(rawData["message"] ?? rawData["description"] ?? "Merchant payment initiated"),
      status: (rawData["status"] ?? null) as string | null,
    });

    res.json(result);
  } catch (err) {
    const { status, message } = paydError(err);
    req.log.error({ err }, "Failed to initiate merchant payout");
    res.status(status).json({ error: "Failed to initiate merchant payment", message });
  }
});

// POST /api/payd/p2p — Payd-to-Payd transfer
router.post("/payd/p2p", async (req, res): Promise<void> => {
  try {
    const parsed = InitiateP2PTransferBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const { receiver_username, amount, narration, phone_number, wallet_type } = parsed.data;

    const rawData = await paydPost<Record<string, unknown>>("/api/v2/p2p", {
      receiver_username,
      amount,
      narration,
      phone_number,
      ...(wallet_type ? { wallet_type } : {}),
    });

    req.log.info({ rawData }, "Payd P2P transfer response");

    const result = InitiateP2PTransferResponse.parse({
      success: rawData["success"] !== false,
      transaction_reference: (rawData["transaction_reference"] ?? null) as string | null,
      message: String(rawData["message"] ?? rawData["description"] ?? "Transfer completed"),
    });

    res.json(result);
  } catch (err) {
    const { status, message } = paydError(err);
    req.log.error({ err }, "Failed to initiate P2P transfer");
    res.status(status).json({ error: "Failed to initiate transfer", message });
  }
});

// GET /api/payd/tx-status/:reference — look up a transaction by reference
router.get("/payd/tx-status/:reference", async (req, res): Promise<void> => {
  try {
    const reference = req.params["reference"];
    if (!reference) {
      res.status(400).json({ error: "Transaction reference is required" });
      return;
    }

    const rawData = await paydGet<Record<string, unknown>>(`/api/v1/status/${reference}`);
    req.log.debug({ rawData }, "Payd tx-status raw response");

    const details = rawData["transaction_details"] as Record<string, unknown> | undefined;

    const result = GetTransactionStatusResponse.parse({
      id: String(rawData["id"] ?? reference),
      code: String(rawData["code"] ?? reference),
      currency: String(rawData["currency"] ?? "KES"),
      amount: Number(rawData["amount"] ?? 0),
      balance: Number(rawData["balance"] ?? 0),
      type: String(rawData["type"] ?? "unknown"),
      transaction_category: (rawData["transaction_category"] ?? null) as string | null,
      created_at: String(rawData["created_at"] ?? new Date().toISOString()),
      transaction_details: details
        ? {
            status: (details["status"] ?? null) as string | null,
            payer: (details["payer"] ?? null) as string | null,
            receiver: (details["receiver"] ?? null) as string | null,
            phone_number: (details["phone_number"] ?? null) as string | null,
            channel: (details["channel"] ?? null) as string | null,
            reason: (details["reason"] ?? null) as string | null,
            merchant_id: (details["merchant_id"] ?? null) as string | null,
            account_number: (details["account_number"] ?? null) as string | null,
            email_address: (details["email_address"] ?? null) as string | null,
          }
        : undefined,
    });

    res.json(result);
  } catch (err) {
    const { status, message } = paydError(err);
    req.log.error({ err }, "Failed to fetch transaction status");
    res.status(status).json({ error: "Failed to fetch transaction status", message });
  }
});

// POST /api/webhook/payd — receive Payd transaction webhooks
router.post("/webhook/payd", (req, res): void => {
  const payload = req.body as Record<string, unknown>;
  logger.info({ payload }, "Payd webhook received");
  res.status(200).json({ received: true });
});

export default router;
