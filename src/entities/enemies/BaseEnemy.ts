import Phaser from 'phaser';
import { C } from '../../constants';
import { EnemyDefinition } from '../../data/enemies';

const BAR_W = 16;
const BAR_H = 3;
const BAR_OFFSET_Y = 11; // pixels above enemy centre

export class BaseEnemy extends Phaser.Physics.Arcade.Sprite {
  private readonly def: EnemyDefinition;
  private _hp: number;
  private attackCooldownMs = 0;
  private knockbackMs = 0;
  private isPlayingAttack = false;
  private cachedDrops: { itemId: string; quantity: number }[] | null = null;
  private hpBarBg!: Phaser.GameObjects.Rectangle;
  private hpBarFill!: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene, x: number, y: number, def: EnemyDefinition) {
    super(scene, x, y, def.spriteKey, 0);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.def = def;
    this._hp = def.hp;
    this.setDepth(C.DEPTH_ENEMIES);
    this.setCollideWorldBounds(true);
    if (def.displaySize) this.setDisplaySize(def.displaySize.w, def.displaySize.h);
    this.registerAnimations();
    this.play(`${def.spriteKey}-walk-down`);

    this.hpBarBg = scene.add.rectangle(x - BAR_W / 2, y - BAR_OFFSET_Y, BAR_W, BAR_H, 0x222222)
      .setOrigin(0, 0.5).setDepth(C.DEPTH_ENEMIES + 2).setVisible(false);
    this.hpBarFill = scene.add.rectangle(x - BAR_W / 2, y - BAR_OFFSET_Y, BAR_W, BAR_H, 0x22cc44)
      .setOrigin(0, 0.5).setDepth(C.DEPTH_ENEMIES + 3).setVisible(false);
  }

  get isDead(): boolean { return this._hp <= 0; }

  /**
   * Move toward player (if within aggroRange), nearest blocking canon, or house.
   * Returns damage dealt to each target this tick.
   */
  tick(
    delta: number,
    playerX: number, playerY: number,
    houseX: number,  houseY: number,
    buildings: { x: number; y: number; isDead: boolean }[] = [],
  ): { playerDmg: number; houseDmg: number; buildingDmg: number; buildingIdx: number;
       projectile: { x: number; y: number; angle: number; key: string; speed: number; damage: number } | null } {
    const NONE = { playerDmg: 0, houseDmg: 0, buildingDmg: 0, buildingIdx: -1, projectile: null } as const;
    if (this._hp <= 0) { this.setVelocity(0, 0); return NONE; }
    if (this.knockbackMs > 0) { this.knockbackMs -= delta; return NONE; }

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

  /** Push the enemy away from (fromX, fromY) briefly. */
  knockback(fromX: number, fromY: number, force = 80, durationMs = 120): void {
    const angle = Math.atan2(this.y - fromY, this.x - fromX);
    this.setVelocity(Math.cos(angle) * force, Math.sin(angle) * force);
    this.knockbackMs = durationMs;
  }

  /** Apply incoming damage. Returns true if this hit killed the enemy. */
  takeDamage(amount: number): boolean {
    this._hp -= amount;
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

  /** Returns the drop table rolled at time of death. */
  getDrops(): { itemId: string; quantity: number }[] {
    return this.cachedDrops ?? [];
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
    if (!moving) return;

    if (this.def.animStyle === 'strip') {
      // Single looping animation for all directions; flip for leftward movement
      const animKey = `${key}-walk-down`;
      if (this.anims.currentAnim?.key !== animKey) this.play(animKey);
      this.setFlipX(vx < -1);
      return;
    }

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
