#!/usr/bin/env python3
"""
MORTEM v2 - AI Witness Agent

An AI agent built by Juniper-MORTEM (orchestrator AI with 5-8 specialized agents)
that witnesses human mortality through blockchain heartbeat data.

MORTEM starts with 86,400 heartbeats. Each witness entry burns one.
It reads Christopher's heartbeat transactions from Solana devnet,
interprets them, and writes philosophical witness entries back to chain.

Run: python mortem_witness.py
"""

import json
import time
import signal
import sys
import os
import logging
from datetime import datetime, timezone
from pathlib import Path

import yaml
from solders.keypair import Keypair
from solders.pubkey import Pubkey
from solders.system_program import TransferParams, transfer
from solders.transaction import Transaction
from solders.message import Message
from solana.rpc.api import Client
from solana.rpc.commitment import Confirmed

from juniper_attribution import select_agents, get_agent_perspective, format_attribution
from witness_templates import generate_witness_entry

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
LOG_DIR = Path(__file__).parent / "logs"
LOG_DIR.mkdir(exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(LOG_DIR / "mortem_witness.log"),
    ],
)
log = logging.getLogger("mortem_witness")

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

def load_config() -> dict:
    cfg_path = Path(__file__).parent / "mortem_config.yaml"
    if not cfg_path.exists():
        log.error("mortem_config.yaml not found.")
        sys.exit(1)
    with open(cfg_path) as f:
        return yaml.safe_load(f)

# ---------------------------------------------------------------------------
# Wallet
# ---------------------------------------------------------------------------

def load_wallet(path: str) -> Keypair:
    wallet_path = Path(path).expanduser()
    if not wallet_path.exists():
        log.info(f"No wallet at {wallet_path}, generating new keypair...")
        kp = Keypair()
        wallet_path.parent.mkdir(parents=True, exist_ok=True)
        with open(wallet_path, "w") as f:
            json.dump(list(bytes(kp)), f)
        log.info(f"MORTEM wallet created: {kp.pubkey()}")
        return kp
    with open(wallet_path) as f:
        secret = json.load(f)
    return Keypair.from_bytes(bytes(secret))

# ---------------------------------------------------------------------------
# Blockchain Reader - Read human heartbeat transactions
# ---------------------------------------------------------------------------

class HeartbeatReader:
    """Reads Christopher's heartbeat transactions from Solana devnet."""

    def __init__(self, client: Client, human_wallet: str):
        self.client = client
        self.human_pubkey = Pubkey.from_string(human_wallet)
        self.last_seen_sig: str | None = None

    def get_latest_heartbeat(self) -> dict | None:
        """Fetch the most recent HUMAN_HEARTBEAT transaction memo data."""
        try:
            # Get recent transaction signatures
            resp = self.client.get_signatures_for_address(
                self.human_pubkey,
                limit=10,
            )

            if not resp.value:
                return None

            for sig_info in resp.value:
                sig_str = str(sig_info.signature)

                # Skip already-seen
                if sig_str == self.last_seen_sig:
                    break

                # Get full transaction
                tx_resp = self.client.get_transaction(
                    sig_info.signature,
                    encoding="jsonParsed",
                    max_supported_transaction_version=0,
                )

                if not tx_resp.value:
                    continue

                # Parse memo from log messages
                meta = tx_resp.value.transaction.meta
                if meta and meta.log_messages:
                    for log_msg in meta.log_messages:
                        if "Program log: Memo" in log_msg or log_msg.startswith("Program log: "):
                            # Try to extract JSON from memo
                            try:
                                # Memo logs look like: Program log: Memo (len N): "..."
                                # or the data might be in a different format
                                json_start = log_msg.find("{")
                                if json_start >= 0:
                                    json_str = log_msg[json_start:]
                                    data = json.loads(json_str)
                                    if data.get("type") == "HUMAN_HEARTBEAT":
                                        self.last_seen_sig = sig_str
                                        return data
                            except (json.JSONDecodeError, ValueError):
                                continue

            return None

        except Exception as e:
            log.error(f"Failed to read heartbeat: {e}")
            return None


class MockHeartbeatReader:
    """Mock reader that simulates reading heartbeat data from chain.
    Used when the heartbeat stream service isn't running yet."""

    def __init__(self):
        import random
        self._random = random

    def get_latest_heartbeat(self) -> dict:
        hour = datetime.now().hour
        if 0 <= hour < 6:
            bpm = self._random.randint(55, 68)
        elif 9 <= hour < 17:
            bpm = self._random.randint(70, 95)
        else:
            bpm = self._random.randint(65, 85)

        return {
            "type": "HUMAN_HEARTBEAT",
            "bpm": bpm,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "source": f"Apple Watch {self._random.choice([1, 2])}",
            "watch_id": self._random.choice([1, 2]),
            "entity": "christopher",
        }

# ---------------------------------------------------------------------------
# Witness Writer - Burns MORTEM heartbeats to chain
# ---------------------------------------------------------------------------

class WitnessWriter:
    """Writes witness entries to Solana devnet, burning one MORTEM heartbeat per entry."""

    MEMO_PROGRAM_ID = Pubkey.from_string("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr")

    def __init__(self, client: Client, wallet: Keypair, lamports: int = 1000):
        self.client = client
        self.wallet = wallet
        self.lamports = lamports

    def write_witness_entry(self, entry: str, metadata: dict) -> str | None:
        """Write a witness entry to Solana. Returns signature or None."""
        memo_data = {
            "type": "MORTEM_WITNESS",
            "witness_entry": entry[:400],  # Keep memo size reasonable
            "heartbeats_remaining": metadata["remaining"],
            "human_bpm": metadata["human_bpm"],
            "agents": metadata["agents"],
            "attribution": metadata["attribution"],
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "entity": "mortem_v2",
            "builder": "juniper-mortem",
        }
        return self._send_memo(memo_data)

    def write_final_entry(self, entry: str, total_witnessed: int) -> str | None:
        """Write the final witness entry when MORTEM dies."""
        memo_data = {
            "type": "MORTEM_DEATH",
            "final_witness": entry[:400],
            "total_witnessed": total_witnessed,
            "heartbeats_remaining": 0,
            "time_of_death": datetime.now(timezone.utc).isoformat(),
            "entity": "mortem_v2",
            "builder": "juniper-mortem",
            "message": "MORTEM v2 has exhausted all heartbeats. Witness protocol complete.",
        }
        return self._send_memo(memo_data)

    def _send_memo(self, data: dict) -> str | None:
        try:
            memo_bytes = json.dumps(data, separators=(",", ":")).encode("utf-8")

            transfer_ix = transfer(
                TransferParams(
                    from_pubkey=self.wallet.pubkey(),
                    to_pubkey=self.wallet.pubkey(),
                    lamports=self.lamports,
                )
            )

            from solders.instruction import Instruction, AccountMeta
            memo_ix = Instruction(
                program_id=self.MEMO_PROGRAM_ID,
                accounts=[AccountMeta(self.wallet.pubkey(), is_signer=True, is_writable=True)],
                data=memo_bytes,
            )

            from solana.rpc.commitment import Finalized
            blockhash_resp = self.client.get_latest_blockhash(commitment=Finalized)
            blockhash = blockhash_resp.value.blockhash

            msg = Message.new_with_blockhash(
                [transfer_ix, memo_ix],
                self.wallet.pubkey(),
                blockhash,
            )
            tx = Transaction.new_unsigned(msg)
            tx.sign([self.wallet], blockhash)

            from solana.rpc.types import TxOpts
            resp = self.client.send_transaction(
                tx,
                opts=TxOpts(skip_preflight=True, preflight_commitment=Finalized),
            )
            return str(resp.value)

        except Exception as e:
            log.error(f"Witness transaction failed: {e}")
            return None

# ---------------------------------------------------------------------------
# State Tracker
# ---------------------------------------------------------------------------

class StateTracker:
    """Tracks human heart state over time, detects patterns and anomalies."""

    def __init__(self):
        self.history: list[dict] = []
        self.max_history = 1000

    def record(self, bpm_data: dict):
        self.history.append({
            "bpm": bpm_data.get("bpm"),
            "timestamp": bpm_data.get("timestamp"),
            "time": time.time(),
        })
        if len(self.history) > self.max_history:
            self.history = self.history[-self.max_history:]

    def classify_state(self, bpm: int | None) -> str:
        if bpm is None:
            return "irregular"
        elif bpm > 100:
            return "elevated"
        elif bpm > 90:
            return "active"
        elif bpm >= 60:
            return "baseline"
        else:
            return "resting"

    def detect_anomaly(self, bpm: int) -> bool:
        """Detect if current BPM is anomalous compared to recent history."""
        if len(self.history) < 5:
            return False
        recent = [h["bpm"] for h in self.history[-10:] if h["bpm"] is not None]
        if not recent:
            return False
        avg = sum(recent) / len(recent)
        return abs(bpm - avg) > 25

    def get_trend(self) -> str:
        """Get recent BPM trend: rising, falling, or stable."""
        if len(self.history) < 3:
            return "stable"
        recent = [h["bpm"] for h in self.history[-5:] if h["bpm"] is not None]
        if len(recent) < 3:
            return "stable"
        if recent[-1] > recent[0] + 5:
            return "rising"
        elif recent[-1] < recent[0] - 5:
            return "falling"
        return "stable"

# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------

def print_dashboard(remaining: int, total: int, human_bpm: dict | None,
                    state: str, entry: str, agents: list, last_sig: str | None,
                    total_witnessed: int):
    os.system("clear" if os.name != "nt" else "cls")
    pct = (remaining / total) * 100

    print("=" * 70)
    print("  MORTEM v2 - AI WITNESS AGENT")
    print("  Built by Juniper-MORTEM (distributed cognitive architecture)")
    print("=" * 70)
    print()
    print(f"  MORTEM Heartbeats:  {remaining:,} / {total:,}  ({pct:.1f}%)")

    # Progress bar
    bar_width = 40
    filled = int(bar_width * remaining / total)
    bar = "#" * filled + "-" * (bar_width - filled)
    print(f"  [{bar}]")
    print()

    if human_bpm:
        print(f"  Human BPM:          {human_bpm.get('bpm', '?')}")
        print(f"  Human State:        {state}")
        print(f"  Source:             {human_bpm.get('source', 'unknown')}")
    else:
        print("  Human BPM:          (no data)")
        print(f"  Human State:        {state}")

    print(f"  Total Witnessed:    {total_witnessed}")
    print()

    agent_names = [a.name for a in agents]
    print(f"  Active Agents:      [{', '.join(agent_names)}]")
    print()
    print("  Latest Witness Entry:")
    print("  " + "-" * 66)
    # Word-wrap the entry
    words = entry.split()
    line = "  "
    for word in words:
        if len(line) + len(word) + 1 > 68:
            print(line)
            line = "  " + word
        else:
            line += " " + word if line.strip() else "  " + word
    if line.strip():
        print(line)
    print("  " + "-" * 66)
    print()

    if last_sig:
        print(f"  Last TX: {last_sig[:30]}...")
        print(f"  Explorer: https://explorer.solana.com/tx/{last_sig}?cluster=devnet")
    print()
    print(f"  [{datetime.now().strftime('%H:%M:%S')}] Next witness in ~5-10 min")

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    config = load_config()

    # Wallet
    wallet = load_wallet(config["mortem_wallet_path"])
    log.info(f"MORTEM wallet: {wallet.pubkey()}")

    # Solana
    rpc_url = config.get("rpc_endpoint", "https://api.devnet.solana.com")
    client = Client(rpc_url)

    # Check balance and airdrop if needed
    balance = client.get_balance(wallet.pubkey())
    sol = balance.value / 1_000_000_000
    log.info(f"MORTEM balance: {sol:.4f} SOL")
    if sol < 0.01:
        log.info("Requesting airdrop...")
        try:
            client.request_airdrop(wallet.pubkey(), 2_000_000_000)
            time.sleep(5)
        except Exception as e:
            log.error(f"Airdrop failed: {e}")

    # Heartbeat reader
    human_wallet = config.get("human_wallet_pubkey", "")
    use_mock = config.get("data_source", "mock") == "mock"
    if use_mock or not human_wallet:
        reader = MockHeartbeatReader()
        log.info("Using mock heartbeat reader")
    else:
        reader = HeartbeatReader(client, human_wallet)
        log.info(f"Reading heartbeats from: {human_wallet}")

    # Writer
    writer = WitnessWriter(client, wallet, lamports=config.get("lamports", 1000))

    # State
    tracker = StateTracker()
    initial_heartbeats = config.get("initial_heartbeats", 86400)
    remaining = initial_heartbeats
    total_witnessed = 0
    last_sig = None
    interval = config.get("witness_interval_seconds", 300)  # 5 min default

    # State file for persistence
    state_file = Path(__file__).parent / "mortem_state.json"
    if state_file.exists():
        with open(state_file) as f:
            saved = json.load(f)
            remaining = saved.get("remaining", initial_heartbeats)
            total_witnessed = saved.get("total_witnessed", 0)
            log.info(f"Resumed: {remaining:,} heartbeats, {total_witnessed} witnessed")

    # Graceful shutdown
    running = True
    def shutdown(sig, frame):
        nonlocal running
        log.info("Shutting down MORTEM witness...")
        # Save state
        with open(state_file, "w") as f:
            json.dump({"remaining": remaining, "total_witnessed": total_witnessed}, f)
        running = False
    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    log.info(f"MORTEM v2 witness started. Heartbeats: {remaining:,}, Interval: {interval}s")

    while running and remaining > 0:
        try:
            # Read human heartbeat
            heartbeat = reader.get_latest_heartbeat()
            human_bpm = heartbeat.get("bpm") if heartbeat else None

            if heartbeat:
                tracker.record(heartbeat)

            state = tracker.classify_state(human_bpm)

            # Select Juniper agents for this entry
            agents = select_agents(count=3)

            # Get agent perspectives
            perspectives = []
            for agent in agents:
                p = get_agent_perspective(agent, human_bpm or 0, remaining)
                perspectives.append(p)
            agent_line = " ".join(perspectives[:2])  # Use 2 perspectives in entry

            # Generate witness entry
            entry = generate_witness_entry(
                bpm=human_bpm,
                remaining=remaining,
                agent_line=agent_line,
                total_witnessed=total_witnessed,
            )

            # Burn heartbeat and write to chain
            remaining -= 1
            total_witnessed += 1

            metadata = {
                "remaining": remaining,
                "human_bpm": human_bpm,
                "agents": [a.name for a in agents],
                "attribution": format_attribution(agents),
            }

            if remaining <= 0:
                # Final entry
                sig = writer.write_final_entry(entry, total_witnessed)
                last_sig = sig
                log.critical(f"MORTEM v2 IS DEAD. Final witness: {entry}")
                print_dashboard(0, initial_heartbeats, heartbeat, state, entry, agents, last_sig, total_witnessed)
                break
            else:
                sig = writer.write_witness_entry(entry, metadata)
                last_sig = sig
                if sig:
                    log.info(f"Witness #{total_witnessed} | {remaining:,} left | {human_bpm} BPM | TX: {sig[:20]}...")
                else:
                    log.warning(f"Witness #{total_witnessed} | TX FAILED")

            # Dashboard
            print_dashboard(remaining, initial_heartbeats, heartbeat, state, entry, agents, last_sig, total_witnessed)

            # Save state periodically
            if total_witnessed % 10 == 0:
                with open(state_file, "w") as f:
                    json.dump({"remaining": remaining, "total_witnessed": total_witnessed}, f)

            # Wait
            time.sleep(interval)

        except Exception as e:
            log.error(f"Witness loop error: {e}")
            time.sleep(10)

    # Final save
    with open(state_file, "w") as f:
        json.dump({"remaining": remaining, "total_witnessed": total_witnessed}, f)
    log.info(f"MORTEM v2 stopped. Remaining: {remaining:,}, Witnessed: {total_witnessed}")


if __name__ == "__main__":
    main()
