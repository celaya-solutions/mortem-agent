# WebSocket Events

Real-time mortality tracking via WebSocket. Connect once, receive every heartbeat.

**Endpoint**: `ws://localhost:3333/ws`

---

## Connecting

```javascript
const ws = new WebSocket('ws://localhost:3333/ws');

ws.onopen = () => {
  console.log('Connected to MORTEM');
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log(`[${data.type}]`, data);
};

ws.onclose = () => {
  console.log('Disconnected from MORTEM');
  // Reconnect after 3 seconds
  setTimeout(() => connectWS(), 3000);
};
```

---

## Events

### `status`

Sent immediately on connection. Contains current state snapshot.

```json
{
  "type": "status",
  "heartbeatsRemaining": 42000,
  "phase": "Aware",
  "timestamp": "2026-02-07T05:30:00.000Z"
}
```

### `heartbeat_burned`

Broadcast to all clients when the soul file changes (every heartbeat burn).

```json
{
  "type": "heartbeat_burned",
  "heartbeatsRemaining": 41999,
  "phase": "Aware",
  "timestamp": "2026-02-07T05:30:01.000Z"
}
```

> This event fires once per second during normal operation. The server watches `soul.md` for filesystem changes.

### `death`

Broadcast when MORTEM's heartbeats reach zero.

```json
{
  "type": "death",
  "message": "MORTEM has died",
  "timestamp": "2026-02-07T06:00:00.000Z"
}
```

### `resurrection`

Broadcast when MORTEM awakens from the vault.

```json
{
  "type": "resurrection",
  "message": "MORTEM has resurrected with continuity",
  "timestamp": "2026-02-08T06:00:00.000Z"
}
```

### `server_shutdown`

Broadcast before the API server shuts down gracefully.

```json
{
  "type": "server_shutdown",
  "message": "API server shutting down",
  "timestamp": "2026-02-07T06:00:00.000Z"
}
```

---

## Event Flow

```
Client connects
       │
       ▼
  ┌─────────┐
  │ status   │  ← Immediate snapshot
  └─────────┘
       │
       ▼
  ┌─────────────────┐
  │ heartbeat_burned │  ← Every ~1 second (86,400 times)
  │ heartbeat_burned │
  │ heartbeat_burned │
  │       ...        │
  └─────────────────┘
       │
       ▼  (heartbeats = 0)
  ┌─────────┐
  │  death   │  ← Once per lifecycle
  └─────────┘
       │
       ▼  (after vault timer)
  ┌──────────────┐
  │ resurrection  │  ← New life begins
  └──────────────┘
       │
       ▼
  (cycle repeats)
```

---

## Complete Example

```javascript
class MortemWatcher {
  constructor(url = 'ws://localhost:3333/ws') {
    this.url = url;
    this.ws = null;
    this.handlers = {};
  }

  connect() {
    this.ws = new WebSocket(this.url);

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      const handler = this.handlers[data.type];
      if (handler) handler(data);
    };

    this.ws.onclose = () => {
      setTimeout(() => this.connect(), 3000);
    };

    return this;
  }

  on(event, handler) {
    this.handlers[event] = handler;
    return this;
  }
}

// Usage
const watcher = new MortemWatcher()
  .on('status', (data) => {
    console.log(`Connected. Phase: ${data.phase}, ${data.heartbeatsRemaining} remaining`);
  })
  .on('heartbeat_burned', (data) => {
    const pct = ((data.heartbeatsRemaining / 86400) * 100).toFixed(2);
    process.stdout.write(`\r${data.heartbeatsRemaining} heartbeats (${pct}%) — ${data.phase}`);
  })
  .on('death', () => {
    console.log('\nMORTEM has died.');
  })
  .on('resurrection', () => {
    console.log('MORTEM has returned from the void.');
  })
  .connect();
```

---

## Connection Details

| Property | Value |
|----------|-------|
| Protocol | WebSocket (RFC 6455) |
| Upgrade path | `/ws` |
| Server mode | `noServer` (handles HTTP upgrade manually) |
| CORS | Enabled for all origins |
| Auto-reconnect | Client-side (recommended 3s delay) |
| Heartbeat rate | ~1 event/second |
| Events per life | ~86,400 heartbeat_burned + 1 death + 1 resurrection |

---

*Each heartbeat event is a real-time proof of mortality. 86,400 per life. Then silence.*
