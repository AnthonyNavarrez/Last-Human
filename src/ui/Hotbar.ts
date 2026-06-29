import Phaser from 'phaser';
import { C } from '../constants';
import { ItemStack } from '../systems/GameState';
import { ITEMS } from '../data/items';

const SLOT      = 56;
const SLOT_BIG  = Math.round(SLOT * 1.3);
const GAP       = 5;
const PAD       = 10;
const ICON_NORM = 34;
const ICON_BIG  = Math.round(ICON_NORM * 1.3);

export class Hotbar {
  private scene: Phaser.Scene;
  private frames:         Phaser.GameObjects.Image[]          = [];
  private icons:          (Phaser.GameObjects.Image | null)[] = [];
  private qtys:           Phaser.GameObjects.Text[]           = [];
  private nums:           Phaser.GameObjects.Text[]           = [];
  private prevKeys:       string[]                            = [];
  private currentSlots:   (ItemStack | null)[]                = [];
  private _dragSourceIdx: number | null                       = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    for (let i = 0; i < C.HOTBAR_SIZE; i++) {
      const [sx, sy] = this.slotPos(i);

      const frame = scene.add.image(sx, sy, 'ui-hotbar-slot')
        .setDisplaySize(SLOT, SLOT)
        .setDepth(C.DEPTH_UI)
        .setScrollFactor(0)
        .setInteractive();

      frame.on('pointerdown', () => {
        scene.game.events.emit('select-hotbar-slot', i);
      });

      frame.on('pointerover', () => {
        const slot = this.currentSlots[i];
        if (slot) scene.game.events.emit('show-tooltip', { itemId: slot.itemId });
      });

      frame.on('pointerout', () => {
        scene.game.events.emit('hide-tooltip');
      });

      this.frames.push(frame);

      this.nums.push(
        scene.add.text(sx - SLOT / 2 + 3, sy - SLOT / 2 + 2, String(i + 1), {
          fontSize: '8px', color: '#888888',
        }).setDepth(C.DEPTH_UI + 1).setScrollFactor(0),
      );

      this.qtys.push(
        scene.add.text(sx + SLOT / 2 - 2, sy + SLOT / 2 - 2, '', {
          fontSize: '14px', color: '#ffffff',
          stroke: '#000000', strokeThickness: 3,
        }).setOrigin(1, 1).setDepth(C.DEPTH_UI + 2).setScrollFactor(0),
      );

      this.icons.push(null);
      this.prevKeys.push('');
    }

    scene.scale.on('resize', this.reposition, this);
  }

  setDragSource(idx: number | null): void {
    this._dragSourceIdx = idx;
  }

  slotAt(px: number, py: number): number {
    const half = SLOT / 2;
    for (let i = 0; i < C.HOTBAR_SIZE; i++) {
      const [sx, sy] = this.slotPos(i);
      if (Math.abs(px - sx) <= half && Math.abs(py - sy) <= half) return i;
    }
    return -1;
  }

  private slotPos(i: number): [number, number] {
    const { width, height } = this.scene.scale;
    const totalW = C.HOTBAR_SIZE * SLOT + (C.HOTBAR_SIZE - 1) * GAP;
    const startX = (width - totalW) / 2 + SLOT / 2;
    return [startX + i * (SLOT + GAP), height - SLOT / 2 - PAD];
  }

  reposition(): void {
    for (let i = 0; i < C.HOTBAR_SIZE; i++) {
      const [sx, sy] = this.slotPos(i);
      this.frames[i].setPosition(sx, sy);
      this.nums[i].setPosition(sx - SLOT / 2 + 3, sy - SLOT / 2 + 2);
      this.qtys[i].setPosition(sx + SLOT / 2 - 2, sy + SLOT / 2 - 2);
      this.icons[i]?.setPosition(sx, sy);
    }
  }

  update(hotbar: (ItemStack | null)[], activeSlot: number): void {
    this.currentSlots = hotbar;

    for (let i = 0; i < C.HOTBAR_SIZE; i++) {
      const slot = hotbar[i];
      const [sx, sy] = this.slotPos(i);
      const active = i === activeSlot;
      const size = active ? SLOT_BIG : SLOT;

      this.frames[i]
        .setDisplaySize(size, size)
        .setDepth(active ? C.DEPTH_UI + 1 : C.DEPTH_UI);

      if (active) this.frames[i].setTint(0xffdd44);
      else        this.frames[i].clearTint();

      const newKey = slot ? (ITEMS[slot.itemId]?.spriteKey ?? '') : '';
      if (newKey !== this.prevKeys[i]) {
        this.icons[i]?.destroy();
        this.icons[i] = newKey
          ? scene_add_image(this.scene, sx, sy, newKey)
          : null;
        if (this.icons[i] && newKey === 'item-bow')
          this.icons[i]!.setRotation(-Math.PI / 4);
        this.prevKeys[i] = newKey;
      }

      if (this.icons[i]) {
        const iconMax = active ? ICON_BIG : ICON_NORM;
        const src = this.scene.textures.get(newKey || this.prevKeys[i]).source[0];
        const ratio = src.width / src.height;
        const iw = ratio >= 1 ? iconMax : Math.round(iconMax * ratio);
        const ih = ratio <= 1 ? iconMax : Math.round(iconMax / ratio);
        this.icons[i]!.setDisplaySize(iw, ih);
        this.icons[i]!.setAlpha(i === this._dragSourceIdx ? 0.25 : 1);
      }
      this.qtys[i].setText(slot && slot.quantity > 1 ? String(slot.quantity) : '');
    }
  }
}

function scene_add_image(
  scene: Phaser.Scene,
  x: number,
  y: number,
  key: string,
): Phaser.GameObjects.Image {
  return scene.add.image(x, y, key)
    .setDisplaySize(ICON_NORM, ICON_NORM)
    .setDepth(C.DEPTH_UI - 1)
    .setScrollFactor(0);
}
