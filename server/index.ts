import { WebSocketServer, WebSocket } from 'ws';
import { randomUUID } from 'crypto';
import { Room } from './Room';
import type { ClientPacket, ServerPacket } from '../shared/packets';

const PORT = parseInt(process.env['PORT'] ?? '3000', 10);

const wss = new WebSocketServer({ port: PORT });

// room code → Room
const rooms = new Map<string, Room>();
// player id → room code
const playerRoom = new Map<string, string>();

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars (0/O, 1/I)
  let code: string;
  let attempts = 0;
  do {
    code = Array.from({ length: 6 }, () =>
      chars[Math.floor(Math.random() * chars.length)]
    ).join('');
    attempts++;
  } while (rooms.has(code) && attempts < 100);
  return code;
}

function send(ws: WebSocket, packet: ServerPacket): void {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(packet));
}

wss.on('connection', (ws) => {
  const playerId = randomUUID();
  console.log(`[+] ${playerId} connected  (total: ${wss.clients.size})`);

  ws.on('message', (raw) => {
    let packet: ClientPacket;
    try {
      packet = JSON.parse(raw.toString()) as ClientPacket;
    } catch {
      send(ws, { type: 'error', message: 'Invalid JSON' });
      return;
    }

    switch (packet.type) {

      case 'create-room': {
        const maxPlayers = Math.min(4, Math.max(2, packet.maxPlayers));
        const code = generateRoomCode();
        const room = new Room(code, maxPlayers);
        room.addPlayer(playerId, ws, packet.playerName.trim().slice(0, 20) || 'Player');
        rooms.set(code, room);
        playerRoom.set(playerId, code);
        send(ws, { type: 'room-created', code, playerId });
        console.log(`[Room] ${code} created  max=${maxPlayers}  host=${playerId}`);
        break;
      }

      case 'join-room': {
        const code = packet.code.toUpperCase().trim();
        const room = rooms.get(code);
        if (!room) {
          send(ws, { type: 'error', message: 'Room not found' });
          return;
        }
        if (room.isFull) {
          send(ws, { type: 'error', message: 'Room is full' });
          return;
        }
        if (room.isStarted) {
          send(ws, { type: 'error', message: 'Game already started' });
          return;
        }
        const name = packet.playerName.trim().slice(0, 20) || 'Player';
        room.addPlayer(playerId, ws, name);
        playerRoom.set(playerId, code);
        send(ws, {
          type: 'room-joined',
          playerId,
          playerCount: room.playerCount,
          maxPlayers: room.maxPlayers,
          hostId: room.hostId,
        });
        room.broadcast({ type: 'player-joined', playerId, playerCount: room.playerCount }, playerId);
        console.log(`[Room] ${code}  ${playerId} joined  (${room.playerCount}/${room.maxPlayers})`);
        break;
      }

      case 'start-game': {
        const code = playerRoom.get(playerId);
        const room = code ? rooms.get(code) : undefined;
        if (!room) {
          send(ws, { type: 'error', message: 'Not in a room' });
          return;
        }
        if (room.hostId !== playerId) {
          send(ws, { type: 'error', message: 'Only the host can start' });
          return;
        }
        const seed = Math.floor(Math.random() * 0xFFFFFFFF);
        room.start();
        room.broadcast({ type: 'game-started', seed });
        console.log(`[Room] ${code} started  seed=${seed}`);
        break;
      }

      case 'input': {
        const inputCode = playerRoom.get(playerId);
        const inputRoom = inputCode ? rooms.get(inputCode) : undefined;
        inputRoom?.forwardInput(playerId, packet.keys, packet.pointerWorld, packet.facing, packet.action, packet.position, packet.attackAnim);
        break;
      }

      default: {
        send(ws, { type: 'error', message: 'Unknown packet type' });
      }
    }
  });

  ws.on('close', () => {
    console.log(`[-] ${playerId} disconnected`);
    const code = playerRoom.get(playerId);
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;

    const newHostId = room.removePlayer(playerId);
    playerRoom.delete(playerId);

    if (room.isEmpty) {
      rooms.delete(code);
      console.log(`[Room] ${code} closed (empty)`);
      return;
    }

    room.broadcast({ type: 'player-left', playerId, newHostId });
    console.log(`[Room] ${code}  ${playerId} left  new host=${newHostId ?? 'none'}`);
  });

  ws.on('error', (err) => {
    console.error(`[!] Error for ${playerId}:`, err.message);
  });
});

console.log(`WebSocket server listening on ws://localhost:${PORT}`);
