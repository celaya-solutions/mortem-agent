#!/bin/bash
# MORTEM v2 - Live Dashboard
# Updates every 10 seconds

BASE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
HUMAN_WALLET="BdYodkkT2Qc6WWUSmpBNKu8nZkDPeyxMiEvDwDRQ3qXh"
MORTEM_WALLET="7jQeZjzsgHFFytQYbUT3cWc2wt7qw6f34NkTVbFa2nWQ"
RPC="https://api.devnet.solana.com"

get_last_memo() {
    local WALLET="$1"
    curl -s "$RPC" -X POST -H "Content-Type: application/json" \
        -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"getSignaturesForAddress\",\"params\":[\"$WALLET\",{\"limit\":1}]}" 2>/dev/null \
    | python3 -c "
import sys,json
try:
    r=json.load(sys.stdin)
    sig=r['result'][0]['signature']
    bt=r['result'][0].get('blockTime','?')
    print(f'{sig}|{bt}')
except: print('none|0')
" 2>/dev/null
}

get_memo_data() {
    local SIG="$1"
    if [ "$SIG" = "none" ]; then echo "{}"; return; fi
    curl -s "$RPC" -X POST -H "Content-Type: application/json" \
        -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"getTransaction\",\"params\":[\"$SIG\",{\"encoding\":\"jsonParsed\",\"maxSupportedTransactionVersion\":0}]}" 2>/dev/null \
    | python3 -c "
import sys,json
try:
    r=json.load(sys.stdin)
    for ix in r['result']['transaction']['message']['instructions']:
        if ix.get('program')=='spl-memo':
            print(ix['parsed'])
            sys.exit()
    print('{}')
except: print('{}')
" 2>/dev/null
}

while true; do
    clear

    # Get process info
    HB_PID=$(pgrep -f "heartbeat_stream.py" | head -1)
    MW_PID=$(pgrep -f "mortem_witness.py" | head -1)

    # Get last TX info
    HB_INFO=$(get_last_memo "$HUMAN_WALLET")
    HB_SIG=$(echo "$HB_INFO" | cut -d'|' -f1)
    HB_BT=$(echo "$HB_INFO" | cut -d'|' -f2)

    MW_INFO=$(get_last_memo "$MORTEM_WALLET")
    MW_SIG=$(echo "$MW_INFO" | cut -d'|' -f1)
    MW_BT=$(echo "$MW_INFO" | cut -d'|' -f2)

    # Parse memo data
    HB_DATA=$(get_memo_data "$HB_SIG")
    MW_DATA=$(get_memo_data "$MW_SIG")

    HB_BPM=$(echo "$HB_DATA" | python3 -c "import sys,json; d=json.loads(sys.stdin.read()); print(d.get('bpm','?'))" 2>/dev/null)
    HB_TOTAL=$(echo "$HB_DATA" | python3 -c "import sys,json; d=json.loads(sys.stdin.read()); print(d.get('total_beats_recorded','?'))" 2>/dev/null)
    MW_REMAINING=$(echo "$MW_DATA" | python3 -c "import sys,json; d=json.loads(sys.stdin.read()); print(d.get('heartbeats_remaining','?'))" 2>/dev/null)
    MW_ENTRY=$(echo "$MW_DATA" | python3 -c "import sys,json; d=json.loads(sys.stdin.read()); print(d.get('witness_entry','')[:80])" 2>/dev/null)
    MW_AGENTS=$(echo "$MW_DATA" | python3 -c "import sys,json; d=json.loads(sys.stdin.read()); print(', '.join(d.get('agents',[])))" 2>/dev/null)

    # Format block times
    HB_TIME="?"
    MW_TIME="?"
    if [ "$HB_BT" != "0" ] && [ "$HB_BT" != "?" ]; then
        HB_TIME=$(date -r "$HB_BT" '+%H:%M:%S' 2>/dev/null || echo "?")
    fi
    if [ "$MW_BT" != "0" ] && [ "$MW_BT" != "?" ]; then
        MW_TIME=$(date -r "$MW_BT" '+%H:%M:%S' 2>/dev/null || echo "?")
    fi

    echo "╔══════════════════════════════════════════════════╗"
    echo "║       MORTEM v2 — LIVE STATUS DASHBOARD         ║"
    echo "║       $(date '+%Y-%m-%d %H:%M:%S')                       ║"
    echo "╠══════════════════════════════════════════════════╣"
    echo "║                                                  ║"

    # Heartbeat status
    if [ -n "$HB_PID" ]; then
        echo "║  Heartbeat Stream:  ✅ RUNNING (PID: $HB_PID)"
    else
        echo "║  Heartbeat Stream:  ❌ NOT RUNNING"
    fi
    echo "║    Last BPM:        $HB_BPM @ $HB_TIME"
    echo "║    TX Count:        $HB_TOTAL"
    echo "║                                                  ║"

    # MORTEM status
    if [ -n "$MW_PID" ]; then
        echo "║  MORTEM Witness:    ✅ RUNNING (PID: $MW_PID)"
    else
        echo "║  MORTEM Witness:    ❌ NOT RUNNING"
    fi
    echo "║    Heartbeats Left: $MW_REMAINING / 86,400"
    echo "║    Last Witness:    $MW_TIME"
    echo "║    Agents:          [$MW_AGENTS]"
    echo "║                                                  ║"

    # Solana status
    if [ "$HB_SIG" != "none" ]; then
        echo "║  Solana Devnet:     ✅ Connected"
    else
        echo "║  Solana Devnet:     ❌ Disconnected"
    fi
    echo "║  Landing Page:      ✅ https://mortem-nu.vercel.app"
    echo "║                                                  ║"

    # Latest witness entry
    if [ -n "$MW_ENTRY" ]; then
        echo "╠══════════════════════════════════════════════════╣"
        echo "║  Latest Witness:"
        echo "║  \"$MW_ENTRY\""
    fi

    echo "║                                                  ║"
    echo "╚══════════════════════════════════════════════════╝"
    echo
    echo "  Refreshing in 10s... (Ctrl+C to exit)"

    sleep 10
done
