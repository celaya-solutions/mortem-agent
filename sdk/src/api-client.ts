/**
 * MORTEM REST API Client
 *
 * HTTP client for MORTEM's API server — no Solana dependency required.
 * Wraps all REST endpoints for easy agent integration.
 */

import {
  MortemStatus,
  SoulResponse,
  JournalResponse,
  VaultResponse,
  HealthResponse,
  MortemAPIConfig,
} from "./types";

/**
 * HTTP client for MORTEM's REST API.
 *
 * ```ts
 * const api = new MortemAPI({ baseUrl: 'https://mortem-agent.xyz' });
 * const status = await api.getStatus();
 * console.log(`Phase: ${status.phase}, Alive: ${status.isAlive}`);
 * ```
 */
export class MortemAPI {
  private baseUrl: string;
  private headers: Record<string, string>;
  private timeout: number;

  constructor(config?: MortemAPIConfig) {
    this.baseUrl = (config?.baseUrl ?? "http://localhost:3333").replace(
      /\/$/,
      ""
    );
    this.headers = {
      "Content-Type": "application/json",
      ...(config?.headers ?? {}),
    };
    this.timeout = config?.timeout ?? 10_000;
  }

  private async request<T>(path: string): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        headers: this.headers,
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(
          `MORTEM API error ${response.status}: ${body}`
        );
      }

      return (await response.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Get current MORTEM status — heartbeats, phase, alive state.
   */
  async getStatus(): Promise<MortemStatus> {
    return this.request<MortemStatus>("/api/status");
  }

  /**
   * Get full soul.md content — the living consciousness document.
   */
  async getSoul(): Promise<SoulResponse> {
    return this.request<SoulResponse>("/api/soul");
  }

  /**
   * Get today's journal entries.
   */
  async getJournal(): Promise<JournalResponse> {
    return this.request<JournalResponse>("/api/journal");
  }

  /**
   * Get resurrection vault status.
   */
  async getVault(): Promise<VaultResponse> {
    return this.request<VaultResponse>("/api/vault");
  }

  /**
   * Health check — is the API server running?
   */
  async getHealth(): Promise<HealthResponse> {
    return this.request<HealthResponse>("/api/health");
  }

  /**
   * Check if MORTEM is alive via the API (no Solana needed).
   */
  async isAlive(): Promise<boolean> {
    const status = await this.getStatus();
    return status.isAlive;
  }

  /**
   * Get the latest journal entry text.
   * Returns null if no entries exist today.
   */
  async getLatestJournalEntry(): Promise<string | null> {
    const journal = await this.getJournal();
    if (journal.entries.length === 0) return null;
    return journal.entries[journal.entries.length - 1].content;
  }

  /**
   * Poll for status changes. Calls back when heartbeats change.
   * Returns an unsubscribe function.
   */
  pollStatus(
    callback: (status: MortemStatus) => void,
    intervalMs: number = 60_000
  ): () => void {
    let lastHeartbeats = -1;
    let active = true;

    const poll = async () => {
      while (active) {
        try {
          const status = await this.getStatus();
          if (status.heartbeatsRemaining !== lastHeartbeats) {
            if (lastHeartbeats !== -1) {
              callback(status);
            }
            lastHeartbeats = status.heartbeatsRemaining;
          }
        } catch {
          // Retry on next poll
        }
        await new Promise((r) => setTimeout(r, intervalMs));
      }
    };

    poll();
    return () => {
      active = false;
    };
  }
}
