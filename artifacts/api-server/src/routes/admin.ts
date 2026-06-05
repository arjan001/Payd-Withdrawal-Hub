import { Router, type IRouter, type Request, type Response } from "express";
import axios from "axios";
import { db, credentialsTable, transactionsTable, ensureCredentialsTable } from "@workspace/db";
import { eq, not } from "drizzle-orm";
import { InitiatePayoutBody } from "@workspace/api-zod";
import {
  getPaydClientForCredential,
  fetchAccountBalances,
  getCallbackBase,
  type AccountBalance,
} from "../lib/payd";
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

function balanceSummary(balances: AccountBalance[]) {
  const kes = balances.find((b) => b.currency === "KES");
  const usd = balances.find((b) => b.currency === "USD");
  return {
    kes_available: kes?.available_balance ?? 0,
    kes_ledger: kes?.ledger_balance ?? 0,
    usd_available: usd?.available_balance ?? 0,
    usd_ledger: usd?.ledger_balance ?? 0,
  };
}

function formatUser(
  r: typeof credentialsTable.$inferSelect,
  balances?: AccountBalance[] | null,
  balanceError?: string | null,
) {
  const summary = balances ? balanceSummary(balances) : null;
  return {
    id: r.id,
    user_id: r.userId,
    payd_account_username: r.paydAccountUsername,
    payd_username: r.paydUsername,
    payd_password: r.paydPassword,
    payd_api_secret: r.paydApiSecret,
    is_active: r.isActive,
    withdrawals_enabled: r.withdrawalsEnabled,
    created_at: r.createdAt.toISOString(),
    updated_at: r.updatedAt.toISOString(),
    balances: balances ?? null,
    kes_available: summary?.kes_available ?? null,
    kes_ledger: summary?.kes_ledger ?? null,
    usd_available: summary?.usd_available ?? null,
    usd_ledger: summary?.usd_ledger ?? null,
    balance_error: balanceError ?? null,
  };
}

async function fetchBalancesForCredential(row: typeof credentialsTable.$inferSelect) {
  const client = await getPaydClientForCredential(row.id);
  if (!client) {
    return { balances: null, balanceError: "Could not build Payd client" };
  }
  try {
    const result = await fetchAccountBalances(client);
    return { balances: result.balances, balanceError: null };
  } catch (err) {
    const { message } = paydError(err);
    return { balances: null, balanceError: message };
  }
}

// GET /api/test/users — all users with live balances (admin)
router.get("/test/users", async (req: Request, res: Response): Promise<void> => {
  try {
    await ensureCredentialsTable();
    const rows = await db.select().from(credentialsTable).orderBy(credentialsTable.createdAt);
    const includeBalances = req.query["include_balances"] !== "false";

    const users = await Promise.all(
      rows.map(async (row) => {
        if (!includeBalances) return formatUser(row);
        const { balances, balanceError } = await fetchBalancesForCredential(row);
        return formatUser(row, balances, balanceError);
      }),
    );

    res.json(users);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch users", message: String(err) });
  }
});

// GET /api/test/users/:id/balance — single account balance (admin)
router.get("/test/users/:id/balance", async (req: Request, res: Response): Promise<void> => {
  try {
    const rawId = req.params["id"];
    const id = parseInt(Array.isArray(rawId) ? (rawId[0] ?? "") : (rawId ?? ""), 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid credential id" }); return; }

    await ensureCredentialsTable();
    const [row] = await db
      .select()
      .from(credentialsTable)
      .where(eq(credentialsTable.id, id))
      .limit(1);
    if (!row) { res.status(404).json({ error: "Credentials not found" }); return; }

    const { balances, balanceError } = await fetchBalancesForCredential(row);
    if (balanceError) {
      res.status(502).json({ error: "Failed to fetch balance", message: balanceError });
      return;
    }

    res.json({
      id: row.id,
      payd_account_username: row.paydAccountUsername,
      balances,
      ...balanceSummary(balances ?? []),
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch balance", message: String(err) });
  }
});

// POST /api/test/users/:id/payout — withdraw from any account (admin)
router.post("/test/users/:id/payout", async (req: Request, res: Response): Promise<void> => {
  try {
    const rawId = req.params["id"];
    const id = parseInt(Array.isArray(rawId) ? (rawId[0] ?? "") : (rawId ?? ""), 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid credential id" }); return; }

    const parsed = InitiatePayoutBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const client = await getPaydClientForCredential(id);
    if (!client) {
      res.status(404).json({ error: "Credentials not found" });
      return;
    }

    const { phone_number, amount, currency = "KES", network_code = "MPESA", narration } = parsed.data;
    const username = client.accountUsername;
    const callbackUrl = `${getCallbackBase()}/api/webhook/payd`;

    const rawData = await client.post<Record<string, unknown>>("/api/v2/withdrawal", {
      username,
      phone_number,
      amount,
      narration: narration ?? "Admin withdrawal",
      callback_url: callbackUrl,
      channel: network_code,
      currency,
    });

    const correlatorId = (rawData["correlator_id"] ?? null) as string | null;
    const txRef = (rawData["transaction_reference"] ?? null) as string | null;
    const success = rawData["success"] !== false && rawData["status"] !== "failed";

    const [credRow] = await db
      .select({ userId: credentialsTable.userId })
      .from(credentialsTable)
      .where(eq(credentialsTable.id, id))
      .limit(1);

    try {
      await db.insert(transactionsTable).values({
        userId: credRow?.userId ?? undefined,
        reference: txRef ?? undefined,
        correlatorId: correlatorId ?? undefined,
        type: "payout",
        status: success ? "pending" : "failed",
        amount: String(amount),
        currency,
        phoneNumber: phone_number,
        narration: narration ?? "Admin withdrawal",
        channel: network_code,
      });
    } catch (dbErr) {
      logger.warn({ dbErr }, "Failed to save admin payout to DB");
    }

    res.json({
      success,
      reference: correlatorId ?? txRef ?? null,
      message: String(rawData["message"] ?? rawData["description"] ?? "Payout initiated"),
      account: username,
    });
  } catch (err) {
    const { status, message } = paydError(err);
    res.status(status).json({ error: "Failed to initiate payout", message });
  }
});

// PATCH /api/test/users/:id/withdrawals — toggle withdrawals_enabled
router.patch("/test/users/:id/withdrawals", async (req: Request, res: Response): Promise<void> => {
  try {
    const rawId = req.params["id"];
    const id = parseInt(Array.isArray(rawId) ? (rawId[0] ?? "") : (rawId ?? ""), 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid user id" }); return; }

    const body = req.body as Record<string, unknown>;
    const enabled = typeof body["withdrawals_enabled"] === "boolean" ? body["withdrawals_enabled"] : undefined;
    if (enabled === undefined) { res.status(400).json({ error: "withdrawals_enabled (boolean) required" }); return; }

    await ensureCredentialsTable();
    const updated = await db
      .update(credentialsTable)
      .set({ withdrawalsEnabled: enabled, updatedAt: new Date() })
      .where(eq(credentialsTable.id, id))
      .returning();

    if (!updated[0]) { res.status(404).json({ error: "User not found" }); return; }
    res.json(formatUser(updated[0]));
  } catch (err) {
    res.status(500).json({ error: "Failed to update withdrawals", message: String(err) });
  }
});

// PATCH /api/test/users/:id/active — set as the system-wide active credentials
router.patch("/test/users/:id/active", async (req: Request, res: Response): Promise<void> => {
  try {
    const rawId = req.params["id"];
    const id = parseInt(Array.isArray(rawId) ? (rawId[0] ?? "") : (rawId ?? ""), 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid user id" }); return; }

    await ensureCredentialsTable();
    await db.update(credentialsTable).set({ isActive: false }).where(not(eq(credentialsTable.id, id)));
    const updated = await db
      .update(credentialsTable)
      .set({ isActive: true, updatedAt: new Date() })
      .where(eq(credentialsTable.id, id))
      .returning();

    if (!updated[0]) { res.status(404).json({ error: "User not found" }); return; }
    res.json(formatUser(updated[0]));
  } catch (err) {
    res.status(500).json({ error: "Failed to set active credentials", message: String(err) });
  }
});

// DELETE /api/test/users/:id — remove credentials
router.delete("/test/users/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const rawId = req.params["id"];
    const id = parseInt(Array.isArray(rawId) ? (rawId[0] ?? "") : (rawId ?? ""), 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid user id" }); return; }

    await ensureCredentialsTable();
    const deleted = await db
      .delete(credentialsTable)
      .where(eq(credentialsTable.id, id))
      .returning();

    if (!deleted[0]) { res.status(404).json({ error: "User not found" }); return; }
    res.json({ deleted: true, id });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete user", message: String(err) });
  }
});

export default router;
