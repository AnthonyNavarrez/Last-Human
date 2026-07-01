import Phaser from 'phaser';
import { ITEMS } from '../data/items';

const PAD = 16;
const LINE_H = 26;
const MIN_W = 140;

const TYPE_LABELS: Record<string, string> = {
  resource: 'Resource',
  tool: 'Tool',
  weapon: 'Weapon',
  ammo: 'Ammo',
  placeable: 'Placeable',
  consumable: 'Consumable',
};

export class Tooltip extends Phaser.GameObjects.Container {
  private bg: Phaser.GameObjects.Rectangle;
  private nameTxt: Phaser.GameObjects.Text;
  private typeTxt: Phaser.GameObjects.Text;
  private statTxt: Phaser.GameObjects.Text;
  private descTxt: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);

    this.bg = scene.add.rectangle(0, 0, MIN_W, 60, 0x0d0d1a, 0.92)
      .setStrokeStyle(1, 0x4a9eff)
      .setOrigin(0, 1);

    this.nameTxt = scene.add.text(PAD, 0, '', {
      fontSize: '18px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0, 0);

    this.typeTxt = scene.add.text(PAD, 0, '', {
      fontSize: '15px', color: '#8888aa',
    }).setOrigin(0, 0);

    this.statTxt = scene.add.text(PAD, 0, '', {
      fontSize: '15px', color: '#f0a500',
    }).setOrigin(0, 0);

    this.descTxt = scene.add.text(PAD, 0, '', {
      fontSize: '15px', color: '#aaddff',
    }).setOrigin(0, 0);

    this.add([this.bg, this.nameTxt, this.typeTxt, this.statTxt, this.descTxt]);
    scene.add.existing(this);
    this.setDepth(500);
    this.setVisible(false);
  }

  show(itemId: string): void {
    const def = ITEMS[itemId];
    if (!def) { this.setVisible(false); return; }

    const typeLabel = TYPE_LABELS[def.type] ?? def.type;
    const hasStat = def.damage !== undefined;
    const hasDesc = !!def.description;

    let numLines = 2;
    if (hasStat) numLines++;
    if (hasDesc) numLines++;

    const totalH = PAD * 2 + numLines * LINE_H;
    let lineY = -totalH + PAD;

    this.nameTxt.setText(def.label).setPosition(PAD, lineY);
    lineY += LINE_H;
    this.typeTxt.setText(typeLabel).setPosition(PAD, lineY);
    lineY += LINE_H;

    this.statTxt.setVisible(hasStat);
    if (hasStat) {
      this.statTxt.setText(`Damage: ${def.damage}`).setPosition(PAD, lineY);
      lineY += LINE_H;
    }

    this.descTxt.setVisible(hasDesc);
    if (hasDesc) {
      this.descTxt.setText(def.description!).setPosition(PAD, lineY);
    }

    const maxW = Math.max(
      MIN_W,
      this.nameTxt.width + PAD * 2,
      this.typeTxt.width + PAD * 2,
      hasStat ? this.statTxt.width + PAD * 2 : 0,
      hasDesc ? this.descTxt.width + PAD * 2 : 0,
    );
    this.bg.setSize(maxW, totalH);

    this.setVisible(true);
  }

  hide(): void {
    this.setVisible(false);
  }

  moveToScreenPos(screenX: number, screenY: number): void {
    const { width } = this.scene.scale;
    const tw = this.bg.width;
    const th = this.bg.height;

    let tx = screenX + 12;
    let ty = screenY - 8;

    if (tx + tw > width) tx = screenX - tw - 12;
    if (ty - th < 4) ty = screenY + th + 8;

    this.setPosition(tx, ty);
  }
}
