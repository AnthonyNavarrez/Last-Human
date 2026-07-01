import type { ClientPacket, ServerPacket } from '../../shared/packets';

type AnyHandler = (packet: ServerPacket) => void;

class NetworkClientClass {
  private ws: WebSocket | null = null;
  private listeners = new Map<string, Set<AnyHandler>>();

  playerId: string | null = null;

  get isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  connect(): Promise<void> {
    if (this.isConnected) return Promise.resolve();

    return new Promise((resolve, reject) => {
      const url = (import.meta.env['VITE_SERVER_URL'] as string | undefined) ?? 'ws://localhost:3000';
      const ws = new WebSocket(url);

      ws.onopen = () => {
        this.ws = ws;
        resolve();
      };

      ws.onerror = () => {
        reject(new Error('Could not connect to server'));
      };

      ws.onmessage = (event) => {
        let packet: ServerPacket;
        try {
          packet = JSON.parse(event.data as string) as ServerPacket;
        } catch {
          return; // ignore malformed JSON
        }
        if (packet.type === 'room-created') this.playerId = packet.playerId;
        if (packet.type === 'room-joined')  this.playerId = packet.playerId;
        this.listeners.get(packet.type)?.forEach(h => h(packet));
      };

      ws.onclose = () => {
        this.ws = null;
      };
    });
  }

  disconnect(): void {
    this.ws?.close();
    this.ws = null;
    this.playerId = null;
  }

  send(packet: ClientPacket): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(packet));
    }
  }

  on<K extends ServerPacket['type']>(
    type: K,
    handler: (packet: Extract<ServerPacket, { type: K }>) => void,
  ): void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(handler as AnyHandler);
  }

  off<K extends ServerPacket['type']>(
    type: K,
    handler: (packet: Extract<ServerPacket, { type: K }>) => void,
  ): void {
    this.listeners.get(type)?.delete(handler as AnyHandler);
  }

  clearListeners(): void {
    this.listeners.clear();
  }
}

export const net = new NetworkClientClass();
