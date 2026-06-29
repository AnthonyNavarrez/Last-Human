import Phaser from 'phaser';
import { C } from '../../constants';

export const TURRET_DETECT_RANGE = 220;
export const TURRET_FIRE_MS      = 1250; // 0.8 shots/sec
export const TURRET_DAMAGE       = 3;
export const TURRET_ARROW_SPEED  = 280;
export const TURRET_HP           = 60;

const HITBOX_W = 24;
const HITBOX_H = 16;
const BAR_W    = 28;
const BAR_H    = 3;

export class Turret extends Phaser.GameObjects.Image {
  private fireCooldown = 0;
  private _hp = TURRET_HP;
  private hpBarBg!: Phaser.GameObjects.Rectangle;
  private hpBarFill!: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'turret');
    scene.add.existing(this);
    this.setDisplaySize(40, 50);
    this.setDepth(C.DEPTH_OBJECTS + 1);

    scene.physics.add.existing(this, true);
    const body = this.body as Phaser.Physics.Arcade.StaticBody;
    body.width  = HITBOX_W;
    body.height = HITBOX_H;
    body.x = x - HITBOX_W / 2;
    body.y = y - HITBOX_H / 2 + 8;
    body.updateCenter();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const wld = (scene.physics.world as any);
    wld.staticTree.remove(body);
    wld.staticTree.insert(body);

    const barY = y - 28;
    this.hpBarBg   = scene.add.rectangle(x, barY, BAR_W, BAR_H, 0x222222)
      .setOrigin(0.5, 0.5).setDepth(C.DEPTH_OBJECTS + 3).setVisible(false);
    this.hpBarFill = scene.add.rectangle(x - BAR_W / 2, barY, BAR_W, BAR_H, 0x22cc44)
      .setOrigin(0, 0.5).setDepth(C.DEPTH_OBJECTS + 4).setVisible(false);
  }

  get isDead(): boolean { return this._hp <= 0; }
  get isFullHp(): boolean { return this._hp >= TURRET_HP; }

  heal(amount: number): void {
    if (this._hp >= TURRET_HP) return;
    this._hp = Math.min(TURRET_HP, this._hp + amount);
    this.syncHpBar();
  }

  takeDamage(amount: number): boolean {
    this._hp = Math.max(0, this._hp - amount);
    this.scene.tweens.killTweensOf(this);
    this.setAlpha(1);
    this.scene.tweens.add({ targets: this, alpha: 0.3, duration: 80, yoyo: true });
    this.syncHpBar();
    return this._hp <= 0;
  }

  private syncHpBar(): void {
    const damaged = this._hp > 0 && this._hp < TURRET_HP;
    const ratio = this._hp / TURRET_HP;
    const color = ratio > 0.5 ? 0x22cc44 : ratio > 0.25 ? 0xf0a500 : 0xe63946;
    const bx = this.x, by = this.y - 28;
    this.hpBarBg.setPosition(bx, by).setVisible(damaged);
    this.hpBarFill.setPosition(bx - BAR_W / 2, by)
      .setSize(BAR_W * ratio, BAR_H).setFillStyle(color).setVisible(damaged);
  }

  override destroy(fromScene?: boolean): void {
    this.hpBarBg?.destroy();
    this.hpBarFill?.destroy();
    super.destroy(fromScene);
  }

  /** Returns fire angle toward nearest enemy, or null if no target / on cooldown. */
  tick(
    delta: number,
    enemies: Map<string, { x: number; y: number; isDead: boolean }>,
  ): number | null {
    this.fireCooldown -= delta;

    let nearestDist  = TURRET_DETECT_RANGE + 1;
    let nearestAngle: number | null = null;

    for (const [, e] of enemies) {
      if (e.isDead) continue;
      const dist = Phaser.Math.Distance.Between(this.x, this.y, e.x, e.y);
      if (dist < nearestDist) {
        nearestDist  = dist;
        nearestAngle = Phaser.Math.Angle.Between(this.x, this.y, e.x, e.y);
      }
    }

    if (nearestAngle === null || this.fireCooldown > 0) return null;
    this.fireCooldown = TURRET_FIRE_MS;
    return nearestAngle;
  }
}
