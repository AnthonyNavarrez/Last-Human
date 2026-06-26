import { C } from '../constants';

export interface Vec2 { x: number; y: number; }

export interface ItemStack {
  itemId: string;
  quantity: number;
}

export interface EntityState {
  id: string;
  type: string;
  position: Vec2;
  hp: number;
  maxHp: number;
}

export interface PlayerState extends EntityState {
  playerId: string;
  inventory: (ItemStack | null)[];
  hotbar: (ItemStack | null)[];
  activeSlot: number;
  facing: 'up' | 'down' | 'left' | 'right';
  velocity: Vec2;
}

export interface GameState {
  phase: 'day' | 'night';
  dayNumber: number;
  nightNumber: number;
  phaseTimer: number;

  players: Record<string, PlayerState>;
  enemies: Record<string, EntityState>;
  buildings: Record<string, EntityState & { ownerId: string }>;
  droppedItems: Record<string, { itemId: string; quantity: number; position: Vec2 }>;
  projectiles: Record<string, { ownerId: string; position: Vec2; velocity: Vec2; damage: number }>;

  waveActive: boolean;
  enemiesRemainingThisWave: number;
}

/** Returns a fresh initial GameState for a new game. */
export function createInitialState(localPlayerId: string): GameState {
  const inventorySize = C.INVENTORY_ROWS * C.INVENTORY_COLS;
  const playerState: PlayerState = {
    id: localPlayerId,
    playerId: localPlayerId,
    type: 'player',
    position: { x: C.PLAYER_SPAWN.x, y: C.PLAYER_SPAWN.y },
    hp: C.PLAYER_HP,
    maxHp: C.PLAYER_HP,
    inventory: Array<null>(inventorySize).fill(null),
    hotbar: Array<null>(C.HOTBAR_SIZE).fill(null),
    activeSlot: 0,
    facing: 'down',
    velocity: { x: 0, y: 0 },
  };

  return {
    phase: 'day',
    dayNumber: 1,
    nightNumber: 0,
    phaseTimer: C.DAY_DURATION_SEC,
    players: { [localPlayerId]: playerState },
    enemies: {},
    buildings: {},
    droppedItems: {},
    projectiles: {},
    waveActive: false,
    enemiesRemainingThisWave: 0,
  };
}
