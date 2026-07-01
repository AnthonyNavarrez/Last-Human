import Phaser from 'phaser';

const PANEL_W  = 380;
const PANEL_H  = 340;
const ACCENT   = 0xf0a500;
const HP_BAR_W = PANEL_W - 48;

type SkillKey = 'speed' | 'strength' | 'defence';

export class HouseMenu extends Phaser.GameObjects.Container {
  // Tab backgrounds
  private houseTabBg!:  Phaser.GameObjects.Rectangle;
  private skillsTabBg!: Phaser.GameObjects.Rectangle;
  private skillsTabLbl!: Phaser.GameObjects.Text;

  // House-tab elements (toggled as a group)
  private lvlText!:    Phaser.GameObjects.Text;
  private hpText!:     Phaser.GameObjects.Text;
  private hpBarFill!:  Phaser.GameObjects.Rectangle;
  private upgBtnBg!:   Phaser.GameObjects.Rectangle;
  private upgBtnTxt!:  Phaser.GameObjects.Text;
  private upgMaxTxt!:  Phaser.GameObjects.Text;
  private houseItems:  Phaser.GameObjects.GameObject[] = [];

  // Skills-tab elements (toggled as a group)
  private sLvlTexts: Phaser.GameObjects.Text[]      = [];
  private sBtnBgs:   Phaser.GameObjects.Rectangle[] = [];
  private sBtnTxts:  Phaser.GameObjects.Text[]      = [];
  private skillItems: Phaser.GameObjects.GameObject[] = [];

  private activeTab: 'house' | 'skills' = 'house';
  private curLevel  = 1;

  constructor(scene: Phaser.Scene) {
    super(scene, scene.scale.width / 2, scene.scale.height / 2);

    const hw = PANEL_W / 2;
    const hh = PANEL_H / 2;

    // ── Background ────────────────────────────────────────────────────────────
    const bg = scene.add.rectangle(0, 0, PANEL_W, PANEL_H, 0x12121e, 0.95)
      .setStrokeStyle(2, ACCENT);
    this.add(bg);

    const titleTxt = scene.add.text(0, -hh + 22, 'Home', {
      fontSize: '16px', color: '#f0a500', fontStyle: 'bold',
    }).setOrigin(0.5, 0.5);
    this.add(titleTxt);

    this.add(scene.add.rectangle(0, -hh + 40, PANEL_W - 24, 1, ACCENT, 0.4));

    // ── Tabs ──────────────────────────────────────────────────────────────────
    const tabY  = -hh + 66;
    const TAB_W = 116;
    const TAB_H = 28;

    this.houseTabBg = scene.add.rectangle(-TAB_W / 2 - 4, tabY, TAB_W, TAB_H, 0x2a2a45)
      .setStrokeStyle(1, ACCENT);
    this.add(this.houseTabBg);
    this.add(scene.add.text(-TAB_W / 2 - 4, tabY, 'House', {
      fontSize: '12px', color: '#ffffff',
    }).setOrigin(0.5, 0.5));
    this.houseTabBg.setInteractive();
    this.houseTabBg.on('pointerdown', () => this.switchTab('house'));

    this.skillsTabBg = scene.add.rectangle(TAB_W / 2 + 4, tabY, TAB_W, TAB_H, 0x1a1a30)
      .setStrokeStyle(1, 0x333355);
    this.add(this.skillsTabBg);
    this.skillsTabLbl = scene.add.text(TAB_W / 2 + 4, tabY, 'Skills', {
      fontSize: '12px', color: '#888899',
    }).setOrigin(0.5, 0.5);
    this.add(this.skillsTabLbl);
    this.skillsTabBg.setInteractive();
    this.skillsTabBg.on('pointerdown', () => {
      if (this.curLevel >= 2) this.switchTab('skills');
    });

    this.add(scene.add.rectangle(0, -hh + 80, PANEL_W - 24, 1, 0x333355, 0.8));

    // ── House tab content ─────────────────────────────────────────────────────
    const topY = -hh + 112;

    this.lvlText = scene.add.text(-hw + 20, topY, 'Level: 1', {
      fontSize: '14px', color: '#e0e0e0',
    }).setOrigin(0, 0.5);
    this.add(this.lvlText);
    this.houseItems.push(this.lvlText);

    this.hpText = scene.add.text(hw - 20, topY, 'HP: 150 / 150', {
      fontSize: '13px', color: '#22cc44',
    }).setOrigin(1, 0.5);
    this.add(this.hpText);
    this.houseItems.push(this.hpText);

    const barY = topY + 26;
    const hpBarBg = scene.add.rectangle(0, barY, HP_BAR_W, 8, 0x333355).setOrigin(0.5, 0.5);
    this.add(hpBarBg);
    this.houseItems.push(hpBarBg);

    this.hpBarFill = scene.add.rectangle(-HP_BAR_W / 2, barY, HP_BAR_W, 8, 0x22cc44).setOrigin(0, 0.5);
    this.add(this.hpBarFill);
    this.houseItems.push(this.hpBarFill);

    const upgY = barY + 62;
    this.upgBtnBg = scene.add.rectangle(0, upgY, 230, 38, 0x7b4f00)
      .setStrokeStyle(1, ACCENT);
    this.add(this.upgBtnBg);
    this.houseItems.push(this.upgBtnBg);

    this.upgBtnTxt = scene.add.text(0, upgY, 'Upgrade to Lv.2  —  20 coins', {
      fontSize: '12px', color: '#ffffff',
    }).setOrigin(0.5, 0.5);
    this.add(this.upgBtnTxt);
    this.houseItems.push(this.upgBtnTxt);

    this.upgBtnBg.setInteractive();
    this.upgBtnBg.on('pointerdown', () => scene.game.events.emit('house-upgrade'));
    this.upgBtnBg.on('pointerover', () => this.upgBtnBg.setFillStyle(0xa06800));
    this.upgBtnBg.on('pointerout',  () => this.upgBtnBg.setFillStyle(0x7b4f00));

    this.upgMaxTxt = scene.add.text(0, upgY, 'MAX LEVEL', {
      fontSize: '13px', color: '#888899', fontStyle: 'italic',
    }).setOrigin(0.5, 0.5);
    this.add(this.upgMaxTxt);
    this.houseItems.push(this.upgMaxTxt);

    // ── Skills tab content ─────────────────────────────────────────────────────
    const SKILL_NAMES:    string[]   = ['Speed',     'Strength',    'Defence'];
    const SKILL_KEYS:     SkillKey[] = ['speed',     'strength',    'defence'];
    const SKILL_COLORS:   string[]   = ['#aaffaa',   '#ff8844',     '#88ccff'];
    const SKILL_EFFECTS:  string[]   = ['+15 speed', '+5 damage',   '-5 dmg taken'];
    const rowH = 56;

    for (let i = 0; i < 3; i++) {
      const sy = topY + i * rowH;

      const lbl = scene.add.text(-hw + 20, sy - 6, SKILL_NAMES[i], {
        fontSize: '13px', color: SKILL_COLORS[i], fontStyle: 'bold',
      }).setOrigin(0, 0.5);
      this.add(lbl);
      this.skillItems.push(lbl);

      const eff = scene.add.text(-hw + 20, sy + 12, SKILL_EFFECTS[i], {
        fontSize: '9px', color: '#666688',
      }).setOrigin(0, 0.5);
      this.add(eff);
      this.skillItems.push(eff);

      const lvlTxt = scene.add.text(hw - 148, sy - 2, 'Lv.1', {
        fontSize: '12px', color: '#cccccc',
      }).setOrigin(0, 0.5);
      this.add(lvlTxt);
      this.sLvlTexts.push(lvlTxt);
      this.skillItems.push(lvlTxt);

      const btnBg = scene.add.rectangle(hw - 56, sy - 2, 106, 28, 0x2a3a4a)
        .setStrokeStyle(1, 0x446688);
      this.add(btnBg);
      this.sBtnBgs.push(btnBg);
      this.skillItems.push(btnBg);

      const btnTxt = scene.add.text(hw - 56, sy - 2, 'Upgrade  30c', {
        fontSize: '10px', color: '#ffffff',
      }).setOrigin(0.5, 0.5);
      this.add(btnTxt);
      this.sBtnTxts.push(btnTxt);
      this.skillItems.push(btnTxt);

      const sk = SKILL_KEYS[i];
      btnBg.setInteractive();
      btnBg.on('pointerdown', () => scene.game.events.emit('skill-upgrade', sk));
      btnBg.on('pointerover', () => btnBg.setFillStyle(0x3a4a5a));
      btnBg.on('pointerout',  () => btnBg.setFillStyle(0x2a3a4a));
    }

    // ── Footer ────────────────────────────────────────────────────────────────
    this.add(scene.add.rectangle(0, hh - 44, PANEL_W - 24, 1, 0x333355, 1));

    this.add(scene.add.text(-hw + 16, hh - 22, '[E] to close', {
      fontSize: '10px', color: '#666688',
    }).setOrigin(0, 0.5));

    const closeBg = scene.add.rectangle(hw - 44, hh - 22, 68, 24, 0x2a2a45)
      .setStrokeStyle(1, 0x555577);
    this.add(closeBg);
    this.add(scene.add.text(hw - 44, hh - 22, 'Close', {
      fontSize: '11px', color: '#aaaacc',
    }).setOrigin(0.5, 0.5));
    closeBg.setInteractive();
    closeBg.on('pointerdown', () => scene.game.events.emit('close-house'));
    closeBg.on('pointerover', () => closeBg.setFillStyle(0x3a3a55));
    closeBg.on('pointerout',  () => closeBg.setFillStyle(0x2a2a45));

    // Initially hide skill items
    for (const obj of this.skillItems) (obj as Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Visible).setVisible(false);

    scene.add.existing(this);
    this.setDepth(200);
    this.setVisible(false);

    scene.scale.on('resize', () => {
      this.setPosition(scene.scale.width / 2, scene.scale.height / 2);
    });
  }

  private switchTab(tab: 'house' | 'skills'): void {
    this.activeTab = tab;
    const isHouse = tab === 'house';

    for (const obj of this.houseItems)  (obj as Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Visible).setVisible(isHouse);
    for (const obj of this.skillItems)  (obj as Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Visible).setVisible(!isHouse);

    // Override house-tab upgrade / max text based on current level
    if (isHouse) {
      const atMax = this.curLevel >= 2;
      this.upgBtnBg.setVisible(!atMax);
      this.upgBtnTxt.setVisible(!atMax);
      this.upgMaxTxt.setVisible(atMax);
    }

    this.houseTabBg.setFillStyle(isHouse ? 0x2a2a45 : 0x1a1a30);
    this.houseTabBg.setStrokeStyle(1, isHouse ? ACCENT : 0x333355);
    this.skillsTabBg.setFillStyle(!isHouse ? 0x2a2a45 : 0x1a1a30);
    this.skillsTabBg.setStrokeStyle(1, !isHouse ? ACCENT : 0x333355);
  }

  refresh(
    houseLevel: number,
    houseHp: number,
    houseMaxHp: number,
    coins: number,
    skillSpeed: number,
    skillStrength: number,
    skillDefence: number,
  ): void {
    this.curLevel = houseLevel;

    // Level text
    this.lvlText.setText(`Level: ${houseLevel}`);

    // HP bar
    const hpRatio = Math.max(0, houseHp / houseMaxHp);
    const hpColor = hpRatio > 0.5 ? '#22cc44' : hpRatio > 0.25 ? '#f0a500' : '#e63946';
    const hpFill  = hpRatio > 0.5 ? 0x22cc44  : hpRatio > 0.25 ? 0xf0a500  : 0xe63946;
    this.hpText.setText(`HP: ${Math.ceil(houseHp)} / ${houseMaxHp}`).setColor(hpColor);
    this.hpBarFill.setSize(HP_BAR_W * hpRatio, 8).setFillStyle(hpFill);

    // Upgrade button
    if (houseLevel >= 2) {
      this.upgBtnBg.setVisible(false).disableInteractive();
      this.upgBtnTxt.setVisible(false);
      this.upgMaxTxt.setVisible(this.activeTab === 'house');
    } else {
      this.upgMaxTxt.setVisible(false);
      const show = this.activeTab === 'house';
      this.upgBtnBg.setVisible(show);
      this.upgBtnTxt.setVisible(show);
      const canAfford = coins >= 20;
      this.upgBtnBg.setAlpha(canAfford ? 1 : 0.5);
      if (canAfford) this.upgBtnBg.setInteractive(); else this.upgBtnBg.disableInteractive();
    }

    // Skills tab: unlock / dim
    const skillsUnlocked = houseLevel >= 2;
    this.skillsTabBg.setAlpha(skillsUnlocked ? 1 : 0.4);
    this.skillsTabLbl.setColor(skillsUnlocked ? '#ffffff' : '#888899');

    // Skills content
    const levels = [skillSpeed, skillStrength, skillDefence];
    for (let i = 0; i < 3; i++) {
      const isMax = levels[i] >= 2;
      this.sLvlTexts[i].setText(isMax ? 'Lv.2 (MAX)' : 'Lv.1');
      this.sBtnTxts[i].setText(isMax ? 'MAX' : 'Upgrade  30c');
      if (isMax) {
        this.sBtnBgs[i].disableInteractive().setAlpha(0.3);
      } else {
        const canBuy = coins >= 30;
        this.sBtnBgs[i].setAlpha(canBuy ? 1 : 0.5);
        if (canBuy) this.sBtnBgs[i].setInteractive(); else this.sBtnBgs[i].disableInteractive();
      }
    }
  }

  show(): void {
    this.setVisible(true);
    this.switchTab(this.activeTab);
  }

  hide(): void { this.setVisible(false); }
}
