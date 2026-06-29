/**
 * Detects frame boundaries in a spritesheet by finding vertical columns
 * that are entirely (or nearly) background-white.
 */
import sharp from 'sharp';

const WHITE = 240;

async function detectFrames(imgPath) {
  const { data, info } = await sharp(imgPath).raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  // For each column, check if every pixel is background
  const separators = [];
  for (let x = 0; x < width; x++) {
    let allBg = true;
    for (let y = 0; y < height; y++) {
      const i = (y * width + x) * channels;
      const r = data[i], g = data[i+1], b = data[i+2], a = channels === 4 ? data[i+3] : 255;
      if (a >= 10 && !(r > WHITE && g > WHITE && b > WHITE)) { allBg = false; break; }
    }
    if (allBg) separators.push(x);
  }

  // Collapse consecutive separator columns into ranges
  const ranges = [];
  let start = separators[0];
  let prev  = separators[0];
  for (let i = 1; i < separators.length; i++) {
    if (separators[i] !== prev + 1) {
      ranges.push({ start, end: prev });
      start = separators[i];
    }
    prev = separators[i];
  }
  ranges.push({ start, end: prev });

  // Frame boundaries are the gaps BETWEEN separator ranges
  const frames = [];
  let frameStart = 0;
  for (const sep of ranges) {
    if (sep.start > frameStart) frames.push({ x: frameStart, w: sep.start - frameStart });
    frameStart = sep.end + 1;
  }
  if (frameStart < width) frames.push({ x: frameStart, w: width - frameStart });

  console.log(`${imgPath}`);
  console.log(`  Image: ${width}×${height}`);
  console.log(`  Separator ranges: ${ranges.length}`);
  console.log(`  Detected ${frames.length} frames:`);
  frames.forEach((f, i) => console.log(`    [${i}] x=${f.x}, w=${f.w}`));
  console.log();
  return frames;
}

await detectFrames('public/assets/manual imports/skeleton-run.png');
await detectFrames('public/assets/manual imports/skeleton-attack.png');
