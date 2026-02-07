/**
 * @mortem/lifecycle-sdk
 *
 * Read-only SDK for observing MORTEM — an AI agent with programmatic
 * mortality on Solana. Subscribe to heartbeats, detect death, and
 * watch for resurrection.
 *
 * @packageDocumentation
 */

// Re-export everything
export { MortemClient } from "./client";
export {
  MortemState,
  VaultState,
  MortemEvent,
  MortemPhase,
  MortemClientConfig,
} from "./types";
