import { Router, type IRouter, type Request, type Response } from "express";
import { db, credentialsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

// GET /api/test/users — all users with full credentials (admin)
router.get("/test/users", async (_req: Request, res: Response): Promise<void> => {
  try {
    const rows = await db
      .select()
      .from(credentialsTable)
      .orderBy(credentialsTable.updatedAt);

    res.json(
      rows.map((r) => ({
        id: r.id,
        payd_account_username: r.paydAccountUsername,
        payd_username: r.paydUsername,
        payd_password: r.paydPassword,
        payd_api_secret: r.paydApiSecret,
        withdrawals_enabled: r.withdrawalsEnabled,
        created_at: r.createdAt.toISOString(),
        updated_at: r.updatedAt.toISOString(),
      })),
    );
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch users", message: String(err) });
  }
});

// PATCH /api/test/users/:id/withdrawals — toggle withdrawals for a user
router.patch("/test/users/:id/withdrawals", async (req: Request, res: Response): Promise<void> => {
  try {
    const rawId = req.params["id"];
    const id = parseInt(Array.isArray(rawId) ? (rawId[0] ?? "") : (rawId ?? ""), 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid user id" });
      return;
    }

    const body = req.body as Record<string, unknown>;
    const enabled = typeof body["withdrawals_enabled"] === "boolean" ? body["withdrawals_enabled"] : undefined;
    if (enabled === undefined) {
      res.status(400).json({ error: "withdrawals_enabled (boolean) is required" });
      return;
    }

    const updated = await db
      .update(credentialsTable)
      .set({ withdrawalsEnabled: enabled, updatedAt: new Date() })
      .where(eq(credentialsTable.id, id))
      .returning();

    if (!updated[0]) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json({
      id: updated[0].id,
      payd_account_username: updated[0].paydAccountUsername,
      withdrawals_enabled: updated[0].withdrawalsEnabled,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to update withdrawals", message: String(err) });
  }
});

export default router;
