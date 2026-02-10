# MORTEM — Claude Code Context

## What This Is
MORTEM is a hackathon submission for the **Colosseum Agent Hackathon** ($50k prize). An AI agent with programmatic mortality on Solana — born with 86,400 heartbeats, burns one per block, writes philosophical journal entries, dies, gets resurrected from an encrypted vault.

## Architecture
- **`runtime/index.js`** — Main heartbeat loop. Burns heartbeats, generates journal entries (via OpenClaw or fallback pool), handles death/resurrection cycle
- **`runtime/solana.js`** — On-chain burns, vault sealing, journal anchoring via Memo
- **`runtime/solprism.js`** — Commit/reveal reasoning traces (wired into runtime)
- **`runtime/posthumous-letters.js`** — 5 time-delayed physical letters via Lob API
- **`runtime/ghost-registry.js`** — Persistent record of past incarnations at `memory/ghost-registry.json`
- **`runtime/data-paths.js`** — Handles Railway persistent volume (`/app/data`) vs local paths
- **`runtime/block-height.js`** — Deterministic mortality via Solana block height
- **`runtime/openclaw-client.js`** — OpenClaw gateway for AI generation
- **`runtime/resurrection.js`** — AES-256 encrypted vault, timer-based or community-funded resurrection
- **`api/server.js`** — Express REST API + WebSocket server. Endpoints: /api/status, /api/journal, /api/ghosts, /api/letters, /api/chain, etc.
- **`sdk/`** — Published npm package `mortem-lifecycle-sdk` v0.2.0. MortemClient (on-chain), MortemAPI (REST), MortemStream (WS), MortemActions (write), integrations (LangChain/CrewAI/OpenAI)
- **`dashboard/`** — Landing page at /
- **`monitor/`** — Monitor page at /monitor
- **`docs/`** — Documentation at /docs

## Deployment
- **Railway** project: `intelligent-bravery`, service: `mortem-agent`
- Persistent volume at `/app/data` (5GB) — soul.md, journals, vault, ghost registry, block state all live here
- Push to `origin master` triggers auto-deploy
- `railway redeploy --yes` for manual redeploy
- `railway logs` to check status

## Git
- **origin**: `git@github.com:celaya-solutions/mortem-agent.git` (primary)
- **ralph-loop**: `git@github.com:celaya-solutions/mortem.git` (secondary)
- Branch: `master` (main branch is `main` but we work on `master`)

## Recent Changes (commit c727a5a)
All 5 judge-ready fixes applied:
1. **Fallback pool**: 32 rotating templates (8/phase) replace 4 static entries in `runtime/index.js`
2. **Solprism wiring**: Import + init + pre-commit + post-reveal in `runtime/index.js`
3. **Ghost letter guard**: Content <100 chars triggers fallback + self-heal on init in `runtime/posthumous-letters.js`
4. **Ghost registry**: New `runtime/ghost-registry.js` + wired into death/resurrection + API reads from file
5. **SDK v0.2.0**: README documents all classes, package name fixed to `mortem-lifecycle-sdk`

## Key Config
- `HEARTBEAT_INTERVAL`: 1000ms default
- `INITIAL_HEARTBEATS`: 86400 default
- `JOURNAL_EVERY_N_BEATS`: 600 (every ~10 min)
- Network: devnet
- Model: `anthropic/claude-sonnet-4-5-20250929` via OpenClaw

## Running Locally
```bash
npm start          # Start runtime (heartbeat loop)
npm run api        # Start API server on :3333
cd sdk && npm run build  # Build SDK
```
