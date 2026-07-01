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
import { net } from '../systems/NetworkClient';
import { RemotePlayer } from '../entities/RemotePlayer';
import type { GameSnapshot, DroppedItemSnapshot } from '../../shared/packets';
import { AutoMiner, makeEIcon } from '../entities/buildings/AutoMiner';
import { AutoSaw } from '../entities/buildings/AutoSaw';
import { Canon, CANON_DAMAGE, CANON_BALL_SPEED } from '../entities/buildings/Canon';
import { Turret, TURRET_DAMAGE, TURRET_ARROW_SPEED } from '../entities/buildings/Turret';
import { Anvil } from '../entities/buildings/Anvil';
import { doCraft } from '../systems/CraftingSystem';
import { RECIPES } from '../data/recipes';
import { UIScene } from './UIScene';
import { BaseEnemy } from '../entities/enemies/BaseEnemy';
import { ENEMIES, EnemyDefinition } from '../data/enemies';
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
  drop: Phaser.Input.Keyboard.Key;
  ctrl: Phaser.Input.Keyboard.Key;
  inventory: Phaser.Input.Keyboard.Key;
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
  private canonGroup!: Phaser.Physics.Arcade.StaticGroup;
  private craftingBench!: CraftingBench;
  private groundLayer!: Phaser.Tilemaps.TilemapLayer;
  private droppedItemMap = new Map<string, DroppedItem>();
  private goldCursorActive = false;
  private house!: House;
  private houseHpBarFill!: Phaser.GameObjects.Rectangle;
  private houseHpBarFrames: Phaser.GameObjects.Image[] = [];
  private houseHpBarText!: Phaser.GameObjects.Text;
  private houseHp: number = C.HOUSE_HP;
  private houseRegenCooldownMs = 0;
  private houseRegenAccumMs = 0;
  private activeEnemies = new Map<string, BaseEnemy>();
  private enemyGroup!: Phaser.GameObjects.Group;
  private attackCooldownMs = 0;
  private activeArrows: { sprite: Phaser.Physics.Arcade.Image; damage: number }[] = [];
  private dropImmune = new Set<string>();
  private craftingOpen   = false;
  private inventoryOpen  = false;
  private miners: AutoMiner[] = [];
  private activeMiner: AutoMiner | null = null;
  private minerOpen = false;
  private saws: AutoSaw[] = [];
  private activeSaw: AutoSaw | null = null;
  private sawOpen = false;
  private canons: Canon[] = [];
  private activeCanonballs: { sprite: Phaser.Physics.Arcade.Image; damage: number }[] = [];
  private turrets: Turret[] = [];
  private activeTurretArrows: { sprite: Phaser.Physics.Arcade.Image; damage: number }[] = [];
  private turretGroup!: Phaser.Physics.Arcade.StaticGroup;
  private hammerHoveredObj: Phaser.GameObjects.GameObject | null = null;
  private hammerLTarget: Phaser.GameObjects.GameObject | null = null;
  private hammerLCount = 0;
  private hammerRTarget: Phaser.GameObjects.GameObject | null = null;
  private hammerRCount = 0;
  private anvils: Anvil[] = [];
  private activeAnvil: Anvil | null = null;
  private anvilOpen = false;
  private anvilGroup!: Phaser.Physics.Arcade.StaticGroup;
  private activeEnemyProjectiles: { sprite: Phaser.Physics.Arcade.Image; damage: number }[] = [];
  private benchEIcon!: Phaser.GameObjects.Container;
  private houseEIcon!: Phaser.GameObjects.Container;
  private houseOpen = false;
  private waveTotal = 0;
  private waveKilled = 0;
  private gameOver = false;

  // ── Multiplayer ────────────────────────────────────────────────────────────
  private resourceNodeMap  = new Map<string, ResourceNode>(); // nodeId → node
  private placedBuildingIds = new Set<string>();              // ids already spawned locally
  private multiplayer = false;
  private remotePlayerMap = new Map<string, RemotePlayer>();
  private serverDropMap = new Map<string, DroppedItem>();     // server-tracked drops (multiplayer)
  private locallyPickedDropIds = new Set<string>();           // picked up locally, awaiting server ack
  private inputSendAccumMs = 0;
  private onSnapshot!: (packet: { type: 'state-snapshot'; snapshot: GameSnapshot }) => void;
  private onPlayerLeftGame!: (packet: Extract<import('../../shared/packets').ServerPacket, { type: 'player-left' }>) => void;

  private worldSeed = 0;
  // Seeded RNG (mulberry32) — replaced each create() call
  private rng: () => number = Math.random;

  constructor() {
    super({ key: 'game' });
  }

  init(data?: { seed?: number }): void {
    this.worldSeed = data?.seed ?? Math.floor(Math.random() * 0xFFFFFFFF);
    let s = this.worldSeed;
    this.rng = () => {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
    };
  }

  create(): void {
    this.localPlayerId = crypto.randomUUID();
    this.gameState = createInitialState(this.localPlayerId);

    this.anims.create({
      key: 'fx-sword-swing',
      frames: this.anims.generateFrameNumbers('fx-sword-swing', { start: 0, end: 3 }),
      frameRate: 18,
      repeat: 0,
    });

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

    this.enemyGroup = this.add.group();

    this.canonGroup = this.physics.add.staticGroup();
    this.physics.add.collider(this.player,     this.canonGroup);
    this.physics.add.collider(this.enemyGroup, this.canonGroup);

    this.turretGroup = this.physics.add.staticGroup();
    this.physics.add.collider(this.player,     this.turretGroup);
    this.physics.add.collider(this.enemyGroup, this.turretGroup);

    this.anvilGroup = this.physics.add.staticGroup();
    this.physics.add.collider(this.player,     this.anvilGroup);
    this.physics.add.collider(this.enemyGroup, this.anvilGroup);


    // World-space HP bar floating above the house (64px wide × 6px tall, origin top-left)
    // House HP bar — three-piece frame assembled from atlas
    const hby  = C.HOUSE_SPAWN.y - 20;
    const capW = 9, midW = 40, barH = 9;
    const barLeft = C.HOUSE_SPAWN.x - (capW + midW + capW) / 2;
    this.houseHpBarFrames = [
      this.add.image(barLeft + capW / 2,               hby, 'ui-house-hp-frame', 'left')
        .setDisplaySize(capW, barH).setDepth(50).setVisible(false),
      this.add.image(barLeft + capW + midW / 2,        hby, 'ui-house-hp-frame', 'middle')
        .setDisplaySize(midW, barH).setDepth(50).setVisible(false),
      this.add.image(barLeft + capW + midW + capW / 2, hby, 'ui-house-hp-frame', 'right')
        .setDisplaySize(capW, barH).setDepth(50).setVisible(false),
    ];
    this.houseHpBarFill = this.add.rectangle(
      barLeft + capW - 5, hby, midW + 10, 5, 0x22cc44,
    ).setOrigin(0, 0.5).setDepth(51).setVisible(false);
    this.houseHpBarText = this.add.text(C.HOUSE_SPAWN.x, hby - barH - 2, '', {
      fontSize: '15px', color: '#ffffff',
      stroke: '#000000', strokeThickness: 4,
      fontStyle: 'bold',
    }).setOrigin(0.5, 1).setScale(1 / 3).setDepth(52).setVisible(false);

    this.benchEIcon = makeEIcon(this, C.CRAFTING_BENCH_SPAWN.x, C.CRAFTING_BENCH_SPAWN.y);
    this.houseEIcon = makeEIcon(this, C.HOUSE_SPAWN.x, C.HOUSE_SPAWN.y);

    this.cameras.main.startFollow(this.player, true);

    this.keys = this.input.keyboard!.addKeys({
      up:       Phaser.Input.Keyboard.KeyCodes.W,
      down:     Phaser.Input.Keyboard.KeyCodes.S,
      left:     Phaser.Input.Keyboard.KeyCodes.A,
      right:    Phaser.Input.Keyboard.KeyCodes.D,
      interact:  Phaser.Input.Keyboard.KeyCodes.E,
      pause:     Phaser.Input.Keyboard.KeyCodes.ESC,
      drop:      Phaser.Input.Keyboard.KeyCodes.Q,
      ctrl:      Phaser.Input.Keyboard.KeyCodes.CTRL,
      inventory: Phaser.Input.Keyboard.KeyCodes.R,
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

    this.game.events.on('select-hotbar-slot', (i: number) => {
      const ps = this.gameState.players[this.localPlayerId];
      ps.activeSlot = i;
      this.syncRegistry();
    });

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) {
        if (this.craftingOpen || this.minerOpen || this.sawOpen || this.anvilOpen || this.inventoryOpen || this.houseOpen) return;
        const ps = this.gameState.players[this.localPlayerId];
        const activeItem = ps.hotbar[ps.activeSlot];
        if (activeItem?.itemId === 'repair_hammer') {
          const rwp = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
          this.doHammerRight(rwp.x, rwp.y);
          return;
        }
        if (activeItem?.itemId === 'blueberry') {
          const healAmt = Math.min(5, ps.maxHp - ps.hp);
          if (healAmt > 0) {
            ps.hp = Math.min(ps.maxHp, ps.hp + 5);
            this.spawnHealNumber(this.player.x, this.player.y, 5);
          }
          activeItem.quantity -= 1;
          if (activeItem.quantity <= 0) ps.hotbar[ps.activeSlot] = null;
          this.syncRegistry();
        }
        return;
      }
      if (!pointer.leftButtonDown() || this.craftingOpen || this.minerOpen || this.sawOpen || this.anvilOpen || this.inventoryOpen || this.houseOpen) return;
      const ps = this.gameState.players[this.localPlayerId];
      const activeItem = ps.hotbar[ps.activeSlot];
      const wp = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      if (activeItem?.itemId === 'auto_miner') {
        this.placeAutoMiner(wp.x, wp.y);
      } else if (activeItem?.itemId === 'saw') {
        this.placeAutoSaw(wp.x, wp.y);
      } else if (activeItem?.itemId === 'canon') {
        this.placeCanon(wp.x, wp.y);
      } else if (activeItem?.itemId === 'turret') {
        this.placeTurret(wp.x, wp.y);
      } else if (activeItem?.itemId === 'crafting_bench') {
        this.placeCraftingBench(wp.x, wp.y);
      } else if (activeItem?.itemId === 'acorn') {
        this.placeAcorn(wp.x, wp.y);
      } else if (activeItem?.itemId === 'blueberry_seed') {
        this.placeBlueberrySeed(wp.x, wp.y);
      } else if (activeItem?.itemId === 'anvil') {
        this.placeAnvil(wp.x, wp.y);
      } else if (activeItem?.itemId === 'repair_hammer') {
        this.doHammerLeft(wp.x, wp.y);
      } else if (activeItem?.itemId === 'bow') {
        this.doRangedAttack(wp.x, wp.y);
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

    this.game.events.on('close-anvil', () => {
      this.anvilOpen   = false;
      this.activeAnvil = null;
      this.syncRegistry();
    }, this);

    this.game.events.on('close-house', () => {
      this.houseOpen = false;
      this.syncRegistry();
    }, this);

    this.game.events.on('house-upgrade', () => {
      const ps = this.gameState.players[this.localPlayerId];
      if (this.gameState.houseLevel >= 2 || ps.coins < 20) return;
      ps.coins -= 20;
      this.gameState.houseLevel = 2;
      this.syncRegistry();
    }, this);

    this.game.events.on('skill-upgrade', (skill: string) => {
      const ps = this.gameState.players[this.localPlayerId];
      if (ps.coins < 30) return;
      if (skill === 'speed' && ps.skillSpeed < 2) {
        ps.coins -= 30;
        ps.skillSpeed = 2;
        ps.speed = C.PLAYER_SPEED + 15;
        this.player.speed = ps.speed;
      } else if (skill === 'strength' && ps.skillStrength < 2) {
        ps.coins -= 30;
        ps.skillStrength = 2;
        ps.strength = 5;
      } else if (skill === 'defence' && ps.skillDefence < 2) {
        ps.coins -= 30;
        ps.skillDefence = 2;
        ps.armor = 5;
      }
      this.syncRegistry();
    }, this);

    this.game.events.on('item-move', ({
      from, to,
    }: {
      from: { type: 'inventory' | 'hotbar' | 'equipment'; idx: number };
      to:   { type: 'inventory' | 'hotbar' | 'equipment'; idx: number };
    }) => {
      const ps = this.gameState.players[this.localPlayerId];
      const getArr = (t: string) =>
        t === 'inventory' ? ps.inventory : t === 'hotbar' ? ps.hotbar : ps.equipment;
      const src = getArr(from.type);
      const dst = getArr(to.type);
      if (from.idx < 0 || from.idx >= src.length) return;
      if (to.idx   < 0 || to.idx   >= dst.length) return;
      [src[from.idx], dst[to.idx]] = [dst[to.idx], src[from.idx]];
      this.syncRegistry();
    }, this);

    this.game.events.on('add-miner-fuel', () => {
      if (!this.activeMiner) return;
      const ps = this.gameState.players[this.localPlayerId];
      if (removeItem(ps.hotbar, ps.inventory, 'battery', 1)) {
        this.activeMiner.addFuel(1);
        this.syncRegistry();
      }
    }, this);

    this.game.events.on('take-miner-output', () => {
      if (!this.activeMiner) return;
      const output = this.activeMiner.getOutput();
      if (!output) return;
      const ps = this.gameState.players[this.localPlayerId];
      if (addItem(ps.hotbar, ps.inventory, output.itemId, output.quantity)) {
        this.activeMiner.clearOutput();
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

    this.game.events.on('add-saw-fuel', () => {
      if (!this.activeSaw) return;
      const ps = this.gameState.players[this.localPlayerId];
      if (removeItem(ps.hotbar, ps.inventory, 'battery', 1)) {
        this.activeSaw.addFuel(1);
        this.syncRegistry();
      }
    }, this);

    this.game.events.on('take-saw-output', () => {
      if (!this.activeSaw) return;
      const output = this.activeSaw.getOutput();
      if (!output) return;
      const ps = this.gameState.players[this.localPlayerId];
      if (addItem(ps.hotbar, ps.inventory, output.itemId, output.quantity)) {
        this.activeSaw.clearOutput();
        this.syncRegistry();
      }
    }, this);

    this.game.events.on('toggle-saw-axe', () => {
      if (!this.activeSaw) return;
      const ps = this.gameState.players[this.localPlayerId];
      if (this.activeSaw.hasAxe) {
        this.activeSaw.hasAxe = false;
        addItem(ps.hotbar, ps.inventory, 'stone_axe', 1);
      } else {
        if (removeItem(ps.hotbar, ps.inventory, 'stone_axe', 1)) {
          this.activeSaw.hasAxe = true;
        }
      }
      this.syncRegistry();
    }, this);

    this.game.events.on('close-saw', () => {
      this.sawOpen = false;
      this.activeSaw = null;
      this.syncRegistry();
    }, this);

    this.game.events.on('night-start', (nightNumber: number) => {
      audioManager.sfxNightStart();
      if (!this.multiplayer) this.startWave(nightNumber);
    }, this);

    this.game.events.on('skip-to-night', () => {
      if (this.gameState.phase !== 'day') return;
      this.gameState.phase = 'night';
      this.gameState.phaseTimer = C.NIGHT_DURATION_SEC;
      this.gameState.nightNumber += 1;
      this.game.events.emit('night-start', this.gameState.nightNumber);
      this.syncRegistry();
    }, this);

    this.input.on('wheel', (_ptr: unknown, _gos: unknown, _dx: number, dy: number) => {
      if (this.craftingOpen || this.anvilOpen || this.houseOpen) return;
      const ps = this.gameState.players[this.localPlayerId];
      ps.activeSlot = (ps.activeSlot + (dy > 0 ? 1 : -1) + C.HOTBAR_SIZE) % C.HOTBAR_SIZE;
    });

    // ── Multiplayer setup ────────────────────────────────────────────────────
    if (net.isConnected) {
      this.multiplayer = true;
      const oldId = this.localPlayerId;
      this.localPlayerId = net.playerId ?? oldId;

      // Re-key the player state so syncRegistry can find it by server ID
      if (this.localPlayerId !== oldId) {
        const ps = this.gameState.players[oldId];
        if (ps) {
          ps.id = this.localPlayerId;
          ps.playerId = this.localPlayerId;
          this.gameState.players[this.localPlayerId] = ps;
          delete this.gameState.players[oldId];
        }
      }

      RemotePlayer.registerAnims(this.anims);

      this.onSnapshot = (packet) => this.applySnapshot(packet.snapshot);
      net.on('state-snapshot', this.onSnapshot);

      // Immediately remove a remote player sprite when they disconnect
      this.onPlayerLeftGame = (packet) => {
        const rp = this.remotePlayerMap.get(packet.playerId);
        if (rp) { rp.destroy(); this.remotePlayerMap.delete(packet.playerId); }
      };
      net.on('player-left', this.onPlayerLeftGame);

      this.events.on('shutdown', () => {
        net.off('state-snapshot', this.onSnapshot);
        net.off('player-left',    this.onPlayerLeftGame);
        this.remotePlayerMap.forEach(rp => rp.destroy());
        this.remotePlayerMap.clear();
      });
    }

    // Natural enemies (e.g. bear) spawn with the map and top themselves back up over
    // time. Solo-only for now — multiplayer enemies are authoritative on the server.
    if (!this.multiplayer) {
      this.spawnNaturalEnemies();
      for (const def of Object.values(ENEMIES)) {
        if (!def.isNatural) continue;
        this.time.addEvent({
          delay: def.respawnIntervalMs ?? 180000,
          loop: true,
          callback: () => this.spawnNaturalEnemy(def.id),
        });
      }
    }

    this.syncRegistry();
  }

  update(_time: number, delta: number): void {
    if (this.gameOver) return;

    if (Phaser.Input.Keyboard.JustDown(this.keys.pause) && !this.scene.isActive('pause')) {
      this.scene.launch('pause');
      this.scene.pause();
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

    // Sync world-space house HP bar — only show when damaged
    const hpRatio = this.houseHp / C.HOUSE_HP;
    const barVisible = hpRatio < 1;
    this.houseHpBarFill.setVisible(barVisible);
    this.houseHpBarFrames.forEach(f => f.setVisible(barVisible));
    this.houseHpBarText.setVisible(barVisible);
    if (barVisible) this.houseHpBarText.setText(`${Math.ceil(this.houseHp)} / ${C.HOUSE_HP}`);
    this.houseHpBarFill.setSize(50 * hpRatio, 5);
    this.houseHpBarFill.setFillStyle(
      hpRatio > 0.5 ? 0x22cc44 : hpRatio > 0.25 ? 0xf0a500 : 0xe63946,
    );

    // Day/Night timer — only run locally in solo; multiplayer uses server snapshots
    if (!this.multiplayer) this.gameState.phaseTimer -= delta / 1000;
    if (!this.multiplayer && this.gameState.phaseTimer <= 0) {
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

    // E key: open/close saw / miner / crafting / house, in priority order
    if (Phaser.Input.Keyboard.JustDown(this.keys.interact)) {
      if (this.houseOpen) {
        this.houseOpen = false;
      } else if (this.sawOpen) {
        this.sawOpen = false;
        this.activeSaw = null;
      } else if (this.minerOpen) {
        this.minerOpen = false;
        this.activeMiner = null;
      } else if (this.anvilOpen) {
        this.anvilOpen   = false;
        this.activeAnvil = null;
      } else if (this.craftingOpen) {
        this.craftingOpen = false;
      } else {
        const nearSaw = this.findNearbySaw();
        if (nearSaw) {
          this.activeSaw = nearSaw;
          this.sawOpen = true;
        } else {
          const nearMiner = this.findNearbyMiner();
          if (nearMiner) {
            this.activeMiner = nearMiner;
            this.minerOpen = true;
          } else {
            const nearAnvil = this.findNearbyAnvil();
            if (nearAnvil) {
              this.activeAnvil = nearAnvil;
              this.anvilOpen   = true;
            } else {
              const benchDist = this.craftingBench.active
                ? Phaser.Math.Distance.Between(this.player.x, this.player.y, this.craftingBench.x, this.craftingBench.y)
                : Infinity;
              if (benchDist <= C.INTERACT_RANGE) {
                this.craftingOpen = true;
              } else {
                const houseDist = Phaser.Math.Distance.Between(
                  this.player.x, this.player.y,
                  this.house.x, this.house.y,
                );
                if (houseDist <= C.INTERACT_RANGE) this.houseOpen = true;
              }
            }
          }
        }
      }
      this.syncRegistry();
    }

    // I key: toggle inventory
    if (Phaser.Input.Keyboard.JustDown(this.keys.inventory)) {
      this.inventoryOpen = !this.inventoryOpen;
      this.syncRegistry();
    }

    if (this.craftingOpen || this.minerOpen || this.sawOpen || this.anvilOpen || this.houseOpen) {
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

      if (Phaser.Input.Keyboard.JustDown(this.keys.drop)) {
        this.dropActiveItem(this.keys.ctrl.isDown);
      }

      this.pickupItems();
    }

    // Send inputs to server in multiplayer mode (throttled to ~20/sec)
    if (this.multiplayer) {
      this.inputSendAccumMs += delta;
      if (this.inputSendAccumMs >= 50) {
        this.inputSendAccumMs = 0;
        const ps = this.gameState.players[this.localPlayerId];
        net.send({
          type: 'input',
          keys: {
            up:    this.keys.up.isDown,
            down:  this.keys.down.isDown,
            left:  this.keys.left.isDown,
            right: this.keys.right.isDown,
          },
          pointerWorld: { x: this.input.activePointer.worldX, y: this.input.activePointer.worldY },
          facing: ps.facing,
          action: null,
          position: { x: this.player.x, y: this.player.y },
          attackAnim: null,
        });
      }
    }

    this.updateEIcons();
    this.updateBuildPreview();
    this.updateHammerHighlight();
    this.updateGoldCursor();
    this.tickMiners(delta);
    this.tickSaws(delta);
    this.tickCanons(delta);
    this.tickTurrets(delta);
    this.tickAnvils();
    if (this.multiplayer) {
      this.activeEnemies.forEach(e => e.tickMultiplayer(delta));
    } else {
      this.tickEnemies(delta);
    }
    this.tickArrows();
    this.tickCanonballs();
    this.tickTurretArrows();
    this.tickEnemyProjectiles();
    if (this.multiplayer) this.remotePlayerMap.forEach(rp => rp.tick(delta));
    this.syncRegistry();
  }

  /** Auto-collect dropped items within PICKUP_RANGE of the player. */
  private pickupItems(): void {
    const ps = this.gameState.players[this.localPlayerId];
    const toCollect: string[] = [];

    for (const [id, item] of this.droppedItemMap) {
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, item.x, item.y);
      if (this.dropImmune.has(id)) {
        if (dist > C.PICKUP_RANGE) this.dropImmune.delete(id);
        continue;
      }
      if (dist <= C.PICKUP_RANGE) toCollect.push(id);
    }

    for (const id of toCollect) {
      const item = this.droppedItemMap.get(id)!;
      const picked = item.itemId === 'coin'
        ? (ps.coins += item.quantity, true)
        : addItem(ps.hotbar, ps.inventory, item.itemId, item.quantity);
      if (picked) {
        delete this.gameState.droppedItems[id];
        item.destroy();
        this.droppedItemMap.delete(id);
        this.dropImmune.delete(id);
        if (this.multiplayer && this.serverDropMap.has(id)) {
          this.serverDropMap.delete(id);
          this.locallyPickedDropIds.add(id);
          this.sendAction({ kind: 'pickup-drop', dropId: id });
        }
      }
    }
  }

  /** Creates the tilemap, ground layer, zoom, camera and world bounds. */
  private buildMap(): void {
    const map = this.make.tilemap({ key: 'map' });
    const tileset = map.addTilesetImage('TilesetFloor', 'TilesetFloor');
    if (!tileset) { console.error('GameScene: failed to add TilesetFloor tileset'); return; }
    const forestTileset = map.addTilesetImage('TilesetForest', 'TilesetForest');
    const floraTileset  = map.addTilesetImage('TilesetFlora',  'TilesetFlora');

    const groundLayer = map.createLayer('ground', tileset, 0, 0);
    if (!groundLayer) { console.error('GameScene: failed to create ground layer'); return; }
    groundLayer.setDepth(C.DEPTH_GROUND);
    this.groundLayer = groundLayer;

    if (forestTileset) {
      const forestLayer = map.createLayer('forest-ground', [tileset, forestTileset], 0, 0);
      if (forestLayer) forestLayer.setDepth(C.DEPTH_GROUND + 1);
    }
    if (floraTileset) {
      const floraLayer = map.createLayer('flora-ground', [tileset, floraTileset], 0, 0);
      if (floraLayer) floraLayer.setDepth(C.DEPTH_GROUND + 1);
    }

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
    let nodeIdx = 0;

    const occupiedPositions: { x: number; y: number }[] = [];

    for (let cx = CELL / 2; cx < mapSize; cx += CELL) {
      for (let cy = CELL / 2; cy < mapSize; cy += CELL) {
        const dx = cx - C.PLAYER_SPAWN.x;
        const dy = cy - C.PLAYER_SPAWN.y;
        if (dx * dx + dy * dy < CLEAR_SQ) continue;

        const h = this.rng() * 100;
        let type: ResourceType | null = null;
        const inForest = cy < C.FOREST_BIOME_ROWS * C.TILE_SIZE;
        const inFlora  = cy > (C.MAP_HEIGHT_TILES - C.FLORA_BIOME_ROWS) * C.TILE_SIZE;
        if      (h < 8)  type = inForest ? 'forest_tree' : inFlora ? 'flora_tree' : 'tree';
        else if (h < 14) type = 'rock';
        else if (h < 16) type = 'iron_ore_node';
        else if (h < 17) type = 'copper_ore_node';
        else if (h < 22 && inFlora) type = 'gold_node';

        if (type) {
          const jx = (this.rng() - 0.5) * (CELL - C.TILE_SIZE * 2);
          const jy = (this.rng() - 0.5) * (CELL - C.TILE_SIZE * 2);
          const nx = cx + jx, ny = cy + jy;
          const node = new ResourceNode(this, nx, ny, type);
          const nodeId = `n${nodeIdx++}`;
          node.setName(nodeId);
          this.resourceNodeMap.set(nodeId, node);
          this.resourceGroup.add(node, true);
          occupiedPositions.push({ x: nx, y: ny });
        }
      }
    }

    // Bush decorations — skip cells too close to an existing resource
    const BUSH_CELL = 48;
    const BUSH_CLEAR_SQ = 260 * 260;
    const BUSH_EXCL_SQ  = 40 * 40;
    for (let cx = BUSH_CELL / 2; cx < mapSize; cx += BUSH_CELL) {
      for (let cy = BUSH_CELL / 2; cy < mapSize; cy += BUSH_CELL) {
        const dx = cx - C.PLAYER_SPAWN.x;
        const dy = cy - C.PLAYER_SPAWN.y;
        if (dx * dx + dy * dy < BUSH_CLEAR_SQ) continue;
        if (this.rng() > 0.25) continue;
        const jx = (this.rng() - 0.5) * (BUSH_CELL - C.TILE_SIZE);
        const jy = (this.rng() - 0.5) * (BUSH_CELL - C.TILE_SIZE);
        const bx = cx + jx, by = cy + jy;
        const tooClose = occupiedPositions.some(p => {
          const ex = bx - p.x, ey = by - p.y;
          return ex * ex + ey * ey < BUSH_EXCL_SQ;
        });
        if (tooClose) continue;
        const inForestBush = cy < C.FOREST_BIOME_ROWS * C.TILE_SIZE;
        const type = this.rng() < 0.3 ? 'blueberry_bush' : inForestBush ? 'forest_bush' : 'bush';
        const bush = new ResourceNode(this, bx, by, type);
        const bushId = `n${nodeIdx++}`;
        bush.setName(bushId);
        this.resourceNodeMap.set(bushId, bush);
        this.resourceGroup.add(bush, false);
      }
    }
  }

  private updateGoldCursor(): void {
    const ps = this.gameState.players[this.localPlayerId];
    const hasPickaxe = ps?.hotbar[ps.activeSlot]?.itemId === 'stone_pickaxe';

    let showBlocked = false;
    if (!hasPickaxe) {
      const wp = this.cameras.main.getWorldPoint(this.input.activePointer.x, this.input.activePointer.y);
      for (const child of this.resourceGroup.getChildren()) {
        const node = child as ResourceNode;
        if (node.resourceType !== 'gold_node') continue;
        const body = node.body as Phaser.Physics.Arcade.StaticBody;
        if (Math.abs(wp.x - node.x) <= body.halfWidth && Math.abs(wp.y - node.y) <= body.halfHeight) { showBlocked = true; break; }
      }
    }

    if (showBlocked === this.goldCursorActive) return;
    this.goldCursorActive = showBlocked;
    this.game.canvas.style.cursor = showBlocked
      ? "url('/assets/AssetPack2/UI%20Elements/UI%20Elements/Cursors/Cursor_03.png') 32 32, not-allowed"
      : '';
  }

  /** Show/hide E-key hints above interactables based on player proximity. */
  private updateEIcons(): void {
    const menuOpen = this.craftingOpen || this.minerOpen || this.sawOpen || this.anvilOpen || this.inventoryOpen || this.houseOpen;
    const px = this.player.x, py = this.player.y;

    const benchDist = this.craftingBench.active
      ? Phaser.Math.Distance.Between(px, py, this.craftingBench.x, this.craftingBench.y)
      : Infinity;
    this.benchEIcon.setVisible(!menuOpen && benchDist <= C.INTERACT_RANGE);

    const houseDist = Phaser.Math.Distance.Between(px, py, this.house.x, this.house.y);
    this.houseEIcon.setVisible(!menuOpen && houseDist <= C.INTERACT_RANGE);

    for (const miner of this.miners) {
      const dist = Phaser.Math.Distance.Between(px, py, miner.x, miner.y);
      miner.eIcon.setVisible(!menuOpen && dist <= C.INTERACT_RANGE);
    }

    for (const saw of this.saws) {
      const dist = Phaser.Math.Distance.Between(px, py, saw.x, saw.y);
      saw.eIcon.setVisible(!menuOpen && dist <= C.INTERACT_RANGE);
    }

    for (const anvil of this.anvils) {
      const dist = Phaser.Math.Distance.Between(px, py, anvil.x, anvil.y);
      anvil.eIcon.setVisible(!menuOpen && dist <= C.INTERACT_RANGE);
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
    this.notifyBuildingPlaced('auto-miner', node.x, node.y, node.name || undefined);
    this.sound.play('sfx-place-build', { volume: 0.7 });
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

  /** Tick all placed auto miners; accumulate output and handle ore depletion. */
  private tickMiners(delta: number): void {
    const toRemove: AutoMiner[] = [];
    for (const miner of this.miners) {
      if (!miner.tick(delta)) continue;
      const result = miner.targetNode.hit();
      for (const drop of result.drops) miner.addOutput(drop);
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

  private placeAutoSaw(wx: number, wy: number): void {
    const ps = this.gameState.players[this.localPlayerId];
    const node = this.findNearestTree(wx, wy);
    if (!node) return;
    if (!removeItem(ps.hotbar, ps.inventory, 'saw', 1)) return;
    this.resourceGroup.remove(node, false, false);
    const saw = new AutoSaw(this, node);
    this.buildingGroup.add(saw, false);
    this.saws.push(saw);
    this.notifyBuildingPlaced('auto-saw', node.x, node.y, node.name || undefined);
    this.sound.play('sfx-place-build', { volume: 0.7 });
    this.syncRegistry();
  }

  private findNearestTree(wx: number, wy: number): ResourceNode | null {
    let best: ResourceNode | null = null;
    let bestDist: number = C.INTERACT_RANGE;
    for (const child of this.resourceGroup.getChildren()) {
      const node = child as ResourceNode;
      if (node.resourceType !== 'tree' && node.resourceType !== 'forest_tree' && node.resourceType !== 'flora_tree') continue;
      const dist = Phaser.Math.Distance.Between(wx, wy, node.x, node.y);
      if (dist < bestDist) { bestDist = dist; best = node; }
    }
    return best;
  }

  private placeAnvil(wx: number, wy: number): void {
    if (!this.canPlaceBuilding(wx, wy)) return;
    const ps = this.gameState.players[this.localPlayerId];
    if (!removeItem(ps.hotbar, ps.inventory, 'anvil', 1)) return;
    const anvil = new Anvil(this, wx, wy);
    this.anvils.push(anvil);
    this.anvilGroup.add(anvil, false);
    this.notifyBuildingPlaced('anvil', wx, wy);
    this.sound.play('sfx-place-build', { volume: 0.7 });
    this.syncRegistry();
  }

  private get ui(): UIScene { return this.scene.get('ui') as UIScene; }

  private updateBuildPreview(): void {
    const ps = this.gameState.players[this.localPlayerId];
    if (!ps) return;
    const activeItem = ps.hotbar[ps.activeSlot];
    const menuOpen = this.craftingOpen || this.minerOpen || this.sawOpen || this.anvilOpen || this.inventoryOpen || this.houseOpen;
    const ptr = this.input.activePointer;
    const z = C.CAMERA_ZOOM;
    // Always derive world coords from GameScene's own camera so UIScene's
    // zoom-1 camera doesn't overwrite pointer.worldX/worldY before we read it.
    const wp = this.cameras.main.getWorldPoint(ptr.x, ptr.y);

    if (!menuOpen && activeItem?.itemId === 'acorn') {
      this.ui.showBuildPreview('node-tree-stump', 90 * z, 120 * z, ptr.x, ptr.y, this.canPlaceAcorn(wp.x, wp.y));
    } else if (!menuOpen && activeItem?.itemId === 'blueberry_seed') {
      this.ui.showBuildPreview('decor-blueberry-bush-empty', 24 * z, 16 * z, ptr.x, ptr.y, this.canPlaceBuilding(wp.x, wp.y));
    } else if (!menuOpen && activeItem?.itemId === 'turret') {
      this.ui.showBuildPreview('turret', 40 * z, 50 * z, ptr.x, ptr.y, this.canPlaceBuilding(wp.x, wp.y));
    } else if (!menuOpen && activeItem?.itemId === 'canon') {
      this.ui.showBuildPreview('canon1-f2', 36 * z, 44 * z, ptr.x, ptr.y, this.canPlaceCanon(wp.x, wp.y));
    } else if (!menuOpen && activeItem?.itemId === 'anvil') {
      this.ui.showBuildPreview('building-anvil', 30 * z, 18 * z, ptr.x, ptr.y, this.canPlaceBuilding(wp.x, wp.y));
    } else if (!menuOpen && activeItem?.itemId === 'crafting_bench') {
      const sz = C.TILE_SIZE * 2 * z;
      this.ui.showBuildPreview('building-crafting-bench', sz, sz, ptr.x, ptr.y, this.canPlaceBuilding(wp.x, wp.y));
    } else {
      this.ui.hideBuildPreview();
    }
  }

  private tickAnvils(): void {
    const toRemove: Anvil[] = [];
    for (const anvil of this.anvils) {
      if (anvil.isDead) toRemove.push(anvil);
    }
    for (const anvil of toRemove) {
      this.anvilGroup.remove(anvil, true, true);
      this.anvils.splice(this.anvils.indexOf(anvil), 1);
    }
  }

  private findNearestBuildingAt(wx: number, wy: number): Phaser.GameObjects.GameObject | null {
    let best: Phaser.GameObjects.GameObject | null = null;
    let bestDist = C.INTERACT_RANGE + 1;
    const check = (obj: Phaser.GameObjects.GameObject & { x: number; y: number }) => {
      const d = Phaser.Math.Distance.Between(wx, wy, obj.x, obj.y);
      if (d < bestDist) { bestDist = d; best = obj; }
    };
    for (const c of this.canons)  if (!c.isDead) check(c);
    for (const t of this.turrets) if (!t.isDead) check(t);
    for (const a of this.anvils)  if (!a.isDead) check(a);
    for (const m of this.miners)  check(m);
    for (const s of this.saws)    check(s);
    if (this.craftingBench.active) check(this.craftingBench);
    check(this.house);
    return best;
  }

  private updateHammerHighlight(): void {
    const ps = this.gameState.players[this.localPlayerId];
    const isHammer = ps.hotbar[ps.activeSlot]?.itemId === 'repair_hammer';
    const menuOpen = this.craftingOpen || this.minerOpen || this.sawOpen || this.anvilOpen || this.inventoryOpen || this.houseOpen;

    if (!isHammer || menuOpen) {
      if (this.hammerHoveredObj?.active) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (this.hammerHoveredObj as any).setAlpha(1);
      }
      this.hammerHoveredObj = null;
      this.hammerLTarget = null; this.hammerLCount = 0;
      this.hammerRTarget = null; this.hammerRCount = 0;
      return;
    }

    const ptr = this.input.activePointer;
    const nearest = this.findNearestBuildingAt(ptr.worldX, ptr.worldY);

    if (nearest !== this.hammerHoveredObj) {
      if (this.hammerHoveredObj?.active) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (this.hammerHoveredObj as any).setAlpha(1);
      }
      this.hammerHoveredObj = nearest;
      if (nearest?.active) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (nearest as any).setAlpha(0.5);
      }
    }
  }

  private flashHammerHit(target: Phaser.GameObjects.GameObject): void {
    audioManager.sfxHammerHit();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (target as any).setTint(0xff6644);
    this.time.delayedCall(90, () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (target.active) (target as any).clearTint();
    });
  }

  private doHammerLeft(wx: number, wy: number): void {
    const target = this.findNearestBuildingAt(wx, wy);
    if (target !== this.hammerLTarget) {
      this.hammerLTarget = target;
      this.hammerLCount = 1;
      if (target) this.flashHammerHit(target);
      return;
    }
    this.hammerLCount++;
    if (this.hammerLCount < 2) return;
    this.hammerLCount = 0;
    this.hammerLTarget = null;

    if (!target || target === this.house) return;

    this.flashHammerHit(target);

    // Clear hover reference before destroying
    this.hammerHoveredObj = null;

    const tx = (target as unknown as { x: number }).x;
    const ty = (target as unknown as { y: number }).y;

    if (target instanceof CraftingBench) {
      if (this.craftingOpen) { this.craftingOpen = false; }
      this.benchEIcon.setVisible(false);
      this.buildingGroup.remove(target, true, true);
      this.spawnDrops(tx, ty, [{ itemId: 'crafting_bench', quantity: 1 }]);
    } else if (target instanceof Canon) {
      const idx = this.canons.indexOf(target);
      if (idx < 0) return;
      this.canonGroup.remove(target, true, true);
      this.canons.splice(idx, 1);
      this.spawnDrops(tx, ty, [{ itemId: 'canon', quantity: 1 }]);
    } else if (target instanceof Turret) {
      const idx = this.turrets.indexOf(target);
      if (idx < 0) return;
      this.turretGroup.remove(target, true, true);
      this.turrets.splice(idx, 1);
      this.spawnDrops(tx, ty, [{ itemId: 'turret', quantity: 1 }]);
    } else if (target instanceof Anvil) {
      const idx = this.anvils.indexOf(target);
      if (idx < 0) return;
      if (this.activeAnvil === target) { this.anvilOpen = false; this.activeAnvil = null; }
      this.anvilGroup.remove(target, true, true);
      this.anvils.splice(idx, 1);
      this.spawnDrops(tx, ty, [{ itemId: 'anvil', quantity: 1 }]);
    } else if (target instanceof AutoMiner) {
      const idx = this.miners.indexOf(target);
      if (idx < 0) return;
      if (this.activeMiner === target) { this.activeMiner = null; this.minerOpen = false; }
      target.eIcon.destroy();
      target.targetNode.setVisible(true);
      this.resourceGroup.add(target.targetNode, false);
      this.buildingGroup.remove(target, true, true);
      this.miners.splice(idx, 1);
      this.spawnDrops(tx, ty, [{ itemId: 'auto_miner', quantity: 1 }]);
    } else if (target instanceof AutoSaw) {
      const idx = this.saws.indexOf(target);
      if (idx < 0) return;
      if (this.activeSaw === target) { this.activeSaw = null; this.sawOpen = false; }
      target.eIcon.destroy();
      target.targetNode.setVisible(true);
      this.resourceGroup.add(target.targetNode, false);
      this.buildingGroup.remove(target, true, true);
      this.saws.splice(idx, 1);
      this.spawnDrops(tx, ty, [{ itemId: 'saw', quantity: 1 }]);
    }

    this.syncRegistry();
  }

  private doHammerRight(wx: number, wy: number): void {
    const target = this.findNearestBuildingAt(wx, wy);
    if (target !== this.hammerRTarget) {
      this.hammerRTarget = target;
      this.hammerRCount = 1;
      return;
    }
    this.hammerRCount++;
    if (this.hammerRCount < 2) return;
    this.hammerRCount = 0;
    this.hammerRTarget = null;
    if (!target) return;

    if (target instanceof Canon)  { target.heal(5); }
    else if (target instanceof Turret) { target.heal(5); }
    else if (target instanceof Anvil)  { target.heal(5); }
    else if (target === this.house && this.houseHp < C.HOUSE_HP) {
      this.houseHp = Math.min(C.HOUSE_HP, this.houseHp + 5);
    }

    this.syncRegistry();
  }

  private placeCraftingBench(wx: number, wy: number): void {
    if (!this.canPlaceBuilding(wx, wy)) return;
    const ps = this.gameState.players[this.localPlayerId];
    if (!removeItem(ps.hotbar, ps.inventory, 'crafting_bench', 1)) return;
    this.craftingBench = new CraftingBench(this, wx, wy);
    this.buildingGroup.add(this.craftingBench, false);
    this.benchEIcon.setPosition(wx, wy).setVisible(false);
    this.notifyBuildingPlaced('crafting-bench', wx, wy);
    this.sound.play('sfx-place-build', { volume: 0.7 });
    this.syncRegistry();
  }


  private canPlaceAcorn(wx: number, wy: number): boolean {
    if (Phaser.Math.Distance.Between(wx, wy, this.house.x, this.house.y) < 150) return false;
    for (const child of this.resourceGroup.getChildren()) {
      const node = child as ResourceNode;
      if (Phaser.Math.Distance.Between(wx, wy, node.x, node.y) < 40) return false;
    }
    return true;
  }

  private placeAcorn(wx: number, wy: number): void {
    if (!this.canPlaceAcorn(wx, wy)) return;
    const ps = this.gameState.players[this.localPlayerId];
    if (!removeItem(ps.hotbar, ps.inventory, 'acorn', 1)) return;
    const stump = new ResourceNode(this, wx, wy, 'tree');
    stump.enterBrokenState(60_000, false);
    this.resourceGroup.add(stump, false);
    this.notifyBuildingPlaced('acorn-tree', wx, wy);
    this.sound.play('sfx-place-build', { volume: 0.7 });
    this.syncRegistry();
  }


  private placeBlueberrySeed(wx: number, wy: number): void {
    if (!this.canPlaceBuilding(wx, wy)) return;
    const ps = this.gameState.players[this.localPlayerId];
    if (!removeItem(ps.hotbar, ps.inventory, 'blueberry_seed', 1)) return;
    const bush = new ResourceNode(this, wx, wy, 'blueberry_bush');
    bush.startEmpty();
    this.resourceGroup.add(bush, false);
    this.notifyBuildingPlaced('blueberry-bush', wx, wy);
    this.sound.play('sfx-place-build', { volume: 0.7 });
    this.syncRegistry();
  }


  private canPlaceBuilding(wx: number, wy: number): boolean {
    for (const child of this.resourceGroup.getChildren()) {
      const node = child as ResourceNode;
      const min = node.resourceType === 'blueberry_bush' ? 22 : 20;
      if (Phaser.Math.Distance.Between(wx, wy, node.x, node.y) < min) return false;
    }
    for (const c of this.canons)   { if (Phaser.Math.Distance.Between(wx, wy, c.x, c.y) < 28) return false; }
    for (const t of this.turrets)  { if (Phaser.Math.Distance.Between(wx, wy, t.x, t.y) < 28) return false; }
    for (const a of this.anvils)   { if (Phaser.Math.Distance.Between(wx, wy, a.x, a.y) < 28) return false; }
    for (const m of this.miners)   { if (Phaser.Math.Distance.Between(wx, wy, m.x, m.y) < 28) return false; }
    for (const s of this.saws)     { if (Phaser.Math.Distance.Between(wx, wy, s.x, s.y) < 28) return false; }
    if (this.craftingBench.active && Phaser.Math.Distance.Between(wx, wy, this.craftingBench.x, this.craftingBench.y) < 32) return false;
    if (Phaser.Math.Distance.Between(wx, wy, this.house.x, this.house.y) < 46) return false;
    return true;
  }

  private canPlaceCanon(wx: number, wy: number): boolean { return this.canPlaceBuilding(wx, wy); }

  private placeCanon(wx: number, wy: number): void {
    if (!this.canPlaceCanon(wx, wy)) return;
    const ps = this.gameState.players[this.localPlayerId];
    if (!removeItem(ps.hotbar, ps.inventory, 'canon', 1)) return;
    const canon = new Canon(this, wx, wy);
    this.canons.push(canon);
    this.canonGroup.add(canon, false);
    this.notifyBuildingPlaced('canon', wx, wy);
    this.sound.play('sfx-place-build', { volume: 0.7 });
    this.syncRegistry();
  }


  private tickCanons(delta: number): void {
    const toRemove: Canon[] = [];
    for (const canon of this.canons) {
      if (canon.isDead) { toRemove.push(canon); continue; }
      const angle = canon.tick(delta, this.activeEnemies);
      if (angle !== null) this.spawnCanonball(canon.x, canon.y, angle);
    }
    for (const canon of toRemove) {
      this.canonGroup.remove(canon, true, true);
      this.canons.splice(this.canons.indexOf(canon), 1);
    }
  }

  private spawnCanonball(x: number, y: number, angle: number): void {
    const ball = this.physics.add.image(x, y, 'canon-ball')
      .setDisplaySize(8, 8)
      .setDepth(C.DEPTH_PROJECTILES);
    const body = ball.body as Phaser.Physics.Arcade.Body;
    body.allowGravity = false;
    body.setVelocity(Math.cos(angle) * CANON_BALL_SPEED, Math.sin(angle) * CANON_BALL_SPEED);
    this.activeCanonballs.push({ sprite: ball, damage: CANON_DAMAGE });
    this.time.delayedCall(3500, () => { if (ball.active) ball.destroy(); });
  }

  private tickCanonballs(): void {
    for (let i = this.activeCanonballs.length - 1; i >= 0; i--) {
      const { sprite, damage } = this.activeCanonballs[i];
      if (!sprite.active) { this.activeCanonballs.splice(i, 1); continue; }
      let hit = false;
      for (const [id, enemy] of this.activeEnemies) {
        if (enemy.isDead) continue;
        if (Phaser.Math.Distance.Between(sprite.x, sprite.y, enemy.x, enemy.y) > 10) continue;
        sprite.destroy();
        this.activeCanonballs.splice(i, 1);
        this.spawnDamageNumber(enemy.x, enemy.y, damage);
        if (this.multiplayer) {
          audioManager.sfxEnemyHit();
          this.sendAction({ kind: 'hit-enemy', enemyId: id, damage });
        } else if (enemy.takeDamage(damage)) {
          this.killEnemy(id);
        } else {
          audioManager.sfxEnemyHit();
          enemy.knockback(sprite.x, sprite.y);
        }
        hit = true;
        break;
      }
      if (hit) break;
    }
  }

  private placeTurret(wx: number, wy: number): void {
    if (!this.canPlaceBuilding(wx, wy)) return;
    const ps = this.gameState.players[this.localPlayerId];
    if (!removeItem(ps.hotbar, ps.inventory, 'turret', 1)) return;
    const turret = new Turret(this, wx, wy);
    this.turrets.push(turret);
    this.turretGroup.add(turret, false);
    this.notifyBuildingPlaced('turret', wx, wy);
    this.sound.play('sfx-place-build', { volume: 0.7 });
    this.syncRegistry();
  }


  private tickTurrets(delta: number): void {
    const toRemove: Turret[] = [];
    for (const turret of this.turrets) {
      if (turret.isDead) { toRemove.push(turret); continue; }
      const angle = turret.tick(delta, this.activeEnemies);
      if (angle !== null) this.spawnTurretArrow(turret.x, turret.y, angle);
    }
    for (const turret of toRemove) {
      this.turretGroup.remove(turret, true, true);
      this.turrets.splice(this.turrets.indexOf(turret), 1);
    }
  }

  private spawnTurretArrow(x: number, y: number, angle: number): void {
    const arrow = this.physics.add.image(x, y, 'item-wooden-arrow-projectile')
      .setDisplaySize(12, 6)
      .setRotation(angle)
      .setDepth(C.DEPTH_PROJECTILES);
    const body = arrow.body as Phaser.Physics.Arcade.Body;
    body.allowGravity = false;
    body.setVelocity(Math.cos(angle) * TURRET_ARROW_SPEED, Math.sin(angle) * TURRET_ARROW_SPEED);
    this.activeTurretArrows.push({ sprite: arrow, damage: TURRET_DAMAGE });
    this.time.delayedCall(3000, () => { if (arrow.active) arrow.destroy(); });
  }

  private tickTurretArrows(): void {
    for (let i = this.activeTurretArrows.length - 1; i >= 0; i--) {
      const { sprite, damage } = this.activeTurretArrows[i];
      if (!sprite.active) { this.activeTurretArrows.splice(i, 1); continue; }
      let hit = false;
      for (const [id, enemy] of this.activeEnemies) {
        if (enemy.isDead) continue;
        if (Phaser.Math.Distance.Between(sprite.x, sprite.y, enemy.x, enemy.y) > 8) continue;
        sprite.destroy();
        this.activeTurretArrows.splice(i, 1);
        this.spawnDamageNumber(enemy.x, enemy.y, damage);
        if (this.multiplayer) {
          audioManager.sfxEnemyHit();
          this.sendAction({ kind: 'hit-enemy', enemyId: id, damage });
        } else if (enemy.takeDamage(damage)) {
          this.killEnemy(id);
        } else {
          audioManager.sfxEnemyHit();
          enemy.knockback(sprite.x, sprite.y);
        }
        hit = true;
        break;
      }
      if (hit) break;
    }
  }

  private spawnEnemyProjectile(x: number, y: number, angle: number, key: string, speed: number, damage: number): void {
    const proj = this.physics.add.image(x, y, key)
      .setDisplaySize(10, 10)
      .setDepth(C.DEPTH_PROJECTILES);
    const body = proj.body as Phaser.Physics.Arcade.Body;
    body.allowGravity = false;
    body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
    this.activeEnemyProjectiles.push({ sprite: proj, damage });
    this.time.delayedCall(4000, () => { if (proj.active) proj.destroy(); });
  }

  private tickEnemyProjectiles(): void {
    const ps = this.gameState.players[this.localPlayerId];
    const buildings = [...this.canons, ...this.turrets];

    for (let i = this.activeEnemyProjectiles.length - 1; i >= 0; i--) {
      const { sprite, damage } = this.activeEnemyProjectiles[i];
      if (!sprite.active) { this.activeEnemyProjectiles.splice(i, 1); continue; }
      let hit = false;

      // Check player
      if (Phaser.Math.Distance.Between(sprite.x, sprite.y, ps.position.x, ps.position.y) < 10) {
        const defence = ps.skillDefence >= 2 ? 5 : 0;
        ps.hp = Math.max(0, ps.hp - Math.max(1, damage - defence));
        audioManager.sfxPlayerHit();
        this.cameras.main.shake(60, 0.002);
        sprite.destroy();
        this.activeEnemyProjectiles.splice(i, 1);
        hit = true;
      }

      // Check house
      if (!hit && Phaser.Math.Distance.Between(sprite.x, sprite.y, this.house.x, this.house.y) < 24) {
        this.houseHp = Math.max(0, this.houseHp - damage);
        this.houseRegenCooldownMs = C.HOUSE_REGEN_COOLDOWN_SEC * 1000;
        this.houseRegenAccumMs = 0;
        sprite.destroy();
        this.activeEnemyProjectiles.splice(i, 1);
        hit = true;
      }

      // Check canons and turrets
      if (!hit) {
        for (const b of buildings) {
          if (b.isDead) continue;
          if (Phaser.Math.Distance.Between(sprite.x, sprite.y, b.x, b.y) < 14) {
            b.takeDamage(damage);
            sprite.destroy();
            this.activeEnemyProjectiles.splice(i, 1);
            hit = true;
            break;
          }
        }
      }
    }
  }

  private findNearbySaw(): AutoSaw | null {
    let best: AutoSaw | null = null;
    let bestDist: number = C.INTERACT_RANGE;
    for (const saw of this.saws) {
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, saw.x, saw.y);
      if (dist < bestDist) { bestDist = dist; best = saw; }
    }
    return best;
  }

  private findNearbyAnvil(): Anvil | null {
    let best: Anvil | null = null;
    let bestDist: number = C.INTERACT_RANGE;
    for (const anvil of this.anvils) {
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, anvil.x, anvil.y);
      if (dist < bestDist) { bestDist = dist; best = anvil; }
    }
    return best;
  }

  private tickSaws(delta: number): void {
    const toRemove: AutoSaw[] = [];
    for (const saw of this.saws) {
      const result = saw.tick(delta);
      if (!result) continue;
      for (const drop of result.drops) saw.addOutput(drop);
      if (result.nodeDestroyed) {
        if (this.activeSaw === saw) {
          this.sawOpen = false;
          this.activeSaw = null;
        }
        this.destroySawnNode(saw);
        toRemove.push(saw);
      }
    }
    for (const saw of toRemove) {
      this.buildingGroup.remove(saw, true, true);
      this.saws.splice(this.saws.indexOf(saw), 1);
    }
  }

  private destroySawnNode(saw: AutoSaw): void {
    const node = saw.targetNode;
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

  private spawnDamageNumber(x: number, y: number, amount: number): void {
    const txt = this.add.text(x, y - 8, String(amount), {
      fontSize: '12px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
      fontStyle: 'bold',
    }).setOrigin(0.5, 1).setDepth(C.DEPTH_UI - 1);

    this.tweens.add({
      targets: txt,
      y: y - 28,
      alpha: 0,
      duration: 700,
      ease: 'Cubic.easeOut',
      onComplete: () => txt.destroy(),
    });
  }

  private playSwordSwing(angle?: number): void {
    const ptr = this.input.activePointer;
    const wp  = this.cameras.main.getWorldPoint(ptr.x, ptr.y);
    const a = angle ?? Phaser.Math.Angle.Between(this.player.x, this.player.y, wp.x, wp.y);
    const ox = Math.cos(a) * 20;
    const oy = Math.sin(a) * 20;
    const fx = this.add.sprite(this.player.x + ox, this.player.y + oy, 'fx-sword-swing')
      .setDisplaySize(48, 48)
      .setRotation(a)
      .setDepth(C.DEPTH_PLAYER + 1)
      .play('fx-sword-swing');
    fx.once('animationcomplete', () => fx.destroy());
  }

  private spawnHealNumber(x: number, y: number, amount: number): void {
    const txt = this.add.text(x, y - 16, `+${amount}`, {
      fontSize: '18px', color: '#44ff88', stroke: '#003311', strokeThickness: 4, fontStyle: 'bold',
    }).setOrigin(0.5, 1).setDepth(500);
    this.tweens.add({
      targets: txt, y: y - 52, alpha: 0,
      duration: 900, ease: 'Cubic.easeOut',
      onComplete: () => txt.destroy(),
    });
  }

  private dropActiveItem(all: boolean): void {
    const ps = this.gameState.players[this.localPlayerId];
    const slot = ps.hotbar[ps.activeSlot];
    if (!slot) return;

    const qty = all ? slot.quantity : 1;
    slot.quantity -= qty;
    if (slot.quantity <= 0) ps.hotbar[ps.activeSlot] = null;

    const angle = Math.random() * Math.PI * 2;
    const r = 14 + Math.random() * 8;
    const dropX = this.player.x + Math.cos(angle) * r;
    const dropY = this.player.y + Math.sin(angle) * r;
    const id = crypto.randomUUID();

    this.gameState.droppedItems[id] = { itemId: slot.itemId, quantity: qty, position: { x: dropX, y: dropY } };
    const item = new DroppedItem(this, dropX, dropY, slot.itemId, qty);
    this.droppedItemMap.set(id, item);
    this.dropImmune.add(id);

    if (this.multiplayer) {
      this.serverDropMap.set(id, item); // track so pickup sends pickup-drop
      this.sendAction({ kind: 'sync-drops', drops: [{ id, itemId: slot.itemId, quantity: qty, x: dropX, y: dropY }] });
    }

    this.syncRegistry();
  }

  private tickArrows(): void {
    for (let i = this.activeArrows.length - 1; i >= 0; i--) {
      const { sprite, damage } = this.activeArrows[i];
      if (!sprite.active) { this.activeArrows.splice(i, 1); continue; }

      let hit = false;
      for (const [id, enemy] of this.activeEnemies) {
        if (enemy.isDead) continue;
        const dist = Phaser.Math.Distance.Between(sprite.x, sprite.y, enemy.x, enemy.y);
        if (dist > 16) continue;
        sprite.destroy();
        this.activeArrows.splice(i, 1);
        this.spawnDamageNumber(enemy.x, enemy.y, damage);
        if (this.multiplayer) {
          audioManager.sfxEnemyHit();
          this.sendAction({ kind: 'hit-enemy', enemyId: id, damage });
        } else if (enemy.takeDamage(damage)) {
          this.killEnemy(id);
        } else {
          audioManager.sfxEnemyHit();
          enemy.knockback(sprite.x, sprite.y);
        }
        hit = true;
        break;
      }
      if (hit) break;
    }
  }

  private doRangedAttack(targetX: number, targetY: number): void {
    if (this.attackCooldownMs > 0) return;
    const ps = this.gameState.players[this.localPlayerId];
    if (!removeItem(ps.hotbar, ps.inventory, 'wooden_arrow', 1)) return;
    this.attackCooldownMs = 600;

    const strengthBonus = ps.skillStrength >= 2 ? 5 : 0;
    const damage = (ITEMS['bow']?.damage ?? 4) + (ITEMS['wooden_arrow']?.damage ?? 2) + strengthBonus;
    const angle  = Phaser.Math.Angle.Between(this.player.x, this.player.y, targetX, targetY);

    const arrow = this.physics.add.image(this.player.x, this.player.y, 'item-wooden-arrow-projectile')
      .setDisplaySize(6, 14)
      .setRotation(angle + Math.PI / 2)
      .setDepth(C.DEPTH_PLAYER);

    const body = arrow.body as Phaser.Physics.Arcade.Body;
    body.allowGravity = false;
    body.setCollideWorldBounds(false);
    body.setVelocity(Math.cos(angle) * 380, Math.sin(angle) * 380);

    this.activeArrows.push({ sprite: arrow, damage });
    this.time.delayedCall(2500, () => { if (arrow.active) arrow.destroy(); });
    this.syncRegistry();
  }

  private doMeleeAttack(): void {
    if (this.attackCooldownMs > 0) return;
    this.attackCooldownMs = C.PUNCH_INTERVAL_MS;

    const ps = this.gameState.players[this.localPlayerId];
    const activeItem = ps.hotbar[ps.activeSlot];
    const itemDef = activeItem ? ITEMS[activeItem.itemId] : null;
    const isSword = itemDef?.type === 'weapon';

    // Find nearest hittable resource node (broken tree stumps are also targetable)
    let nearestNode: ResourceNode | null = null;
    let nearestNodeDist = C.INTERACT_RANGE + 1;
    for (const child of this.resourceGroup.getChildren()) {
      const node = child as ResourceNode;
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, node.x, node.y);
      if (dist < nearestNodeDist) { nearestNodeDist = dist; nearestNode = node; }
    }
    const nearResource = nearestNode !== null && nearestNodeDist <= C.INTERACT_RANGE;

    // Sword: directional swing — only when no resource is in range
    if (isSword && !nearResource) {
      this.player.playAttackAnim('player-knife-interact');
      if (this.multiplayer) this.sendAction({ kind: 'melee' }, 'player-knife-interact');
      audioManager.sfxMeleeAttack();
      const damage = (itemDef!.damage ?? 1) + (ps.skillStrength >= 2 ? 5 : 0);
      const ptr = this.input.activePointer;
      const wp  = this.cameras.main.getWorldPoint(ptr.x, ptr.y);
      const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, wp.x, wp.y);
      this.playSwordSwing(angle);
      const fxX = this.player.x + Math.cos(angle) * 20;
      const fxY = this.player.y + Math.sin(angle) * 20;
      const hitRadius = 24;
      for (const [id, enemy] of this.activeEnemies) {
        if (enemy.isDead) continue;
        if (Phaser.Math.Distance.Between(fxX, fxY, enemy.x, enemy.y) > hitRadius) continue;
        this.spawnDamageNumber(enemy.x, enemy.y, damage);
        if (this.multiplayer) {
          audioManager.sfxEnemyHit();
          this.sendAction({ kind: 'hit-enemy', enemyId: id, damage });
        } else if (enemy.takeDamage(damage)) {
          this.killEnemy(id);
        } else {
          audioManager.sfxEnemyHit();
          enemy.knockback(this.player.x, this.player.y);
        }
      }
      return;
    }

    // Resource harvesting (any weapon or fist)
    if (nearResource) {
      if (nearestNode!.resourceType === 'gold_node') {
        const hasPickaxe = ps.hotbar[ps.activeSlot]?.itemId === 'stone_pickaxe';
        if (!hasPickaxe) return;
      }
      const isRock = nearestNode!.resourceType === 'rock'
        || nearestNode!.resourceType === 'iron_ore_node'
        || nearestNode!.resourceType === 'copper_ore_node'
        || nearestNode!.resourceType === 'gold_node';
      const hitAnimKey = isRock ? 'player-pickaxe-interact' : 'player-axe-interact';
      this.player.playAttackAnim(hitAnimKey);
      this.sound.play('sfx-hit-resource', { volume: 0.7 });
      const wasBroken = nearestNode!.isBroken;
      const result = nearestNode!.hit();
      if (result.destroyed) {
        const nodeId = nearestNode!.name;
        if (this.multiplayer) {
          this.destroyNode(nearestNode!, []); // drops come from server snapshot
          if (nodeId) {
            if (result.drops.length > 0) {
              const serverDrops = this.toServerDrops(nearestNode!.x, nearestNode!.y, result.drops);
              this.sendAction({ kind: 'sync-drops', drops: serverDrops }, hitAnimKey);
            }
            this.sendAction({ kind: 'node-event', nodeId, event: 'depleted' });
          }
        } else {
          this.destroyNode(nearestNode!, result.drops);
        }
      } else {
        if (this.multiplayer) {
          if (result.drops.length > 0) {
            const serverDrops = this.toServerDrops(nearestNode!.x, nearestNode!.y, result.drops);
            this.sendAction({ kind: 'sync-drops', drops: serverDrops }, hitAnimKey);
          }
          if (!wasBroken && nearestNode!.isBroken) {
            this.sendAction({ kind: 'node-event', nodeId: nearestNode!.name, event: 'broken' });
          } else if (result.drops.length === 0) {
            this.sendAction({ kind: 'melee' }, hitAnimKey);
          }
        } else {
          if (result.drops.length > 0) this.spawnDrops(nearestNode!.x, nearestNode!.y, result.drops);
        }
      }
      return;
    }

    // Fist/tool: auto-target nearest enemy
    let nearestEnemyId: string | null = null;
    let nearestEnemyDist = C.INTERACT_RANGE + 1;
    for (const [id, enemy] of this.activeEnemies) {
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y);
      if (dist < nearestEnemyDist) { nearestEnemyDist = dist; nearestEnemyId = id; }
    }
    if (nearestEnemyId) {
      audioManager.sfxMeleeAttack();
      this.player.playAttackAnim('player-knife-interact');
      if (this.multiplayer) this.sendAction({ kind: 'melee' }, 'player-knife-interact');
      this.playSwordSwing();
      const damage = (itemDef?.damage ?? 1) + (ps.skillStrength >= 2 ? 5 : 0);
      const enemy = this.activeEnemies.get(nearestEnemyId)!;
      this.spawnDamageNumber(enemy.x, enemy.y, damage);
      if (this.multiplayer) {
        audioManager.sfxEnemyHit();
        this.sendAction({ kind: 'hit-enemy', enemyId: nearestEnemyId, damage });
      } else if (enemy.takeDamage(damage)) {
        this.killEnemy(nearestEnemyId);
      } else {
        audioManager.sfxEnemyHit();
        enemy.knockback(this.player.x, this.player.y);
      }
    }
  }

  /** Removes a node from the world, replaces its tile with dirt, spawns drops, schedules respawn. */
  private destroyNode(node: ResourceNode, drops: { itemId: string; quantity: number }[]): void {
    if (node.name) this.resourceNodeMap.delete(node.name);
    const wx = node.x;
    const wy = node.y;
    const type = node.resourceType;

    // Broken tree stump hit by player — just remove, no tile change or respawn
    if ((type === 'tree' || type === 'forest_tree' || type === 'flora_tree') && node.isBroken) {
      this.resourceGroup.remove(node, true, true);
      if (drops.length > 0) this.spawnDrops(wx, wy, drops);
      return;
    }

    if (type === 'bush' || type === 'forest_bush' || type === 'blueberry_bush') {
      this.resourceGroup.remove(node, true, true);
      if (drops.length > 0) this.spawnDrops(wx, wy, drops);
      this.time.delayedCall(30_000, () => {
        const respawned = new ResourceNode(this, wx, wy, type);
        this.resourceGroup.add(respawned, false);
      });
      return;
    }

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
    const buildings = [...this.canons, ...this.turrets, ...this.anvils];

    for (const [id, enemy] of this.activeEnemies) {
      const { playerDmg, houseDmg, buildingDmg, buildingIdx, projectile } = enemy.tick(
        delta,
        ps.position.x, ps.position.y,
        this.house.x,  this.house.y,
        buildings,
      );
      if (projectile) {
        this.spawnEnemyProjectile(projectile.x, projectile.y, projectile.angle, projectile.key, projectile.speed, projectile.damage);
      }
      if (buildingDmg > 0 && buildingIdx >= 0 && buildingIdx < buildings.length) {
        buildings[buildingIdx].takeDamage(buildingDmg);
      }
      if (playerDmg > 0) {
        const defence = ps.skillDefence >= 2 ? 5 : 0;
        const actual  = Math.max(1, playerDmg - defence);
        ps.hp = Math.max(0, ps.hp - actual);
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
          this.houseHpBarFill.setSize(0, 5);
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
    this.enemyGroup.add(enemy);
    this.gameState.enemies[id] = { id, type: enemyId, position: { x, y }, hp: def.hp, maxHp: def.hp };
  }

  /** Seed the initial natural-enemy population across the map (called once at world creation). */
  private spawnNaturalEnemies(): void {
    for (const def of Object.values(ENEMIES)) {
      if (!def.isNatural) continue;
      for (let i = 0; i < (def.maxAlive ?? 0); i++) this.spawnNaturalEnemy(def.id);
    }
  }

  /** Spawn one natural enemy of the given type, if it's still under its world population cap. */
  private spawnNaturalEnemy(enemyId: string): void {
    const def = ENEMIES[enemyId];
    if (!def || !def.isNatural) return;
    if (this.countAliveNatural(enemyId) >= (def.maxAlive ?? 0)) return;

    const pos = this.pickNaturalSpawnPoint(def);
    if (!pos) return;

    const id = crypto.randomUUID();
    const enemy = new BaseEnemy(this, pos.x, pos.y, def);
    this.activeEnemies.set(id, enemy);
    this.enemyGroup.add(enemy);
    this.gameState.enemies[id] = { id, type: enemyId, position: pos, hp: def.hp, maxHp: def.hp };
  }

  private countAliveNatural(enemyId: string): number {
    let count = 0;
    for (const enemy of this.activeEnemies.values()) if (enemy.enemyId === enemyId) count++;
    return count;
  }

  /** Pick a random point inside this enemy's biome, away from the player's starting base. */
  private pickNaturalSpawnPoint(def: EnemyDefinition): { x: number; y: number } | null {
    const mapSize = C.MAP_WIDTH_TILES * C.TILE_SIZE;
    const CLEAR_SQ = 300 * 300;
    for (let attempt = 0; attempt < 40; attempt++) {
      const x = this.rng() * mapSize;
      const y = def.biome === 'forest'
        ? this.rng() * C.FOREST_BIOME_ROWS * C.TILE_SIZE
        : def.biome === 'flora'
          ? mapSize - this.rng() * C.FLORA_BIOME_ROWS * C.TILE_SIZE
          : this.rng() * mapSize;
      const dx = x - C.PLAYER_SPAWN.x, dy = y - C.PLAYER_SPAWN.y;
      if (dx * dx + dy * dy < CLEAR_SQ) continue;
      return { x, y };
    }
    return null;
  }

  /** Remove a dead enemy, spawn its drops, update wave counter. */
  private killEnemy(id: string): void {
    const enemy = this.activeEnemies.get(id);
    if (!enemy) return;
    audioManager.sfxEnemyDeath();
    this.createDeathParticles(enemy.x, enemy.y);
    this.spawnDrops(enemy.x, enemy.y, enemy.getDrops());
    this.enemyGroup.remove(enemy);
    enemy.destroy();
    this.activeEnemies.delete(id);
    delete this.gameState.enemies[id];
    this.waveKilled += 1;
    this.gameState.enemiesRemainingThisWave = Math.max(0, this.waveTotal - this.waveKilled);
    if (this.gameState.enemiesRemainingThisWave === 0) this.gameState.waveActive = false;
  }

  /** Convert a local drop list into server-format snapshots with UUIDs and scatter positions. */
  private toServerDrops(x: number, y: number, drops: { itemId: string; quantity: number }[]): DroppedItemSnapshot[] {
    const result: DroppedItemSnapshot[] = [];
    for (const drop of drops) {
      for (let q = 0; q < drop.quantity; q++) {
        const angle = Math.random() * Math.PI * 2;
        const r = 8 + Math.random() * 20;
        result.push({ id: crypto.randomUUID(), itemId: drop.itemId, quantity: 1,
          x: x + Math.cos(angle) * r, y: y + Math.sin(angle) * r });
      }
    }
    return result;
  }

  private sendAction(action: import('../../shared/packets').ActionEvent, attackAnim: string | null = null): void {
    const ps = this.gameState.players[this.localPlayerId];
    if (!ps) return;
    net.send({
      type: 'input',
      keys: { up: this.keys.up.isDown, down: this.keys.down.isDown, left: this.keys.left.isDown, right: this.keys.right.isDown },
      pointerWorld: { x: this.input.activePointer.worldX, y: this.input.activePointer.worldY },
      facing: ps.facing,
      action,
      position: { x: this.player.x, y: this.player.y },
      attackAnim,
    });
  }

  /** Send a building-placement event and mark it so the echo is ignored. */
  private notifyBuildingPlaced(kind: import('../../shared/packets').BuildingKind, x: number, y: number, nodeId?: string): void {
    if (!this.multiplayer) return;
    const buildingId = crypto.randomUUID();
    this.placedBuildingIds.add(buildingId);
    this.sendAction({ kind: 'place-building', buildingId, buildingKind: kind, x, y, nodeId });
  }

  /** Spawn a building received from the server snapshot on this client (no item cost). */
  private spawnBuildingFromNetwork(snap: import('../../shared/packets').BuildingSnapshot): void {
    this.placedBuildingIds.add(snap.id);

    switch (snap.kind) {
      case 'canon': {
        const c = new Canon(this, snap.x, snap.y);
        this.canons.push(c);
        this.canonGroup.add(c, false);
        break;
      }
      case 'turret': {
        const t = new Turret(this, snap.x, snap.y);
        this.turrets.push(t);
        this.turretGroup.add(t, false);
        break;
      }
      case 'anvil': {
        const a = new Anvil(this, snap.x, snap.y);
        this.anvils.push(a);
        this.anvilGroup.add(a, false);
        break;
      }
      case 'crafting-bench': {
        if (!this.craftingBench) {
          this.craftingBench = new CraftingBench(this, snap.x, snap.y);
          this.buildingGroup.add(this.craftingBench, false);
          this.benchEIcon.setPosition(snap.x, snap.y).setVisible(false);
        }
        break;
      }
      case 'auto-miner': {
        const node = snap.nodeId ? this.resourceNodeMap.get(snap.nodeId) : null;
        if (node) {
          this.resourceGroup.remove(node, false, false);
          const miner = new AutoMiner(this, node);
          this.buildingGroup.add(miner, false);
          this.miners.push(miner);
        }
        break;
      }
      case 'auto-saw': {
        const node = snap.nodeId ? this.resourceNodeMap.get(snap.nodeId) : null;
        if (node) {
          this.resourceGroup.remove(node, false, false);
          const saw = new AutoSaw(this, node);
          this.buildingGroup.add(saw, false);
          this.saws.push(saw);
        }
        break;
      }
      case 'acorn-tree': {
        const stump = new ResourceNode(this, snap.x, snap.y, 'tree');
        stump.enterBrokenState(60_000, false);
        this.resourceGroup.add(stump, false);
        break;
      }
      case 'blueberry-bush': {
        const bush = new ResourceNode(this, snap.x, snap.y, 'blueberry_bush');
        bush.startEmpty();
        this.resourceGroup.add(bush, false);
        break;
      }
    }
  }

  // ── Multiplayer snapshot application ─────────────────────────────────────

  private applySnapshot(snapshot: GameSnapshot): void {
    const ps = this.gameState.players[this.localPlayerId];
    if (!ps) return; // player state not yet initialised

    // Phase timer & state
    this.gameState.phase      = snapshot.phase;
    this.gameState.phaseTimer = snapshot.phaseTimerSec;
    this.gameState.nightNumber = snapshot.nightNumber;
    this.gameState.dayNumber   = snapshot.dayNumber;
    this.gameState.waveActive  = snapshot.waveActive;

    // House HP
    if (snapshot.houseHp !== this.houseHp) {
      const prevHp = this.houseHp;
      this.houseHp = snapshot.houseHp;
      if (snapshot.houseHp < prevHp) {
        const distToHouse = Phaser.Math.Distance.Between(
          ps.position.x, ps.position.y, this.house.x, this.house.y,
        );
        if (distToHouse <= C.HOUSE_AUDIO_RANGE) audioManager.sfxHouseHit();
        if (this.houseHp <= 0) {
          this.gameOver = true;
          this.player.setVelocity(0, 0);
          audioManager.sfxGameOver();
          this.scene.stop('ui');
          this.scene.start('game-over', {
            nightsSurvived: snapshot.nightNumber,
            dayReached:     snapshot.dayNumber,
          });
          return;
        }
      }
    }

    // Trigger night-start sfx on phase change
    if (snapshot.phase === 'night' && this.gameState.phase === 'day') {
      audioManager.sfxNightStart();
    }

    // Enemies: sync server list to local Phaser sprites
    const serverIds = new Set(snapshot.enemies.map(e => e.id));

    // Remove enemies no longer on server
    for (const [id, enemy] of this.activeEnemies) {
      if (!serverIds.has(id)) {
        audioManager.sfxEnemyDeath();
        this.createDeathParticles(enemy.x, enemy.y);
        // Drops come from snapshot.drops — don't spawn locally
        this.enemyGroup.remove(enemy);
        enemy.destroy();
        this.activeEnemies.delete(id);
        delete this.gameState.enemies[id];
      }
    }

    // Create or update enemies from server
    for (const snap of snapshot.enemies) {
      const existing = this.activeEnemies.get(snap.id);
      if (existing) {
        existing.applyServerUpdate(snap.x, snap.y, snap.hp);
      } else {
        const def = ENEMIES[snap.defId];
        if (!def) continue;
        const enemy = new BaseEnemy(this, snap.x, snap.y, def);
        this.activeEnemies.set(snap.id, enemy);
        this.enemyGroup.add(enemy);
        this.gameState.enemies[snap.id] = {
          id: snap.id, type: snap.defId,
          position: { x: snap.x, y: snap.y },
          hp: snap.hp, maxHp: snap.maxHp,
        };
      }
    }

    // Remote players
    const myId = this.localPlayerId;
    const seenIds = new Set<string>();

    for (const pSnap of snapshot.players) {
      if (pSnap.id === myId) {
        // Apply authoritative HP for enemy damage (server is the damage source)
        if (pSnap.hp < ps.hp) {
          ps.hp = pSnap.hp;
          audioManager.sfxPlayerHit();
          this.cameras.main.shake(60, 0.002);
          if (ps.hp <= 0) {
            this.gameOver = true;
            this.player.setVelocity(0, 0);
            audioManager.sfxGameOver();
            this.scene.stop('ui');
            this.scene.start('game-over', {
              nightsSurvived: snapshot.nightNumber,
              dayReached:     snapshot.dayNumber,
            });
            return;
          }
        }
        continue;
      }
      seenIds.add(pSnap.id);
      const rp = this.remotePlayerMap.get(pSnap.id);
      if (rp) {
        rp.applyServerUpdate(pSnap.x, pSnap.y, pSnap.attackAnim);
      } else {
        const newRp = new RemotePlayer(this, pSnap.x, pSnap.y, pSnap.name);
        this.remotePlayerMap.set(pSnap.id, newRp);
      }
    }

    // Remove players no longer in snapshot
    for (const [id, rp] of this.remotePlayerMap) {
      if (!seenIds.has(id)) { rp.destroy(); this.remotePlayerMap.delete(id); }
    }

    // Building sync — spawn buildings placed by other players
    for (const bsnap of snapshot.buildings) {
      if (!this.placedBuildingIds.has(bsnap.id)) {
        this.spawnBuildingFromNetwork(bsnap);
      }
    }

    // Resource node sync
    for (const nodeId of snapshot.brokenNodeIds) {
      const node = this.resourceNodeMap.get(nodeId);
      if (node && !node.isBroken && (node.resourceType === 'tree' || node.resourceType === 'forest_tree' || node.resourceType === 'flora_tree')) {
        node.enterBrokenState();
      }
    }
    for (const nodeId of snapshot.depletedNodeIds) {
      const node = this.resourceNodeMap.get(nodeId);
      if (node) {
        this.resourceGroup.remove(node, true, true);
        this.resourceNodeMap.delete(nodeId);
      }
    }

    // Drops: reconcile server list with local sprites
    const serverDropIds = new Set(snapshot.drops.map(d => d.id));

    // Remove drops no longer on server (picked up by someone or server cleared)
    for (const [id, item] of this.serverDropMap) {
      if (!serverDropIds.has(id)) {
        item.destroy();
        this.serverDropMap.delete(id);
        this.droppedItemMap.delete(id);
        delete this.gameState.droppedItems[id];
        this.locallyPickedDropIds.delete(id); // confirm pickup received
      }
    }

    // Add new drops from server
    for (const drop of snapshot.drops) {
      if (this.serverDropMap.has(drop.id)) continue;        // already exists
      if (this.locallyPickedDropIds.has(drop.id)) continue; // we picked it up, awaiting server ack
      const item = new DroppedItem(this, drop.x, drop.y, drop.itemId, drop.quantity);
      this.serverDropMap.set(drop.id, item);
      this.droppedItemMap.set(drop.id, item);
      this.gameState.droppedItems[drop.id] = { itemId: drop.itemId, quantity: drop.quantity, position: { x: drop.x, y: drop.y } };
    }

    this.syncRegistry();
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
    if (!player) return;
    this.game.registry.set(R.PLAYER_HP,         player.hp);
    this.game.registry.set(R.PLAYER_MAX_HP,      player.maxHp);
    this.game.registry.set(R.INVENTORY,          player.inventory);
    this.game.registry.set(R.HOTBAR,             player.hotbar);
    this.game.registry.set(R.EQUIPMENT,          player.equipment);
    this.game.registry.set(R.ACTIVE_SLOT,        player.activeSlot);
    this.game.registry.set(R.DAY_NUMBER,         this.gameState.dayNumber);
    this.game.registry.set(R.PHASE,              this.gameState.phase);
    this.game.registry.set(R.PHASE_TIMER,        this.gameState.phaseTimer);
    this.game.registry.set(R.WAVE_ACTIVE,        this.gameState.waveActive);
    this.game.registry.set(R.ENEMIES_REMAINING,  this.gameState.enemiesRemainingThisWave);
    this.game.registry.set(R.NIGHT_NUMBER,       this.gameState.nightNumber);
    this.game.registry.set(R.CRAFTING_OPEN,      this.craftingOpen);
    this.game.registry.set(R.INVENTORY_OPEN,     this.inventoryOpen);
    this.game.registry.set(R.COINS,              player.coins);
    this.game.registry.set(R.STAT_SPEED,         player.speed);
    this.game.registry.set(R.STAT_ARMOR,         player.armor);
    this.game.registry.set(R.STAT_STRENGTH,      player.strength);
    this.game.registry.set(R.HOUSE_HP,           this.houseHp);
    this.game.registry.set(R.HOUSE_MAX_HP,        C.HOUSE_HP);
    this.game.registry.set(R.MINER_OPEN,         this.minerOpen);
    this.game.registry.set(R.MINER_POWER,        this.activeMiner?.power ?? 0);
    this.game.registry.set(R.MINER_HAS_PICKAXE,  this.activeMiner?.hasPickaxe ?? false);
    this.game.registry.set(R.SAW_OPEN,           this.sawOpen);
    this.game.registry.set(R.ANVIL_OPEN,         this.anvilOpen);
    this.game.registry.set(R.SAW_POWER,          this.activeSaw?.power ?? 0);
    this.game.registry.set(R.SAW_HAS_AXE,        this.activeSaw?.hasAxe ?? false);
    this.game.registry.set(R.MINER_OUTPUT,       this.activeMiner?.getOutput() ?? null);
    this.game.registry.set(R.SAW_OUTPUT,         this.activeSaw?.getOutput() ?? null);
    this.game.registry.set(R.HOUSE_OPEN,         this.houseOpen);
    this.game.registry.set(R.HOUSE_LEVEL,        this.gameState.houseLevel);
    this.game.registry.set(R.SKILL_SPEED,        player.skillSpeed);
    this.game.registry.set(R.SKILL_STRENGTH,     player.skillStrength);
    this.game.registry.set(R.SKILL_DEFENCE,      player.skillDefence);
  }
}
