import { Router, type IRouter, type Request, type Response } from "express";
import { db, credentialsTable, ensureCredentialsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { type AuthRequest } from "../middlewares/auth";

const router: IRouter = Router();

interface CredentialStatus {
  is_configured: boolean;
  account_username: string | null;
  payd_username: string | null;
  payd_password: string | null;
  payd_api_secret: string | null;
  is_active: boolean;
  withdrawals_enabled: boolean;
  has_api_key: boolean;
  has_password: boolean;
  has_api_secret: boolean;
}

const NOT_CONFIGURED: CredentialStatus = {
  is_configured: false,
  account_username: null,
  payd_username: null,
  payd_password: null,
  payd_api_secret: null,
  is_active: false,
  withdrawals_enabled: false,
  has_api_key: false,
  has_password: false,
  has_api_secret: false,
};

function validateInput(body: unknown): {
  payd_username: string;
  payd_password: string;
  payd_api_secret?: string | null;
  payd_account_username: string;
} | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (typeof b["payd_username"] !== "string" || !b["payd_username"]) return null;
  if (typeof b["payd_password"] !== "string" || !b["payd_password"]) return null;
  if (typeof b["payd_account_username"] !== "string" || !b["payd_account_username"]) return null;
  return {
    payd_username: b["payd_username"] as string,
    payd_password: b["payd_password"] as string,
    payd_api_secret: typeof b["payd_api_secret"] === "string" ? b["payd_api_secret"] : null,
    payd_account_username: b["payd_account_username"] as string,
  };
}

// GET /api/settings/credentials — return credentials for the logged-in user
router.get("/settings/credentials", async (req: Request, res: Response): Promise<void> => {
  const userId = (req as AuthRequest).user.userId;
  try {
    await ensureCredentialsTable();
    const rows = await db
      .select()
      .from(credentialsTable)
      .where(eq(credentialsTable.userId, userId))
      .limit(1);
    const row = rows[0];

    if (row) {
      res.json({
        is_configured: true,
        account_username: row.paydAccountUsername,
        payd_username: row.paydUsername,
        payd_password: row.paydPassword,
        payd_api_secret: row.paydApiSecret,
        is_active: row.isActive,
        withdrawals_enabled: row.withdrawalsEnabled,
        has_api_key: true,
        has_password: true,
        has_api_secret: !!row.paydApiSecret,
      } satisfies CredentialStatus);
      return;
    }

    res.json(NOT_CONFIGURED);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch credential status");
    res.status(500).json({ error: "Failed to fetch credential status" });
  }
});

// POST /api/settings/credentials — upsert credentials for the logged-in user
router.post("/settings/credentials", async (req: Request, res: Response): Promise<void> => {
  const userId = (req as AuthRequest).user.userId;
  try {
    const parsed = validateInput(req.body);
    if (!parsed) {
      res.status(400).json({ error: "Missing required fields: payd_username, payd_password, payd_account_username" });
      return;
    }

    await ensureCredentialsTable();

    const { payd_username, payd_password, payd_api_secret, payd_account_username } = parsed;

    const result = await db
      .insert(credentialsTable)
      .values({
        userId,
        paydUsername: payd_username,
        paydPassword: payd_password,
        paydApiSecret: payd_api_secret ?? null,
        paydAccountUsername: payd_account_username,
        isActive: true,
        withdrawalsEnabled: false,
      })
      .onConflictDoUpdate({
        target: credentialsTable.userId,
        set: {
          paydUsername: payd_username,
          paydPassword: payd_password,
          paydApiSecret: payd_api_secret ?? null,
          paydAccountUsername: payd_account_username,
          updatedAt: new Date(),
        },
      })
      .returning();

    const saved = result[0];
    req.log.info({ userId, account: payd_account_username }, "Credentials saved for user");

    res.json({
      is_configured: true,
      account_username: payd_account_username,
      payd_username,
      payd_password,
      payd_api_secret: payd_api_secret ?? null,
      is_active: saved?.isActive ?? true,
      withdrawals_enabled: saved?.withdrawalsEnabled ?? false,
      has_api_key: true,
      has_password: true,
      has_api_secret: !!payd_api_secret,
    } satisfies CredentialStatus);
  } catch (err) {
    req.log.error({ err }, "Failed to save credentials");
    res.status(500).json({ error: "Failed to save credentials", message: String(err) });
  }
});

// DELETE /api/settings/credentials — remove the logged-in user's credentials
router.delete("/settings/credentials", async (req: Request, res: Response): Promise<void> => {
  const userId = (req as AuthRequest).user.userId;
  try {
    await ensureCredentialsTable();
    await db.delete(credentialsTable).where(eq(credentialsTable.userId, userId));
    res.json({ deleted: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete credentials");
    res.status(500).json({ error: "Failed to delete credentials", message: String(err) });
  }
});

export default router;
