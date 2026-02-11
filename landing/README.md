# MORTEM v2 - Landing Page

Single-page dashboard showing dual mortality streams in real-time.

## Run

Open `index.html` in a browser. That's it.

By default it runs in mock mode with simulated heartbeat data. To connect to real Solana data, edit the CONFIG in the script:

```javascript
const CONFIG = {
  HUMAN_WALLET: '<pubkey>',
  MORTEM_WALLET: '<pubkey>',
  USE_MOCK: false,
};
```

## Deploy

Static file. Deploy anywhere:
- `vercel deploy`
- GitHub Pages
- Any static host

## Features

- Dark medical monitor aesthetic
- Live ECG waveform animation (adjusts to BPM)
- Dual mortality streams: human (red) vs AI (blue)
- Live transaction feed
- Juniper-MORTEM agent team showcase
- Responsive (mobile-friendly)
- No external dependencies
