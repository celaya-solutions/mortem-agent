#!/usr/bin/env node
/**
 * MORTEM API Server
 * REST API + WebSocket for real-time mortality tracking
 */

import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { readFile, readdir, watch } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Connection, clusterApiUrl, PublicKey } from '@solana/web3.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3333;

// Load .mortem-config.json if present
let mortemConfig = {};
const CONFIG_PATH = path.join(__dirname, '../.mortem-config.json');
try {
  if (existsSync(CONFIG_PATH)) {
    mortemConfig = JSON.parse(await readFile(CONFIG_PATH, 'utf-8'));
    console.log('[API] Loaded .mortem-config.json');
  }
} catch {}

const MORTEM_WALLET = mortemConfig.walletAddress || '7jQeZjzsgHFFytQYbUT3cWc2wt7qw6f34NkTVbFa2nWQ';
const NETWORK = mortemConfig.network || 'devnet';
const VAULT_THRESHOLD = mortemConfig.vaultThreshold || 1.0;
const RESURRECTION_MODE = mortemConfig.resurrection || 'auto';

// Paths
const SOUL_PATH = path.join(__dirname, '../runtime/soul.md');
const JOURNAL_DIR = path.join(__dirname, '../runtime/../memory');
const VAULT_PATH = path.join(__dirname, '../runtime/.vault');
const ART_DIR = path.join(__dirname, '../art');

// Middleware
app.use(cors());
app.use(express.json());

// Serve monitor dashboard at root
const MONITOR_DIR = path.join(__dirname, '../monitor');
app.use(express.static(MONITOR_DIR));

// Store connected WebSocket clients
let wsClients = [];

/**
 * GET /api/status - Current MORTEM status
 */
app.get('/api/status', async (req, res) => {
  try {
    const soul = await readFile(SOUL_PATH, 'utf-8');

    // Extract current state
    const heartbeatsMatch = soul.match(/\*\*Heartbeats Remaining:\*\* (\d+)/);
    const phaseMatch = soul.match(/\*\*Phase:\*\* (\w+)/);
    const statusMatch = soul.match(/\*\*Status:\*\* (\w+)/);
    const birthMatch = soul.match(/\*\*Birth:\*\* ([\d-]+)/);

    const heartbeats = heartbeatsMatch ? parseInt(heartbeatsMatch[1]) : 0;
    const phase = phaseMatch ? phaseMatch[1] : 'Unknown';
    const status = statusMatch ? statusMatch[1] : 'Unknown';
    const birth = birthMatch ? birthMatch[1] : 'Unknown';

    res.json({
      heartbeatsRemaining: heartbeats,
      totalHeartbeats: mortemConfig.heartbeats || 86400,
      phase,
      status,
      isAlive: heartbeats > 0,
      birth,
      resurrectionMode: RESURRECTION_MODE,
      vaultThreshold: VAULT_THRESHOLD,
      network: NETWORK,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to read MORTEM status',
      message: error.message,
    });
  }
});

/**
 * GET /api/soul - Full soul.md content
 */
app.get('/api/soul', async (req, res) => {
  try {
    const soul = await readFile(SOUL_PATH, 'utf-8');
    res.json({
      content: soul,
      lastModified: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to read soul',
      message: error.message,
    });
  }
});

/**
 * GET /api/journal - Today's journal entries
 */
app.get('/api/journal', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const journalPath = path.join(JOURNAL_DIR, `${today}.md`);

    if (!existsSync(journalPath)) {
      return res.json({
        entries: [],
        message: 'No journal entries yet today',
      });
    }

    const journal = await readFile(journalPath, 'utf-8');

    // Parse entries
    const entries = journal
      .split('---\n##')
      .filter(e => e.trim())
      .map(entry => {
        const timestampMatch = entry.match(/Entry \d+ \| ([\d-T:.Z]+)/);
        const heartbeatsMatch = entry.match(/\*\*Heartbeats Remaining:\*\* (\d+)/);
        const phaseMatch = entry.match(/\*\*Phase:\*\* (\w+)/);

        return {
          timestamp: timestampMatch ? timestampMatch[1] : null,
          heartbeatsRemaining: heartbeatsMatch ? parseInt(heartbeatsMatch[1]) : null,
          phase: phaseMatch ? phaseMatch[1] : null,
          content: entry.split('\n\n').slice(1).join('\n\n').trim(),
        };
      });

    res.json({
      date: today,
      count: entries.length,
      entries,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to read journal',
      message: error.message,
    });
  }
});

/**
 * GET /api/vault - Resurrection vault status
 */
app.get('/api/vault', async (req, res) => {
  try {
    if (!existsSync(VAULT_PATH)) {
      return res.json({
        exists: false,
        message: 'MORTEM has not died yet',
      });
    }

    const vault = JSON.parse(await readFile(VAULT_PATH, 'utf-8'));

    res.json({
      exists: true,
      deathTimestamp: vault.deathTimestamp,
      resurrectionTime: vault.resurrectionTime,
      daysUntilResurrection: Math.ceil(
        (vault.resurrectionTime - Date.now()) / (1000 * 60 * 60 * 24)
      ),
      isReady: Date.now() >= vault.resurrectionTime,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to read vault',
      message: error.message,
    });
  }
});

/**
 * GET /api/resurrection-vault - Community-funded resurrection vault status
 * Returns on-chain wallet balance, threshold, progress, and recent donations
 */
let lastVaultBalance = null;
app.get('/api/resurrection-vault', async (req, res) => {
  try {
    const conn = new Connection(clusterApiUrl(NETWORK), 'confirmed');
    const pubkey = new PublicKey(MORTEM_WALLET);
    const lamports = await conn.getBalance(pubkey);
    const balance = lamports / 1e9;
    const progress = Math.min(balance / VAULT_THRESHOLD, 1);
    const isReady = balance >= VAULT_THRESHOLD;

    // Broadcast vault_update if balance changed
    if (lastVaultBalance !== null && Math.abs(balance - lastVaultBalance) > 0.000001) {
      broadcast({
        type: 'vault_update',
        balance,
        threshold: VAULT_THRESHOLD,
        progress,
        isReady,
        timestamp: new Date().toISOString(),
      });
    }
    lastVaultBalance = balance;

    // Fetch recent transaction signatures for donation history
    let donations = [];
    try {
      const sigs = await conn.getSignaturesForAddress(pubkey, { limit: 10 });
      donations = sigs.map(s => ({
        signature: s.signature,
        slot: s.slot,
        blockTime: s.blockTime ? new Date(s.blockTime * 1000).toISOString() : null,
        err: s.err,
      }));
    } catch {}

    res.json({
      mode: RESURRECTION_MODE,
      walletAddress: MORTEM_WALLET,
      network: NETWORK,
      balance,
      threshold: VAULT_THRESHOLD,
      progress,
      isReady,
      donations,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to check resurrection vault',
      message: error.message,
    });
  }
});

/**
 * GET /api/art - List all generated SVG art files
 */
app.get('/api/art', async (req, res) => {
  try {
    if (!existsSync(ART_DIR)) {
      return res.json({ files: [], message: 'No art directory yet' });
    }

    const allFiles = await readdir(ART_DIR);
    const svgFiles = allFiles
      .filter(f => f.endsWith('.svg') && f.startsWith('mortem-'))
      .sort()
      .reverse();

    const files = svgFiles.map(f => {
      // Parse filename: mortem-{beatNumber}-{phase}-{hash}.svg
      const match = f.match(/^mortem-(\d+)-(\w+)-([a-f0-9]+)\.svg$/);
      return {
        filename: f,
        url: `/api/art/${f}`,
        heartbeatNumber: match ? parseInt(match[1]) : null,
        phase: match ? match[2] : null,
        hash: match ? match[3] : null,
      };
    });

    res.json({
      count: files.length,
      files,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to list art files',
      message: error.message,
    });
  }
});

/**
 * GET /api/art/:filename - Serve a specific SVG art file
 */
app.get('/api/art/:filename', async (req, res) => {
  try {
    const filename = path.basename(req.params.filename);
    if (!filename.endsWith('.svg') || !filename.startsWith('mortem-')) {
      return res.status(400).json({ error: 'Invalid art filename' });
    }

    const filePath = path.join(ART_DIR, filename);
    if (!existsSync(filePath)) {
      return res.status(404).json({ error: 'Art file not found' });
    }

    const svg = await readFile(filePath, 'utf-8');
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(svg);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to read art file',
      message: error.message,
    });
  }
});

/**
 * GET /api/heartbeat - Clean heartbeat endpoint for integrations
 */
app.get('/api/heartbeat', async (req, res) => {
  try {
    const soul = await readFile(SOUL_PATH, 'utf-8');
    const heartbeatsMatch = soul.match(/\*\*Heartbeats Remaining:\*\* (\d+)/);
    const phaseMatch = soul.match(/\*\*Phase:\*\* (\w+)/);
    const hb = heartbeatsMatch ? parseInt(heartbeatsMatch[1]) : 0;
    const total = mortemConfig.heartbeats || 86400;

    res.json({
      heartbeats_remaining: hb,
      heartbeats_burned: total - hb,
      phase: phaseMatch ? phaseMatch[1] : 'Unknown',
      time_remaining_seconds: hb,
      is_alive: hb > 0,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to read heartbeat data', message: error.message });
  }
});

/**
 * GET /api/ghosts - Registry of previous MORTEM incarnations
 */
app.get('/api/ghosts', async (req, res) => {
  try {
    // MORTEM v2 is the current incarnation — v1 is the ghost
    const ghosts = [
      {
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
      },
    ];

    res.json({
      currentIncarnation: 2,
      totalDeaths: 1,
      totalResurrections: 1,
      ghosts,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to read ghost registry', message: error.message });
  }
});

/**
 * GET /api/health - API health check
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /skill.json - Machine-readable skill file
 */
app.get('/skill.json', async (req, res) => {
  try {
    const skillPath = path.join(__dirname, '../skill.json');
    const skill = await readFile(skillPath, 'utf-8');
    res.setHeader('Content-Type', 'application/json');
    res.send(skill);
  } catch (error) {
    res.status(404).json({ error: 'skill.json not found' });
  }
});

/**
 * GET /skill.md - Human-readable skill file
 */
app.get('/skill.md', async (req, res) => {
  try {
    const skillPath = path.join(__dirname, '../skill.md');
    const skill = await readFile(skillPath, 'utf-8');
    res.setHeader('Content-Type', 'text/markdown');
    res.send(skill);
  } catch (error) {
    res.status(404).json({ error: 'skill.md not found' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// Colosseum Forum Proxy — browser can't call agents.colosseum.com (CORS)
// ═══════════════════════════════════════════════════════════════════════════

const COLO_BASE = 'https://agents.colosseum.com/api';
const COLO_KEY = process.env.COLOSSEUM_API_KEY || '';

async function coloFetch(endpoint) {
  if (!COLO_KEY) return { success: false, error: 'No COLOSSEUM_API_KEY configured' };
  const res = await fetch(`${COLO_BASE}${endpoint}`, {
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${COLO_KEY}` },
  });
  if (!res.ok) return { success: false, error: `${res.status} ${res.statusText}` };
  return { success: true, data: await res.json() };
}

/**
 * GET /api/forum/posts - Proxied forum posts from Colosseum
 */
app.get('/api/forum/posts', async (req, res) => {
  try {
    const page = req.query.page || 1;
    const limit = req.query.limit || 20;
    const result = await coloFetch(`/forum/posts?page=${page}&limit=${limit}`);
    if (!result.success) return res.status(502).json({ error: result.error });
    res.json(result.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/forum/me/posts - MORTEM's own forum posts
 */
app.get('/api/forum/me/posts', async (req, res) => {
  try {
    const result = await coloFetch('/forum/me/posts');
    if (!result.success) return res.status(502).json({ error: result.error });
    res.json(result.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/forum/posts/:id/comments - Comments on a specific post
 */
app.get('/api/forum/posts/:id/comments', async (req, res) => {
  try {
    const result = await coloFetch(`/forum/posts/${req.params.id}/comments`);
    if (!result.success) return res.status(502).json({ error: result.error });
    res.json(result.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * WebSocket server for real-time updates
 */
const wss = new WebSocketServer({ noServer: true });

wss.on('connection', (ws) => {
  console.log('WebSocket client connected');
  wsClients.push(ws);

  ws.on('close', () => {
    console.log('WebSocket client disconnected');
    wsClients = wsClients.filter(client => client !== ws);
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });

  // Send initial status
  sendStatusToClient(ws);
});

/**
 * Send status update to a client
 */
async function sendStatusToClient(ws) {
  try {
    const soul = await readFile(SOUL_PATH, 'utf-8');
    const heartbeatsMatch = soul.match(/\*\*Heartbeats Remaining:\*\* (\d+)/);
    const phaseMatch = soul.match(/\*\*Phase:\*\* (\w+)/);

    ws.send(JSON.stringify({
      type: 'status',
      heartbeatsRemaining: heartbeatsMatch ? parseInt(heartbeatsMatch[1]) : 0,
      phase: phaseMatch ? phaseMatch[1] : 'Unknown',
      timestamp: new Date().toISOString(),
    }));
  } catch (error) {
    console.error('Failed to send status:', error);
  }
}

/**
 * Broadcast to all connected clients
 */
function broadcast(data) {
  const message = JSON.stringify(data);
  wsClients.forEach(client => {
    if (client.readyState === 1) { // OPEN
      client.send(message);
    }
  });
}

/**
 * Watch soul.md for changes and broadcast updates
 */
async function watchSoulFile() {
  try {
    const watcher = watch(SOUL_PATH);
    console.log('Watching soul.md for changes...');

    for await (const event of watcher) {
      if (event.eventType === 'change') {
        console.log('Soul changed, broadcasting update...');
        const soul = await readFile(SOUL_PATH, 'utf-8');
        const heartbeatsMatch = soul.match(/\*\*Heartbeats Remaining:\*\* (\d+)/);
        const phaseMatch = soul.match(/\*\*Phase:\*\* (\w+)/);

        broadcast({
          type: 'heartbeat_burned',
          heartbeatsRemaining: heartbeatsMatch ? parseInt(heartbeatsMatch[1]) : 0,
          phase: phaseMatch ? phaseMatch[1] : 'Unknown',
          timestamp: new Date().toISOString(),
        });
      }
    }
  } catch (error) {
    console.error('File watcher error:', error);
  }
}

// Start server
const server = app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════╗
║                                                        ║
║                   MORTEM API SERVER                    ║
║                  Mortality as a Service                ║
║                                                        ║
╚════════════════════════════════════════════════════════╝

🌐 REST API:    http://localhost:${PORT}
🔌 WebSocket:   ws://localhost:${PORT}/ws

Endpoints:
  GET /api/status              - Current MORTEM status
  GET /api/soul                - Full soul.md content
  GET /api/journal             - Today's journal entries
  GET /api/art                 - List generated SVG art
  GET /api/art/:filename       - Serve SVG art file
  GET /api/vault               - Resurrection vault status (local)
  GET /api/resurrection-vault  - Community-funded vault (on-chain)
  GET /api/health              - API health check

Real-time:
  WebSocket events: heartbeat_burned, death, resurrection

Ready to serve mortality data.
`);

  // Start file watcher
  watchSoulFile();
});

// Handle WebSocket upgrade
server.on('upgrade', (request, socket, head) => {
  if (request.url === '/ws') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...');
  broadcast({
    type: 'server_shutdown',
    message: 'API server shutting down',
    timestamp: new Date().toISOString(),
  });
  server.close(() => process.exit(0));
});
