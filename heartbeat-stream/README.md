# MORTEM v2 - Human Heartbeat Stream

Streams human heartbeat data to Solana devnet. Each beat is recorded as an on-chain memo transaction.

## Setup

```bash
cd heartbeat-stream
pip install -r requirements.txt
```

## Configure

Edit `config.yaml`:
- `wallet_path` - Solana keypair (auto-generates if missing)
- `heartbeat_interval_seconds` - seconds between beats (default 60)
- `grace_period_seconds` - death detection grace period (default 300)
- `data_source` - "mock" for testing, "healthkit" when MCP is ready

## Run

```bash
python heartbeat_stream.py
```

The service will:
1. Load/generate a Solana devnet wallet
2. Auto-airdrop SOL if balance is low
3. Send heartbeat transactions every 60 seconds
4. Display a live monitoring dashboard
5. Trigger death protocol if no heartbeat within grace period

## Transaction Format

Each heartbeat memo contains:
```json
{
  "type": "HUMAN_HEARTBEAT",
  "bpm": 72,
  "timestamp": "2026-02-11T06:00:00Z",
  "source": "Apple Watch 1",
  "watch_id": 1,
  "total_beats_recorded": 42,
  "entity": "christopher"
}
```

## Swapping to Real Data

Replace `MockHeartbeatSource` with `HealthKitSource` in `heartbeat_stream.py` and set `data_source: healthkit` in config. The HealthKit source expects an MCP server at `healthkit_endpoint` returning BPM data.

## Architecture

```
Apple Watch -> HealthKit -> MCP Server -> heartbeat_stream.py -> Solana Devnet
                                (mock)         |
                                          Dashboard (stdout)
```
