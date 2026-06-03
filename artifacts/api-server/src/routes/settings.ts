import { Router, type IRouter, type Request, type Response } from "express";
import { db, credentialsTable, ensureCredentialsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getEnvCredentials } from "../lib/payd";

const router: IRouter = Router();

const COOKIE_NAME = "payd_user";
const COOKIE_OPTS = { httpOnly: true, path: "/", sameSite: "lax" as const, maxAge: 365 * 24 * 60 * 60 * 1000 };

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

/**
 * Build a credential-status response from environment-variable credentials,
 * or return null when none are set. This lets the dashboard recognise
 * credentials provided as Netlify environment variables even when nothing has
 * been saved through the UI / database yet.
 */
function envStatusResponse(): CredentialStatus | null {
  const creds = getEnvCredentials();
  if (!creds) return null;
  const apiSecret = process.env["PAYD_API_SECRET"] ?? null;
  return {
    is_configured: true,
    account_username: creds.accountUsername,
    payd_username: creds.username,
    payd_password: creds.password,
    payd_api_secret: apiSecret,
    is_active: true,
    withdrawals_enabled: true,
    has_api_key: true,
    has_password: true,
    has_api_secret: !!apiSecret,
  };
}

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

// GET /api/settings/credentials — return full credentials for current user
// (by cookie), falling back to environment-variable credentials.
router.get("/settings/credentials", async (req: Request, res: Response): Promise<void> => {
  try {
    await ensureCredentialsTable();
    const paydUser = req.cookies[COOKIE_NAME] as string | undefined;

    if (paydUser) {
      const rows = await db
        .select()
        .from(credentialsTable)
        .where(eq(credentialsTable.paydAccountUsername, paydUser))
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
        });
        return;
      }
    }

    // No saved row for this browser — fall back to env-var credentials if set.
    const envStatus = envStatusResponse();
    if (envStatus) {
      res.json(envStatus);
      return;
    }

    res.json({ ...NOT_CONFIGURED, account_username: paydUser ?? null });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch credential status");
    // The database may be unreachable or the migration not yet applied — still
    // honour env-var credentials so the dashboard remains usable.
    const envStatus = envStatusResponse();
    if (envStatus) {
      res.json(envStatus);
      return;
    }
    res.status(500).json({ error: "Failed to fetch credential status" });
  }
});

// POST /api/settings/credentials — upsert credentials, auto-activate if first in DB
router.post("/settings/credentials", async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = validateInput(req.body);
    if (!parsed) {
      res.status(400).json({ error: "Missing required fields: payd_username, payd_password, payd_account_username" });
      return;
    }

    // Make sure the table exists before we try to write to it. On a database
    // branch where the migration has not run yet this creates the table so the
    // save succeeds instead of failing with "credentials store not ready".
    await ensureCredentialsTable();

    const { payd_username, payd_password, payd_api_secret, payd_account_username } = parsed;

    // Check if there are any active credentials already — if not, auto-activate this one
    const existing = await db.select({ id: credentialsTable.id })
      .from(credentialsTable)
      .where(eq(credentialsTable.isActive, true))
      .limit(1);
    const shouldAutoActivate = existing.length === 0;

    const result = await db
      .insert(credentialsTable)
      .values({
        paydUsername: payd_username,
        paydPassword: payd_password,
        paydApiSecret: payd_api_secret ?? null,
        paydAccountUsername: payd_account_username,
        isActive: shouldAutoActivate,
        withdrawalsEnabled: false,
      })
      .onConflictDoUpdate({
        target: credentialsTable.paydAccountUsername,
        set: {
          paydUsername: payd_username,
          paydPassword: payd_password,
          paydApiSecret: payd_api_secret ?? null,
          updatedAt: new Date(),
          // Do NOT reset isActive or withdrawalsEnabled on update — admin controls those
        },
      })
      .returning();

    const saved = result[0];
    req.log.info({ account: payd_account_username, isActive: saved?.isActive }, "Credentials saved");
    res.cookie(COOKIE_NAME, payd_account_username, COOKIE_OPTS);

    res.json({
      is_configured: true,
      account_username: payd_account_username,
      payd_username,
      payd_password,
      payd_api_secret: payd_api_secret ?? null,
      is_active: saved?.isActive ?? shouldAutoActivate,
      withdrawals_enabled: saved?.withdrawalsEnabled ?? false,
      has_api_key: true,
      has_password: true,
      has_api_secret: !!payd_api_secret,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to save credentials");
    // The most common cause is that the `credentials` table does not exist yet
    // because its migration has not been applied to this database branch.
    // Netlify applies pending migrations automatically on the next deploy, so
    // surface a clear, actionable message instead of an opaque 500.
    const msg = String(err);
    const tableMissing = /relation .*credentials.* does not exist|no such table|undefined_table/i.test(msg);
    if (tableMissing) {
      res.status(503).json({
        error: "Credentials store not ready",
        message:
          "The credentials database table has not been created yet — it is applied automatically on the next deploy. " +
          "In the meantime you can set PAYD_USERNAME, PAYD_PASSWORD and PAYD_ACCOUNT_USERNAME as Netlify environment variables to use the dashboard immediately.",
      });
      return;
    }
    res.status(500).json({ error: "Failed to save credentials", message: msg });
  }
});

// DELETE /api/settings/credentials — remove the current browser's saved
// credentials and clear the cookie. Lets a user wipe their stored credentials
// from the dashboard so the table stays flexible (written and deleted).
router.delete("/settings/credentials", async (req: Request, res: Response): Promise<void> => {
  try {
    await ensureCredentialsTable();
    const paydUser = req.cookies[COOKIE_NAME] as string | undefined;

    if (paydUser) {
      await db.delete(credentialsTable).where(eq(credentialsTable.paydAccountUsername, paydUser));
    }

    res.clearCookie(COOKIE_NAME, { path: "/" });
    res.json({ deleted: true, account_username: paydUser ?? null });
  } catch (err) {
    req.log.error({ err }, "Failed to delete credentials");
    res.status(500).json({ error: "Failed to delete credentials", message: String(err) });
  }
});

export default router;
