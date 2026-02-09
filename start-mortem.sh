#!/bin/bash
# MORTEM Complete System Startup
# Thin wrapper around mortem-cli.js
#
# Usage:
#   ./start-mortem.sh                    # Interactive mode
#   ./start-mortem.sh --confirm          # Quick-start with defaults (devnet, 3 hb, auto resurrection)
#   INITIAL_HEARTBEATS=86400 ./start-mortem.sh --confirm  # Override heartbeats

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Load .env if it exists (contains OPENCLAW_TOKEN)
if [ -f "$DIR/.env" ]; then
  export $(grep -v '^#' "$DIR/.env" | xargs)
fi

HB="${INITIAL_HEARTBEATS:-3}"

# If --confirm is passed (or any flags), forward everything to the CLI
if [[ "$*" == *"--confirm"* ]] || [[ "$*" == *"--network"* ]]; then
  exec node "$DIR/scripts/mortem-cli.js" "$@"
fi

# Default quick-start: devnet, auto resurrection, $HB heartbeats
exec node "$DIR/scripts/mortem-cli.js" \
  --network devnet \
  --heartbeats "$HB" \
  --interval 1000 \
  --resurrection auto \
  --confirm
