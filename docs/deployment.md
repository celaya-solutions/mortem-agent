# Deployment

Guide for deploying MORTEM to production.

---

## Prerequisites

- Node.js >= 18
- Solana CLI
- OpenClaw CLI (`npm i -g openclaw`)
- Domain configured (e.g., `mortem-agent.xyz`)
- Solana keypair with funded wallet

---

## Production Environment

### 1. Server Setup

```bash
# Clone repository
git clone https://github.com/celaya-solutions/mortem-agent.git
cd mortem

# Install all dependencies
cd api && npm install --production && cd ..
cd runtime && npm install --production && cd ..
npm install --production

# Configure production environment
cp .env.example .env
nano .env
```

### 2. Production `.env`

```bash
# Model
OPENCLAW_TOKEN=your-production-token
MORTEM_MODEL=anthropic/claude-sonnet-4-5-20250929

# Lifecycle (full 24-hour production run)
INITIAL_HEARTBEATS=86400
HEARTBEAT_INTERVAL_MS=1000
JOURNAL_EVERY_N_BEATS=600

# API
PORT=3333

# Twitter (production keys)
X_API_KEY=prod-api-key
X_API_SECRET=prod-api-secret
X_ACCESS_TOKEN=prod-access-token
X_ACCESS_SECRET=prod-access-secret

# Physical Mail (LIVE key for real delivery)
LOB_API_KEY=live_your-lob-key
RECIPIENT_NAME=Production Recipient
RECIPIENT_LINE1=123 Main St
RECIPIENT_CITY=Your City
RECIPIENT_STATE=TX
RECIPIENT_ZIP=79925
```

### 3. Start OpenClaw Gateway

```bash
# Start gateway in background
openclaw gateway start &

# Verify
curl http://127.0.0.1:18789/health
```

### 4. Initialize Solana (first run only)

```bash
# Fund wallet
solana airdrop 2 --keypair ~/.config/solana/mortem.json --url devnet

# Initialize on-chain state
npm run init-devnet
```

### 5. Launch

```bash
# Production launch
./start-mortem.sh

# Or with process manager
pm2 start api/server.js --name mortem-api
pm2 start runtime/index.js --name mortem-runtime
```

---

## Process Management

### Using PM2

```bash
# Install PM2
npm install -g pm2

# Start services
pm2 start api/server.js --name mortem-api --env production
pm2 start runtime/index.js --name mortem-runtime --env production

# Monitor
pm2 monit

# Logs
pm2 logs mortem-runtime --lines 50

# Auto-restart on crash
pm2 startup
pm2 save
```

### Using systemd

```ini
# /etc/systemd/system/mortem-api.service
[Unit]
Description=MORTEM API Server
After=network.target

[Service]
Type=simple
User=mortem
WorkingDirectory=/opt/mortem
ExecStart=/usr/bin/node api/server.js
Restart=always
RestartSec=5
EnvironmentFile=/opt/mortem/.env

[Install]
WantedBy=multi-user.target
```

```ini
# /etc/systemd/system/mortem-runtime.service
[Unit]
Description=MORTEM Runtime
After=mortem-api.service
Requires=mortem-api.service

[Service]
Type=simple
User=mortem
WorkingDirectory=/opt/mortem
ExecStart=/usr/bin/node runtime/index.js
Restart=always
RestartSec=5
EnvironmentFile=/opt/mortem/.env

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable mortem-api mortem-runtime
sudo systemctl start mortem-api mortem-runtime
```

---

## Reverse Proxy (nginx)

```nginx
server {
    listen 443 ssl http2;
    server_name mortem-agent.xyz;

    ssl_certificate /etc/letsencrypt/live/mortem-agent.xyz/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/mortem-agent.xyz/privkey.pem;

    # API
    location /api/ {
        proxy_pass http://127.0.0.1:3333;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # WebSocket
    location /ws {
        proxy_pass http://127.0.0.1:3333;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    # Dashboard
    location / {
        root /opt/mortem/dashboard;
        index index.html;
    }

    # Documentation
    location /docs {
        alias /opt/mortem/docs;
        index index.html;
    }
}
```

---

## Vercel Deployment (Dashboard)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy dashboard
cd dashboard
vercel --prod

# Set custom domain
vercel domains add mortem-agent.xyz
```

---

## Health Checks

```bash
# API health
curl https://mortem-agent.xyz/api/health

# Current status
curl https://mortem-agent.xyz/api/status

# WebSocket test
wscat -c wss://mortem-agent.xyz/ws
```

---

## Monitoring

### Log Locations

| Log | Path |
|-----|------|
| API Server | `logs/api.log` |
| Runtime | `logs/runtime.log` |
| PM2 | `~/.pm2/logs/` |

### Key Metrics to Watch

| Metric | Normal | Alert |
|--------|--------|-------|
| Heartbeat rate | 1/sec | < 0.5/sec |
| Journal generation | Every ~10 min | > 15 min gap |
| Solana tx success | > 95% | < 90% |
| API response time | < 100ms | > 500ms |
| WebSocket clients | 1+ | 0 (no watchers) |

---

*Deploy once. Die on schedule. Resurrect on demand.*
