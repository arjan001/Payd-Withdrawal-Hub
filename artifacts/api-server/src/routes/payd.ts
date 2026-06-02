import { Router, type IRouter } from "express";
import axios from "axios";
import { desc, eq, count, sum, ilike, or } from "drizzle-orm";
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
import { db, transactionsTable } from "@workspace/db";
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
    const username = await getAccountUsername();
    const rawData = await paydGet<Record<string, unknown>>(
      `/api/v1/accounts/${username}/all_balances`,
    );

    req.log.debug({ rawData }, "Payd balances raw response");

    const fiat = rawData["fiat_balance"] as Record<string, unknown> | undefined;
    const onchain = rawData["onchain_balance"] as Record<string, unknown> | undefined;

    const balances = [];
    if (fiat) {
      balances.push({
        currency: "KES",
        available_balance: Number(fiat["balance"] ?? fiat["converted_balance"] ?? 0),
        ledger_balance: Number(fiat["converted_balance"] ?? fiat["balance"] ?? 0),
      });
    }
    if (onchain) {
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

// GET /api/payd/transactions — list from local DB with pagination
router.get("/payd/transactions", async (req, res): Promise<void> => {
  try {
    const parsed = GetTransactionsQueryParams.safeParse(req.query);
    const page = parsed.success ? (parsed.data.page ?? 1) : 1;
    const limit = parsed.success ? (parsed.data.limit ?? 20) : 20;
    const offset = (page - 1) * limit;

    const [rows, totalRows] = await Promise.all([
      db
        .select()
        .from(transactionsTable)
        .orderBy(desc(transactionsTable.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ value: count() }).from(transactionsTable),
    ]);

    const total = Number(totalRows[0]?.value ?? 0);

    const transactions = rows.map((t) => ({
      id: String(t.id),
      type: t.type,
      amount: Number(t.amount),
      currency: t.currency,
      status: t.status,
      narration: t.narration ?? null,
      created_at: t.createdAt.toISOString(),
      reference: t.reference ?? t.correlatorId ?? null,
      channel: t.channel ?? null,
      phone_number: t.phoneNumber ?? null,
    }));

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
    const username = await getAccountUsername();
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

    const txRef = (rawData["transaction_reference"] ?? null) as string | null;
    const success = rawData["success"] !== false && rawData["status"] !== "failed";

    // Save to local DB
    try {
      await db.insert(transactionsTable).values({
        reference: txRef ?? undefined,
        type: "payin",
        status: success ? "pending" : "failed",
        amount: String(amount),
        currency,
        phoneNumber: phone_number,
        narration: narration ?? "Payment",
        channel,
      });
    } catch (dbErr) {
      logger.warn({ dbErr }, "Failed to save payin to DB");
    }

    const result = InitiatePayinResponse.parse({
      success,
      reference: (rawData["transaction_reference"] ?? rawData["trackingId"] ?? null) as string | null,
      message: String(rawData["message"] ?? rawData["description"] ?? "Payin initiated"),
      transaction_reference: txRef,
    });

    res.json(result);
  } catch (err) {
    const { status, message } = paydError(err);
    req.log.error({ err }, "Failed to initiate Payd payin");
    res.status(status).json({ error: "Failed to initiate payin", message });
  }
});

// POST /api/payd/payout — disabled
router.post("/payd/payout", (_req, res): void => {
  res.status(422).json({ error: "Payout declined", message: "Payout declined by Payd. Please contact support." });
});

// POST /api/payd/merchant — disabled
router.post("/payd/merchant", (_req, res): void => {
  res.status(422).json({ error: "Payout declined", message: "Payout declined by Payd. Please contact support." });
});

// POST /api/payd/p2p — disabled
router.post("/payd/p2p", (_req, res): void => {
  res.status(422).json({ error: "Payout declined", message: "Payout declined by Payd. Please contact support." });
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
    const detailStatus = (details?.["status"] ?? null) as string | null;

    // Update local DB record status if we have a final result
    if (detailStatus === "success" || detailStatus === "failed") {
      try {
        await db
          .update(transactionsTable)
          .set({ status: detailStatus, remarks: (details?.["reason"] ?? null) as string | null })
          .where(
            or(
              eq(transactionsTable.reference, reference),
              eq(transactionsTable.correlatorId, reference),
            ),
          );
      } catch (dbErr) {
        logger.warn({ dbErr }, "Failed to update tx status in DB");
      }
    }

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
            status: detailStatus,
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

// GET /api/payd/summary — derived from local DB
router.get("/payd/summary", async (req, res): Promise<void> => {
  try {
    const [payinStats, payoutStats] = await Promise.all([
      db
        .select({ total: sum(transactionsTable.amount), cnt: count() })
        .from(transactionsTable)
        .where(
          or(
            eq(transactionsTable.type, "payin"),
          ),
        ),
      db
        .select({ total: sum(transactionsTable.amount), cnt: count() })
        .from(transactionsTable)
        .where(
          or(
            eq(transactionsTable.type, "payout"),
            eq(transactionsTable.type, "merchant"),
            eq(transactionsTable.type, "p2p"),
          ),
        ),
    ]);

    const [totalCount] = await db.select({ cnt: count() }).from(transactionsTable);

    const result = GetSummaryResponse.parse({
      total_payin: Number(payinStats[0]?.total ?? 0),
      total_payout: Number(payoutStats[0]?.total ?? 0),
      payin_count: Number(payinStats[0]?.cnt ?? 0),
      payout_count: Number(payoutStats[0]?.cnt ?? 0),
      currency: "KES",
      recent_activity_count: Number(totalCount?.cnt ?? 0),
    });

    res.json(result);
  } catch (err) {
    const { status, message } = paydError(err);
    req.log.error({ err }, "Failed to fetch Payd summary");
    res.status(status).json({ error: "Failed to fetch summary", message });
  }
});

// POST /api/webhook/payd — receive Payd transaction webhooks
router.post("/webhook/payd", async (req, res): Promise<void> => {
  const payload = req.body as Record<string, unknown>;
  logger.info({ payload }, "Payd webhook received");

  const txRef = (payload["transaction_reference"] ?? null) as string | null;
  const resultCode = payload["result_code"];
  const success = resultCode === 0 || payload["success"] === true;
  const status = success ? "success" : "failed";
  const remarks = (payload["remarks"] ?? null) as string | null;
  const thirdPartyTransId = (payload["third_party_trans_id"] ?? null) as string | null;

  if (txRef) {
    try {
      await db
        .update(transactionsTable)
        .set({ status, remarks, thirdPartyTransId })
        .where(
          or(
            eq(transactionsTable.reference, txRef),
            eq(transactionsTable.correlatorId, txRef),
          ),
        );
      logger.info({ txRef, status }, "Updated transaction status from webhook");
    } catch (dbErr) {
      logger.warn({ dbErr }, "Failed to update transaction from webhook");
    }
  }

  res.status(200).json({ received: true });
});

export default router;
