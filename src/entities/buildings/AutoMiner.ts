import Phaser from 'phaser';
import { C } from '../../constants';
import { ResourceNode } from '../ResourceNode';

export class AutoMiner extends Phaser.GameObjects.Image {
  power = 0;
  hasPickaxe = false;
  outputItemId: string | null = null;
  outputQuantity = 0;
  readonly targetNode: ResourceNode;
  readonly eIcon: Phaser.GameObjects.Container;
  private intervalAccum = 0;

  constructor(scene: Phaser.Scene, node: ResourceNode) {
    super(scene, node.x, node.y, 'autominer-idle');
    this.targetNode = node;
    node.setVisible(false);
    scene.add.existing(this);
    scene.physics.add.existing(this, true);
    this.setDepth(C.DEPTH_OBJECTS + 1);
    this.setDisplaySize(32, 32);
    this.setAlpha(0.4);

    this.eIcon = makeEIcon(scene, node.x, node.y);
  }

  addFuel(count: number): void {
    this.power += count * C.AUTO_MINER_BATTERY_POWER;
    this.setAlpha(1);
  }

  addOutput(drop: { itemId: string; quantity: number }): void {
    if (!this.outputItemId || this.outputItemId === drop.itemId) {
      this.outputItemId = drop.itemId;
      this.outputQuantity += drop.quantity;
    }
  }

  getOutput(): { itemId: string; quantity: number } | null {
    if (!this.outputItemId) return null;
    return { itemId: this.outputItemId, quantity: this.outputQuantity };
  }

  clearOutput(): void {
    this.outputItemId = null;
    this.outputQuantity = 0;
  }

  /** Returns true if the miner should hit its node this tick. */
  tick(delta: number): boolean {
    if (this.power <= 0) {
      this.setAlpha(0.4);
      return false;
    }

    const interval = this.hasPickaxe
      ? C.AUTO_MINER_INTERVAL_MS / 2
      : C.AUTO_MINER_INTERVAL_MS;

    this.intervalAccum += delta;
    if (this.intervalAccum >= interval) {
      this.intervalAccum = 0;
      this.power--;
      this.setTexture('autominer-working');
      this.scene.time.delayedCall(300, () => {
        if (this.active) this.setTexture('autominer-idle');
      });
      if (this.power === 0) this.setAlpha(0.4);
      return true;
    }
    return false;
  }

  override destroy(fromScene?: boolean): void {
    if (this.eIcon?.active) this.eIcon.destroy();
    super.destroy(fromScene);
  }
}

/** Creates a floating [E] key hint in world space above the given position. */
export function makeEIcon(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Container {
  const bg = scene.add.rectangle(0, 0, 18, 18, 0x111111, 0.88).setStrokeStyle(1, 0xdddddd);
  const label = scene.add.text(0, 1, 'E', {
    fontSize: '10px', color: '#ffffff', fontStyle: 'bold',
  }).setOrigin(0.5, 0.5);
  const container = scene.add.container(x, y - 28, [bg, label]);
  container.setDepth(55);
  container.setVisible(false);
  return container;
}
