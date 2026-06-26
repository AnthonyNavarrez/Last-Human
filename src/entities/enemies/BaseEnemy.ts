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
    this.registerAnimations();
    this.play(`${def.spriteKey}-walk-down`);

    this.hpBarBg = scene.add.rectangle(x - BAR_W / 2, y - BAR_OFFSET_Y, BAR_W, BAR_H, 0x222222)
      .setOrigin(0, 0.5).setDepth(C.DEPTH_ENEMIES + 2).setVisible(false);
    this.hpBarFill = scene.add.rectangle(x - BAR_W / 2, y - BAR_OFFSET_Y, BAR_W, BAR_H, 0x22cc44)
      .setOrigin(0, 0.5).setDepth(C.DEPTH_ENEMIES + 3).setVisible(false);
  }

  get isDead(): boolean { return this._hp <= 0; }

  /**
   * Move toward player (if within aggroRange) or house otherwise.
   * Returns damage split between the two targets this tick.
   */
  tick(
    delta: number,
    playerX: number, playerY: number,
    houseX: number,  houseY: number,
  ): { playerDmg: number; houseDmg: number } {
    if (this._hp <= 0) {
      this.setVelocity(0, 0);
      return { playerDmg: 0, houseDmg: 0 };
    }

    const distToPlayer = Phaser.Math.Distance.Between(this.x, this.y, playerX, playerY);
    const aggroPlayer  = distToPlayer <= this.def.aggroRange;
    const targetX = aggroPlayer ? playerX : houseX;
    const targetY = aggroPlayer ? playerY : houseY;
    const dist    = aggroPlayer
      ? distToPlayer
      : Phaser.Math.Distance.Between(this.x, this.y, houseX, houseY);

    let vx = 0;
    let vy = 0;
    if (dist > this.def.attackRange) {
      const angle = Math.atan2(targetY - this.y, targetX - this.x);
      vx = Math.cos(angle) * this.def.speed;
      vy = Math.sin(angle) * this.def.speed;
    }
    this.setVelocity(vx, vy);
    this.updateAnim(vx, vy);
    this.syncHpBar();

    if (this.attackCooldownMs > 0) {
      this.attackCooldownMs -= delta;
      return { playerDmg: 0, houseDmg: 0 };
    }

    if (dist <= this.def.attackRange) {
      this.attackCooldownMs = 1000 / this.def.attackSpeed;
      return aggroPlayer
        ? { playerDmg: this.def.damage, houseDmg: 0 }
        : { playerDmg: 0, houseDmg: this.def.damage };
    }

    return { playerDmg: 0, houseDmg: 0 };
  }

  /** Apply incoming damage. Returns true if this hit killed the enemy. */
  takeDamage(amount: number): boolean {
    this._hp -= amount;
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
    const key = this.def.spriteKey;

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

  /** Switch animation based on current velocity vector. */
  private updateAnim(vx: number, vy: number): void {
    const key = this.def.spriteKey;
    const moving = Math.abs(vx) > 1 || Math.abs(vy) > 1;
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
