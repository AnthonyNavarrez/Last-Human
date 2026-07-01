// All WebSocket message types exchanged between client and server.

export interface InputKeys {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}

export type BuildingKind = 'canon' | 'turret' | 'anvil' | 'crafting-bench' | 'auto-miner' | 'auto-saw' | 'acorn-tree' | 'blueberry-bush';

export interface BuildingSnapshot {
  id: string;
  kind: BuildingKind;
  x: number;
  y: number;
  nodeId?: string; // auto-miner / auto-saw: the ore/tree node they attach to
}

export type ActionEvent =
  | { kind: 'melee' }
  | { kind: 'ranged';         worldX: number; worldY: number }
  | { kind: 'place';          itemId: string; worldX: number; worldY: number }
  | { kind: 'interact' }
  | { kind: 'drop';           all: boolean }
  | { kind: 'craft';          recipeId: string }
  | { kind: 'hit-enemy';      enemyId: string; damage: number }
  | { kind: 'node-event';     nodeId: string; event: 'broken' | 'depleted' }
  | { kind: 'place-building'; buildingId: string; buildingKind: BuildingKind; x: number; y: number; nodeId?: string }
  | { kind: 'sync-drops';     drops: DroppedItemSnapshot[] }
  | { kind: 'pickup-drop';    dropId: string };

// ---------- Snapshot types (server → client every 50ms) ----------

export interface EnemySnapshot {
  id: string;
  defId: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
}

export interface RemotePlayerSnapshot {
  id: string;
  name: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  facing: 'up' | 'down' | 'left' | 'right';
  attackAnim: string | null;
}

export interface DroppedItemSnapshot {
  id: string;
  itemId: string;
  quantity: number;
  x: number;
  y: number;
}

export interface GameSnapshot {
  phase: 'day' | 'night';
  phaseTimerSec: number;
  nightNumber: number;
  dayNumber: number;
  houseHp: number;
  waveActive: boolean;
  enemies: EnemySnapshot[];
  players: RemotePlayerSnapshot[];
  depletedNodeIds: string[];
  brokenNodeIds: string[];
  buildings: BuildingSnapshot[];
  drops: DroppedItemSnapshot[];
}

// ---------- Client → Server ----------

export type ClientPacket =
  | { type: 'create-room';  maxPlayers: number; playerName: string }
  | { type: 'join-room';    code: string; playerName: string }
  | { type: 'start-game' }
  | { type: 'input';        keys: InputKeys; pointerWorld: { x: number; y: number }; facing: 'up' | 'down' | 'left' | 'right'; action: ActionEvent | null; position: { x: number; y: number }; attackAnim: string | null };

// ---------- Server → Client ----------

export type ServerPacket =
  | { type: 'room-created';    code: string;     playerId: string }
  | { type: 'room-joined';     playerId: string; playerCount: number; maxPlayers: number; hostId: string }
  | { type: 'player-joined';   playerId: string; playerCount: number }
  | { type: 'player-left';     playerId: string; newHostId?: string }
  | { type: 'game-started';  seed: number }
  | { type: 'state-snapshot';  snapshot: GameSnapshot }
  | { type: 'error';           message: string };
