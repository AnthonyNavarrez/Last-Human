import Phaser from 'phaser';
import { C } from '../../constants';

/** Static world object. Player walks up and presses E to open the crafting menu. */
export class CraftingBench extends Phaser.GameObjects.Image {
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'building-crafting-bench');
    scene.add.existing(this);
    scene.physics.add.existing(this, true);
    this.setDepth(C.DEPTH_OBJECTS);
    this.setDisplaySize(C.TILE_SIZE * 2, C.TILE_SIZE * 2);
    const body = this.body as Phaser.Physics.Arcade.StaticBody;
    const bw = C.TILE_SIZE * 2, bh = C.TILE_SIZE * 2;
    body.width = bw;
    body.height = bh;
    body.x = x - bw / 2;
    body.y = y - bh / 2;
    body.updateCenter();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const wld = (scene.physics.world as any);
    wld.staticTree.remove(body);
    wld.staticTree.insert(body);
  }
}
