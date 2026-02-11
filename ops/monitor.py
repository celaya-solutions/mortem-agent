#!/usr/bin/env python3
"""
MORTEM v2 - Health Check Monitor
Runs every 5 minutes, checks both services, attempts restart if needed.
"""

import subprocess
import time
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import URLError

BASE_DIR = Path(__file__).parent.parent
LOGS_DIR = BASE_DIR / "logs"
MONITOR_LOG = LOGS_DIR / "monitor.log"

HUMAN_WALLET = "BdYodkkT2Qc6WWUSmpBNKu8nZkDPeyxMiEvDwDRQ3qXh"
MORTEM_WALLET = "7jQeZjzsgHFFytQYbUT3cWc2wt7qw6f34NkTVbFa2nWQ"
RPC = "https://api.devnet.solana.com"

# Thresholds
HEARTBEAT_MAX_AGE = 90      # seconds — 60s interval + 30s buffer
MORTEM_MAX_AGE = 600         # seconds — 300s interval + 300s buffer
LOG_MAX_AGE = 120            # seconds — log file should update within 2 min

CHECK_INTERVAL = 300         # 5 minutes between checks


def log(msg):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] [MONITOR] {msg}"
    print(line)
    with open(MONITOR_LOG, "a") as f:
        f.write(line + "\n")


def rpc_call(method, params):
    """Make a Solana RPC call."""
    try:
        body = json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params})
        req = Request(RPC, data=body.encode(), headers={"Content-Type": "application/json"})
        with urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read())
            return data.get("result")
    except Exception as e:
        log(f"RPC error: {e}")
        return None


def check_recent_tx(wallet, max_age_seconds):
    """Check if wallet has a recent transaction within max_age_seconds."""
    result = rpc_call("getSignaturesForAddress", [wallet, {"limit": 1}])
    if not result:
        return False, "No transactions found"

    block_time = result[0].get("blockTime")
    if block_time is None:
        return True, "TX found (no blockTime)"

    age = time.time() - block_time
    if age < max_age_seconds:
        return True, f"Last TX {int(age)}s ago"
    else:
        return False, f"Last TX {int(age)}s ago (stale, max {max_age_seconds}s)"


def check_screen(name):
    """Check if a screen session exists."""
    try:
        result = subprocess.run(["screen", "-ls"], capture_output=True, text=True)
        return name in result.stdout
    except Exception:
        return False


def check_process(name):
    """Check if a Python process is running."""
    try:
        result = subprocess.run(["pgrep", "-f", name], capture_output=True, text=True)
        return bool(result.stdout.strip())
    except Exception:
        return False


def check_log_fresh(log_path, max_age_seconds):
    """Check if log file was modified recently."""
    if not log_path.exists():
        return False, "Log file missing"
    mtime = log_path.stat().st_mtime
    age = time.time() - mtime
    if age < max_age_seconds:
        return True, f"Modified {int(age)}s ago"
    else:
        return False, f"Modified {int(age)}s ago (stale)"


def attempt_restart(service):
    """Attempt to restart a crashed service."""
    log(f"⚠️ Attempting restart of {service}...")
    ops_dir = BASE_DIR / "ops"
    try:
        subprocess.run(["bash", str(ops_dir / "emergency_restart.sh")], timeout=30)
        log(f"Restart triggered for {service}")
    except Exception as e:
        log(f"Restart failed: {e}")


def run_check():
    """Run a full health check."""
    log("=" * 50)
    log("Health check starting")

    issues = []

    # Check screen sessions
    hb_screen = check_screen("heartbeat")
    mt_screen = check_screen("mortem")
    log(f"Screen heartbeat: {'✅' if hb_screen else '❌'}")
    log(f"Screen mortem:    {'✅' if mt_screen else '❌'}")
    if not hb_screen:
        issues.append("heartbeat screen missing")
    if not mt_screen:
        issues.append("mortem screen missing")

    # Check processes
    hb_proc = check_process("heartbeat_stream.py")
    mt_proc = check_process("mortem_witness.py")
    log(f"Process heartbeat: {'✅' if hb_proc else '❌'}")
    log(f"Process mortem:    {'✅' if mt_proc else '❌'}")
    if not hb_proc:
        issues.append("heartbeat process dead")
    if not mt_proc:
        issues.append("mortem process dead")

    # Check log freshness
    hb_log_ok, hb_log_msg = check_log_fresh(LOGS_DIR / "heartbeat.log", LOG_MAX_AGE)
    mt_log_ok, mt_log_msg = check_log_fresh(LOGS_DIR / "mortem.log", LOG_MAX_AGE)
    log(f"Log heartbeat: {'✅' if hb_log_ok else '❌'} {hb_log_msg}")
    log(f"Log mortem:    {'✅' if mt_log_ok else '❌'} {mt_log_msg}")

    # Check on-chain transactions
    hb_tx_ok, hb_tx_msg = check_recent_tx(HUMAN_WALLET, HEARTBEAT_MAX_AGE)
    mt_tx_ok, mt_tx_msg = check_recent_tx(MORTEM_WALLET, MORTEM_MAX_AGE)
    log(f"TX heartbeat: {'✅' if hb_tx_ok else '❌'} {hb_tx_msg}")
    log(f"TX mortem:    {'✅' if mt_tx_ok else '❌'} {mt_tx_msg}")
    if not hb_tx_ok:
        issues.append(f"heartbeat TX stale: {hb_tx_msg}")
    if not mt_tx_ok:
        issues.append(f"mortem TX stale: {mt_tx_msg}")

    # Summary
    if issues:
        log(f"⚠️ ISSUES DETECTED: {', '.join(issues)}")
        # If processes are dead, attempt restart
        if not hb_proc or not mt_proc:
            attempt_restart("all")
    else:
        log("✅ All systems healthy")

    log("Health check complete")
    return len(issues) == 0


def main():
    LOGS_DIR.mkdir(exist_ok=True)
    log("MORTEM v2 Monitor starting")
    log(f"Check interval: {CHECK_INTERVAL}s")

    while True:
        try:
            run_check()
        except Exception as e:
            log(f"Monitor error: {e}")
        time.sleep(CHECK_INTERVAL)


if __name__ == "__main__":
    main()
