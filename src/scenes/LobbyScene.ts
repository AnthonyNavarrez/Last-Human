import Phaser from 'phaser';
import { net } from '../systems/NetworkClient';
import { sceneButton } from '../ui/sceneButton';
import type { ServerPacket } from '../../shared/packets';

type LobbyView = 'menu' | 'naming' | 'joining';

export class LobbyScene extends Phaser.Scene {
  private view: LobbyView = 'menu';
  private nameInput = '';
  private codeInput = '';
  private pendingAction: 'create' | 'join' = 'create';

  private menuObjs: Phaser.GameObjects.GameObject[] = [];
  private namingObjs: Phaser.GameObjects.GameObject[] = [];
  private joinObjs: Phaser.GameObjects.GameObject[] = [];
  private nameDisplay!: Phaser.GameObjects.Text;
  private codeDisplay!: Phaser.GameObjects.Text;
  private errorText!: Phaser.GameObjects.Text;

  constructor() { super({ key: 'lobby' }); }

  create(): void {
    const { width, height } = this.scale;
    const cx = width / 2;
    const cy = height / 2;

    this.add.image(cx, cy, 'opening-screen').setDisplaySize(width, height);

    this.add.text(cx, cy - 280, 'LAST HUMAN', {
      fontSize: '64px', fontFamily: 'monospace',
      color: '#e8c96e', stroke: '#000000', strokeThickness: 6,
    }).setOrigin(0.5);

    this.errorText = this.add.text(cx, cy + 180, '', {
      fontSize: '18px', fontFamily: 'monospace', color: '#ff6655',
    }).setOrigin(0.5);

    this.buildMenuView(cx, cy);
    this.buildNamingView(cx, cy);
    this.buildJoinView(cx, cy);
    this.setView('menu');

    this.input.keyboard!.on('keydown', this.onKey, this);
    this.events.on('shutdown', this.cleanup, this);
  }

  private buildMenuView(cx: number, cy: number): void {
    const create = sceneButton(this, cx, cy - 80, 'CREATE GAME', () => {
      this.pendingAction = 'create';
      this.setView('naming');
    });
    const join = sceneButton(this, cx, cy, 'JOIN GAME', () => {
      this.pendingAction = 'join';
      this.setView('naming');
    });
    const back = sceneButton(this, cx, cy + 80, 'BACK', () => this.scene.start('menu'));
    this.menuObjs = [create, join, back];
  }

  private buildNamingView(cx: number, cy: number): void {
    const label = this.add.text(cx, cy - 110, 'YOUR NAME', {
      fontSize: '18px', fontFamily: 'monospace', color: '#aaaaaa',
    }).setOrigin(0.5);

    const box = this.add.rectangle(cx, cy - 60, 240, 60, 0x000000, 0.6)
      .setStrokeStyle(2, 0xffffff);

    this.nameDisplay = this.add.text(cx, cy - 60, '', {
      fontSize: '24px', fontFamily: 'monospace', color: '#ffffff',
      fixedWidth: 220, align: 'center',
    }).setOrigin(0.5);

    const confirm = sceneButton(this, cx, cy + 30, 'CONTINUE', this.onNameConfirm);
    const back = sceneButton(this, cx, cy + 100, 'BACK', () => {
      this.nameInput = '';
      this.setView('menu');
    });

    this.namingObjs = [label, box, this.nameDisplay, confirm, back];
  }

  private buildJoinView(cx: number, cy: number): void {
    const label = this.add.text(cx, cy - 110, 'ENTER ROOM CODE', {
      fontSize: '18px', fontFamily: 'monospace', color: '#aaaaaa',
    }).setOrigin(0.5);

    const box = this.add.rectangle(cx, cy - 60, 240, 60, 0x000000, 0.6)
      .setStrokeStyle(2, 0xffffff);

    this.codeDisplay = this.add.text(cx, cy - 60, '', {
      fontSize: '32px', fontFamily: 'monospace', color: '#ffffff',
      fixedWidth: 220, align: 'center',
    }).setOrigin(0.5);

    const confirm = sceneButton(this, cx, cy + 30, 'JOIN', this.onJoinConfirm);
    const back = sceneButton(this, cx, cy + 100, 'BACK', () => {
      this.codeInput = '';
      this.setView('naming');
    });

    this.joinObjs = [label, box, this.codeDisplay, confirm, back];
  }

  private setView(v: LobbyView): void {
    this.view = v;
    this.errorText.setText('');

    const show = (objs: Phaser.GameObjects.GameObject[]) =>
      objs.forEach(o => (o as Phaser.GameObjects.Image).setVisible(true));
    const hide = (objs: Phaser.GameObjects.GameObject[]) =>
      objs.forEach(o => (o as Phaser.GameObjects.Image).setVisible(false));

    hide(this.menuObjs);
    hide(this.namingObjs);
    hide(this.joinObjs);

    if (v === 'menu')    { show(this.menuObjs);   return; }
    if (v === 'naming')  { show(this.namingObjs);  this.updateNameDisplay(); return; }
    if (v === 'joining') { show(this.joinObjs);   this.updateCodeDisplay(); return; }
  }

  private updateNameDisplay(): void {
    const cursor = (Math.floor(Date.now() / 500) % 2 === 0) ? '_' : ' ';
    this.nameDisplay.setText(this.nameInput.length > 0 ? this.nameInput : cursor);
  }

  private updateCodeDisplay(): void {
    const cursor = (Math.floor(Date.now() / 500) % 2 === 0) ? '_' : ' ';
    const raw = this.codeInput.padEnd(6, cursor);
    this.codeDisplay.setText(raw.split('').join(' '));
  }

  private onKey = (event: KeyboardEvent): void => {
    if (this.view === 'naming') {
      if (event.key === 'Backspace') {
        this.nameInput = this.nameInput.slice(0, -1);
      } else if (event.key === 'Enter') {
        this.onNameConfirm();
        return;
      } else if (this.nameInput.length < 16 && /^[a-zA-Z0-9 ]$/.test(event.key)) {
        this.nameInput += event.key;
      }
      this.updateNameDisplay();
      return;
    }

    if (this.view === 'joining') {
      if (event.key === 'Backspace') {
        this.codeInput = this.codeInput.slice(0, -1);
      } else if (event.key === 'Enter') {
        this.onJoinConfirm();
        return;
      } else if (this.codeInput.length < 6 && /^[a-zA-Z0-9]$/.test(event.key)) {
        this.codeInput += event.key.toUpperCase();
      }
      this.updateCodeDisplay();
    }
  };

  private onNameConfirm = async (): Promise<void> => {
    const name = this.nameInput.trim() || 'Player';
    if (this.pendingAction === 'create') {
      this.errorText.setText('Connecting...');
      try {
        await net.connect();
      } catch {
        this.errorText.setText('Cannot reach server. Is it running?');
        return;
      }
      this.errorText.setText('');
      net.on('room-created', this.onRoomCreated);
      net.on('error', this.onServerError);
      net.send({ type: 'create-room', maxPlayers: 4, playerName: name });
    } else {
      this.setView('joining');
    }
  };

  private onRoomCreated = (packet: Extract<ServerPacket, { type: 'room-created' }>): void => {
    net.off('room-created', this.onRoomCreated);
    net.off('error', this.onServerError);
    this.scene.start('waiting-room', {
      code: packet.code,
      playerCount: 1,
      maxPlayers: 4,
      isHost: true,
    });
  };

  private onJoinConfirm = async (): Promise<void> => {
    if (this.codeInput.length < 6) {
      this.errorText.setText('Code must be 6 characters');
      return;
    }
    this.errorText.setText('Connecting...');
    try {
      await net.connect();
    } catch {
      this.errorText.setText('Cannot reach server. Is it running?');
      return;
    }
    this.errorText.setText('');
    net.on('room-joined', this.onRoomJoined);
    net.on('error', this.onServerError);
    net.send({ type: 'join-room', code: this.codeInput, playerName: this.nameInput.trim() || 'Player' });
  };

  private onRoomJoined = (packet: Extract<ServerPacket, { type: 'room-joined' }>): void => {
    net.off('room-joined', this.onRoomJoined);
    net.off('error', this.onServerError);
    this.scene.start('waiting-room', {
      code: this.codeInput,
      playerCount: packet.playerCount,
      maxPlayers: packet.maxPlayers,
      isHost: net.playerId === packet.hostId,
    });
  };

  private onServerError = (packet: Extract<ServerPacket, { type: 'error' }>): void => {
    net.off('room-created', this.onRoomCreated);
    net.off('room-joined', this.onRoomJoined);
    net.off('error', this.onServerError);
    this.errorText.setText(packet.message);
  };

  private cleanup = (): void => {
    net.off('room-created', this.onRoomCreated);
    net.off('room-joined', this.onRoomJoined);
    net.off('error', this.onServerError);
  };
}
