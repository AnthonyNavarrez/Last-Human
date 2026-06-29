import Phaser from 'phaser';
import { C } from '../constants';
import { ITEMS } from '../data/items';

export class DroppedItem extends Phaser.GameObjects.Container {
  readonly itemId: string;
  readonly quantity: number;

  constructor(scene: Phaser.Scene, x: number, y: number, itemId: string, quantity: number) {
    super(scene, x, y);
    scene.add.existing(this);
    this.itemId = itemId;
    this.quantity = quantity;
    this.setDepth(C.DEPTH_DROPPED_ITEMS);

    const spriteKey = ITEMS[itemId].spriteKey;
    const img = scene.add.image(0, 0, spriteKey).setDisplaySize(12, 12);
    if (spriteKey === 'item-bow') img.setRotation(-Math.PI / 4);
    this.add(img);

    if (quantity > 1) {
      const label = scene.add.text(7, 7, String(quantity), {
        fontSize: '21px', color: '#ffffff',
        stroke: '#000000', strokeThickness: 6,
      }).setOrigin(1, 1).setScale(1 / 3);
      this.add(label);
    }

    scene.tweens.add({
      targets: this, y: y - 3,
      duration: 700, yoyo: true, repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }
}
