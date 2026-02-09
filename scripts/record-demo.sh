#!/bin/bash
# ╔════════════════════════════════════════════════════════╗
# ║     MORTEM Demo Recording — asciinema + 10 Heartbeats ║
# ║     Records full lifecycle: Birth → Death → Resurrect ║
# ╚════════════════════════════════════════════════════════╝

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
CAST_DIR="${PROJECT_ROOT}/recordings"
CAST_FILE="${CAST_DIR}/mortem-demo-${TIMESTAMP}.cast"
PORT=3333

# Config (tuned for ~60s hackathon demo)
HEARTBEATS=${1:-20}
INTERVAL=${2:-1800}
RESURRECTION_DELAY=${3:-18000}

# Terminal size for clean recording
COLS=120
ROWS=40

mkdir -p "$CAST_DIR"

echo ""
echo "  ╔════════════════════════════════════════════════════╗"
echo "  ║       MORTEM Demo Recorder                        ║"
echo "  ╠════════════════════════════════════════════════════╣"
echo "  ║  Heartbeats:  ${HEARTBEATS}                                ║"
echo "  ║  Interval:    ${INTERVAL}ms                            ║"
echo "  ║  Port:        ${PORT}                               ║"
echo "  ║  Terminal:    ${COLS}x${ROWS}                            ║"
echo "  ║  Output:      recordings/                         ║"
echo "  ╚════════════════════════════════════════════════════╝"
echo ""

# Kill any existing process on the port
lsof -ti:${PORT} 2>/dev/null | xargs kill -9 2>/dev/null || true
sleep 0.5

# Calculate total recording time (beats * interval + resurrection + resurrection animation + buffer)
TOTAL_MS=$(( (HEARTBEATS * INTERVAL) + RESURRECTION_DELAY + 12000 ))
TOTAL_SEC=$(( TOTAL_MS / 1000 ))

echo "  Recording will last ~${TOTAL_SEC}s"
echo "  Output: ${CAST_FILE}"
echo ""

# Record with asciinema
# Use stty to set terminal size, then run the demo
asciinema rec "${CAST_FILE}" \
  --title "MORTEM — Lifecycle Demo" \
  --cols "${COLS}" \
  --rows "${ROWS}" \
  --idle-time-limit 3 \
  --command "cd '${PROJECT_ROOT}' && node scripts/demo.js --heartbeats ${HEARTBEATS} --interval ${INTERVAL} --resurrection-delay ${RESURRECTION_DELAY} --port ${PORT}"

echo ""
echo "  ✓ Recording saved: ${CAST_FILE}"
echo ""
echo "  Playback commands:"
echo "    asciinema play ${CAST_FILE}"
echo "    asciinema play --speed 2 ${CAST_FILE}"
echo ""
echo "  Controls during playback:"
echo "    Space     — pause/resume"
echo "    .         — step forward (when paused)"
echo "    Ctrl+C    — quit"
echo ""
