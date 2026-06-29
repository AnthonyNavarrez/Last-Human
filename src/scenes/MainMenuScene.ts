import Phaser from 'phaser';

export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'menu' });
  }

  create(): void {
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;

    this.add.image(cx, cy, 'opening-screen')
      .setDisplaySize(this.scale.width, this.scale.height);

    this.add.text(cx, cy - 280, 'LAST HUMAN', {
      fontSize: '64px',
      fontFamily: 'monospace',
      color: '#e8c96e',
      stroke: '#000000',
      strokeThickness: 6,
    }).setOrigin(0.5);

    // Derive a single scale so the play button renders at 160px wide;
    // apply the same scale to the settings button so both look identical in size.
    const playNatural = this.textures.get('play-button').getSourceImage() as HTMLImageElement;
    const btnScale = 160 / playNatural.width;

    const playBtn = this.add.image(cx, cy - 180, 'play-button')
      .setScale(btnScale)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    playBtn.on('pointerover',  () => playBtn.setScale(btnScale * 1.05));
    playBtn.on('pointerout',   () => playBtn.setScale(btnScale));
    playBtn.on('pointerdown',  () => {
      this.scene.start('game');
      this.scene.launch('ui');
      this.scene.stop('menu');
    });

    const settingsBtn = this.add.image(cx, cy - 110, 'settings-button')
      .setScale(btnScale)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    settingsBtn.on('pointerover', () => settingsBtn.setScale(btnScale * 1.05));
    settingsBtn.on('pointerout',  () => settingsBtn.setScale(btnScale));
  }
}
