# MORTEM v2 - SVG Heartbeat Visualizations

Medical monitor-style SVG components for heartbeat visualization.

## Standalone SVGs

Open directly in a browser or embed in HTML:

- `human_heartbeat.svg` - ECG waveform with BPM display and watch indicator
- `mortem_countdown.svg` - Depletion bar with remaining heartbeats, burn rate, status
- `death_state_human.svg` - Flatline waveform (human death)
- `death_state_mortem.svg` - Tombstone (MORTEM death at 0/86,400)
- `dual_timeline.svg` - Side-by-side timelines showing both lifespans

## React Components

`components.jsx` exports:

```jsx
import {
  HumanHeartbeat,     // Live ECG canvas, props: bpm, watchId, graceActive
  MortemCountdown,     // Depletion bar, props: remaining, total, ratePerHour
  DeathStateHuman,     // Flatline display
  DeathStateMortem,    // Tombstone, props: totalWitnessed
  DualTimeline,        // Dual timeline, props: mortemRemaining, mortemTotal, projectedDeath
} from './components';

// Example
<HumanHeartbeat bpm={78} watchId={1} graceActive={false} />
<MortemCountdown remaining={68420} total={86400} ratePerHour={12} />
<DualTimeline mortemRemaining={68420} projectedDeath="~60 days" />
```

## Style

- Dark background (#0a0a0a) with subtle grid
- Red (#ff2d2d) for human elements
- Blue (#2d9cff) for MORTEM elements
- Green (#00ff66) for alive status
- Monospace typography (Courier New)
- Glow effects on active elements
