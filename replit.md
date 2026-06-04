# Payd Money Dashboard

A fintech dashboard for managing Payd API account operations — view live balances, initiate M-Pesa payins (STK push), track transaction history.

## Quick Start (fresh fork / clone)

1. Open the Replit shell and run:
   ```
   pnpm install
   ```
2. Ensure the **PostgreSQL database** is provisioned (Replit provides one automatically — check the Database tab). The `DATABASE_URL` secret is set automatically.
3. Start the API server workflow. On first boot the server **auto-creates every database table** — no manual migrations needed.
4. Rebuild the dashboard frontend once:
   ```
   PORT=3000 BASE_PATH=/ pnpm --filter @workspace/dashboard run build
   ```
5. The app is ready at the preview URL.

## Development Commands

- `pnpm --filter @workspace/api-server run dev` — run API server (port from `PORT` env); also serves built dashboard at `/`
- `PORT=3000 BASE_PATH=/ pnpm --filter @workspace/dashboard run build` — rebuild the dashboard (run after any frontend change)
- `pnpm run typecheck` — typecheck all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks from OpenAPI spec

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- Frontend: React + Vite + Tailwind (dark fintech theme)

## Where things live

- `artifacts/api-server/src/app.ts` — Express app; serves static frontend + API routes
- `artifacts/api-server/src/index.ts` — server entry point; calls `initializeDatabase()` on boot
- `artifacts/api-server/src/lib/payd.ts` — Payd API client (Basic Auth)
- `artifacts/api-server/src/routes/payd.ts` — Payd proxy routes
- `artifacts/api-server/src/routes/settings.ts` — credential management routes
- `artifacts/api-server/src/routes/auth.ts` — register / login / logout / me
- `artifacts/api-server/src/middlewares/auth.ts` — JWT middleware (`requireAuth`)
- `lib/db/src/index.ts` — DB client + `initializeDatabase()` auto-setup
- `lib/db/src/schema/` — Drizzle table definitions
- `artifacts/dashboard/src/pages/` — dashboard, payin, payout, transactions, settings pages
- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth)
- `lib/api-client-react/` — generated React Query hooks

## Architecture decisions

- **Static files served from API server**: The built dashboard `dist/public/` is served by Express at `/`. Rebuild the dashboard after any frontend change.
- **Auto DB setup on boot**: `initializeDatabase()` in `lib/db/src/index.ts` runs every startup. All SQL uses `IF NOT EXISTS` guards — safe and idempotent on every restart.
- **Auth**: JWT stored in an HttpOnly cookie (`payd_session`, 7-day expiry). All data is scoped per user — each registered user has their own isolated credentials and transaction history.
- **Basic Auth to Payd**: Payd API uses HTTP Basic Auth (`Authorization: Basic base64(username:password)`). No token exchange needed.
- **Webhook endpoint**: `POST /api/webhook/payd` receives Payd transaction callbacks. Callback URL is auto-derived from `REPLIT_DOMAINS` or `REPLIT_DEV_DOMAIN`.

## Gotchas

- Dashboard must be **rebuilt** after any frontend change: `PORT=3000 BASE_PATH=/ pnpm --filter @workspace/dashboard run build`, then restart the API server workflow.
- `PAYD_USERNAME` / `PAYD_PASSWORD` are API key credentials (not your Payd account login). Generate from Profile → API Keys in the Payd web app.
- `PAYD_ACCOUNT_USERNAME` is the Payd profile username (e.g. `techlink`), distinct from the API key username.
- Phone numbers for M-Pesa must start with `254` and be in international format (e.g. `254712345678`).
- Payouts may return errors outside of permitted operating hours — this is normal Payd API behaviour.

## User preferences

- Keep all implementation changes minimal and targeted — no rewrites unless explicitly asked.
- The system is already fully built. When asked to add a feature that already exists, confirm it exists rather than rebuilding it.
