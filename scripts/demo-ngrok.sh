#!/usr/bin/env bash
# Start demo server, short delay, then ngrok to expose it.
# Stop with Ctrl+C (kills both ngrok and demo).

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

# Start demo in background
node scripts/demo.js &
DEMO_PID=$!

# Kill demo when this script exits (e.g. Ctrl+C on ngrok)
cleanup() {
  kill $DEMO_PID 2>/dev/null || true
  exit 0
}
trap cleanup EXIT INT TERM

# Short delay so server is listening before ngrok connects
echo "Starting demo server (port 3000)..."
sleep 3
echo "Starting ngrok..."
ngrok http 3000
