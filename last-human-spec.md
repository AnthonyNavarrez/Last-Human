# Last Human — Claude Code Project Spec

> 2D top-down pixel art survival wave defense game.
> Built with Phaser 3 + Vite. Deployable to Vercel/GitHub Pages with zero setup for players.

---

## 0. How to Use This Spec

This document is the single source of truth for the Claude Code implementation. Follow it precisely. When a section says "extensible," write it so adding new entries requires only data changes, not structural changes. When a section says "future," do not implement it in the MVP — but architect so it slots in cleanly.

---

## 1. Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | **Phaser 3** (latest) | Scene system, arcade physics, tilemaps, input |
| Bundler | **Vite** | Fast HMR, clean build output |
| Language | **TypeScript** | Strict mode. No `any`. |
| Multiplayer (future) | **PartyKit** | Designed to layer on top of the state architecture below |
| Persistence | **localStorage** | High score, settings. No backend for MVP. |
| Deployment | **Vercel** | `vite build` → deploy. Zero config. |

### Dependency versions (install these exactly)
```
phaser@^3.80.0
vite@^5.0.0
typescript@^5.4.0
```

---

## 2. Project Structure

```
last-human/
├── public/
│   └── assets/
│       ├── sprites/        # All spritesheets (.png + .json atlas)
│       ├── tiles/          # Tileset PNG + Tiled .json map files
│       ├── audio/          # SFX + music (.ogg preferred, .mp3 fallback)
│       └── fonts/          # Bitmap font files
├── src/
│   ├── main.ts             # Phaser game config + boot
│   ├── constants.ts        # All magic numbers live here. Never inline.
│   ├── registry.ts         # Phaser DataManager keys (typed enum)
│   │
│   ├── scenes/
│   │   ├── BootScene.ts    # Preload all assets
│   │   ├── MainMenuScene.ts
│   │   ├── GameScene.ts    # Core game loop
│   │   ├── UIScene.ts      # Runs in parallel with GameScene (Phaser scene layering)
│   │   ├── PauseScene.ts
│   │   └── GameOverScene.ts
│   │
│   ├── systems/            # Pure logic, no Phaser scene coupling
│   │   ├── GameState.ts    # THE canonical state object (see §4)
│   │   ├── WaveSystem.ts   # Wave progression, spawn scheduling
│   │   ├── CraftingSystem.ts
│   │   ├── InventorySystem.ts
│   │   ├── DayNightSystem.ts
│   │   └── PhysicsHelpers.ts
│   │
│   ├── entities/
│   │   ├── Player.ts
│   │   ├── enemies/
│   │   │   ├── BaseEnemy.ts      # Abstract base
│   │   │   ├── Snake2.ts
│   │   │   ├── GoldRacoon.ts
│   │   │   ├── Bear.ts
│   │   │   └── YellowBat.ts
│   │   ├── buildings/
│   │   │   ├── BaseBuilding.ts   # Abstract base
│   │   │   ├── House.ts
│   │   │   ├── CraftingBench.ts
│   │   │   └── AutoMiner.ts
│   │   └── items/
│   │       ├── DroppedItem.ts
│   │       └── Projectile.ts
│   │
│   ├── data/               # Pure data files. Extending the game = editing these.
│   │   ├── enemies.ts      # EnemyDefinition[]
│   │   ├── items.ts        # ItemDefinition[]
│   │   ├── recipes.ts      # RecipeDefinition[]
│   │   ├── buildings.ts    # BuildingDefinition[]
│   │   ├── waves.ts        # WaveDefinition[]
│   │   └── upgrades.ts     # UpgradeDefinition[]
│   │
│   └── ui/
│       ├── Hotbar.ts
│       ├── InventoryGrid.ts
│       ├── CraftingMenu.ts
│       ├── UpgradeMenu.ts
│       ├── DayNightTimer.ts
│       └── HealthBar.ts
│
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

---

## 3. Scene Architecture

### Scene Stack at Runtime
```
BootScene        → loads all assets, transitions to MainMenuScene
MainMenuScene    → play button → starts GameScene + UIScene
GameScene        → core world: physics, entities, tilemap (key: 'game')
UIScene          → HUD overlay, runs parallel to GameScene (key: 'ui')
PauseScene       → launched on top of game+ui when paused
GameOverScene    → replaces game+ui on death or house destruction
```

### Scene Communication
Scenes communicate via `this.game.registry` (Phaser's global DataManager). UIScene reads from registry; GameScene writes to registry. No direct scene-to-scene method calls.

Registry keys are typed enums in `src/registry.ts`:
```typescript
export enum R {
  PLAYER_HP        = 'player_hp',
  PLAYER_MAX_HP    = 'player_max_hp',
  HOUSE_HP         = 'house_hp',
  HOUSE_MAX_HP     = 'house_max_hp',
  INVENTORY        = 'inventory',
  HOTBAR           = 'hotbar',
  ACTIVE_SLOT      = 'active_slot',
  DAY_NUMBER       = 'day_number',
  PHASE            = 'phase',          // 'day' | 'night'
  PHASE_TIMER      = 'phase_timer',    // seconds remaining
  WAVE_ACTIVE      = 'wave_active',
  ENEMIES_REMAINING = 'enemies_remaining',
  NIGHT_NUMBER     = 'night_number',
}
```

---

## 4. Game State (Multiplayer-Ready Architecture)

This is the most important architectural decision. All mutable game state lives in one serializable object. This makes multiplayer a network sync problem, not a rewrite.

```typescript
// src/systems/GameState.ts

export interface Vec2 { x: number; y: number; }

export interface ItemStack {
  itemId: string;   // references data/items.ts
  quantity: number;
}

export interface EntityState {
  id: string;         // uuid
  type: string;       // references data/enemies.ts or data/buildings.ts
  position: Vec2;
  hp: number;
  maxHp: number;
}

export interface PlayerState extends EntityState {
  playerId: string;
  inventory: (ItemStack | null)[];   // length = INVENTORY_SIZE
  hotbar: (ItemStack | null)[];      // length = HOTBAR_SIZE
  activeSlot: number;
  facing: 'up' | 'down' | 'left' | 'right';
  velocity: Vec2;
}

export interface GameState {
  // Phase
  phase: 'day' | 'night';
  dayNumber: number;
  nightNumber: number;
  phaseTimer: number;        // seconds remaining in current phase

  // Entities
  players: Record<string, PlayerState>;
  enemies: Record<string, EntityState>;
  buildings: Record<string, EntityState & { ownerId: string }>;
  droppedItems: Record<string, { itemId: string; quantity: number; position: Vec2 }>;
  projectiles: Record<string, { ownerId: string; position: Vec2; velocity: Vec2; damage: number }>;

  // Wave
  waveActive: boolean;
  enemiesRemainingThisWave: number;
}

export function createInitialState(localPlayerId: string): GameState { ... }
```

**Rule:** GameScene reads `gameState` and syncs Phaser sprites to it. It never mutates Phaser objects as the source of truth — the state object is always the source of truth. Systems mutate the state; Phaser renders it.

**Why this enables multiplayer:** In single-player, state updates happen locally each frame. In multiplayer, the host broadcasts the delta; clients apply it. The Phaser rendering layer is identical either way.

---

## 5. Data Files (The Extension Points)

Adding content = adding entries to these files. No other code changes needed for basic additions.

### `src/data/items.ts`
```typescript
export interface ItemDefinition {
  id: string;
  label: string;
  description: string;
  spriteKey: string;
  frameIndex: number;
  maxStack: number;
  type: 'resource' | 'tool' | 'weapon' | 'ammo' | 'placeable' | 'consumable';
  // Tool/weapon stats (optional)
  damage?: number;
  durability?: number;          // undefined = infinite
  gatheringPower?: Record<string, number>; // { 'tree': 1, 'rock': 1 } = hits to gather
  // Weapon stats
  range?: number;
  attackSpeed?: number;         // attacks per second
  projectileId?: string;        // if ranged
  // Placeable
  buildingId?: string;          // spawns this building when placed
}

export const ITEMS: Record<string, ItemDefinition> = {
  wood:          { id: 'wood',          label: 'Wood',          ... },
  stone:         { id: 'stone',         label: 'Stone',         ... },
  iron_ore:      { id: 'iron_ore',      label: 'Iron Ore',      ... },
  copper_ore:    { id: 'copper_ore',    label: 'Copper Ore',    ... },
  leather:       { id: 'leather',       label: 'Leather',       ... },
  blueberry:     { id: 'blueberry',     label: 'Blueberry',     ... },
  gem:           { id: 'gem',           label: 'Gem',           ... },
  stone_axe:     { ... },
  stone_pickaxe: { ... },
  stone_sword:   { ... },
  copper_sword:  { ... },
  pistol:        { ... },
  bullet:        { ... },
  repair_hammer: { id: 'repair_hammer', label: 'Repair Hammer', durability: 10, ... },
  auto_miner:    { id: 'auto_miner',    type: 'placeable', buildingId: 'auto_miner', ... },
};
```

### `src/data/recipes.ts`
```typescript
export interface RecipeDefinition {
  id: string;
  label: string;
  stationId: 'hand' | 'crafting_bench'; // extensible: add 'furnace', 'forge', etc.
  inputs: { itemId: string; quantity: number }[];
  outputs: { itemId: string; quantity: number }[];
  craftTimeMs: number;
}

export const RECIPES: RecipeDefinition[] = [
  {
    id: 'stone_pickaxe',
    label: 'Stone Pickaxe',
    stationId: 'crafting_bench',
    inputs: [{ itemId: 'wood', quantity: 5 }, { itemId: 'stone', quantity: 10 }],
    outputs: [{ itemId: 'stone_pickaxe', quantity: 1 }],
    craftTimeMs: 1000,
  },
  // ... all recipes from spec
];
```

### `src/data/enemies.ts`
```typescript
export interface EnemyDefinition {
  id: string;
  label: string;
  spriteKey: string;
  hp: number;
  damage: number;
  speed: number;             // pixels per second
  attackRange: number;
  attackSpeed: number;       // attacks per second
  aggroRange: number;        // switches target to player within this range
  drops: { itemId: string; quantity: number; chance: number }[];
  firstNight: number;        // which night this enemy type first appears
  lastNight: number;         // last night this enemy appears (-1 = no limit)
  pathfinding: 'direct' | 'steering'; // direct = straight line, steering = avoidance
}

export const ENEMIES: Record<string, EnemyDefinition> = {
  snake2: {
    id: 'snake2', label: 'Snake',
    spriteKey: 'enemy-snake2',
    hp: 10, damage: 2, speed: 55,
    drops: [{ itemId: 'gem', quantity: 1, chance: 0.75 }],
    firstNight: 1, lastNight: 3,
    pathfinding: 'direct',
  },
  gold_racoon: {
    id: 'gold_racoon', label: 'Gold Raccoon',
    spriteKey: 'enemy-gold-racoon',
    hp: 8, damage: 1, speed: 65,
    drops: [{ itemId: 'gem', quantity: 1, chance: 0.50 }],
    firstNight: 1, lastNight: 4,
    pathfinding: 'direct',
  },
  bear: {
    id: 'bear', label: 'Bear',
    spriteKey: 'enemy-bear',
    hp: 20, damage: 5, speed: 45,
    drops: [
      { itemId: 'gem', quantity: 1, chance: 1.00 },
      { itemId: 'gem', quantity: 1, chance: 0.75 },
    ],
    firstNight: 3, lastNight: 6,
    pathfinding: 'direct',
  },
  yellow_bat: {
    id: 'yellow_bat', label: 'Yellow Bat',
    spriteKey: 'enemy-yellow-bat',
    hp: 35, damage: 8, speed: 90,
    drops: [
      { itemId: 'gem', quantity: 1, chance: 1.00 },
      { itemId: 'gem', quantity: 1, chance: 0.85 },
    ],
    firstNight: 4, lastNight: -1,
    pathfinding: 'direct',
  },
};
```

### `src/data/waves.ts`
```typescript
export interface WaveSpawnEntry {
  enemyId: string;
  count: number;
  spawnIntervalMs: number;   // delay between each spawn of this type
  spawnDelayMs: number;      // delay from wave start before this type begins spawning
}

export interface WaveDefinition {
  night: number;             // -1 = applies to all nights above a threshold (use scaling)
  spawns: WaveSpawnEntry[];
}

// Night 1, 2, 3 defined explicitly. Night 4+ uses scaling formula in WaveSystem.ts.
export const WAVES: WaveDefinition[] = [
  { night: 1, spawns: [
    { enemyId: 'snake2',     count: 5, spawnIntervalMs: 2000, spawnDelayMs: 0 },
    { enemyId: 'gold_racoon', count: 4, spawnIntervalMs: 2500, spawnDelayMs: 1000 },
  ]},
  { night: 3, spawns: [
    { enemyId: 'snake2',     count: 6, spawnIntervalMs: 1800, spawnDelayMs: 0 },
    { enemyId: 'gold_racoon', count: 6, spawnIntervalMs: 2000, spawnDelayMs: 500 },
    { enemyId: 'bear',       count: 2, spawnIntervalMs: 5000, spawnDelayMs: 15000 },
  ]},
  { night: 4, spawns: [
    { enemyId: 'gold_racoon', count: 6, spawnIntervalMs: 1800, spawnDelayMs: 0 },
    { enemyId: 'bear',       count: 3, spawnIntervalMs: 4000, spawnDelayMs: 5000 },
    { enemyId: 'yellow_bat', count: 2, spawnIntervalMs: 6000, spawnDelayMs: 20000 },
  ]},
];
```

### `src/data/buildings.ts`
```typescript
export interface BuildingDefinition {
  id: string;
  label: string;
  spriteKey: string;
  hp: number;
  size: { width: number; height: number };  // in tiles
  isDestructible: boolean;
  regenHpPerSec?: number;       // House has conditional regen
  regenCooldownMs?: number;
  interactionLabel?: string;    // Text shown on E press
  levels?: BuildingLevelDefinition[];  // if upgradeable
}

export interface BuildingLevelDefinition {
  level: number;
  hp: number;
  upgradeCost: { itemId: string; quantity: number }[];
  unlocks?: string[];   // feature flags unlocked at this level
}

export const BUILDINGS: Record<string, BuildingDefinition> = {
  house: {
    id: 'house', label: 'House',
    hp: 150,
    isDestructible: true,
    regenHpPerSec: 0.25,         // 1 HP per 4 seconds
    regenCooldownMs: 15000,
    interactionLabel: 'Upgrade House',
    levels: [
      { level: 1, hp: 150, upgradeCost: [] },
      // Future levels added here
    ],
  },
  crafting_bench: { ... },
  auto_miner: { ... },
};
```

### `src/data/upgrades.ts`
```typescript
export interface UpgradeDefinition {
  id: string;
  label: string;
  description: string;
  targetId: string;              // buildingId this upgrade applies to
  requiredLevel: number;
  cost: { itemId: string; quantity: number }[];
  effect: Record<string, number | string | boolean>; // applied to building/game state
}
// Populated as content expands. Empty array is valid for MVP.
export const UPGRADES: UpgradeDefinition[] = [];
```

---

## 6. Constants

All magic numbers in `src/constants.ts`. Never inline numbers in game logic.

```typescript
export const C = {
  // World
  TILE_SIZE:          16,
  MAP_WIDTH_TILES:    64,
  MAP_HEIGHT_TILES:   64,
  PLAYER_SPAWN:       { x: 512, y: 512 },

  // Phase
  DAY_DURATION_SEC:   180,   // 3 minutes
  NIGHT_DURATION_SEC: 60,    // 1 minute

  // Player
  PLAYER_HP:          50,
  PLAYER_SPEED:       120,   // pixels per second
  INTERACT_RANGE:     48,    // pixels

  // Inventory
  HOTBAR_SIZE:        8,
  INVENTORY_ROWS:     4,
  INVENTORY_COLS:     8,

  // House
  HOUSE_HP:           150,
  HOUSE_REGEN_HP:     1,
  HOUSE_REGEN_INTERVAL_SEC: 4,
  HOUSE_REGEN_COOLDOWN_SEC: 15,

  // Wave scaling (for night 4+)
  WAVE_BASE_ENEMY_MULTIPLIER: 1.3,   // enemies *= this per night
  WAVE_SPAWN_RATE_MULTIPLIER: 0.9,   // interval *= this per night (speeds up)

  // Z-depth (Phaser depth values)
  DEPTH_GROUND:       0,
  DEPTH_OBJECTS:      10,
  DEPTH_PLAYER:       20,
  DEPTH_ENEMIES:      20,
  DEPTH_PROJECTILES:  25,
  DEPTH_DROPPED_ITEMS: 5,
  DEPTH_UI:           100,

  // Auto Miner
  AUTO_MINER_WOOD_POWER: 3,   // 1 wood = 3 power
};
```

---

## 7. Entity Implementation

### Player (`src/entities/Player.ts`)

Phaser `Physics.Arcade.Sprite` subclass.

```
Input polling each frame (WASD + mouse):
  - Movement: set velocity from WASD, normalize diagonal
  - Attack: LMB fires active tool/weapon logic
  - Interact: E key → raycast within INTERACT_RANGE → call interact() on nearest building
  - Hotbar switch: 1–8 keys or scroll wheel

Each frame: sync position back to GameState.players[localPlayerId].position
```

Attack dispatch based on active item type:
- `tool` → melee arc, check resource nodes in range
- `weapon` (melee) → melee arc, check enemy hitboxes
- `weapon` (ranged) → spawn Projectile entity, deduct ammo
- `placeable` → show ghost sprite, on LMB confirm → call PlacementSystem

### BaseEnemy (`src/entities/enemies/BaseEnemy.ts`)

Abstract class. Concrete enemies extend it and set their EnemyDefinition.

```
Each frame:
  1. Find target: player if within aggroRange, else house
  2. Move toward target (direct or steering per definition)
  3. If within attackRange and cooldown elapsed: deal damage to target
  4. On death: roll drops, spawn DroppedItems, remove from GameState
```

Steering pathfinding (for future complex enemies): use simple separation vectors between nearby enemies to avoid clumping. No navmesh for MVP.

### BaseBuilding (`src/entities/buildings/BaseBuilding.ts`)

Abstract class. Manages HP, regen logic, interaction prompt.

House: on HP reaching 0, emit `'game-over'` event to GameScene.

AutoMiner: internal tick every N ms. Check fuel slot, pickaxe slot, facing tile type. If all valid, decrement power, apply gather hit to target resource node.

---

## 8. Systems

### DayNightSystem

Manages phase transitions. Each frame decrements `gameState.phaseTimer`.

On timer reaching 0:
- Day → Night: set `phase = 'night'`, reset timer to `NIGHT_DURATION_SEC`, emit `'night-start'`
- Night → Day: set `phase = 'day'`, reset timer, increment `dayNumber`, emit `'day-start'`

`'night-start'` is consumed by WaveSystem.

### WaveSystem

On `'night-start'`: look up `WAVES` for current night. If not found, generate scaled wave using:
```typescript
scaledCount = baseCount * C.WAVE_BASE_ENEMY_MULTIPLIER ** (nightNumber - 3)
scaledInterval = baseInterval * C.WAVE_SPAWN_RATE_MULTIPLIER ** (nightNumber - 3)
```

Schedules spawn events via Phaser's `scene.time.addEvent`. Each event calls `spawnEnemy(enemyId, position)` which creates an entity and registers it in `gameState.enemies`.

Spawn positions: random point on map edge (outside camera view).

### InventorySystem

Pure functions. No Phaser coupling.

```typescript
addItem(inventory: Slot[], itemId: string, quantity: number): boolean
removeItem(inventory: Slot[], itemId: string, quantity: number): boolean
hasItems(inventory: Slot[], requirements: {itemId: string, quantity: number}[]): boolean
moveItem(from: Slot[], fromIndex: number, to: Slot[], toIndex: number): void
```

### CraftingSystem

```typescript
canCraft(inventory: Slot[], recipe: RecipeDefinition): boolean
craft(inventory: Slot[], recipe: RecipeDefinition): Slot[]  // returns new inventory state
getAvailableRecipes(inventory: Slot[], stationId: string): RecipeDefinition[]
```

---

## 9. Map & Tilemap

Use **Tiled** (free) to create the map. Export as JSON. Load in BootScene.

Layer structure (in Tiled):
```
ground          - base terrain (grass, dirt)
above-ground    - paths, details (no collision)
objects         - trees, rocks, ore (collidable, harvestable)
buildings       - house, crafting bench start positions
collision       - invisible collision layer
```

Resource nodes (trees, rocks, ore): stored as Tiled object layer entries. On game start, instantiate them from the object layer. Each has HP based on tool hits required × a constant. When HP reaches 0, remove sprite, drop items, start respawn timer (optional for MVP: no respawn).

---

## 10. UI Architecture

UIScene runs in parallel. It reads from `game.registry` each frame and redraws only when values change (dirty flag pattern).

Components:
- **Hotbar**: 8 slots at bottom center. Active slot highlighted. Shows item sprite + quantity.
- **InventoryGrid**: full-screen overlay toggled with E. Drag-and-drop between slots.
- **CraftingMenu**: shown when interacting with CraftingBench. Shows available recipes, ingredient counts (green if met, red if not), craft button.
- **UpgradeMenu**: shown when interacting with House. Shows current level, upgrade cost, upgrade button.
- **DayNightTimer**: top center. Shows phase icon + MM:SS countdown. Color shifts at 30s warning.
- **HealthBars**: player HP (bottom left), house HP (top right corner). Simple pixel-art bars.
- **WaveIndicator**: "Night 3 — Wave incoming" banner that animates in at night start.

---

## 11. Input Map

```typescript
// All keys defined in one place in GameScene.create()
this.keys = this.input.keyboard.addKeys({
  up:       Phaser.Input.Keyboard.KeyCodes.W,
  down:     Phaser.Input.Keyboard.KeyCodes.S,
  left:     Phaser.Input.Keyboard.KeyCodes.A,
  right:    Phaser.Input.Keyboard.KeyCodes.D,
  interact: Phaser.Input.Keyboard.KeyCodes.E,
  inventory:Phaser.Input.Keyboard.KeyCodes.E,  // same key, context-sensitive
  pause:    Phaser.Input.Keyboard.KeyCodes.ESC,
  slot1:    Phaser.Input.Keyboard.KeyCodes.ONE,
  // ... slot2–8
});
this.input.mouse.disableContextMenu();
```

---

## 12. Audio

All audio managed in a single `AudioManager` helper. Plays sounds via Phaser's sound manager. Volume settings stored in localStorage.

Sound keys to preload (placeholder for actual assets):
```
bgm_day, bgm_night,
sfx_attack_melee, sfx_attack_ranged, sfx_gather,
sfx_enemy_hit, sfx_enemy_death,
sfx_house_hit, sfx_craft,
sfx_day_start, sfx_night_start, sfx_game_over
```

---

## 13. Multiplayer Readiness Checklist

Do not implement multiplayer in MVP. Do implement these patterns:

- [ ] All state in `GameState` object (§4) — no game logic in Phaser sprite properties
- [ ] Entity IDs are UUIDs (use `crypto.randomUUID()`)
- [ ] All mutations go through system functions, not direct property sets
- [ ] No `Date.now()` in game logic — use Phaser's `delta` time from `update(delta)`
- [ ] `localPlayerId` is a constant passed into systems, not assumed to be a singleton
- [ ] `GameScene.update()` is structured as: apply inputs → run systems → sync sprites → sync registry
- [ ] Phaser physics used for collision detection only, not as source of truth for position

When adding multiplayer (PartyKit):
1. Extract input handling into an `InputBuffer` that can be either local or received from network
2. Add a `NetworkSystem` that broadcasts local state delta and applies remote deltas
3. The rest of the codebase is untouched

---

## 14. MVP Scope (What Claude Code Builds First)

Implement exactly this and nothing more. In order:

1. **Project scaffold** — Vite + Phaser 3 + TypeScript, all scenes wired, blank game loads
2. **Tilemap** — load map, render ground layer, collision layer working
3. **Player** — spawns, WASD movement, sprite animates, camera follows
4. **Resource nodes** — trees and rocks on map, player can punch them, items drop
5. **Inventory + Hotbar** — items collect into inventory, hotbar renders, slot switching works
6. **Crafting** — CraftingBench interaction, CraftingMenu UI, stone axe/pickaxe recipes working
7. **Day/Night cycle** — timer runs, phase transitions, UI timer display
8. **Wave system** — enemies spawn at night, pathfind to player/house, deal damage
9. **House** — placed on map, has HP, enemies target it, game over on destruction
10. **Game over + restart** — GameOverScene, restart returns to clean GameScene
11. **Remaining items** — all items/recipes from spec implemented
12. **Auto Miner** — placeable, fuel/pickaxe slot UI, mines automatically
13. **Polish pass** — screen shake on hit, particle on death, sound effects, day/night visual transition

Do not add placeholder UI, `TODO` comments, or stub functions that silently do nothing. Every implemented feature must work end to end.

---

## 15. Out of Scope for MVP

- Multiplayer (architecture supports it — do not implement)
- Mobile touch controls
- Procedural map generation (use hand-authored Tiled map)
- Blueberry food/healing system
- House upgrade levels beyond Level 1 (UpgradeMenu UI exists, no upgrades purchasable)
- Leaderboard / backend
- More enemy types beyond the 4 in spec
- Save/load (game resets on refresh)

---

## 16. Code Quality Rules

- TypeScript strict mode. No suppressions.
- No inline magic numbers. All in `constants.ts`.
- No direct `gameObject.x = value` as game logic — always go through GameState first, then sync.
- Every public method has a JSDoc comment (one line is fine).
- `console.error` on all caught exceptions. No silent failures.
- Asset keys are typed string enums in `registry.ts`, not raw strings.
- Phaser `preload()` loads everything. No lazy asset loading.
