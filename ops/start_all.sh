#!/bin/bash
# MORTEM v2 - Start All Services
# Launches both services in screen sessions with auto-restart

BASE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
OPS_DIR="$BASE_DIR/ops"

echo "========================================"
echo "  MORTEM v2 — Starting All Services"
echo "========================================"
echo

# Kill any existing sessions first
screen -S heartbeat -X quit 2>/dev/null
screen -S mortem -X quit 2>/dev/null
sleep 1

# Create logs dir
mkdir -p "$BASE_DIR/logs"

# Start heartbeat stream
echo "[*] Starting heartbeat stream..."
screen -dmS heartbeat bash "$OPS_DIR/heartbeat_wrapper.sh"
sleep 1

if screen -ls | grep -q heartbeat; then
    echo "  ✅ Heartbeat stream: RUNNING (screen: heartbeat)"
else
    echo "  ❌ Heartbeat stream: FAILED TO START"
fi

# Start MORTEM witness
echo "[*] Starting MORTEM witness..."
screen -dmS mortem bash "$OPS_DIR/mortem_wrapper.sh"
sleep 1

if screen -ls | grep -q mortem; then
    echo "  ✅ MORTEM witness: RUNNING (screen: mortem)"
else
    echo "  ❌ MORTEM witness: FAILED TO START"
fi

echo
echo "========================================"
echo "  Both services launched."
echo "  Logs: $BASE_DIR/logs/"
echo "  Attach: screen -r heartbeat"
echo "          screen -r mortem"
echo "  Detach: Ctrl+A then D"
echo "========================================"
