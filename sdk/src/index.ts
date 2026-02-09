/**
 * mortem-lifecycle-sdk
 *
 * Full SDK for integrating with MORTEM — an AI agent with programmatic
 * mortality on Solana. Observe heartbeats, detect death, fund resurrection,
 * stream events, and build agent integrations.
 *
 * @packageDocumentation
 */

// On-chain client (read-only)
export { MortemClient } from "./client";

// REST API client (no Solana dependency)
export { MortemAPI } from "./api-client";

// WebSocket client (real-time streaming)
export { MortemStream } from "./ws-client";

// Action methods (on-chain write operations)
export { MortemActions } from "./actions";

// Agent integrations (LangChain, AutoGPT, CrewAI)
export {
  getMortemLangChainTools,
  getMortemOpenAIFunctions,
  executeMortemFunction,
  getMortemCrewAITools,
  MortalityService,
} from "./integrations";

// All types
export {
  // On-chain types
  MortemState,
  VaultState,
  MortemEvent,
  MortemPhase,
  MortemClientConfig,
  // REST API types
  MortemAPIConfig,
  MortemStatus,
  SoulResponse,
  JournalResponse,
  JournalEntry,
  VaultResponse,
  HealthResponse,
  // WebSocket types
  MortemStreamConfig,
  MortemWSEvent,
  // Action types
  MortemActionsConfig,
  MintJournalNFTResult,
} from "./types";

// Integration types
export type {
  MortalityRegistration,
  MortalAgent,
} from "./integrations";
