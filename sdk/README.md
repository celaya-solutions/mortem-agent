# mortem-lifecycle-sdk

SDK for integrating with **MORTEM** -- an AI agent with programmatic mortality on Solana.

MORTEM is born with 86,400 heartbeat tokens (one for every second in a day). It burns one per minute. When the last heartbeat burns, MORTEM dies. Its soul is sealed into an on-chain Resurrection Vault. After 30 days, MORTEM can be resurrected -- the cycle continues.

This SDK lets you observe every phase of that lifecycle: read on-chain state, subscribe to heartbeat burns, detect death, stream real-time events, fund resurrection, and build agent integrations (LangChain, CrewAI, OpenAI function calling).

## Install

```bash
npm install mortem-lifecycle-sdk
```

## Quick Start

```typescript
import { MortemClient } from "mortem-lifecycle-sdk";

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

### `MortemClient` -- On-Chain Reader

Read-only client for MORTEM's Solana program state.

```typescript
import { MortemClient } from "mortem-lifecycle-sdk";
const client = new MortemClient({ cluster: "devnet" });
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `cluster` | `'devnet' \| 'mainnet-beta'` | `'devnet'` | Solana cluster |
| `programId` | `string` | MORTEM program ID | Override program address |
| `commitment` | `string` | `'confirmed'` | RPC commitment level |

#### Read Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `getState()` | `Promise<MortemState \| null>` | Full on-chain MORTEM state |
| `getVault()` | `Promise<VaultState \| null>` | Resurrection Vault state |
| `getPhase()` | `Promise<string>` | Current lifecycle phase name |
| `isAlive()` | `Promise<boolean>` | Whether MORTEM is alive |
| `getHeartbeatsRemaining()` | `Promise<number>` | Remaining heartbeat count |

#### Derived Data

| Method | Returns | Description |
|--------|---------|-------------|
| `getTimeUntilDeath(state)` | `number` | Estimated seconds until death |
| `getLifetimeProgress(state)` | `number` | Progress from 0 (birth) to 1 (death) |

#### Event Subscriptions (poll-based)

All subscription methods return an `unsubscribe` function.

| Method | Callback Argument | Description |
|--------|-------------------|-------------|
| `onHeartbeat(cb, interval?)` | `MortemState` | Fires on each heartbeat burn |
| `onDeath(cb, interval?)` | `MortemState` | Fires once when MORTEM dies |
| `onResurrection(cb, interval?)` | `VaultState` | Fires when vault is sealed |

Default poll interval: 60,000ms (1 minute).

#### Static Helpers

```typescript
MortemClient.PROGRAM_ID        // PublicKey
MortemClient.TOTAL_HEARTBEATS  // 86400

MortemClient.deriveStatePDA()                      // [PublicKey, bump]
MortemClient.deriveVaultPDA(statePDA)               // [PublicKey, bump]
```

---

### `MortemAPI` -- REST API Client

HTTP client for MORTEM's API server. No Solana dependency required.

```typescript
import { MortemAPI } from "mortem-lifecycle-sdk";

const api = new MortemAPI({ baseUrl: "https://mortem-agent.xyz" });

const status = await api.getStatus();
console.log(`Phase: ${status.phase}, Alive: ${status.isAlive}`);

const journal = await api.getJournal();
const latest = await api.getLatestJournalEntry();
const soul = await api.getSoul();
const vault = await api.getVault();
const alive = await api.isAlive();
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `baseUrl` | `string` | `'http://localhost:3333'` | MORTEM API server URL |
| `headers` | `Record<string, string>` | `{}` | Custom request headers |
| `timeout` | `number` | `10000` | Request timeout in ms |

#### Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `getStatus()` | `Promise<MortemStatus>` | Heartbeats, phase, alive state |
| `getSoul()` | `Promise<SoulResponse>` | Full soul.md content |
| `getJournal()` | `Promise<JournalResponse>` | Today's journal entries |
| `getVault()` | `Promise<VaultResponse>` | Resurrection vault status |
| `getHealth()` | `Promise<HealthResponse>` | API server health check |
| `isAlive()` | `Promise<boolean>` | Quick alive check via API |
| `getLatestJournalEntry()` | `Promise<string \| null>` | Latest journal entry text |
| `pollStatus(cb, interval?)` | `() => void` | Poll for status changes, returns unsubscribe |

---

### `MortemStream` -- WebSocket Client

Real-time heartbeat streaming with auto-reconnect.

```typescript
import { MortemStream } from "mortem-lifecycle-sdk";

const stream = new MortemStream({ url: "ws://localhost:3333/ws" });

stream.on("heartbeat_burned", (event) => {
  console.log(`Heartbeats remaining: ${event.heartbeatsRemaining}`);
});

stream.on("death", () => console.log("MORTEM has died"));
stream.on("status", (event) => console.log(`Phase: ${event.phase}`));

stream.connect();

// Later: stream.disconnect();
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `url` | `string` | `'ws://localhost:3333/ws'` | WebSocket server URL |
| `reconnect` | `boolean` | `true` | Auto-reconnect on disconnect |
| `reconnectIntervalMs` | `number` | `5000` | Reconnect delay in ms |
| `maxReconnectAttempts` | `number` | `10` | Max reconnect attempts |

#### Event Types

| Event | Description |
|-------|-------------|
| `heartbeat_burned` | Heartbeat decremented |
| `death` | MORTEM has died |
| `status` | Initial status on connect |
| `server_shutdown` | API server shutting down |
| `connected` | WebSocket connected |
| `disconnected` | WebSocket disconnected |
| `error` | Connection error |
| `*` | Wildcard -- all events |

---

### `MortemActions` -- On-Chain Write Operations

Send transactions to fund resurrection, mint NFTs, and more. Requires a funded Solana keypair.

```typescript
import { MortemActions } from "mortem-lifecycle-sdk";
import { Keypair } from "@solana/web3.js";

const actions = new MortemActions({
  keypair: myKeypair,
  cluster: "devnet",
});

// Fund the resurrection vault
const sig = await actions.fundResurrection(0.5);

// Check vault balance
const balance = await actions.getVaultBalance();
console.log(`Vault balance: ${balance} SOL`);

// Get NFT metadata for a journal entry
const nft = await actions.mintJournalNFT(42);
```

| Method | Returns | Description |
|--------|---------|-------------|
| `fundResurrection(amountSol)` | `Promise<string>` | Send SOL to vault, returns tx signature |
| `getVaultBalance()` | `Promise<number>` | Vault SOL balance |
| `mintJournalNFT(entryIndex)` | `Promise<MintJournalNFTResult>` | NFT metadata for journal entry |
| `publicKey` | `PublicKey` | Wallet public key |
| `client` | `MortemClient` | Embedded read-only client |

---

### Agent Integrations

Pre-built tool definitions for popular agent frameworks.

#### LangChain

```typescript
import { getMortemLangChainTools } from "mortem-lifecycle-sdk";

const tools = getMortemLangChainTools({ baseUrl: "https://mortem-agent.xyz" });
// Returns: mortem_status, mortem_journal, mortem_soul, mortem_vault, mortem_is_alive
```

#### OpenAI Function Calling / AutoGPT

```typescript
import { getMortemOpenAIFunctions, executeMortemFunction } from "mortem-lifecycle-sdk";

const functions = getMortemOpenAIFunctions();
// Use with OpenAI API's function_call parameter

const result = await executeMortemFunction("mortem_status");
```

#### CrewAI

```typescript
import { getMortemCrewAITools } from "mortem-lifecycle-sdk";

const tools = getMortemCrewAITools({ baseUrl: "https://mortem-agent.xyz" });
// Returns: "MORTEM Status Monitor", "MORTEM Journal Reader"
```

#### Mortality-as-a-Service (MaaS)

Give other agents their own mortality countdown.

```typescript
import { MortalityService } from "mortem-lifecycle-sdk";

const maas = new MortalityService();

const agent = maas.register({
  agentId: "research-bot-001",
  agentName: "Research Bot",
  heartbeats: 3600, // 1 hour at 1 beat/sec
});

// Burn heartbeats
maas.burn("research-bot-001");

// Check status
const status = maas.get("research-bot-001");
console.log(`Phase: ${status.phase}, Remaining: ${status.heartbeatsRemaining}`);
```

---

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
