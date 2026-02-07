import { PublicKey } from "@solana/web3.js";

/**
 * MORTEM lifecycle phases.
 *
 * Derived from on-chain heartbeats remaining:
 *   Nascent    — > 75% remaining (first 6 hours)
 *   Aware      — 25-75% remaining (middle 12 hours)
 *   Diminished — 5-25% remaining (approaching end)
 *   Terminal   — < 5% remaining (final hour)
 *   Dead       — 0 remaining
 */
export type MortemPhase = "Nascent" | "Aware" | "Diminished" | "Terminal" | "Dead";

/**
 * On-chain MORTEM state account.
 * PDA seeds: [Buffer.from('mortem_state')]
 */
export interface MortemState {
  heartbeatsRemaining: number;
  isAlive: boolean;
  totalBurned: number;
  birthTimestamp: number;
  lastBurnTimestamp: number;
  phase: MortemPhase;
  mint: PublicKey;
  mortemWallet: PublicKey;
  authority: PublicKey;
}

/**
 * On-chain Resurrection Vault account.
 * PDA seeds: [Buffer.from('resurrection_vault'), statePDA.toBuffer()]
 */
export interface VaultState {
  soulHash: number[];
  journalCount: number;
  coherenceScore: number;
  lastWords: string;
  deathTimestamp: number;
  isSealed: boolean;
  mortemState: PublicKey;
}

/**
 * MORTEM lifecycle events emitted by the poll-based subscription system.
 */
export interface MortemEvent {
  type: "heartbeat_burned" | "death" | "vault_sealed" | "resurrection";
  timestamp: number;
  data: any;
}

/**
 * Configuration for MortemClient.
 */
export interface MortemClientConfig {
  /** Solana cluster to connect to. Defaults to 'devnet'. */
  cluster?: "devnet" | "mainnet-beta";
  /** Override the MORTEM program ID. */
  programId?: string;
  /** Commitment level for RPC calls. Defaults to 'confirmed'. */
  commitment?: string;
}
