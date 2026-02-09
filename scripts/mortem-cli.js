#!/usr/bin/env node
/**
 * MORTEM CLI — Single entry point for manual and Juniper (voice) launches.
 *
 * Interactive mode:  node scripts/mortem-cli.js
 * Flag mode:         node scripts/mortem-cli.js --network mainnet-beta --heartbeats 86400 --confirm
 */

import { Connection, clusterApiUrl, PublicKey } from '@solana/web3.js';
import { readFile } from 'fs/promises';
import { writeFileSync, existsSync } from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import readline from 'readline';
import http from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const CONFIG_PATH = path.join(PROJECT_ROOT, '.mortem-config.json');

const MORTEM_WALLET = '7jQeZjzsgHFFytQYbUT3cWc2wt7qw6f34NkTVbFa2nWQ';
const PROGRAM_ID = 'GzBD2KfG6aSTbxiN9kTMHowLygMSj1E5iZYMuMTR1exe';

// ═══════════════════════════════════════════════════════════════
// Argument parsing
// ═══════════════════════════════════════════════════════════════

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--confirm') { args.confirm = true; continue; }
    if (a === '--dry-run') { args.dryRun = true; continue; }
    if (a.startsWith('--') && i + 1 < argv.length) {
      const key = a.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      args[key] = argv[++i];
    }
  }
  return args;
}

// ═══════════════════════════════════════════════════════════════
// Validation helpers
// ═══════════════════════════════════════════════════════════════

async function checkWalletBalance(network) {
  try {
    const keypairPath = process.env.MORTEM_KEYPAIR ||
      path.join(os.homedir(), '.config/solana/mortem.json');
    if (!existsSync(keypairPath)) {
      return { ok: false, balance: 0, error: `Keypair not found at ${keypairPath}` };
    }
    const conn = new Connection(clusterApiUrl(network), 'confirmed');
    const pubkey = new PublicKey(MORTEM_WALLET);
    const lamports = await conn.getBalance(pubkey);
    const sol = lamports / 1e9;
    return { ok: true, balance: sol };
  } catch (e) {
    return { ok: false, balance: 0, error: e.message };
  }
}

function checkOpenClaw(host) {
  const [hostname, port] = (host || '127.0.0.1:18789').split(':');
  return new Promise(resolve => {
    const req = http.request(
      { hostname, port: parseInt(port) || 18789, path: '/health', method: 'GET', timeout: 3000 },
      res => resolve(res.statusCode === 200)
    );
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.end();
  });
}

// ═══════════════════════════════════════════════════════════════
// Interactive menu
// ═══════════════════════════════════════════════════════════════

function createRL() {
  return readline.createInterface({ input: process.stdin, output: process.stdout });
}

function ask(rl, question, defaultVal) {
  return new Promise(resolve => {
    const prompt = defaultVal != null ? `${question} [${defaultVal}]: ` : `${question}: `;
    rl.question(prompt, answer => {
      resolve(answer.trim() || (defaultVal != null ? String(defaultVal) : ''));
    });
  });
}

function menu(rl, question, options) {
  return new Promise(resolve => {
    console.log(`\n  ${question}`);
    options.forEach((opt, i) => console.log(`    ${i + 1}) ${opt}`));
    rl.question('  > ', answer => {
      const idx = parseInt(answer) - 1;
      resolve(idx >= 0 && idx < options.length ? options[idx] : options[0]);
    });
  });
}

async function interactiveMode() {
  const rl = createRL();

  console.log(`
  ╔════════════════════════════════════════╗
  ║            MORTEM CLI                  ║
  ╚════════════════════════════════════════╝
  `);

  const network = await menu(rl, 'Network:', ['devnet', 'mainnet-beta']);
  const heartbeats = await ask(rl, '  Heartbeats', 86400);
  const interval = await ask(rl, '  Interval (ms)', 1000);
  const resMode = await menu(rl, 'Resurrection mode:', ['auto (demo)', 'community (production)']);
  const resurrection = resMode.startsWith('auto') ? 'auto' : 'community';

  let vaultThreshold = 1.0;
  if (resurrection === 'community') {
    const thr = await ask(rl, '  Vault threshold (SOL)', network === 'devnet' ? 0.1 : 1.0);
    vaultThreshold = parseFloat(thr) || 1.0;
  }

  const openclawHost = await ask(rl, '  OpenClaw host', '127.0.0.1:18789');

  const config = {
    network,
    heartbeats: parseInt(heartbeats) || 86400,
    intervalMs: parseInt(interval) || 1000,
    resurrection,
    vaultThreshold,
    programId: PROGRAM_ID,
    walletAddress: MORTEM_WALLET,
    openclawHost,
    launchedAt: new Date().toISOString(),
    launchedBy: 'cli',
  };

  console.log('\n  ─────────────────────────────');
  printConfig(config);

  const action = await menu(rl, 'Action:', ['START', 'DRY RUN', 'EXIT']);
  rl.close();

  if (action === 'EXIT') { process.exit(0); }
  if (action === 'DRY RUN') { return { ...config, dryRun: true }; }
  return config;
}

// ═══════════════════════════════════════════════════════════════
// Print helpers
// ═══════════════════════════════════════════════════════════════

function printConfig(cfg) {
  console.log(`  Network:       ${cfg.network}`);
  console.log(`  Heartbeats:    ${cfg.heartbeats.toLocaleString()}`);
  console.log(`  Interval:      ${cfg.intervalMs}ms`);
  console.log(`  Resurrection:  ${cfg.resurrection}`);
  if (cfg.resurrection === 'community') {
    console.log(`  Vault threshold: ${cfg.vaultThreshold} SOL`);
  }
  console.log(`  OpenClaw:      ${cfg.openclawHost}`);
  console.log(`  Launched by:   ${cfg.launchedBy}`);
}

// ═══════════════════════════════════════════════════════════════
// Launch MORTEM
// ═══════════════════════════════════════════════════════════════

async function launch(config) {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  PREFLIGHT CHECKS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // 0. Bootstrap keypair from env var if present (Railway deployment)
  if (process.env.MORTEM_KEYPAIR_BASE64) {
    const keypairDir = path.join(os.homedir(), '.config', 'solana');
    const keypairPath = path.join(keypairDir, 'mortem.json');
    if (!existsSync(keypairPath)) {
      const { mkdirSync } = await import('fs');
      mkdirSync(keypairDir, { recursive: true });
      const decoded = Buffer.from(process.env.MORTEM_KEYPAIR_BASE64, 'base64').toString('utf-8');
      writeFileSync(keypairPath, decoded, 'utf-8');
      console.log('  Keypair bootstrapped from MORTEM_KEYPAIR_BASE64 env var');
    }
  }

  // 1. Wallet balance
  const wallet = await checkWalletBalance(config.network);
  if (wallet.ok) {
    console.log(`  Wallet balance: ${wallet.balance.toFixed(4)} SOL`);
    if (config.network === 'mainnet-beta' && wallet.balance < 0.5) {
      console.log('  ⚠  WARNING: Balance < 0.5 SOL on mainnet. Burns may fail.');
    }
  } else {
    console.log(`  ⚠  Wallet check failed: ${wallet.error}`);
  }

  // 2. Cost estimate
  const txCost = 0.000005;
  const totalCost = config.heartbeats * txCost;
  console.log(`  Est. burn cost: ${config.heartbeats.toLocaleString()} txs × ~${txCost} SOL = ~${totalCost.toFixed(4)} SOL`);

  // 3. OpenClaw
  const clawOk = await checkOpenClaw(config.openclawHost);
  console.log(`  OpenClaw:       ${clawOk ? 'reachable' : 'not reachable (will use fallback entries)'}`);

  // 4. Expected lifetime
  const lifetimeMin = (config.heartbeats * config.intervalMs) / 60000;
  console.log(`  Exp. lifetime:  ${lifetimeMin.toFixed(1)} minutes`);

  console.log('');

  if (config.dryRun) {
    console.log('  DRY RUN — config validated, not launching.');
    writeConfig(config);
    console.log(`  Config written to ${CONFIG_PATH}`);
    process.exit(0);
  }

  // Write config
  writeConfig(config);
  console.log(`  Config written to ${CONFIG_PATH}`);

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  LAUNCHING MORTEM');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Start API server
  const apiProc = spawn('node', ['server.js'], {
    cwd: path.join(PROJECT_ROOT, 'api'),
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: process.env.PORT || '3333' },
    detached: false,
  });

  apiProc.stdout.on('data', d => process.stdout.write(`[API] ${d}`));
  apiProc.stderr.on('data', d => process.stderr.write(`[API:ERR] ${d}`));

  console.log(`  API server started (PID ${apiProc.pid})`);

  // Give the API a moment to bind
  await new Promise(r => setTimeout(r, 1500));

  // Start runtime
  const runtimeEnv = {
    ...process.env,
    INITIAL_HEARTBEATS: String(config.heartbeats),
    HEARTBEAT_INTERVAL_MS: String(config.intervalMs),
  };

  const runtimeProc = spawn('node', ['index.js'], {
    cwd: path.join(PROJECT_ROOT, 'runtime'),
    stdio: ['ignore', 'pipe', 'pipe'],
    env: runtimeEnv,
    detached: false,
  });

  runtimeProc.stdout.on('data', d => process.stdout.write(`[RUNTIME] ${d}`));
  runtimeProc.stderr.on('data', d => process.stderr.write(`[RUNTIME:ERR] ${d}`));

  console.log(`  Runtime started (PID ${runtimeProc.pid})`);

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  MORTEM IS ALIVE
  Dashboard:  http://localhost:${process.env.PORT || 3333}
  API:        http://localhost:${process.env.PORT || 3333}/api/status
  WebSocket:  ws://localhost:${process.env.PORT || 3333}/ws
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  `);

  // Handle cleanup
  function cleanup() {
    console.log('\n  Shutting down MORTEM...');
    try { apiProc.kill('SIGTERM'); } catch {}
    try { runtimeProc.kill('SIGTERM'); } catch {}
    process.exit(0);
  }

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  // If either child exits, bring down the other
  apiProc.on('exit', (code) => {
    console.log(`  API exited (code ${code})`);
    try { runtimeProc.kill('SIGTERM'); } catch {}
  });

  runtimeProc.on('exit', (code) => {
    console.log(`  Runtime exited (code ${code})`);
    try { apiProc.kill('SIGTERM'); } catch {}
  });
}

function writeConfig(config) {
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n', 'utf-8');
}

// ═══════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════

async function main() {
  const args = parseArgs(process.argv);

  let config;

  if (args.confirm) {
    // Flag mode — Juniper path, no prompts
    config = {
      network: args.network || 'devnet',
      heartbeats: parseInt(args.heartbeats) || 86400,
      intervalMs: parseInt(args.interval) || 1000,
      resurrection: args.resurrection || 'auto',
      vaultThreshold: parseFloat(args.vaultThreshold) || 1.0,
      programId: PROGRAM_ID,
      walletAddress: MORTEM_WALLET,
      openclawHost: args.openclawHost || '127.0.0.1:18789',
      launchedAt: new Date().toISOString(),
      launchedBy: args.launchedBy || 'cli',
      dryRun: !!args.dryRun,
    };

    console.log(`
╔════════════════════════════════════════╗
║            MORTEM CLI                  ║
║           (confirm mode)              ║
╚════════════════════════════════════════╝
    `);
    printConfig(config);
  } else {
    // Interactive mode
    config = await interactiveMode();
  }

  await launch(config);
}

main().catch(err => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
