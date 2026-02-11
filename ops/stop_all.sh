#!/bin/bash
# MORTEM v2 - Stop All Services

echo "========================================"
echo "  MORTEM v2 — Stopping All Services"
echo "========================================"
echo

# Send SIGTERM to screen sessions
if screen -ls | grep -q heartbeat; then
    screen -S heartbeat -X quit
    echo "  ✅ Heartbeat stream: STOPPED"
else
    echo "  ⚠️  Heartbeat stream: Not running"
fi

if screen -ls | grep -q mortem; then
    screen -S mortem -X quit
    echo "  ✅ MORTEM witness: STOPPED"
else
    echo "  ⚠️  MORTEM witness: Not running"
fi

# Also kill any orphaned Python processes
pkill -f "heartbeat_stream.py" 2>/dev/null
pkill -f "mortem_witness.py" 2>/dev/null

echo
echo "All services stopped."
