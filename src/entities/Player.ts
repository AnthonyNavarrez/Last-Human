import Phaser from 'phaser';
import { C } from '../constants';

export interface MoveInput {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}

export class Player extends Phaser.Physics.Arcade.Sprite {
  private facing: 'up' | 'down' | 'left' | 'right' = 'down';

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'player-walk', 0);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    (this.body as Phaser.Physics.Arcade.Body).setCollideWorldBounds(true);
    this.setDepth(C.DEPTH_PLAYER);
    this.registerAnimations();
    this.play('idle-down');
  }

  /** Registers walk + idle animations for all 4 directions.
   *  Walk.png layout: each COLUMN is one direction, each ROW is one walk frame.
   *  col 0 = down, col 1 = up, col 2 = left, col 3 = right
   *  Frame number = col + row * 4  (Phaser counts left-to-right then top-to-bottom)
   */
  private registerAnimations(): void {
    const anims = this.scene.anims;
    const dirs = [
      { key: 'down',  col: 0 },
      { key: 'up',    col: 1 },
      { key: 'left',  col: 2 },
      { key: 'right', col: 3 },
    ] as const;

    dirs.forEach(({ key, col }) => {
      const walkFrames = [0, 1, 2, 3].map(row => ({ key: 'player-walk', frame: col + row * 4 }));
      if (!anims.exists(`walk-${key}`)) {
        anims.create({ key: `walk-${key}`, frames: walkFrames, frameRate: 8, repeat: -1 });
      }
      if (!anims.exists(`idle-${key}`)) {
        anims.create({ key: `idle-${key}`, frames: [{ key: 'player-walk', frame: col }], frameRate: 1, repeat: 0 });
      }
    });
  }

  /** Applies movement input, updates velocity and animation. Returns current facing direction. */
  move(input: MoveInput): 'up' | 'down' | 'left' | 'right' {
    let vx = 0;
    let vy = 0;

    if (input.left)  vx -= C.PLAYER_SPEED;
    if (input.right) vx += C.PLAYER_SPEED;
    if (input.up)    vy -= C.PLAYER_SPEED;
    if (input.down)  vy += C.PLAYER_SPEED;

    if (vx !== 0 && vy !== 0) {
      vx *= Math.SQRT1_2;
      vy *= Math.SQRT1_2;
    }

    this.setVelocity(vx, vy);

    const moving = vx !== 0 || vy !== 0;
    if (moving) {
      if (Math.abs(vx) >= Math.abs(vy)) {
        this.facing = vx < 0 ? 'left' : 'right';
      } else {
        this.facing = vy < 0 ? 'up' : 'down';
      }
      const walkKey = `walk-${this.facing}`;
      if (this.anims.currentAnim?.key !== walkKey) this.play(walkKey);
    } else {
      const idleKey = `idle-${this.facing}`;
      if (this.anims.currentAnim?.key !== idleKey) this.play(idleKey);
    }

    return this.facing;
  }
}
