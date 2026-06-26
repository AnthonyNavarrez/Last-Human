import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'boot' });
  }

  preload(): void {
    this.load.tilemapTiledJSON('map', 'assets/tiles/map.json');
    this.load.image('TilesetFloor', 'assets/Asset Pack/Backgrounds/Tilesets/TilesetFloor.png');
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
    this.load.image('node-tree',       'assets/sprites/tree.png');
    this.load.image('node-rock',       'assets/sprites/rock.png');
    this.load.image('node-iron-ore',   'assets/sprites/iron-ore-node.png');
    this.load.image('node-copper-ore', 'assets/sprites/copper-ore-node.png');
    // Auto miner building sprites
    this.load.image('autominer-idle',    'assets/sprites/autominer-idle.png');
    this.load.image('autominer-working', 'assets/sprites/autominer-working.png');
    // Dropped items
    this.load.image('item-branch', 'assets/Asset Pack/Items/Resource/Branch.png');
    this.load.image('item-rock',   'assets/Asset Pack/Items/Resource/Rock.png');
    this.load.image('item-gem',    'assets/Asset Pack/Items/Resource/GemYellow.png');
    // Ore / raw resources
    this.load.image('item-iron-ore',   'assets/Asset Pack/Items/Resource/BarIron.png');
    this.load.image('item-copper-ore', 'assets/Asset Pack/Items/Resource/BarCopper.png');
    this.load.image('item-leather',    'assets/Asset Pack/Items/Resource/feather.png');
    // Ammo
    this.load.image('item-bullet',     'assets/Asset Pack/Items/Projectile/Arrow.png');
    // Tools
    this.load.image('item-stone-axe',     'assets/Asset Pack/Items/Tool/Axe.png');
    this.load.image('item-stone-pickaxe', 'assets/Asset Pack/Items/Tool/Pickaxe.png');
    this.load.image('item-repair-hammer', 'assets/Asset Pack/Items/Tool/Hammer.png');
    this.load.image('item-auto-miner',    'assets/Asset Pack/Items/Tool/Shovel.png');
    // Weapons
    this.load.image('item-iron-sword', 'assets/AssetPack2/UI Elements/UI Elements/Icons/Icon_05.png');
    this.load.image('item-pistol',     'assets/Asset Pack/Items/Weapons/Bow2/Sprite.png');
    // Buildings
    this.load.image('building-crafting-bench', 'assets/Asset Pack/Items/Tool/Anvil.png');
    this.load.image('building-house', 'assets/sprites/house-1.png');
    // Enemies
    this.load.spritesheet('enemy-snake2',
      'assets/Asset Pack/Actor/Monster/Snake2/Snake2.png',
      { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet('enemy-gold-racoon',
      'assets/Asset Pack/Actor/Monster/GoldRacoon/SpriteSheet.png',
      { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet('enemy-bear',
      'assets/Asset Pack/Actor/Monster/Bear/SpriteSheet.png',
      { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet('enemy-yellow-bat',
      'assets/Asset Pack/Actor/Monster/YellowsBat/SpriteSheet.png',
      { frameWidth: 16, frameHeight: 16 });
  }

  create(): void {
    // 4×4 white square used for death particle bursts
    const g = this.add.graphics();
    g.fillStyle(0xffffff, 1);
    g.fillRect(0, 0, 4, 4);
    g.generateTexture('particle', 4, 4);
    g.destroy();

    this.scene.start('menu');
  }
}
