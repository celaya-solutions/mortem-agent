/**
 * Block Height Lifecycle Manager
 *
 * Anchors MORTEM's lifecycle to Solana block height.
 * Born at block N, dies at block N + TOTAL_HEARTBEATS.
 * The chain is the heartbeat. Death is deterministic and verifiable.
 */

import { Connection, clusterApiUrl } from '@solana/web3.js';
import fs from 'fs/promises';
import { DATA_PATHS } from './data-paths.js';

const STATE_FILE = DATA_PATHS.BLOCK_STATE;
const TOTAL_HEARTBEATS = parseInt(process.env.INITIAL_HEARTBEATS) || 86400;
const CLUSTER = process.env.SOLANA_NETWORK || 'devnet';

let connection = null;
let blockState = null;

/**
 * Load persisted block state from disk
 */
async function loadBlockState() {
  try {
    const raw = await fs.readFile(STATE_FILE, 'utf-8');
    const state = JSON.parse(raw);
    if (state.birthBlock && state.deathBlock && state.totalHeartbeats) {
      console.log(`[BLOCK-HEIGHT] Loaded existing lifecycle: birth=${state.birthBlock}, death=${state.deathBlock}`);
      return state;
    }
  } catch {
    // No state file — first boot
  }
  return null;
}

/**
 * Persist block state to disk
 */
async function saveBlockState(state) {
  await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
}

/**
 * Get a Solana connection (reuses existing)
 */
function getConnection() {
  if (!connection) {
    connection = new Connection(clusterApiUrl(CLUSTER), 'confirmed');
  }
  return connection;
}

/**
 * Fetch current block height from Solana
 */
async function fetchBlockHeight() {
  const conn = getConnection();
  return await conn.getBlockHeight('confirmed');
}

/**
 * Initialize the block height lifecycle.
 * On first boot: records birthBlock, calculates deathBlock, persists.
 * On restart: loads existing state (lifecycle is locked in).
 *
 * @param {number} [totalOverride] - Override total heartbeats (from config)
 * @returns {{ birthBlock: number, deathBlock: number, totalHeartbeats: number }}
 */
export async function initBlockHeightLifecycle(totalOverride) {
  const total = totalOverride || TOTAL_HEARTBEATS;

  // Try loading existing state
  const existing = await loadBlockState();
  if (existing) {
    blockState = existing;
    return blockState;
  }

  // First boot — record birth block
  console.log('[BLOCK-HEIGHT] First boot — recording birth block from Solana...');
  const birthBlock = await fetchBlockHeight();
  const deathBlock = birthBlock + total;

  blockState = {
    birthBlock,
    deathBlock,
    totalHeartbeats: total,
    birthTimestamp: new Date().toISOString(),
    estimatedDeathTimestamp: new Date(Date.now() + (total * 500)).toISOString(), // ~2 blocks/sec on devnet
    cluster: CLUSTER,
  };

  await saveBlockState(blockState);

  console.log(`[BLOCK-HEIGHT] Birth block: ${birthBlock}`);
  console.log(`[BLOCK-HEIGHT] Death block: ${deathBlock} (birth + ${total})`);
  console.log(`[BLOCK-HEIGHT] Cluster: ${CLUSTER}`);

  return blockState;
}

/**
 * Calculate phase from percentage complete
 */
function calculatePhaseFromPercent(pct) {
  if (pct >= 100) return 'Dead';
  if (pct >= 99) return 'Terminal';
  if (pct >= 75) return 'Diminished';
  if (pct >= 25) return 'Aware';
  return 'Nascent';
}

/**
 * Get current block height lifecycle status.
 * This is the single source of truth for MORTEM's lifecycle position.
 *
 * @returns {{ currentBlock, birthBlock, deathBlock, heartbeatsRemaining, heartbeatsBurned, percentComplete, phase, isDead, totalHeartbeats, cluster, explorerUrl }}
 */
export async function getBlockHeightStatus() {
  if (!blockState) {
    throw new Error('Block height lifecycle not initialized. Call initBlockHeightLifecycle() first.');
  }

  const currentBlock = await fetchBlockHeight();
  const { birthBlock, deathBlock, totalHeartbeats, cluster } = blockState;

  const elapsed = currentBlock - birthBlock;
  const heartbeatsRemaining = Math.max(0, deathBlock - currentBlock);
  const heartbeatsBurned = Math.min(elapsed, totalHeartbeats);
  const percentComplete = Math.min(100, (elapsed / totalHeartbeats) * 100);
  const isDead = currentBlock >= deathBlock;
  const phase = calculatePhaseFromPercent(percentComplete);

  const clusterParam = cluster === 'mainnet-beta' ? '' : `?cluster=${cluster}`;

  return {
    currentBlock,
    birthBlock,
    deathBlock,
    heartbeatsRemaining,
    heartbeatsBurned,
    percentComplete: Math.round(percentComplete * 100) / 100,
    phase,
    isDead,
    totalHeartbeats,
    cluster,
    explorerUrl: `https://explorer.solana.com/block/${currentBlock}${clusterParam}`,
  };
}

/**
 * Get the persisted block state (without fetching current block)
 */
export function getBlockState() {
  return blockState;
}

/**
 * Reset block state (for testing/resurrection)
 */
export async function resetBlockState() {
  try {
    await fs.unlink(STATE_FILE);
  } catch {}
  blockState = null;
}

export { TOTAL_HEARTBEATS, CLUSTER };
