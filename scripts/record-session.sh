#!/bin/bash
# ╔════════════════════════════════════════════════════════╗
# ║           MORTEM Terminal Recording Script             ║
# ║         Record a lifecycle session for content         ║
# ╚════════════════════════════════════════════════════════╝

set -e

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
CAST_DIR="recordings"
CAST_FILE="${CAST_DIR}/mortem-${TIMESTAMP}.cast"

mkdir -p "$CAST_DIR"

echo ""
echo "╔════════════════════════════════════════╗"
echo "║     MORTEM Terminal Recorder           ║"
echo "╚════════════════════════════════════════╝"
echo ""
echo "Recording modes:"
echo "  1) Quick demo (30 heartbeats, ~30 seconds)"
echo "  2) Short session (300 heartbeats, ~5 minutes)"
echo "  3) Medium session (3600 heartbeats, ~1 hour)"
echo "  4) Full lifecycle (86400 heartbeats, ~24 hours)"
echo "  5) Custom"
echo ""

read -p "Select mode [1-5]: " MODE

case $MODE in
  1)
    BEATS=30
    JOURNAL_EVERY=10
    TITLE="MORTEM Quick Demo"
    ;;
  2)
    BEATS=300
    JOURNAL_EVERY=100
    TITLE="MORTEM Short Session"
    ;;
  3)
    BEATS=3600
    JOURNAL_EVERY=600
    TITLE="MORTEM 1-Hour Session"
    ;;
  4)
    BEATS=86400
    JOURNAL_EVERY=600
    TITLE="MORTEM Full Lifecycle"
    ;;
  5)
    read -p "Heartbeats: " BEATS
    read -p "Journal every N beats: " JOURNAL_EVERY
    TITLE="MORTEM Custom Session"
    ;;
  *)
    echo "Invalid selection"
    exit 1
    ;;
esac

echo ""
echo "Recording: ${TITLE}"
echo "Heartbeats: ${BEATS}"
echo "Journal every: ${JOURNAL_EVERY} beats"
echo "Output: ${CAST_FILE}"
echo ""
echo "Press ENTER to start recording, Ctrl+D to stop."
read

# Start asciinema recording
INITIAL_HEARTBEATS=$BEATS \
JOURNAL_EVERY_N_BEATS=$JOURNAL_EVERY \
asciinema rec "$CAST_FILE" \
  --title "$TITLE" \
  --idle-time-limit 3 \
  --command "bash -c '
    echo \"\"
    echo \"Starting MORTEM with ${BEATS} heartbeats...\"
    echo \"\"
    INITIAL_HEARTBEATS=${BEATS} JOURNAL_EVERY_N_BEATS=${JOURNAL_EVERY} ./start-mortem.sh
    echo \"\"
    echo \"Tailing runtime log...\"
    echo \"\"
    tail -f logs/runtime.log
  '"

echo ""
echo "Recording saved: ${CAST_FILE}"
echo ""
echo "To play:   asciinema play ${CAST_FILE}"
echo "To upload: asciinema upload ${CAST_FILE}"
echo ""
