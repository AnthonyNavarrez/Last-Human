// Generates public/assets/tiles/map.json — a Tiled-compatible JSON tilemap.
// Run with: node scripts/generate-map.mjs
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const MAP_W = 200;   // tiles wide
const MAP_H = 200;   // tiles tall
const TILE_SIZE = 16;

// TilesetFloor: 22 columns, GIDs start at 1
// Pure-green grass tiles: row 12, cols 11-15 → GIDs 276-280
const GRASS = [276, 276, 277, 278, 279, 280];

function hash(x, y) {
  return (((x * 1619 + y * 31337) ^ (x * 7919)) >>> 0);
}

function grassGid(tx, ty) {
  const h = hash(tx, ty) % GRASS.length;
  return GRASS[h];
}

const groundData = [];
for (let ty = 0; ty < MAP_H; ty++) {
  for (let tx = 0; tx < MAP_W; tx++) {
    groundData.push(grassGid(tx, ty));
  }
}

const map = {
  width: MAP_W,
  height: MAP_H,
  tilewidth: TILE_SIZE,
  tileheight: TILE_SIZE,
  orientation: 'orthogonal',
  renderorder: 'right-down',
  infinite: false,
  nextlayerid: 7,
  nextobjectid: 1,
  layers: [
    {
      id: 1, name: 'ground', type: 'tilelayer',
      width: MAP_W, height: MAP_H,
      x: 0, y: 0,
      visible: true, opacity: 1,
      data: groundData,
    },
    {
      id: 2, name: 'above-ground', type: 'tilelayer',
      width: MAP_W, height: MAP_H,
      x: 0, y: 0,
      visible: true, opacity: 1,
      data: new Array(MAP_W * MAP_H).fill(0),
    },
    {
      id: 3, name: 'collision', type: 'tilelayer',
      width: MAP_W, height: MAP_H,
      x: 0, y: 0,
      visible: false, opacity: 1,
      data: new Array(MAP_W * MAP_H).fill(0),
    },
    {
      id: 4, name: 'objects', type: 'objectgroup',
      x: 0, y: 0,
      visible: true, opacity: 1,
      objects: [],
    },
    {
      id: 5, name: 'buildings', type: 'objectgroup',
      x: 0, y: 0,
      visible: true, opacity: 1,
      objects: [],
    },
  ],
  tilesets: [
    {
      firstgid: 1,
      name: 'TilesetFloor',
      image: '../../Asset Pack/Backgrounds/Tilesets/TilesetFloor.png',
      imagewidth: 352,
      imageheight: 288,
      tilewidth: TILE_SIZE,
      tileheight: TILE_SIZE,
      spacing: 0,
      margin: 0,
      columns: 22,
      tilecount: 572,
    },
  ],
};

const outPath = path.join(__dirname, '..', 'public', 'assets', 'tiles', 'map.json');
writeFileSync(outPath, JSON.stringify(map, null, 2));
console.log(`Map generated: ${MAP_W}x${MAP_H} tiles → ${outPath}`);
