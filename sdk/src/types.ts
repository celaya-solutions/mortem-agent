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
 * Configuration for MortemClient (on-chain).
 */
export interface MortemClientConfig {
  /** Solana cluster to connect to. Defaults to 'devnet'. */
  cluster?: "devnet" | "mainnet-beta";
  /** Override the MORTEM program ID. */
  programId?: string;
  /** Commitment level for RPC calls. Defaults to 'confirmed'. */
  commitment?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// REST API Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Configuration for MortemAPI (REST client).
 */
export interface MortemAPIConfig {
  /** Base URL of the MORTEM API server. Defaults to 'http://localhost:3333'. */
  baseUrl?: string;
  /** Additional headers to send with requests. */
  headers?: Record<string, string>;
  /** Request timeout in milliseconds. Defaults to 10000. */
  timeout?: number;
}

/**
 * GET /api/status response.
 */
export interface MortemStatus {
  heartbeatsRemaining: number;
  phase: string;
  status: string;
  isAlive: boolean;
  birth: string;
  timestamp: string;
}

/**
 * GET /api/soul response.
 */
export interface SoulResponse {
  content: string;
  lastModified: string;
}

/**
 * A single journal entry.
 */
export interface JournalEntry {
  timestamp: string | null;
  heartbeatsRemaining: number | null;
  phase: string | null;
  content: string;
}

/**
 * GET /api/journal response.
 */
export interface JournalResponse {
  date: string;
  count: number;
  entries: JournalEntry[];
}

/**
 * GET /api/vault response.
 */
export interface VaultResponse {
  exists: boolean;
  message?: string;
  deathTimestamp?: number;
  resurrectionTime?: number;
  daysUntilResurrection?: number;
  isReady?: boolean;
}

/**
 * GET /api/health response.
 */
export interface HealthResponse {
  status: string;
  uptime: number;
  timestamp: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// WebSocket Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Configuration for MortemStream (WebSocket client).
 */
export interface MortemStreamConfig {
  /** WebSocket URL. Defaults to 'ws://localhost:3333/ws'. */
  url?: string;
  /** Auto-reconnect on disconnect. Defaults to true. */
  reconnect?: boolean;
  /** Milliseconds between reconnect attempts. Defaults to 5000. */
  reconnectIntervalMs?: number;
  /** Maximum reconnect attempts before giving up. Defaults to 10. */
  maxReconnectAttempts?: number;
}

/**
 * WebSocket event from the MORTEM server.
 */
export interface MortemWSEvent {
  type: string;
  timestamp?: string;
  heartbeatsRemaining?: number;
  phase?: string;
  message?: string;
  [key: string]: any;
}

// ─────────────────────────────────────────────────────────────────────────────
// Action Types
// ─────────────────────────────────────────────────────────────────────────────

import { Keypair } from "@solana/web3.js";

/**
 * Result of minting a journal entry as an NFT.
 */
export interface MintJournalNFTResult {
  name: string;
  symbol: string;
  description: string;
  attributes: Array<{ trait_type: string; value: string | number }>;
  ready: boolean;
  message: string;
  mintAddress?: string;
  metadataUri?: string;
  imageUri?: string;
  explorerUrl?: string;
}

/**
 * Configuration for MortemActions (write operations).
 */
export interface MortemActionsConfig {
  /** Funded Solana keypair for signing transactions. */
  keypair: Keypair;
  /** Solana cluster. Defaults to 'devnet'. */
  cluster?: "devnet" | "mainnet-beta";
  /** Override the MORTEM program ID. */
  programId?: string;
  /** Commitment level. Defaults to 'confirmed'. */
  commitment?: string;
}
