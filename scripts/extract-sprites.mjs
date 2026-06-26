/**
 * extract-sprites.mjs
 * Crops individual sprites out of multi-sprite tilesets and saves them to
 * public/assets/sprites/ so the game can load them with plain this.load.image().
 *
 * Usage:  npm run extract-sprites
 *
 * To add a new sprite:
 *   1. Open the tileset in any image viewer, note the pixel region (x, y, w, h).
 *   2. Add a row to the SPRITES array below.
 *   3. Run the script once — done.
 */

import sharp from 'sharp';
import { mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT   = join(dirname(fileURLToPath(import.meta.url)), '..');
const ASSETS = join(ROOT, 'public', 'assets', 'Asset Pack');
const OUT    = join(ROOT, 'public', 'assets', 'sprites');

/**
 * SPRITES — one entry per extracted sprite.
 *
 * [tileset, x, y, width, height, outputFilename]
 *
 * tileset  — path relative to "public/assets/Asset Pack/"
 * x, y     — top-left pixel of the crop in the source image
 * w, h     — size of the crop
 * out      — filename written to public/assets/sprites/
 */
const SPRITES = [
  // ── Buildings ──────────────────────────────────────────────────────────────
  // TilesetVillageAbandoned.png  320×192
  //   house-level-1: brown A-frame wooden house, right side of sheet
  //   pixel-verified bounds: sprite runs y=80–159, gap rows at y=160–162
  [
    'Backgrounds/Tilesets/TilesetVillageAbandoned.png',
    256, 80, 64, 80,
    'house-1.png',
  ],

  // ── Resource Nodes ─────────────────────────────────────────────────────────
  // TilesetNature.png  384×336
  //   copper-ore-node: grey-green boulder with orange crystal dots, x=112 y=224
  //   iron-ore-node:   brown boulder with teal/blue crystal dots,   x=144 y=224
  [
    'Backgrounds/Tilesets/TilesetNature.png',
    112, 224, 32, 32,
    'copper-ore-node.png',
  ],
  [
    'Backgrounds/Tilesets/TilesetNature.png',
    144, 224, 32, 32,
    'iron-ore-node.png',
  ],
];

// ── runner ──────────────────────────────────────────────────────────────────

await mkdir(OUT, { recursive: true });

const results = await Promise.allSettled(
  SPRITES.map(async ([tileset, x, y, w, h, out]) => {
    const src  = join(ASSETS, tileset);
    const dest = join(OUT, out);
    await sharp(src).extract({ left: x, top: y, width: w, height: h }).toFile(dest);
    return out;
  }),
);

let ok = 0;
for (const [i, r] of results.entries()) {
  const out = SPRITES[i][5];
  if (r.status === 'fulfilled') { console.log(`  ✓  ${out}`); ok++; }
  else                          { console.error(`  ✗  ${out}:`, r.reason.message); }
}
console.log(`\n${ok}/${SPRITES.length} sprites extracted → public/assets/sprites/`);
