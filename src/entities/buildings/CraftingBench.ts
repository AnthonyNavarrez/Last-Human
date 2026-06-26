import Phaser from 'phaser';
import { C } from '../../constants';

/** Static world object. Player walks up and presses E to open the crafting menu. */
export class CraftingBench extends Phaser.GameObjects.Image {
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'building-crafting-bench');
    scene.add.existing(this);
    scene.physics.add.existing(this, true);
    this.setDepth(C.DEPTH_OBJECTS);
    this.setScale(1.5);
  }
}
