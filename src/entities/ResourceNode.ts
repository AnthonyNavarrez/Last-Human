import Phaser from 'phaser';
import { C } from '../constants';

export type ResourceType = 'tree' | 'rock' | 'iron_ore_node' | 'copper_ore_node';

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

export class ResourceNode extends Phaser.GameObjects.Sprite {
  readonly resourceType: ResourceType;
  private hp: number;
  private hitsTaken = 0;
  private readonly dropInterval: number;
  private readonly drops: DropEntry[];

  constructor(scene: Phaser.Scene, x: number, y: number, type: ResourceType) {
    const def = NODE_DEFS[type];
    super(scene, x, y, def.spriteKey, type === 'tree' ? 0 : undefined);
    scene.add.existing(this);
    scene.physics.add.existing(this, true);
    this.resourceType = type;
    this.hp = def.hp;
    this.dropInterval = def.dropInterval;
    this.drops = def.drops;
    if (type === 'tree') {
      this.setScale(0.5);
      const body = this.body as Phaser.Physics.Arcade.StaticBody;
      const bw = 30, bh = 88;
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

  /** Deal one hit. Returns whether the node was destroyed and any drops rolled this hit. */
  hit(): { destroyed: boolean; drops: { itemId: string; quantity: number }[] } {
    this.hp -= 1;
    this.hitsTaken += 1;
    this.scene.tweens.add({ targets: this, alpha: 0.4, duration: 60, yoyo: true });

    if (this.hp <= 0) {
      return { destroyed: true, drops: this.rollDrops() };
    }
    if (this.hitsTaken % this.dropInterval === 0) {
      return { destroyed: false, drops: this.rollDrops() };
    }
    return { destroyed: false, drops: [] };
  }

  private rollDrops(): { itemId: string; quantity: number }[] {
    return this.drops
      .filter(d => d.chance === undefined || Math.random() < d.chance)
      .map(d => ({ itemId: d.itemId, quantity: d.quantity }));
  }
}
