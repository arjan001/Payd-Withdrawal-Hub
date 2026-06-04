---
name: Dashboard static build
description: The dashboard is served as a static build from the API server, not via Vite dev server
---

## Rule
The API server serves the dashboard's compiled static files from `artifacts/dashboard/dist/public/`. The Vite dev server (port 3000) runs but is NOT what the proxy serves to users.

**Why:** The artifact routing sends all traffic through the API server at port 8080. The Vite dev server is available for HMR during active editing but the preview pane hits the API server's static file middleware.

**How to apply:** After any dashboard source change, run:
```
PORT=3000 BASE_PATH=/ pnpm --filter @workspace/dashboard run build
```
Then restart the API server workflow. Without this step, source changes will not be visible in the preview.
