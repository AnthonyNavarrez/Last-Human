import Phaser from 'phaser';
import { C } from '../constants';
import { ITEMS } from '../data/items';

export class DroppedItem extends Phaser.GameObjects.Image {
  readonly itemId: string;
  readonly quantity: number;

  constructor(scene: Phaser.Scene, x: number, y: number, itemId: string, quantity: number) {
    super(scene, x, y, ITEMS[itemId].spriteKey);
    scene.add.existing(this);
    this.itemId = itemId;
    this.quantity = quantity;
    this.setDepth(C.DEPTH_DROPPED_ITEMS);
    // Gentle bob so dropped items are visible
    scene.tweens.add({
      targets: this, y: y - 3,
      duration: 700, yoyo: true, repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }
}
