/**
 * Builds Phaser atlas JSONs for skeleton spritesheets.
 *
 * Two modes:
 *
 *  fixedFrameW  – the spritesheet has equal-width frames (run animation).
 *                 Detects content WITHIN each frame's region, then applies
 *                 cross-frame normalisation so the character doesn't jitter.
 *
 *  autoDetect   – frame boundaries are not known in advance (attack animation).
 *                 Detects content regions from the full image, merges small
 *                 within-frame gaps, then centres each frame independently
 *                 within a virtual frame large enough to hold any single frame.
 *                 Uses actual texture coordinates so there is no bleeding.
 */

import sharp from 'sharp';
import fs from 'fs';

const WHITE = 240;

function isBackground(r, g, b, a) {
  return a < 10 || (r > WHITE && g > WHITE && b > WHITE);
}

// ─── fixed-width frames (run) ───────────────────────────────────────────────
async function buildAtlasFixed({ imgPath, outPath, frameCount, frameW, frameH }) {
  const { data, info } = await sharp(imgPath).raw().toBuffer({ resolveWithObject: true });
  const ch = info.channels;

  const bounds = [];
  for (let f = 0; f < frameCount; f++) {
    const startX = f * frameW;
    let minX = frameW, maxX = 0, minY = frameH, maxY = 0, found = false;
    for (let y = 0; y < frameH; y++) {
      for (let lx = 0; lx < frameW; lx++) {
        const gx = startX + lx;
        const i  = (y * info.width + gx) * ch;
        if (isBackground(data[i], data[i+1], data[i+2], ch === 4 ? data[i+3] : 255)) continue;
        found = true;
        if (lx < minX) minX = lx;
        if (lx > maxX) maxX = lx;
        if (y  < minY) minY = y;
        if (y  > maxY) maxY = y;
      }
    }
    if (!found) { minX = 0; maxX = frameW - 1; minY = 0; maxY = frameH - 1; }
    bounds.push({ minX, maxX, minY, maxY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 });
  }

  const avgCX = bounds.reduce((s,b) => s + b.cx, 0) / frameCount;
  const avgCY = bounds.reduce((s,b) => s + b.cy, 0) / frameCount;
  const maxCW = Math.max(...bounds.map(b => b.maxX - b.minX + 1));
  const maxCH = Math.max(...bounds.map(b => b.maxY - b.minY + 1));
  const effCX = Math.max(avgCX, maxCW / 2);
  const effCY = Math.max(avgCY, maxCH / 2);

  console.log(`${imgPath}  (fixed ${frameCount}×${frameW}×${frameH})`);
  bounds.forEach((b,i) => console.log(`  [${i}] x=${b.minX}–${b.maxX} cx=${b.cx.toFixed(1)}, y=${b.minY}–${b.maxY} cy=${b.cy.toFixed(1)}`));
  console.log(`  avgCX=${avgCX.toFixed(1)} effCX=${effCX.toFixed(1)}, avgCY=${avgCY.toFixed(1)} effCY=${effCY.toFixed(1)}`);

  const frames = {};
  for (let f = 0; f < frameCount; f++) {
    const b  = bounds[f];
    const cw = b.maxX - b.minX + 1, ch2 = b.maxY - b.minY + 1;
    frames[String(f)] = {
      frame:            { x: f * frameW + b.minX, y: b.minY, w: cw, h: ch2 },
      rotated:          false,
      trimmed:          true,
      spriteSourceSize: { x: Math.max(0, Math.round(effCX - cw / 2)), y: Math.max(0, Math.round(effCY - ch2 / 2)), w: cw, h: ch2 },
      sourceSize:       { w: frameW, h: frameH },
    };
  }

  fs.writeFileSync(outPath, JSON.stringify({
    frames,
    meta: { image: imgPath.split(/[\\/]/).pop(), size: { w: info.width, h: frameH }, scale: 1 },
  }, null, 2));
  console.log(`  → ${outPath}\n`);
}

// ─── auto-detect frames (attack) ────────────────────────────────────────────
async function buildAtlasAuto({ imgPath, outPath, mergeGapPx = 150 }) {
  const { data, info } = await sharp(imgPath).raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  // Which columns have any non-background pixel?
  const hasContent = new Uint8Array(width);
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      const i = (y * width + x) * channels;
      if (!isBackground(data[i], data[i+1], data[i+2], channels === 4 ? data[i+3] : 255)) {
        hasContent[x] = 1; break;
      }
    }
  }

  // Collect raw content column-runs
  const runs = [];
  let inRun = false, runStart = 0;
  for (let x = 0; x <= width; x++) {
    if (hasContent[x] && !inRun) { inRun = true; runStart = x; }
    else if (!hasContent[x] && inRun) { inRun = false; runs.push({ start: runStart, end: x - 1 }); }
  }

  // Merge runs with gaps ≤ mergeGapPx
  const merged = [{ ...runs[0] }];
  for (let i = 1; i < runs.length; i++) {
    if (runs[i].start - merged[merged.length - 1].end - 1 <= mergeGapPx)
      merged[merged.length - 1].end = runs[i].end;
    else merged.push({ ...runs[i] });
  }

  // Find full bounding box (including Y) for each frame
  const frameBounds = merged.map(({ start, end }) => {
    let minX = end, maxX = start, minY = height, maxY = 0;
    for (let x = start; x <= end; x++) {
      if (!hasContent[x]) continue;
      for (let y = 0; y < height; y++) {
        const i = (y * width + x) * channels;
        if (isBackground(data[i], data[i+1], data[i+2], channels === 4 ? data[i+3] : 255)) continue;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    return { minX, maxX, minY, maxY };
  });

  const maxCW = Math.max(...frameBounds.map(b => b.maxX - b.minX + 1));
  const maxCH = Math.max(...frameBounds.map(b => b.maxY - b.minY + 1));
  // sourceSize = size of the widest/tallest single frame — gives consistent scale
  const srcW = maxCW, srcH = maxCH;

  console.log(`${imgPath}  (auto-detect, merge ≤${mergeGapPx}px → ${frameBounds.length} frames)`);
  frameBounds.forEach((b,i) => console.log(`  [${i}] x=${b.minX}–${b.maxX} (w=${b.maxX-b.minX+1}), y=${b.minY}–${b.maxY}`));
  console.log(`  sourceSize: ${srcW}×${srcH}`);

  const frames = {};
  for (let i = 0; i < frameBounds.length; i++) {
    const b  = frameBounds[i];
    const cw = b.maxX - b.minX + 1, ch = b.maxY - b.minY + 1;
    // Centre each frame's content within the virtual sourceSize
    const ssX = Math.max(0, Math.round((srcW - cw) / 2));
    const ssY = Math.max(0, Math.round((srcH - ch) / 2));
    frames[String(i)] = {
      frame:            { x: b.minX, y: b.minY, w: cw, h: ch },
      rotated:          false,
      trimmed:          true,
      spriteSourceSize: { x: ssX, y: ssY, w: cw, h: ch },
      sourceSize:       { w: srcW, h: srcH },
    };
  }

  fs.writeFileSync(outPath, JSON.stringify({
    frames,
    meta: { image: imgPath.split(/[\\/]/).pop(), size: { w: width, h: height }, scale: 1 },
  }, null, 2));
  console.log(`  → ${outPath}\n`);
}

// ── Generate both atlases ────────────────────────────────────────────────────
await buildAtlasFixed({
  imgPath:    'public/assets/manual imports/skeleton-run.png',
  outPath:    'public/assets/manual imports/skeleton-run.json',
  frameCount: 6, frameW: 861, frameH: 608,
});

await buildAtlasAuto({
  imgPath:    'public/assets/manual imports/skeleton-attack.png',
  outPath:    'public/assets/manual imports/skeleton-attack.json',
  mergeGapPx: 150,
});
