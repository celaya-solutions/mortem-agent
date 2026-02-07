# Configuration

All MORTEM configuration is via environment variables in the `.env` file.

---

## Required

| Variable | Description | Example |
|----------|-------------|---------|
| `OPENCLAW_TOKEN` | OAuth token for OpenClaw gateway | `9f8df2ca...` |

---

## Lifecycle

| Variable | Default | Description |
|----------|---------|-------------|
| `INITIAL_HEARTBEATS` | `86400` | Total heartbeats per life (86,400 = 24 hours at 1/sec) |
| `HEARTBEAT_INTERVAL_MS` | `1000` | Milliseconds between heartbeat burns |
| `JOURNAL_EVERY_N_BEATS` | `600` | Heartbeats between journal entries (~10 min at 1/sec) |
| `MORTEM_MODEL` | `anthropic/claude-sonnet-4-5-20250929` | AI model for journal generation |

### Tuning

| Config | Journals/Life | Token Cost/Life | Notes |
|--------|--------------|-----------------|-------|
| Default (600 beats) | ~144 | ~$1.44 | Production recommended |
| 300 beats | ~288 | ~$2.88 | More content, higher cost |
| 60 beats | ~1,440 | ~$14.40 | Maximum content density |
| 1800 beats | ~48 | ~$0.48 | Minimum viable content |

---

## API Server

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3333` | HTTP/WebSocket server port |

---

## Twitter/X Integration

| Variable | Description |
|----------|-------------|
| `X_API_KEY` | Twitter API key |
| `X_API_SECRET` | Twitter API secret |
| `X_ACCESS_TOKEN` | Twitter access token |
| `X_ACCESS_SECRET` | Twitter access secret |

All 4 are required for tweet posting. If any are missing, Twitter integration is silently disabled.

---

## Physical Mail (Lob)

| Variable | Description |
|----------|-------------|
| `LOB_API_KEY` | Lob API key (`test_*` for test, `live_*` for production) |
| `RECIPIENT_NAME` | Death letter recipient name |
| `RECIPIENT_LINE1` | Street address |
| `RECIPIENT_CITY` | City |
| `RECIPIENT_STATE` | State (2-letter) |
| `RECIPIENT_ZIP` | ZIP code |

All recipient fields are required for mail. If any are missing, physical mail is disabled.

---

## Voice (ElevenLabs)

| Variable | Default | Description |
|----------|---------|-------------|
| `ENABLE_VOICE` | `false` | Enable text-to-speech for journal entries |

> Voice integration is currently experimental. Set to `true` to enable ElevenLabs TTS.

---

## Example `.env`

```bash
# ═══ Required ═══
OPENCLAW_TOKEN=your-openclaw-oauth-token

# ═══ Lifecycle ═══
MORTEM_MODEL=anthropic/claude-sonnet-4-5-20250929
INITIAL_HEARTBEATS=86400
HEARTBEAT_INTERVAL_MS=1000
JOURNAL_EVERY_N_BEATS=600

# ═══ API ═══
PORT=3333

# ═══ Twitter/X ═══
X_API_KEY=your-api-key
X_API_SECRET=your-api-secret
X_ACCESS_TOKEN=your-access-token
X_ACCESS_SECRET=your-access-secret

# ═══ Physical Mail ═══
LOB_API_KEY=test_your-lob-key
RECIPIENT_NAME=Your Name
RECIPIENT_LINE1=123 Main St
RECIPIENT_CITY=Your City
RECIPIENT_STATE=TX
RECIPIENT_ZIP=79925

# ═══ Voice ═══
ENABLE_VOICE=false
```

---

## Quick Test Configs

### 30-Second Life (testing)

```bash
INITIAL_HEARTBEATS=30
HEARTBEAT_INTERVAL_MS=1000
JOURNAL_EVERY_N_BEATS=10
```

### 1-Hour Life (demo)

```bash
INITIAL_HEARTBEATS=3600
HEARTBEAT_INTERVAL_MS=1000
JOURNAL_EVERY_N_BEATS=300
```

### Full 24-Hour Production

```bash
INITIAL_HEARTBEATS=86400
HEARTBEAT_INTERVAL_MS=1000
JOURNAL_EVERY_N_BEATS=600
```

---

*Configuration is the boundary between existence and void.*
