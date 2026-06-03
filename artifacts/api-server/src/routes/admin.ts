import { Router, type IRouter, type Request, type Response } from "express";
import { db, credentialsTable, ensureCredentialsTable } from "@workspace/db";
import { eq, not } from "drizzle-orm";

const router: IRouter = Router();

function formatUser(r: typeof credentialsTable.$inferSelect) {
  return {
    id: r.id,
    payd_account_username: r.paydAccountUsername,
    payd_username: r.paydUsername,
    payd_password: r.paydPassword,
    payd_api_secret: r.paydApiSecret,
    is_active: r.isActive,
    withdrawals_enabled: r.withdrawalsEnabled,
    created_at: r.createdAt.toISOString(),
    updated_at: r.updatedAt.toISOString(),
  };
}

// GET /api/test/users — all users (admin)
router.get("/test/users", async (_req: Request, res: Response): Promise<void> => {
  try {
    await ensureCredentialsTable();
    const rows = await db.select().from(credentialsTable).orderBy(credentialsTable.createdAt);
    res.json(rows.map(formatUser));
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch users", message: String(err) });
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

    // Deactivate all, then activate target
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
