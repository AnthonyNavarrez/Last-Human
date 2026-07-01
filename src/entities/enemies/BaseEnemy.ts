import Phaser from 'phaser';
import { C } from '../../constants';
import { EnemyDefinition } from '../../data/enemies';

const BAR_W = 16;
const BAR_H = 3;
const BAR_OFFSET_Y = 11; // pixels above enemy centre

interface EnemyTickResult {
  playerDmg: number;
  houseDmg: number;
  buildingDmg: number;
  buildingIdx: number;
  projectile: { x: number; y: number; angle: number; key: string; speed: number; damage: number } | null;
}

export class BaseEnemy extends Phaser.Physics.Arcade.Sprite {
  private readonly def: EnemyDefinition;
  private _hp: number;
  private attackCooldownMs = 0;
  private knockbackMs = 0;
  private isPlayingAttack = false;
  private cachedDrops: { itemId: string; quantity: number }[] | null = null;
  private hpBarBg!: Phaser.GameObjects.Rectangle;
  private hpBarFill!: Phaser.GameObjects.Rectangle;
  // Natural enemies: spawn point they wander back to, and whether they're currently chasing a player
  private readonly origin: { x: number; y: number };
  private naturalAggro = false;
  // Multiplayer interpolation
  private mpTargetX = 0;
  private mpTargetY = 0;
  private mpReady = false;

  constructor(scene: Phaser.Scene, x: number, y: number, def: EnemyDefinition) {
    super(scene, x, y, def.spriteKey, 0);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.def = def;
    this._hp = def.hp;
    this.origin = { x, y };
    this.setDepth(C.DEPTH_ENEMIES);
    this.setCollideWorldBounds(true);
    this.registerAnimations();
    this.play(def.idleSpriteKey ? `${def.idleSpriteKey}-anim` : `${def.spriteKey}-walk-down`);
    if (def.displaySize) this.setDisplaySize(def.displaySize.w, def.displaySize.h);

    this.hpBarBg = scene.add.rectangle(x - BAR_W / 2, y - BAR_OFFSET_Y, BAR_W, BAR_H, 0x222222)
      .setOrigin(0, 0.5).setDepth(C.DEPTH_ENEMIES + 2).setVisible(false);
    this.hpBarFill = scene.add.rectangle(x - BAR_W / 2, y - BAR_OFFSET_Y, BAR_W, BAR_H, 0x22cc44)
      .setOrigin(0, 0.5).setDepth(C.DEPTH_ENEMIES + 3).setVisible(false);
  }

  get isDead(): boolean { return this._hp <= 0; }

  /** The enemy definition id (e.g. 'bear'), used to count alive instances per type. */
  get enemyId(): string { return this.def.id; }

  /**
   * Move toward player (if within aggroRange), nearest blocking canon, or house.
   * Returns damage dealt to each target this tick.
   */
  tick(
    delta: number,
    playerX: number, playerY: number,
    houseX: number,  houseY: number,
    buildings: { x: number; y: number; isDead: boolean }[] = [],
  ): EnemyTickResult {
    const NONE = { playerDmg: 0, houseDmg: 0, buildingDmg: 0, buildingIdx: -1, projectile: null } as const;
    if (this._hp <= 0) { this.setVelocity(0, 0); return NONE; }
    if (this.knockbackMs > 0) { this.knockbackMs -= delta; return NONE; }

    if (this.def.isNatural) return this.tickNatural(delta, playerX, playerY);

    const distToPlayer = Phaser.Math.Distance.Between(this.x, this.y, playerX, playerY);
    const distToHouse  = Phaser.Math.Distance.Between(this.x, this.y, houseX,  houseY);

    const attackingHouse      = distToHouse <= this.def.attackRange;
    const effectiveAggroRange = attackingHouse ? this.def.attackRange * 2 : this.def.aggroRange;
    const aggroPlayer         = distToPlayer <= effectiveAggroRange;

    // Buildings block the path to whichever primary target is active (player or house).
    // A building is only considered if it is closer to this enemy than that primary target.
    const primaryDist = aggroPlayer ? distToPlayer : distToHouse;
    let nearestBuildingIdx  = -1;
    let nearestBuildingDist = primaryDist;
    for (let i = 0; i < buildings.length; i++) {
      if (buildings[i].isDead) continue;
      const d = Phaser.Math.Distance.Between(this.x, this.y, buildings[i].x, buildings[i].y);
      if (d < nearestBuildingDist) { nearestBuildingDist = d; nearestBuildingIdx = i; }
    }

    // Priority: nearest blocking building > player > house
    let targetX: number, targetY: number, targetDist: number;
    let mode: 'player' | 'building' | 'house';
    if (nearestBuildingIdx >= 0) {
      targetX = buildings[nearestBuildingIdx].x; targetY = buildings[nearestBuildingIdx].y;
      targetDist = nearestBuildingDist; mode = 'building';
    } else if (aggroPlayer) {
      targetX = playerX; targetY = playerY; targetDist = distToPlayer; mode = 'player';
    } else {
      targetX = houseX; targetY = houseY; targetDist = distToHouse; mode = 'house';
    }

    let vx = 0, vy = 0;
    if (targetDist > this.def.attackRange) {
      const angle = Math.atan2(targetY - this.y, targetX - this.x);
      vx = Math.cos(angle) * this.def.speed;
      vy = Math.sin(angle) * this.def.speed;
    }
    this.setVelocity(vx, vy);
    this.updateAnim(vx, vy);
    this.syncHpBar();

    if (this.attackCooldownMs > 0) { this.attackCooldownMs -= delta; return NONE; }

    // Buildings have a physics collider that stops enemies before they reach
    // the sprite center, so use a wider effective range for building targets.
    const effectiveRange = mode === 'building'
      ? Math.max(this.def.attackRange, 40)
      : this.def.attackRange;

    if (targetDist <= effectiveRange) {
      this.attackCooldownMs = 1000 / this.def.attackSpeed;
      this.playAttackAnim();

      // Ranged enemies fire a projectile instead of dealing instant damage
      if (this.def.projectileKey) {
        const angle = Math.atan2(targetY - this.y, targetX - this.x);
        return { ...NONE, projectile: {
          x: this.x, y: this.y, angle,
          key: this.def.projectileKey,
          speed: this.def.projectileSpeed ?? 150,
          damage: this.def.damage,
        }};
      }

      if (mode === 'player')   return { ...NONE, playerDmg: this.def.damage };
      if (mode === 'building') return { ...NONE, buildingDmg: this.def.damage, buildingIdx: nearestBuildingIdx };
      return { ...NONE, houseDmg: this.def.damage };
    }

    return NONE;
  }

  /**
   * Natural enemies (e.g. bear) ignore buildings and the house, and only ever
   * target the player. They idle at their spawn point until a player wanders
   * within aggroRange, then chase — once aggroed, they never give up the chase.
   */
  private tickNatural(delta: number, playerX: number, playerY: number): EnemyTickResult {
    const NONE = { playerDmg: 0, houseDmg: 0, buildingDmg: 0, buildingIdx: -1, projectile: null } as const;
    const distToPlayer = Phaser.Math.Distance.Between(this.x, this.y, playerX, playerY);

    if (!this.naturalAggro && distToPlayer <= this.def.aggroRange) {
      this.naturalAggro = true;
    }

    let targetX: number, targetY: number, targetDist: number;
    if (this.naturalAggro) {
      targetX = playerX; targetY = playerY; targetDist = distToPlayer;
    } else {
      targetX = this.origin.x; targetY = this.origin.y;
      targetDist = Phaser.Math.Distance.Between(this.x, this.y, targetX, targetY);
    }

    const stopDist = this.naturalAggro ? this.def.attackRange : 4;
    let vx = 0, vy = 0;
    if (targetDist > stopDist) {
      const angle = Math.atan2(targetY - this.y, targetX - this.x);
      vx = Math.cos(angle) * this.def.speed;
      vy = Math.sin(angle) * this.def.speed;
    }
    this.setVelocity(vx, vy);
    this.updateAnim(vx, vy);
    this.syncHpBar();

    if (this.attackCooldownMs > 0) { this.attackCooldownMs -= delta; return NONE; }

    if (this.naturalAggro && targetDist <= this.def.attackRange) {
      this.attackCooldownMs = 1000 / this.def.attackSpeed;
      this.playAttackAnim();
      return { ...NONE, playerDmg: this.def.damage };
    }

    return NONE;
  }

  /**
   * Multiplayer: apply authoritative position and HP from server snapshot.
   * Drives animation from movement delta without running local AI.
   */
  /**
   * Multiplayer: store the authoritative server target; the actual sprite movement
   * is driven by tickMultiplayer() every frame for smooth interpolation.
   */
  applyServerUpdate(x: number, y: number, hp: number): void {
    this.mpTargetX = x;
    this.mpTargetY = y;
    if (!this.mpReady) {
      // First update: teleport to starting position immediately
      this.setPosition(x, y);
      this.mpReady = true;
    }
    if (hp < this._hp) {
      this._hp = hp;
      this.syncHpBar();
      this.scene.tweens.killTweensOf(this);
      this.setAlpha(1);
      this.scene.tweens.add({ targets: this, alpha: 0.3, duration: 80, yoyo: true });
    } else if (hp !== this._hp) {
      this._hp = hp;
      this.syncHpBar();
    }
  }

  /** Multiplayer per-frame update: lerp toward latest server target. */
  tickMultiplayer(delta: number): void {
    if (!this.mpReady) return;
    const dx = this.mpTargetX - this.x;
    const dy = this.mpTargetY - this.y;
    const t = Math.min(1, (delta / 1000) * 20);
    this.setPosition(this.x + dx * t, this.y + dy * t);
    (this.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
    this.updateAnim(dx, dy);
    this.syncHpBar();
  }

  /** Push the enemy away from (fromX, fromY) briefly. */
  knockback(fromX: number, fromY: number, force = 80, durationMs = 120): void {
    const angle = Math.atan2(this.y - fromY, this.x - fromX);
    this.setVelocity(Math.cos(angle) * force, Math.sin(angle) * force);
    this.knockbackMs = durationMs;
  }

  /** Apply incoming damage. Returns true if this hit killed the enemy. */
  takeDamage(amount: number): boolean {
    this._hp -= amount;
    if (this.def.isNatural) this.naturalAggro = true;
    this.scene.tweens.killTweensOf(this);
    this.setAlpha(1);
    this.scene.tweens.add({ targets: this, alpha: 0.3, duration: 80, yoyo: true });
    this.syncHpBar();
    if (this._hp <= 0 && this.cachedDrops === null) {
      this.cachedDrops = this.def.drops
        .filter(d => Math.random() < d.chance)
        .map(d => ({ itemId: d.itemId, quantity: d.quantity }));
    }
    return this._hp <= 0;
  }

  private syncHpBar(): void {
    const damaged = this._hp > 0 && this._hp < this.def.hp;
    const bx = this.x - BAR_W / 2;
    const by = this.y - BAR_OFFSET_Y;
    const ratio = Math.max(0, this._hp / this.def.hp);
    const color = ratio > 0.5 ? 0x22cc44 : ratio > 0.25 ? 0xf0a500 : 0xe63946;

    this.hpBarBg.setPosition(bx, by).setVisible(damaged);
    this.hpBarFill.setPosition(bx, by).setSize(BAR_W * ratio, BAR_H)
      .setFillStyle(color).setVisible(damaged);
  }

  override destroy(fromScene?: boolean): void {
    this.hpBarBg?.destroy();
    this.hpBarFill?.destroy();
    super.destroy(fromScene);
  }

  /** Returns the drop table, rolling it now if not already cached (multiplayer path). */
  getDrops(): { itemId: string; quantity: number }[] {
    if (this.cachedDrops === null) {
      this.cachedDrops = this.def.drops
        .filter(d => Math.random() < d.chance)
        .map(d => ({ itemId: d.itemId, quantity: d.quantity }));
    }
    return this.cachedDrops;
  }

  /**
   * Registers walk animations for this enemy's spritesheet.
   * Layout matches the player sheet: columns = directions, rows = walk frames.
   *   col 0 = down, col 1 = up, col 2 = left, col 3 = right
   *   3 rows of walk frames → frame index = col + row * 4
   */
  private registerAnimations(): void {
    const anims = this.scene.anims;
    const key   = this.def.spriteKey;

    if (this.def.animStyle === 'strip') {
      const count = this.def.frameCount ?? 4;
      const animKey = `${key}-walk-down`;
      if (!anims.exists(animKey)) {
        const frames = this.def.useAtlas
          ? Array.from({ length: count }, (_, i) => ({ key, frame: String(i) }))
          : anims.generateFrameNumbers(key, { start: 0, end: count - 1 });
        anims.create({ key: animKey, frames, frameRate: 10, repeat: -1 });
      }

      if (this.def.attackSpriteKey) {
        const attackKey = `${this.def.attackSpriteKey}-anim`;
        const attackCount = this.def.attackFrameCount ?? 4;
        if (!anims.exists(attackKey)) {
          const indices = this.def.attackFrameIndices
            ?? Array.from({ length: attackCount }, (_, i) => i);
          anims.create({
            key: attackKey,
            frames: indices.map(i => ({ key: this.def.attackSpriteKey!, frame: String(i) })),
            frameRate: 10,
            repeat: 0,
          });
        }
      }

      if (this.def.idleSpriteKey) {
        const idleKey = `${this.def.idleSpriteKey}-anim`;
        const idleCount = this.def.idleFrameCount ?? 4;
        if (!anims.exists(idleKey)) {
          anims.create({
            key: idleKey,
            frames: Array.from({ length: idleCount }, (_, i) => ({ key: this.def.idleSpriteKey!, frame: String(i) })),
            frameRate: 6,
            repeat: -1,
          });
        }
      }
      return;
    }

    const dirs = [
      { suffix: 'down',  col: 0 },
      { suffix: 'up',    col: 1 },
      { suffix: 'left',  col: 2 },
      { suffix: 'right', col: 3 },
    ] as const;

    for (const { suffix, col } of dirs) {
      const animKey = `${key}-walk-${suffix}`;
      if (!anims.exists(animKey)) {
        anims.create({
          key: animKey,
          frames: [0, 1, 2].map(row => ({ key, frame: col + row * 4 })),
          frameRate: 8,
          repeat: -1,
        });
      }
    }
  }

  private playAttackAnim(): void {
    if (!this.def.attackSpriteKey || this.isPlayingAttack) return;
    this.isPlayingAttack = true;
    const attackKey = `${this.def.attackSpriteKey}-anim`;
    this.play(attackKey);
    if (this.def.displaySize) this.setDisplaySize(this.def.displaySize.w, this.def.displaySize.h);
    this.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      this.isPlayingAttack = false;
      this.play(`${this.def.spriteKey}-walk-down`);
      if (this.def.displaySize) this.setDisplaySize(this.def.displaySize.w, this.def.displaySize.h);
    });
  }

  private updateAnim(vx: number, vy: number): void {
    if (this.isPlayingAttack) return;
    const key    = this.def.spriteKey;
    const moving = Math.abs(vx) > 1 || Math.abs(vy) > 1;

    if (this.def.animStyle === 'strip') {
      if (!moving && this.def.idleSpriteKey) {
        const idleKey = `${this.def.idleSpriteKey}-anim`;
        if (this.anims.currentAnim?.key !== idleKey) {
          this.play(idleKey);
          if (this.def.displaySize) this.setDisplaySize(this.def.displaySize.w, this.def.displaySize.h);
        }
        return;
      }
      if (!moving) return;
      // Single looping animation for all directions; flip for leftward movement
      const animKey = `${key}-walk-down`;
      if (this.anims.currentAnim?.key !== animKey) {
        this.play(animKey);
        if (this.def.displaySize) this.setDisplaySize(this.def.displaySize.w, this.def.displaySize.h);
      }
      this.setFlipX(vx < -1);
      return;
    }

    if (!moving) return;
    let suffix: string;
    if (Math.abs(vx) >= Math.abs(vy)) {
      suffix = vx < 0 ? 'left' : 'right';
    } else {
      suffix = vy < 0 ? 'up' : 'down';
    }

    const animKey = `${key}-walk-${suffix}`;
    if (this.anims.currentAnim?.key !== animKey) {
      this.setFlipX(false);
      this.play(animKey);
    }
  }
}
