#!/bin/bash
# MORTEM v2 - Witness Agent Auto-Restart Wrapper
# Runs mortem_witness.py and restarts on crash

BASE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SERVICE_DIR="$BASE_DIR/mortem-witness"
VENV="$SERVICE_DIR/.venv/bin/python"
LOG="$BASE_DIR/logs/mortem.log"
CRASH_LOG="$BASE_DIR/logs/crashes.log"
RESTART_WAIT=10

echo "[$(date '+%Y-%m-%d %H:%M:%S')] [MORTEM] [START] Wrapper starting" | tee -a "$LOG"

while true; do
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [MORTEM] [RUN] Starting mortem_witness.py" | tee -a "$LOG"

    cd "$SERVICE_DIR"
    "$VENV" mortem_witness.py 2>&1 | tee -a "$LOG"

    EXIT_CODE=$?
    TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

    echo "[$TIMESTAMP] [MORTEM] [CRASH] Exit code: $EXIT_CODE. Restarting in ${RESTART_WAIT}s..." | tee -a "$LOG"
    echo "[$TIMESTAMP] [MORTEM] [CRASH] Exit code: $EXIT_CODE" >> "$CRASH_LOG"

    sleep $RESTART_WAIT
done
