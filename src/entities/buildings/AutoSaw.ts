import Phaser from 'phaser';
import { C } from '../../constants';
import { ResourceNode } from '../ResourceNode';
import { makeEIcon } from './AutoMiner';

export class AutoSaw extends Phaser.GameObjects.Image {
  power   = 0;
  hasAxe  = false;
  outputItemId: string | null = null;
  outputQuantity = 0;
  readonly targetNode: ResourceNode;
  readonly eIcon: Phaser.GameObjects.Container;
  private intervalAccum = 0;
  private hitCount      = 0;

  constructor(scene: Phaser.Scene, node: ResourceNode) {
    super(scene, node.x, node.y, 'saw-idle');
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

  tick(delta: number): { drops: { itemId: string; quantity: number }[]; nodeDestroyed: boolean } | null {
    if (this.power <= 0 || !this.hasAxe) {
      if (this.power <= 0) this.setAlpha(0.4);
      return null;
    }

    this.intervalAccum += delta;
    if (this.intervalAccum < C.AUTO_MINER_INTERVAL_MS) return null;
    this.intervalAccum = 0;

    this.power--;
    if (this.power === 0) this.setAlpha(0.4);

    this.setTexture('saw-working');
    this.scene.time.delayedCall(300, () => {
      if (this.active) this.setTexture('saw-idle');
    });

    this.hitCount++;
    const drops: { itemId: string; quantity: number }[] = [];
    if (this.hitCount >= 3) {
      this.hitCount = 0;
      drops.push({ itemId: 'wood', quantity: 1 });
    }

    const nodeResult = this.targetNode.hit();
    return { drops, nodeDestroyed: nodeResult.destroyed };
  }

  override destroy(fromScene?: boolean): void {
    if (this.eIcon?.active) this.eIcon.destroy();
    super.destroy(fromScene);
  }
}
