import Phaser from 'phaser';

const BAR_W = 320;
const BAR_H = 58;

const FILL_X = 46;
const FILL_Y = 6;
const FILL_W = 260;
const FILL_H = 46;

export class HealthBar extends Phaser.GameObjects.Container {
  private fill: Phaser.GameObjects.Rectangle;
  private text: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, x: number, y: number, _barLabel: string) {
    super(scene, x, y);

    this.fill = scene.add.rectangle(FILL_X, FILL_Y, FILL_W, FILL_H, 0x22cc44).setOrigin(0, 0);

    const frame = scene.add.image(0, 0, 'ui-health-bar')
      .setOrigin(0, 0)
      .setDisplaySize(BAR_W, BAR_H);

    this.text = scene.add.text(FILL_X + FILL_W / 2, FILL_Y + FILL_H / 2, '', {
      fontSize: '18px', color: '#ffffff',
      stroke: '#000000', strokeThickness: 4,
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5);

    this.add([this.fill, frame, this.text]);
    scene.add.existing(this);
    this.setDepth(150);
  }

  setHp(hp: number, maxHp: number): void {
    const ratio = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
    this.fill.setDisplaySize(FILL_W * ratio, FILL_H);
    this.fill.setFillStyle(ratio > 0.5 ? 0x22cc44 : ratio > 0.25 ? 0xd4a017 : 0xe63946);
    this.text.setText(`${Math.ceil(hp)} / ${maxHp}`);
  }
}
