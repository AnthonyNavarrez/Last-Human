import { randomUUID } from 'crypto';
import { C } from '../src/constants';
import { ENEMIES } from '../src/data/enemies';
import { WAVES, WaveDefinition } from '../src/data/waves';
import type { Room } from './Room';
import type { InputKeys, ActionEvent, GameSnapshot, RemotePlayerSnapshot, EnemySnapshot, BuildingSnapshot, DroppedItemSnapshot } from '../shared/packets';

interface ServerPlayer {
  id: string;
  name: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  speed: number;
  keys: InputKeys;
  facing: 'up' | 'down' | 'left' | 'right';
  attackAnim: string | null;
}

interface ServerEnemy {
  id: string;
  defId: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  attackCooldownMs: number;
  knockbackMs: number;
  knockbackVx: number;
  knockbackVy: number;
}

interface SpawnTask {
  defId: string;
  fireAtMs: number;
}

const TICK_MS = 50;

export class ServerGame {
  private room: Room;
  private interval: ReturnType<typeof setInterval> | null = null;
  private lastTick = 0;

  // State
  private phase: 'day' | 'night' = 'day';
  private dayNumber: number = 1;
  private nightNumber: number = 0;
  private phaseTimerMs: number = C.DAY_DURATION_SEC * 1000;
  private houseHp: number = C.HOUSE_HP;
  private houseRegenCooldownMs: number = 0;
  private houseRegenAccumMs: number = 0;
  private waveActive = false;
  private waveTotal: number = 0;
  private waveKilled: number = 0;

  private players = new Map<string, ServerPlayer>();
  private enemies = new Map<string, ServerEnemy>();
  private spawnQueue: SpawnTask[] = [];
  private brokenNodes   = new Set<string>();
  private depletedNodes = new Set<string>();
  private buildings     = new Map<string, BuildingSnapshot>();
  private drops         = new Map<string, DroppedItemSnapshot>();

  constructor(room: Room, players: { id: string; name: string }[]) {
    this.room = room;
    for (const p of players) {
      this.players.set(p.id, {
        id: p.id,
        name: p.name,
        x: C.PLAYER_SPAWN.x,
        y: C.PLAYER_SPAWN.y,
        hp: C.PLAYER_HP,
        maxHp: C.PLAYER_HP,
        speed: C.PLAYER_SPEED,
        keys: { up: false, down: false, left: false, right: false },
        facing: 'down',
        attackAnim: null,
      });
    }
  }

  start(): void {
    this.lastTick = Date.now();
    this.interval = setInterval(() => this.tick(), TICK_MS);
  }

  stop(): void {
    if (this.interval) { clearInterval(this.interval); this.interval = null; }
  }

  addPlayer(id: string, name = 'Player'): void {
    this.players.set(id, {
      id,
      name,
      x: C.PLAYER_SPAWN.x,
      y: C.PLAYER_SPAWN.y,
      hp: C.PLAYER_HP,
      maxHp: C.PLAYER_HP,
      speed: C.PLAYER_SPEED,
      keys: { up: false, down: false, left: false, right: false },
      facing: 'down',
      attackAnim: null,
    });
  }

  removePlayer(id: string): void {
    this.players.delete(id);
  }

  handleInput(
    playerId: string,
    keys: InputKeys,
    _pointer: { x: number; y: number },
    facing: 'up' | 'down' | 'left' | 'right',
    action: ActionEvent | null,
    position?: { x: number; y: number },
    attackAnim?: string | null,
  ): void {
    const player = this.players.get(playerId);
    if (!player) return;
    player.keys = keys;
    player.facing = facing;
    if (position) { player.x = position.x; player.y = position.y; }
    if (attackAnim) player.attackAnim = attackAnim;

    if (action?.kind === 'hit-enemy') {
      const enemy = this.enemies.get(action.enemyId);
      if (enemy && enemy.hp > 0) {
        enemy.hp -= action.damage;
        if (enemy.hp <= 0) {
          enemy.hp = 0;
        } else {
          // Knock the enemy away from the attacking player
          const angle = Math.atan2(enemy.y - player.y, enemy.x - player.x);
          const force = 80;
          enemy.knockbackVx = Math.cos(angle) * force;
          enemy.knockbackVy = Math.sin(angle) * force;
          enemy.knockbackMs = 120;
        }
      }
    }

    if (action?.kind === 'node-event') {
      if (action.event === 'broken') {
        this.brokenNodes.add(action.nodeId);
      } else {
        this.brokenNodes.delete(action.nodeId);
        this.depletedNodes.add(action.nodeId);
      }
    }

    if (action?.kind === 'place-building') {
      this.buildings.set(action.buildingId, {
        id: action.buildingId,
        kind: action.buildingKind,
        x: action.x,
        y: action.y,
        nodeId: action.nodeId,
      });
    }

    if (action?.kind === 'sync-drops') {
      for (const drop of action.drops) {
        this.drops.set(drop.id, drop);
      }
    }

    if (action?.kind === 'pickup-drop') {
      this.drops.delete(action.dropId);
    }
  }

  // ─── Private tick methods ────────────────────────────────────────────────

  private tick(): void {
    const now = Date.now();
    const dt = Math.min((now - this.lastTick) / 1000, 0.1); // cap at 100ms
    this.lastTick = now;

    this.tickPhase(dt);
    this.tickPlayers(dt);
    this.tickSpawnQueue(now);
    this.tickEnemies(dt);
    this.tickHouseRegen(dt);
    this.broadcastSnapshot();
  }

  private tickPhase(dt: number): void {
    this.phaseTimerMs -= dt * 1000;

    if (this.phase === 'day' && this.phaseTimerMs <= 0) {
      this.phase = 'night';
      this.nightNumber += 1;
      this.phaseTimerMs = C.NIGHT_DURATION_SEC * 1000;
      this.startWave(this.nightNumber);
      return;
    }

    if (this.phase === 'night') {
      const allDead = this.waveKilled >= this.waveTotal && this.spawnQueue.length === 0 && this.enemies.size === 0;
      if ((this.waveActive && allDead) || this.phaseTimerMs <= 0) {
        this.endNight();
      }
    }
  }

  private startWave(nightNum: number): void {
    const wave = this.resolveWave(nightNum);
    if (!wave) { this.endNight(); return; }

    // Scale enemy count by player count: 1× solo, +60% per additional player
    const playerCount = Math.max(1, this.players.size);
    const scale = 1 + (playerCount - 1) * 0.6;

    this.waveKilled = 0;
    this.waveActive = true;
    this.spawnQueue = [];
    this.enemies.clear();

    const now = Date.now();
    let total = 0;
    for (const entry of wave.spawns) {
      const def = ENEMIES[entry.enemyId];
      if (!def) continue;
      if (nightNum < def.firstNight) continue;
      if (def.lastNight !== -1 && nightNum > def.lastNight) continue;
      const count = Math.max(1, Math.round(entry.count * scale));
      total += count;
      for (let i = 0; i < count; i++) {
        this.spawnQueue.push({
          defId: entry.enemyId,
          fireAtMs: now + entry.spawnDelayMs + i * entry.spawnIntervalMs,
        });
      }
    }
    this.waveTotal = total;
  }

  private endNight(): void {
    this.phase = 'day';
    this.dayNumber += 1;
    this.phaseTimerMs = C.DAY_DURATION_SEC * 1000;
    this.waveActive = false;
    this.spawnQueue = [];
  }

  private resolveWave(night: number): WaveDefinition | null {
    const exact = WAVES.find(w => w.night === night);
    if (exact) return exact;

    const base = [...WAVES]
      .filter(w => w.night <= night)
      .sort((a, b) => b.night - a.night)[0]
      ?? WAVES[0];
    if (!base) return null;

    const exp = night - base.night;
    return {
      night,
      spawns: base.spawns.map(s => ({
        ...s,
        count: Math.round(s.count * Math.pow(C.WAVE_BASE_ENEMY_MULTIPLIER, exp)),
        spawnIntervalMs: Math.round(s.spawnIntervalMs * Math.pow(C.WAVE_SPAWN_RATE_MULTIPLIER, exp)),
      })),
    };
  }

  private tickPlayers(dt: number): void {
    const worldW = C.MAP_WIDTH_TILES * C.TILE_SIZE;
    const worldH = C.MAP_HEIGHT_TILES * C.TILE_SIZE;

    for (const p of this.players.values()) {
      let vx = 0, vy = 0;
      if (p.keys.up)    vy -= p.speed;
      if (p.keys.down)  vy += p.speed;
      if (p.keys.left)  vx -= p.speed;
      if (p.keys.right) vx += p.speed;
      if (vx !== 0 && vy !== 0) { vx *= 0.707; vy *= 0.707; }
      p.x = Math.max(0, Math.min(worldW, p.x + vx * dt));
      p.y = Math.max(0, Math.min(worldH, p.y + vy * dt));
    }
  }

  private tickSpawnQueue(now: number): void {
    const ready = this.spawnQueue.filter(t => t.fireAtMs <= now);
    this.spawnQueue   = this.spawnQueue.filter(t => t.fireAtMs >  now);
    for (const t of ready) this.spawnEnemy(t.defId);
  }

  private spawnEnemy(defId: string): void {
    // Spawn around the house, not the players, so position is deterministic
    const angle = Math.random() * Math.PI * 2;
    const dist  = C.ENEMY_SPAWN_DIST_MIN + Math.random() * (C.ENEMY_SPAWN_DIST_MAX - C.ENEMY_SPAWN_DIST_MIN);
    const x = C.HOUSE_SPAWN.x + Math.cos(angle) * dist;
    const y = C.HOUSE_SPAWN.y + Math.sin(angle) * dist;
    const def = ENEMIES[defId];
    if (!def) return;

    const id = randomUUID();
    this.enemies.set(id, {
      id,
      defId,
      x, y,
      hp: def.hp, maxHp: def.hp,
      attackCooldownMs: 0,
      knockbackMs: 0, knockbackVx: 0, knockbackVy: 0,
    });
  }

  private tickEnemies(dt: number): void {
    const dtMs = dt * 1000;
    const dead: string[] = [];

    for (const [id, enemy] of this.enemies) {
      if (enemy.hp <= 0) {
        dead.push(id);
        this.spawnEnemyDrops(enemy);
        continue;
      }

      const def = ENEMIES[enemy.defId];
      if (!def) continue;

      // Knockback
      if (enemy.knockbackMs > 0) {
        enemy.knockbackMs -= dtMs;
        enemy.x += enemy.knockbackVx * dt;
        enemy.y += enemy.knockbackVy * dt;
        continue;
      }

      // Find nearest player
      let nearestDist: number = Infinity;
      let nearestPx: number = C.HOUSE_SPAWN.x;
      let nearestPy: number = C.HOUSE_SPAWN.y;
      let nearestPlayerId: string | null = null;
      let targetMode: 'player' | 'house' = 'house';

      for (const p of this.players.values()) {
        const d = Math.hypot(enemy.x - p.x, enemy.y - p.y);
        if (d < nearestDist) { nearestDist = d; nearestPx = p.x; nearestPy = p.y; nearestPlayerId = p.id; }
      }

      const distHouse = Math.hypot(enemy.x - C.HOUSE_SPAWN.x, enemy.y - C.HOUSE_SPAWN.y);

      if (nearestDist <= def.aggroRange) {
        targetMode = 'player';
      }

      const tx = targetMode === 'player' ? nearestPx : C.HOUSE_SPAWN.x;
      const ty = targetMode === 'player' ? nearestPy : C.HOUSE_SPAWN.y;
      const td = targetMode === 'player' ? nearestDist : distHouse;

      // Move
      if (td > def.attackRange) {
        const angle = Math.atan2(ty - enemy.y, tx - enemy.x);
        enemy.x += Math.cos(angle) * def.speed * dt;
        enemy.y += Math.sin(angle) * def.speed * dt;
      }

      // Attack
      enemy.attackCooldownMs -= dtMs;
      if (enemy.attackCooldownMs <= 0 && td <= def.attackRange) {
        enemy.attackCooldownMs = 1000 / def.attackSpeed;
        if (targetMode === 'player' && nearestPlayerId) {
          const target = this.players.get(nearestPlayerId);
          if (target && target.hp > 0) {
            target.hp = Math.max(0, target.hp - def.damage);
          }
        } else if (targetMode === 'house') {
          this.houseHp = Math.max(0, this.houseHp - def.damage);
          this.houseRegenCooldownMs = C.HOUSE_REGEN_COOLDOWN_SEC * 1000;
          this.houseRegenAccumMs = 0;
        }
      }
    }

    for (const id of dead) {
      this.enemies.delete(id);
      this.waveKilled += 1;
    }
  }

  private tickHouseRegen(dt: number): void {
    if (this.houseHp <= 0 || this.houseHp >= C.HOUSE_HP) return;
    if (this.houseRegenCooldownMs > 0) {
      this.houseRegenCooldownMs -= dt * 1000;
      return;
    }
    this.houseRegenAccumMs += dt * 1000;
    const interval = C.HOUSE_REGEN_INTERVAL_SEC * 1000;
    while (this.houseRegenAccumMs >= interval) {
      this.houseRegenAccumMs -= interval;
      this.houseHp = Math.min(C.HOUSE_HP, this.houseHp + C.HOUSE_REGEN_HP);
    }
  }

  private spawnEnemyDrops(enemy: ServerEnemy): void {
    const def = ENEMIES[enemy.defId];
    if (!def) return;
    for (const dropDef of def.drops) {
      if (Math.random() >= dropDef.chance) continue;
      for (let q = 0; q < dropDef.quantity; q++) {
        const angle = Math.random() * Math.PI * 2;
        const r = 8 + Math.random() * 20;
        const dropId = randomUUID();
        this.drops.set(dropId, {
          id: dropId,
          itemId: dropDef.itemId,
          quantity: 1,
          x: enemy.x + Math.cos(angle) * r,
          y: enemy.y + Math.sin(angle) * r,
        });
      }
    }
  }

  private broadcastSnapshot(): void {
    const enemies: EnemySnapshot[] = [];
    for (const e of this.enemies.values()) {
      if (e.hp > 0) enemies.push({ id: e.id, defId: e.defId, x: e.x, y: e.y, hp: e.hp, maxHp: e.maxHp });
    }

    const players: RemotePlayerSnapshot[] = [];
    for (const p of this.players.values()) {
      players.push({ id: p.id, name: p.name, x: p.x, y: p.y, hp: p.hp, maxHp: p.maxHp, facing: p.facing, attackAnim: p.attackAnim });
      p.attackAnim = null; // clear after one broadcast
    }

    const snapshot: GameSnapshot = {
      phase: this.phase,
      phaseTimerSec: this.phaseTimerMs / 1000,
      nightNumber: this.nightNumber,
      dayNumber: this.dayNumber,
      houseHp: this.houseHp,
      waveActive: this.waveActive,
      enemies,
      players,
      depletedNodeIds: [...this.depletedNodes],
      brokenNodeIds:   [...this.brokenNodes],
      buildings:       [...this.buildings.values()],
      drops:           [...this.drops.values()],
    };

    this.room.broadcast({ type: 'state-snapshot', snapshot });
  }
}
