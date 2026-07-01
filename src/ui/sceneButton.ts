import Phaser from 'phaser';

export function sceneButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onClick: () => void,
): Phaser.GameObjects.Text {
  const btn = scene.add.text(x, y, label, {
    fontSize: '22px',
    fontFamily: 'monospace',
    color: '#ffffff',
    backgroundColor: '#00000099',
    padding: { x: 24, y: 12 },
    stroke: '#000000',
    strokeThickness: 2,
  }).setOrigin(0.5).setInteractive({ useHandCursor: true });

  btn.on('pointerover',  () => btn.setColor('#e8c96e'));
  btn.on('pointerout',   () => btn.setColor('#ffffff'));
  btn.on('pointerdown',  onClick);

  return btn;
}
