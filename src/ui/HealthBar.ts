import Phaser from 'phaser';

const BAR_W = 96;
const BAR_H = 9;

export class HealthBar extends Phaser.GameObjects.Container {
  private fill: Phaser.GameObjects.Rectangle;
  private hpText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, x: number, y: number, private readonly barLabel: string) {
    super(scene, x, y);

    const bg = scene.add.rectangle(0, 0, BAR_W, BAR_H, 0x222222).setOrigin(0, 0);
    this.fill = scene.add.rectangle(0, 0, BAR_W, BAR_H, 0x2d6a4f).setOrigin(0, 0);
    const border = scene.add.rectangle(0, 0, BAR_W, BAR_H, 0x000000, 0)
      .setOrigin(0, 0).setStrokeStyle(1, 0x555555);
    this.hpText = scene.add.text(BAR_W / 2, BAR_H + 3, '', {
      fontSize: '9px', color: '#aaaaaa',
    }).setOrigin(0.5, 0);

    this.add([bg, this.fill, border, this.hpText]);
    scene.add.existing(this);
    this.setDepth(150);
  }

  /** Update bar width and color based on current/max HP. */
  setHp(hp: number, maxHp: number): void {
    const ratio = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
    this.fill.setDisplaySize(BAR_W * ratio, BAR_H);
    this.fill.setFillStyle(ratio > 0.5 ? 0x2d6a4f : ratio > 0.25 ? 0xd4a017 : 0xe63946);
    this.hpText.setText(`${this.barLabel} ${hp}/${maxHp}`);
  }
}
