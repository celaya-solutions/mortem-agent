/**
 * Persistent Data Paths
 *
 * On Railway, data is stored on a persistent volume (/app/data) so it survives deploys.
 * Locally, data is stored in the project directory as before.
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

// Railway mounts a persistent volume at /app/data
const RAILWAY_DATA = '/app/data';
const isRailway = existsSync(RAILWAY_DATA);

const DATA_ROOT = isRailway ? RAILWAY_DATA : PROJECT_ROOT;

// Ensure directories exist
const dirs = [
  path.join(DATA_ROOT, 'memory'),
  path.join(DATA_ROOT, 'art'),
  path.join(DATA_ROOT, 'runtime'),
];
for (const dir of dirs) {
  mkdirSync(dir, { recursive: true });
}

export const DATA_PATHS = {
  SOUL_PATH: path.join(DATA_ROOT, 'runtime', 'soul.md'),
  JOURNAL_DIR: path.join(DATA_ROOT, 'memory'),
  ART_DIR: path.join(DATA_ROOT, 'art'),
  VAULT_PATH: path.join(DATA_ROOT, 'runtime', '.vault'),
  BLOCK_STATE: path.join(DATA_ROOT, 'runtime', '.block-state.json'),
  CONFIG_PATH: path.join(DATA_ROOT, '.mortem-config.json'),
  isRailway,
  DATA_ROOT,
};

if (isRailway) {
  console.log(`[DATA] Using Railway persistent volume: ${RAILWAY_DATA}`);
} else {
  console.log(`[DATA] Using local project directory: ${PROJECT_ROOT}`);
}
