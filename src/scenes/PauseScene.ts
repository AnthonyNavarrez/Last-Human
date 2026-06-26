import Phaser from 'phaser';

export class PauseScene extends Phaser.Scene {
  constructor() {
    super({ key: 'pause' });
  }

  create(): void {
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;

    // Semi-transparent overlay
    this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x000000, 0.6).setOrigin(0, 0);

    this.add.text(cx, cy - 60, 'PAUSED', {
      fontSize: '48px',
      fontFamily: 'monospace',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5);

    const resumeBtn = this.add.text(cx, cy + 20, '[ RESUME ]', {
      fontSize: '28px',
      fontFamily: 'monospace',
      color: '#ffffff',
      backgroundColor: '#2a5f2a',
      padding: { x: 16, y: 8 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    resumeBtn.on('pointerover', () => resumeBtn.setStyle({ color: '#e8c96e' }));
    resumeBtn.on('pointerout',  () => resumeBtn.setStyle({ color: '#ffffff' }));
    resumeBtn.on('pointerdown', () => this.scene.stop('pause'));

    const esc = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    esc.once('down', () => this.scene.stop('pause'));
  }
}
