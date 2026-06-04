---
name: Multi-tenancy architecture
description: How credentials and transactions are scoped per logged-in user
---

## Rule
All payd API operations and transaction reads/writes are scoped to the logged-in user's `user_id`. Never use the old `payd_user` cookie or `getActivePaydClient()` / `getPaydClient(cookie)` in authenticated routes.

## How it works
- `credentials` table has a `user_id` column (FK → users.id, unique index = one set per user)
- `transactions` table has a `user_id` column (FK → users.id, nullable for webhook-updated rows)
- Use `getPaydClientForUser(userId)` from `lib/payd.ts` for all per-user credential lookups
- `req.user.userId` comes from the JWT session via `requireAuth` middleware
- Settings routes (GET/POST/DELETE /api/settings/credentials) use `userId` as conflict target on upsert

**Why:** Each registered user needs their own isolated Payd API credentials and transaction history. Sharing a global "active" credential breaks multi-tenancy.

**How to apply:** In any new protected route that touches credentials or transactions, always filter/insert with `userId = (req as AuthRequest).user.userId`.

## Deprecated (do not use in new code)
- `getActivePaydClient()` — kept only for /test admin panel
- `getPaydClient(accountUsername)` — kept for admin panel legacy
- `payd_user` cookie — removed from settings and payd routes
