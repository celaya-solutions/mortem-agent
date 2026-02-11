#!/bin/bash
# MORTEM v2 - Emergency Restart
# Kills everything and starts fresh

BASE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
OPS_DIR="$BASE_DIR/ops"

echo "🚨 MORTEM v2 — EMERGENCY RESTART"
echo "================================="
echo

echo "[1/4] Killing all screen sessions..."
screen -S heartbeat -X quit 2>/dev/null
screen -S mortem -X quit 2>/dev/null

echo "[2/4] Killing all Python processes..."
pkill -9 -f "heartbeat_stream.py" 2>/dev/null
pkill -9 -f "mortem_witness.py" 2>/dev/null
pkill -9 -f "monitor.py" 2>/dev/null

echo "[3/4] Waiting 5 seconds..."
sleep 5

echo "[4/4] Starting all services..."
bash "$OPS_DIR/start_all.sh"

echo
echo "Emergency restart complete."
echo "Run ./ops/status.sh to verify."
