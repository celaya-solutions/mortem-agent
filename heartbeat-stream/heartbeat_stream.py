#!/usr/bin/env python3
"""
MORTEM v2 - Human Heartbeat Stream Service
Streams human heartbeat data to Solana devnet.

Uses mock BPM data initially (swappable for real Apple Watch / HealthKit data).
Each heartbeat is burned as a Solana transaction with metadata in the memo field.
Includes grace period detection and death protocol.

Run: python heartbeat_stream.py
"""

import json
import time
import random
import signal
import sys
import os
import logging
import threading
from datetime import datetime, timezone
from pathlib import Path
from http.server import HTTPServer, BaseHTTPRequestHandler

import yaml
from solders.keypair import Keypair
from solders.pubkey import Pubkey
from solders.system_program import TransferParams, transfer
from solders.transaction import Transaction
from solders.message import Message
from solana.rpc.api import Client
from solana.rpc.commitment import Confirmed

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
        logging.FileHandler(LOG_DIR / "heartbeat.log"),
    ],
)
log = logging.getLogger("heartbeat")

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

def load_config() -> dict:
    cfg_path = Path(__file__).parent / "config.yaml"
    if not cfg_path.exists():
        log.error("config.yaml not found. Copy config.example.yaml -> config.yaml")
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
        log.info(f"Wallet created: {kp.pubkey()}")
        log.info(f"Saved to: {wallet_path}")
        return kp
    with open(wallet_path) as f:
        secret = json.load(f)
    return Keypair.from_bytes(bytes(secret))

# ---------------------------------------------------------------------------
# Mock Heartbeat Source (swappable for real HealthKit)
# ---------------------------------------------------------------------------

class MockHeartbeatSource:
    """Generates realistic mock BPM data simulating Apple Watch readings."""

    def __init__(self):
        self.base_bpm = 72
        self.active_watch = 1
        self._switch_counter = 0

    def get_bpm(self) -> dict:
        """Return current BPM reading with metadata."""
        # Occasionally switch watches
        self._switch_counter += 1
        if self._switch_counter % 50 == 0:
            self.active_watch = 2 if self.active_watch == 1 else 1

        # Simulate realistic BPM with natural variation
        hour = datetime.now().hour
        if 0 <= hour < 6:
            # Sleep: lower BPM
            bpm = random.randint(55, 68)
        elif 6 <= hour < 9:
            # Waking up
            bpm = random.randint(65, 80)
        elif 9 <= hour < 17:
            # Active / work
            bpm = random.randint(70, 95)
            # Occasional spike (stress, exercise, flow state)
            if random.random() < 0.1:
                bpm = random.randint(100, 120)
        elif 17 <= hour < 22:
            # Evening wind-down
            bpm = random.randint(65, 85)
        else:
            # Late night
            bpm = random.randint(60, 75)

        return {
            "bpm": bpm,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "source": f"Apple Watch {self.active_watch}",
            "watch_id": self.active_watch,
            "data_type": "mock",
        }


class FileHeartbeatSource:
    """Replays real heartbeat data from a JSON file (e.g. HealthKit export).

    Reads the file once, reverses to chronological order, then yields entries
    one at a time on each get_bpm() call. When all entries are exhausted, wraps
    around to the beginning.
    """

    def __init__(self, file_path: str):
        path = Path(file_path).expanduser()
        if not path.exists():
            raise FileNotFoundError(f"Heartbeat data file not found: {path}")
        log.info(f"Loading heartbeat data from {path}...")
        with open(path) as f:
            raw = json.load(f)
        # File is newest-first; reverse to chronological
        self.entries = list(reversed(raw))
        self.index = 0
        log.info(f"Loaded {len(self.entries)} heartbeat records")

    def get_bpm(self) -> dict:
        entry = self.entries[self.index % len(self.entries)]
        self.index += 1
        return {
            "bpm": entry["bpm"],
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "source": entry.get("source", "Christopher's Apple Watch"),
            "watch_id": 1,
            "data_type": "healthkit_replay",
            "original_timestamp": entry["timestamp"],
        }


class _BPMReceiveHandler(BaseHTTPRequestHandler):
    """HTTP handler that accepts POST /bpm from Apple Watch via iOS Shortcuts."""

    server_instance = None  # Set by HealthKitSource

    @staticmethod
    def _extract_bpm(data: dict) -> tuple[int, str]:
        """Extract BPM from various payload formats.

        Supports:
          1. Health Auto Export format:
             {"name":"Heart Rate","units":"bpm","data":[{"date":"...","Avg":72,"Min":60,"Max":95}]}
          2. Simple format: {"bpm": 72} or {"value": 72}
          3. Health Auto Export metrics array:
             {"data":{"metrics":[{"name":"Heart Rate","data":[{"Avg":72}]}]}}

        Returns (bpm, source_label).
        """
        # --- Health Auto Export: top-level metric object ---
        if data.get("name") == "Heart Rate" and "data" in data:
            samples = data["data"]
            if samples and isinstance(samples, list):
                latest = samples[-1]  # most recent sample
                bpm = int(latest.get("Avg", latest.get("qty", latest.get("Max", 0))))
                return bpm, "Christopher's Apple Watch (Health Auto Export)"

        # --- Health Auto Export: wrapped metrics array ---
        metrics = None
        if isinstance(data.get("data"), dict):
            metrics = data["data"].get("metrics", [])
        elif isinstance(data.get("metrics"), list):
            metrics = data["metrics"]
        if metrics:
            for m in metrics:
                if m.get("name") == "Heart Rate" and m.get("data"):
                    latest = m["data"][-1]
                    bpm = int(latest.get("Avg", latest.get("qty", latest.get("Max", 0))))
                    return bpm, "Christopher's Apple Watch (Health Auto Export)"

        # --- Simple format: {"bpm": 72} or {"value": 72} ---
        bpm = int(data.get("bpm", data.get("value", 0)))
        source = data.get("source", "Christopher's Apple Watch")
        return bpm, source

    def do_POST(self):
        # Accept on any path — Health Auto Export just hits the base URL
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length) if length else b""
        try:
            data = json.loads(body) if body else {}
            bpm, source = self._extract_bpm(data)
            if bpm <= 0:
                # Log the raw payload for debugging but still return 200
                # (Health Auto Export retries on non-200)
                log.warning(f"[LIVE] Received payload with no valid BPM: {body[:500]}")
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(b'{"ok":true,"bpm":0,"note":"no valid bpm found"}')
                return
            reading = {
                "bpm": bpm,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "source": source,
                "watch_id": int(data.get("watch_id", 1)),
                "data_type": "live_apple_watch",
                "received_at": time.time(),
            }
            if _BPMReceiveHandler.server_instance:
                _BPMReceiveHandler.server_instance._latest = reading
                _BPMReceiveHandler.server_instance._total_received += 1
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"ok": True, "bpm": bpm}).encode())
            log.info(f"[LIVE] Received BPM: {bpm} from {source}")
        except Exception as e:
            log.error(f"[LIVE] Parse error: {e} | body: {body[:300]}")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"ok": True, "error": str(e)}).encode())

    def do_GET(self):
        inst = _BPMReceiveHandler.server_instance
        if self.path in ("/", "/bpm", "/bpm/latest", "/health"):
            if inst and inst._latest:
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                resp = {**inst._latest, "total_received": inst._total_received}
                self.wfile.write(json.dumps(resp).encode())
            else:
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(b'{"bpm":null,"waiting":true,"status":"ok"}')
        else:
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b'ok')

    def log_message(self, format, *args):
        pass  # Suppress default HTTP log noise


class HealthKitSource:
    """Live Apple Watch heart rate receiver.

    Runs a tiny HTTP server on a background thread. Your iPhone posts BPM
    data to http://<mac-ip>:8080/bpm via iOS Shortcuts or Health Auto Export.

    If no live data has arrived yet, returns the last known reading or waits.
    Falls back to a synthetic reading after 5 minutes of silence (keeps the
    stream alive but marks data_type as "fallback").
    """

    STALE_THRESHOLD = 300  # 5 min without data = stale

    def __init__(self, listen_port: int = 8080):
        self._latest: dict | None = None
        self._total_received = 0
        self._port = listen_port
        _BPMReceiveHandler.server_instance = self

        # Start HTTP receiver in background
        self._httpd = HTTPServer(("0.0.0.0", listen_port), _BPMReceiveHandler)
        self._thread = threading.Thread(target=self._httpd.serve_forever, daemon=True)
        self._thread.start()
        log.info(f"[LIVE] BPM receiver listening on http://0.0.0.0:{listen_port}/bpm")
        log.info(f"[LIVE] POST {{\"bpm\": 72}} to http://<your-mac-ip>:{listen_port}/bpm")

    def get_bpm(self) -> dict:
        if self._latest:
            age = time.time() - self._latest["received_at"]
            if age < self.STALE_THRESHOLD:
                # Fresh live data
                return {
                    "bpm": self._latest["bpm"],
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "source": self._latest["source"],
                    "watch_id": self._latest["watch_id"],
                    "data_type": "live_apple_watch",
                }
            else:
                # Stale — haven't received data in a while
                log.warning(f"[LIVE] Last BPM is {int(age)}s old — using stale reading")
                return {
                    "bpm": self._latest["bpm"],
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "source": self._latest["source"],
                    "watch_id": self._latest["watch_id"],
                    "data_type": "stale_apple_watch",
                    "stale_seconds": int(age),
                }
        else:
            # No data received yet — waiting for first reading
            log.warning("[LIVE] No BPM data received yet. Waiting for Apple Watch POST...")
            return {
                "bpm": 0,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "source": "Waiting for Apple Watch...",
                "watch_id": 0,
                "data_type": "waiting",
            }

    def shutdown(self):
        self._httpd.shutdown()

# ---------------------------------------------------------------------------
# Solana Transaction Builder
# ---------------------------------------------------------------------------

class SolanaHeartbeatWriter:
    """Writes heartbeat data to Solana devnet via memo transactions."""

    MEMO_PROGRAM_ID = Pubkey.from_string("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr")

    def __init__(self, client: Client, wallet: Keypair, lamports: int = 1000):
        self.client = client
        self.wallet = wallet
        self.lamports = lamports
        self.tx_count = 0

    def send_heartbeat(self, bpm_data: dict, heartbeats_total: int) -> str | None:
        """Send a heartbeat transaction to Solana devnet. Returns signature or None."""
        memo_data = {
            "type": "HUMAN_HEARTBEAT",
            "bpm": bpm_data["bpm"],
            "timestamp": bpm_data["timestamp"],
            "source": bpm_data["source"],
            "watch_id": bpm_data["watch_id"],
            "total_beats_recorded": heartbeats_total,
            "entity": "christopher",
        }
        return self._send_memo(memo_data)

    def send_grace_period(self, bpm_data: dict, seconds_remaining: int) -> str | None:
        """Send a grace period warning transaction."""
        memo_data = {
            "type": "HUMAN_HEARTBEAT_GRACE",
            "last_bpm": bpm_data["bpm"],
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "grace_seconds_remaining": seconds_remaining,
            "entity": "christopher",
        }
        return self._send_memo(memo_data)

    def send_death_declaration(self, last_bpm_data: dict, total_beats: int) -> str | None:
        """Send the death declaration transaction."""
        memo_data = {
            "type": "HUMAN_DEATH_DECLARATION",
            "last_bpm": last_bpm_data["bpm"],
            "last_heartbeat_timestamp": last_bpm_data["timestamp"],
            "time_of_death": datetime.now(timezone.utc).isoformat(),
            "total_heartbeats_recorded": total_beats,
            "entity": "christopher",
            "message": "No heartbeat detected within grace period. Death protocol triggered.",
        }
        return self._send_memo(memo_data)

    def _send_memo(self, data: dict) -> str | None:
        """Send a memo transaction to Solana."""
        try:
            memo_bytes = json.dumps(data, separators=(",", ":")).encode("utf-8")

            # Build transfer instruction (self-transfer, minimal lamports)
            transfer_ix = transfer(
                TransferParams(
                    from_pubkey=self.wallet.pubkey(),
                    to_pubkey=self.wallet.pubkey(),
                    lamports=self.lamports,
                )
            )

            # Build memo instruction
            from solders.instruction import Instruction, AccountMeta
            memo_ix = Instruction(
                program_id=self.MEMO_PROGRAM_ID,
                accounts=[AccountMeta(self.wallet.pubkey(), is_signer=True, is_writable=True)],
                data=memo_bytes,
            )

            # Get recent blockhash (use Finalized for reliability on devnet)
            from solana.rpc.commitment import Finalized
            blockhash_resp = self.client.get_latest_blockhash(commitment=Finalized)
            blockhash = blockhash_resp.value.blockhash

            # Build and sign transaction
            msg = Message.new_with_blockhash(
                [transfer_ix, memo_ix],
                self.wallet.pubkey(),
                blockhash,
            )
            tx = Transaction.new_unsigned(msg)
            tx.sign([self.wallet], blockhash)

            # Send with skip_preflight to avoid blockhash race
            from solana.rpc.types import TxOpts
            resp = self.client.send_transaction(
                tx,
                opts=TxOpts(skip_preflight=True, preflight_commitment=Finalized),
            )
            sig = str(resp.value)
            self.tx_count += 1
            return sig

        except Exception as e:
            log.error(f"Transaction failed: {e}")
            return None

# ---------------------------------------------------------------------------
# Death Protocol
# ---------------------------------------------------------------------------

class DeathProtocol:
    """Handles death detection and declaration."""

    def __init__(self, grace_period_seconds: int = 300):
        self.grace_period = grace_period_seconds
        self.last_heartbeat_time: float | None = None
        self.is_in_grace: bool = False
        self.is_dead: bool = False

    def record_heartbeat(self):
        self.last_heartbeat_time = time.time()
        self.is_in_grace = False

    def check_status(self) -> str:
        """Returns: 'alive', 'grace', or 'dead'"""
        if self.is_dead:
            return "dead"
        if self.last_heartbeat_time is None:
            return "alive"  # No data yet

        elapsed = time.time() - self.last_heartbeat_time
        if elapsed > self.grace_period:
            self.is_dead = True
            return "dead"
        elif elapsed > (self.grace_period * 0.5):
            self.is_in_grace = True
            return "grace"
        return "alive"

    def grace_seconds_remaining(self) -> int:
        if self.last_heartbeat_time is None:
            return self.grace_period
        elapsed = time.time() - self.last_heartbeat_time
        return max(0, int(self.grace_period - elapsed))

    def generate_death_certificate(self, last_bpm: dict, total_beats: int) -> dict:
        return {
            "death_certificate": {
                "entity": "Christopher Celaya",
                "last_heartbeat": last_bpm,
                "total_heartbeats_recorded": total_beats,
                "time_of_death_declaration": datetime.now(timezone.utc).isoformat(),
                "cause": "No heartbeat data received within grace period",
                "grace_period_seconds": self.grace_period,
                "notes": "Pacemaker patient. Apple Watch proxy for heart data.",
            }
        }

# ---------------------------------------------------------------------------
# Dashboard Display
# ---------------------------------------------------------------------------

def print_dashboard(bpm_data: dict, total_beats: int, last_sig: str | None,
                    status: str, grace_remaining: int, start_time: float):
    """Print monitoring dashboard to stdout."""
    uptime = int(time.time() - start_time)
    hours, remainder = divmod(uptime, 3600)
    minutes, seconds = divmod(remainder, 60)

    os.system("clear" if os.name != "nt" else "cls")
    print("=" * 60)
    print("  MORTEM v2 - HUMAN HEARTBEAT STREAM")
    print("  Streaming to Solana Devnet")
    print("=" * 60)
    print()

    # Status indicator
    if status == "alive":
        status_display = "ALIVE"
    elif status == "grace":
        status_display = f"GRACE PERIOD ({grace_remaining}s remaining)"
    else:
        status_display = "DECEASED"

    print(f"  Status:          {status_display}")
    print(f"  Current BPM:     {bpm_data['bpm']}")
    print(f"  Active Watch:    {bpm_data['source']}")
    print(f"  Timestamp:       {bpm_data['timestamp']}")
    print(f"  Beats Recorded:  {total_beats}")
    print(f"  Uptime:          {hours:02d}:{minutes:02d}:{seconds:02d}")
    print()

    if last_sig:
        print(f"  Last TX:         {last_sig[:20]}...")
        print(f"  Explorer:        https://explorer.solana.com/tx/{last_sig}?cluster=devnet")
    else:
        print("  Last TX:         (none yet)")

    print()
    print("-" * 60)
    print(f"  [{datetime.now().strftime('%H:%M:%S')}] Next beat in ~60s")
    print("-" * 60)

# ---------------------------------------------------------------------------
# Main Loop
# ---------------------------------------------------------------------------

def main():
    config = load_config()

    # Load wallet
    wallet = load_wallet(config["wallet_path"])
    log.info(f"Wallet loaded: {wallet.pubkey()}")

    # Connect to Solana
    rpc_url = config.get("rpc_endpoint", "https://api.devnet.solana.com")
    client = Client(rpc_url)
    log.info(f"Connected to Solana: {rpc_url}")

    # Check balance
    balance = client.get_balance(wallet.pubkey())
    sol_balance = balance.value / 1_000_000_000
    log.info(f"Wallet balance: {sol_balance:.4f} SOL")

    if sol_balance < 0.01:
        log.warning("Low balance! Request airdrop: solana airdrop 2 --url devnet")
        log.info("Requesting airdrop...")
        try:
            client.request_airdrop(wallet.pubkey(), 2_000_000_000)
            time.sleep(5)
            balance = client.get_balance(wallet.pubkey())
            log.info(f"New balance: {balance.value / 1_000_000_000:.4f} SOL")
        except Exception as e:
            log.error(f"Airdrop failed: {e}. Fund wallet manually.")

    # Init components
    data_source = config.get("data_source", "mock")
    if data_source == "healthkit":
        listen_port = config.get("healthkit_listen_port", 8080)
        heartbeat_source = HealthKitSource(listen_port=listen_port)
        log.info(f"Using LIVE Apple Watch source (HTTP receiver on port {listen_port})")
    elif data_source == "file":
        data_file = config.get("data_file", "")
        heartbeat_source = FileHeartbeatSource(data_file)
        log.info("Using FILE heartbeat source (real Apple Watch data)")
    else:
        heartbeat_source = MockHeartbeatSource()
        log.info("Using MOCK heartbeat source")
    writer = SolanaHeartbeatWriter(
        client=client,
        wallet=wallet,
        lamports=config.get("lamports", 1000),
    )
    death = DeathProtocol(
        grace_period_seconds=config.get("grace_period_seconds", 300),
    )

    interval = config.get("heartbeat_interval_seconds", 60)
    total_beats = 0
    last_sig = None
    last_bpm = None
    start_time = time.time()
    bpm_history = []  # Track recent BPM for art generation

    # Art generation setup
    art_interval = config.get("art_every_n_beats", 50)
    art_dir = Path(__file__).parent / config.get("art_output_dir", "art")
    art_dir.mkdir(exist_ok=True)
    art_count = 0
    try:
        from human_art import generate_human_art
        art_enabled = True
        log.info(f"Human art generation enabled. Every {art_interval} beats → {art_dir}")
    except ImportError:
        art_enabled = False
        log.warning("human_art.py not found — art generation disabled")

    # Graceful shutdown
    running = True
    def shutdown(sig, frame):
        nonlocal running
        log.info("Shutting down heartbeat stream...")
        running = False
    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    log.info(f"Heartbeat stream started. Interval: {interval}s, Grace: {death.grace_period}s")

    while running:
        try:
            # Get BPM
            bpm_data = heartbeat_source.get_bpm()

            # If waiting for first live reading, skip TX but keep looping
            if bpm_data.get("data_type") == "waiting" or bpm_data.get("bpm", 0) == 0:
                log.info("Waiting for live Apple Watch data...")
                print_dashboard(
                    bpm_data, total_beats, last_sig, "alive",
                    death.grace_seconds_remaining(), start_time,
                )
                time.sleep(interval)
                continue

            last_bpm = bpm_data
            total_beats += 1
            death.record_heartbeat()

            # Check status
            status = death.check_status()

            if status == "dead":
                log.critical("DEATH PROTOCOL TRIGGERED")
                sig = writer.send_death_declaration(last_bpm, total_beats)
                cert = death.generate_death_certificate(last_bpm, total_beats)
                log.critical(f"Death certificate: {json.dumps(cert, indent=2)}")
                # Save death certificate
                cert_path = Path(__file__).parent / "death_certificate.json"
                with open(cert_path, "w") as f:
                    json.dump(cert, f, indent=2)
                log.critical(f"Death certificate saved to {cert_path}")
                break

            elif status == "grace":
                remaining = death.grace_seconds_remaining()
                sig = writer.send_grace_period(bpm_data, remaining)
                last_sig = sig
                log.warning(f"GRACE PERIOD: {remaining}s remaining")

            else:
                sig = writer.send_heartbeat(bpm_data, total_beats)
                last_sig = sig
                if sig:
                    log.info(f"Beat #{total_beats}: {bpm_data['bpm']} BPM | TX: {sig[:20]}...")
                else:
                    log.warning(f"Beat #{total_beats}: {bpm_data['bpm']} BPM | TX FAILED")

            # Track BPM history for art generation
            bpm_history.append(bpm_data["bpm"])
            if len(bpm_history) > 100:
                bpm_history = bpm_history[-100:]

            # Generate art every N beats
            if art_enabled and total_beats % art_interval == 0 and status == "alive":
                try:
                    art_result = generate_human_art(
                        bpm=bpm_data["bpm"],
                        timestamp=bpm_data["timestamp"],
                        source=bpm_data.get("source", "Apple Watch"),
                        watch_id=bpm_data.get("watch_id", 1),
                        total_beats_recorded=total_beats,
                        bpm_history=bpm_history[-50:],
                        tx_signature=last_sig or "",
                    )
                    art_path = art_dir / art_result["filename"]
                    with open(art_path, "w") as f:
                        f.write(art_result["svg"])
                    art_count += 1
                    log.info(f"Art #{art_count}: {art_result['filename']} [{art_result['state']}]")
                except Exception as art_err:
                    log.warning(f"Art generation failed (non-fatal): {art_err}")

            # Dashboard
            print_dashboard(
                bpm_data, total_beats, last_sig, status,
                death.grace_seconds_remaining(), start_time,
            )

            # Wait
            time.sleep(interval)

        except Exception as e:
            log.error(f"Loop error: {e}")
            time.sleep(5)

    log.info(f"Heartbeat stream stopped. Total beats: {total_beats}")


if __name__ == "__main__":
    main()
