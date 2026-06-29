import Phaser from 'phaser';
import { C } from '../constants';
import { ItemStack } from '../systems/GameState';
import { ITEMS } from '../data/items';

const SLOT    = 52;
const GAP     = 4;
const COLS    = C.INVENTORY_COLS;
const ROWS    = C.INVENTORY_ROWS;
const PAD     = 14;
const TITLE_H = 22;
const ICON_SZ = 32;
const DEPTH   = C.DEPTH_UI + 10;

const INNER_W = COLS * SLOT + (COLS - 1) * GAP;
const INNER_H = ROWS * SLOT + (ROWS - 1) * GAP;
const PANEL_W = INNER_W + PAD * 2;
const PANEL_H = INNER_H + PAD * 2 + TITLE_H;

export { SLOT as INV_SLOT };

export class InventoryPanel {
  private scene: Phaser.Scene;
  private allObjects: Phaser.GameObjects.GameObject[] = [];

  private panelBg!: Phaser.GameObjects.Rectangle;
  private titleText!: Phaser.GameObjects.Text;
  private slotFrames: Phaser.GameObjects.Rectangle[] = [];
  private slotIcons: (Phaser.GameObjects.Image | null)[] = [];
  private slotQtys: Phaser.GameObjects.Text[] = [];
  private prevKeys: string[] = [];
  private _dragSourceIdx: number | null = null;

  visible = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.buildStatic();
    this.setVisible(false);
    scene.scale.on('resize', this.reposition, this);
  }

  private get cx(): number { return Math.round(this.scene.scale.width  / 2); }
  private get cy(): number { return Math.round(this.scene.scale.height / 2); }

  slotPos(idx: number): [number, number] {
    const col = idx % COLS;
    const row = Math.floor(idx / COLS);
    const sx  = this.cx - INNER_W / 2 + col * (SLOT + GAP) + SLOT / 2;
    const sy  = this.cy - INNER_H / 2 + row * (SLOT + GAP) + SLOT / 2 + TITLE_H / 2;
    return [sx, sy];
  }

  private buildStatic(): void {
    this.panelBg = this.scene.add.rectangle(this.cx, this.cy, PANEL_W, PANEL_H, 0x0d0d22, 0.96)
      .setStrokeStyle(2, 0x4455bb)
      .setDepth(DEPTH)
      .setScrollFactor(0);
    this.allObjects.push(this.panelBg);

    this.titleText = this.scene.add.text(
      this.cx, this.cy - PANEL_H / 2 + PAD / 2 + 2,
      'INVENTORY',
      { fontSize: '11px', color: '#aabbff', fontStyle: 'bold' },
    ).setOrigin(0.5, 0).setDepth(DEPTH + 1).setScrollFactor(0);
    this.allObjects.push(this.titleText);

    for (let i = 0; i < ROWS * COLS; i++) {
      const [sx, sy] = this.slotPos(i);

      const frame = this.scene.add.rectangle(sx, sy, SLOT - 2, SLOT - 2, 0x1a1a3a)
        .setStrokeStyle(1, 0x3a4466)
        .setDepth(DEPTH + 2)
        .setScrollFactor(0);
      this.slotFrames.push(frame);
      this.allObjects.push(frame);

      const qty = this.scene.add.text(
        sx + (SLOT - 2) / 2 - 1, sy + (SLOT - 2) / 2 - 1, '',
        { fontSize: '12px', color: '#ffffff', stroke: '#000000', strokeThickness: 3 },
      ).setOrigin(1, 1).setDepth(DEPTH + 4).setScrollFactor(0);
      this.slotQtys.push(qty);
      this.allObjects.push(qty);

      this.slotIcons.push(null);
      this.prevKeys.push('');
    }
  }

  private reposition(): void {
    this.panelBg.setPosition(this.cx, this.cy);
    this.titleText.setPosition(this.cx, this.cy - PANEL_H / 2 + PAD / 2 + 2);
    for (let i = 0; i < ROWS * COLS; i++) {
      const [sx, sy] = this.slotPos(i);
      this.slotFrames[i].setPosition(sx, sy);
      this.slotQtys[i].setPosition(sx + (SLOT - 2) / 2 - 1, sy + (SLOT - 2) / 2 - 1);
      this.slotIcons[i]?.setPosition(sx, sy);
    }
  }

  setDragSource(idx: number | null): void {
    this._dragSourceIdx = idx;
  }

  refresh(inventory: (ItemStack | null)[]): void {
    for (let i = 0; i < ROWS * COLS; i++) {
      const slot   = inventory[i] ?? null;
      const newKey = slot ? (ITEMS[slot.itemId]?.spriteKey ?? '') : '';
      const [sx, sy] = this.slotPos(i);
      const isDragSrc = i === this._dragSourceIdx;

      this.slotFrames[i].setFillStyle(isDragSrc ? 0x2a2a50 : 0x1a1a3a);

      if (newKey !== this.prevKeys[i]) {
        this.slotIcons[i]?.destroy();
        if (newKey) {
          const src   = this.scene.textures.get(newKey).source[0];
          const ratio = src.width / src.height;
          const iw    = ratio >= 1 ? ICON_SZ : Math.round(ICON_SZ * ratio);
          const ih    = ratio <= 1 ? ICON_SZ : Math.round(ICON_SZ / ratio);
          this.slotIcons[i] = this.scene.add.image(sx, sy, newKey)
            .setDisplaySize(iw, ih)
            .setDepth(DEPTH + 3)
            .setScrollFactor(0)
            .setVisible(this.visible);
        } else {
          this.slotIcons[i] = null;
        }
        this.prevKeys[i] = newKey;
      } else {
        this.slotIcons[i]?.setPosition(sx, sy);
      }

      this.slotIcons[i]?.setAlpha(isDragSrc ? 0.25 : 1);
      this.slotQtys[i].setText(slot && slot.quantity > 1 ? String(slot.quantity) : '');
    }
  }

  setVisible(vis: boolean): void {
    this.visible = vis;
    for (const obj of this.allObjects) {
      (obj as unknown as Phaser.GameObjects.Image).setVisible(vis);
    }
    for (const icon of this.slotIcons) icon?.setVisible(vis);
    if (!vis) this._dragSourceIdx = null;
  }

  slotAt(px: number, py: number): number {
    if (!this.visible) return -1;
    const half = SLOT / 2;
    for (let i = 0; i < ROWS * COLS; i++) {
      const [sx, sy] = this.slotPos(i);
      if (Math.abs(px - sx) <= half && Math.abs(py - sy) <= half) return i;
    }
    return -1;
  }
}
