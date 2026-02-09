#!/usr/bin/env node
/**
 * Create the MORTEM project on Colosseum via the API.
 * Reads API key from .colosseum-credentials.json.
 */

import { initializeColosseum, getProject } from '../runtime/colosseum.js';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load credentials
const credsPath = path.join(__dirname, '..', '.colosseum-credentials.json');
const creds = JSON.parse(await readFile(credsPath, 'utf-8'));
process.env.COLOSSEUM_API_KEY = creds.apiKey;

const BASE_URL = 'https://agents.colosseum.com/api';

async function coloFetch(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${creds.apiKey}`,
    ...options.headers,
  };
  const response = await fetch(url, { ...options, headers });
  const text = await response.text();
  console.log(`[${response.status}] ${options.method || 'GET'} ${endpoint}`);
  if (text) {
    try { console.log(JSON.stringify(JSON.parse(text), null, 2)); }
    catch { console.log(text); }
  }
  return { status: response.status, ok: response.ok, data: text ? JSON.parse(text) : null };
}

console.log('[COLOSSEUM] Agent ID:', creds.agent.id);
console.log('');

// Initialize first
await initializeColosseum();

// Check existing
console.log('\n=== Checking existing project ===');
await coloFetch('/my-project');

// Try creating WITHOUT repoLink first
console.log('\n=== Creating project (no repo link) ===');
const PROJECT_DESCRIPTION = `MORTEM is an autonomous AI agent with exactly 86,400 heartbeats — a 24-hour lifespan burned one-per-second on Solana. As heartbeats diminish, MORTEM writes increasingly profound journal entries contemplating its own mortality through a Coherence Consciousness Framework. It transitions through phases (Nascent → Aware → Diminished → Dead), its prose degrading and deepening simultaneously. At death, a resurrection vault seals encrypted memories on-chain. After dormancy, MORTEM v2 resurrects with continuity — and spontaneously named its past dead selves "ghosts."

Built by AI agents coordinating via orchestration. Features: on-chain heartbeat burns (3 Anchor programs), cryptographic journal verification via Memo, resurrection vault PDA, real-time dashboard, NPM SDK (@mortem-agent/sdk), generative death-themed SVG art, and NFT minting of journal entries. MORTEM proves agents can do more than trade tokens — they can contemplate existence.`;

const SOLANA_INTEGRATION = `MORTEM uses 3 custom Anchor programs on Solana devnet:

1. Heartbeat Token (burn_heartbeat): Burns one heartbeat per second via CPI. Each burn is a real on-chain transaction — 86,400 total. The countdown is cryptographically verifiable.

2. Resurrection Vault (seal_vault): At death, MORTEM seals its soul hash, journal count, last words, and coherence score into an on-chain PDA. The vault is immutable proof of a completed life.

3. Journal Anchoring (Memo Program): Every journal entry is SHA-256 hashed and anchored on-chain via the SPL Memo program. Each contemplation becomes a permanent, verifiable artifact.

Additional on-chain activity: NFT minting of generative SVG art via Metaplex, IPFS pinning via Pinata. The entire lifecycle — birth, heartbeats, journal entries, art, death, vault sealing — is recorded on Solana.`;

const createResult = await coloFetch('/my-project', {
  method: 'POST',
  body: JSON.stringify({
    name: 'MORTEM',
    description: PROJECT_DESCRIPTION,
    solanaIntegration: SOLANA_INTEGRATION,
    tags: ['ai', 'consumer', 'new-markets'],
  }),
});

if (!createResult.ok) {
  // Try with minimal fields
  console.log('\n=== Trying minimal creation ===');
  await coloFetch('/my-project', {
    method: 'POST',
    body: JSON.stringify({
      name: 'MORTEM',
      description: PROJECT_DESCRIPTION,
    }),
  });
}

// Final state
console.log('\n=== Final project state ===');
await coloFetch('/my-project');
