export interface EnemyDefinition {
  id: string;
  label: string;
  spriteKey: string;
  hp: number;
  damage: number;
  speed: number;           // pixels per second
  attackRange: number;
  attackSpeed: number;     // attacks per second
  aggroRange: number;
  drops: { itemId: string; quantity: number; chance: number }[];
  firstNight: number;      // first night this enemy can appear
  lastNight: number;       // last night this enemy can appear (-1 = no limit)
  pathfinding: 'direct' | 'steering';
  animStyle?: '4dir' | 'strip'; // '4dir' = 4-col directional sheet; 'strip' = single row
  frameCount?: number;          // frames in strip animation
  useAtlas?: boolean;           // true = texture atlas with string frame names "0","1",...
  attackSpriteKey?: string;     // separate atlas key for attack animation
  attackFrameCount?: number;    // total frames in the attack atlas
  attackFrameIndices?: number[]; // subset of frame indices to actually play (default: all)
  idleSpriteKey?: string;       // separate atlas key for idle (stationary) animation
  idleFrameCount?: number;      // total frames in the idle atlas
  displaySize?: { w: number; h: number }; // override display size (for high-res sheets)
  projectileKey?: string;       // if set, enemy fires projectiles instead of melee hits
  projectileSpeed?: number;     // projectile travel speed in px/s
  // Natural enemies spawn with the map instead of in night waves, ignore buildings/house,
  // and stay near their spawn point until a player wanders into aggro range.
  isNatural?: boolean;
  biome?: 'forest' | 'flora';   // where natural spawn points are placed
  maxAlive?: number;            // world cap on simultaneous alive instances
  respawnIntervalMs?: number;   // how often a replacement is spawned while under the cap
}

export const ENEMIES: Record<string, EnemyDefinition> = {
  skeleton: {
    id: 'skeleton', label: 'Skeleton',
    spriteKey: 'enemy-skeleton',
    hp: 10, damage: 2, speed: 55,
    attackRange: 20, attackSpeed: 0.8, aggroRange: 160,
    drops: [{ itemId: 'coin', quantity: 1, chance: 0.75 }],
    firstNight: 1, lastNight: 3,
    pathfinding: 'direct',
    animStyle: 'strip', frameCount: 6, useAtlas: true,
    attackSpriteKey: 'enemy-skeleton-attack', attackFrameCount: 6, attackFrameIndices: [0, 1, 2, 4, 5],
    displaySize: { w: 34, h: 24 },
  },
  mercenary: {
    id: 'mercenary', label: 'Mercenary',
    spriteKey: 'enemy-mercenary',
    hp: 8, damage: 2, speed: 70,
    attackRange: 20, attackSpeed: 2, aggroRange: 160,
    drops: [
      { itemId: 'coin', quantity: 1, chance: 1.00 },
      { itemId: 'coin', quantity: 2, chance: 0.50 },
      { itemId: 'coin', quantity: 2, chance: 0.25 },
    ],
    firstNight: 1, lastNight: 4,
    pathfinding: 'direct',
    animStyle: 'strip', frameCount: 6, useAtlas: true,
    displaySize: { w: 26, h: 26 },
  },
  orc: {
    id: 'orc', label: 'Orc',
    spriteKey: 'enemy-orc',
    hp: 20, damage: 4, speed: 50,
    attackRange: 150, attackSpeed: 0.9, aggroRange: 220,
    drops: [
      { itemId: 'coin', quantity: 3, chance: 0.50 },
      { itemId: 'coin', quantity: 2, chance: 0.50 },
    ],
    firstNight: 3, lastNight: -1,
    pathfinding: 'direct',
    animStyle: 'strip', frameCount: 6,
    displaySize: { w: 32, h: 35 },
    projectileKey: 'fire-projectile',
    projectileSpeed: 180,
  },
  spider: {
    id: 'spider', label: 'Spider',
    spriteKey: 'enemy-spider',
    hp: 20, damage: 3, speed: 85,
    attackRange: 22, attackSpeed: 1.3, aggroRange: 180,
    drops: [
      { itemId: 'coin', quantity: 4, chance: 0.70 },
      { itemId: 'coin', quantity: 3, chance: 0.30 },
    ],
    firstNight: 1, lastNight: -1,
    pathfinding: 'direct',
    animStyle: 'strip', frameCount: 5,
    attackSpriteKey: 'enemy-spider-attack', attackFrameCount: 6,
    displaySize: { w: 28, h: 25 },
  },
  gnome: {
    id: 'gnome', label: 'Gnome',
    spriteKey: 'enemy-gnome',
    hp: 45, damage: 5, speed: 70,
    attackRange: 20, attackSpeed: 2, aggroRange: 160,
    drops: [
      { itemId: 'coin', quantity: 4, chance: 1.00 },
      { itemId: 'coin', quantity: 2, chance: 0.50 },
      { itemId: 'coin', quantity: 1, chance: 0.25 },
    ],
    firstNight: 1, lastNight: -1,
    pathfinding: 'direct',
    animStyle: 'strip', frameCount: 6,
    attackSpriteKey: 'enemy-gnome-attack', attackFrameCount: 5,
    displaySize: { w: 34, h: 24 },
  },
  yellow_bat: {
    id: 'yellow_bat', label: 'Yellow Bat',
    spriteKey: 'enemy-yellow-bat',
    hp: 35, damage: 8, speed: 90,
    attackRange: 18, attackSpeed: 1.2, aggroRange: 220,
    // Always drops 1 coin; 85% chance for a second coin
    drops: [
      { itemId: 'coin', quantity: 1, chance: 1.00 },
      { itemId: 'coin', quantity: 1, chance: 0.85 },
    ],
    firstNight: 4, lastNight: -1,
    pathfinding: 'direct',
  },
  bear: {
    id: 'bear', label: 'Bear',
    spriteKey: 'enemy-bear',
    hp: 80, damage: 15, speed: 65,
    attackRange: 24, attackSpeed: 0.8, aggroRange: 180,
    drops: [
      { itemId: 'claw', quantity: 1, chance: 0.5 },
      { itemId: 'hide', quantity: 1, chance: 0.5 },
    ],
    firstNight: 1, lastNight: -1,
    pathfinding: 'direct',
    animStyle: 'strip', frameCount: 5, useAtlas: true,
    idleSpriteKey: 'enemy-bear-idle', idleFrameCount: 3,
    attackSpriteKey: 'enemy-bear-attack', attackFrameCount: 5,
    displaySize: { w: 46, h: 36 },
    isNatural: true, biome: 'forest', maxAlive: 6, respawnIntervalMs: 180000,
  },
};
