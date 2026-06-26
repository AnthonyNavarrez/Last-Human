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
}

export const ENEMIES: Record<string, EnemyDefinition> = {
  snake2: {
    id: 'snake2', label: 'Snake',
    spriteKey: 'enemy-snake2',
    hp: 10, damage: 2, speed: 55,
    attackRange: 20, attackSpeed: 0.8, aggroRange: 160,
    drops: [{ itemId: 'gem', quantity: 1, chance: 0.75 }],
    firstNight: 1, lastNight: 3,
    pathfinding: 'direct',
  },
  gold_racoon: {
    id: 'gold_racoon', label: 'Gold Raccoon',
    spriteKey: 'enemy-gold-racoon',
    hp: 8, damage: 1, speed: 65,
    attackRange: 20, attackSpeed: 0.7, aggroRange: 140,
    drops: [{ itemId: 'gem', quantity: 1, chance: 0.50 }],
    firstNight: 1, lastNight: 4,
    pathfinding: 'direct',
  },
  bear: {
    id: 'bear', label: 'Bear',
    spriteKey: 'enemy-bear',
    hp: 20, damage: 5, speed: 45,
    attackRange: 28, attackSpeed: 0.5, aggroRange: 180,
    // Always drops 1 gem; 75% chance for a second gem
    drops: [
      { itemId: 'gem',     quantity: 1, chance: 1.00 },
      { itemId: 'gem',     quantity: 1, chance: 0.75 },
      { itemId: 'leather', quantity: 1, chance: 0.60 },
    ],
    firstNight: 3, lastNight: 6,
    pathfinding: 'direct',
  },
  yellow_bat: {
    id: 'yellow_bat', label: 'Yellow Bat',
    spriteKey: 'enemy-yellow-bat',
    hp: 35, damage: 8, speed: 90,
    attackRange: 18, attackSpeed: 1.2, aggroRange: 220,
    // Always drops 1 gem; 85% chance for a second gem
    drops: [
      { itemId: 'gem', quantity: 1, chance: 1.00 },
      { itemId: 'gem', quantity: 1, chance: 0.85 },
    ],
    firstNight: 4, lastNight: -1,
    pathfinding: 'direct',
  },
};
