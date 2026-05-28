# Payd Money Dashboard

A dashboard for managing Payd Money account operations — view live balances, initiate M-Pesa payins (STK push) and payouts (withdrawals), and track transaction status.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080); also serves the built dashboard frontend at `/`
- `PORT=3000 BASE_PATH=/ pnpm --filter @workspace/dashboard run build` — rebuild the dashboard frontend (output: `artifacts/dashboard/dist/public/`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM (not yet used)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- Frontend: React + Vite + Tailwind (dark fintech theme)

## Where things live

- `artifacts/api-server/src/app.ts` — Express app; serves static frontend + API routes
- `artifacts/api-server/src/lib/payd.ts` — Payd API client (Basic Auth)
- `artifacts/api-server/src/routes/payd.ts` — Payd proxy routes
- `artifacts/api-server/src/routes/index.ts` — route registry
- `artifacts/dashboard/src/pages/` — dashboard, payin, payout, transactions pages
- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth for API contract)
- `lib/api-client-react/` — generated React Query hooks
- `lib/api-zod/` — generated Zod schemas

## Architecture decisions

- **Static files served from API server**: The built dashboard `dist/public/` is served by the Express API server at `/`. This avoids the need for a separate Vite dev server to be registered with the proxy.
- **Basic Auth only**: Payd API uses HTTP Basic Auth (`Authorization: Basic base64(username:password)`). No token exchange or OTP flow needed for API key credentials.
- **All Payd paths use `/api/` prefix**: The base URL is `https://api.payd.money` but all endpoints include `/api/v1/` or `/api/v2/` prefix (e.g. `/api/v1/accounts/{username}/all_balances`).
- **Webhook endpoint registered**: `POST /api/webhook/payd` receives Payd transaction callbacks. The callback URL is auto-derived from `REPLIT_DOMAINS` or `REPLIT_DEV_DOMAIN`.
- **Transactions list not available in Payd API**: There is no documented list-transactions endpoint. The transactions page gracefully shows empty state.

## Product

- **Dashboard**: Live KES and USD wallet balances, recent activity summary
- **Deposit (Payin)**: M-Pesa STK push to collect funds from a customer's phone
- **Withdraw (Payout)**: Send money to an M-Pesa wallet via `/api/v2/withdrawal`
- **Transactions**: Lists available transaction history (empty until Payd exposes a list endpoint)

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Dashboard must be **rebuilt** after any frontend change: `PORT=3000 BASE_PATH=/ pnpm --filter @workspace/dashboard run build`
- Then **restart the API server workflow** so it serves the new `dist/public/` files.
- The `PAYD_USERNAME` and `PAYD_PASSWORD` are API key credentials (not your Payd account login). Generated from Profile → API Keys in the Payd web app.
- `PAYD_ACCOUNT_USERNAME` is the **Payd profile username** (e.g. `techlink`) — distinct from the API key username. It must appear in payment request bodies as the `username` field. Without it, Payd returns HTTP 415 "error getting user".
- `PAYD_API_SECRET` is currently unused — Payd's Basic Auth only needs username + password.
- Phone numbers for M-Pesa must start with `0` and be exactly 10 digits (e.g. `0712345678`).
- **Payouts return "Unable to process payouts"** — this is a Payd account-side restriction (KYC / payout permission not yet enabled on the account), not a code issue. The request is being sent correctly with all required fields.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- Payd API docs: https://payd.money (Profile → API Keys to generate credentials)
