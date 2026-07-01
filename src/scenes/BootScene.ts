import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'boot' });
  }

  preload(): void {
    this.load.tilemapTiledJSON('map', 'assets/tiles/map.json');
    this.load.image('TilesetFloor',  'assets/AssetPack2/Terrain/Tileset/Tilemap_color1.png');
    this.load.image('TilesetForest', 'assets/AssetPack2/Terrain/Tileset/Tilemap_color4.png');
    this.load.image('TilesetFlora',  'assets/AssetPack2/Terrain/Tileset/Tilemap_color3.png');
    this.load.spritesheet('pawn-idle',
      'assets/AssetPack2/Units/Black Units/Pawn/Pawn_Idle.png',
      { frameWidth: 192, frameHeight: 192 },
    );
    this.load.spritesheet('pawn-run',
      'assets/AssetPack2/Units/Black Units/Pawn/Pawn_Run.png',
      { frameWidth: 192, frameHeight: 192 },
    );
    this.load.spritesheet('pawn-idle-axe',
      'assets/AssetPack2/Units/Black Units/Pawn/Pawn_Idle Axe.png',
      { frameWidth: 192, frameHeight: 192 },
    );
    this.load.spritesheet('pawn-run-axe',
      'assets/AssetPack2/Units/Black Units/Pawn/Pawn_Run Axe.png',
      { frameWidth: 192, frameHeight: 192 },
    );
    this.load.spritesheet('pawn-interact-axe',
      'assets/AssetPack2/Units/Black Units/Pawn/Pawn_Interact Axe.png',
      { frameWidth: 192, frameHeight: 192 },
    );
    this.load.spritesheet('pawn-idle-pickaxe',
      'assets/AssetPack2/Units/Black Units/Pawn/Pawn_Idle Pickaxe.png',
      { frameWidth: 192, frameHeight: 192 },
    );
    this.load.spritesheet('pawn-run-pickaxe',
      'assets/AssetPack2/Units/Black Units/Pawn/Pawn_Run Pickaxe.png',
      { frameWidth: 192, frameHeight: 192 },
    );
    this.load.spritesheet('pawn-interact-pickaxe',
      'assets/AssetPack2/Units/Black Units/Pawn/Pawn_Interact Pickaxe.png',
      { frameWidth: 192, frameHeight: 192 },
    );
    this.load.spritesheet('pawn-idle-knife',
      'assets/AssetPack2/Units/Black Units/Pawn/Pawn_Idle Knife.png',
      { frameWidth: 192, frameHeight: 192 },
    );
    this.load.spritesheet('pawn-run-knife',
      'assets/AssetPack2/Units/Black Units/Pawn/Pawn_Run Knife.png',
      { frameWidth: 192, frameHeight: 192 },
    );
    this.load.spritesheet('pawn-interact-knife',
      'assets/AssetPack2/Units/Black Units/Pawn/Pawn_Interact Knife.png',
      { frameWidth: 192, frameHeight: 192 },
    );
    // Resource nodes
    this.load.spritesheet('node-tree',        'assets/AssetPack2/Terrain/Resources/Wood/Trees/Tree3.png', { frameWidth: 192, frameHeight: 192 });
    this.load.spritesheet('node-tree-forest', 'assets/AssetPack2/Terrain/Resources/Wood/Trees/Tree1.png', { frameWidth: 192, frameHeight: 256 });
    this.load.spritesheet('node-tree-flora',  'assets/AssetPack2/Terrain/Resources/Wood/Trees/Tree4.png', { frameWidth: 192, frameHeight: 192 });
    this.load.image('node-tree-stump', 'assets/AssetPack2/Terrain/Resources/Wood/Trees/Stump 3.png');
    this.load.image('decor-bush',          'assets/AssetPack2/Terrain/Decorations/Bushes/Bushe4.png');
    this.load.spritesheet('decor-bush-forest', 'assets/AssetPack2/Terrain/Decorations/Bushes/Bushe3.png',
      { frameWidth: 128, frameHeight: 128 });
    this.load.image('decor-blueberry-bush-full',  'assets/manual imports/blueberry-bush-full.png');
    this.load.image('decor-blueberry-bush-empty', 'assets/manual imports/blueberry-bush-empty.png');
    this.load.image('item-blueberry',       'assets/manual imports/blueberry-icon.png');
    this.load.image('item-blueberry-seed',  'assets/manual imports/blueberry-seed.png');
    this.load.image('node-rock',       'assets/sprites/rock.png');
    this.load.image('node-gold',        'assets/AssetPack2/Terrain/Resources/Gold/Gold Stones/Gold Stone 5.png');
    this.load.image('node-gold-broken', 'assets/AssetPack2/Terrain/Resources/Gold/Gold Stones/Gold Stone 2.png');
    this.load.image('item-gold',        'assets/manual imports/gold.png');
    this.load.image('node-iron-ore',   'assets/sprites/iron-ore-node.png');
    this.load.image('node-copper-ore', 'assets/sprites/copper-ore-node.png');
    // Auto miner building sprites
    this.load.image('autominer-idle',    'assets/sprites/autominer-idle.png');
    this.load.image('autominer-working', 'assets/sprites/autominer-working.png');
    // Auto saw building sprites
    this.load.image('saw-idle',    'assets/machines/saw1-idle.png');
    this.load.image('saw-working', 'assets/machines/saw1-working.png');
    // Canon building sprites (plain image; frames are sliced in create())
    this.load.image('item-acorn', 'assets/manual imports/acorn.png');
    this.load.image('opening-screen', 'assets/manual imports/opening-screen.png');
    this.load.image('play-button',     'assets/manual imports/play-button.png');
    this.load.image('settings-button', 'assets/manual imports/settings-button.png');
    this.load.image('canon1', 'assets/manual imports/canon1.png');
    this.load.image('canon-ball', 'assets/manual imports/canon-ball.png');
    // Turret building sprite
    this.load.image('turret', 'assets/manual imports/turret.png');
    // Dropped items
    this.load.image('item-branch', 'assets/Asset Pack/Items/Resource/Branch.png');
    this.load.image('item-rock',   'assets/Asset Pack/Items/Resource/Rock.png');
    this.load.image('item-coin',    'assets/AssetPack2/UI Elements/UI Elements/Icons/coin-icon.png');
    this.load.image('item-battery', 'assets/manual imports/battery.png');
    // Ore / raw resources
    this.load.image('item-iron-ore',   'assets/Asset Pack/Items/Resource/BarIron.png');
    this.load.image('item-copper-ore', 'assets/Asset Pack/Items/Resource/BarCopper.png');
    this.load.image('item-leather',    'assets/Asset Pack/Items/Resource/feather.png');
    // Ammo
    this.load.image('item-wooden-arrow',            'assets/manual imports/wooden-arrow-icon.png');
    this.load.image('item-wooden-arrow-projectile', 'assets/manual imports/wooden-arrow-projectile.png');
    // Tools
    this.load.image('item-stone-axe',     'assets/Asset Pack/Items/Tool/Axe.png');
    this.load.image('item-stone-pickaxe', 'assets/Asset Pack/Items/Tool/Pickaxe.png');
    this.load.image('item-repair-hammer', 'assets/Asset Pack/Items/Tool/Hammer.png');
    this.load.image('item-auto-miner',    'assets/Asset Pack/Items/Tool/Shovel.png');
    // Weapons
    this.load.image('item-iron-sword', 'assets/manual imports/iron-sword.png');
    this.load.image('item-bow',        'assets/manual imports/wooden-bow.png');
    this.load.spritesheet('pawn-idle-bow',
      'assets/manual imports/pawn-idle-bow.png',
      { frameWidth: 192, frameHeight: 192 },
    );
    this.load.spritesheet('pawn-run-bow',
      'assets/manual imports/Pawn_Run_bow.png',
      { frameWidth: 192, frameHeight: 192 },
    );
    // FX
    this.load.spritesheet('fx-sword-swing', 'assets/manual imports/sword-animation.png', { frameWidth: 2048, frameHeight: 2048 });
    // UI
    this.load.image('ui-health-bar',      'assets/manual imports/health-bar.png');
    this.load.atlas('ui-house-hp-frame',
      'assets/AssetPack2/UI Elements/UI Elements/Bars/SmallBar_Base.png',
      'assets/manual imports/house-hp-frame.json');
    this.load.image('ui-hotbar-slot',  'assets/manual imports/hotbar-slot.png');
    this.load.image('stat-speed',    'assets/manual imports/speed-icon.png');
    this.load.image('stat-strength', 'assets/AssetPack2/UI Elements/UI Elements/Icons/Icon_05.png');
    this.load.image('stat-armor',    'assets/AssetPack2/UI Elements/UI Elements/Icons/Icon_06.png');
    // Audio
    this.load.audio('sfx-hit-resource', 'assets/audio/hit-resource.mp3');
    this.load.audio('sfx-place-build',  'assets/audio/building.mp3');
    // Buildings
    this.load.image('building-crafting-bench', 'assets/manual imports/Crafting-bench1.png');
    this.load.image('item-anvil',     'assets/Asset Pack/Items/Tool/Anvil.png');
    this.load.image('building-anvil', 'assets/manual imports/anvil-placed.png');
    this.load.image('building-house', 'assets/AssetPack2/Buildings/Blue Buildings/House1.png');
    // Enemies
    this.load.atlas('enemy-mercenary',
      'assets/manual imports/mercenary-run.png',
      'assets/manual imports/mercenary-run.json');
    this.load.atlas('enemy-skeleton',
      'assets/manual imports/skeleton-run.png',
      'assets/manual imports/skeleton-run.json');
    this.load.atlas('enemy-skeleton-attack',
      'assets/manual imports/skeleton-attack.png',
      'assets/manual imports/skeleton-attack.json');
    this.load.spritesheet('enemy-orc',
      'assets/manual imports/orc-running.png',
      { frameWidth: 457, frameHeight: 500 });
    this.load.image('fire-projectile', 'assets/manual imports/fire-projectile.png');
    this.load.image('enemy-spider',        'assets/manual imports/spider-run.png');
    this.load.image('enemy-spider-attack', 'assets/manual imports/spider-attack.png');
    this.load.spritesheet('enemy-yellow-bat',
      'assets/Asset Pack/Actor/Monster/YellowsBat/SpriteSheet.png',
      { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet('enemy-gnome', 'assets/manual imports/gnome-run.png',
      { frameWidth: 743, frameHeight: 500 });
    this.load.image('enemy-gnome-attack', 'assets/manual imports/gnome-attack.png');
    this.load.image('enemy-bear', 'assets/manual imports/bear-run.png');
    this.load.image('enemy-bear-idle', 'assets/manual imports/bear-idle.png');
    this.load.image('enemy-bear-attack', 'assets/manual imports/bear-attack.png');
    // Bear drop icons
    this.load.image('item-claw', 'assets/manual imports/claw.png');
    this.load.image('item-hide', 'assets/manual imports/hide.png');
  }

  create(): void {
    // 4×4 white square used for death particle bursts
    const g = this.add.graphics();
    g.fillStyle(0xffffff, 1);
    g.fillRect(0, 0, 4, 4);
    g.generateTexture('particle', 4, 4);
    g.destroy();

    // Crop the 5-frame horizontal canon1 strip (5792×2880) into individual textures.
    // Each source frame is 1158px wide; cannon art sits roughly in y 400–1800,
    // so we crop to a 1158×1400 region to remove the blank vertical padding.
    {
      const CANON_FW = 1158;
      const CROP_Y   = 400;
      const CROP_H   = 1400;
      const src = this.add.image(0, 0, 'canon1').setOrigin(0, 0).setVisible(false);
      for (let i = 0; i < 5; i++) {
        const rt = this.add.renderTexture(0, 0, CANON_FW, CROP_H);
        rt.draw(src, -(i * CANON_FW), -CROP_Y);
        rt.saveTexture(`canon1-f${i}`);
        rt.destroy();
      }
      src.destroy();
    }

    // Spider spritesheets have non-uniform frame gaps; register frames manually
    {
      const tex = this.textures.get('enemy-spider');
      const frames: [number, number, number][] = [
        [36,   1006, 968],
        [1545,  989, 968],
        [2929,  989, 968],
        [4313,  988, 968],
        [5679,  988, 968],
      ];
      frames.forEach(([x, w, h], i) => tex.add(i, 0, x, 0, w, h));
    }
    {
      const tex = this.textures.get('enemy-spider-attack');
      const frames: [number, number, number][] = [
        [39,    779, 744],
        [1220,  766, 744],
        [2259,  766, 744],
        [3324, 1012, 744],
        [4687,  909, 744],
        [5998,  870, 744],
      ];
      frames.forEach(([x, w, h], i) => tex.add(i, 0, x, 0, w, h));
    }
    {
      // gnome-attack.png: 5 frames with uneven widths — register by gap midpoints
      const tex = this.textures.get('enemy-gnome-attack');
      const frames: [number, number, number][] = [
        [  0, 137, 112],
        [137, 160, 112],
        [297, 180, 112],
        [477, 163, 112],
        [640, 127, 112],
      ];
      frames.forEach(([x, w, h], i) => tex.add(i, 0, x, 0, w, h));
    }
    {
      // Bear run sheet has non-uniform frame gaps; register frames manually
      const tex = this.textures.get('enemy-bear');
      const frames: [number, number, number][] = [
        [ 221, 1155, 1015],
        [1701, 1064, 1015],
        [3051, 1181, 1015],
        [4518, 1155, 1015],
        [5946, 1090, 1015],
      ];
      frames.forEach(([x, w, h], i) => tex.add(i, 0, x, 0, w, h));
    }
    {
      // Bear idle sheet has non-uniform frame gaps and heavy vertical padding;
      // crop tight to the bear's content box so it renders at the same scale as the run sheet.
      const tex = this.textures.get('enemy-bear-idle');
      const frames: [number, number, number, number][] = [
        [ 432, 511, 1504, 1197],
        [2800, 511, 1504, 1197],
        [5136, 511, 1504, 1197],
      ];
      frames.forEach(([x, y, w, h], i) => tex.add(i, 0, x, y, w, h));
    }
    {
      // Bear attack sheet has non-uniform frame gaps; register frames manually.
      // Frame 4 (the claw swipe) has a body/VFX gap smaller than the real inter-frame
      // gaps, so it's kept as one wide frame rather than split in two.
      const tex = this.textures.get('enemy-bear-attack');
      const frames: [number, number, number, number][] = [
        [ 252, 754,  674, 755],
        [1502, 754,  800, 755],
        [2842, 754,  746, 755],
        [3876, 754, 1124, 755],
        [5791, 754,  935, 755],
      ];
      frames.forEach(([x, y, w, h], i) => tex.add(i, 0, x, y, w, h));
    }

this.scene.start('menu');
  }
}
