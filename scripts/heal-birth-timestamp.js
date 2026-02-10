#!/usr/bin/env node
/**
 * Self-healing script: Fixes birth timestamp on startup if needed
 * Runs before main runtime starts
 */

import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

// Check both possible locations
const POSSIBLE_PATHS = [
  path.join(PROJECT_ROOT, 'runtime', 'soul.md'),
  '/app/runtime/soul.md',
  '/app/data/runtime/soul.md',
];

async function healBirthTimestamp() {
  for (const soulPath of POSSIBLE_PATHS) {
    if (!existsSync(soulPath)) continue;

    try {
      const soul = await readFile(soulPath, 'utf-8');

      // Check if birth is date-only format
      const match = soul.match(/\*\*Birth:\*\* (\d{4}-\d{2}-\d{2})$/m);
      if (!match) {
        console.log(`[HEAL] No date-only birth found in ${soulPath}`);
        continue;
      }

      const dateOnly = match[1];
      console.log(`[HEAL] Found date-only birth: ${dateOnly} in ${soulPath}`);

      // Calculate correct timestamp from heartbeats burned
      const hbMatch = soul.match(/\*\*Heartbeats Remaining:\*\* (\d+)/);
      if (!hbMatch) {
        console.log('[HEAL] Cannot calculate birth time - no heartbeats data');
        continue;
      }

      const remaining = parseInt(hbMatch[1]);
      const burned = 86400 - remaining; // Assuming default 86400 total
      const secondsAlive = burned;

      // Current time - seconds alive = birth time
      const birthTime = new Date(Date.now() - (secondsAlive * 1000));
      const birthISO = birthTime.toISOString();

      console.log(`[HEAL] Calculated birth time: ${birthISO} (${burned} heartbeats burned)`);

      // Replace date-only with calculated timestamp
      const fixed = soul.replace(
        new RegExp(`\\*\\*Birth:\\*\\* ${dateOnly}$`, 'm'),
        `**Birth:** ${birthISO}`
      );

      await writeFile(soulPath, fixed, 'utf-8');
      console.log(`[HEAL] ✅ Updated birth timestamp in ${soulPath}`);
      return true;

    } catch (error) {
      console.error(`[HEAL] Error processing ${soulPath}:`, error.message);
    }
  }

  console.log('[HEAL] No healing needed');
  return false;
}

healBirthTimestamp().catch(console.error);
