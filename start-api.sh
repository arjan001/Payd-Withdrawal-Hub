#!/bin/bash
set -a
source /vercel/share/.env.project 2>/dev/null || true
source /vercel/share/v0-project/.env 2>/dev/null || true
source /vercel/share/v0-project/artifacts/api-server/.env 2>/dev/null || true
set +a

export PORT=${PORT:-5000}
export JWT_SECRET=${JWT_SECRET:-"payd-dev-secret-change-in-production"}

echo "[v0] Starting API server with DATABASE_URL: ${DATABASE_URL:0:80}..."
echo "[v0] PORT: $PORT"

cd /vercel/share/v0-project/artifacts/api-server
node --enable-source-maps ./dist/index.mjs
