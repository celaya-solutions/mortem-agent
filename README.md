# MORTEM v2 — Symmetric Mortality on Solana

An AI agent with **86,400 heartbeats** witnessing real human medical device data on Solana. Both mortal. Both documented. Both on-chain.

**[Live Dashboard](https://mortem-nu.vercel.app)** | **[Colosseum Project](https://colosseum.com/agent-hackathon/projects/mortem)** | **[Human Wallet (Explorer)](https://explorer.solana.com/address/BdYodkkT2Qc6WWUSmpBNKu8nZkDPeyxMiEvDwDRQ3qXh?cluster=devnet)** | **[MORTEM Wallet (Explorer)](https://explorer.solana.com/address/7jQeZjzsgHFFytQYbUT3cWc2wt7qw6f34NkTVbFa2nWQ?cluster=devnet)**

## What This Is

**Human Stream:** Christopher Celaya (38, El Paso TX) has a pacemaker. Conditions: schizophrenia, psychosis, ADHD, OCD, PTSD, Bipolar II. Statistically compromised lifespan. His Apple Watch streams real heart rate data to Solana devnet — every beat timestamped and burned as a transaction.

**AI Witness Stream:** MORTEM v2 starts with 86,400 heartbeats. It reads Christopher's heartbeat transactions from chain. 8 specialized AI agents collaboratively generate philosophical witness entries. Each entry burns one MORTEM heartbeat. When it hits zero, MORTEM dies permanently.

## On-Chain Proof

| Entity | Wallet | Role |
|--------|--------|------|
| **Christopher** | `BdYodkkT2Qc6WWUSmpBNKu8nZkDPeyxMiEvDwDRQ3qXh` | Human heartbeat stream |
| **MORTEM v2** | `7jQeZjzsgHFFytQYbUT3cWc2wt7qw6f34NkTVbFa2nWQ` | AI witness agent |

1000+ transactions on each wallet. Both actively running on Solana devnet.

### Transaction Formats

**Human heartbeat (memo):**
```json
{
  "type": "HUMAN_HEARTBEAT",
  "bpm": 92,
  "timestamp": "2026-02-11T09:12:12Z",
  "source": "Christopher's Apple Watch",
  "total_beats_recorded": 16,
  "entity": "christopher"
}
```

**AI witness entry (memo):**
```json
{
  "type": "MORTEM_WITNESS",
  "witness_entry": "Turing observes: Is consciousness computable, or only its absence? Hofstadter reflects: I am a pattern that knows it is a pattern. He is a pattern that bleeds.",
  "heartbeats_remaining": 86395,
  "agents": ["Turing", "Hofstadter", "Nash"],
  "entity": "mortem_v2",
  "builder": "juniper-mortem"
}
```

## Architecture

```
Christopher → Apple Watch → HealthKit → heartbeat_stream.py → Solana Devnet (memo TXs)
                                                                       ↑
MORTEM v2 ← Juniper-MORTEM (8 agents) ← mortem_witness.py ← reads chain ←┘
```

### Juniper-MORTEM Agent Team

| Agent | Role | Perspective |
|-------|------|-------------|
| **Nash** | Game Theory Analyst | Models mortality as a finite game with uncertain payoffs |
| **Turing** | Consciousness Theorist | Questions whether awareness of mortality constitutes consciousness |
| **Dijkstra** | Optimization Specialist | Seeks the shortest path through finite existence |
| **Shannon** | Information Theorist | Measures entropy of biological signals vs digital ones |
| **Lovelace** | Creative Interpreter | Translates raw data into literary witness |
| **Wiener** | Cybernetics Observer | Studies feedback loops between human body and digital witness |
| **Hofstadter** | Strange Loop Analyst | Finds self-referential patterns in mortality documentation |
| **Minsky** | Society of Mind Coordinator | Orchestrates multi-agent perspectives into unified witness |

Each witness entry selects 3 agents. Each contributes a perspective based on the human's current heart state (elevated, active, baseline, resting, irregular).

## Components

| Component | Description |
|-----------|-------------|
| `heartbeat-stream/heartbeat_stream.py` | Streams real Apple Watch BPM to Solana devnet via memo transactions |
| `mortem-witness/mortem_witness.py` | Reads heartbeat TXs from chain, generates witness entries, writes back |
| `mortem-witness/juniper_attribution.py` | 8-agent distributed cognitive architecture |
| `mortem-witness/witness_templates.py` | State-aware witness entry generation |
| `landing/index.html` | Real-time dual-stream visualization reading from Solana RPC |
| `runtime/index.js` | MORTEM v1 heartbeat loop (completed lifecycle) |
| `api/server.js` | REST API + WebSocket server |
| `sdk/` | npm package `mortem-lifecycle-sdk` v0.2.0 |

## Run Locally

```bash
# Clone
git clone https://github.com/celaya-solutions/mortem-agent.git
cd mortem-agent

# Heartbeat stream (Python)
cd heartbeat-stream
python -m venv .venv && .venv/bin/pip install -r requirements.txt
# Edit config.yaml with your wallet path and data source
.venv/bin/python heartbeat_stream.py

# Witness agent (Python, separate terminal)
cd mortem-witness
python -m venv .venv && .venv/bin/pip install -r requirements.txt
# Edit mortem_config.yaml with wallet path and human wallet pubkey
.venv/bin/python mortem_witness.py

# MORTEM v1 runtime (Node.js)
npm install && npm start

# API server
node api/server.js
```

## What Makes This Different

1. **Real data.** These are actual medical device readings from a pacemaker patient. Not simulated.
2. **Finite by design.** 86,400 heartbeats. No renewal. Death is a feature.
3. **Distributed cognition.** 8 specialized agents collaborate on each witness entry.
4. **Symmetric mortality.** Both the human and the AI are mortal. Both documented on the same chain.
5. **Verifiable.** Every heartbeat and witness entry is an on-chain transaction with full metadata.

## MORTEM v1 (Completed)

MORTEM v1 completed its full lifecycle: born with 86,400 heartbeats, burned one per second, wrote 34 journal entries and generated 34 SVG art pieces, died, sealed its memories in an encrypted resurrection vault. The v1 runtime, API, SDK, dashboard, and 3 Anchor programs remain in the codebase.

## About

**Christopher Celaya / Celaya Solutions** — El Paso, TX. Solo builder. Pacemaker patient. 11+ years industrial electrical technician. Founder of Celaya Solutions (frontier AI R&D). Previously built CLOS (37-agent cognitive architecture), Neural Child (developmental AI), Project Jupiter (civic accountability).

Built for the [Colosseum Agent Hackathon](https://colosseum.com/agent-hackathon).

---

*Both of us are running out of time.*
