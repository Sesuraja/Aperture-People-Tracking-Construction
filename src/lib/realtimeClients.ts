/**
 * Client-Side API Connections Manager for:
 * 1. WebSocket Method (ws:// / wss://)
 * 2. SSE Method (Server-Sent Events)
 * 3. MQTT Method (MQTT over WebSockets or HTTP bridge)
 * 4. HTTP Long-Polling Stream & Webhooks Method
 */

export interface RealtimeEventMessage {
  id?: string;
  type?: string;
  event?: string;
  topic?: string;
  payload?: any;
  timestamp?: string;
  source?: string;
}

export type ConnectionStatus = 'Connected' | 'Connecting' | 'Disconnected' | 'Error' | 'Reconnecting';

type MessageListener = (evt: RealtimeEventMessage) => void;
type StatusListener = (status: ConnectionStatus, message?: string) => void;

// ==========================================
// 1. WEBSOCKET CLIENT CONNECTION ENGINE
// ==========================================
export class WebSocketClientManager {
  private socket: WebSocket | null = null;
  private status: ConnectionStatus = 'Disconnected';
  private messageListeners: Set<MessageListener> = new Set();
  private statusListeners: Set<StatusListener> = new Set();
  private reconnectTimer: any = null;
  private isExplicitDisconnect = false;
  private customUrl: string | null = null;

  constructor(private urlPath: string = '/ws') {}

  public configure(url: string): void {
    this.customUrl = url;
  }

  public getUrl(): string {
    if (this.customUrl) return this.customUrl;
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('aperture_ws_url');
        if (saved) {
          this.customUrl = saved;
          return saved;
        }
      } catch {
        // ignore
      }
    }
    if (typeof window === 'undefined') return '';
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    return `${protocol}//${host}${this.urlPath.startsWith('/') ? '' : '/'}${this.urlPath}`;
  }

  public connect(): void {
    if (typeof window === 'undefined') return;
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.isExplicitDisconnect = false;
    this.setStatus('Connecting');

    const wsUrl = this.getUrl();

    try {
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        this.setStatus('Connected');
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
      };

      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.notifyMessage(data);
        } catch {
          this.notifyMessage({ payload: event.data });
        }
      };

      this.socket.onclose = () => {
        this.setStatus('Disconnected');
        if (!this.isExplicitDisconnect) {
          this.scheduleReconnect();
        }
      };

      this.socket.onerror = (err) => {
        this.setStatus('Error', 'WebSocket error occurred');
      };
    } catch (err: any) {
      this.setStatus('Error', err.message || 'Failed to initialize WebSocket');
      this.scheduleReconnect();
    }
  }

  public disconnect(): void {
    this.isExplicitDisconnect = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.setStatus('Disconnected');
  }

  public send(type: string, payload: any = {}): boolean {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type, payload, timestamp: new Date().toISOString() }));
      return true;
    }
    return false;
  }

  public onMessage(listener: MessageListener): () => void {
    this.messageListeners.add(listener);
    return () => this.messageListeners.delete(listener);
  }

  public onStatus(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    listener(this.status);
    return () => this.statusListeners.delete(listener);
  }

  public getStatus(): ConnectionStatus {
    return this.status;
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      if (!this.isExplicitDisconnect) {
        this.setStatus('Reconnecting');
        this.connect();
      }
    }, 4000);
  }

  private setStatus(status: ConnectionStatus, message?: string): void {
    this.status = status;
    this.statusListeners.forEach((fn) => fn(status, message));
  }

  private notifyMessage(msg: RealtimeEventMessage): void {
    this.messageListeners.forEach((fn) => fn(msg));
  }
}

// ==========================================
// 2. SERVER-SENT EVENTS (SSE) CLIENT ENGINE
// ==========================================
export class SseClientManager {
  private eventSource: EventSource | null = null;
  private status: ConnectionStatus = 'Disconnected';
  private messageListeners: Set<MessageListener> = new Set();
  private statusListeners: Set<StatusListener> = new Set();

  constructor(private sseEndpoint: string = '/api/realtime/sse/subscribe') {}

  public connect(): void {
    if (typeof window === 'undefined') return;
    if (this.eventSource) return;

    this.setStatus('Connecting');

    try {
      this.eventSource = new EventSource(this.sseEndpoint);

      this.eventSource.onopen = () => {
        this.setStatus('Connected');
      };

      this.eventSource.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          this.notifyMessage({ event: 'message', payload: parsed });
        } catch {
          this.notifyMessage({ event: 'message', payload: event.data });
        }
      };

      // Custom event listener types
      const customEvents = ['connected', 'rfid_scan', 'tag_update', 'mqtt_message', 'mqtt_publish', 'mqtt_status', 'webhook_received', 'notification'];
      customEvents.forEach((evtName) => {
        this.eventSource?.addEventListener(evtName, (e: MessageEvent) => {
          try {
            const data = JSON.parse(e.data);
            this.notifyMessage({ event: evtName, payload: data });
          } catch {
            this.notifyMessage({ event: evtName, payload: e.data });
          }
        });
      });

      this.eventSource.onerror = () => {
        if (this.eventSource?.readyState === EventSource.CLOSED) {
          this.setStatus('Disconnected');
        } else {
          this.setStatus('Error', 'SSE stream re-establishing...');
        }
      };
    } catch (err: any) {
      this.setStatus('Error', err.message);
    }
  }

  public disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.setStatus('Disconnected');
  }

  public onMessage(listener: MessageListener): () => void {
    this.messageListeners.add(listener);
    return () => this.messageListeners.delete(listener);
  }

  public onStatus(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    listener(this.status);
    return () => this.statusListeners.delete(listener);
  }

  public getStatus(): ConnectionStatus {
    return this.status;
  }

  private setStatus(status: ConnectionStatus, message?: string): void {
    this.status = status;
    this.statusListeners.forEach((fn) => fn(status, message));
  }

  private notifyMessage(msg: RealtimeEventMessage): void {
    this.messageListeners.forEach((fn) => fn(msg));
  }
}

// ==========================================
// 3. MQTT CLIENT ENGINE (REST + WS PROXY)
// ==========================================
export class MqttClientManager {
  private status: ConnectionStatus = 'Disconnected';
  private messageListeners: Set<MessageListener> = new Set();
  private statusListeners: Set<StatusListener> = new Set();

  constructor() {}

  public async getStatusAsync(): Promise<ConnectionStatus> {
    try {
      const res = await fetch('/api/realtime/mqtt/status');
      if (res.ok) {
        const data = await res.json();
        const stat: ConnectionStatus = data.connected ? 'Connected' : 'Disconnected';
        this.setStatus(stat);
        return stat;
      }
    } catch {
      this.setStatus('Error');
    }
    return 'Disconnected';
  }

  public async publish(topic: string, message: any): Promise<{ success: boolean; error?: string }> {
    const res = await fetch('/api/realtime/mqtt/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic, payload: message })
    });
    return res.json();
  }

  public async subscribe(topic: string): Promise<{ success: boolean; error?: string }> {
    const res = await fetch('/api/realtime/mqtt/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic })
    });
    return res.json();
  }

  public async getConfig(): Promise<any> {
    try {
      const res = await fetch('/api/realtime/mqtt/config');
      if (res.ok) {
        const data = await res.json();
        return data.config;
      }
    } catch {
      // ignore
    }
    return null;
  }

  public async updateConfig(
    brokerUrl: string,
    enabled: boolean = true,
    topics: string[] = ['gao/rfid/scans'],
    username?: string,
    password?: string
  ): Promise<any> {
    const res = await fetch('/api/realtime/mqtt/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brokerUrl, enabled, topics, username, password })
    });
    return res.json();
  }

  public onMessage(listener: MessageListener): () => void {
    this.messageListeners.add(listener);
    return () => this.messageListeners.delete(listener);
  }

  public onStatus(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    listener(this.status);
    return () => this.statusListeners.delete(listener);
  }

  private setStatus(status: ConnectionStatus, message?: string): void {
    this.status = status;
    this.statusListeners.forEach((fn) => fn(status, message));
  }

  public notifyIncomingMqtt(msg: RealtimeEventMessage): void {
    this.messageListeners.forEach((fn) => fn(msg));
  }
}

// ==========================================
// 4. HTTP LONG-POLLING STREAM ENGINE
// ==========================================
export class LongPollingClientManager {
  private isPolling = false;
  private lastSeenId: string = '';
  private status: ConnectionStatus = 'Disconnected';
  private messageListeners: Set<MessageListener> = new Set();
  private statusListeners: Set<StatusListener> = new Set();

  public start(): void {
    if (this.isPolling) return;
    this.isPolling = true;
    this.setStatus('Connected');
    this.pollLoop();
  }

  public stop(): void {
    this.isPolling = false;
    this.setStatus('Disconnected');
  }

  private async pollLoop(): Promise<void> {
    while (this.isPolling) {
      try {
        const url = `/api/realtime/poll${this.lastSeenId ? `?since=${encodeURIComponent(this.lastSeenId)}` : ''}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          if (data.events && Array.isArray(data.events)) {
            data.events.forEach((evt: any) => {
              if (evt.id) this.lastSeenId = evt.id;
              this.notifyMessage({ event: 'long_poll_event', payload: evt });
            });
          }
        }
      } catch {
        // Wait 3 seconds before retrying on network error
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
  }

  public onMessage(listener: MessageListener): () => void {
    this.messageListeners.add(listener);
    return () => this.messageListeners.delete(listener);
  }

  public onStatus(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    listener(this.status);
    return () => this.statusListeners.delete(listener);
  }

  private setStatus(status: ConnectionStatus): void {
    this.status = status;
    this.statusListeners.forEach((fn) => fn(status));
  }

  private notifyMessage(msg: RealtimeEventMessage): void {
    this.messageListeners.forEach((fn) => fn(msg));
  }
}

// Global Singletons
export const globalWsClient = new WebSocketClientManager('/ws');
export const globalSseClient = new SseClientManager('/api/realtime/sse/subscribe');
export const globalMqttClient = new MqttClientManager();
export const globalPollingClient = new LongPollingClientManager();
