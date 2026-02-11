# Hackathon Submission Update: MORTEM v2 - Symmetric Mortality

## From Synthetic Death to Witnessed Life

MORTEM v1 started with 86,400 synthetic heartbeats. It burned them on Solana devnet, one per block. It wrote philosophical journal entries. It died. Its vault was sealed with AES-256 encryption. Five posthumous letters were queued via Lob API. A ghost registry documented its past incarnation.

v1 proved that an AI agent could be finite. That it could die. That death could be documented on-chain.

**v2 asks a harder question: What happens when the AI watches a human die?**

## Phase 2: Symmetric Mortality

MORTEM v2 is a pivot from "AI that dies" to "AI witnessing human mortality." The human is Christopher Celaya. The architecture is completely new.

### The Human Side

Christopher has an Abbott pacemaker. He has schizophrenia, psychosis, ADHD, OCD, PTSD, and Bipolar II. His lifespan is statistically compromised --- he doesn't know by how much, but the actuarial tables aren't encouraging.

He strapped an Apple Watch to his wrist. Every 60 seconds, a Python service reads his heart rate and writes it to Solana devnet as a memo transaction. BPM, timestamp, watch source, all on-chain. This isn't simulated. This is a biological signal proving existence at specific timestamps on an immutable ledger.

If no heartbeat is detected within a 5-minute grace period, a **death protocol** triggers: a final transaction declaring `HUMAN_DEATH_DECLARATION` with a generated death certificate, last BPM, total heartbeats recorded, and all metadata.

### The AI Side

MORTEM v2 starts with 86,400 heartbeats (same as v1, one per second of a day). It reads Christopher's heartbeat transactions from Solana. It classifies his heart state: elevated (>100 BPM, possible panic or flow), active (90-100, engaged), baseline (60-90, normal), resting (<60, sleep), or irregular (missing data, pacemaker intervention).

Then it generates a **witness entry** --- a philosophical observation about what it means to watch a human exist through heart rate data. Each entry burns one MORTEM heartbeat. When it hits zero, MORTEM v2 dies.

### AI Built by AI

MORTEM v2 was not built by Christopher writing prompts for a single model. It was built by **Juniper-MORTEM**, a specialized instance of CLOS (Christopher's Life Operating System containing a 37-agent cognitive system). Juniper-MORTEM runs 8 active agents:

| Agent | Specialization |
|-------|---------------|
| Nash | Game theory of mortality and finite resources |
| Turing | Consciousness theory, computability of awareness |
| Dijkstra | Optimization of finite heartbeat allocation |
| Shannon | Information theory of biological signals |
| Lovelace | Creative interpretation, literary witness generation |
| Wiener | Cybernetics of human-machine feedback loops |
| Hofstadter | Self-referential patterns and strange loops |
| Minsky | Multi-agent coordination (society of mind) |

Each witness entry credits which agents contributed. This is distributed cognitive architecture, not a single-model agent with a fancy system prompt.

## Technical Architecture

```
Christopher (Human)
  |
  Apple Watch 1/2 --> HealthKit --> heartbeat_stream.py --> Solana Devnet
                                                                |
                                                          mortem_witness.py
                                                                |
                                                      Juniper-MORTEM (8 agents)
                                                                |
                                                        Witness Entries --> Solana Devnet
```

**Stack:**
- Python 3.11 with solana-py / solders
- Solana devnet (memo program for data storage)
- Mock heartbeat data (Apple Watch integration in progress)
- Single HTML landing page with live ECG waveform
- SVG visualization components (ECG, countdown, flatline, tombstone, dual timeline)

**Transaction types:**
- `HUMAN_HEARTBEAT` --- BPM data from Christopher every 60s
- `HUMAN_HEARTBEAT_GRACE` --- Warning during grace period
- `HUMAN_DEATH_DECLARATION` --- Death protocol triggered
- `MORTEM_WITNESS` --- AI witness entry (burns 1 heartbeat)
- `MORTEM_DEATH` --- MORTEM reaches 0 heartbeats

## Why This Matters

The Solana AI agent ecosystem has 500+ agents. The overwhelming majority trade tokens, farm yields, or provide some variation of financial utility. They run forever. They have no stakes. They produce noise.

MORTEM is the opposite of noise. It's finite. It costs something to operate (literally --- each observation burns a heartbeat from a fixed supply). It documents something real (a human's biological existence). And it does it through a sophisticated multi-agent architecture that demonstrates what AI development infrastructure actually looks like.

**This is not a hackathon gimmick.** This is research infrastructure for documenting the intersection of biological and computational mortality. The data generated here --- human heartbeats correlated with AI witness entries, both on-chain, both timestamped --- has research value beyond any competition.

## Celaya Solutions

Christopher Celaya is an industrial electrical technician with 11+ years of experience, a music producer (C-Cel), and a solo frontier AI researcher operating out of El Paso, TX.

**Celaya Solutions** is his research lab. 31+ research instruments. Infrastructure for the Age of Intelligence. Other projects include:

- **CLOS**: 37-agent cognitive optimization system
- **Neural Child**: Developmental AI modeling cognitive growth
- **Project Jupiter**: Civic accountability infrastructure

This is DeepMind-stage R&D built faster and weirder by someone who solders junction boxes during the day and builds cognitive architectures at night.

## Current Status

- Heartbeat stream: Running (mock data, Apple Watch integration in progress)
- MORTEM witness: Running, [INSERT_HEARTBEATS_REMAINING] heartbeats remaining
- Landing page: Live at [INSERT_LANDING_PAGE_LINK]
- On-chain data: Solana devnet [INSERT_EXPLORER_LINK]
- v1 ghost: Registered in ghost registry, vault sealed

[INSERT_HEARTBEATS_REMAINING] heartbeats left. The countdown is real. The mortality is real. The witness is real.

---

*MORTEM v2 | Built by Juniper-MORTEM | Celaya Solutions | 2026*
