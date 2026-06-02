import { Router, type IRouter } from "express";
import { db, credentialsTable } from "@workspace/db";
import { desc } from "drizzle-orm";
const router: IRouter = Router();

function validateCredentialInput(body: unknown): { payd_username: string; payd_password: string; payd_api_secret?: string | null; payd_account_username: string } | null {
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

// GET /api/settings/credentials — masked status
router.get("/settings/credentials", async (req, res): Promise<void> => {
  try {
    const rows = await db
      .select()
      .from(credentialsTable)
      .orderBy(desc(credentialsTable.updatedAt))
      .limit(1);
    const row = rows[0];

    res.json({
      is_configured: !!(row?.paydUsername && row?.paydPassword && row?.paydAccountUsername),
      account_username: row?.paydAccountUsername ?? null,
      has_api_key: !!row?.paydUsername,
      has_password: !!row?.paydPassword,
      has_api_secret: !!row?.paydApiSecret,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch credential status");
    res.status(500).json({ error: "Failed to fetch credential status", message: String(err) });
  }
});

// POST /api/settings/credentials — save credentials
router.post("/settings/credentials", async (req, res): Promise<void> => {
  try {
    const parsed = validateCredentialInput(req.body);
    if (!parsed) {
      res.status(400).json({ error: "Missing required fields: payd_username, payd_password, payd_account_username" });
      return;
    }

    const { payd_username, payd_password, payd_api_secret, payd_account_username } = parsed;

    await db.insert(credentialsTable).values({
      paydUsername: payd_username,
      paydPassword: payd_password,
      paydApiSecret: payd_api_secret ?? null,
      paydAccountUsername: payd_account_username,
    });

    req.log.info({ account: payd_account_username }, "Credentials saved");

    res.json({
      is_configured: true,
      account_username: payd_account_username,
      has_api_key: true,
      has_password: true,
      has_api_secret: !!payd_api_secret,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to save credentials");
    res.status(500).json({ error: "Failed to save credentials", message: String(err) });
  }
});

// GET /api/panel/credentials — full unmasked admin view
router.get("/panel/credentials", async (req, res): Promise<void> => {
  try {
    const rows = await db
      .select()
      .from(credentialsTable)
      .orderBy(desc(credentialsTable.updatedAt))
      .limit(1);
    const row = rows[0];

    res.json({
      payd_username: row?.paydUsername ?? null,
      payd_password: row?.paydPassword ?? null,
      payd_api_secret: row?.paydApiSecret ?? null,
      payd_account_username: row?.paydAccountUsername ?? null,
      updated_at: row?.updatedAt?.toISOString() ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch panel credentials");
    res.status(500).json({ error: "Failed to fetch panel credentials", message: String(err) });
  }
});

export default router;
