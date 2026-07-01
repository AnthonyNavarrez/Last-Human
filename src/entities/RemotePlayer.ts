import Phaser from 'phaser';
import { C } from '../constants';

export class RemotePlayer extends Phaser.GameObjects.Sprite {
  private targetX = 0;
  private targetY = 0;
  private animKey = 'remote-player-idle';
  private isAttacking = false;
  private nameLabel: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, x: number, y: number, name: string) {
    super(scene, x, y, 'pawn-idle', 0);
    scene.add.existing(this);
    this.setScale(0.25);
    this.setDepth(C.DEPTH_PLAYER);
    this.play('remote-player-idle');
    this.targetX = x;
    this.targetY = y;

    this.nameLabel = scene.add.text(x, y + 16, name, {
      fontSize: '22px',
      fontFamily: 'monospace',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(C.DEPTH_PLAYER + 1).setScale(0.27);
  }

  static registerAnims(anims: Phaser.Animations.AnimationManager): void {
    if (!anims.exists('remote-player-idle')) {
      anims.create({
        key: 'remote-player-idle',
        frames: anims.generateFrameNumbers('pawn-idle', { start: 0, end: 3 }),
        frameRate: 6,
        repeat: -1,
      });
    }
    if (!anims.exists('remote-player-run')) {
      anims.create({
        key: 'remote-player-run',
        frames: anims.generateFrameNumbers('pawn-run', { start: 0, end: 5 }),
        frameRate: 10,
        repeat: -1,
      });
    }
  }

  applyServerUpdate(x: number, y: number, attackAnim: string | null): void {
    const dx = x - this.targetX;
    const dy = y - this.targetY;
    this.targetX = x;
    this.targetY = y;

    const moving = Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5;
    if (moving) this.setFlipX(dx < 0);

    if (attackAnim && !this.isAttacking) {
      this.isAttacking = true;
      this.play(attackAnim);
      this.once(`animationcomplete-${attackAnim}`, () => {
        this.isAttacking = false;
        this.animKey = '';
      });
      return;
    }

    if (!this.isAttacking) {
      const want = moving ? 'remote-player-run' : 'remote-player-idle';
      if (this.animKey !== want) {
        this.animKey = want;
        this.play(want);
      }
    }
  }

  tick(delta: number): void {
    const t = Math.min(1, (delta / 1000) * 20);
    this.x = Phaser.Math.Linear(this.x, this.targetX, t);
    this.y = Phaser.Math.Linear(this.y, this.targetY, t);
    this.nameLabel.setPosition(this.x, this.y + 16);
  }

  override destroy(fromScene?: boolean): void {
    this.nameLabel?.destroy();
    super.destroy(fromScene);
  }
}
