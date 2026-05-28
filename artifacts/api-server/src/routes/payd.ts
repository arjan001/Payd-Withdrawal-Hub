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

// POST /api/webhook/payd — receive Payd transaction webhooks
router.post("/webhook/payd", (req, res): void => {
  const payload = req.body as Record<string, unknown>;
  logger.info({ payload }, "Payd webhook received");
  res.status(200).json({ received: true });
});

export default router;
