import Phaser from 'phaser';
import { C } from '../constants';

export type ResourceType = 'tree' | 'rock' | 'iron_ore_node' | 'copper_ore_node' | 'bush' | 'blueberry_bush';

interface DropEntry {
  itemId: string;
  quantity: number;
  chance?: number; // omit or 1.0 = always; <1.0 = probability roll per interval
}

interface NodeDef {
  spriteKey: string;
  hp: number;
  dropInterval: number;
  drops: DropEntry[];
}

const NODE_DEFS: Record<ResourceType, NodeDef> = {
  bush: {
    spriteKey: 'decor-bush', hp: 1, dropInterval: 1, drops: [],
  },
  blueberry_bush: {
    spriteKey: 'decor-blueberry-bush-full', hp: 99, dropInterval: 1,
    drops: [
      { itemId: 'blueberry', quantity: 1 },
      { itemId: 'blueberry', quantity: 1, chance: 0.5 },
    ],
  },
  tree: {
    spriteKey: 'node-tree', hp: 80, dropInterval: 2,
    drops: [{ itemId: 'wood', quantity: 1 }],
  },
  rock: {
    spriteKey: 'node-rock', hp: 100, dropInterval: 3,
    drops: [
      { itemId: 'stone',      quantity: 1 },
      { itemId: 'iron_ore',   quantity: 1, chance: 0.25 },
      { itemId: 'copper_ore', quantity: 1, chance: 0.10 },
    ],
  },
  iron_ore_node: {
    spriteKey: 'node-iron-ore', hp: 150, dropInterval: 3,
    drops: [
      { itemId: 'iron_ore', quantity: 1 },
      { itemId: 'stone',    quantity: 1, chance: 0.50 },
    ],
  },
  copper_ore_node: {
    spriteKey: 'node-copper-ore', hp: 120, dropInterval: 3,
    drops: [
      { itemId: 'copper_ore', quantity: 1 },
      { itemId: 'stone',      quantity: 1, chance: 0.50 },
    ],
  },
};

const TREE_BROKEN_HITS    = 25;
const TREE_RESPAWN_MS     = 150_000; // 2 min 30 sec

export class ResourceNode extends Phaser.GameObjects.Sprite {
  readonly resourceType: ResourceType;
  private hp: number;
  private hitsTaken = 0;
  private readonly dropInterval: number;
  private readonly drops: DropEntry[];
  private _isBroken = false;
  private respawnTimer: Phaser.Time.TimerEvent | null = null;
  private yShifted = false;
  private _bushEmpty = false;
  private _bushEmptyHits = 0;
  private bushReviveTimer: Phaser.Time.TimerEvent | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number, type: ResourceType) {
    const def = NODE_DEFS[type];
    super(scene, x, y, def.spriteKey, type === 'tree' ? 0 : undefined);
    scene.add.existing(this);
    scene.physics.add.existing(this, true);
    this.resourceType = type;
    this.hp = def.hp;
    this.dropInterval = def.dropInterval;
    this.drops = def.drops;
    if (type === 'bush') {
      this.setScale(0.4);
      const body = this.body as Phaser.Physics.Arcade.StaticBody;
      body.checkCollision.none = true;
    }
    if (type === 'blueberry_bush') {
      this.setDisplaySize(24, 16);
      const body = this.body as Phaser.Physics.Arcade.StaticBody;
      body.checkCollision.none = true;
    }
    if (type === 'tree') {
      this.setScale(0.5);
      const body = this.body as Phaser.Physics.Arcade.StaticBody;
      const bw = 30, bh = 50;
      body.width = bw;
      body.height = bh;
      body.x = x - bw / 2;
      body.y = y - bh / 2;
      body.updateCenter();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const wld = (scene.physics.world as any);
      wld.staticTree.remove(body);
      wld.staticTree.insert(body);
    }
    this.setDepth(C.DEPTH_OBJECTS);
  }

  get isBroken(): boolean { return this._isBroken; }

  /** Deal one hit. Returns whether the node was destroyed and any drops rolled this hit. */
  hit(): { destroyed: boolean; drops: { itemId: string; quantity: number }[] } {
    if (this.resourceType === 'blueberry_bush') {
      this.scene.tweens.add({ targets: this, alpha: 0.4, duration: 60, yoyo: true });
      if (!this._bushEmpty) {
        // Full → empty: drop blueberries, start 30s revive timer
        this._bushEmpty = true;
        this.setTexture('decor-blueberry-bush-empty');
        this.setDisplaySize(24, 16);
        this.bushReviveTimer = this.scene.time.delayedCall(30_000, () => this.reviveBush());
        return { destroyed: false, drops: this.rollDrops() };
      } else {
        // Empty → needs 2 hits to destroy
        this._bushEmptyHits += 1;
        if (this._bushEmptyHits >= 2) {
          this.bushReviveTimer?.destroy();
          this.bushReviveTimer = null;
          return { destroyed: true, drops: [] };
        }
        return { destroyed: false, drops: [] };
      }
    }

    if (this._isBroken) {
      if (this.resourceType === 'tree') {
        this.cancelRespawn();
        return { destroyed: true, drops: [{ itemId: 'acorn', quantity: 1 }] };
      }
      return { destroyed: false, drops: [] };
    }

    this.hp -= 1;
    this.hitsTaken += 1;
    this.scene.tweens.add({ targets: this, alpha: 0.4, duration: 60, yoyo: true });

    const drops = this.hitsTaken % this.dropInterval === 0 ? this.rollDrops() : [];

    if (this.resourceType === 'tree' && this.hitsTaken >= TREE_BROKEN_HITS) {
      this.enterBrokenState();
      return { destroyed: false, drops };
    }

    if (this.hp <= 0) {
      return { destroyed: true, drops: this.rollDrops() };
    }
    return { destroyed: false, drops };
  }

  enterBrokenState(respawnMs = TREE_RESPAWN_MS, shiftY = true): void {
    this._isBroken = true;
    this.scene.tweens.killTweensOf(this);
    this.setAlpha(1);
    this.setTexture('node-tree-stump');
    this.setDisplaySize(90, 120);
    if (shiftY) {
      this.y -= 20;
      this.yShifted = true;
    }
    const body = this.body as Phaser.Physics.Arcade.StaticBody;
    body.checkCollision.none = true;
    const sw = 18, sh = 12;
    body.width = sw;
    body.height = sh;
    body.x = this.x - sw / 2;
    body.y = this.y + 20 - sh / 2;
    body.updateCenter();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const wld = (this.scene.physics.world as any);
    wld.staticTree.remove(body);
    wld.staticTree.insert(body);

    this.respawnTimer = this.scene.time.delayedCall(respawnMs, () => this.revive());
  }

  cancelRespawn(): void {
    if (this.respawnTimer) {
      this.respawnTimer.destroy();
      this.respawnTimer = null;
    }
  }

  private revive(): void {
    this.respawnTimer = null;
    this._isBroken = false;
    this.hitsTaken = 0;
    this.hp = NODE_DEFS.tree.hp;
    this.setTexture('node-tree', 0);
    this.setScale(0.5);
    if (this.yShifted) {
      this.y += 20;
      this.yShifted = false;
    }
    const body = this.body as Phaser.Physics.Arcade.StaticBody;
    body.checkCollision.none = false;
    const bw = 30, bh = 50;
    body.width = bw;
    body.height = bh;
    body.x = this.x - bw / 2;
    body.y = this.y - bh / 2;
    body.updateCenter();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const wld = (this.scene.physics.world as any);
    wld.staticTree.remove(body);
    wld.staticTree.insert(body);
  }

  private reviveBush(): void {
    this.bushReviveTimer = null;
    this._bushEmpty = false;
    this._bushEmptyHits = 0;
    this.setTexture('decor-blueberry-bush-full');
    this.setDisplaySize(24, 16);
  }

  private rollDrops(): { itemId: string; quantity: number }[] {
    return this.drops
      .filter(d => d.chance === undefined || Math.random() < d.chance)
      .map(d => ({ itemId: d.itemId, quantity: d.quantity }));
  }
}
