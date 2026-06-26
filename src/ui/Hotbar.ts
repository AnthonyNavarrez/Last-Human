import Phaser from 'phaser';
import { C } from '../constants';
import { ItemStack } from '../systems/GameState';
import { ITEMS } from '../data/items';

const SLOT  = 40;
const GAP   = 4;
const PAD   = 10;

export class Hotbar {
  private scene: Phaser.Scene;
  private bgs:      Phaser.GameObjects.Rectangle[]       = [];
  private icons:    (Phaser.GameObjects.Image | null)[]  = [];
  private qtys:     Phaser.GameObjects.Text[]            = [];
  private nums:     Phaser.GameObjects.Text[]            = [];
  private prevKeys: string[]                             = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    for (let i = 0; i < C.HOTBAR_SIZE; i++) {
      const [sx, sy] = this.slotPos(i);

      this.bgs.push(
        scene.add.rectangle(sx, sy, SLOT, SLOT, 0x000000, 0.55)
          .setStrokeStyle(2, 0xffffff, 0.7)
          .setDepth(C.DEPTH_UI)
          .setScrollFactor(0),
      );

      this.nums.push(
        scene.add.text(sx - SLOT / 2 + 3, sy - SLOT / 2 + 2, String(i + 1), {
          fontSize: '8px', color: '#888888',
        }).setDepth(C.DEPTH_UI + 1).setScrollFactor(0),
      );

      this.qtys.push(
        scene.add.text(sx + SLOT / 2 - 2, sy + SLOT / 2 - 2, '', {
          fontSize: '10px', color: '#ffffff',
          stroke: '#000000', strokeThickness: 2,
        }).setOrigin(1, 1).setDepth(C.DEPTH_UI + 2).setScrollFactor(0),
      );

      this.icons.push(null);
      this.prevKeys.push('');
    }

    scene.scale.on('resize', this.reposition, this);
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
      this.bgs[i].setPosition(sx, sy);
      this.nums[i].setPosition(sx - SLOT / 2 + 3, sy - SLOT / 2 + 2);
      this.qtys[i].setPosition(sx + SLOT / 2 - 2, sy + SLOT / 2 - 2);
      this.icons[i]?.setPosition(sx, sy);
    }
  }

  update(hotbar: (ItemStack | null)[], activeSlot: number): void {
    for (let i = 0; i < C.HOTBAR_SIZE; i++) {
      const slot = hotbar[i];
      const [sx, sy] = this.slotPos(i);

      this.bgs[i].setStrokeStyle(
        2,
        i === activeSlot ? 0xffdd00 : 0xffffff,
        i === activeSlot ? 1.0 : 0.7,
      );

      const newKey = slot ? (ITEMS[slot.itemId]?.spriteKey ?? '') : '';
      if (newKey !== this.prevKeys[i]) {
        this.icons[i]?.destroy();
        this.icons[i] = newKey
          ? scene_add_image(this.scene, sx, sy, newKey)
          : null;
        this.prevKeys[i] = newKey;
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
    .setDisplaySize(28, 28)
    .setDepth(C.DEPTH_UI + 1)
    .setScrollFactor(0);
}
