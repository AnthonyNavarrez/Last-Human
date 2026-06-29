import Phaser from 'phaser';
import { C } from '../../constants';

/** The structure enemies converge on. GameScene owns HP and regen logic. */
export class House extends Phaser.GameObjects.Image {
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'building-house');
    scene.add.existing(this);
    scene.physics.add.existing(this, true);
    this.setDisplaySize(48, 72);
    const body = this.body as Phaser.Physics.Arcade.StaticBody;
    const bw = 48, bh = 72;
    body.width = bw;
    body.height = bh;
    body.x = x - bw / 2;
    body.y = y - bh / 2;
    body.updateCenter();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const wld = (scene.physics.world as any);
    wld.staticTree.remove(body);
    wld.staticTree.insert(body);
    this.setDepth(C.DEPTH_OBJECTS);
  }
}
