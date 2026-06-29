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
      { enemyId: 'skeleton',  count: 4, spawnIntervalMs: 2200, spawnDelayMs: 0 },
      { enemyId: 'mercenary', count: 2, spawnIntervalMs: 3000, spawnDelayMs: 5000 },
      { enemyId: 'spider',    count: 2, spawnIntervalMs: 3500, spawnDelayMs: 6000 },
    ],
  },
  {
    night: 3,
    spawns: [
      { enemyId: 'skeleton',  count: 5, spawnIntervalMs: 1800, spawnDelayMs: 0 },
      { enemyId: 'mercenary', count: 4, spawnIntervalMs: 2500, spawnDelayMs: 3000 },
      { enemyId: 'orc',       count: 2, spawnIntervalMs: 5000, spawnDelayMs: 8000 },
      { enemyId: 'spider',    count: 3, spawnIntervalMs: 2800, spawnDelayMs: 4000 },
    ],
  },
  {
    night: 4,
    spawns: [
      { enemyId: 'mercenary',  count: 4, spawnIntervalMs: 2000, spawnDelayMs: 0 },
      { enemyId: 'orc',        count: 3, spawnIntervalMs: 4000, spawnDelayMs: 5000 },
      { enemyId: 'yellow_bat', count: 2, spawnIntervalMs: 6000, spawnDelayMs: 20000 },
      { enemyId: 'spider',     count: 4, spawnIntervalMs: 2500, spawnDelayMs: 3000 },
    ],
  },
];
