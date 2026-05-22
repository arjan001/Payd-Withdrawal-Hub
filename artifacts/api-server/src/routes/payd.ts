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
import { paydGet, paydPost, invalidateToken } from "../lib/payd";
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
      err.message ||
      "Unknown error";
    return { status, message };
  }
  return { status: 500, message: String(err) };
}

router.get("/payd/account", async (req, res): Promise<void> => {
  try {
    const username = process.env["PAYD_USERNAME"] ?? "unknown";

    let rawData: unknown;
    try {
      rawData = await paydGet("/v2/accounts/me");
    } catch {
      try {
        rawData = await paydGet("/v1/accounts/me");
      } catch {
        rawData = await paydGet("/v2/profile");
      }
    }

    req.log.debug({ rawData }, "Payd account raw response");

    const data = rawData as Record<string, unknown>;
    const balancesRaw = (data["balances"] ?? data["wallet"] ?? data["wallets"] ?? []) as unknown[];
    const balances = Array.isArray(balancesRaw)
      ? balancesRaw.map((b) => {
          const wallet = b as Record<string, unknown>;
          return {
            currency: String(wallet["currency"] ?? wallet["currency_code"] ?? "KES"),
            available_balance: Number(wallet["available_balance"] ?? wallet["balance"] ?? 0),
            ledger_balance: Number(wallet["ledger_balance"] ?? wallet["available_balance"] ?? wallet["balance"] ?? 0),
          };
        })
      : [{ currency: "KES", available_balance: 0, ledger_balance: 0 }];

    const result = GetAccountResponse.parse({
      username: data["username"] ?? data["email"] ?? username,
      email: data["email"] ?? null,
      first_name: data["first_name"] ?? data["firstName"] ?? null,
      last_name: data["last_name"] ?? data["lastName"] ?? null,
      account_id: String(data["id"] ?? data["account_id"] ?? data["userId"] ?? ""),
      balances,
      connected: true,
    });

    res.json(result);
  } catch (err) {
    const { status, message } = paydError(err);
    req.log.error({ err, status }, "Failed to fetch Payd account");
    if (status === 401) {
      invalidateToken();
      res.status(401).json({ error: "Authentication failed", message });
      return;
    }
    res.status(status).json({ error: "Failed to fetch account", message });
  }
});

router.get("/payd/transactions", async (req, res): Promise<void> => {
  try {
    const parsed = GetTransactionsQueryParams.safeParse(req.query);
    const page = parsed.success ? (parsed.data.page ?? 1) : 1;
    const limit = parsed.success ? (parsed.data.limit ?? 20) : 20;

    let rawData: unknown;
    try {
      rawData = await paydGet("/v2/transactions", { page, limit, per_page: limit });
    } catch {
      rawData = await paydGet("/v1/transactions", { page, limit, per_page: limit });
    }

    req.log.debug({ rawData }, "Payd transactions raw response");

    const data = rawData as Record<string, unknown>;
    const items = (data["transactions"] ?? data["data"] ?? data["items"] ?? data ?? []) as unknown[];
    const txList = Array.isArray(items) ? items : [];

    const transactions = txList.map((t, i) => {
      const tx = t as Record<string, unknown>;
      return {
        id: String(tx["id"] ?? tx["transaction_id"] ?? tx["reference"] ?? i),
        type: String(tx["type"] ?? tx["transaction_type"] ?? "unknown"),
        amount: Number(tx["amount"] ?? 0),
        currency: String(tx["currency"] ?? "KES"),
        status: String(tx["status"] ?? "unknown"),
        narration: (tx["narration"] ?? tx["description"] ?? tx["note"] ?? null) as string | null,
        created_at: String(tx["created_at"] ?? tx["createdAt"] ?? tx["date"] ?? new Date().toISOString()),
        reference: (tx["reference"] ?? tx["transaction_reference"] ?? null) as string | null,
        channel: (tx["channel"] ?? tx["payment_method"] ?? null) as string | null,
        phone_number: (tx["phone_number"] ?? tx["msisdn"] ?? null) as string | null,
      };
    });

    const total = Number(data["total"] ?? data["count"] ?? transactions.length);

    const result = GetTransactionsResponse.parse({ transactions, total, page, limit });
    res.json(result);
  } catch (err) {
    const { status, message } = paydError(err);
    req.log.error({ err }, "Failed to fetch Payd transactions");
    res.status(status).json({ error: "Failed to fetch transactions", message });
  }
});

router.post("/payd/payin", async (req, res): Promise<void> => {
  try {
    const parsed = InitiatePayinBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const { phone_number, amount, currency = "KES", channel = "MPESA", narration } = parsed.data;

    let rawData: unknown;
    try {
      rawData = await paydPost("/v1/sasapay/top-up", {
        phone_number,
        amount,
        currency,
        channel,
        narration,
      });
    } catch {
      rawData = await paydPost("/v2/payments/payin", {
        phone_number,
        amount,
        currency,
        channel,
        narration,
      });
    }

    req.log.info({ rawData }, "Payd payin response");

    const data = rawData as Record<string, unknown>;
    const result = InitiatePayinResponse.parse({
      success: data["success"] !== false && data["status"] !== "failed",
      reference: (data["reference"] ?? data["transaction_reference"] ?? data["checkout_request_id"] ?? null) as string | null,
      message: String(data["message"] ?? data["description"] ?? "Payin initiated"),
      transaction_reference: (data["transaction_reference"] ?? data["reference"] ?? null) as string | null,
    });

    res.json(result);
  } catch (err) {
    const { status, message } = paydError(err);
    req.log.error({ err }, "Failed to initiate Payd payin");
    res.status(status).json({ error: "Failed to initiate payin", message });
  }
});

router.post("/payd/payout", async (req, res): Promise<void> => {
  try {
    const parsed = InitiatePayoutBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const {
      phone_number,
      amount,
      currency = "KES",
      network_code = "MPESA",
      narration,
      account_id,
    } = parsed.data;

    let rawData: unknown;
    try {
      rawData = await paydPost("/v1/sasapay/withdrawal", {
        phone_number,
        amount,
        currency,
        network_code,
        narration,
        account_id,
      });
    } catch {
      rawData = await paydPost("/v2/payments/payout", {
        phone_number,
        amount,
        currency,
        network_code,
        narration,
        account_id,
      });
    }

    req.log.info({ rawData }, "Payd payout response");

    const data = rawData as Record<string, unknown>;
    const result = InitiatePayoutResponse.parse({
      success: data["success"] !== false && data["status"] !== "failed",
      reference: (data["reference"] ?? data["transaction_reference"] ?? null) as string | null,
      message: String(data["message"] ?? data["description"] ?? "Payout initiated"),
    });

    res.json(result);
  } catch (err) {
    const { status, message } = paydError(err);
    req.log.error({ err }, "Failed to initiate Payd payout");
    res.status(status).json({ error: "Failed to initiate payout", message });
  }
});

router.get("/payd/summary", async (req, res): Promise<void> => {
  try {
    let transactions: Array<Record<string, unknown>> = [];

    try {
      const rawData = await paydGet<Record<string, unknown>>("/v2/transactions", {
        page: 1,
        limit: 100,
        per_page: 100,
      });
      const items = (rawData["transactions"] ?? rawData["data"] ?? rawData["items"] ?? rawData ?? []) as unknown[];
      transactions = Array.isArray(items) ? (items as Array<Record<string, unknown>>) : [];
    } catch (err) {
      logger.warn({ err }, "Could not fetch transactions for summary, using empty data");
    }

    const payins = transactions.filter(
      (t) =>
        String(t["type"] ?? "").toLowerCase().includes("payin") ||
        String(t["type"] ?? "").toLowerCase().includes("top") ||
        String(t["type"] ?? "").toLowerCase().includes("deposit") ||
        String(t["type"] ?? "").toLowerCase().includes("credit")
    );
    const payouts = transactions.filter(
      (t) =>
        String(t["type"] ?? "").toLowerCase().includes("payout") ||
        String(t["type"] ?? "").toLowerCase().includes("withdrawal") ||
        String(t["type"] ?? "").toLowerCase().includes("debit")
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

export default router;
