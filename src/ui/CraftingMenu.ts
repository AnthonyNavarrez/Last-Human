import Phaser from 'phaser';
import { RECIPES, RecipeDefinition, RecipeTab } from '../data/recipes';
import { ItemStack } from '../systems/GameState';
import { canCraft } from '../systems/CraftingSystem';
import { ITEMS } from '../data/items';

const BENCH_RECIPES = RECIPES.filter(r => r.stationId === 'crafting_bench');

const TABS: { id: RecipeTab; label: string }[] = [
  { id: 'tools',     label: 'Tools'     },
  { id: 'weapons',   label: 'Weapons'   },
  { id: 'buildings', label: 'Buildings' },
  { id: 'misc',      label: 'Misc'      },
];

const PANEL_W     = 680;
const PAD         = 30;
const TITLE_H     = 50;
const TAB_H       = 56;
const INGR_COLS   = 2;
const ROW_H_SHORT = 140;
const ROW_H_TALL  = 170;
const FOOTER_H    = 66;
const CONTENT_H   = ROW_H_SHORT * 3;   // 420 — shows 3 rows; rest is scrollable
const PANEL_H     = PAD + TITLE_H + 1 + TAB_H + 2 + CONTENT_H + 2 + FOOTER_H + PAD;

const TITLE_CENTER_Y  = -PANEL_H / 2 + PAD + TITLE_H / 2;
const TITLE_DIV_Y     = -PANEL_H / 2 + PAD + TITLE_H;
const TAB_TOP_Y       = TITLE_DIV_Y + 1;
const TAB_CENTER_Y    = TAB_TOP_Y + TAB_H / 2;
const DIVIDER_Y       = TAB_TOP_Y + TAB_H;
const CONTENT_TOP_Y   = DIVIDER_Y + 2;
const FOOTER_CENTER_Y = PANEL_H / 2 - PAD - FOOTER_H / 2;

function rowHeightFor(recipe: RecipeDefinition): number {
  return recipe.inputs.length > INGR_COLS ? ROW_H_TALL : ROW_H_SHORT;
}

interface RecipeUI {
  craftBtn: Phaser.GameObjects.Rectangle;
  ingredientTexts: Phaser.GameObjects.Text[];
}

interface TabContent {
  objects: Phaser.GameObjects.GameObject[];
  entries: { recipe: RecipeDefinition; ui: RecipeUI }[];
  hitzones: Phaser.GameObjects.Rectangle[];
}

export class CraftingMenu extends Phaser.GameObjects.Container {
  private activeTab: RecipeTab = 'tools';
  private tabBgs    = new Map<RecipeTab, Phaser.GameObjects.Rectangle>();
  private tabLabels = new Map<RecipeTab, Phaser.GameObjects.Text>();
  private tabData   = new Map<RecipeTab, TabContent>();
  private contentContainer!: Phaser.GameObjects.Container;
  private maskGfx!: Phaser.GameObjects.Graphics;
  private scrollY  = 0;
  private tabTotalH = new Map<RecipeTab, number>();

  constructor(scene: Phaser.Scene) {
    super(scene, scene.scale.width / 2, scene.scale.height / 2);

    const bg = scene.add.rectangle(0, 0, PANEL_W, PANEL_H, 0x12121e, 0.94);
    bg.setStrokeStyle(2, 0x4a9eff);
    this.add(bg);

    // ── Title ─────────────────────────────────────────────────────────────────
    this.add(scene.add.text(-PANEL_W / 2 + PAD, TITLE_CENTER_Y, 'Crafting Bench', {
      fontSize: '24px', color: '#f1c40f', fontStyle: 'bold',
    }).setOrigin(0, 0.5));
    this.add(scene.add.text(PANEL_W / 2 - PAD, TITLE_CENTER_Y, 'Lv. 1', {
      fontSize: '18px', color: '#aaaacc',
    }).setOrigin(1, 0.5));
    this.add(scene.add.rectangle(0, TITLE_DIV_Y, PANEL_W - 24, 1, 0x4a9eff, 0.4));

    // ── Tab buttons ──────────────────────────────────────────────────────────
    const tabW = (PANEL_W - PAD * 2) / TABS.length;
    TABS.forEach(({ id, label }, idx) => {
      const tx = -PANEL_W / 2 + PAD + tabW * idx + tabW / 2;
      const tw = tabW - 4, th = TAB_H - 6;
      const tabBg = scene.add.rectangle(tx, TAB_CENTER_Y, tw, th, 0x1e1e38)
        .setStrokeStyle(1, 0x333366)
        .setInteractive();
      const tabLbl = scene.add.text(tx, TAB_CENTER_Y, label, {
        fontSize: '18px', color: '#aaaacc',
      }).setOrigin(0.5, 0.5);
      this.add(tabBg);
      this.add(tabLbl);
      this.tabBgs.set(id, tabBg);
      this.tabLabels.set(id, tabLbl);

      tabBg.on('pointerdown', () => this.switchTab(id));
      tabBg.on('pointerover', () => { if (this.activeTab !== id) tabBg.setFillStyle(0x2a2a4a); });
      tabBg.on('pointerout',  () => { if (this.activeTab !== id) tabBg.setFillStyle(0x1e1e38); });
    });

    this.add(scene.add.rectangle(0, DIVIDER_Y, PANEL_W - 24, 1, 0x4a9eff, 0.6));

    // ── Scrollable content container + mask ──────────────────────────────────
    this.contentContainer = scene.add.container(0, CONTENT_TOP_Y);
    this.add(this.contentContainer);

    this.maskGfx = scene.add.graphics();
    const updateMask = (): void => {
      const cx = scene.scale.width  / 2;
      const cy = scene.scale.height / 2;
      this.maskGfx.clear();
      this.maskGfx.fillStyle(0xffffff);
      this.maskGfx.fillRect(
        cx - PANEL_W / 2 + 2,
        cy + CONTENT_TOP_Y,
        PANEL_W - 4,
        CONTENT_H,
      );
    };
    updateMask();
    this.maskGfx.setVisible(false);
    this.contentContainer.setMask(this.maskGfx.createGeometryMask());

    scene.input.on('wheel', (
      _ptr: Phaser.Input.Pointer,
      _objs: unknown,
      _dx: number,
      dy: number,
    ) => {
      if (!this.visible) return;
      const tabH = this.tabTotalH.get(this.activeTab) ?? 0;
      if (tabH <= CONTENT_H) return;
      this.scrollY = Phaser.Math.Clamp(
        this.scrollY - dy * 0.6,
        -(tabH - CONTENT_H),
        0,
      );
      this.contentContainer.setY(CONTENT_TOP_Y + this.scrollY);
    });

    // ── Recipe rows per tab ───────────────────────────────────────────────────
    TABS.forEach(({ id }) => {
      const objects: Phaser.GameObjects.GameObject[] = [];
      const entries: TabContent['entries'] = [];
      const hitzones: Phaser.GameObjects.Rectangle[] = [];
      const tabRecipes = BENCH_RECIPES.filter(r => r.tab === id);

      if (tabRecipes.length === 0) {
        const empty = scene.add.text(0, CONTENT_H / 2, 'Nothing here yet', {
          fontSize: '16px', color: '#555577',
        }).setOrigin(0.5, 0.5);
        this.contentContainer.add(empty);
        objects.push(empty);
        this.tabTotalH.set(id, 0);
      } else {
        let cumulY = 0;
        tabRecipes.forEach((recipe, i) => {
          const rh = rowHeightFor(recipe);
          const ui = this.buildRow(scene, objects, hitzones, recipe, cumulY + rh / 2, i, rh);
          entries.push({ recipe, ui });
          cumulY += rh;
        });
        this.tabTotalH.set(id, cumulY);
      }

      this.tabData.set(id, { objects, entries, hitzones });
    });

    // ── Footer ────────────────────────────────────────────────────────────────
    this.add(scene.add.rectangle(0, PANEL_H / 2 - PAD - FOOTER_H, PANEL_W - 24, 1, 0x333355, 1));

    this.add(scene.add.text(-PANEL_W / 2 + 20, FOOTER_CENTER_Y, '[E] to close', {
      fontSize: '16px', color: '#666688',
    }).setOrigin(0, 0.5));

    const closeBtnBg = scene.add.rectangle(PANEL_W / 2 - 66, FOOTER_CENTER_Y, 104, 40, 0x2a2a45)
      .setStrokeStyle(1, 0x555577)
      .setInteractive();
    this.add(closeBtnBg);
    this.add(scene.add.text(PANEL_W / 2 - 66, FOOTER_CENTER_Y, 'Close', {
      fontSize: '17px', color: '#aaaacc',
    }).setOrigin(0.5, 0.5));
    closeBtnBg.on('pointerdown', () => scene.game.events.emit('close-crafting'));
    closeBtnBg.on('pointerover', () => closeBtnBg.setFillStyle(0x3a3a55));
    closeBtnBg.on('pointerout',  () => closeBtnBg.setFillStyle(0x2a2a45));

    scene.add.existing(this);
    this.setDepth(200);
    this.setVisible(false);

    scene.scale.on('resize', () => {
      this.setPosition(scene.scale.width / 2, scene.scale.height / 2);
      updateMask();
    });

    this.switchTab('tools');
  }

  private switchTab(id: RecipeTab): void {
    this.scrollY = 0;
    this.contentContainer.setY(CONTENT_TOP_Y);

    this.activeTab = id;
    this.tabData.forEach((content, tabId) => {
      const v = tabId === id;
      content.objects.forEach(o => (o as unknown as Phaser.GameObjects.Components.Visible).setVisible(v));
      content.hitzones.forEach(hz => { if (v) hz.setInteractive(); else hz.disableInteractive(); });
    });
    this.tabBgs.forEach((btnBg, tabId) => {
      if (tabId === id) {
        btnBg.setFillStyle(0x2a4a7a).setStrokeStyle(1, 0x4a9eff);
        this.tabLabels.get(tabId)!.setColor('#ffffff');
      } else {
        btnBg.setFillStyle(0x1e1e38).setStrokeStyle(1, 0x333366);
        this.tabLabels.get(tabId)!.setColor('#aaaacc');
      }
    });
  }

  private buildRow(
    scene: Phaser.Scene,
    objects: Phaser.GameObjects.GameObject[],
    hitzones: Phaser.GameObjects.Rectangle[],
    recipe: RecipeDefinition,
    rowCenterY: number,
    idx: number,
    rowH: number,
  ): RecipeUI {
    const multiLine = recipe.inputs.length > INGR_COLS;

    const track = <T extends Phaser.GameObjects.GameObject>(obj: T): T => {
      this.contentContainer.add(obj);
      objects.push(obj);
      return obj;
    };

    if (idx > 0) {
      track(scene.add.rectangle(0, rowCenterY - rowH / 2, PANEL_W - 24, 1, 0x222244, 1));
    }

    const outItem = ITEMS[recipe.outputs[0].itemId];
    if (outItem) {
      const outIcon = track(scene.add.image(-PANEL_W / 2 + 42, rowCenterY, outItem.spriteKey)
        .setDisplaySize(40, 40).setOrigin(0.5, 0.5));
      if (outItem.spriteKey === 'item-bow')
        (outIcon as Phaser.GameObjects.Image).setRotation(-Math.PI / 4);
    }

    const nameY = rowCenterY - (multiLine ? 50 : 34);
    track(scene.add.text(-PANEL_W / 2 + 74, nameY, recipe.label, {
      fontSize: '22px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0, 0.5));

    const ingredientTexts: Phaser.GameObjects.Text[] = [];
    const ingrStartX = -PANEL_W / 2 + 74;
    const ingrColW   = 210;
    const ingrRow0Y  = multiLine ? rowCenterY - 16 : rowCenterY + 18;
    const ingrRow1Y  = ingrRow0Y + 26;

    recipe.inputs.forEach((inp, j) => {
      const col = j % INGR_COLS;
      const row = Math.floor(j / INGR_COLS);
      const x = ingrStartX + col * ingrColW;
      const y = row === 0 ? ingrRow0Y : ingrRow1Y;
      const txt = track(scene.add.text(x, y,
        `0/${inp.quantity} ${ITEMS[inp.itemId]?.label ?? inp.itemId}`, {
          fontSize: '17px', color: '#e63946',
        }).setOrigin(0, 0.5));
      ingredientTexts.push(txt as Phaser.GameObjects.Text);
    });

    const outItemId = recipe.outputs[0].itemId;
    const iconX = -PANEL_W / 2 + 42;
    const HZ = 52;
    const hitZone = scene.add.rectangle(iconX, rowCenterY, HZ, HZ, 0x000000, 0)
      .setInteractive() as Phaser.GameObjects.Rectangle;
    hitZone.on('pointerover', () => scene.game.events.emit('show-tooltip', { itemId: outItemId }));
    hitZone.on('pointerout',  () => scene.game.events.emit('hide-tooltip'));
    this.contentContainer.add(hitZone);
    objects.push(hitZone);
    hitzones.push(hitZone);

    const btnX  = PANEL_W / 2 - 66;
    const btnBg = track(scene.add.rectangle(btnX, rowCenterY, 104, 48, 0x2d6a4f)
      .setStrokeStyle(1, 0x52b788)
      .setInteractive()) as Phaser.GameObjects.Rectangle;
    track(scene.add.text(btnX, rowCenterY, 'Craft', {
      fontSize: '19px', color: '#ffffff',
    }).setOrigin(0.5, 0.5));

    btnBg.on('pointerdown', () => scene.game.events.emit('do-craft', recipe.id));
    btnBg.on('pointerover', () => { if (btnBg.input?.enabled) btnBg.setFillStyle(0x40916c); });
    btnBg.on('pointerout',  () => { if (btnBg.input?.enabled) btnBg.setFillStyle(0x2d6a4f); });

    return { craftBtn: btnBg, ingredientTexts };
  }

  refresh(hotbar: (ItemStack | null)[], inventory: (ItemStack | null)[]): void {
    const { entries } = this.tabData.get(this.activeTab) ?? { entries: [] };
    entries.forEach(({ recipe, ui }) => {
      const craftable = canCraft(hotbar, inventory, recipe);

      ui.craftBtn.setFillStyle(craftable ? 0x2d6a4f : 0x3a3a3a);
      ui.craftBtn.setStrokeStyle(1, craftable ? 0x52b788 : 0x555555);
      if (craftable) ui.craftBtn.setInteractive();
      else           ui.craftBtn.disableInteractive();

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
  hide(): void {
    this.setVisible(false);
    this.scene.game.events.emit('hide-tooltip');
  }
}
