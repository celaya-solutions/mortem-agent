#!/usr/bin/env python3
"""
MORTEM v2 — HyperRate Heart Rate Bridge

Connects to HyperRate's WebSocket API to read real-time heart rate from
Christopher's Apple Watch, then POSTs each reading to the heartbeat receiver
on localhost:8080.

Usage:
  export HYPERATE_API_KEY="your-api-key"
  python3 hyperate_bridge.py

Get a free API key at https://www.hyperate.io/api
"""

import json
import os
import sys
import time
import threading
import urllib.request
from datetime import datetime, timezone

# --- Config ---
HYPERATE_DEVICE_ID = os.environ.get("HYPERATE_DEVICE_ID", "8A1B")
HYPERATE_API_KEY = os.environ.get("HYPERATE_API_KEY", "")
RECEIVER_URL = os.environ.get("RECEIVER_URL", "http://localhost:8080/bpm")
WS_URL = f"wss://app.hyperate.io/socket/websocket?token={HYPERATE_API_KEY}"
PHOENIX_HEARTBEAT_INTERVAL = 25  # seconds


def post_bpm(bpm: int):
    """POST BPM to the MORTEM heartbeat receiver."""
    data = json.dumps({
        "bpm": bpm,
        "source": "Christopher's Apple Watch (HyperRate)",
        "watch_id": 1,
    }).encode()
    req = urllib.request.Request(
        RECEIVER_URL,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            return json.loads(resp.read())
    except Exception as e:
        print(f"  POST failed: {e}")
        return None


def main():
    if not HYPERATE_API_KEY:
        print("=" * 55)
        print("  MORTEM v2 — HyperRate Bridge")
        print("=" * 55)
        print()
        print("  ERROR: No API key set.")
        print()
        print("  Get a free key at https://www.hyperate.io/api")
        print("  Then run:")
        print()
        print(f'    export HYPERATE_API_KEY="your-key-here"')
        print(f"    python3 {sys.argv[0]}")
        print()
        sys.exit(1)

    try:
        import websocket
    except ImportError:
        print("Installing websocket-client...")
        import subprocess
        subprocess.check_call([sys.executable, "-m", "pip", "install", "websocket-client"])
        import websocket

    print("=" * 55)
    print("  MORTEM v2 — HyperRate Bridge")
    print(f"  Device: {HYPERATE_DEVICE_ID}")
    print(f"  Receiver: {RECEIVER_URL}")
    print("=" * 55)
    print()

    last_hr = 0
    beat_count = 0

    def on_message(ws, message):
        nonlocal last_hr, beat_count
        try:
            data = json.loads(message)
            event = data.get("event")

            if event == "hr_update":
                hr = data.get("payload", {}).get("hr", 0)
                if hr > 0:
                    last_hr = hr
                    beat_count += 1
                    now = datetime.now().strftime("%H:%M:%S")
                    result = post_bpm(hr)
                    status = "OK" if result and result.get("ok") else "FAIL"
                    print(f"[{now}] BPM: {hr} | posted: {status} | #{beat_count}")

            elif event == "phx_reply":
                status = data.get("payload", {}).get("status")
                if status == "ok":
                    print(f"  Joined channel hr:{HYPERATE_DEVICE_ID}")
                elif status == "error":
                    print(f"  Channel join error: {data}")

            elif event == "phx_close":
                print(f"  Channel closed by server")

            else:
                # Log any unknown events for debugging
                now = datetime.now().strftime("%H:%M:%S")
                print(f"  [{now}] event={event} payload={json.dumps(data.get('payload', {}))[:200]}")

        except Exception as e:
            print(f"  Parse error: {e}")

    def on_error(ws, error):
        print(f"  WS error: {error}")

    def on_close(ws, close_status_code, close_msg):
        print(f"  WS closed: {close_status_code} {close_msg}")

    def on_open(ws):
        print(f"  Connected to HyperRate")
        # Join the heart rate channel
        join_msg = json.dumps({
            "topic": f"hr:{HYPERATE_DEVICE_ID}",
            "event": "phx_join",
            "payload": {},
            "ref": 0,
        })
        ws.send(join_msg)
        print(f"  Joining channel hr:{HYPERATE_DEVICE_ID}...")

        # Start Phoenix heartbeat thread
        def heartbeat():
            hb_count = 0
            while ws.sock and ws.sock.connected:
                try:
                    ws.send(json.dumps({
                        "topic": "phoenix",
                        "event": "heartbeat",
                        "payload": {},
                        "ref": 0,
                    }))
                    hb_count += 1
                    if hb_count % 4 == 0:  # Every ~100s
                        now = datetime.now().strftime("%H:%M:%S")
                        print(f"  [{now}] alive | channel=hr:{HYPERATE_DEVICE_ID} | beats_received={beat_count}")
                except Exception:
                    break
                time.sleep(PHOENIX_HEARTBEAT_INTERVAL)

        t = threading.Thread(target=heartbeat, daemon=True)
        t.start()

    # Connect with auto-reconnect
    while True:
        try:
            ws = websocket.WebSocketApp(
                WS_URL,
                on_open=on_open,
                on_message=on_message,
                on_error=on_error,
                on_close=on_close,
            )
            ws.run_forever(ping_interval=30)
        except KeyboardInterrupt:
            print("\nShutting down bridge.")
            break
        except Exception as e:
            print(f"  Connection failed: {e}")

        print("  Reconnecting in 5s...")
        time.sleep(5)


if __name__ == "__main__":
    main()
