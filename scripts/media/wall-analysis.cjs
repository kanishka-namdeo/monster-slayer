// ============================================================
// Wall/ground blending analysis — BEFORE/AFTER shots
// Captures the village houses at native 160x144 + x8 zoomed
// crops of the wall-to-ground boundary regions.
//
// Usage: NODE_PATH=/home/z/.npm-global/lib/node_modules node scripts/media/wall-analysis.cjs <tag>
//   tag = before | after  (used in filenames)
// ============================================================
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { launchGame, sleep } = require('./lib.cjs');

const TAG = process.argv[2] || 'before';
const OUT = path.join(__dirname, 'out', 'wall-analysis');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

async function snap(page, name, { wait = 400, scale = 4 } = {}) {
  await sleep(wait);
  const b64 = await page.evaluate(() => document.querySelector('canvas').toDataURL('image/png'));
  const buf = Buffer.from(b64.split(',')[1], 'base64');
  const file = path.join(OUT, `${TAG}-${name}.png`);
  await sharp(buf).resize(160 * scale, 144 * scale, { kernel: 'nearest' }).png().toFile(file);
  console.log(`shot: ${TAG}-${name}.png`);
  return buf; // native-res buffer
}

// Crop a region from the native 160x144 canvas, upscale x8 for inspection
async function crop(buf, name, x, y, w, h, scale = 8) {
  const file = path.join(OUT, `${TAG}-${name}.png`);
  await sharp(buf).extract({ left: x, top: y, width: w, height: h })
    .resize(w * scale, h * scale, { kernel: 'nearest' }).png().toFile(file);
  console.log(`crop: ${TAG}-${name}.png (${w}x${h} @ ${x},${y})`);
}

(async () => {
  const { browser, page } = await launchGame();

  // enter world, fresh state
  await page.evaluate(() => {
    const g = window.__game;
    g.newGame();
    g.mode = 'world';
    g.dialog = null;
  });

  // ---- Scene 1: stand below the elder's house (door front) ----
  // House occupies x=2..6, y=3..6; wall row y=6; grass below y=7.
  // Player at (4,8): camera centers player -> view x=0..9, y=4..12
  await page.evaluate(() => {
    const g = window.__game;
    g.switchMap('village', 4, 8, 'up');
  });
  const b1 = await snap(page, 'house-front', { wait: 500 });
  // zoom: wall row bottom edge meeting grass (house left edge x=2..7, wall row y=6)
  // screen coords: tile (2,6) -> px (32, 96); grab wall row + 2 grass rows
  await crop(b1, 'zoom-wall-bottom', 32, 80, 80, 48);
  // zoom: left side of house (roofedge/wall vertical border vs grass)
  await crop(b1, 'zoom-house-left', 16, 48, 48, 64);

  // ---- Scene 2: between the two houses (both visible) ----
  await page.evaluate(() => {
    const g = window.__game;
    g.switchMap('village', 10, 8, 'down');
  });
  const b2 = await snap(page, 'village-center', { wait: 500 });
  await crop(b2, 'zoom-two-houses', 0, 32, 160, 80);

  // ---- Scene 3: bottom-right house from grass ----
  await page.evaluate(() => {
    const g = window.__game;
    g.switchMap('village', 17, 16, 'up');
  });
  const b3 = await snap(page, 'house-grass', { wait: 500 });
  await crop(b3, 'zoom-grass-adjacent', 112, 128, 48, 16);

  // ---- Scene 4: interior wall vs floor ----
  await page.evaluate(() => {
    const g = window.__game;
    g.switchMap('elder', 5, 4, 'up');
  });
  await snap(page, 'interior', { wait: 500 });

  await browser.close();
  console.log('DONE');
})().catch((e) => { console.error('FAILED:', e); process.exit(1); });
