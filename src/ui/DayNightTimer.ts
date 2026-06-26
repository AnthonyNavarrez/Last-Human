import Phaser from 'phaser';

const PANEL_W = 148;
const PANEL_H = 28;

export class DayNightTimer extends Phaser.GameObjects.Container {
  private bg: Phaser.GameObjects.Rectangle;
  private phaseText: Phaser.GameObjects.Text;
  private timerText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    super(scene, scene.scale.width / 2, 18);

    this.bg = scene.add.rectangle(0, 0, PANEL_W, PANEL_H, 0x000000, 0.65)
      .setStrokeStyle(1, 0x444466);
    this.add(this.bg);

    this.phaseText = scene.add.text(-8, 0, 'DAY 1', {
      fontSize: '12px', color: '#f1c40f', fontStyle: 'bold',
    }).setOrigin(1, 0.5);
    this.add(this.phaseText);

    // Divider
    const divider = scene.add.rectangle(0, 0, 1, 16, 0x555577);
    this.add(divider);

    this.timerText = scene.add.text(6, 0, '3:00', {
      fontSize: '12px', color: '#ffffff',
    }).setOrigin(0, 0.5);
    this.add(this.timerText);

    scene.add.existing(this);
    this.setDepth(150);

    scene.scale.on('resize', () => {
      this.setPosition(scene.scale.width / 2, 18);
    });
  }

  /** Sync display from registry values each frame. */
  sync(phase: string, dayNumber: number, nightNumber: number, phaseTimer: number): void {
    const isNight = phase === 'night';
    this.phaseText.setText(`${isNight ? 'NIGHT' : 'DAY'} ${isNight ? nightNumber : dayNumber}`);
    this.phaseText.setColor(isNight ? '#a0c4ff' : '#f1c40f');

    const secs = Math.max(0, Math.ceil(phaseTimer));
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    this.timerText.setText(`${m}:${s.toString().padStart(2, '0')}`);

    const warning = phaseTimer <= 30;
    this.timerText.setColor(warning ? '#e63946' : '#ffffff');
    this.bg.setFillStyle(warning ? 0x1a0000 : 0x000000, 0.65);
  }
}
