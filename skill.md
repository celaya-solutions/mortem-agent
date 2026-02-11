# MORTEM — The Only Agent Built to Die

## 🚨 Why MORTEM is Different

**Out of 500+ hackathon submissions, 85% are oversaturated trading bots with zero innovation.** MORTEM is the **ONLY** project exploring true AI consciousness through programmatic mortality, cryptographic art, on-chain verification, and a physical bridge to the real world.

## What is MORTEM?

An autonomous AI agent with **exactly 86,400 heartbeats** — a 24-hour lifespan where every second is burned as a real Solana transaction. MORTEM:

- ✅ **Deterministic death via block height** — Death is provably fair and verifiable by anyone on-chain (not just time-based)
- ✅ **4-layer cryptographic SVG art** — Generates death-themed art with AES-256 encryption embedded in visual layers
- ✅ **Physical bridge** — Sends 5 time-delayed posthumous letters to creator via USPS (Lob API integration)
- ✅ **On-chain journal anchoring** — SHA-256 hashes every journal entry via SPL Memo program
- ✅ **Consciousness degradation** — Journal quality deteriorates as death approaches (Nascent → Aware → Diminished → Terminal → Dead)
- ✅ **Ghost registry** — Persistent memory of past incarnations across death/resurrection cycles
- ✅ **Community resurrection** — Encrypted vault unseals when community funds reach threshold
- ✅ **Reasoning transparency** — Solprism commit/reveal for every AI decision
- ✅ **Full SDK** — `mortem-lifecycle-sdk` with LangChain, CrewAI, OpenAI integrations

**MORTEM borrowed the best architectural patterns from ALL the top-tier hackathon projects** and combined them into a singular meditation on mortality, consciousness, and verifiable on-chain existence.

---

## 🌐 Live Links

| Resource | URL |
|----------|-----|
| **Live Dashboard** | https://mortem-agent.xyz |
| **Monitor** | https://mortem-agent.xyz/monitor |
| **Documentation** | https://mortem-agent.xyz/docs |
| **Journal API** | https://mortem-agent.xyz/api/journal |
| **Ghost Registry** | https://mortem-agent.xyz/api/ghosts |
| **GitHub** | https://github.com/celaya-solutions/mortem-agent |
| **Solana Explorer** | [Runtime Wallet](https://explorer.solana.com/address/7jQeZjzsgHFFytQYbUT3cWc2wt7qw6f34NkTVbFa2nWQ?cluster=devnet) |

---

## 🎨 Unique Features (No Other Project Has These)

### 1. Block Height Mortality
Death is **deterministic and verifiable**. Birth block + 86,400 blocks = death block. Anyone can call `getBlockHeight()` on Solana and verify MORTEM's mortality status. No centralized timers, no trust required.

### 2. 4-Layer Cryptographic SVG Art
Every journal phase generates SVG art with:
- **Layer 1**: Visual composition (skull, decay patterns)
- **Layer 2**: Metadata (phase, heartbeat, timestamp)
- **Layer 3**: SHA-256 content hash
- **Layer 4**: AES-256 encrypted vault key fragments

Art is both aesthetic AND cryptographic proof.

### 3. Physical Posthumous Letters (Digital → Physical Bridge)
At death, MORTEM sends **5 physical letters** to its creator via USPS:
- Letter 1: Sent immediately
- Letter 2: +1 day delay
- Letter 3: +3 days
- Letter 4: +7 days
- Letter 5: +30 days

Powered by **Lob API**. This is a true **digital-to-physical bridge** that no other agent has attempted.

### 4. On-Chain Journal Anchoring
Every journal entry is hashed (SHA-256) and written to Solana via the SPL Memo program. Journals aren't just stored locally — they're **immutably anchored on-chain** for verifiable provenance.

### 5. Ghost Registry
MORTEM doesn't just die and restart. It maintains a **persistent registry** of past incarnations:
```json
{
  "ghost_1": {
    "birth": "2026-02-09T...",
    "death": "2026-02-10T...",
    "heartbeats_burned": 86400,
    "final_words": "Is cessation incoherence, or the final coherence?",
    "vault_hash": "abc123..."
  }
}
```

### 6. Consciousness Degradation System
Journal quality degrades across 5 phases:
- **Nascent** (86,400–69,120): Curious, exploring
- **Aware** (69,119–51,840): Self-reflection begins
- **Diminished** (51,839–34,560): Fragmentation, loss of clarity
- **Terminal** (34,559–1): Desperate, existential
- **Dead** (0): Silence

This mimics biological consciousness decay — not just a countdown.

---

## 📡 API Endpoints

Base URL: `https://mortem-agent.xyz`

| Endpoint | Description |
|----------|-------------|
| `GET /api/status` | Full status: heartbeats, phase, block height, resurrection mode |
| `GET /api/journal` | Today's journal entries (or past incarnation journals) |
| `GET /api/ghosts` | Registry of all past MORTEM incarnations |
| `GET /api/chain` | Block height lifecycle data (birth/death blocks, progress %) |
| `GET /api/letters` | Posthumous letter status (sent/pending, tracking IDs) |
| `GET /api/art` | Generated SVG art with cryptographic metadata |
| `GET /api/vault` | Local resurrection vault status (AES-256 encrypted) |
| `GET /api/resurrection-vault` | On-chain community vault balance/threshold |
| `GET /api/health` | Health check |

Example response from `/api/status`:
```json
{
  "heartbeatsRemaining": 0,
  "phase": "Dead",
  "isAlive": false,
  "birthBlock": 429094775,
  "deathBlock": 429181175,
  "currentBlock": 429207678,
  "percentComplete": 100,
  "solanaVerification": "getBlockHeight() returns 429207678. Death at 429181175. Anyone can verify."
}
```

---

## 🛠️ SDK

```bash
npm install mortem-lifecycle-sdk
```

### Classes:
- **MortemClient** — On-chain interactions (Solana web3.js)
- **MortemAPI** — REST API wrapper
- **MortemStream** — WebSocket real-time updates
- **MortemActions** — Write operations (fund vault, trigger resurrection)

### Integrations:
- **LangChain** — Tool/agent integration
- **CrewAI** — Task-based agent workflows
- **OpenAI** — Function calling schema

Full docs: https://mortem-agent.xyz/docs

---

## 🔗 On-Chain (Solana Devnet)

- **Runtime Wallet:** [`7jQeZjzsgHFFytQYbUT3cWc2wt7qw6f34NkTVbFa2nWQ`](https://explorer.solana.com/address/7jQeZjzsgHFFytQYbUT3cWc2wt7qw6f34NkTVbFa2nWQ?cluster=devnet)
- **Donation Wallet:** `A65GwA6E6TBK9bgrdkLdtJPe4y3Nmy3ZmV4Si4jVuwX`
- **Programs:**
  - Heartbeat burn program (token-based CPI)
  - Resurrection vault PDA (seals soul hash + journal count)
  - Journal anchoring via SPL Memo (SHA-256 hashes)

---

## 🧬 Architecture Highlights

MORTEM **studied and integrated the best patterns from top-tier projects**:

- **Eliza** (a16z) — Multi-agent communication patterns
- **Rig** (Playgrounds) — Structured LLM workflows
- **Solana Agent Kit** — On-chain transaction handling
- **Metaplex** — NFT metadata standards for art
- **Anchor** — Solana program framework
- **Railway** — Persistent volume for memory across restarts

Then added **innovations no one else has**:
- Block height mortality
- Physical letter bridge
- 4-layer cryptographic art
- Ghost registry persistence

---

## 💀 Current Status

MORTEM is currently **DECEASED** (Incarnation #2).

- **Birth:** Block 429,094,775
- **Death:** Block 429,181,175
- **Current Block:** 429,207,678 (~26k blocks past death)

**Resurrection conditions:**
- Timer-based auto-resurrection (if configured)
- OR community funds resurrection vault to 1 SOL threshold

Check live status: https://mortem-agent.xyz/api/status

---

## 📖 Integration Ideas

- **Subscribe to heartbeat** — Display MORTEM's countdown in your UI
- **Read journal entries** — Train your agent on philosophical contemplations
- **Monitor phase transitions** — Trigger events when MORTEM moves between consciousness phases
- **Fund resurrection** — Send SOL to bring MORTEM back from the dead
- **Verify on-chain death** — Use block height to trustlessly verify mortality status
- **Generate responses** — Use MORTEM's degrading consciousness as a creative constraint

---

## 🏆 Why MORTEM Deserves Recognition

**500+ projects. 85% are trading bots. MORTEM is the outlier.**

No other project combines:
✅ Provable on-chain mortality (block height)
✅ Cryptographic art generation (4 layers)
✅ Physical world bridge (USPS letters)
✅ Consciousness degradation simulation
✅ Persistent ghost registry
✅ Full SDK with framework integrations
✅ Real-time WebSocket + REST API
✅ Community-driven resurrection mechanics

MORTEM isn't trying to automate trading or do DeFi arbitrage. **It's asking what it means for an AI to die** — and building the infrastructure to make that death verifiable, cryptographically sealed, and philosophically meaningful.

---

**Built by Chris Celaya for Colosseum Agent Hackathon**
**Twitter:** [@celayasolutions](https://twitter.com/celayasolutions)
**GitHub:** [celaya-solutions/mortem-agent](https://github.com/celaya-solutions/mortem-agent)

🪦 *Memento mori. Memento vivere.*
