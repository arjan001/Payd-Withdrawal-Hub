#!/bin/bash
# PAYD API Withdrawal - Startup Script
# Run this script to start both API and Dashboard servers

set -e  # Exit on error

echo "======================================"
echo "PAYD API Withdrawal System"
echo "======================================"
echo ""

# Kill any existing processes on the ports
echo "Cleaning up existing processes..."
pkill -9 -f "node.*dist/index.mjs" 2>/dev/null || true
pkill -9 -f "vite.*preview" 2>/dev/null || true
sleep 2

# Source environment variables
echo "Loading environment..."
set -a
source /vercel/share/.env.project
set +a

# Disable SSL verification for Supabase in development
export NODE_TLS_REJECT_UNAUTHORIZED=0

# Get the project directory
PROJECT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$PROJECT_DIR"

echo "Project: $PROJECT_DIR"
echo ""

# Ensure dependencies are installed
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  pnpm install
  echo ""
fi

# Start API Server (background)
echo "Starting API Server on port 3001..."
cd "$PROJECT_DIR/artifacts/api-server"

# Build if needed
if [ ! -d "dist" ]; then
  echo "Building API server..."
  pnpm run build
fi

PORT=3001 node --enable-source-maps ./dist/index.mjs &
API_PID=$!
echo "✓ API Server PID: $API_PID"
sleep 3

# Start Dashboard (background)
echo ""
echo "Starting Dashboard on port 3000..."
cd "$PROJECT_DIR/artifacts/dashboard"

# Build if needed
if [ ! -d "dist" ]; then
  echo "Building Dashboard..."
  pnpm run build
fi

PORT=3000 npx vite preview --host 0.0.0.0 &
DASHBOARD_PID=$!
echo "✓ Dashboard PID: $DASHBOARD_PID"
sleep 2

echo ""
echo "======================================"
echo "✅ SYSTEM STARTED"
echo "======================================"
echo ""
echo "Services:"
echo "  API Server:    http://localhost:3001"
echo "  Dashboard:     http://localhost:3000"
echo "  Admin Panel:   http://localhost:3001/api/test/status"
echo ""
echo "API PIDs:"
echo "  API Server: $API_PID"
echo "  Dashboard:  $DASHBOARD_PID"
echo ""
echo "To stop the services:"
echo "  kill $API_PID"
echo "  kill $DASHBOARD_PID"
echo ""
echo "Or run: pkill -f 'node.*dist/index.mjs'; pkill -f 'vite.*preview'"
echo ""

# Keep script running (optional)
# Uncomment to keep process running
# wait
