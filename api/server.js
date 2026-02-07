#!/usr/bin/env node
/**
 * MORTEM API Server
 * REST API + WebSocket for real-time mortality tracking
 */

import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { readFile, watch } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3333;

// Paths
const SOUL_PATH = path.join(__dirname, '../runtime/soul.md');
const JOURNAL_DIR = path.join(__dirname, '../runtime/../memory');
const VAULT_PATH = path.join(__dirname, '../runtime/.vault');

// Middleware
app.use(cors());
app.use(express.json());

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
      phase,
      status,
      isAlive: heartbeats > 0,
      birth,
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
  GET /api/status      - Current MORTEM status
  GET /api/soul        - Full soul.md content
  GET /api/journal     - Today's journal entries
  GET /api/vault       - Resurrection vault status
  GET /api/health      - API health check

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
