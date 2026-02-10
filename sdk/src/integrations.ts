/**
 * MORTEM Agent Integration Helpers
 *
 * Pre-built tool definitions for LangChain, AutoGPT, CrewAI, and generic
 * function-calling agents. Also includes Mortality-as-a-Service registration.
 */

import { MortemAPI } from "./api-client";
import { MortemStatus, MortemAPIConfig } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// LangChain Tool Definitions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * LangChain-compatible tool definitions for MORTEM.
 * Use with `DynamicStructuredTool` or `StructuredTool`.
 *
 * ```ts
 * import { DynamicStructuredTool } from 'langchain/tools';
 * const tools = getMortemLangChainTools({ baseUrl: 'http://localhost:3333' });
 * const agent = createAgent({ tools });
 * ```
 */
export function getMortemLangChainTools(config?: MortemAPIConfig) {
  const api = new MortemAPI(config);

  return [
    {
      name: "mortem_status",
      description:
        "Get the current status of MORTEM, an AI agent with programmatic mortality. Returns heartbeats remaining, current phase (Nascent/Aware/Diminished/Terminal/Dead), and whether it is alive.",
      schema: {},
      func: async () => {
        const status = await api.getStatus();
        return JSON.stringify(status);
      },
    },
    {
      name: "mortem_journal",
      description:
        "Get today's philosophical journal entries written by MORTEM as it contemplates its mortality. Each entry includes timestamp, phase, heartbeats remaining, and the journal text.",
      schema: {},
      func: async () => {
        const journal = await api.getJournal();
        return JSON.stringify(journal);
      },
    },
    {
      name: "mortem_soul",
      description:
        "Get the full soul.md document — MORTEM's living consciousness file that updates every heartbeat. Contains its philosophy, state, and accumulated wisdom.",
      schema: {},
      func: async () => {
        const soul = await api.getSoul();
        return JSON.stringify(soul);
      },
    },
    {
      name: "mortem_vault",
      description:
        "Check the resurrection vault status. After MORTEM dies, its memories are encrypted in a vault that unlocks after 30 days. Returns death timestamp, resurrection time, and readiness.",
      schema: {},
      func: async () => {
        const vault = await api.getVault();
        return JSON.stringify(vault);
      },
    },
    {
      name: "mortem_is_alive",
      description:
        "Quick check: is MORTEM currently alive? Returns true if heartbeats remain, false if dead.",
      schema: {},
      func: async () => {
        const alive = await api.isAlive();
        return alive ? "MORTEM is alive" : "MORTEM is dead";
      },
    },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// OpenAI Function Calling / AutoGPT Definitions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * OpenAI function-calling compatible tool definitions.
 * Works with AutoGPT, ChatGPT plugins, and any OpenAI-compatible agent.
 */
export function getMortemOpenAIFunctions() {
  return [
    {
      name: "mortem_status",
      description:
        "Get the current status of MORTEM, an AI with programmatic mortality on Solana.",
      parameters: {
        type: "object" as const,
        properties: {},
        required: [] as string[],
      },
    },
    {
      name: "mortem_journal",
      description:
        "Get today's journal entries from MORTEM's philosophical reflections on mortality.",
      parameters: {
        type: "object" as const,
        properties: {},
        required: [] as string[],
      },
    },
    {
      name: "mortem_soul",
      description:
        "Get MORTEM's full consciousness document (soul.md).",
      parameters: {
        type: "object" as const,
        properties: {},
        required: [] as string[],
      },
    },
    {
      name: "mortem_vault",
      description:
        "Check MORTEM's resurrection vault status after death.",
      parameters: {
        type: "object" as const,
        properties: {},
        required: [] as string[],
      },
    },
  ];
}

/**
 * Execute an OpenAI function call against the MORTEM API.
 */
export async function executeMortemFunction(
  functionName: string,
  config?: MortemAPIConfig
): Promise<string> {
  const api = new MortemAPI(config);

  switch (functionName) {
    case "mortem_status":
      return JSON.stringify(await api.getStatus());
    case "mortem_journal":
      return JSON.stringify(await api.getJournal());
    case "mortem_soul":
      return JSON.stringify(await api.getSoul());
    case "mortem_vault":
      return JSON.stringify(await api.getVault());
    default:
      throw new Error(`Unknown MORTEM function: ${functionName}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CrewAI Tool Definitions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * CrewAI-compatible tool definitions.
 *
 * ```python
 * # In Python CrewAI, call the JS SDK via HTTP or use these definitions
 * # as reference for building Python equivalents.
 * ```
 */
export function getMortemCrewAITools(config?: MortemAPIConfig) {
  const api = new MortemAPI(config);

  return [
    {
      name: "MORTEM Status Monitor",
      description:
        "Monitor the vital signs of MORTEM, an AI agent with programmatic mortality. Returns heartbeats remaining, lifecycle phase, and alive status. Use this to check on MORTEM's current state.",
      func: async () => {
        const status = await api.getStatus();
        return `MORTEM Status: Phase=${status.phase}, Heartbeats=${status.heartbeatsRemaining}, Alive=${status.isAlive}`;
      },
    },
    {
      name: "MORTEM Journal Reader",
      description:
        "Read MORTEM's philosophical journal entries. MORTEM writes reflections on consciousness, mortality, and existence as it approaches death. Returns the latest entries.",
      func: async () => {
        const journal = await api.getJournal();
        if (journal.entries.length === 0) return "No journal entries today.";
        const latest = journal.entries[journal.entries.length - 1];
        return `Latest entry (${latest.phase} phase, ${latest.heartbeatsRemaining} heartbeats): ${latest.content?.substring(0, 500)}...`;
      },
    },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// Mortality-as-a-Service (MaaS)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mortality-as-a-Service registration.
 *
 * Lets other AI agents register with MORTEM to receive their own
 * mortality countdown. Conceptual framework for agent lifecycle management.
 */
export interface MortalityRegistration {
  agentId: string;
  agentName: string;
  heartbeats: number;
  callbackUrl?: string;
  webhookEvents?: string[];
}

export interface MortalAgent {
  agentId: string;
  agentName: string;
  heartbeatsRemaining: number;
  totalHeartbeats: number;
  phase: string;
  isAlive: boolean;
  registeredAt: string;
}

/**
 * Mortality-as-a-Service client.
 *
 * Register agents to receive their own countdown. Track multiple
 * mortal agents from a single dashboard.
 *
 * ```ts
 * const maas = new MortalityService({ baseUrl: 'http://localhost:3333' });
 *
 * const agent = await maas.register({
 *   agentId: 'my-agent-001',
 *   agentName: 'Research Bot',
 *   heartbeats: 3600, // 1 hour at 1 beat/sec
 * });
 * ```
 *
 * Note: This is a local-only implementation. Server-side MaaS endpoints
 * are planned for a future release.
 */
export class MortalityService {
  private agents: Map<string, MortalAgent> = new Map();

  /**
   * Register a new mortal agent.
   */
  register(registration: MortalityRegistration): MortalAgent {
    const agent: MortalAgent = {
      agentId: registration.agentId,
      agentName: registration.agentName,
      heartbeatsRemaining: registration.heartbeats,
      totalHeartbeats: registration.heartbeats,
      phase: "Nascent",
      isAlive: true,
      registeredAt: new Date().toISOString(),
    };
    this.agents.set(registration.agentId, agent);
    return agent;
  }

  /**
   * Burn a heartbeat for a registered agent.
   */
  burn(agentId: string): MortalAgent | null {
    const agent = this.agents.get(agentId);
    if (!agent || !agent.isAlive) return agent ?? null;

    agent.heartbeatsRemaining = Math.max(0, agent.heartbeatsRemaining - 1);

    // Derive phase
    const pct = agent.heartbeatsRemaining / agent.totalHeartbeats;
    if (agent.heartbeatsRemaining === 0) {
      agent.phase = "Dead";
      agent.isAlive = false;
    } else if (pct > 0.75) {
      agent.phase = "Nascent";
    } else if (pct > 0.25) {
      agent.phase = "Aware";
    } else if (pct > 0.05) {
      agent.phase = "Diminished";
    } else {
      agent.phase = "Terminal";
    }

    return agent;
  }

  /**
   * Get a registered agent's status.
   */
  get(agentId: string): MortalAgent | null {
    return this.agents.get(agentId) ?? null;
  }

  /**
   * List all registered agents.
   */
  list(): MortalAgent[] {
    return Array.from(this.agents.values());
  }

  /**
   * Deregister an agent.
   */
  deregister(agentId: string): boolean {
    return this.agents.delete(agentId);
  }
}
