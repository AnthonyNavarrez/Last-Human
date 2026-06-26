import Phaser from 'phaser';

export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'menu' });
  }

  create(): void {
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;

    this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x0d1117).setOrigin(0, 0);

    this.add.text(cx, cy - 80, 'LAST HUMAN', {
      fontSize: '64px',
      fontFamily: 'monospace',
      color: '#e8c96e',
      stroke: '#000000',
      strokeThickness: 6,
    }).setOrigin(0.5);

    this.add.text(cx, cy - 20, 'Survive the night. Every night.', {
      fontSize: '18px',
      fontFamily: 'monospace',
      color: '#8fa3b1',
    }).setOrigin(0.5);

    const playBtn = this.add.text(cx, cy + 60, '[ PLAY ]', {
      fontSize: '32px',
      fontFamily: 'monospace',
      color: '#ffffff',
      backgroundColor: '#2a5f2a',
      padding: { x: 20, y: 10 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    playBtn.on('pointerover', () => playBtn.setStyle({ color: '#e8c96e' }));
    playBtn.on('pointerout',  () => playBtn.setStyle({ color: '#ffffff' }));
    playBtn.on('pointerdown', () => {
      this.scene.start('game');
      this.scene.launch('ui');
      this.scene.stop('menu');
    });
  }
}
