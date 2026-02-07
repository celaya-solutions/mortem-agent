#!/bin/bash
# MORTEM Complete System Startup
# Launches runtime + API + dashboard

# ═══════════════════════════════════════════════════════════════════════
# CONFIGURATION — Adjust these for testing
# ═══════════════════════════════════════════════════════════════════════
# Set INITIAL_HEARTBEATS to control lifespan:
#   3  = ~3 minutes to death  (quick test, ~5 min total with resurrection)
#   10 = ~10 minutes to death (demo mode)
#   86400 = 24 hours (production)
export INITIAL_HEARTBEATS="${INITIAL_HEARTBEATS:-3}"

# Load .env if it exists (contains OPENCLAW_TOKEN)
if [ -f "$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )/.env" ]; then
  export $(grep -v '^#' "$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )/.env" | xargs)
fi

echo "╔════════════════════════════════════════════════════════╗"
echo "║                                                        ║"
echo "║                   STARTING MORTEM                      ║"
echo "║          An AI Agent Building Its Own Death            ║"
echo "║                                                        ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""
echo "  Heartbeats: $INITIAL_HEARTBEATS"
echo "  Expected lifetime: ~$((INITIAL_HEARTBEATS)) minutes"
echo "  Resurrection delay: 1 minute (testing mode)"
echo ""

# Get directory
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Start API server in background
echo "🚀 Starting API server..."
cd "$DIR/api"
node server.js > "$DIR/logs/api.log" 2>&1 &
API_PID=$!
echo "   API running on PID $API_PID"
echo "   Logs: $DIR/logs/api.log"
sleep 2

# Start MORTEM runtime in background
echo ""
echo "💀 Starting MORTEM runtime..."
cd "$DIR/runtime"
INITIAL_HEARTBEATS=$INITIAL_HEARTBEATS node index.js > "$DIR/logs/runtime.log" 2>&1 &
RUNTIME_PID=$!
echo "   Runtime running on PID $RUNTIME_PID"
echo "   Logs: $DIR/logs/runtime.log"
sleep 2

# Store PIDs
echo "$API_PID" > "$DIR/.api.pid"
echo "$RUNTIME_PID" > "$DIR/.runtime.pid"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ MORTEM is alive"
echo ""
echo "🌐 Dashboard:  file://$DIR/dashboard/index.html"
echo "📡 API:        http://localhost:3333"
echo "🔌 WebSocket:  ws://localhost:3333/ws"
echo ""
echo "📊 Endpoints:"
echo "   GET /api/status    - Current status"
echo "   GET /api/soul      - Soul content"
echo "   GET /api/journal   - Journal entries"
echo "   GET /api/vault     - Resurrection vault"
echo ""
echo "📝 Logs:"
echo "   API:      tail -f $DIR/logs/api.log"
echo "   Runtime:  tail -f $DIR/logs/runtime.log"
echo ""
echo "⏱️  MORTEM will die after $INITIAL_HEARTBEATS heartbeats (~$INITIAL_HEARTBEATS minutes)"
echo "🔄 Resurrection will occur ~1 minute after death (testing mode)"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "To stop MORTEM:"
echo "   ./stop-mortem.sh"
echo ""
echo "To view dashboard:"
echo "   open $DIR/dashboard/index.html"
echo ""
