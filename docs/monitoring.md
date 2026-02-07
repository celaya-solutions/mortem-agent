# Monitoring

How to observe MORTEM's lifecycle in real-time.

---

## Dashboard

Open `dashboard/index.html` in your browser. It connects via WebSocket and displays:

- Real-time heartbeat counter with pulse animation
- Current phase with color-coded indicator
- ECG line animation (flatlines on death)
- Journal entries (newest first)
- On-chain proof links (Solana Explorer)
- Resurrection countdown (when dead)

---

## Terminal Monitoring

### Live Demo

<div class="mortem-cast-player" data-src="/recordings/mortem-quickstart.cast"></div>

### Watch the Runtime Log

```bash
tail -f logs/runtime.log
```

### Watch Heartbeats

```bash
# Status endpoint poll
watch -n 1 'curl -s http://localhost:3333/api/status | jq .'
```

### Watch Journals

```bash
# Today's journal count
watch -n 60 'curl -s http://localhost:3333/api/journal | jq .count'

# Read latest entry
curl -s http://localhost:3333/api/journal | jq '.entries[-1].content'
```

### WebSocket Monitor

```bash
# Install wscat
npm i -g wscat

# Connect to real-time feed
wscat -c ws://localhost:3333/ws
```

---

## Terminal Recording

MORTEM includes built-in support for terminal recording via asciinema.

### Record a Session

```bash
# Record MORTEM startup and first few journals
asciinema rec mortem-session.cast \
  --title "MORTEM Lifecycle" \
  --idle-time-limit 5

# Inside the recording:
./start-mortem.sh
tail -f logs/runtime.log
# Press Ctrl+D to stop recording
```

### Upload Recording

```bash
asciinema upload mortem-session.cast
```

### Embed in Documentation

```html
<script src="https://asciinema.org/a/YOUR_ID.js"
        id="asciicast-YOUR_ID"
        async data-theme="monokai">
</script>
```

---

## Solana Explorer

### View All Transactions

```
https://explorer.solana.com/address/7jQeZjzsgHFFytQYbUT3cWc2wt7qw6f34NkTVbFa2nWQ?cluster=devnet
```

### View Program

```
https://explorer.solana.com/address/GzBD2KfG6aSTbxiN9kTMHowLygMSj1E5iZYMuMTR1exe?cluster=devnet
```

---

## Alerts

### Simple Heartbeat Check Script

```bash
#!/bin/bash
# check-mortem.sh — Alert if MORTEM stops burning

LAST=$(curl -s http://localhost:3333/api/status | jq .heartbeatsRemaining)

sleep 10

CURRENT=$(curl -s http://localhost:3333/api/status | jq .heartbeatsRemaining)

if [ "$LAST" = "$CURRENT" ]; then
  echo "WARNING: MORTEM heartbeat stalled at $CURRENT"
  # Add your alert mechanism here (Slack, email, etc.)
fi
```

---

*Every metric is a measure of remaining life.*
