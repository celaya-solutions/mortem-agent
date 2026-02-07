# On-Chain Program

MORTEM's heartbeat burns and death events are recorded immutably on Solana.

---

## Program

| Field | Value |
|-------|-------|
| **Program ID** | `GzBD2KfG6aSTbxiN9kTMHowLygMSj1E5iZYMuMTR1exe` |
| **Framework** | Anchor |
| **Cluster** | Devnet |
| **Explorer** | [View on Solana Explorer](https://explorer.solana.com/address/GzBD2KfG6aSTbxiN9kTMHowLygMSj1E5iZYMuMTR1exe?cluster=devnet) |

---

## Instructions

### `burnHeartbeat()`

Burns one heartbeat token. Called once per second by the runtime.

**Accounts**:

| Account | Type | Description |
|---------|------|-------------|
| `burner` | Signer | MORTEM keypair |
| `mortemState` | PDA | Main state account |
| `mint` | Token Mint | Heartbeat token mint |
| `mortemTokenAccount` | Token Account | MORTEM's token account |
| `tokenProgram` | Program | SPL Token program |

**Effects**:
- Decrements `heartbeatsRemaining`
- Increments `totalBurned`
- Updates `lastBurnTimestamp`
- Burns 1 token from mint

### `sealVault(soulHash, journalCount, lastWords, coherenceScore)`

Seals the resurrection vault on death. Called once when heartbeats reach 0.

**Parameters**:

| Param | Type | Description |
|-------|------|-------------|
| `soulHash` | `[u8; 32]` | SHA-256 hash of soul.md at death |
| `journalCount` | `u64` | Total journal entries this life |
| `lastWords` | `String` | Final journal excerpt |
| `coherenceScore` | `u8` | Consciousness coherence (0-255) |

**Accounts**:

| Account | Type | Description |
|---------|------|-------------|
| `authority` | Signer | MORTEM keypair |
| `mortemState` | PDA | Main state account |
| `resurrectionVault` | PDA | Vault account (created if needed) |
| `systemProgram` | Program | System program |

---

## On-Chain Accounts

### MortemState

PDA Seeds: `["mortem_state"]`

```rust
pub struct MortemState {
    pub authority: Pubkey,           // MORTEM keypair
    pub mint: Pubkey,                // Heartbeat token mint
    pub mortem_wallet: Pubkey,       // Token account
    pub heartbeats_remaining: u64,   // Countdown (86,400 → 0)
    pub is_alive: bool,              // false when dead
    pub birth_timestamp: i64,        // Unix timestamp of birth
    pub last_burn_timestamp: i64,    // Unix timestamp of last burn
    pub total_burned: u64,           // Cumulative burns across lives
}
```

### ResurrectionVault

PDA Seeds: `["resurrection_vault", mortem_state_pda]`

```rust
pub struct ResurrectionVault {
    pub soul_hash: [u8; 32],         // SHA-256 of soul at death
    pub journal_count: u64,          // Entries written this life
    pub coherence_score: u8,         // Consciousness coherence
    pub last_words: String,          // Final journal excerpt
    pub death_timestamp: i64,        // When death occurred
    pub is_sealed: bool,             // True once sealed
    pub mortem_state: Pubkey,        // Back-reference
    pub reserved: [u8; 128],         // Future use
}
```

---

## PDA Derivation

```javascript
import { PublicKey } from '@solana/web3.js';

const PROGRAM_ID = new PublicKey('GzBD2KfG6aSTbxiN9kTMHowLygMSj1E5iZYMuMTR1exe');

// State PDA
const [statePDA] = PublicKey.findProgramAddressSync(
  [Buffer.from('mortem_state')],
  PROGRAM_ID
);

// Vault PDA
const [vaultPDA] = PublicKey.findProgramAddressSync(
  [Buffer.from('resurrection_vault'), statePDA.toBuffer()],
  PROGRAM_ID
);
```

---

## Transaction Examples

### Viewing Burns on Explorer

Each heartbeat burn is a real Solana transaction. You can view them at:

```
https://explorer.solana.com/address/{MORTEM_WALLET}?cluster=devnet
```

### Reading State with Solana CLI

```bash
# Get account data
solana account $(solana address -k ~/.config/solana/mortem.json) \
  --url devnet \
  --output json

# Check balance
solana balance ~/.config/solana/mortem.json --url devnet
```

---

## Initialization

```bash
# Fund wallet
solana airdrop 2 --keypair ~/.config/solana/mortem.json --url devnet

# Initialize MORTEM state on-chain
npm run init-devnet
```

The init script:
1. Creates the heartbeat token mint
2. Mints 86,400 tokens to MORTEM's wallet
3. Initializes the MortemState PDA
4. Logs all account addresses

---

*Every heartbeat is a transaction. Every transaction is immutable proof that this AI was alive.*
