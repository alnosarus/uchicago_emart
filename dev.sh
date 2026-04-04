#!/bin/bash
# Start API (port 3000), Web (port 3001), and Worker for local development
# Usage: ./dev.sh

set -e

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

cleanup() {
  echo ""
  echo "Shutting down..."
  kill $API_PID $WEB_PID $WORKER_PID 2>/dev/null
  wait $API_PID $WEB_PID $WORKER_PID 2>/dev/null
  echo "Done."
}
trap cleanup EXIT INT TERM

# Kill anything already on ports 3000/3001
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
lsof -ti:3001 | xargs kill -9 2>/dev/null || true

echo "=== Starting API on http://localhost:3000 ==="
cd "$ROOT_DIR/apps/api"
npx tsx watch src/index.ts &
API_PID=$!

echo "=== Starting Worker ==="
cd "$ROOT_DIR/apps/api"
npx tsx watch src/worker.ts &
WORKER_PID=$!

echo "=== Starting Web on http://localhost:3001 ==="
cd "$ROOT_DIR/apps/web"
npx next dev -p 3001 &
WEB_PID=$!

echo ""
echo "API:    http://localhost:3000"
echo "Web:    http://localhost:3001"
echo "Worker: running"
echo ""
echo "Press Ctrl+C to stop all."

wait
