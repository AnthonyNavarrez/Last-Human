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

// Equipment section: armor column (left) + accessory column (right of armor)
const EQUIP_LABELS = ['HELM', 'CHEST', 'LEGS', 'BOOTS', 'ACC'] as const;
const NUM_EQUIP    = 5;
const EQUIP_W      = 2 * SLOT + GAP;                     // 108
const DIVIDER      = 10;                                  // gap between equip and inv grid
const INV_W        = COLS * SLOT + (COLS - 1) * GAP;     // 444
const EQUIP_H      = 4 * SLOT + 3 * GAP;                 // 220 (4 armor rows)
const INV_H        = ROWS * SLOT + (ROWS - 1) * GAP;     // 108
const INV_OFFSET_Y = (EQUIP_H - INV_H) / 2;              // 56 (center inv within equip height)
const INNER_W      = EQUIP_W + DIVIDER + INV_W;          // 562
const INNER_H      = EQUIP_H;                             // 220
const PANEL_W      = INNER_W + PAD * 2;                   // 590
const PANEL_H      = INNER_H + PAD * 2 + TITLE_H;        // 270

export { SLOT as INV_SLOT };

export class InventoryPanel {
  private scene: Phaser.Scene;
  private allObjects: Phaser.GameObjects.GameObject[] = [];

  private panelBg!: Phaser.GameObjects.Rectangle;
  private dividerLine!: Phaser.GameObjects.Rectangle;
  private titleText!: Phaser.GameObjects.Text;

  // Inventory slots
  private slotFrames: Phaser.GameObjects.Rectangle[] = [];
  private slotIcons: (Phaser.GameObjects.Image | null)[] = [];
  private slotQtys: Phaser.GameObjects.Text[] = [];
  private prevKeys: string[] = [];
  private _dragSourceIdx: number | null = null;

  // Equipment slots
  private equipFrames: Phaser.GameObjects.Rectangle[] = [];
  private equipIcons: (Phaser.GameObjects.Image | null)[] = [];
  private equipQtys: Phaser.GameObjects.Text[] = [];
  private equipLabels: Phaser.GameObjects.Text[] = [];
  private equipPrevKeys: string[] = [];
  private _equipDragSourceIdx: number | null = null;

  visible = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.buildStatic();
    this.setVisible(false);
    scene.scale.on('resize', this.reposition, this);
  }

  private get cx(): number { return Math.round(this.scene.scale.width  / 2); }
  private get cy(): number { return Math.round(this.scene.scale.height / 2); }
  private get contentLeft(): number { return this.cx - INNER_W / 2; }
  private get contentTop(): number  { return this.cy - INNER_H / 2 + TITLE_H / 2; }

  // Inventory slot center position
  slotPos(idx: number): [number, number] {
    const col = idx % COLS;
    const row = Math.floor(idx / COLS);
    return [
      this.contentLeft + EQUIP_W + DIVIDER + col * (SLOT + GAP) + SLOT / 2,
      this.contentTop  + INV_OFFSET_Y + row * (SLOT + GAP) + SLOT / 2,
    ];
  }

  // Equipment slot center position
  // i: 0=helmet, 1=chestplate, 2=leggings, 3=boots, 4=accessory
  equipSlotPos(i: number): [number, number] {
    if (i < 4) {
      // Armor: single left column
      return [
        this.contentLeft + SLOT / 2,
        this.contentTop + i * (SLOT + GAP) + SLOT / 2,
      ];
    } else {
      // Accessory: right of armor column, aligned at row 1 (next to chestplate)
      return [
        this.contentLeft + SLOT + GAP + SLOT / 2,
        this.contentTop + 1 * (SLOT + GAP) + SLOT / 2,
      ];
    }
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

    // Vertical divider between equipment section and inventory grid
    const divX = this.contentLeft + EQUIP_W + DIVIDER / 2;
    this.dividerLine = this.scene.add.rectangle(
      divX, this.cy + TITLE_H / 2,
      1, INNER_H - 4, 0x3a4466, 0.6,
    ).setDepth(DEPTH + 1).setScrollFactor(0);
    this.allObjects.push(this.dividerLine);

    // Equipment slots
    for (let i = 0; i < NUM_EQUIP; i++) {
      const [sx, sy] = this.equipSlotPos(i);

      const frame = this.scene.add.rectangle(sx, sy, SLOT - 2, SLOT - 2, 0x1a1a2e)
        .setStrokeStyle(1, 0x4a3a66)
        .setDepth(DEPTH + 2)
        .setScrollFactor(0);
      this.equipFrames.push(frame);
      this.allObjects.push(frame);

      const label = this.scene.add.text(
        sx, sy - (SLOT - 2) / 2 + 3,
        EQUIP_LABELS[i],
        { fontSize: '7px', color: '#6655aa' },
      ).setOrigin(0.5, 0).setDepth(DEPTH + 4).setScrollFactor(0);
      this.equipLabels.push(label);
      this.allObjects.push(label);

      const qty = this.scene.add.text(
        sx + (SLOT - 2) / 2 - 1, sy + (SLOT - 2) / 2 - 1, '',
        { fontSize: '12px', color: '#ffffff', stroke: '#000000', strokeThickness: 3 },
      ).setOrigin(1, 1).setDepth(DEPTH + 4).setScrollFactor(0);
      this.equipQtys.push(qty);
      this.allObjects.push(qty);

      this.equipIcons.push(null);
      this.equipPrevKeys.push('');
    }

    // Inventory slots
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

    const divX = this.contentLeft + EQUIP_W + DIVIDER / 2;
    this.dividerLine.setPosition(divX, this.cy + TITLE_H / 2);

    for (let i = 0; i < NUM_EQUIP; i++) {
      const [sx, sy] = this.equipSlotPos(i);
      this.equipFrames[i].setPosition(sx, sy);
      this.equipLabels[i].setPosition(sx, sy - (SLOT - 2) / 2 + 3);
      this.equipQtys[i].setPosition(sx + (SLOT - 2) / 2 - 1, sy + (SLOT - 2) / 2 - 1);
      this.equipIcons[i]?.setPosition(sx, sy);
    }

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

  setEquipDragSource(idx: number | null): void {
    this._equipDragSourceIdx = idx;
  }

  refresh(inventory: (ItemStack | null)[], equipment: (ItemStack | null)[] | null): void {
    // Update equipment slots
    for (let i = 0; i < NUM_EQUIP; i++) {
      const slot   = equipment?.[i] ?? null;
      const newKey = slot ? (ITEMS[slot.itemId]?.spriteKey ?? '') : '';
      const [sx, sy] = this.equipSlotPos(i);
      const isDragSrc = i === this._equipDragSourceIdx;

      this.equipFrames[i].setFillStyle(isDragSrc ? 0x2a1a40 : 0x1a1a2e);

      if (newKey !== this.equipPrevKeys[i]) {
        this.equipIcons[i]?.destroy();
        if (newKey) {
          const src   = this.scene.textures.get(newKey).source[0];
          const ratio = src.width / src.height;
          const iw    = ratio >= 1 ? ICON_SZ : Math.round(ICON_SZ * ratio);
          const ih    = ratio <= 1 ? ICON_SZ : Math.round(ICON_SZ / ratio);
          this.equipIcons[i] = this.scene.add.image(sx, sy, newKey)
            .setDisplaySize(iw, ih)
            .setDepth(DEPTH + 3)
            .setScrollFactor(0)
            .setVisible(this.visible);
        } else {
          this.equipIcons[i] = null;
        }
        this.equipPrevKeys[i] = newKey;
      } else {
        this.equipIcons[i]?.setPosition(sx, sy);
      }

      this.equipIcons[i]?.setAlpha(isDragSrc ? 0.25 : 1);
      this.equipQtys[i].setText(slot && slot.quantity > 1 ? String(slot.quantity) : '');
    }

    // Update inventory slots
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
    for (const icon of this.slotIcons)  icon?.setVisible(vis);
    for (const icon of this.equipIcons) icon?.setVisible(vis);
    if (!vis) {
      this._dragSourceIdx = null;
      this._equipDragSourceIdx = null;
    }
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

  equipSlotAt(px: number, py: number): number {
    if (!this.visible) return -1;
    const half = SLOT / 2;
    for (let i = 0; i < NUM_EQUIP; i++) {
      const [sx, sy] = this.equipSlotPos(i);
      if (Math.abs(px - sx) <= half && Math.abs(py - sy) <= half) return i;
    }
    return -1;
  }
}
