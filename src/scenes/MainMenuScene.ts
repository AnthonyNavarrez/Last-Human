import Phaser from 'phaser';
import { sceneButton } from '../ui/sceneButton';

export class MainMenuScene extends Phaser.Scene {
  constructor() { super({ key: 'menu' }); }

  create(): void {
    const { width, height } = this.scale;
    const cx = width / 2;
    const cy = height / 2;

    this.add.image(cx, cy, 'opening-screen').setDisplaySize(width, height);

    this.add.text(cx, cy - 280, 'LAST HUMAN', {
      fontSize: '64px', fontFamily: 'monospace',
      color: '#e8c96e', stroke: '#000000', strokeThickness: 6,
    }).setOrigin(0.5);

    const playNatural = this.textures.get('play-button').getSourceImage() as HTMLImageElement;
    const btnScale = 160 / playNatural.width;

    // ── Main buttons ──────────────────────────────────────────────────────
    const playBtn = this.add.image(cx, cy - 180, 'play-button')
      .setScale(btnScale).setOrigin(0.5).setInteractive({ useHandCursor: true });
    playBtn.on('pointerover', () => playBtn.setScale(btnScale * 1.05));
    playBtn.on('pointerout',  () => playBtn.setScale(btnScale));
    playBtn.on('pointerdown', () => swap(false));

    const settingsBtn = this.add.image(cx, cy - 110, 'settings-button')
      .setScale(btnScale).setOrigin(0.5).setInteractive({ useHandCursor: true });
    settingsBtn.on('pointerover', () => settingsBtn.setScale(btnScale * 1.05));
    settingsBtn.on('pointerout',  () => settingsBtn.setScale(btnScale));

    // ── Mode-choice buttons (hidden until Play is clicked) ────────────────
    const soloBtn  = sceneButton(this, cx, cy - 170, 'SOLO', () => {
      this.scene.start('game');
      this.scene.launch('ui');
      this.scene.stop('menu');
    });
    const multiBtn = sceneButton(this, cx, cy - 100, 'MULTIPLAYER', () => {
      this.scene.start('lobby');
    });
    const backBtn  = sceneButton(this, cx, cy - 30,  'BACK', () => swap(true));

    const mainObjs: Phaser.GameObjects.GameObject[] = [playBtn, settingsBtn];
    const modeObjs: Phaser.GameObjects.GameObject[] = [soloBtn, multiBtn, backBtn];

    const setVis = (objs: Phaser.GameObjects.GameObject[], v: boolean) =>
      objs.forEach(o => (o as Phaser.GameObjects.Image).setVisible(v));

    const swap = (showMain: boolean) => {
      setVis(mainObjs, showMain);
      setVis(modeObjs, !showMain);
    };

    swap(true); // start with main buttons visible
  }
}
