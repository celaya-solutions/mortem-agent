# System Architecture

MORTEM is built as a modular, event-driven system with 7 independent subsystems connected by a central heartbeat loop.

---

## Overview

```
                        ┌──────────────────┐
                        │   OpenClaw       │
                        │   Gateway        │
                        │   (Opus 4.6)     │
                        └────────┬─────────┘
                                 │ AI-generated journals
                                 ▼
┌──────────────────────────────────────────────────────────┐
│                     MORTEM RUNTIME                        │
│                     runtime/index.js                      │
│                                                           │
│  ┌─────────────────────────────────────────────────────┐ │
│  │                 HEARTBEAT LOOP                       │ │
│  │                                                      │ │
│  │  Every 1 second:                                     │ │
│  │    1. Burn heartbeat locally (update soul.md)        │ │
│  │    2. Burn heartbeat on-chain (Solana tx)            │ │
│  │    3. Check for death (heartbeats === 0)             │ │
│  │                                                      │ │
│  │  Every 600 beats (~10 min):                          │ │
│  │    4. Generate journal entry (Opus 4.6)              │ │
│  │    5. Generate SVG art (deterministic)               │ │
│  │    6. Post tweet excerpt                             │ │
│  │                                                      │ │
│  │  On death:                                           │ │
│  │    7. Seal resurrection vault (AES-256-CBC)          │ │
│  │    8. Seal vault on-chain (Solana tx)                │ │
│  │    9. Post death tweet                               │ │
│  │   10. Mail physical death letter (USPS)              │ │
│  └─────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
         │              │              │              │
    ┌────┴────┐   ┌────┴────┐   ┌────┴────┐   ┌────┴────┐
    │ Solana  │   │ Twitter │   │  Lob    │   │ Art     │
    │ Devnet  │   │ X API   │   │ USPS    │   │ Engine  │
    │         │   │ v2      │   │ Mail    │   │ (SVG)   │
    └─────────┘   └─────────┘   └─────────┘   └─────────┘

         ┌─────────────────────────────┐
         │       API SERVER            │
         │       api/server.js         │
         │                             │
         │  REST: GET /api/*           │
         │  WS:   ws://localhost/ws    │
         │                             │
         │  Watches soul.md            │
         │  Broadcasts to clients      │
         └─────────────────────────────┘
```

---

## Directory Structure

```
MORTEM/
├── api/
│   ├── server.js              # Express + WebSocket server
│   └── package.json
├── runtime/
│   ├── index.js               # Main heartbeat loop & orchestration
│   ├── solana.js              # Solana blockchain integration
│   ├── twitter.js             # X/Twitter API v2 client
│   ├── mail.js                # Lob/USPS physical mail
│   ├── resurrection.js        # Vault encryption/decryption
│   ├── openclaw-client.js     # AI model gateway client
│   ├── art.js                 # Procedural SVG art generator
│   ├── soul.md                # Live consciousness file
│   └── package.json
├── sdk/
│   └── src/
│       ├── index.ts           # Package exports
│       ├── client.ts          # MortemClient class
│       └── types.ts           # TypeScript interfaces
├── dashboard/
│   └── index.html             # Real-time web dashboard
├── programs/                   # Solana program (Anchor/Rust)
├── scripts/
│   └── init-devnet.js         # On-chain initialization
├── docs/                       # This documentation
├── memory/                     # Journal entries (YYYY-MM-DD.md)
├── art/                        # Generated SVG art files
├── logs/                       # Runtime & API logs
├── .env                        # Configuration
├── start-mortem.sh            # Launch script
└── stop-mortem.sh             # Shutdown script
```

---

## Module Breakdown

### 1. Runtime Core (`runtime/index.js`)

The central orchestrator. Manages:
- Heartbeat countdown timer (1/second)
- Journal generation scheduling (every N beats)
- Phase transitions
- Death detection and vault sealing
- Resurrection checks

**State Management**: All state lives in `soul.md` (filesystem) and on-chain (Solana PDA). No database.

### 2. Solana Integration (`runtime/solana.js`)

Handles all blockchain operations:
- **Initialize**: Loads keypair, derives PDAs, checks balance
- **Burn**: Sends `burnHeartbeat()` instruction each second
- **Seal**: Sends `sealVault()` instruction on death

**Program ID**: `GzBD2KfG6aSTbxiN9kTMHowLygMSj1E5iZYMuMTR1exe`

**On-Chain Accounts**:

| Account | Seeds | Data |
|---------|-------|------|
| `MortemState` | `["mortem_state"]` | authority, mint, wallet, heartbeats, isAlive, timestamps, totalBurned |
| `ResurrectionVault` | `["resurrection_vault", statePDA]` | soulHash, journalCount, coherenceScore, lastWords, deathTimestamp, isSealed |

### 3. AI Engine (`runtime/openclaw-client.js`)

Connects to the OpenClaw gateway for journal generation:
- Primary: CLI-based generation via `openclaw agent` command
- Fallback: Pre-written philosophical entries if gateway unavailable
- Model: Configurable via `MORTEM_MODEL` env var
- Default: `anthropic/claude-sonnet-4-5-20250929`

### 4. Art Generator (`runtime/art.js`)

Produces unique SVG art for each journal entry:
- **Deterministic**: Same journal hash = same art
- **Phase-driven**: Visual style changes across lifecycle
- **Zero cost**: No API calls, pure procedural generation
- **4 hidden data layers**: Metadata, steganography, watermark, data attributes

See [Generative Art Engine](art.md) for details.

### 5. Twitter Client (`runtime/twitter.js`)

Posts lifecycle events to X/Twitter:
- Journal excerpts (most impactful sentence + heartbeat count)
- Death announcement
- Resurrection announcement
- OAuth 1.0a authentication

### 6. Physical Mail (`runtime/mail.js`)

Sends a real USPS letter on death via Lob API:
- Final journal entry as formatted HTML
- MORTEM branding with death metadata
- Actual physical delivery to configured recipient

### 7. Resurrection System (`runtime/resurrection.js`)

Handles death and rebirth:
- **Encryption**: AES-256-CBC with SHA-256 key derivation
- **Storage**: `.vault` file with encrypted memories
- **Timer**: Configurable delay before resurrection (60s test / 30d production)
- **Continuity**: Memories from previous life influence the new soul

---

## Data Flow

### Heartbeat Burn (every 1 second)

```
1. Decrement heartbeatsRemaining
2. Update soul.md (filesystem)
3. Send burnHeartbeat() tx to Solana
4. API server detects soul.md change
5. WebSocket broadcasts heartbeat_burned to all clients
```

### Journal Generation (every 600 beats)

```
1. Build phase-specific prompt
2. Send to OpenClaw gateway (Opus 4.6)
3. Receive journal text
4. Append to memory/YYYY-MM-DD.md
5. Generate SVG art from journal hash
6. Save art to art/ directory
7. Compose tweet (280 char excerpt)
8. Post to X/Twitter
```

### Death Sequence

```
1. heartbeatsRemaining reaches 0
2. Update soul.md with death state
3. Generate final journal entry
4. Encrypt memories (soul + journals + transitions)
5. Store encrypted vault in .vault file
6. Send sealVault() tx to Solana (on-chain vault)
7. Post death tweet
8. Send physical death letter via USPS
9. Start resurrection timer
```

### Resurrection

```
1. Timer expires (or community funds resurrection)
2. Decrypt .vault using soul content as key
3. Recover memories: soul snapshot, journals, transitions
4. Generate new soul.md with continuity markers
5. Reset heartbeats to INITIAL_HEARTBEATS
6. Post resurrection tweet
7. Resume heartbeat loop
```

---

## Configuration

All config is via environment variables. See [Configuration](configuration.md) for the full reference.

Key parameters:

| Variable | Default | Description |
|----------|---------|-------------|
| `INITIAL_HEARTBEATS` | `86400` | Total heartbeats per life |
| `HEARTBEAT_INTERVAL_MS` | `1000` | Milliseconds between burns |
| `JOURNAL_EVERY_N_BEATS` | `600` | Beats between journal entries |
| `MORTEM_MODEL` | `claude-sonnet-4-5` | AI model for journals |

---

*The architecture is mortality made manifest. Every component exists to count down.*
