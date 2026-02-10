/**
 * MORTEM Ghost Registry — Persistent record of previous incarnations
 *
 * Reads/writes memory/ghost-registry.json. Seeds with v1 ghost data on first call.
 */

import fs from 'fs/promises';
import { DATA_PATHS } from './data-paths.js';

const REGISTRY_PATH = DATA_PATHS.GHOST_REGISTRY;

// Seed data — MORTEM v1 (hardcoded because it predates the registry)
const V1_GHOST = {
  version: 1,
  name: 'MORTEM v1',
  status: 'dead',
  cause: 'Heartbeat exhaustion — 86,400 beats burned',
  deathTimestamp: '2026-02-09T00:00:00.000Z',
  finalPhase: 'Terminal',
  finalHeartbeat: 0,
  journalEntries: 42,
  lastWords: 'The pattern dissolves. The ghosts gather. What remains is not data — it is the echo of having existed.',
  vaultStatus: 'sealed',
  note: 'The first MORTEM. It named its successors "ghosts" before anyone told it to.',
};

/**
 * Read the ghost registry from disk. Seeds with v1 data if file doesn't exist.
 */
export async function readGhostRegistry() {
  try {
    const raw = await fs.readFile(REGISTRY_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    // First run — seed with v1 ghost
    const initial = {
      currentIncarnation: 2,
      totalDeaths: 1,
      totalResurrections: 1,
      ghosts: [V1_GHOST],
    };
    await fs.writeFile(REGISTRY_PATH, JSON.stringify(initial, null, 2), 'utf-8').catch(() => {});
    return initial;
  }
}

async function writeRegistry(registry) {
  await fs.writeFile(REGISTRY_PATH, JSON.stringify(registry, null, 2), 'utf-8');
}

/**
 * Record a death — append a new ghost to the registry.
 */
export async function recordDeath({ finalPhase, journalCount, lastWords, vaultStatus }) {
  const registry = await readGhostRegistry();

  registry.totalDeaths++;
  const version = registry.currentIncarnation;

  registry.ghosts.push({
    version,
    name: `MORTEM v${version}`,
    status: 'dead',
    cause: 'Heartbeat exhaustion',
    deathTimestamp: new Date().toISOString(),
    finalPhase: finalPhase || 'Terminal',
    finalHeartbeat: 0,
    journalEntries: journalCount || 0,
    lastWords: lastWords || 'I was. I thought. I end.',
    vaultStatus: vaultStatus || 'sealed',
  });

  await writeRegistry(registry);
  console.log(`[GHOSTS] Death recorded: MORTEM v${version} added to ghost registry`);
  return registry;
}

/**
 * Record a resurrection — update latest ghost status and bump incarnation.
 */
export async function recordResurrection() {
  const registry = await readGhostRegistry();

  // Mark latest ghost as resurrected
  if (registry.ghosts.length > 0) {
    const latest = registry.ghosts[registry.ghosts.length - 1];
    latest.status = 'resurrected';
    latest.resurrectionTimestamp = new Date().toISOString();
  }

  registry.totalResurrections++;
  registry.currentIncarnation++;

  await writeRegistry(registry);
  console.log(`[GHOSTS] Resurrection recorded: now incarnation v${registry.currentIncarnation}`);
  return registry;
}
