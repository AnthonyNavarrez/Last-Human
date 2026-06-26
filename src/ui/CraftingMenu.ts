import Phaser from 'phaser';
import { RECIPES, RecipeDefinition } from '../data/recipes';
import { ItemStack } from '../systems/GameState';
import { canCraft } from '../systems/CraftingSystem';
import { ITEMS } from '../data/items';

const BENCH_RECIPES = RECIPES.filter(r => r.stationId === 'crafting_bench');

const PANEL_W = 360;
const PAD = 18;
const TITLE_H = 44;
const FOOTER_H = 40;
const INGR_COLS = 2;       // ingredients per line before wrapping
const ROW_H_SHORT = 80;    // row height for ≤2 ingredients
const ROW_H_TALL  = 100;   // row height for 3+ ingredients (extra line)

function rowHeightFor(recipe: RecipeDefinition): number {
  return recipe.inputs.length > INGR_COLS ? ROW_H_TALL : ROW_H_SHORT;
}

const totalRowH = BENCH_RECIPES.reduce((s, r) => s + rowHeightFor(r), 0);
const PANEL_H = PAD + TITLE_H + totalRowH + FOOTER_H + PAD;

const TITLE_Y       = -PANEL_H / 2 + PAD + TITLE_H / 2;
const DIVIDER_Y     = -PANEL_H / 2 + PAD + TITLE_H;
const ROWS_TOP_Y    = DIVIDER_Y + 1;
const FOOTER_CENTER_Y = PANEL_H / 2 - PAD - FOOTER_H / 2;

interface RecipeUI {
  craftBtn: Phaser.GameObjects.Rectangle;
  ingredientTexts: Phaser.GameObjects.Text[];
}

export class CraftingMenu extends Phaser.GameObjects.Container {
  private recipeUIs: RecipeUI[] = [];

  constructor(scene: Phaser.Scene) {
    super(scene, scene.scale.width / 2, scene.scale.height / 2);

    const bg = scene.add.rectangle(0, 0, PANEL_W, PANEL_H, 0x12121e, 0.94);
    bg.setStrokeStyle(2, 0x4a9eff);
    this.add(bg);

    const title = scene.add.text(0, TITLE_Y, 'Crafting Bench', {
      fontSize: '15px', color: '#f1c40f', fontStyle: 'bold',
    }).setOrigin(0.5, 0.5);
    this.add(title);

    this.add(scene.add.rectangle(0, DIVIDER_Y, PANEL_W - 24, 1, 0x4a9eff, 0.6));

    // Build recipe rows, tracking cumulative y
    let cumulY = ROWS_TOP_Y;
    BENCH_RECIPES.forEach((recipe, i) => {
      const rh = rowHeightFor(recipe);
      this.buildRow(scene, recipe, cumulY + rh / 2, i, rh);
      cumulY += rh;
    });

    // Footer
    this.add(scene.add.rectangle(0, PANEL_H / 2 - PAD - FOOTER_H, PANEL_W - 24, 1, 0x333355, 1));

    const hint = scene.add.text(-PANEL_W / 2 + 16, FOOTER_CENTER_Y, '[E] to close', {
      fontSize: '10px', color: '#666688',
    }).setOrigin(0, 0.5);
    this.add(hint);

    const closeBtnBg = scene.add.rectangle(PANEL_W / 2 - 44, FOOTER_CENTER_Y, 68, 24, 0x2a2a45)
      .setStrokeStyle(1, 0x555577)
      .setInteractive({ useHandCursor: true });
    const closeBtnText = scene.add.text(PANEL_W / 2 - 44, FOOTER_CENTER_Y, 'Close', {
      fontSize: '11px', color: '#aaaacc',
    }).setOrigin(0.5, 0.5);
    this.add(closeBtnBg);
    this.add(closeBtnText);
    closeBtnBg.on('pointerdown', () => scene.game.events.emit('close-crafting'));
    closeBtnBg.on('pointerover', () => closeBtnBg.setFillStyle(0x3a3a55));
    closeBtnBg.on('pointerout', () => closeBtnBg.setFillStyle(0x2a2a45));

    scene.add.existing(this);
    this.setDepth(200);
    this.setVisible(false);

    scene.scale.on('resize', () => {
      this.setPosition(scene.scale.width / 2, scene.scale.height / 2);
    });
  }

  private buildRow(
    scene: Phaser.Scene,
    recipe: RecipeDefinition,
    rowCenterY: number,
    idx: number,
    rowH: number,
  ): void {
    const multiLine = recipe.inputs.length > INGR_COLS;

    // Row separator
    if (idx > 0) {
      this.add(scene.add.rectangle(0, rowCenterY - rowH / 2, PANEL_W - 24, 1, 0x222244, 1));
    }

    // Output icon
    const outItem = ITEMS[recipe.outputs[0].itemId];
    if (outItem) {
      this.add(scene.add.image(-PANEL_W / 2 + 24, rowCenterY, outItem.spriteKey)
        .setDisplaySize(22, 22).setOrigin(0.5, 0.5));
    }

    // Recipe name — shift up more when ingredients wrap to 2 lines
    const nameY = rowCenterY - (multiLine ? 32 : 20);
    this.add(scene.add.text(-PANEL_W / 2 + 42, nameY, recipe.label, {
      fontSize: '13px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0, 0.5));

    // Ingredient labels — wrap at INGR_COLS per line
    const ingredientTexts: Phaser.GameObjects.Text[] = [];
    const ingrStartX = -PANEL_W / 2 + 42;
    const ingrColW   = 120;
    const ingrRow0Y  = multiLine ? rowCenterY - 10 : rowCenterY + 10;
    const ingrRow1Y  = ingrRow0Y + 16;

    recipe.inputs.forEach((inp, j) => {
      const col = j % INGR_COLS;
      const row = Math.floor(j / INGR_COLS);
      const x = ingrStartX + col * ingrColW;
      const y = row === 0 ? ingrRow0Y : ingrRow1Y;
      const txt = scene.add.text(x, y,
        `0/${inp.quantity} ${ITEMS[inp.itemId]?.label ?? inp.itemId}`, {
          fontSize: '11px', color: '#e63946',
        }).setOrigin(0, 0.5);
      this.add(txt);
      ingredientTexts.push(txt);
    });

    // Craft button (vertically centred in row)
    const btnX = PANEL_W / 2 - 42;
    const btnBg = scene.add.rectangle(btnX, rowCenterY, 64, 30, 0x2d6a4f)
      .setStrokeStyle(1, 0x52b788)
      .setInteractive({ useHandCursor: true });
    const btnTxt = scene.add.text(btnX, rowCenterY, 'Craft', {
      fontSize: '12px', color: '#ffffff',
    }).setOrigin(0.5, 0.5);
    this.add(btnBg);
    this.add(btnTxt);

    btnBg.on('pointerdown', () => scene.game.events.emit('do-craft', recipe.id));
    btnBg.on('pointerover', () => { if (btnBg.input?.enabled) btnBg.setFillStyle(0x40916c); });
    btnBg.on('pointerout',  () => { if (btnBg.input?.enabled) btnBg.setFillStyle(0x2d6a4f); });

    this.recipeUIs.push({ craftBtn: btnBg, ingredientTexts });
  }

  /** Called each frame while open to sync ingredient counts and button states. */
  refresh(hotbar: (ItemStack | null)[], inventory: (ItemStack | null)[]): void {
    BENCH_RECIPES.forEach((recipe, i) => {
      const ui = this.recipeUIs[i];
      const craftable = canCraft(hotbar, inventory, recipe);

      ui.craftBtn.setFillStyle(craftable ? 0x2d6a4f : 0x3a3a3a);
      ui.craftBtn.setStrokeStyle(1, craftable ? 0x52b788 : 0x555555);
      if (craftable) {
        ui.craftBtn.setInteractive({ useHandCursor: true });
      } else {
        ui.craftBtn.disableInteractive();
      }

      recipe.inputs.forEach((inp, j) => {
        let have = 0;
        for (const slots of [hotbar, inventory]) {
          for (const slot of slots) {
            if (slot?.itemId === inp.itemId) have += slot.quantity;
          }
        }
        const label = ITEMS[inp.itemId]?.label ?? inp.itemId;
        ui.ingredientTexts[j]?.setText(`${have}/${inp.quantity} ${label}`)
          .setColor(have >= inp.quantity ? '#52b788' : '#e63946');
      });
    });
  }

  show(): void { this.setVisible(true); }
  hide(): void { this.setVisible(false); }
}
