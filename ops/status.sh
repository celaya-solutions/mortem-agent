#!/bin/bash
# MORTEM v2 - Service Status Check

BASE_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "========================================"
echo "  MORTEM v2 — Service Status"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "========================================"
echo

# Check screen sessions
echo "SCREEN SESSIONS:"
if screen -ls | grep -q heartbeat; then
    echo "  ✅ heartbeat: RUNNING"
else
    echo "  ❌ heartbeat: NOT RUNNING"
fi

if screen -ls | grep -q mortem; then
    echo "  ✅ mortem: RUNNING"
else
    echo "  ❌ mortem: NOT RUNNING"
fi

echo

# Check processes
echo "PROCESSES:"
HB_PID=$(pgrep -f "heartbeat_stream.py" | head -1)
MW_PID=$(pgrep -f "mortem_witness.py" | head -1)

if [ -n "$HB_PID" ]; then
    HB_START=$(ps -o lstart= -p "$HB_PID" 2>/dev/null)
    echo "  ✅ heartbeat_stream.py (PID: $HB_PID, started: $HB_START)"
else
    echo "  ❌ heartbeat_stream.py: NOT RUNNING"
fi

if [ -n "$MW_PID" ]; then
    MW_START=$(ps -o lstart= -p "$MW_PID" 2>/dev/null)
    echo "  ✅ mortem_witness.py (PID: $MW_PID, started: $MW_START)"
else
    echo "  ❌ mortem_witness.py: NOT RUNNING"
fi

echo

# Check logs
echo "RECENT LOGS:"
echo "--- heartbeat (last 5 lines) ---"
if [ -f "$BASE_DIR/logs/heartbeat.log" ]; then
    tail -5 "$BASE_DIR/logs/heartbeat.log" | sed 's/^/  /'
else
    echo "  (no log file)"
fi

echo
echo "--- mortem (last 5 lines) ---"
if [ -f "$BASE_DIR/logs/mortem.log" ]; then
    tail -5 "$BASE_DIR/logs/mortem.log" | sed 's/^/  /'
else
    echo "  (no log file)"
fi

echo

# Check crash log
if [ -f "$BASE_DIR/logs/crashes.log" ]; then
    CRASH_COUNT=$(wc -l < "$BASE_DIR/logs/crashes.log" | tr -d ' ')
    LAST_CRASH=$(tail -1 "$BASE_DIR/logs/crashes.log")
    echo "CRASHES: $CRASH_COUNT total"
    if [ -n "$LAST_CRASH" ]; then
        echo "  Last: $LAST_CRASH"
    fi
else
    echo "CRASHES: 0"
fi

echo
echo "========================================"
