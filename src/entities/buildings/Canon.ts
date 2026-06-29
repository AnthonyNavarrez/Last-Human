import Phaser from 'phaser';
import { C } from '../../constants';

export const CANON_DETECT_RANGE  = 150;
export const CANON_FIRE_MS       = 2000; // 0.5 shots/sec
export const CANON_DAMAGE        = 8;
export const CANON_BALL_SPEED    = 220;
export const CANON_HP            = 50;

const HITBOX_W = 24;
const HITBOX_H = 14;
const BAR_W  = 28;
const BAR_H  = 3;

// Frames: 0=South, 1=SouthEast, 2=East, 3=NorthEast, 4=North
// SW/W/NW are the east-side frames with flipX.
// Phaser screen-space degrees: E=0, SE=45, S=90, SW=135, W=180, NW=225, N=270, NE=315
function angleToFrame(angleDeg: number): { frame: number; flipX: boolean } {
  const d = ((angleDeg % 360) + 360) % 360;
  if (d < 22.5  || d >= 337.5) return { frame: 2, flipX: false }; // E
  if (d < 67.5)                 return { frame: 1, flipX: false }; // SE
  if (d < 112.5)                return { frame: 0, flipX: false }; // S
  if (d < 157.5)                return { frame: 1, flipX: true  }; // SW
  if (d < 202.5)                return { frame: 2, flipX: true  }; // W
  if (d < 247.5)                return { frame: 3, flipX: true  }; // NW
  if (d < 292.5)                return { frame: 4, flipX: false }; // N
  return                               { frame: 3, flipX: false }; // NE
}

export class Canon extends Phaser.GameObjects.Sprite {
  private fireCooldown = 0;
  private _hp = CANON_HP;
  private hpBarBg!: Phaser.GameObjects.Rectangle;
  private hpBarFill!: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'canon1-f2'); // default East
    scene.add.existing(this);
    this.setDisplaySize(36, 44);
    this.setDepth(C.DEPTH_OBJECTS + 1);

    // Static physics body so the player and enemies can't walk through it
    scene.physics.add.existing(this, true);
    const body = this.body as Phaser.Physics.Arcade.StaticBody;
    body.width  = HITBOX_W;
    body.height = HITBOX_H;
    body.x = x - HITBOX_W / 2;
    body.y = y - HITBOX_H / 2 + 8;
    body.updateCenter();
    const wld = (scene.physics.world as any); // eslint-disable-line @typescript-eslint/no-explicit-any
    wld.staticTree.remove(body);
    wld.staticTree.insert(body);

    // HP bar (hidden until damaged)
    const barY = y - 26;
    this.hpBarBg   = scene.add.rectangle(x, barY, BAR_W, BAR_H, 0x222222)
      .setOrigin(0.5, 0.5).setDepth(C.DEPTH_OBJECTS + 3).setVisible(false);
    this.hpBarFill = scene.add.rectangle(x - BAR_W / 2, barY, BAR_W, BAR_H, 0x22cc44)
      .setOrigin(0, 0.5).setDepth(C.DEPTH_OBJECTS + 4).setVisible(false);
  }

  get isDead(): boolean { return this._hp <= 0; }
  get isFullHp(): boolean { return this._hp >= CANON_HP; }

  heal(amount: number): void {
    if (this._hp >= CANON_HP) return;
    this._hp = Math.min(CANON_HP, this._hp + amount);
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
    const damaged = this._hp > 0 && this._hp < CANON_HP;
    const ratio = this._hp / CANON_HP;
    const color = ratio > 0.5 ? 0x22cc44 : ratio > 0.25 ? 0xf0a500 : 0xe63946;
    const bx = this.x, by = this.y - 26;
    this.hpBarBg.setPosition(bx, by).setVisible(damaged);
    this.hpBarFill.setPosition(bx - BAR_W / 2, by)
      .setSize(BAR_W * ratio, BAR_H).setFillStyle(color).setVisible(damaged);
  }

  override destroy(fromScene?: boolean): void {
    this.hpBarBg?.destroy();
    this.hpBarFill?.destroy();
    super.destroy(fromScene);
  }

  /** Returns the angle to fire toward, or null if no target / not ready. */
  tick(
    delta: number,
    enemies: Map<string, { x: number; y: number; isDead: boolean }>,
  ): number | null {
    this.fireCooldown -= delta;

    let nearestDist  = CANON_DETECT_RANGE + 1;
    let nearestAngle: number | null = null;

    for (const [, e] of enemies) {
      if (e.isDead) continue;
      const dist = Phaser.Math.Distance.Between(this.x, this.y, e.x, e.y);
      if (dist < nearestDist) {
        nearestDist  = dist;
        nearestAngle = Phaser.Math.Angle.Between(this.x, this.y, e.x, e.y);
      }
    }

    if (nearestAngle === null) return null;

    const { frame, flipX } = angleToFrame(nearestAngle * (180 / Math.PI));
    this.setTexture(`canon1-f${frame}`).setFlipX(flipX);

    if (this.fireCooldown > 0) return null;
    this.fireCooldown = CANON_FIRE_MS;
    return nearestAngle;
  }
}
