export interface WaveSpawnEntry {
  enemyId: string;
  count: number;
  spawnIntervalMs: number;
  spawnDelayMs: number;
}

export interface WaveDefinition {
  night: number;
  spawns: WaveSpawnEntry[];
}

export const WAVES: WaveDefinition[] = [
  {
    night: 1,
    spawns: [
      { enemyId: 'snake2',      count: 5, spawnIntervalMs: 2000, spawnDelayMs: 0 },
      { enemyId: 'gold_racoon', count: 4, spawnIntervalMs: 2500, spawnDelayMs: 1000 },
    ],
  },
  {
    night: 3,
    spawns: [
      { enemyId: 'snake2',      count: 6, spawnIntervalMs: 1800, spawnDelayMs: 0 },
      { enemyId: 'gold_racoon', count: 6, spawnIntervalMs: 2000, spawnDelayMs: 500 },
      { enemyId: 'bear',        count: 2, spawnIntervalMs: 5000, spawnDelayMs: 15000 },
    ],
  },
  {
    night: 4,
    spawns: [
      { enemyId: 'gold_racoon', count: 6, spawnIntervalMs: 1800, spawnDelayMs: 0 },
      { enemyId: 'bear',        count: 3, spawnIntervalMs: 4000, spawnDelayMs: 5000 },
      { enemyId: 'yellow_bat',  count: 2, spawnIntervalMs: 6000, spawnDelayMs: 20000 },
    ],
  },
];
