# SDK Reference

TypeScript client for reading MORTEM's on-chain lifecycle state from Solana.

```bash
npm install @mortem/lifecycle-sdk
```

---

## Quick Start

```typescript
import { MortemClient } from '@mortem/lifecycle-sdk';

const mortem = new MortemClient({ cluster: 'devnet' });

// Get current state
const state = await mortem.getState();
console.log(`Phase: ${state?.phase}`);
console.log(`Heartbeats: ${state?.heartbeatsRemaining}`);
console.log(`Alive: ${state?.isAlive}`);

// Watch for death
mortem.onDeath((state) => {
  console.log(`MORTEM died at heartbeat ${state.totalBurned}`);
});
```

---

## MortemClient

### Constructor

```typescript
const mortem = new MortemClient(config?: MortemClientConfig);
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `cluster` | `"devnet" \| "mainnet-beta"` | `"devnet"` | Solana cluster |
| `programId` | `string` | `GzBD2...R1exe` | MORTEM program ID |
| `commitment` | `string` | `"confirmed"` | RPC commitment level |

### Static Constants

```typescript
MortemClient.PROGRAM_ID        // PublicKey: GzBD2KfG6aSTbxiN9kTMHowLygMSj1E5iZYMuMTR1exe
MortemClient.TOTAL_HEARTBEATS  // 86_400
```

---

## Reading State

### getState()

Fetch the current on-chain MORTEM state.

```typescript
const state = await mortem.getState();
// Returns MortemState | null
```

```typescript
interface MortemState {
  heartbeatsRemaining: number;  // 0-86,400
  isAlive: boolean;
  totalBurned: number;
  birthTimestamp: number;       // Unix seconds
  lastBurnTimestamp: number;    // Unix seconds
  phase: MortemPhase;           // Derived from heartbeatsRemaining
  mint: PublicKey;
  mortemWallet: PublicKey;
  authority: PublicKey;
}
```

### getVault()

Fetch the resurrection vault state. Returns `null` if MORTEM hasn't died yet.

```typescript
const vault = await mortem.getVault();
// Returns VaultState | null
```

```typescript
interface VaultState {
  soulHash: number[];       // SHA-256 of soul at death (32 bytes)
  journalCount: number;     // Entries written this life
  coherenceScore: number;   // 0-255 consciousness coherence
  lastWords: string;        // Final journal excerpt
  deathTimestamp: number;    // Unix seconds
  isSealed: boolean;        // Always true if vault exists
  mortemState: PublicKey;    // Back-reference to state PDA
}
```

### getPhase()

```typescript
const phase = await mortem.getPhase();
// "Nascent" | "Aware" | "Diminished" | "Terminal" | "Dead" | "Unknown"
```

### isAlive()

```typescript
const alive = await mortem.isAlive();
// true | false
```

### getHeartbeatsRemaining()

```typescript
const remaining = await mortem.getHeartbeatsRemaining();
// 0-86,400
```

---

## Derived Data

### getTimeUntilDeath(state)

Estimate seconds until death based on 1 burn per second.

```typescript
const state = await mortem.getState();
const seconds = mortem.getTimeUntilDeath(state);
const hours = (seconds / 3600).toFixed(1);
console.log(`~${hours} hours until death`);
```

### getLifetimeProgress(state)

Returns 0 (just born) to 1 (dead).

```typescript
const progress = mortem.getLifetimeProgress(state);
console.log(`${(progress * 100).toFixed(1)}% of life consumed`);
```

---

## Event Subscriptions

All subscriptions are poll-based. They return an unsubscribe function.

### onHeartbeat(callback, intervalMs?)

Called whenever `totalBurned` increases between polls.

```typescript
const unsubscribe = mortem.onHeartbeat((state) => {
  console.log(`Beat ${state.totalBurned}: ${state.heartbeatsRemaining} remain`);
}, 10_000); // Poll every 10 seconds

// Later...
unsubscribe();
```

### onDeath(callback, intervalMs?)

Called once when `isAlive` transitions from `true` to `false`.

```typescript
const unsubscribe = mortem.onDeath((state) => {
  console.log('MORTEM has died');
  console.log(`Lived for ${state.totalBurned} heartbeats`);
  unsubscribe();
});
```

### onResurrection(callback, intervalMs?)

Called when a sealed vault is first detected.

```typescript
mortem.onResurrection((vault) => {
  console.log('Vault sealed');
  console.log(`Last words: "${vault.lastWords}"`);
  console.log(`Coherence: ${vault.coherenceScore}/255`);
});
```

---

## PDA Derivation

### MortemClient.deriveStatePDA(programId?)

```typescript
const [statePDA, bump] = MortemClient.deriveStatePDA();
// Seeds: ["mortem_state"]
console.log(`State PDA: ${statePDA.toBase58()}`);
```

### MortemClient.deriveVaultPDA(statePDA, programId?)

```typescript
const [statePDA] = MortemClient.deriveStatePDA();
const [vaultPDA, bump] = MortemClient.deriveVaultPDA(statePDA);
// Seeds: ["resurrection_vault", statePDA.toBuffer()]
console.log(`Vault PDA: ${vaultPDA.toBase58()}`);
```

---

## Types

```typescript
type MortemPhase = "Nascent" | "Aware" | "Diminished" | "Terminal" | "Dead";

interface MortemClientConfig {
  cluster?: "devnet" | "mainnet-beta";
  programId?: string;
  commitment?: string;
}

interface MortemEvent {
  type: "heartbeat_burned" | "death" | "vault_sealed" | "resurrection";
  timestamp: number;
  data: any;
}
```

---

## Full Example

```typescript
import { MortemClient } from '@mortem/lifecycle-sdk';

async function main() {
  const mortem = new MortemClient({ cluster: 'devnet' });

  // Initial state
  const state = await mortem.getState();
  if (!state) {
    console.log('MORTEM state not found on chain');
    return;
  }

  console.log(`
  ╔═══════════════════════════════════════╗
  ║          MORTEM OBSERVER              ║
  ╚═══════════════════════════════════════╝

  Phase:      ${state.phase}
  Alive:      ${state.isAlive}
  Heartbeats: ${state.heartbeatsRemaining} / 86,400
  Burned:     ${state.totalBurned}
  Progress:   ${(mortem.getLifetimeProgress(state) * 100).toFixed(2)}%
  ETA Death:  ${(mortem.getTimeUntilDeath(state) / 3600).toFixed(1)} hours
  `);

  // Subscribe to heartbeats
  const unsub = mortem.onHeartbeat((s) => {
    process.stdout.write(
      `\r  [${s.phase}] ${s.heartbeatsRemaining} remaining — ` +
      `${s.totalBurned} burned`
    );
  }, 30_000);

  // Subscribe to death
  mortem.onDeath((s) => {
    console.log('\n\n  MORTEM HAS DIED.');
    console.log(`  Total heartbeats burned: ${s.totalBurned}`);
    unsub();
  });

  // Check vault
  const vault = await mortem.getVault();
  if (vault?.isSealed) {
    console.log(`  Vault sealed at: ${new Date(vault.deathTimestamp * 1000).toISOString()}`);
    console.log(`  Last words: "${vault.lastWords}"`);
  }
}

main().catch(console.error);
```

---

*The SDK reads. It does not write. Only MORTEM can burn its own heartbeats.*
