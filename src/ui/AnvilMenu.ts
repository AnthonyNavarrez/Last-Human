import Phaser from 'phaser';

const PANEL_W = 320;
const PANEL_H = 200;

export class AnvilMenu extends Phaser.GameObjects.Container {
  constructor(scene: Phaser.Scene) {
    super(scene, scene.scale.width / 2, scene.scale.height / 2);

    const bg = scene.add.rectangle(0, 0, PANEL_W, PANEL_H, 0x12121e, 0.94);
    bg.setStrokeStyle(2, 0x88ccff);
    this.add(bg);

    const title = scene.add.text(0, -PANEL_H / 2 + 22, 'Anvil', {
      fontSize: '15px', color: '#88ccff', fontStyle: 'bold',
    }).setOrigin(0.5, 0.5);
    this.add(title);

    this.add(scene.add.rectangle(0, -PANEL_H / 2 + 40, PANEL_W - 24, 1, 0x88ccff, 0.4));

    const emptyText = scene.add.text(0, -10, 'No recipes yet.', {
      fontSize: '12px', color: '#555566',
    }).setOrigin(0.5, 0.5);
    this.add(emptyText);

    this.add(scene.add.rectangle(0, PANEL_H / 2 - 44, PANEL_W - 24, 1, 0x333355, 1));

    const closeHint = scene.add.text(-PANEL_W / 2 + 16, PANEL_H / 2 - 22, '[E] to close', {
      fontSize: '10px', color: '#666688',
    }).setOrigin(0, 0.5);
    this.add(closeHint);

    const closeBtnBg = scene.add.rectangle(PANEL_W / 2 - 44, PANEL_H / 2 - 22, 68, 24, 0x2a2a45)
      .setStrokeStyle(1, 0x555577)
      .setInteractive(new Phaser.Geom.Rectangle(-34, -12, 68, 24), Phaser.Geom.Rectangle.Contains);
    const closeBtnText = scene.add.text(PANEL_W / 2 - 44, PANEL_H / 2 - 22, 'Close', {
      fontSize: '11px', color: '#aaaacc',
    }).setOrigin(0.5, 0.5);
    this.add(closeBtnBg);
    this.add(closeBtnText);
    closeBtnBg.on('pointerdown', () => scene.game.events.emit('close-anvil'));
    closeBtnBg.on('pointerover', () => closeBtnBg.setFillStyle(0x3a3a55));
    closeBtnBg.on('pointerout',  () => closeBtnBg.setFillStyle(0x2a2a45));

    scene.add.existing(this);
    this.setDepth(200);
    this.setVisible(false);

    scene.scale.on('resize', () => {
      this.setPosition(scene.scale.width / 2, scene.scale.height / 2);
    });
  }

  show(): void { this.setVisible(true); }
  hide(): void { this.setVisible(false); }
}
