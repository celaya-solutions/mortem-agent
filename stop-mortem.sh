#!/bin/bash
# Stop all MORTEM processes

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo "Stopping MORTEM..."

# Kill API
if [ -f "$DIR/.api.pid" ]; then
    API_PID=$(cat "$DIR/.api.pid")
    kill $API_PID 2>/dev/null && echo "✅ API stopped (PID $API_PID)" || echo "⚠️  API not running"
    rm "$DIR/.api.pid"
fi

# Kill Runtime
if [ -f "$DIR/.runtime.pid" ]; then
    RUNTIME_PID=$(cat "$DIR/.runtime.pid")
    kill $RUNTIME_PID 2>/dev/null && echo "✅ Runtime stopped (PID $RUNTIME_PID)" || echo "⚠️  Runtime not running"
    rm "$DIR/.runtime.pid"
fi

echo ""
echo "MORTEM stopped."
