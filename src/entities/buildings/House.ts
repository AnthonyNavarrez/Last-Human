import Phaser from 'phaser';
import { C } from '../../constants';

/** The structure enemies converge on. GameScene owns HP and regen logic. */
export class House extends Phaser.GameObjects.Image {
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'building-house');
    scene.add.existing(this);
    scene.physics.add.existing(this, true);
    this.setDepth(C.DEPTH_OBJECTS);
  }
}
