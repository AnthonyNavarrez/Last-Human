import Phaser from 'phaser';
import { C } from '../../constants';
import { makeEIcon } from './AutoMiner';

const ANVIL_HP  = 100;
const HITBOX_W  = 24;
const HITBOX_H  = 14;
const BAR_W     = 28;
const BAR_H     = 3;

export class Anvil extends Phaser.GameObjects.Image {
  private _hp = ANVIL_HP;
  private hpBarBg!:   Phaser.GameObjects.Rectangle;
  private hpBarFill!: Phaser.GameObjects.Rectangle;
  readonly eIcon: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'building-anvil');
    scene.add.existing(this);
    this.setDisplaySize(30, 18);
    this.setDepth(C.DEPTH_OBJECTS + 1);

    scene.physics.add.existing(this, true);
    const body = this.body as Phaser.Physics.Arcade.StaticBody;
    body.width  = HITBOX_W;
    body.height = HITBOX_H;
    body.x = x - HITBOX_W / 2;
    body.y = y - HITBOX_H / 2 + 4;
    body.updateCenter();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const wld = (scene.physics.world as any);
    wld.staticTree.remove(body);
    wld.staticTree.insert(body);

    this.eIcon = makeEIcon(scene, x, y - 14);

    const barY = y - 22;
    this.hpBarBg   = scene.add.rectangle(x, barY, BAR_W, BAR_H, 0x222222)
      .setOrigin(0.5, 0.5).setDepth(C.DEPTH_OBJECTS + 3).setVisible(false);
    this.hpBarFill = scene.add.rectangle(x - BAR_W / 2, barY, BAR_W, BAR_H, 0x22cc44)
      .setOrigin(0, 0.5).setDepth(C.DEPTH_OBJECTS + 4).setVisible(false);
  }

  get isDead(): boolean { return this._hp <= 0; }
  get isFullHp(): boolean { return this._hp >= ANVIL_HP; }

  heal(amount: number): void {
    if (this._hp >= ANVIL_HP) return;
    this._hp = Math.min(ANVIL_HP, this._hp + amount);
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
    const damaged = this._hp > 0 && this._hp < ANVIL_HP;
    const ratio   = this._hp / ANVIL_HP;
    const color   = ratio > 0.5 ? 0x22cc44 : ratio > 0.25 ? 0xf0a500 : 0xe63946;
    const bx = this.x, by = this.y - 22;
    this.hpBarBg.setPosition(bx, by).setVisible(damaged);
    this.hpBarFill.setPosition(bx - BAR_W / 2, by)
      .setSize(BAR_W * ratio, BAR_H).setFillStyle(color).setVisible(damaged);
  }

  override destroy(fromScene?: boolean): void {
    this.hpBarBg?.destroy();
    this.hpBarFill?.destroy();
    this.eIcon?.destroy();
    super.destroy(fromScene);
  }
}
