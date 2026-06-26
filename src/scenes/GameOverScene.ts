import Phaser from 'phaser';

interface GameOverData {
  nightsSurvived?: number;
  dayReached?: number;
}

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super({ key: 'game-over' });
  }

  create(data: GameOverData): void {
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;
    const nights = data?.nightsSurvived ?? 0;
    const days   = data?.dayReached   ?? 1;

    // Full-screen dark backdrop
    this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x0d0d0d, 0.92)
      .setOrigin(0, 0);

    // Title
    this.add.text(cx, cy - 110, 'GAME OVER', {
      fontSize: '56px',
      fontFamily: 'monospace',
      color: '#cc3333',
      stroke: '#000000',
      strokeThickness: 6,
    }).setOrigin(0.5);

    // Cause of death
    this.add.text(cx, cy - 48, 'Your house was destroyed.', {
      fontSize: '16px',
      fontFamily: 'monospace',
      color: '#aaaaaa',
    }).setOrigin(0.5);

    // Stats
    this.add.text(cx, cy, `Nights survived: ${nights}`, {
      fontSize: '20px',
      fontFamily: 'monospace',
      color: '#e8c96e',
    }).setOrigin(0.5);

    this.add.text(cx, cy + 30, `Days reached: ${days}`, {
      fontSize: '20px',
      fontFamily: 'monospace',
      color: '#e8c96e',
    }).setOrigin(0.5);

    // Restart button — active after a short delay so it can't be mis-clicked
    const restartBtn = this.add.text(cx, cy + 110, '[ PLAY AGAIN ]', {
      fontSize: '28px',
      fontFamily: 'monospace',
      color: '#888888',
      backgroundColor: '#2a2a2a',
      padding: { x: 20, y: 10 },
    }).setOrigin(0.5);

    this.time.delayedCall(1200, () => {
      restartBtn
        .setStyle({ color: '#ffffff', backgroundColor: '#2a5f2a' })
        .setInteractive({ useHandCursor: true });

      restartBtn.on('pointerover', () => restartBtn.setStyle({ color: '#e8c96e' }));
      restartBtn.on('pointerout',  () => restartBtn.setStyle({ color: '#ffffff' }));
      restartBtn.on('pointerdown', () => {
        this.scene.start('game');
        this.scene.launch('ui');
      });
    });
  }
}
