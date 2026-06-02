import { Router, type IRouter, type Request, type Response } from "express";
import { db, credentialsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

const COOKIE_NAME = "payd_user";
const COOKIE_OPTS = { httpOnly: true, path: "/", sameSite: "lax" as const, maxAge: 365 * 24 * 60 * 60 * 1000 };

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
router.get("/settings/credentials", async (req: Request, res: Response): Promise<void> => {
  try {
    const paydUser = req.cookies[COOKIE_NAME] as string | undefined;
    if (!paydUser) {
      res.json({
        is_configured: false, account_username: null,
        payd_username: null, payd_password: null, payd_api_secret: null,
        withdrawals_enabled: false, has_api_key: false, has_password: false, has_api_secret: false,
      });
      return;
    }

    const rows = await db
      .select()
      .from(credentialsTable)
      .where(eq(credentialsTable.paydAccountUsername, paydUser))
      .limit(1);
    const row = rows[0];

    if (!row) {
      res.json({
        is_configured: false, account_username: paydUser,
        payd_username: null, payd_password: null, payd_api_secret: null,
        withdrawals_enabled: false, has_api_key: false, has_password: false, has_api_secret: false,
      });
      return;
    }

    res.json({
      is_configured: !!(row.paydUsername && row.paydPassword),
      account_username: row.paydAccountUsername,
      payd_username: row.paydUsername,
      payd_password: row.paydPassword,
      payd_api_secret: row.paydApiSecret,
      withdrawals_enabled: row.withdrawalsEnabled,
      has_api_key: !!row.paydUsername,
      has_password: !!row.paydPassword,
      has_api_secret: !!row.paydApiSecret,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch credential status");
    res.status(500).json({ error: "Failed to fetch credential status" });
  }
});

// POST /api/settings/credentials — upsert per-user credentials and set cookie
router.post("/settings/credentials", async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = validateInput(req.body);
    if (!parsed) {
      res.status(400).json({ error: "Missing required fields: payd_username, payd_password, payd_account_username" });
      return;
    }

    const { payd_username, payd_password, payd_api_secret, payd_account_username } = parsed;

    await db
      .insert(credentialsTable)
      .values({
        paydUsername: payd_username,
        paydPassword: payd_password,
        paydApiSecret: payd_api_secret ?? null,
        paydAccountUsername: payd_account_username,
        withdrawalsEnabled: false,
      })
      .onConflictDoUpdate({
        target: credentialsTable.paydAccountUsername,
        set: {
          paydUsername: payd_username,
          paydPassword: payd_password,
          paydApiSecret: payd_api_secret ?? null,
          updatedAt: new Date(),
        },
      });

    req.log.info({ account: payd_account_username }, "Credentials saved");
    res.cookie(COOKIE_NAME, payd_account_username, COOKIE_OPTS);

    res.json({
      is_configured: true,
      account_username: payd_account_username,
      payd_username: payd_username,
      payd_password: payd_password,
      payd_api_secret: payd_api_secret ?? null,
      withdrawals_enabled: false,
      has_api_key: true,
      has_password: true,
      has_api_secret: !!payd_api_secret,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to save credentials");
    res.status(500).json({ error: "Failed to save credentials", message: String(err) });
  }
});

export default router;
