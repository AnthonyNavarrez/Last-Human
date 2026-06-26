import Phaser from 'phaser';
import { C } from '../constants';
import { R } from '../registry';
import { GameState, createInitialState } from '../systems/GameState';
import { Player } from '../entities/Player';
import { ResourceNode, ResourceType } from '../entities/ResourceNode';
import { DroppedItem } from '../entities/DroppedItem';
import { addItem, removeItem } from '../systems/InventorySystem';
import { CraftingBench } from '../entities/buildings/CraftingBench';
import { House } from '../entities/buildings/House';
import { AutoMiner, makeEIcon } from '../entities/buildings/AutoMiner';
import { doCraft } from '../systems/CraftingSystem';
import { RECIPES } from '../data/recipes';
import { BaseEnemy } from '../entities/enemies/BaseEnemy';
import { ENEMIES } from '../data/enemies';
import { WAVES, WaveDefinition } from '../data/waves';
import { ITEMS } from '../data/items';
import { audioManager } from '../systems/AudioManager';

interface KeyMap {
  up: Phaser.Input.Keyboard.Key;
  down: Phaser.Input.Keyboard.Key;
  left: Phaser.Input.Keyboard.Key;
  right: Phaser.Input.Keyboard.Key;
  interact: Phaser.Input.Keyboard.Key;
  pause: Phaser.Input.Keyboard.Key;
  slot1: Phaser.Input.Keyboard.Key;
  slot2: Phaser.Input.Keyboard.Key;
  slot3: Phaser.Input.Keyboard.Key;
  slot4: Phaser.Input.Keyboard.Key;
  slot5: Phaser.Input.Keyboard.Key;
  slot6: Phaser.Input.Keyboard.Key;
  slot7: Phaser.Input.Keyboard.Key;
  slot8: Phaser.Input.Keyboard.Key;
}

// TilesetFloor GID for cleared ground (col 5, row 8 = orange-brown with green border)
const CLEARED_GID = 182;
// 3 minutes
const RESPAWN_MS = 3 * 60 * 1000;

export class GameScene extends Phaser.Scene {
  private keys!: KeyMap;
  private gameState!: GameState;
  private localPlayerId!: string;
  private player!: Player;
  private resourceGroup!: Phaser.Physics.Arcade.StaticGroup;
  private buildingGroup!: Phaser.Physics.Arcade.StaticGroup;
  private craftingBench!: CraftingBench;
  private groundLayer!: Phaser.Tilemaps.TilemapLayer;
  private droppedItemMap = new Map<string, DroppedItem>();
  private house!: House;
  private houseHpBarFill!: Phaser.GameObjects.Rectangle;
  private houseHp: number = C.HOUSE_HP;
  private houseRegenCooldownMs = 0;
  private houseRegenAccumMs = 0;
  private activeEnemies = new Map<string, BaseEnemy>();
  private attackCooldownMs = 0;
  private craftingOpen = false;
  private miners: AutoMiner[] = [];
  private activeMiner: AutoMiner | null = null;
  private minerOpen = false;
  private benchEIcon!: Phaser.GameObjects.Container;
  private waveTotal = 0;
  private waveKilled = 0;
  private gameOver = false;

  constructor() {
    super({ key: 'game' });
  }

  create(): void {
    this.localPlayerId = crypto.randomUUID();
    this.gameState = createInitialState(this.localPlayerId);

    this.buildMap();

    this.player = new Player(this, C.PLAYER_SPAWN.x, C.PLAYER_SPAWN.y);

    this.resourceGroup = this.physics.add.staticGroup();
    this.spawnResourceNodes();
    this.physics.add.collider(this.player, this.resourceGroup);

    this.buildingGroup = this.physics.add.staticGroup();
    this.craftingBench = new CraftingBench(this, C.CRAFTING_BENCH_SPAWN.x, C.CRAFTING_BENCH_SPAWN.y);
    this.house = new House(this, C.HOUSE_SPAWN.x, C.HOUSE_SPAWN.y);
    this.buildingGroup.add(this.craftingBench, false);
    this.buildingGroup.add(this.house, false);
    this.physics.add.collider(this.player, this.buildingGroup);

    // World-space HP bar floating above the house (64px wide × 6px tall, origin top-left)
    const hbx = C.HOUSE_SPAWN.x - 32;
    const hby = C.HOUSE_SPAWN.y - 40 - 8; // 40 = half house height, 8 = gap + bar
    this.add.rectangle(hbx, hby, 64, 6, 0x222222).setOrigin(0, 0).setDepth(50);
    this.houseHpBarFill = this.add.rectangle(hbx, hby, 64, 6, 0x22cc44).setOrigin(0, 0).setDepth(51);

    this.benchEIcon = makeEIcon(this, C.CRAFTING_BENCH_SPAWN.x, C.CRAFTING_BENCH_SPAWN.y);

    this.cameras.main.startFollow(this.player, true);

    this.keys = this.input.keyboard!.addKeys({
      up:       Phaser.Input.Keyboard.KeyCodes.W,
      down:     Phaser.Input.Keyboard.KeyCodes.S,
      left:     Phaser.Input.Keyboard.KeyCodes.A,
      right:    Phaser.Input.Keyboard.KeyCodes.D,
      interact: Phaser.Input.Keyboard.KeyCodes.E,
      pause:    Phaser.Input.Keyboard.KeyCodes.ESC,
      slot1:    Phaser.Input.Keyboard.KeyCodes.ONE,
      slot2:    Phaser.Input.Keyboard.KeyCodes.TWO,
      slot3:    Phaser.Input.Keyboard.KeyCodes.THREE,
      slot4:    Phaser.Input.Keyboard.KeyCodes.FOUR,
      slot5:    Phaser.Input.Keyboard.KeyCodes.FIVE,
      slot6:    Phaser.Input.Keyboard.KeyCodes.SIX,
      slot7:    Phaser.Input.Keyboard.KeyCodes.SEVEN,
      slot8:    Phaser.Input.Keyboard.KeyCodes.EIGHT,
    }) as KeyMap;

    this.input.mouse?.disableContextMenu();

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!pointer.leftButtonDown() || this.craftingOpen || this.minerOpen) return;
      const ps = this.gameState.players[this.localPlayerId];
      const activeItem = ps.hotbar[ps.activeSlot];
      if (activeItem?.itemId === 'auto_miner') {
        this.placeAutoMiner(pointer.worldX, pointer.worldY);
      } else {
        this.doMeleeAttack();
      }
    });

    this.game.events.on('do-craft', (recipeId: string) => {
      const recipe = RECIPES.find(r => r.id === recipeId);
      if (!recipe) return;
      const ps = this.gameState.players[this.localPlayerId];
      doCraft(ps.hotbar, ps.inventory, recipe);
      audioManager.sfxCraft();
      this.syncRegistry();
    }, this);

    this.game.events.on('close-crafting', () => {
      this.craftingOpen = false;
      this.syncRegistry();
    }, this);

    this.game.events.on('add-miner-fuel', () => {
      if (!this.activeMiner) return;
      const ps = this.gameState.players[this.localPlayerId];
      if (removeItem(ps.hotbar, ps.inventory, 'wood', 1)) {
        this.activeMiner.addFuel(1);
        this.syncRegistry();
      }
    }, this);

    this.game.events.on('toggle-miner-pickaxe', () => {
      if (!this.activeMiner) return;
      const ps = this.gameState.players[this.localPlayerId];
      if (this.activeMiner.hasPickaxe) {
        this.activeMiner.hasPickaxe = false;
        addItem(ps.hotbar, ps.inventory, 'stone_pickaxe', 1);
      } else {
        if (removeItem(ps.hotbar, ps.inventory, 'stone_pickaxe', 1)) {
          this.activeMiner.hasPickaxe = true;
        }
      }
      this.syncRegistry();
    }, this);

    this.game.events.on('close-miner', () => {
      this.minerOpen = false;
      this.activeMiner = null;
      this.syncRegistry();
    }, this);

    this.game.events.on('night-start', (nightNumber: number) => {
      audioManager.sfxNightStart();
      this.startWave(nightNumber);
    }, this);

    this.input.on('wheel', (_ptr: unknown, _gos: unknown, _dx: number, dy: number) => {
      const ps = this.gameState.players[this.localPlayerId];
      ps.activeSlot = (ps.activeSlot + (dy > 0 ? 1 : -1) + C.HOTBAR_SIZE) % C.HOTBAR_SIZE;
    });

    this.syncRegistry();
  }

  update(_time: number, delta: number): void {
    if (this.gameOver) return;

    if (Phaser.Input.Keyboard.JustDown(this.keys.pause) && !this.scene.isActive('pause')) {
      this.scene.launch('pause');
      return;
    }

    // House regen (1 HP per REGEN_INTERVAL, after REGEN_COOLDOWN of no damage)
    if (this.houseHp > 0 && this.houseHp < C.HOUSE_HP) {
      if (this.houseRegenCooldownMs > 0) {
        this.houseRegenCooldownMs -= delta;
      } else {
        this.houseRegenAccumMs += delta;
        while (this.houseRegenAccumMs >= C.HOUSE_REGEN_INTERVAL_SEC * 1000) {
          this.houseRegenAccumMs -= C.HOUSE_REGEN_INTERVAL_SEC * 1000;
          this.houseHp = Math.min(C.HOUSE_HP, this.houseHp + C.HOUSE_REGEN_HP);
        }
      }
    }

    // Sync world-space house HP bar
    const hpRatio = this.houseHp / C.HOUSE_HP;
    this.houseHpBarFill.setSize(64 * hpRatio, 6);
    this.houseHpBarFill.setFillStyle(
      hpRatio > 0.5 ? 0x22cc44 : hpRatio > 0.25 ? 0xf0a500 : 0xe63946,
    );

    // Day/Night timer
    this.gameState.phaseTimer -= delta / 1000;
    if (this.gameState.phaseTimer <= 0) {
      if (this.gameState.phase === 'day') {
        this.gameState.phase = 'night';
        this.gameState.phaseTimer = C.NIGHT_DURATION_SEC;
        this.gameState.nightNumber += 1;
        this.game.events.emit('night-start', this.gameState.nightNumber);
      } else {
        this.gameState.phase = 'day';
        this.gameState.phaseTimer = C.DAY_DURATION_SEC;
        this.gameState.dayNumber += 1;
        audioManager.sfxDayStart();
        this.game.events.emit('day-start', this.gameState.dayNumber);
      }
    }

    // E key: open/close miner or crafting, in priority order
    if (Phaser.Input.Keyboard.JustDown(this.keys.interact)) {
      if (this.minerOpen) {
        this.minerOpen = false;
        this.activeMiner = null;
      } else if (this.craftingOpen) {
        this.craftingOpen = false;
      } else {
        const nearMiner = this.findNearbyMiner();
        if (nearMiner) {
          this.activeMiner = nearMiner;
          this.minerOpen = true;
        } else {
          const dist = Phaser.Math.Distance.Between(
            this.player.x, this.player.y,
            this.craftingBench.x, this.craftingBench.y,
          );
          if (dist <= C.INTERACT_RANGE) this.craftingOpen = true;
        }
      }
    }

    if (this.craftingOpen || this.minerOpen) {
      // Freeze player while any menu is open
      this.player.setVelocity(0, 0);
    } else {
      const ps = this.gameState.players[this.localPlayerId];
      this.player.setEquipped(ps.hotbar[ps.activeSlot]?.itemId ?? null);

      const facing = this.player.move({
        up:    this.keys.up.isDown,
        down:  this.keys.down.isDown,
        left:  this.keys.left.isDown,
        right: this.keys.right.isDown,
      });

      if (this.attackCooldownMs > 0) this.attackCooldownMs -= delta;

      ps.position.x = this.player.x;
      ps.position.y = this.player.y;
      ps.facing = facing;

      // Hotbar slot switching via 1–8 keys
      const slotKeys = [
        this.keys.slot1, this.keys.slot2, this.keys.slot3, this.keys.slot4,
        this.keys.slot5, this.keys.slot6, this.keys.slot7, this.keys.slot8,
      ];
      slotKeys.forEach((key, i) => {
        if (Phaser.Input.Keyboard.JustDown(key)) ps.activeSlot = i;
      });

      this.pickupItems();
    }

    this.updateEIcons();
    this.tickMiners(delta);
    this.tickEnemies(delta);
    this.syncRegistry();
  }

  /** Auto-collect dropped items within PICKUP_RANGE of the player. */
  private pickupItems(): void {
    const ps = this.gameState.players[this.localPlayerId];
    const toCollect: string[] = [];

    for (const [id, item] of this.droppedItemMap) {
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, item.x, item.y);
      if (dist <= C.PICKUP_RANGE) toCollect.push(id);
    }

    for (const id of toCollect) {
      const item = this.droppedItemMap.get(id)!;
      if (addItem(ps.hotbar, ps.inventory, item.itemId, item.quantity)) {
        delete this.gameState.droppedItems[id];
        item.destroy();
        this.droppedItemMap.delete(id);
      }
    }
  }

  /** Creates the tilemap, ground layer, zoom, camera and world bounds. */
  private buildMap(): void {
    const map = this.make.tilemap({ key: 'map' });
    const tileset = map.addTilesetImage('TilesetFloor', 'TilesetFloor');
    if (!tileset) { console.error('GameScene: failed to add TilesetFloor tileset'); return; }

    const groundLayer = map.createLayer('ground', tileset, 0, 0);
    if (!groundLayer) { console.error('GameScene: failed to create ground layer'); return; }
    groundLayer.setDepth(C.DEPTH_GROUND);
    this.groundLayer = groundLayer;

    const mapW = map.widthInPixels;
    const mapH = map.heightInPixels;

    this.cameras.main.setZoom(C.CAMERA_ZOOM);
    this.cameras.main.setBounds(0, 0, mapW, mapH);
    this.cameras.main.roundPixels = true;
    this.physics.world.setBounds(0, 0, mapW, mapH);
  }

  /** Scatter trees and rocks randomly — different layout every run. */
  private spawnResourceNodes(): void {
    const CELL = 80;
    const CLEAR_SQ = 220 * 220;
    const mapSize = C.MAP_WIDTH_TILES * C.TILE_SIZE;

    for (let cx = CELL / 2; cx < mapSize; cx += CELL) {
      for (let cy = CELL / 2; cy < mapSize; cy += CELL) {
        const dx = cx - C.PLAYER_SPAWN.x;
        const dy = cy - C.PLAYER_SPAWN.y;
        if (dx * dx + dy * dy < CLEAR_SQ) continue;

        const h = Math.random() * 100;
        let type: ResourceType | null = null;
        if      (h < 8)  type = 'tree';
        else if (h < 14) type = 'rock';
        else if (h < 16) type = 'iron_ore_node';
        else if (h < 17) type = 'copper_ore_node';

        if (type) {
          const jx = (Math.random() - 0.5) * (CELL - C.TILE_SIZE * 2);
          const jy = (Math.random() - 0.5) * (CELL - C.TILE_SIZE * 2);
          const node = new ResourceNode(this, cx + jx, cy + jy, type);
          this.resourceGroup.add(node, true);
        }
      }
    }
  }

  /** Show/hide E-key hints above interactables based on player proximity. */
  private updateEIcons(): void {
    const menuOpen = this.craftingOpen || this.minerOpen;
    const px = this.player.x, py = this.player.y;

    const benchDist = Phaser.Math.Distance.Between(px, py, this.craftingBench.x, this.craftingBench.y);
    this.benchEIcon.setVisible(!menuOpen && benchDist <= C.INTERACT_RANGE);

    for (const miner of this.miners) {
      const dist = Phaser.Math.Distance.Between(px, py, miner.x, miner.y);
      miner.eIcon.setVisible(!menuOpen && dist <= C.INTERACT_RANGE);
    }
  }

  /**
   * Place an AutoMiner on the nearest ore node within INTERACT_RANGE of the click.
   * The ore node's sprite is hidden; the miner sits on top of it.
   */
  private placeAutoMiner(wx: number, wy: number): void {
    const ps = this.gameState.players[this.localPlayerId];
    const node = this.findNearestOreNode(wx, wy);
    if (!node) return;
    if (!removeItem(ps.hotbar, ps.inventory, 'auto_miner', 1)) return;
    // Remove from resource group so player can't manually mine it while the miner is running
    this.resourceGroup.remove(node, false, false);
    const miner = new AutoMiner(this, node);
    this.buildingGroup.add(miner, false);
    this.miners.push(miner);
    this.syncRegistry();
  }

  /** Returns the nearest iron/copper ore node within INTERACT_RANGE of (wx, wy), or null. */
  private findNearestOreNode(wx: number, wy: number): ResourceNode | null {
    let best: ResourceNode | null = null;
    let bestDist: number = C.INTERACT_RANGE;
    for (const child of this.resourceGroup.getChildren()) {
      const node = child as ResourceNode;
      if (node.resourceType !== 'iron_ore_node' && node.resourceType !== 'copper_ore_node') continue;
      const dist = Phaser.Math.Distance.Between(wx, wy, node.x, node.y);
      if (dist < bestDist) { bestDist = dist; best = node; }
    }
    return best;
  }

  /** Returns the nearest AutoMiner within INTERACT_RANGE of the player, or null. */
  private findNearbyMiner(): AutoMiner | null {
    let best: AutoMiner | null = null;
    let bestDist: number = C.INTERACT_RANGE;
    for (const miner of this.miners) {
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, miner.x, miner.y);
      if (dist < bestDist) { bestDist = dist; best = miner; }
    }
    return best;
  }

  /** Tick all placed auto miners; handle drops and ore depletion. */
  private tickMiners(delta: number): void {
    const toRemove: AutoMiner[] = [];
    for (const miner of this.miners) {
      if (!miner.tick(delta)) continue;
      const result = miner.targetNode.hit();
      if (result.drops.length > 0) this.spawnDrops(miner.x, miner.y, result.drops);
      if (result.destroyed) {
        this.destroyMinedNode(miner);
        toRemove.push(miner);
      }
    }
    for (const m of toRemove) {
      this.buildingGroup.remove(m, true, true);
      this.miners.splice(this.miners.indexOf(m), 1);
    }
  }

  /** Called when an AutoMiner fully depletes its ore node. Schedules respawn. */
  private destroyMinedNode(miner: AutoMiner): void {
    const node = miner.targetNode;
    const wx = node.x, wy = node.y, type = node.resourceType;
    const tileX = Math.floor(wx / C.TILE_SIZE);
    const tileY = Math.floor(wy / C.TILE_SIZE);
    const tile = this.groundLayer.getTileAt(tileX, tileY);
    const originalGid = tile ? tile.index : 276;

    node.destroy();
    this.groundLayer.putTileAt(CLEARED_GID, tileX, tileY);
    this.time.delayedCall(RESPAWN_MS, () => {
      this.groundLayer.putTileAt(originalGid, tileX, tileY);
      const respawned = new ResourceNode(this, wx, wy, type);
      this.resourceGroup.add(respawned, false);
    });
  }

  /** Hits the nearest enemy or resource node within melee range, preferring enemies. */
  private doMeleeAttack(): void {
    if (this.attackCooldownMs > 0) return;
    this.attackCooldownMs = C.PUNCH_INTERVAL_MS;

    let nearestDist = C.INTERACT_RANGE + 1;
    let nearestEnemyId: string | null = null;
    let nearestNode: ResourceNode | null = null;

    for (const [id, enemy] of this.activeEnemies) {
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y);
      if (dist < nearestDist) { nearestDist = dist; nearestEnemyId = id; nearestNode = null; }
    }

    for (const child of this.resourceGroup.getChildren()) {
      const node = child as ResourceNode;
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, node.x, node.y);
      if (dist < nearestDist) { nearestDist = dist; nearestNode = node; nearestEnemyId = null; }
    }

    if (nearestEnemyId) {
      audioManager.sfxMeleeAttack();
      this.player.playAttackAnim('player-knife-interact');
      const ps2 = this.gameState.players[this.localPlayerId];
      const activeItem = ps2.hotbar[ps2.activeSlot];
      const damage = (activeItem ? (ITEMS[activeItem.itemId]?.damage ?? 1) : 1);
      const enemy = this.activeEnemies.get(nearestEnemyId)!;
      if (enemy.takeDamage(damage)) {
        this.killEnemy(nearestEnemyId);
      } else {
        audioManager.sfxEnemyHit();
      }
    } else if (nearestNode) {
      audioManager.sfxMeleeAttack();
      const isRock = nearestNode.resourceType === 'rock'
        || nearestNode.resourceType === 'iron_ore_node'
        || nearestNode.resourceType === 'copper_ore_node';
      this.player.playAttackAnim(isRock ? 'player-pickaxe-interact' : 'player-axe-interact');
      audioManager.sfxGather();
      const result = nearestNode.hit();
      if (result.destroyed) this.destroyNode(nearestNode, result.drops);
      else if (result.drops.length > 0) this.spawnDrops(nearestNode.x, nearestNode.y, result.drops);
    }
  }

  /** Removes a node from the world, replaces its tile with dirt, spawns drops, schedules respawn. */
  private destroyNode(node: ResourceNode, drops: { itemId: string; quantity: number }[]): void {
    const wx = node.x;
    const wy = node.y;
    const type = node.resourceType;
    const tileX = Math.floor(wx / C.TILE_SIZE);
    const tileY = Math.floor(wy / C.TILE_SIZE);

    const tile = this.groundLayer.getTileAt(tileX, tileY);
    const originalGid = tile ? tile.index : 276;

    this.resourceGroup.remove(node, true, true);
    this.groundLayer.putTileAt(CLEARED_GID, tileX, tileY);
    this.spawnDrops(wx, wy, drops);

    this.time.delayedCall(RESPAWN_MS, () => {
      this.groundLayer.putTileAt(originalGid, tileX, tileY);
      const respawned = new ResourceNode(this, wx, wy, type);
      this.resourceGroup.add(respawned, false);
    });
  }

  /** Creates DroppedItem sprites and registers them in GameState. */
  private spawnDrops(x: number, y: number, drops: { itemId: string; quantity: number }[]): void {
    for (const drop of drops) {
      for (let q = 0; q < drop.quantity; q++) {
        const angle = Math.random() * Math.PI * 2;
        const r = 8 + Math.random() * 20;
        const dropX = x + Math.cos(angle) * r;
        const dropY = y + Math.sin(angle) * r;

        const id = crypto.randomUUID();
        this.gameState.droppedItems[id] = { itemId: drop.itemId, quantity: 1, position: { x: dropX, y: dropY } };
        this.droppedItemMap.set(id, new DroppedItem(this, dropX, dropY, drop.itemId, 1));
      }
    }
  }

  /** Move enemies toward player or house, apply damage, cull the dead. */
  private tickEnemies(delta: number): void {
    const ps = this.gameState.players[this.localPlayerId];
    const toKill: string[] = [];

    for (const [id, enemy] of this.activeEnemies) {
      const { playerDmg, houseDmg } = enemy.tick(
        delta,
        ps.position.x, ps.position.y,
        this.house.x,  this.house.y,
      );
      if (playerDmg > 0) {
        ps.hp = Math.max(0, ps.hp - playerDmg);
        audioManager.sfxPlayerHit();
        this.cameras.main.shake(60, 0.002);
      }
      if (houseDmg  > 0) {
        this.houseHp = Math.max(0, this.houseHp - houseDmg);
        this.houseRegenCooldownMs = C.HOUSE_REGEN_COOLDOWN_SEC * 1000;
        this.houseRegenAccumMs = 0;
        const distToHouse = Phaser.Math.Distance.Between(
          ps.position.x, ps.position.y, this.house.x, this.house.y,
        );
        if (distToHouse <= C.HOUSE_AUDIO_RANGE) audioManager.sfxHouseHit();
        if (this.houseHp <= 0) {
          this.gameOver = true;
          this.player.setVelocity(0, 0);
          this.houseHpBarFill.setSize(0, 6);
          audioManager.sfxGameOver();
          this.scene.stop('ui');
          this.scene.start('game-over', {
            nightsSurvived: this.gameState.nightNumber,
            dayReached: this.gameState.dayNumber,
          });
        }
      }
      if (enemy.isDead) toKill.push(id);
    }

    for (const id of toKill) this.killEnemy(id);
  }

  /** Schedule all spawns for a night's wave. */
  private startWave(nightNumber: number): void {
    const wave = this.resolveWave(nightNumber);
    if (!wave) return;

    this.waveTotal = wave.spawns.reduce((s, e) => s + e.count, 0);
    this.waveKilled = 0;
    this.gameState.waveActive = true;
    this.gameState.enemiesRemainingThisWave = this.waveTotal;

    for (const entry of wave.spawns) {
      for (let i = 0; i < entry.count; i++) {
        const delay = entry.spawnDelayMs + i * entry.spawnIntervalMs;
        this.time.delayedCall(delay, () => this.spawnEnemy(entry.enemyId));
      }
    }
  }

  /** Find the wave definition for the given night, scaling if needed. */
  private resolveWave(night: number): WaveDefinition | null {
    const exact = WAVES.find(w => w.night === night);
    if (exact) return exact;

    const base = [...WAVES]
      .filter(w => w.night <= night)
      .sort((a, b) => b.night - a.night)[0]
      ?? WAVES[0];
    if (!base) return null;

    const exp = night - base.night;
    return {
      night,
      spawns: base.spawns.map(s => ({
        ...s,
        count: Math.round(s.count * Math.pow(C.WAVE_BASE_ENEMY_MULTIPLIER, exp)),
        spawnIntervalMs: Math.round(s.spawnIntervalMs * Math.pow(C.WAVE_SPAWN_RATE_MULTIPLIER, exp)),
      })),
    };
  }

  /** Spawn one enemy of the given type outside the camera view. */
  private spawnEnemy(enemyId: string): void {
    const def = ENEMIES[enemyId];
    if (!def) return;

    const ps = this.gameState.players[this.localPlayerId];
    const angle = Math.random() * Math.PI * 2;
    const dist = C.ENEMY_SPAWN_DIST_MIN + Math.random() * (C.ENEMY_SPAWN_DIST_MAX - C.ENEMY_SPAWN_DIST_MIN);
    const x = Phaser.Math.Clamp(
      ps.position.x + Math.cos(angle) * dist,
      C.TILE_SIZE, (C.MAP_WIDTH_TILES - 1) * C.TILE_SIZE,
    );
    const y = Phaser.Math.Clamp(
      ps.position.y + Math.sin(angle) * dist,
      C.TILE_SIZE, (C.MAP_HEIGHT_TILES - 1) * C.TILE_SIZE,
    );

    const id = crypto.randomUUID();
    const enemy = new BaseEnemy(this, x, y, def);
    this.activeEnemies.set(id, enemy);
    this.gameState.enemies[id] = { id, type: enemyId, position: { x, y }, hp: def.hp, maxHp: def.hp };
  }

  /** Remove a dead enemy, spawn its drops, update wave counter. */
  private killEnemy(id: string): void {
    const enemy = this.activeEnemies.get(id);
    if (!enemy) return;
    audioManager.sfxEnemyDeath();
    this.createDeathParticles(enemy.x, enemy.y);
    this.spawnDrops(enemy.x, enemy.y, enemy.getDrops());
    enemy.destroy();
    this.activeEnemies.delete(id);
    delete this.gameState.enemies[id];
    this.waveKilled += 1;
    this.gameState.enemiesRemainingThisWave = Math.max(0, this.waveTotal - this.waveKilled);
    if (this.gameState.enemiesRemainingThisWave === 0) this.gameState.waveActive = false;
  }

  /** Burst of orange-red particles at the enemy's last position. */
  private createDeathParticles(x: number, y: number): void {
    const emitter = this.add.particles(x, y, 'particle', {
      speed:    { min: 40, max: 100 },
      angle:    { min: 0,  max: 360 },
      scale:    { start: 2, end: 0 },
      alpha:    { start: 1, end: 0 },
      lifespan: 400,
      tint:     0xff6633,
      emitting: false,
    });
    emitter.setDepth(C.DEPTH_ENEMIES + 5);
    emitter.explode(10);
    this.time.delayedCall(500, () => { if (emitter.active) emitter.destroy(); });
  }

  /** Writes current GameState values into the shared registry for UIScene to read. */
  private syncRegistry(): void {
    const player = this.gameState.players[this.localPlayerId];
    this.game.registry.set(R.PLAYER_HP,         player.hp);
    this.game.registry.set(R.PLAYER_MAX_HP,      player.maxHp);
    this.game.registry.set(R.INVENTORY,          player.inventory);
    this.game.registry.set(R.HOTBAR,             player.hotbar);
    this.game.registry.set(R.ACTIVE_SLOT,        player.activeSlot);
    this.game.registry.set(R.DAY_NUMBER,         this.gameState.dayNumber);
    this.game.registry.set(R.PHASE,              this.gameState.phase);
    this.game.registry.set(R.PHASE_TIMER,        this.gameState.phaseTimer);
    this.game.registry.set(R.WAVE_ACTIVE,        this.gameState.waveActive);
    this.game.registry.set(R.ENEMIES_REMAINING,  this.gameState.enemiesRemainingThisWave);
    this.game.registry.set(R.NIGHT_NUMBER,       this.gameState.nightNumber);
    this.game.registry.set(R.CRAFTING_OPEN,      this.craftingOpen);
    this.game.registry.set(R.HOUSE_HP,           this.houseHp);
    this.game.registry.set(R.HOUSE_MAX_HP,        C.HOUSE_HP);
    this.game.registry.set(R.MINER_OPEN,         this.minerOpen);
    this.game.registry.set(R.MINER_POWER,        this.activeMiner?.power ?? 0);
    this.game.registry.set(R.MINER_HAS_PICKAXE,  this.activeMiner?.hasPickaxe ?? false);
  }
}
