import Phaser from 'phaser';

const PANEL_W = 290;
const PANEL_H = 230;

export class MinerMenu extends Phaser.GameObjects.Container {
  private powerText!: Phaser.GameObjects.Text;
  private pickaxeBtnBg!: Phaser.GameObjects.Rectangle;
  private pickaxeBtnText!: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    super(scene, scene.scale.width / 2, scene.scale.height / 2);

    const bg = scene.add.rectangle(0, 0, PANEL_W, PANEL_H, 0x12121e, 0.94);
    bg.setStrokeStyle(2, 0xf0a500);
    this.add(bg);

    const title = scene.add.text(0, -PANEL_H / 2 + 22, 'Auto Miner', {
      fontSize: '15px', color: '#f0a500', fontStyle: 'bold',
    }).setOrigin(0.5, 0.5);
    this.add(title);

    this.add(scene.add.rectangle(0, -PANEL_H / 2 + 40, PANEL_W - 24, 1, 0xf0a500, 0.4));

    // Fuel status
    this.powerText = scene.add.text(0, -40, 'FUEL: 0 hits remaining', {
      fontSize: '13px', color: '#e0e0e0',
    }).setOrigin(0.5, 0.5);
    this.add(this.powerText);

    const hintFuel = scene.add.text(0, -18, '1 wood = 3 hits  •  pickaxe = 2× speed', {
      fontSize: '9px', color: '#666688',
    }).setOrigin(0.5, 0.5);
    this.add(hintFuel);

    // Add fuel button
    const fuelBtnBg = scene.add.rectangle(-60, 20, 120, 30, 0x7b4f00)
      .setStrokeStyle(1, 0xf0a500)
      .setInteractive({ useHandCursor: true });
    const fuelBtnText = scene.add.text(-60, 20, '+ Add Wood', {
      fontSize: '12px', color: '#ffffff',
    }).setOrigin(0.5, 0.5);
    this.add(fuelBtnBg);
    this.add(fuelBtnText);
    fuelBtnBg.on('pointerdown', () => scene.game.events.emit('add-miner-fuel'));
    fuelBtnBg.on('pointerover', () => fuelBtnBg.setFillStyle(0xa06800));
    fuelBtnBg.on('pointerout', () => fuelBtnBg.setFillStyle(0x7b4f00));

    // Pickaxe toggle button
    this.pickaxeBtnBg = scene.add.rectangle(80, 20, 110, 30, 0x2a4a2a)
      .setStrokeStyle(1, 0x52b788)
      .setInteractive({ useHandCursor: true });
    this.pickaxeBtnText = scene.add.text(80, 20, 'Ins. Pickaxe', {
      fontSize: '11px', color: '#ffffff',
    }).setOrigin(0.5, 0.5);
    this.add(this.pickaxeBtnBg);
    this.add(this.pickaxeBtnText);
    this.pickaxeBtnBg.on('pointerdown', () => scene.game.events.emit('toggle-miner-pickaxe'));
    this.pickaxeBtnBg.on('pointerover', () => {
      const hasPickaxe = this.pickaxeBtnText.text.startsWith('Rem');
      this.pickaxeBtnBg.setFillStyle(hasPickaxe ? 0x5a2a2a : 0x3a6a3a);
    });
    this.pickaxeBtnBg.on('pointerout', () => {
      const hasPickaxe = this.pickaxeBtnText.text.startsWith('Rem');
      this.pickaxeBtnBg.setFillStyle(hasPickaxe ? 0x4a2a2a : 0x2a4a2a);
    });

    this.add(scene.add.rectangle(0, PANEL_H / 2 - 44, PANEL_W - 24, 1, 0x333355, 1));

    const hint = scene.add.text(-PANEL_W / 2 + 16, PANEL_H / 2 - 22, '[E] to close', {
      fontSize: '10px', color: '#666688',
    }).setOrigin(0, 0.5);
    this.add(hint);

    const closeBtnBg = scene.add.rectangle(PANEL_W / 2 - 44, PANEL_H / 2 - 22, 68, 24, 0x2a2a45)
      .setStrokeStyle(1, 0x555577)
      .setInteractive({ useHandCursor: true });
    const closeBtnText = scene.add.text(PANEL_W / 2 - 44, PANEL_H / 2 - 22, 'Close', {
      fontSize: '11px', color: '#aaaacc',
    }).setOrigin(0.5, 0.5);
    this.add(closeBtnBg);
    this.add(closeBtnText);
    closeBtnBg.on('pointerdown', () => scene.game.events.emit('close-miner'));
    closeBtnBg.on('pointerover', () => closeBtnBg.setFillStyle(0x3a3a55));
    closeBtnBg.on('pointerout', () => closeBtnBg.setFillStyle(0x2a2a45));

    scene.add.existing(this);
    this.setDepth(200);
    this.setVisible(false);

    scene.scale.on('resize', () => {
      this.setPosition(scene.scale.width / 2, scene.scale.height / 2);
    });
  }

  refresh(power: number, hasPickaxe: boolean): void {
    if (power > 0) {
      this.powerText.setText(`FUEL: ${power} hits remaining`).setColor('#e0e0e0');
    } else {
      this.powerText.setText('OUT OF FUEL').setColor('#e63946');
    }

    this.pickaxeBtnText.setText(hasPickaxe ? 'Rem. Pickaxe' : 'Ins. Pickaxe');
    this.pickaxeBtnBg.setFillStyle(hasPickaxe ? 0x4a2a2a : 0x2a4a2a);
    this.pickaxeBtnBg.setStrokeStyle(1, hasPickaxe ? 0xe63946 : 0x52b788);
  }

  show(): void { this.setVisible(true); }
  hide(): void { this.setVisible(false); }
}
