// ============================================================
// Sprite-sheet capture — renders every tile / character / monster
// canvas from window.__gfx into contact sheets for visual QA.
// Usage: NODE_PATH=/home/z/.npm-global/lib/node_modules node scripts/media/sprite-sheet.cjs
// ============================================================
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { launchGame, sleep } = require('./lib.cjs');

const OUT = path.join(__dirname, 'out', 'sheets');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const K = 3; // upscale factor for inspection

(async () => {
  const { browser, page } = await launchGame();
  await sleep(600);

  // ---- Sheet 1: tiles ----
  const tileInfo = await page.evaluate(() => {
    const { TILES, TILE_VARIANTS } = window.__gfx;
    const keys = Object.keys(TILES);
    return { keys, variantKeys: Object.keys(TILE_VARIANTS) };
  });
  const tileSheet = await page.evaluate((K) => {
    const { TILES, TILE_VARIANTS } = window.__gfx;
    const keys = Object.keys(TILES);
    const cell = 16 * K + 4;
    const perRow = 10;
    const rows = Math.ceil(keys.length / perRow);
    const cv = document.createElement('canvas');
    cv.width = perRow * cell; cv.height = rows * cell;
    const g = cv.getContext('2d');
    g.fillStyle = '#555555';
    g.fillRect(0, 0, cv.width, cv.height);
    keys.forEach((k, i) => {
      const a = TILES[k];
      const img = Array.isArray(a) ? a[0] : a;
      g.imageSmoothingEnabled = false;
      g.drawImage(img, (i % perRow) * cell + 2, Math.floor(i / perRow) * cell + 2, 16 * K, 16 * K);
    });
    return { url: cv.toDataURL('image/png'), keys };
  }, K);
  await sharp(Buffer.from(tileSheet.url.split(',')[1], 'base64'))
    .png().toFile(path.join(OUT, 'tiles.png'));
  fs.writeFileSync(path.join(OUT, 'tiles-keys.txt'), tileSheet.keys.join('\n'));

  // ---- Sheet 2: player + NPCs ----
  const charSheet = await page.evaluate((K) => {
    const { PLAYER, NPCS } = window.__gfx;
    const pKeys = Object.keys(PLAYER);
    const nKeys = Object.keys(NPCS);
    const all = [...pKeys.map((k) => ['P:' + k, PLAYER[k]]), ...nKeys.map((k) => ['N:' + k, NPCS[k]])];
    const cell = 16 * K + 4;
    const perRow = 8;
    const rows = Math.ceil(all.length / perRow);
    const cv = document.createElement('canvas');
    cv.width = perRow * cell; cv.height = rows * cell;
    const g = cv.getContext('2d');
    g.fillStyle = '#555555';
    g.fillRect(0, 0, cv.width, cv.height);
    all.forEach(([, img], i) => {
      g.imageSmoothingEnabled = false;
      g.drawImage(img, (i % perRow) * cell + 2, Math.floor(i / perRow) * cell + 2, 16 * K, 16 * K);
    });
    return { url: cv.toDataURL('image/png'), keys: all.map(([k]) => k) };
  }, K);
  await sharp(Buffer.from(charSheet.url.split(',')[1], 'base64'))
    .png().toFile(path.join(OUT, 'chars.png'));
  fs.writeFileSync(path.join(OUT, 'chars-keys.txt'), charSheet.keys.join('\n'));

  // ---- Sheet 3: monsters ----
  const monSheet = await page.evaluate((K) => {
    const { MONSTER_GFX } = window.__gfx;
    const keys = Object.keys(MONSTER_GFX);
    const cellW = 48 * K + 8;
    const cellH = 48 * K + 8;
    const perRow = 6;
    const rows = Math.ceil(keys.length / perRow);
    const cv = document.createElement('canvas');
    cv.width = perRow * cellW; cv.height = rows * cellH;
    const g = cv.getContext('2d');
    g.fillStyle = '#555555';
    g.fillRect(0, 0, cv.width, cv.height);
    keys.forEach((k, i) => {
      const img = MONSTER_GFX[k];
      g.imageSmoothingEnabled = false;
      g.drawImage(img, (i % perRow) * cellW + 4, Math.floor(i / perRow) * cellH + 4, img.width * K / 2, img.height * K / 2);
    });
    return { url: cv.toDataURL('image/png'), keys };
  }, K);
  await sharp(Buffer.from(monSheet.url.split(',')[1], 'base64'))
    .png().toFile(path.join(OUT, 'monsters.png'));
  fs.writeFileSync(path.join(OUT, 'monsters-keys.txt'), monSheet.keys.join('\n'));

  console.log('tiles:', tileSheet.keys.join(', '));
  console.log('variants:', tileInfo.variantKeys.join(', '));
  console.log('chars:', charSheet.keys.join(', '));
  console.log('monsters:', monSheet.keys.join(', '));
  await browser.close();
  console.log('Sheets written to', OUT);
})().catch((e) => { console.error(e); process.exit(1); });
