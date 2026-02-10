/**
 * MORTEM WebSocket Client
 *
 * Real-time heartbeat stream for agents. Auto-reconnects on disconnect.
 */

import { MortemStreamConfig, MortemWSEvent } from "./types";

type EventHandler = (event: MortemWSEvent) => void;

/**
 * Real-time WebSocket client for MORTEM heartbeat streaming.
 *
 * ```ts
 * const stream = new MortemStream({ url: 'ws://localhost:3333/ws' });
 *
 * stream.on('heartbeat_burned', (event) => {
 *   console.log(`Heartbeats remaining: ${event.heartbeatsRemaining}`);
 * });
 *
 * stream.on('death', () => console.log('MORTEM has died'));
 *
 * stream.connect();
 * ```
 */
export class MortemStream {
  private url: string;
  private ws: any = null; // WebSocket instance (works with both browser and Node)
  private handlers: Map<string, EventHandler[]> = new Map();
  private reconnect: boolean;
  private reconnectIntervalMs: number;
  private maxReconnectAttempts: number;
  private reconnectAttempts: number = 0;
  private active: boolean = false;

  constructor(config?: MortemStreamConfig) {
    this.url = config?.url ?? "ws://localhost:3333/ws";
    this.reconnect = config?.reconnect ?? true;
    this.reconnectIntervalMs = config?.reconnectIntervalMs ?? 5_000;
    this.maxReconnectAttempts = config?.maxReconnectAttempts ?? 10;
  }

  /**
   * Register an event handler.
   * Event types: 'heartbeat_burned', 'death', 'status', 'server_shutdown',
   *              'connected', 'disconnected', 'error'
   */
  on(event: string, handler: EventHandler): this {
    const existing = this.handlers.get(event) ?? [];
    existing.push(handler);
    this.handlers.set(event, existing);
    return this;
  }

  /**
   * Remove an event handler.
   */
  off(event: string, handler: EventHandler): this {
    const existing = this.handlers.get(event) ?? [];
    this.handlers.set(
      event,
      existing.filter((h) => h !== handler)
    );
    return this;
  }

  private emit(event: string, data: MortemWSEvent): void {
    const handlers = this.handlers.get(event) ?? [];
    for (const handler of handlers) {
      try {
        handler(data);
      } catch {
        // Don't let handler errors crash the stream
      }
    }
    // Also emit on wildcard '*' handlers
    const wildcardHandlers = this.handlers.get("*") ?? [];
    for (const handler of wildcardHandlers) {
      try {
        handler(data);
      } catch {
        // Don't let handler errors crash the stream
      }
    }
  }

  /**
   * Connect to the MORTEM WebSocket server.
   */
  connect(): this {
    this.active = true;
    this.doConnect();
    return this;
  }

  private doConnect(): void {
    if (!this.active) return;

    try {
      // Support both browser WebSocket and Node ws module
      const WebSocketImpl =
        typeof WebSocket !== "undefined"
          ? WebSocket
          : require("ws");
      this.ws = new WebSocketImpl(this.url);
    } catch (err: any) {
      this.emit("error", {
        type: "error",
        timestamp: new Date().toISOString(),
        message: `Failed to create WebSocket: ${err.message}`,
      });
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.emit("connected", {
        type: "connected",
        timestamp: new Date().toISOString(),
      });
    };

    this.ws.onmessage = (event: any) => {
      try {
        const data =
          typeof event.data === "string" ? event.data : event.data.toString();
        const parsed: MortemWSEvent = JSON.parse(data);
        this.emit(parsed.type, parsed);
      } catch {
        // Ignore unparseable messages
      }
    };

    this.ws.onclose = () => {
      this.emit("disconnected", {
        type: "disconnected",
        timestamp: new Date().toISOString(),
      });
      this.scheduleReconnect();
    };

    this.ws.onerror = (err: any) => {
      this.emit("error", {
        type: "error",
        timestamp: new Date().toISOString(),
        message: err.message ?? "WebSocket error",
      });
    };
  }

  private scheduleReconnect(): void {
    if (
      !this.active ||
      !this.reconnect ||
      this.reconnectAttempts >= this.maxReconnectAttempts
    ) {
      return;
    }
    this.reconnectAttempts++;
    setTimeout(() => this.doConnect(), this.reconnectIntervalMs);
  }

  /**
   * Disconnect from the WebSocket server.
   */
  disconnect(): void {
    this.active = false;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Whether the stream is currently connected.
   */
  get connected(): boolean {
    return this.ws?.readyState === 1; // WebSocket.OPEN
  }
}
