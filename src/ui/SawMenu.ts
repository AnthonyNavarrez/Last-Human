import Phaser from 'phaser';
import { ITEMS } from '../data/items';

const PANEL_W = 290;
const PANEL_H = 290;

export class SawMenu extends Phaser.GameObjects.Container {
  private powerText!: Phaser.GameObjects.Text;
  private axeBtnBg!: Phaser.GameObjects.Rectangle;
  private axeBtnText!: Phaser.GameObjects.Text;
  private outputIcon!: Phaser.GameObjects.Image;
  private outputQtyText!: Phaser.GameObjects.Text;
  private outputEmptyText!: Phaser.GameObjects.Text;
  private takeBtnBg!: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene) {
    super(scene, scene.scale.width / 2, scene.scale.height / 2);

    const bg = scene.add.rectangle(0, 0, PANEL_W, PANEL_H, 0x12121e, 0.94);
    bg.setStrokeStyle(2, 0xf0a500);
    this.add(bg);

    const title = scene.add.text(0, -PANEL_H / 2 + 22, 'Auto Saw', {
      fontSize: '15px', color: '#f0a500', fontStyle: 'bold',
    }).setOrigin(0.5, 0.5);
    this.add(title);

    this.add(scene.add.rectangle(0, -PANEL_H / 2 + 40, PANEL_W - 24, 1, 0xf0a500, 0.4));

    this.powerText = scene.add.text(0, -68, 'ENERGY: 0 hits remaining', {
      fontSize: '13px', color: '#e0e0e0',
    }).setOrigin(0.5, 0.5);
    this.add(this.powerText);

    const hint = scene.add.text(0, -46, '1 battery = 200 hits  •  axe required', {
      fontSize: '9px', color: '#666688',
    }).setOrigin(0.5, 0.5);
    this.add(hint);

    // Add battery button
    const fuelBtnBg = scene.add.rectangle(-60, -10, 120, 30, 0x7b4f00)
      .setStrokeStyle(1, 0xf0a500)
      .setInteractive(new Phaser.Geom.Rectangle(-60, -15, 120, 30), Phaser.Geom.Rectangle.Contains);
    const fuelBtnText = scene.add.text(-60, -10, '+ Add Battery', {
      fontSize: '12px', color: '#ffffff',
    }).setOrigin(0.5, 0.5);
    this.add(fuelBtnBg);
    this.add(fuelBtnText);
    fuelBtnBg.on('pointerdown', () => scene.game.events.emit('add-saw-fuel'));
    fuelBtnBg.on('pointerover',  () => fuelBtnBg.setFillStyle(0xa06800));
    fuelBtnBg.on('pointerout',   () => fuelBtnBg.setFillStyle(0x7b4f00));

    // Axe toggle
    this.axeBtnBg = scene.add.rectangle(80, -10, 110, 30, 0x2a4a2a)
      .setStrokeStyle(1, 0x52b788)
      .setInteractive(new Phaser.Geom.Rectangle(-55, -15, 110, 30), Phaser.Geom.Rectangle.Contains);
    this.axeBtnText = scene.add.text(80, -10, 'Ins. Axe', {
      fontSize: '11px', color: '#ffffff',
    }).setOrigin(0.5, 0.5);
    this.add(this.axeBtnBg);
    this.add(this.axeBtnText);
    this.axeBtnBg.on('pointerdown', () => scene.game.events.emit('toggle-saw-axe'));
    this.axeBtnBg.on('pointerover', () => {
      const has = this.axeBtnText.text.startsWith('Rem');
      this.axeBtnBg.setFillStyle(has ? 0x5a2a2a : 0x3a6a3a);
    });
    this.axeBtnBg.on('pointerout', () => {
      const has = this.axeBtnText.text.startsWith('Rem');
      this.axeBtnBg.setFillStyle(has ? 0x4a2a2a : 0x2a4a2a);
    });

    // Output section divider
    this.add(scene.add.rectangle(0, 25, PANEL_W - 24, 1, 0x333355, 1));

    const outputLabel = scene.add.text(0, 45, 'OUTPUT', {
      fontSize: '10px', color: '#888899', fontStyle: 'bold',
    }).setOrigin(0.5, 0.5);
    this.add(outputLabel);

    // Output slot
    const slotBg = scene.add.rectangle(-80, 80, 36, 36, 0x1a1a2e).setStrokeStyle(1, 0x444466);
    this.add(slotBg);

    this.outputIcon = scene.add.image(-80, 80, 'item-rock').setDisplaySize(26, 26).setVisible(false);
    this.add(this.outputIcon);

    this.outputQtyText = scene.add.text(-58, 90, '', {
      fontSize: '11px', color: '#ffffff', stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0, 1).setVisible(false);
    this.add(this.outputQtyText);

    this.outputEmptyText = scene.add.text(-80, 80, 'Empty', {
      fontSize: '10px', color: '#555566',
    }).setOrigin(0.5, 0.5);
    this.add(this.outputEmptyText);

    // Take All button
    this.takeBtnBg = scene.add.rectangle(55, 80, 100, 30, 0x1a3a1a)
      .setStrokeStyle(1, 0x52b788)
      .setInteractive(new Phaser.Geom.Rectangle(-50, -15, 100, 30), Phaser.Geom.Rectangle.Contains);
    const takeBtnText = scene.add.text(55, 80, 'Take All', {
      fontSize: '12px', color: '#ffffff',
    }).setOrigin(0.5, 0.5);
    this.add(this.takeBtnBg);
    this.add(takeBtnText);
    this.takeBtnBg.on('pointerdown', () => scene.game.events.emit('take-saw-output'));
    this.takeBtnBg.on('pointerover', () => this.takeBtnBg.setFillStyle(0x2a5a2a));
    this.takeBtnBg.on('pointerout',  () => this.takeBtnBg.setFillStyle(0x1a3a1a));

    // Bottom
    this.add(scene.add.rectangle(0, PANEL_H / 2 - 44, PANEL_W - 24, 1, 0x333355, 1));

    const closehint = scene.add.text(-PANEL_W / 2 + 16, PANEL_H / 2 - 22, '[E] to close', {
      fontSize: '10px', color: '#666688',
    }).setOrigin(0, 0.5);
    this.add(closehint);

    const closeBtnBg = scene.add.rectangle(PANEL_W / 2 - 44, PANEL_H / 2 - 22, 68, 24, 0x2a2a45)
      .setStrokeStyle(1, 0x555577)
      .setInteractive(new Phaser.Geom.Rectangle(-34, -12, 68, 24), Phaser.Geom.Rectangle.Contains);
    const closeBtnText = scene.add.text(PANEL_W / 2 - 44, PANEL_H / 2 - 22, 'Close', {
      fontSize: '11px', color: '#aaaacc',
    }).setOrigin(0.5, 0.5);
    this.add(closeBtnBg);
    this.add(closeBtnText);
    closeBtnBg.on('pointerdown', () => scene.game.events.emit('close-saw'));
    closeBtnBg.on('pointerover', () => closeBtnBg.setFillStyle(0x3a3a55));
    closeBtnBg.on('pointerout',  () => closeBtnBg.setFillStyle(0x2a2a45));

    scene.add.existing(this);
    this.setDepth(200);
    this.setVisible(false);

    scene.scale.on('resize', () => {
      this.setPosition(scene.scale.width / 2, scene.scale.height / 2);
    });
  }

  refresh(power: number, hasAxe: boolean, output: { itemId: string; quantity: number } | null): void {
    this.powerText.setText(power > 0 ? `ENERGY: ${power} hits remaining` : 'OUT OF ENERGY')
      .setColor(power > 0 ? '#e0e0e0' : '#e63946');

    this.axeBtnText.setText(hasAxe ? 'Rem. Axe' : 'Ins. Axe');
    this.axeBtnBg.setFillStyle(hasAxe ? 0x4a2a2a : 0x2a4a2a);
    this.axeBtnBg.setStrokeStyle(1, hasAxe ? 0xe63946 : 0x52b788);

    if (output) {
      const spriteKey = ITEMS[output.itemId]?.spriteKey ?? 'item-rock';
      this.outputIcon.setTexture(spriteKey).setVisible(true);
      this.outputQtyText.setText(`×${output.quantity}`).setVisible(true);
      this.outputEmptyText.setVisible(false);
      this.takeBtnBg.setAlpha(1).setInteractive();
    } else {
      this.outputIcon.setVisible(false);
      this.outputQtyText.setVisible(false);
      this.outputEmptyText.setVisible(true);
      this.takeBtnBg.setAlpha(0.4).disableInteractive();
    }
  }

  show(): void { this.setVisible(true); }
  hide(): void { this.setVisible(false); }
}
