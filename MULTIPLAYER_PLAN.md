# Multiplayer Migration Plan

## Architecture Overview

```
[Player 1 Client]  ──┐
[Player 2 Client]  ──┤── WebSocket ──► [Render Server] ◄── authoritative game state
[Player 3 Client]  ──┤
[Player 4 Client]  ──┘

[Client bundle] hosted on Netlify (free, static)
[Server process] hosted on Render (free tier, Node.js)
```

The server owns all game logic. Clients send inputs, receive state, and render it. This is the standard authoritative server model — the only reliable approach for a shared world.

- **Max players per room:** 4
- **Join method:** 6-character invite codes (no public server browser)
- **Solo mode:** unchanged — bypasses server entirely

---

## Folder Restructure

```
/
├── shared/               ← code used by BOTH client and server
│   ├── GameState.ts      (already written, move here)
│   ├── data/             (items, enemies, waves, recipes — untouched)
│   ├── constants.ts      (untouched)
│   └── packets.ts        (new — defines every message type)
│
├── src/                  ← client only (Phaser, UI, rendering)
│   ├── scenes/
│   ├── entities/
│   ├── systems/
│   └── ui/
│
└── server/               ← new, runs on Render
    ├── index.ts          (WebSocket server entry)
    ├── Room.ts           (one game session)
    ├── GameLoop.ts       (authoritative tick)
    ├── EnemyAI.ts        (moved from client)
    └── WaveManager.ts    (moved from client)
```

The `shared/` folder is the biggest win — `items.ts`, `enemies.ts`, `waves.ts`, `recipes.ts`, and `GameState.ts` are all already written and move there unchanged.

---

## Packet Protocol

Every WebSocket message is a typed JSON packet.

### Client → Server

| Packet | Payload |
|---|---|
| `create-room` | `{ maxPlayers: 2–4 }` |
| `join-room` | `{ code, playerName }` |
| `start-game` | `{ }` (host only) |
| `input` | `{ keys: {up,down,left,right}, pointerWorld: {x,y}, action: null \| 'melee' \| 'place' \| 'ranged' \| 'interact' \| 'drop', actionData: { itemId?, worldX?, worldY? } }` |

### Server → Client

| Packet | Payload |
|---|---|
| `room-created` | `{ code, playerId }` |
| `room-joined` | `{ playerId, players: PlayerState[] }` |
| `player-joined` | `{ player: PlayerState }` |
| `player-left` | `{ playerId }` |
| `game-started` | `{ initialState: GameState }` |
| `state-snapshot` | `{ state: GameState }` (full, every 100ms) |
| `state-delta` | `{ delta: Partial<GameState> }` (partial, every 50ms) |
| `error` | `{ message }` |

Clients send inputs every frame (~16ms). Server processes them on a fixed **50ms tick (20 ticks/sec)** and sends state back.

---

## Phase 1 — Server Foundation

**Goal:** WebSocket server running on Render that can create and join rooms.

- [ ] Set up `server/index.ts` with the `ws` package (lightweight, no Socket.io overhead)
- [ ] `Room` class: holds up to 4 player connections, invite code (6 random chars), game state
- [ ] Handle `create-room` → generate code, add host, reply with code
- [ ] Handle `join-room` → validate code exists, room not full, not started, add player
- [ ] Handle disconnects gracefully (remove player, notify others, close room if empty)
- [ ] Deploy to Render as a Node.js web service — confirm WebSocket connections work end to end

> No game logic yet. Just connection plumbing.

---

## Phase 2 — Lobby UI (Client)

**Goal:** Players can create/join a game from the main menu.

### New Scenes
- **LobbyCreateScene** — "Create Game" button → calls server, receives code, shows waiting room
- **LobbyJoinScene** — Text input for 6-char code → join → waiting room
- **WaitingRoomScene** — Lists connected players (1–4 slots), host sees "Start Game" button, others see "Waiting for host..."

### Changes to MainMenuScene
- "Play" button opens a choice: **Solo** or **Multiplayer**
- Solo starts the game exactly as today — no server involved
- Multiplayer goes to Create/Join choice

> Solo mode stays completely untouched. The lobby only appears if the player chooses multiplayer.

---

## Phase 3 — Extract Game Logic to Server

**Goal:** The server runs the game, not the client.

### Move to `server/GameLoop.ts`
- Day/night timer
- Wave spawning (`WaveManager.ts`)
- Enemy AI tick (`EnemyAI.ts` — extracted from `BaseEnemy.ts`)
- House HP and regen
- Resource node state (tree hits, broken state, respawn timers)
- Dropped item management

### Move to `server/Room.ts`
- Building placement validation (`canPlaceBuilding`, house distance checks)
- Combat resolution (damage numbers, kill detection)
- Item pickup collision

### Server Tick Loop
The server runs a `setInterval` at 50ms. Each tick:
1. Process all queued input packets from clients
2. Tick enemy AI
3. Tick timers (day/night, respawns, regen)
4. Send state snapshot to all clients

### GameState.buildings
Data that was in Phaser-side arrays (`this.canons`, `this.turrets`, etc.) moves into `GameState.buildings` — the field already exists but was never used. Each building entry gets a `kind` field (`'canon' | 'turret' | 'anvil' | 'saw' | 'miner'`) so clients know what to render.

---

## Phase 4 — Client Refactor

**Goal:** Client only renders and sends inputs. It no longer owns game logic.

### Remove from GameScene
- All direct state mutations (`ps.hp -= damage`, `this.houseHp -= ...`, etc.)
- Enemy tick logic
- Wave spawn logic
- Resource node hit logic
- Building placement validation

### Add to GameScene
- `NetworkClient.ts` — wraps WebSocket, queues incoming packets, exposes `sendInput()`
- Each frame: collect current keys + pointer position + any action → `sendInput()`
- On `state-snapshot` received: apply full state to Phaser entities (move sprites, update HP bars, spawn/destroy as needed)

### Remote Players
- `RemotePlayer.ts` — same sprite setup as `Player.ts` but driven by received position, not local input
- One `RemotePlayer` per `playerId` that isn't `localPlayerId`
- Interpolate between received positions for smooth movement (lerp over 50–100ms)

### What Stays Client-Side
- Rendering, animations, camera, audio
- UI (hotbar, inventory, crafting menu display)
- Crafting menu interaction (client sends `craft` action, server validates and updates inventory)
- Tooltips, health bar display

---

## Phase 5 — Wave Scaling for Multiple Players

Adjust wave difficulty based on player count so the game isn't trivially easy with 4 players:

```
enemy_count = base_count × (1 + (playerCount - 1) × 0.6)
```

| Players | Multiplier | Example (base 10 enemies) |
|---|---|---|
| 1 | 1.0× | 10 |
| 2 | 1.6× | 16 |
| 3 | 2.2× | 22 |
| 4 | 2.8× | 28 |

Enemy health stays the same. Resource node respawn timers stay the same — 4 players burn through resources faster naturally, balanced by having 4 people gathering.

---

## Phase 6 — Disconnect & Edge Cases

- **Host disconnects** — promote the next connected player to host. If no players remain, close the room.
- **Client disconnects mid-game** — remove their `RemotePlayer` sprite, their inventory drops at their last position as dropped items, game continues.
- **Reconnect** — not required for v1. If you disconnect you rejoin with a fresh player. Add reconnect tokens later if needed.
- **Render spin-down** — set up a free [UptimeRobot](https://uptimerobot.com) monitor to ping the server URL every 10 minutes to keep it warm.

---

## Phase 7 — Deploy

### Client → Netlify
```bash
npm run build
# deploy dist/ to Netlify (drag and drop or CLI)
```
Point the client at the Render server URL via an env variable:
```
VITE_SERVER_URL=wss://your-app.onrender.com
```

### Server → Render
- **Type:** Web Service (Node.js)
- **Build command:** `npm install && npm run build:server`
- **Start command:** `node dist/server/index.js`
- **Environment variable:** `PORT` (Render sets this automatically)
- **Free tier:** 512MB RAM — comfortably handles 5–10 simultaneous 4-player sessions

---

## What Never Changes

These files are completely untouched by the migration:

| File / Folder | Reason |
|---|---|
| `public/` | All assets stay as-is |
| `shared/data/items.ts` | Pure data |
| `shared/data/enemies.ts` | Pure data |
| `shared/data/waves.ts` | Pure data |
| `shared/data/recipes.ts` | Pure data |
| All building classes (`Canon.ts`, `Turret.ts`, etc.) | Used for rendering only |
| `ResourceNode.ts` | Used for rendering; server drives state |
| `BootScene.ts` | Minor additions only |
| `UIScene.ts` | Reads from registry exactly as today |

---

## Effort Estimate

| Phase | Complexity | Notes |
|---|---|---|
| 1 — Server foundation | Low | ~100 lines of Node.js |
| 2 — Lobby UI | Low | New scenes, minimal logic |
| 3 — Extract to server | **High** | Biggest task, most careful |
| 4 — Client refactor | **High** | Rewires most of GameScene |
| 5 — Wave scaling | Trivial | One formula change |
| 6 — Edge cases | Medium | Disconnect handling |
| 7 — Deploy | Low | Config only |

Phases 3 and 4 are where most of the work is and where bugs will appear. Everything else is relatively mechanical.
