import Phaser from 'phaser';
import { R } from '../registry';
import { Hotbar } from '../ui/Hotbar';
import { CraftingMenu } from '../ui/CraftingMenu';
import { MinerMenu } from '../ui/MinerMenu';
import { SawMenu } from '../ui/SawMenu';
import { HouseMenu } from '../ui/HouseMenu';
import { DayNightTimer } from '../ui/DayNightTimer';
import { HealthBar } from '../ui/HealthBar';
import { Tooltip } from '../ui/Tooltip';
import { InventoryPanel } from '../ui/InventoryPanel';
import { ItemStack } from '../systems/GameState';
import { ITEMS } from '../data/items';

export class UIScene extends Phaser.Scene {
  private hotbar!: Hotbar;
  private craftingMenu!: CraftingMenu;
  private minerMenu!: MinerMenu;
  private sawMenu!: SawMenu;
  private houseMenu!: HouseMenu;
  private dayNightTimer!: DayNightTimer;
  private playerHpBar!: HealthBar;
  private nightOverlay!: Phaser.GameObjects.Rectangle;
  private coinCountText!: Phaser.GameObjects.Text;
  private coinIcon!: Phaser.GameObjects.Image;
  private speedText!: Phaser.GameObjects.Text;
  private speedIcon!: Phaser.GameObjects.Image;
  private armorText!: Phaser.GameObjects.Text;
  private armorIcon!: Phaser.GameObjects.Image;
  private strengthText!: Phaser.GameObjects.Text;
  private strengthIcon!: Phaser.GameObjects.Image;
  private skipNightBtn!: Phaser.GameObjects.Container;
  private tooltip!: Tooltip;
  private inventoryPanel!: InventoryPanel;
  private lastPhase = '';

  // Drag state
  private dragFrom: { type: 'inventory' | 'hotbar'; idx: number } | null = null;
  private dragIcon: Phaser.GameObjects.Image | null = null;

  constructor() {
    super({ key: 'ui' });
  }

  create(): void {
    // Night overlay: depth 90 puts it above game world but below UI (hotbar = 100, hp bar = 150)
    this.nightOverlay = this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x000033, 1)
      .setOrigin(0, 0)
      .setDepth(90)
      .setAlpha(0);

    this.hotbar = new Hotbar(this);
    this.craftingMenu = new CraftingMenu(this);
    this.minerMenu = new MinerMenu(this);
    this.sawMenu = new SawMenu(this);
    this.houseMenu = new HouseMenu(this);
    this.dayNightTimer = new DayNightTimer(this);
    this.playerHpBar = new HealthBar(this, 12, this.scale.height - 75, 'HP');
    this.skipNightBtn   = this.createSkipNightButton();
    this.tooltip        = new Tooltip(this);
    this.inventoryPanel = new InventoryPanel(this);

    this.input.on('pointerdown', this.onDragDown, this);
    this.input.on('pointermove', this.onDragMove, this);
    this.input.on('pointerup',   this.onDragUp,   this);

    const statDepth    = 150;
    const coinIconSize = 44;
    const statIconSize = 32;
    const pad          = 12;
    const rowGap       = 8;
    const { width, height } = this.scale;

    const coinY     = pad;
    const strengthY = coinY     + coinIconSize + rowGap;
    const armorY    = strengthY + statIconSize + rowGap;
    const speedY    = armorY    + statIconSize + rowGap;

    const buildStatRow = (
      color: string, iconKey: string, iconSize: number, fontSize: string, bottomY: number,
    ): [Phaser.GameObjects.Text, Phaser.GameObjects.Image] => {
      const txt = this.add.text(width - iconSize - pad - 6, height - bottomY, '0', {
        fontSize, color, stroke: '#000000', strokeThickness: 3, fontStyle: 'bold',
      }).setOrigin(1, 1).setDepth(statDepth).setScrollFactor(0);
      const ico = this.add.image(width - pad, height - bottomY, iconKey)
        .setDisplaySize(iconSize, iconSize)
        .setOrigin(1, 1)
        .setDepth(statDepth)
        .setScrollFactor(0);
      return [txt, ico];
    };

    [this.coinCountText, this.coinIcon]     = buildStatRow('#ffd700', 'item-coin',     coinIconSize, '28px', coinY);
    [this.strengthText,  this.strengthIcon] = buildStatRow('#ff8844', 'stat-strength', statIconSize, '20px', strengthY);
    [this.armorText,     this.armorIcon]    = buildStatRow('#88ccff', 'stat-armor',    statIconSize, '20px', armorY);
    [this.speedText,     this.speedIcon]    = buildStatRow('#aaffaa', 'stat-speed',    statIconSize, '20px', speedY);

    this.scale.on('resize', () => {
      const { width: w, height: h } = this.scale;
      const reposition = (
        txt: Phaser.GameObjects.Text, ico: Phaser.GameObjects.Image,
        iconSize: number, bottomY: number,
      ) => {
        txt.setPosition(w - iconSize - pad - 6, h - bottomY);
        ico.setPosition(w - pad, h - bottomY);
      };
      reposition(this.coinCountText, this.coinIcon,     coinIconSize, coinY);
      reposition(this.strengthText,  this.strengthIcon, statIconSize, strengthY);
      reposition(this.armorText,     this.armorIcon,    statIconSize, armorY);
      reposition(this.speedText,     this.speedIcon,    statIconSize, speedY);
    });

    this.game.events.on('show-tooltip', ({ itemId }: { itemId: string }) => {
      this.tooltip.show(itemId);
    });
    this.game.events.on('hide-tooltip', () => {
      this.tooltip.hide();
    });

    this.scale.on('resize', () => {
      this.nightOverlay.setSize(this.scale.width, this.scale.height);
    });
  }

  update(): void {
    const hotbarData = this.game.registry.get(R.HOTBAR) as (ItemStack | null)[] | undefined;
    const activeSlot = this.game.registry.get(R.ACTIVE_SLOT) as number | undefined;
    const craftingOpen = this.game.registry.get(R.CRAFTING_OPEN) as boolean | undefined;
    const inventory = this.game.registry.get(R.INVENTORY) as (ItemStack | null)[] | undefined;

    const phase      = this.game.registry.get(R.PHASE)       as string | undefined;
    const phaseTimer = this.game.registry.get(R.PHASE_TIMER)  as number | undefined;
    const dayNumber  = this.game.registry.get(R.DAY_NUMBER)   as number | undefined;
    const nightNum   = this.game.registry.get(R.NIGHT_NUMBER) as number | undefined;
    const playerHp   = this.game.registry.get(R.PLAYER_HP)    as number | undefined;
    const playerMax  = this.game.registry.get(R.PLAYER_MAX_HP) as number | undefined;
    const coins    = this.game.registry.get(R.COINS)         as number | undefined;
    const statSpd  = this.game.registry.get(R.STAT_SPEED)    as number | undefined;
    const statArm  = this.game.registry.get(R.STAT_ARMOR)    as number | undefined;
    const statStr  = this.game.registry.get(R.STAT_STRENGTH) as number | undefined;
    const inventoryOpen   = this.game.registry.get(R.INVENTORY_OPEN)    as boolean | undefined;
    const minerOpen       = this.game.registry.get(R.MINER_OPEN)        as boolean | undefined;
    const minerPower      = this.game.registry.get(R.MINER_POWER)       as number  | undefined;
    const minerHasPickaxe = this.game.registry.get(R.MINER_HAS_PICKAXE) as boolean | undefined;
    const minerOutput     = this.game.registry.get(R.MINER_OUTPUT)      as { itemId: string; quantity: number } | null | undefined;
    const sawOpen         = this.game.registry.get(R.SAW_OPEN)          as boolean | undefined;
    const sawPower        = this.game.registry.get(R.SAW_POWER)         as number  | undefined;
    const sawHasAxe       = this.game.registry.get(R.SAW_HAS_AXE)       as boolean | undefined;
    const sawOutput       = this.game.registry.get(R.SAW_OUTPUT)        as { itemId: string; quantity: number } | null | undefined;
    const houseOpen       = this.game.registry.get(R.HOUSE_OPEN)        as boolean | undefined;
    const houseLevel      = this.game.registry.get(R.HOUSE_LEVEL)       as number  | undefined;
    const houseHp         = this.game.registry.get(R.HOUSE_HP)          as number  | undefined;
    const houseMaxHp      = this.game.registry.get(R.HOUSE_MAX_HP)      as number  | undefined;
    const skillSpeed      = this.game.registry.get(R.SKILL_SPEED)       as number  | undefined;
    const skillStrength   = this.game.registry.get(R.SKILL_STRENGTH)    as number  | undefined;
    const skillDefence    = this.game.registry.get(R.SKILL_DEFENCE)     as number  | undefined;

    if (hotbarData) {
      this.hotbar.update(hotbarData, activeSlot ?? 0);
    }

    this.coinCountText.setText(String(coins   ?? 0));
    this.speedText.setText(String(statSpd     ?? 0));
    this.armorText.setText(String(statArm     ?? 0));
    this.strengthText.setText(String(statStr  ?? 0));

    if (inventoryOpen) {
      if (!this.inventoryPanel.visible) this.inventoryPanel.setVisible(true);
      if (inventory) this.inventoryPanel.refresh(inventory);
    } else if (this.inventoryPanel.visible) {
      this.inventoryPanel.setVisible(false);
      this.endDrag();
    }

    if (craftingOpen) {
      if (!this.craftingMenu.visible) this.craftingMenu.show();
      if (hotbarData && inventory) this.craftingMenu.refresh(hotbarData, inventory);
    } else if (this.craftingMenu.visible) {
      this.craftingMenu.hide();
    }

    if (minerOpen) {
      if (!this.minerMenu.visible) this.minerMenu.show();
      this.minerMenu.refresh(minerPower ?? 0, minerHasPickaxe ?? false, minerOutput ?? null);
    } else if (this.minerMenu.visible) {
      this.minerMenu.hide();
    }

    if (sawOpen) {
      if (!this.sawMenu.visible) this.sawMenu.show();
      this.sawMenu.refresh(sawPower ?? 0, sawHasAxe ?? false, sawOutput ?? null);
    } else if (this.sawMenu.visible) {
      this.sawMenu.hide();
    }

    if (houseOpen) {
      if (!this.houseMenu.visible) this.houseMenu.show();
      this.houseMenu.refresh(
        houseLevel ?? 1,
        houseHp ?? 0,
        houseMaxHp ?? 150,
        coins ?? 0,
        skillSpeed ?? 1,
        skillStrength ?? 1,
        skillDefence ?? 1,
      );
    } else if (this.houseMenu.visible) {
      this.houseMenu.hide();
    }

    if (phase !== undefined && phaseTimer !== undefined) {
      this.dayNightTimer.sync(phase, dayNumber ?? 1, nightNum ?? 0, phaseTimer);
      this.skipNightBtn.setVisible(phase === 'day');
    }

    if (phase && phase !== this.lastPhase) {
      this.lastPhase = phase;
      this.tweens.killTweensOf(this.nightOverlay);
      this.tweens.add({
        targets:  this.nightOverlay,
        alpha:    phase === 'night' ? 0.50 : 0,
        duration: 2000,
        ease:     phase === 'night' ? 'Sine.easeIn' : 'Sine.easeOut',
      });
    }

    if (playerHp !== undefined && playerMax !== undefined) {
      this.playerHpBar.setHp(playerHp, playerMax);
    }

    if (this.tooltip.visible) {
      this.tooltip.moveTo(this.input.activePointer.x, this.input.activePointer.y);
    }
  }

  private onDragDown(pointer: Phaser.Input.Pointer): void {
    if (!pointer.leftButtonDown()) return;

    const inv = this.game.registry.get(R.INVENTORY) as (ItemStack | null)[] | undefined;
    const hb  = this.game.registry.get(R.HOTBAR)    as (ItemStack | null)[] | undefined;

    // Inventory panel takes priority (drawn on top)
    if (this.inventoryPanel.visible && inv) {
      const idx = this.inventoryPanel.slotAt(pointer.x, pointer.y);
      if (idx >= 0 && inv[idx]) {
        this.startDrag({ type: 'inventory', idx }, inv[idx]!, pointer);
        return;
      }
    }

    // Hotbar
    if (hb) {
      const idx = this.hotbar.slotAt(pointer.x, pointer.y);
      if (idx >= 0 && hb[idx]) {
        this.startDrag({ type: 'hotbar', idx }, hb[idx]!, pointer);
      }
    }
  }

  private onDragMove(pointer: Phaser.Input.Pointer): void {
    this.dragIcon?.setPosition(pointer.x, pointer.y);
  }

  private onDragUp(pointer: Phaser.Input.Pointer): void {
    if (!this.dragFrom) return;

    let toType: 'inventory' | 'hotbar' | null = null;
    let toIdx = -1;

    if (this.inventoryPanel.visible) {
      const idx = this.inventoryPanel.slotAt(pointer.x, pointer.y);
      if (idx >= 0) { toType = 'inventory'; toIdx = idx; }
    }
    if (toType === null) {
      const idx = this.hotbar.slotAt(pointer.x, pointer.y);
      if (idx >= 0) { toType = 'hotbar'; toIdx = idx; }
    }

    if (toType !== null && !(toType === this.dragFrom.type && toIdx === this.dragFrom.idx)) {
      this.game.events.emit('item-move', {
        from: { type: this.dragFrom.type, idx: this.dragFrom.idx },
        to:   { type: toType, idx: toIdx },
      });
    }

    this.endDrag();
  }

  private startDrag(
    from: { type: 'inventory' | 'hotbar'; idx: number },
    item: ItemStack,
    pointer: Phaser.Input.Pointer,
  ): void {
    this.dragFrom = from;
    if (from.type === 'inventory') this.inventoryPanel.setDragSource(from.idx);
    else                           this.hotbar.setDragSource(from.idx);

    const key = ITEMS[item.itemId]?.spriteKey ?? '';
    if (key) {
      const src   = this.textures.get(key).source[0];
      const ratio = src.width / src.height;
      const sz    = 34;
      const iw    = ratio >= 1 ? sz : Math.round(sz * ratio);
      const ih    = ratio <= 1 ? sz : Math.round(sz / ratio);
      this.dragIcon = this.add.image(pointer.x, pointer.y, key)
        .setDisplaySize(iw, ih)
        .setAlpha(0.9)
        .setDepth(200)
        .setScrollFactor(0);
    }
  }

  private endDrag(): void {
    this.dragFrom = null;
    this.dragIcon?.destroy();
    this.dragIcon = null;
    this.inventoryPanel.setDragSource(null);
    this.hotbar.setDragSource(null);
  }

  private createSkipNightButton(): Phaser.GameObjects.Container {
    const W = 108, H = 28;
    const x = this.scale.width - 8 - W / 2;
    const y = 18;

    const container = this.add.container(x, y).setDepth(150);

    const bg = this.add.rectangle(0, 0, W, H, 0x000000, 0.65)
      .setStrokeStyle(1, 0x444466)
      .setInteractive({ useHandCursor: true });

    const label = this.add.text(0, 0, 'SKIP TO NIGHT', {
      fontSize: '10px', color: '#a0c4ff', fontStyle: 'bold',
    }).setOrigin(0.5, 0.5);

    container.add([bg, label]);

    bg.on('pointerover',  () => bg.setFillStyle(0x111133, 0.85));
    bg.on('pointerout',   () => bg.setFillStyle(0x000000, 0.65));
    bg.on('pointerdown',  () => this.game.events.emit('skip-to-night'));

    this.scale.on('resize', () => {
      container.setPosition(this.scale.width - 8 - W / 2, 18);
    });

    return container;
  }
}
