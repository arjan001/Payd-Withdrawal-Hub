---
name: Auth middleware
description: JWT session setup and how to access the logged-in user in routes
---

## Rule
Use `(req as AuthRequest).user.userId` in any protected route handler. Import `AuthRequest` from `../middlewares/auth`.

## Details
- JWT stored in HttpOnly cookie `payd_session`, 7-day expiry
- Secret from `JWT_SECRET` env var (fallback: `payd-dev-secret-change-in-prod`)
- `requireAuth` middleware populates `req.user` with `{ userId, email, name }`
- `AuthRequest = Request & { user: SessionPayload }` — exported from `auth.ts`
- Public routes (auth register/login/logout/me, healthz, webhook) do NOT use requireAuth
- `/test` route bypasses frontend AuthGate via `isPublicPath()` check on `window.location.pathname`

**Why:** bcryptjs (pure JS) chosen over bcrypt (native) to avoid native module bundling issues with esbuild.
