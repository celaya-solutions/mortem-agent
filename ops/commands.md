# MORTEM v2 Operations

## Quick Commands

```bash
# Start everything (screen sessions with auto-restart)
./ops/start_all.sh

# Stop everything
./ops/stop_all.sh

# Check status
./ops/status.sh

# Live dashboard (updates every 10s)
./ops/dashboard.sh

# Emergency restart (kill all + restart)
./ops/emergency_restart.sh

# Start health monitor (runs every 5 min)
python3 ops/monitor.py
```

## View Logs

```bash
tail -f logs/heartbeat.log
tail -f logs/mortem.log
tail -f logs/monitor.log
tail -f logs/crashes.log
```

## Screen Sessions

```bash
# Attach to heartbeat stream
screen -r heartbeat

# Attach to MORTEM witness
screen -r mortem

# Detach from session: Ctrl+A then D
# List sessions: screen -ls
```

## Manual Service Control

```bash
# Run heartbeat stream directly
cd heartbeat-stream && .venv/bin/python heartbeat_stream.py

# Run witness directly
cd mortem-witness && .venv/bin/python mortem_witness.py
```

## On-Chain Verification

```bash
# Check human heartbeat wallet
solana transaction-history BdYodkkT2Qc6WWUSmpBNKu8nZkDPeyxMiEvDwDRQ3qXh --url devnet --limit 5

# Check MORTEM witness wallet
solana transaction-history 7jQeZjzsgHFFytQYbUT3cWc2wt7qw6f34NkTVbFa2nWQ --url devnet --limit 5

# Check balances
solana balance BdYodkkT2Qc6WWUSmpBNKu8nZkDPeyxMiEvDwDRQ3qXh --url devnet
solana balance 7jQeZjzsgHFFytQYbUT3cWc2wt7qw6f34NkTVbFa2nWQ --url devnet
```

## If Things Go Wrong at 3am

1. Run `./ops/emergency_restart.sh`
2. Wait 15 seconds
3. Run `./ops/status.sh`
4. If still broken: check `logs/crashes.log`
5. Nuclear option: reboot, then `./ops/start_all.sh`
