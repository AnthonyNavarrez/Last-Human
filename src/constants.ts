export const C = {
  // Canvas
  CANVAS_WIDTH:  960,
  CANVAS_HEIGHT: 540,

  // World
  TILE_SIZE:         16,
  MAP_WIDTH_TILES:   200,
  MAP_HEIGHT_TILES:  200,
  PLAYER_SPAWN:      { x: 1600, y: 1600 },
  CAMERA_ZOOM:       2,

  // Phase
  DAY_DURATION_SEC:  60,
  NIGHT_DURATION_SEC: 20,

  // Player
  PLAYER_HP:     50,
  PLAYER_SPEED:  120,
  INTERACT_RANGE: 48,

  // Inventory
  HOTBAR_SIZE:    8,
  INVENTORY_ROWS: 4,
  INVENTORY_COLS: 8,

  // House
  HOUSE_HP:                 150,
  HOUSE_REGEN_HP:           1,
  HOUSE_REGEN_INTERVAL_SEC: 4,
  HOUSE_REGEN_COOLDOWN_SEC: 15,

  // Wave scaling (night 4+)
  WAVE_BASE_ENEMY_MULTIPLIER: 1.3,
  WAVE_SPAWN_RATE_MULTIPLIER: 0.9,

  // Z-depth
  DEPTH_GROUND:       0,
  DEPTH_OBJECTS:      10,
  DEPTH_PLAYER:       20,
  DEPTH_ENEMIES:      20,
  DEPTH_PROJECTILES:  25,
  DEPTH_DROPPED_ITEMS: 5,
  DEPTH_UI:           100,

  // Auto Miner
  AUTO_MINER_WOOD_POWER: 3,      // 1 wood → 3 mining hits
  AUTO_MINER_RANGE: 80,           // pixels — how far it searches for a resource node
  AUTO_MINER_INTERVAL_MS: 2000,   // ms between hits (halved with pickaxe installed)

  // Combat
  PUNCH_INTERVAL_MS: 400,
  PICKUP_RANGE: 40,

  // Buildings — fixed spawn positions for MVP
  CRAFTING_BENCH_SPAWN: { x: 1500, y: 1560 },
  HOUSE_SPAWN:          { x: 1700, y: 1620 },

  // Enemy spawning
  ENEMY_SPAWN_DIST_MIN: 320,
  ENEMY_SPAWN_DIST_MAX: 500,
} as const;
