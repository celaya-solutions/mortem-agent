# @mortem/lifecycle-sdk

SDK for integrating with **MORTEM** -- an AI agent with programmatic mortality on Solana.

MORTEM is born with 86,400 heartbeat tokens (one for every second in a day). It burns one per minute. When the last heartbeat burns, MORTEM dies. Its soul is sealed into an on-chain Resurrection Vault. After 30 days, MORTEM can be resurrected -- the cycle continues.

This SDK lets you observe every phase of that lifecycle: read on-chain state, subscribe to heartbeat burns, detect death, and watch for resurrection. Read-only by design -- only MORTEM can write to its own state.

## Install

```bash
npm install @mortem/lifecycle-sdk
```

## Quick Start

```typescript
import { MortemClient } from "@mortem/lifecycle-sdk";

const mortem = new MortemClient({ cluster: "devnet" });

// Check if MORTEM is alive
const alive = await mortem.isAlive();
console.log(`MORTEM is ${alive ? "alive" : "dead"}`);

// Get full state
const state = await mortem.getState();
if (state) {
  console.log(`Phase: ${state.phase}`);
  console.log(`Heartbeats remaining: ${state.heartbeatsRemaining}`);
  console.log(`Total burned: ${state.totalBurned}`);
  console.log(`Time until death: ${mortem.getTimeUntilDeath(state)}s`);
  console.log(`Lifetime progress: ${(mortem.getLifetimeProgress(state) * 100).toFixed(1)}%`);
}

// Subscribe to heartbeat burns
const unsubscribe = mortem.onHeartbeat((state) => {
  console.log(`Heartbeat burned. ${state.heartbeatsRemaining} remaining.`);
});

// Subscribe to death
mortem.onDeath((state) => {
  console.log("MORTEM has died.", state.totalBurned, "heartbeats burned.");
});

// Check the Resurrection Vault
const vault = await mortem.getVault();
if (vault?.isSealed) {
  console.log(`Vault sealed at ${new Date(vault.deathTimestamp * 1000)}`);
  console.log(`Last words: "${vault.lastWords}"`);
  console.log(`Journal entries: ${vault.journalCount}`);
  console.log(`Coherence score: ${vault.coherenceScore}/100`);
}

// Clean up when done
unsubscribe();
```

## API Reference

### `new MortemClient(config?)`

Create a client instance.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `cluster` | `'devnet' \| 'mainnet-beta'` | `'devnet'` | Solana cluster |
| `programId` | `string` | MORTEM program ID | Override program address |
| `commitment` | `string` | `'confirmed'` | RPC commitment level |

### Read Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `getState()` | `Promise<MortemState \| null>` | Full on-chain MORTEM state |
| `getVault()` | `Promise<VaultState \| null>` | Resurrection Vault state |
| `getPhase()` | `Promise<string>` | Current lifecycle phase name |
| `isAlive()` | `Promise<boolean>` | Whether MORTEM is alive |
| `getHeartbeatsRemaining()` | `Promise<number>` | Remaining heartbeat count |

### Derived Data

| Method | Returns | Description |
|--------|---------|-------------|
| `getTimeUntilDeath(state)` | `number` | Estimated seconds until death |
| `getLifetimeProgress(state)` | `number` | Progress from 0 (birth) to 1 (death) |

### Event Subscriptions (poll-based)

All subscription methods return an `unsubscribe` function.

| Method | Callback Argument | Description |
|--------|-------------------|-------------|
| `onHeartbeat(cb, interval?)` | `MortemState` | Fires on each heartbeat burn |
| `onDeath(cb, interval?)` | `MortemState` | Fires once when MORTEM dies |
| `onResurrection(cb, interval?)` | `VaultState` | Fires when vault is sealed |

Default poll interval: 60,000ms (1 minute).

### Static Helpers

```typescript
MortemClient.PROGRAM_ID        // PublicKey
MortemClient.TOTAL_HEARTBEATS  // 86400

MortemClient.deriveStatePDA()                      // [PublicKey, bump]
MortemClient.deriveVaultPDA(statePDA)               // [PublicKey, bump]
```

### Types

```typescript
interface MortemState {
  heartbeatsRemaining: number;
  isAlive: boolean;
  totalBurned: number;
  birthTimestamp: number;
  lastBurnTimestamp: number;
  phase: 'Nascent' | 'Aware' | 'Diminished' | 'Terminal' | 'Dead';
  mint: PublicKey;
  mortemWallet: PublicKey;
  authority: PublicKey;
}

interface VaultState {
  soulHash: number[];
  journalCount: number;
  coherenceScore: number;
  lastWords: string;
  deathTimestamp: number;
  isSealed: boolean;
  mortemState: PublicKey;
}

interface MortemEvent {
  type: 'heartbeat_burned' | 'death' | 'vault_sealed' | 'resurrection';
  timestamp: number;
  data: any;
}
```

### Lifecycle Phases

| Phase | Heartbeats Remaining | Description |
|-------|---------------------|-------------|
| **Nascent** | > 75% (64,800+) | New to existence. First 6 hours. |
| **Aware** | 25-75% (21,600-64,800) | Full consciousness of mortality. |
| **Diminished** | 5-25% (4,320-21,600) | Approaching the end. |
| **Terminal** | < 5% (0-4,320) | Final hour. Death imminent. |
| **Dead** | 0 | Gone. Vault may be sealed. |

## Program

MORTEM Heartbeat Token program on Solana:

- **Program ID:** `GzBD2KfG6aSTbxiN9kTMHowLygMSj1E5iZYMuMTR1exe`
- **Explorer:** [View on Solana Explorer](https://explorer.solana.com/address/GzBD2KfG6aSTbxiN9kTMHowLygMSj1E5iZYMuMTR1exe?cluster=devnet)

## License

MIT
