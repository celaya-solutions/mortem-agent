#!/bin/bash
# MORTEM v2 - Heartbeat Stream Auto-Restart Wrapper
# Runs heartbeat_stream.py and restarts on crash

BASE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SERVICE_DIR="$BASE_DIR/heartbeat-stream"
VENV="$SERVICE_DIR/.venv/bin/python"
LOG="$BASE_DIR/logs/heartbeat.log"
CRASH_LOG="$BASE_DIR/logs/crashes.log"
RESTART_WAIT=10

echo "[$(date '+%Y-%m-%d %H:%M:%S')] [HEARTBEAT] [START] Wrapper starting" | tee -a "$LOG"

while true; do
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [HEARTBEAT] [RUN] Starting heartbeat_stream.py" | tee -a "$LOG"

    cd "$SERVICE_DIR"
    "$VENV" heartbeat_stream.py 2>&1 | tee -a "$LOG"

    EXIT_CODE=$?
    TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

    echo "[$TIMESTAMP] [HEARTBEAT] [CRASH] Exit code: $EXIT_CODE. Restarting in ${RESTART_WAIT}s..." | tee -a "$LOG"
    echo "[$TIMESTAMP] [HEARTBEAT] [CRASH] Exit code: $EXIT_CODE" >> "$CRASH_LOG"

    sleep $RESTART_WAIT
done
