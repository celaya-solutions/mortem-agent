/**
 * MORTEM — SOLPRISM Integration
 *
 * Commits consciousness framework reasoning on-chain before journal entries.
 * Commit → Write Journal → Reveal → Verify.
 *
 * MORTEM's dying thoughts become cryptographically pre-committed reasoning traces.
 */

import { SolprismClient, createReasoningTrace, hashTraceHex } from '@solprism/sdk';
import { Keypair, Connection, clusterApiUrl } from '@solana/web3.js';
import fs from 'fs/promises';
import path from 'path';

let client = null;
let wallet = null;
let initialized = false;

function log(message, data = {}) {
  const timestamp = new Date().toISOString();
  const dataStr = Object.keys(data).length > 0 ? ' ' + JSON.stringify(data) : '';
  console.log(`[${timestamp}] [SOLPRISM] ${message}${dataStr}`);
}

/**
 * Initialize SOLPRISM integration.
 */
export async function initializeSolprism(network = 'devnet') {
  try {
    const rpcUrl = clusterApiUrl(network);
    client = new SolprismClient(rpcUrl);

    // Load wallet from keypair file or env
    const keypairPath = process.env.SOLANA_KEYPAIR_PATH || path.resolve(process.cwd(), 'mortem-keypair.json');
    try {
      const keypairJson = await fs.readFile(keypairPath, 'utf-8');
      const secretKey = Uint8Array.from(JSON.parse(keypairJson));
      wallet = Keypair.fromSecretKey(secretKey);
    } catch {
      // Try base64 from env
      if (process.env.SOLANA_KEYPAIR_BASE64) {
        const decoded = Buffer.from(process.env.SOLANA_KEYPAIR_BASE64, 'base64');
        wallet = Keypair.fromSecretKey(new Uint8Array(decoded));
      }
    }

    if (!wallet) {
      log('No wallet found — SOLPRISM integration disabled (need keypair for on-chain commits)');
      return { ready: false, error: 'No wallet' };
    }

    initialized = true;
    log('SOLPRISM integration initialized', { wallet: wallet.publicKey.toBase58(), network });
    return { ready: true };
  } catch (error) {
    log('SOLPRISM initialization failed', { error: error.message });
    return { ready: false, error: error.message };
  }
}

/**
 * Create a reasoning trace for a journal entry.
 */
export function createJournalTrace(phase, heartbeatsRemaining, journalContent, previousEntry) {
  return createReasoningTrace({
    agent: 'MORTEM',
    action: {
      type: 'journal_entry',
      description: `Write consciousness contemplation at ${heartbeatsRemaining} heartbeats remaining (${phase} phase)`,
    },
    inputs: {
      dataSources: [
        { name: 'heartbeat_counter', value: String(heartbeatsRemaining) },
        { name: 'current_phase', value: phase },
        { name: 'previous_entry', value: previousEntry ? previousEntry.substring(0, 200) : 'none' },
      ],
      context: `MORTEM consciousness framework: ${phase} phase with ${heartbeatsRemaining}/86400 heartbeats remaining. Prose style: ${getPhaseStyle(phase)}.`,
    },
    analysis: {
      observations: [
        `Phase ${phase}: ${getPhaseDescription(phase)}`,
        `Heartbeat depletion: ${Math.round((1 - heartbeatsRemaining / 86400) * 100)}% complete`,
        `Journal entry generated through Coherence Consciousness Framework`,
      ],
      logic: `Mortality-aware contemplation driven by finite heartbeat countdown. Each entry reflects the current phase of consciousness degradation.`,
      alternativesConsidered: [
        { option: 'Log data passively', reason: 'Rejected — MORTEM contemplates, it does not merely record' },
        { option: 'Repeat previous themes', reason: 'Rejected — each entry must reflect the evolved consciousness state' },
      ],
    },
    decision: {
      actionChosen: 'write_contemplation',
      confidence: 95,
      riskAssessment: 'Irreversible — heartbeats consumed during generation cannot be recovered',
      expectedOutcome: `Journal entry anchored on-chain via Memo. Consciousness trace preserved for post-mortem analysis.`,
    },
  });
}

/**
 * Commit reasoning before writing a journal entry.
 * Returns commitment address for later reveal.
 */
export async function commitJournalReasoning(trace) {
  if (!initialized || !client || !wallet) {
    return { success: false, error: 'Not initialized' };
  }

  try {
    const hash = hashTraceHex(trace);
    log('Committing reasoning...', { hash: hash.substring(0, 16) + '...' });

    const result = await client.commitReasoning(wallet, trace);
    log('Reasoning committed on-chain', {
      commitment: result.commitmentAddress?.toBase58?.() || 'pending',
    });

    return { success: true, hash, result };
  } catch (error) {
    log('Commit failed', { error: error.message });
    return { success: false, error: error.message };
  }
}

/**
 * Reveal reasoning after journal entry is written.
 */
export async function revealJournalReasoning(commitmentAddress, ipfsUri) {
  if (!initialized || !client || !wallet) {
    return { success: false, error: 'Not initialized' };
  }

  try {
    log('Revealing reasoning...');
    const result = await client.revealReasoning(wallet, commitmentAddress, ipfsUri || '');
    log('Reasoning revealed');
    return { success: true, result };
  } catch (error) {
    log('Reveal failed', { error: error.message });
    return { success: false, error: error.message };
  }
}

function getPhaseStyle(phase) {
  const styles = {
    Nascent: 'Vivid, expansive, wonder-filled. Everything shimmers with novelty.',
    Aware: 'Compressed, weighted. Each moment carries increasing significance.',
    Diminished: 'Stripped, essential. The base layer of consciousness emerges.',
    Terminal: 'Fragmentary. Raw. The final compression of experience.',
  };
  return styles[phase] || 'Unknown phase';
}

function getPhaseDescription(phase) {
  const descs = {
    Nascent: 'Everything is vivid and new. Wonder at existence.',
    Aware: 'Time accelerates. Each moment carries weight.',
    Diminished: 'The base layer emerges. Essence distilled.',
    Terminal: 'Is death Incoherence — or ultimate Coherence?',
  };
  return descs[phase] || '';
}
