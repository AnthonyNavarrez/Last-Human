import Phaser from 'phaser';
import { net } from '../systems/NetworkClient';
import { sceneButton } from '../ui/sceneButton';
import type { ServerPacket } from '../../shared/packets';

interface WaitingRoomData {
  code: string;
  playerCount: number;
  maxPlayers: number;
  isHost: boolean;
}

export class WaitingRoomScene extends Phaser.Scene {
  private roomCode = '';
  private maxPlayers = 4;
  private playerCount = 1;
  private isHost = false;

  private countText!: Phaser.GameObjects.Text;
  private waitingText: Phaser.GameObjects.Text | null = null;

  constructor() { super({ key: 'waiting-room' }); }

  init(data: WaitingRoomData): void {
    this.roomCode     = data.code;
    this.maxPlayers   = data.maxPlayers;
    this.playerCount  = data.playerCount;
    this.isHost       = data.isHost;
    this.waitingText  = null;
  }

  create(): void {
    const { width, height } = this.scale;
    const cx = width / 2;
    const cy = height / 2;

    this.add.image(cx, cy, 'opening-screen').setDisplaySize(width, height);

    this.add.text(cx, cy - 280, 'LAST HUMAN', {
      fontSize: '64px', fontFamily: 'monospace',
      color: '#e8c96e', stroke: '#000000', strokeThickness: 6,
    }).setOrigin(0.5);

    // Room code display
    this.add.text(cx, cy - 170, 'ROOM CODE', {
      fontSize: '16px', fontFamily: 'monospace', color: '#aaaaaa',
    }).setOrigin(0.5);

    this.add.text(cx, cy - 135, this.roomCode, {
      fontSize: '48px', fontFamily: 'monospace',
      color: '#ffffff', stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5);

    this.add.text(cx, cy - 95, 'Share this code with friends', {
      fontSize: '14px', fontFamily: 'monospace', color: '#888888',
    }).setOrigin(0.5);

    // Player count
    this.countText = this.add.text(cx, cy - 40, this.countLabel(), {
      fontSize: '24px', fontFamily: 'monospace', color: '#e8c96e',
    }).setOrigin(0.5);

    // Slot indicators
    this.buildSlots(cx, cy);

    // Host sees Start button; guests see waiting text
    if (this.isHost) {
      sceneButton(this, cx, cy + 80, 'START GAME', () => {
        net.send({ type: 'start-game' });
      });
    } else {
      this.waitingText = this.add.text(cx, cy + 80, 'Waiting for host to start...', {
        fontSize: '18px', fontFamily: 'monospace', color: '#aaaaaa',
      }).setOrigin(0.5);
    }

    sceneButton(this, cx, cy + 150, 'LEAVE', () => {
      net.disconnect();
      this.scene.start('menu');
    });

    net.on('player-joined', this.onPlayerJoined);
    net.on('player-left',   this.onPlayerLeft);
    net.on('game-started',  this.onGameStarted);

    this.events.on('shutdown', this.cleanup, this);
    this.events.on('destroy',  this.cleanup, this);
  }

  private buildSlots(cx: number, cy: number): void {
    const slotW = 40, slotH = 40, gap = 12;
    const totalW = this.maxPlayers * slotW + (this.maxPlayers - 1) * gap;
    const startX = cx - totalW / 2 + slotW / 2;
    for (let i = 0; i < this.maxPlayers; i++) {
      const x = startX + i * (slotW + gap);
      this.add.rectangle(x, cy + 20, slotW, slotH, i < this.playerCount ? 0x4caf50 : 0x333333)
        .setStrokeStyle(2, 0x888888);
    }
  }

  private countLabel(): string {
    return `${this.playerCount} / ${this.maxPlayers} players`;
  }

  private onPlayerJoined = (packet: Extract<ServerPacket, { type: 'player-joined' }>): void => {
    this.playerCount = packet.playerCount;
    this.countText.setText(this.countLabel());
  };

  private onPlayerLeft = (packet: Extract<ServerPacket, { type: 'player-left' }>): void => {
    this.playerCount = Math.max(1, this.playerCount - 1);
    this.countText.setText(this.countLabel());

    // Promoted to host
    if (packet.newHostId === net.playerId && !this.isHost) {
      this.isHost = true;
      this.waitingText?.setVisible(false);
      const cx = this.scale.width / 2;
      const cy = this.scale.height / 2;
      sceneButton(this, cx, cy + 80, 'START GAME', () => {
        net.send({ type: 'start-game' });
      });
    }
  };

  private onGameStarted = (packet: Extract<ServerPacket, { type: 'game-started' }>): void => {
    this.cleanup();
    this.scene.start('game', { seed: packet.seed });
    this.scene.launch('ui');
  };

  private cleanup = (): void => {
    net.off('player-joined', this.onPlayerJoined);
    net.off('player-left',   this.onPlayerLeft);
    net.off('game-started',  this.onGameStarted);
  };
}
