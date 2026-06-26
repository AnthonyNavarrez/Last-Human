import Phaser from 'phaser';
import { R } from '../registry';
import { Hotbar } from '../ui/Hotbar';
import { CraftingMenu } from '../ui/CraftingMenu';
import { MinerMenu } from '../ui/MinerMenu';
import { DayNightTimer } from '../ui/DayNightTimer';
import { HealthBar } from '../ui/HealthBar';
import { ItemStack } from '../systems/GameState';

export class UIScene extends Phaser.Scene {
  private hotbar!: Hotbar;
  private craftingMenu!: CraftingMenu;
  private minerMenu!: MinerMenu;
  private dayNightTimer!: DayNightTimer;
  private playerHpBar!: HealthBar;
  private nightOverlay!: Phaser.GameObjects.Rectangle;

  constructor() {
    super({ key: 'ui' });
  }

  create(): void {
    // Night overlay sits behind all UI elements; alpha driven by game events
    this.nightOverlay = this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x000033, 0)
      .setOrigin(0, 0)
      .setDepth(1);

    this.hotbar = new Hotbar(this);
    this.craftingMenu = new CraftingMenu(this);
    this.minerMenu = new MinerMenu(this);
    this.dayNightTimer = new DayNightTimer(this);
    this.playerHpBar = new HealthBar(this, 12, this.scale.height - 36, 'HP');

    this.game.events.on('night-start', () => {
      this.tweens.add({ targets: this.nightOverlay, alpha: 0.45, duration: 2000, ease: 'Sine.easeIn' });
    });
    this.game.events.on('day-start', () => {
      this.tweens.add({ targets: this.nightOverlay, alpha: 0, duration: 2000, ease: 'Sine.easeOut' });
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
    const minerOpen       = this.game.registry.get(R.MINER_OPEN)        as boolean | undefined;
    const minerPower      = this.game.registry.get(R.MINER_POWER)       as number  | undefined;
    const minerHasPickaxe = this.game.registry.get(R.MINER_HAS_PICKAXE) as boolean | undefined;

    if (hotbarData) {
      this.hotbar.update(hotbarData, activeSlot ?? 0);
    }

    if (craftingOpen) {
      if (!this.craftingMenu.visible) this.craftingMenu.show();
      if (hotbarData && inventory) this.craftingMenu.refresh(hotbarData, inventory);
    } else if (this.craftingMenu.visible) {
      this.craftingMenu.hide();
    }

    if (minerOpen) {
      if (!this.minerMenu.visible) this.minerMenu.show();
      this.minerMenu.refresh(minerPower ?? 0, minerHasPickaxe ?? false);
    } else if (this.minerMenu.visible) {
      this.minerMenu.hide();
    }

    if (phase !== undefined && phaseTimer !== undefined) {
      this.dayNightTimer.sync(phase, dayNumber ?? 1, nightNum ?? 0, phaseTimer);
    }

    if (playerHp !== undefined && playerMax !== undefined) {
      this.playerHpBar.setHp(playerHp, playerMax);
    }

  }
}
