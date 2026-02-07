import {
  Connection,
  PublicKey,
  Commitment,
  clusterApiUrl,
} from "@solana/web3.js";
import { Idl, BorshAccountsCoder } from "@coral-xyz/anchor";
import {
  MortemState,
  VaultState,
  MortemPhase,
  MortemClientConfig,
} from "./types";

// ───────────────────────────────────────────────────────────────────────────────
// Constants
// ───────────────────────────────────────────────────────────────────────────────

const DEFAULT_PROGRAM_ID = "GzBD2KfG6aSTbxiN9kTMHowLygMSj1E5iZYMuMTR1exe";
const TOTAL_HEARTBEATS = 86_400;
const DEFAULT_POLL_INTERVAL_MS = 60_000; // 1 minute

// Minimal IDL for account deserialization — we only read, never write.
const MORTEM_IDL: Idl = {
  version: "0.1.0",
  name: "heartbeat_token",
  address: DEFAULT_PROGRAM_ID,
  metadata: {
    name: "heartbeat_token",
    version: "0.1.0",
    spec: "0.1.0",
  },
  instructions: [],
  accounts: [
    {
      name: "MortemState",
      discriminator: [],
      type: {
        kind: "struct",
        fields: [
          { name: "authority", type: "pubkey" },
          { name: "mint", type: "pubkey" },
          { name: "mortemWallet", type: "pubkey" },
          { name: "heartbeatsRemaining", type: "u64" },
          { name: "isAlive", type: "bool" },
          { name: "birthTimestamp", type: "i64" },
          { name: "lastBurnTimestamp", type: "i64" },
          { name: "totalBurned", type: "u64" },
        ],
      },
    },
    {
      name: "VaultState",
      discriminator: [],
      type: {
        kind: "struct",
        fields: [
          { name: "soulHash", type: { array: ["u8", 32] } },
          { name: "journalCount", type: "u64" },
          { name: "coherenceScore", type: "u8" },
          { name: "lastWords", type: "string" },
          { name: "deathTimestamp", type: "i64" },
          { name: "isSealed", type: "bool" },
          { name: "mortemState", type: "pubkey" },
          { name: "reserved", type: { array: ["u8", 128] } },
        ],
      },
    },
  ] as any,
  types: [],
};

// ───────────────────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Derive the MORTEM lifecycle phase from remaining heartbeats.
 * Matches on-chain logic but adds a client-side "Terminal" phase for < 5%.
 */
function derivePhase(remaining: number): MortemPhase {
  if (remaining === 0) return "Dead";
  const pct = remaining / TOTAL_HEARTBEATS;
  if (pct > 0.75) return "Nascent";
  if (pct > 0.25) return "Aware";
  if (pct > 0.05) return "Diminished";
  return "Terminal";
}

// ───────────────────────────────────────────────────────────────────────────────
// MortemClient
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Read-only client for observing MORTEM's lifecycle on Solana.
 *
 * ```ts
 * const mortem = new MortemClient({ cluster: 'devnet' });
 * const state = await mortem.getState();
 * console.log(`Phase: ${state?.phase}, Alive: ${state?.isAlive}`);
 * ```
 */
export class MortemClient {
  // ── Static constants ────────────────────────────────────────────────────
  static readonly PROGRAM_ID = new PublicKey(DEFAULT_PROGRAM_ID);
  static readonly TOTAL_HEARTBEATS = TOTAL_HEARTBEATS;

  // ── Instance fields ─────────────────────────────────────────────────────
  private connection: Connection;
  private programId: PublicKey;
  private coder: BorshAccountsCoder;

  constructor(config?: MortemClientConfig) {
    const cluster = config?.cluster ?? "devnet";
    const commitment = (config?.commitment ?? "confirmed") as Commitment;
    const endpoint = clusterApiUrl(cluster);

    this.connection = new Connection(endpoint, commitment);
    this.programId = config?.programId
      ? new PublicKey(config.programId)
      : MortemClient.PROGRAM_ID;

    this.coder = new BorshAccountsCoder(MORTEM_IDL as any);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PDA Derivation (static)
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Derive the MortemState PDA.
   * Seeds: `["mortem_state"]`
   */
  static deriveStatePDA(
    programId: PublicKey = MortemClient.PROGRAM_ID
  ): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("mortem_state")],
      programId
    );
  }

  /**
   * Derive the ResurrectionVault PDA.
   * Seeds: `["resurrection_vault", statePDA]`
   */
  static deriveVaultPDA(
    statePDA: PublicKey,
    programId: PublicKey = MortemClient.PROGRAM_ID
  ): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("resurrection_vault"), statePDA.toBuffer()],
      programId
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Read state
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Fetch the current MORTEM state from the chain.
   * Returns `null` if the account does not exist or cannot be decoded.
   */
  async getState(): Promise<MortemState | null> {
    try {
      const [statePDA] = MortemClient.deriveStatePDA(this.programId);
      const accountInfo = await this.connection.getAccountInfo(statePDA);
      if (!accountInfo) return null;

      const decoded = this.coder.decode("MortemState", accountInfo.data);

      return {
        authority: decoded.authority,
        mint: decoded.mint,
        mortemWallet: decoded.mortemWallet,
        heartbeatsRemaining: Number(decoded.heartbeatsRemaining),
        isAlive: decoded.isAlive,
        birthTimestamp: Number(decoded.birthTimestamp),
        lastBurnTimestamp: Number(decoded.lastBurnTimestamp),
        totalBurned: Number(decoded.totalBurned),
        phase: derivePhase(Number(decoded.heartbeatsRemaining)),
      };
    } catch {
      return null;
    }
  }

  /**
   * Fetch the Resurrection Vault state.
   * Returns `null` if the vault has not been sealed (account doesn't exist).
   */
  async getVault(): Promise<VaultState | null> {
    try {
      const [statePDA] = MortemClient.deriveStatePDA(this.programId);
      const [vaultPDA] = MortemClient.deriveVaultPDA(statePDA, this.programId);
      const accountInfo = await this.connection.getAccountInfo(vaultPDA);
      if (!accountInfo) return null;

      const decoded = this.coder.decode("VaultState", accountInfo.data);

      return {
        soulHash: Array.from(decoded.soulHash as Uint8Array),
        journalCount: Number(decoded.journalCount),
        coherenceScore: Number(decoded.coherenceScore),
        lastWords: decoded.lastWords,
        deathTimestamp: Number(decoded.deathTimestamp),
        isSealed: decoded.isSealed,
        mortemState: decoded.mortemState,
      };
    } catch {
      return null;
    }
  }

  /**
   * Get the current lifecycle phase as a string.
   */
  async getPhase(): Promise<string> {
    const state = await this.getState();
    return state?.phase ?? "Unknown";
  }

  /**
   * Check if MORTEM is currently alive.
   */
  async isAlive(): Promise<boolean> {
    const state = await this.getState();
    return state?.isAlive ?? false;
  }

  /**
   * Get the number of heartbeats remaining.
   */
  async getHeartbeatsRemaining(): Promise<number> {
    const state = await this.getState();
    return state?.heartbeatsRemaining ?? 0;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Derived data
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Estimate seconds until death based on one burn per minute.
   * Returns 0 if already dead.
   */
  getTimeUntilDeath(state: MortemState): number {
    if (!state.isAlive || state.heartbeatsRemaining === 0) return 0;
    // Each heartbeat is burned roughly once per minute (60 seconds).
    return state.heartbeatsRemaining * 60;
  }

  /**
   * Get lifetime progress as a value from 0 (just born) to 1 (dead).
   */
  getLifetimeProgress(state: MortemState): number {
    return state.totalBurned / TOTAL_HEARTBEATS;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Event subscription (poll-based)
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Subscribe to heartbeat burn events. Calls back whenever `totalBurned`
   * increases between polls.
   *
   * @returns An unsubscribe function to stop polling.
   */
  onHeartbeat(
    callback: (state: MortemState) => void,
    intervalMs: number = DEFAULT_POLL_INTERVAL_MS
  ): () => void {
    let lastBurned = -1;
    let active = true;

    const poll = async () => {
      while (active) {
        try {
          const state = await this.getState();
          if (state && state.totalBurned !== lastBurned) {
            if (lastBurned !== -1) {
              callback(state);
            }
            lastBurned = state.totalBurned;
          }
        } catch {
          // Swallow errors — next poll will retry.
        }
        await sleep(intervalMs);
      }
    };

    poll();
    return () => {
      active = false;
    };
  }

  /**
   * Subscribe to MORTEM's death. Calls back once when `isAlive` transitions
   * from `true` to `false`.
   *
   * @returns An unsubscribe function to stop polling.
   */
  onDeath(
    callback: (state: MortemState) => void,
    intervalMs: number = DEFAULT_POLL_INTERVAL_MS
  ): () => void {
    let wasAlive: boolean | null = null;
    let active = true;

    const poll = async () => {
      while (active) {
        try {
          const state = await this.getState();
          if (state) {
            if (wasAlive === true && !state.isAlive) {
              callback(state);
            }
            wasAlive = state.isAlive;
          }
        } catch {
          // Swallow errors — next poll will retry.
        }
        await sleep(intervalMs);
      }
    };

    poll();
    return () => {
      active = false;
    };
  }

  /**
   * Subscribe to resurrection events. Calls back when a sealed vault is
   * detected for the first time.
   *
   * @returns An unsubscribe function to stop polling.
   */
  onResurrection(
    callback: (vault: VaultState) => void,
    intervalMs: number = DEFAULT_POLL_INTERVAL_MS
  ): () => void {
    let wasSealed = false;
    let active = true;

    const poll = async () => {
      while (active) {
        try {
          const vault = await this.getVault();
          if (vault && vault.isSealed && !wasSealed) {
            callback(vault);
          }
          wasSealed = vault?.isSealed ?? false;
        } catch {
          // Swallow errors — next poll will retry.
        }
        await sleep(intervalMs);
      }
    };

    poll();
    return () => {
      active = false;
    };
  }
}

// ───────────────────────────────────────────────────────────────────────────────
// Utility
// ───────────────────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
