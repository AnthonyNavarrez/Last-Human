import Phaser from 'phaser';
import { C } from '../constants';

export interface MoveInput {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}

const DISPLAY = 48;

// Per-weapon animation sets. Add more entries as new weapons are introduced.
const WEAPON_ANIMS: Record<string, { idle: string; run: string; interact: string }> = {
  stone_axe: {
    idle:     'player-axe-idle',
    run:      'player-axe-run',
    interact: 'player-axe-interact',
  },
  stone_pickaxe: {
    idle:     'player-pickaxe-idle',
    run:      'player-pickaxe-run',
    interact: 'player-pickaxe-interact',
  },
  iron_sword: {
    idle:     'player-knife-idle',
    run:      'player-knife-run',
    interact: 'player-knife-interact',
  },
  bow: {
    idle:     'player-bow-idle',
    run:      'player-bow-run',
    interact: 'player-idle',
  },
};

export class Player extends Phaser.Physics.Arcade.Sprite {
  public speed: number = C.PLAYER_SPEED;
  private facing: 'up' | 'down' | 'left' | 'right' = 'down';
  private equippedItemId: string | null = null;
  private isAttacking = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'pawn-idle', 0);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDisplaySize(DISPLAY, DISPLAY);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setCollideWorldBounds(true);
    body.setSize(72, 72);
    body.setOffset(60, 90);
    this.setDepth(C.DEPTH_PLAYER);
    this.registerAnimations();
    this.play('player-idle');
  }

  /** Called each frame by GameScene with the currently active hotbar item. */
  setEquipped(itemId: string | null): void {
    if (itemId === this.equippedItemId) return;
    this.equippedItemId = itemId;
    // Cancel any in-progress attack animation when weapon changes
    if (this.isAttacking) this.isAttacking = false;
  }

  /**
   * Play an interact animation once, then return to idle/run.
   * Pass an explicit animKey to override; otherwise uses the equipped weapon's interact anim.
   * No-ops if no animation can be resolved.
   */
  playAttackAnim(animKey?: string): void {
    const key = animKey ?? (this.equippedItemId ? WEAPON_ANIMS[this.equippedItemId]?.interact : undefined);
    if (!key) return;
    this.isAttacking = true;
    this.play(key);
    this.once(`animationcomplete-${key}`, () => {
      this.isAttacking = false;
    });
  }

  private registerAnimations(): void {
    const anims = this.scene.anims;

    const register = (key: string, texture: string, start: number, end: number, fps: number) => {
      if (!anims.exists(key)) {
        anims.create({
          key,
          frames: anims.generateFrameNumbers(texture, { start, end }),
          frameRate: fps,
          repeat: -1,
        });
      }
    };
    const registerOnce = (key: string, texture: string, start: number, end: number, fps: number) => {
      if (!anims.exists(key)) {
        anims.create({
          key,
          frames: anims.generateFrameNumbers(texture, { start, end }),
          frameRate: fps,
          repeat: 0,
        });
      }
    };

    register('player-idle',              'pawn-idle',             0, 7, 8);
    register('player-run',               'pawn-run',              0, 5, 10);
    register('player-axe-idle',          'pawn-idle-axe',         0, 7, 8);
    register('player-axe-run',           'pawn-run-axe',          0, 5, 10);
    registerOnce('player-axe-interact',      'pawn-interact-axe',     0, 5, 16);
    register('player-pickaxe-idle',      'pawn-idle-pickaxe',     0, 7, 8);
    register('player-pickaxe-run',       'pawn-run-pickaxe',      0, 5, 10);
    registerOnce('player-pickaxe-interact',  'pawn-interact-pickaxe', 0, 5, 16);
    register('player-knife-idle',        'pawn-idle-knife',       0, 7, 8);
    register('player-knife-run',         'pawn-run-knife',        0, 5, 10);
    registerOnce('player-knife-interact',    'pawn-interact-knife',   0, 3, 16);
    register('player-bow-idle',          'pawn-idle-bow',         0, 7, 8);
    register('player-bow-run',           'pawn-run-bow',          0, 5, 10);
  }

  /** Applies movement input, updates velocity and animation. Returns current facing direction. */
  move(input: MoveInput): 'up' | 'down' | 'left' | 'right' {
    let vx = 0;
    let vy = 0;

    if (input.left)  vx -= this.speed;
    if (input.right) vx += this.speed;
    if (input.up)    vy -= this.speed;
    if (input.down)  vy += this.speed;

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
      if (vx < 0) this.setFlipX(true);
      else if (vx > 0) this.setFlipX(false);
    }

    if (!this.isAttacking) {
      const set = this.equippedItemId ? WEAPON_ANIMS[this.equippedItemId] : undefined;
      const idleKey = set ? set.idle : 'player-idle';
      const runKey  = set ? set.run  : 'player-run';
      const target  = moving ? runKey : idleKey;
      if (this.anims.currentAnim?.key !== target) this.play(target);
    }

    return this.facing;
  }
}
