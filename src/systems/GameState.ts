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
  coins: number;
  speed: number;
  armor: number;
  strength: number;
  skillSpeed: number;
  skillStrength: number;
  skillDefence: number;
}

export interface GameState {
  phase: 'day' | 'night';
  dayNumber: number;
  nightNumber: number;
  phaseTimer: number;
  houseLevel: number;

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
    hotbar: (() => {
      const hb = Array<ItemStack | null>(C.HOTBAR_SIZE).fill(null);
      hb[0] = { itemId: 'wood',       quantity: 50 };
      hb[1] = { itemId: 'iron_ore',   quantity: 50 };
      hb[2] = { itemId: 'stone',      quantity: 50 };
      hb[3] = { itemId: 'copper_ore', quantity: 50 };
      return hb;
    })(),
    activeSlot: 0,
    facing: 'down',
    velocity: { x: 0, y: 0 },
    coins: 0,
    speed: C.PLAYER_SPEED,
    armor: 0,
    strength: 0,
    skillSpeed: 1,
    skillStrength: 1,
    skillDefence: 1,
  };

  return {
    phase: 'day',
    dayNumber: 1,
    nightNumber: 0,
    phaseTimer: C.DAY_DURATION_SEC,
    houseLevel: 1,
    players: { [localPlayerId]: playerState },
    enemies: {},
    buildings: {},
    droppedItems: {},
    projectiles: {},
    waveActive: false,
    enemiesRemainingThisWave: 0,
  };
}
