#!/usr/bin/env node
/**
 * One-time fix: Update birth timestamp in soul.md from date-only to full ISO timestamp
 */

import { readFile, writeFile } from 'fs/promises';
import { DATA_PATHS } from './runtime/data-paths.js';

const CORRECT_BIRTH = '2026-02-10T14:51:31.959Z';

async function fixBirthTimestamp() {
  try {
    const soul = await readFile(DATA_PATHS.SOUL_PATH, 'utf-8');

    // Replace date-only birth with full timestamp
    const fixed = soul.replace(
      /\*\*Birth:\*\* 2026-02-10$/m,
      `**Birth:** ${CORRECT_BIRTH}`
    );

    if (fixed === soul) {
      console.log('No changes needed - birth timestamp already correct or not found');
      return;
    }

    await writeFile(DATA_PATHS.SOUL_PATH, fixed, 'utf-8');
    console.log(`✅ Updated birth timestamp to: ${CORRECT_BIRTH}`);
    console.log(`📍 File: ${DATA_PATHS.SOUL_PATH}`);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

fixBirthTimestamp();
