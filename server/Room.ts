import type { WebSocket } from 'ws';
import type { ServerPacket } from '../shared/packets';
import { ServerGame } from './ServerGame';

interface ConnectedPlayer {
  id: string;
  ws: WebSocket;
  name: string;
}

export class Room {
  readonly code: string;
  readonly maxPlayers: number;
  private players: ConnectedPlayer[] = [];
  private _started = false;
  private game: ServerGame | null = null;

  constructor(code: string, maxPlayers: number) {
    this.code = code;
    this.maxPlayers = maxPlayers;
  }

  get playerCount(): number  { return this.players.length; }
  get isFull(): boolean      { return this.players.length >= this.maxPlayers; }
  get isStarted(): boolean   { return this._started; }
  get isEmpty(): boolean     { return this.players.length === 0; }
  get hostId(): string       { return this.players[0]?.id ?? ''; }
  get playerIds(): string[]  { return this.players.map(p => p.id); }

  addPlayer(id: string, ws: WebSocket, name: string): void {
    this.players.push({ id, ws, name });
    this.game?.addPlayer(id, name);
  }

  /** Returns the new host ID (if any) after removing the player. */
  removePlayer(id: string): string | undefined {
    const idx = this.players.findIndex(p => p.id === id);
    if (idx < 0) return undefined;
    this.players.splice(idx, 1);
    this.game?.removePlayer(id);
    if (this.isEmpty) this.game?.stop();
    return this.players[0]?.id;
  }

  hasPlayer(id: string): boolean {
    return this.players.some(p => p.id === id);
  }

  start(): void {
    this._started = true;
    this.game = new ServerGame(this, this.players.map(p => ({ id: p.id, name: p.name })));
    this.game.start();
  }

  forwardInput(
    playerId: string,
    keys: import('../shared/packets').InputKeys,
    pointer: { x: number; y: number },
    facing: 'up' | 'down' | 'left' | 'right',
    action: import('../shared/packets').ActionEvent | null,
    position?: { x: number; y: number },
    attackAnim?: string | null,
  ): void {
    this.game?.handleInput(playerId, keys, pointer, facing, action, position, attackAnim);
  }

  send(playerId: string, packet: ServerPacket): void {
    const player = this.players.find(p => p.id === playerId);
    if (player) this._sendWs(player.ws, packet);
  }

  broadcast(packet: ServerPacket, excludeId?: string): void {
    for (const p of this.players) {
      if (p.id !== excludeId) this._sendWs(p.ws, packet);
    }
  }

  private _sendWs(ws: WebSocket, packet: ServerPacket): void {
    if (ws.readyState === 1) ws.send(JSON.stringify(packet));
  }
}
