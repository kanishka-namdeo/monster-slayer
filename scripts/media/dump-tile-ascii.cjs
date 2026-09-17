// Dump actual rendered tile pixels as ASCII to verify sprite integrity.
// Usage: NODE_PATH=/home/z/.npm-global/lib/node_modules node scripts/media/dump-tile-ascii.cjs
const { launchGame, sleep } = require('./lib.cjs');

const DUMP = process.argv.slice(2); // tile names

(async () => {
  const { browser, page } = await launchGame();
  await sleep(600);
  const out = await page.evaluate((names) => {
    const { TILES } = window.__gfx;
    const res = {};
    for (const n of names) {
      const a = TILES[n];
      const img = Array.isArray(a) ? a[0] : a;
      const g = img.getContext('2d');
      const d = g.getImageData(0, 0, img.width, img.height).data;
      const map = { '#0f380f': '0', '#306230': '1', '#8bac0f': '2', '#9bbc0f': '3' };
      const rows = [];
      for (let y = 0; y < img.height; y++) {
        let row = '';
        for (let x = 0; x < img.width; x++) {
          const i = (y * img.width + x) * 4;
          const hex = '#' + [d[i], d[i + 1], d[i + 2]].map((v) => v.toString(16).padStart(2, '0')).join('');
          row += map[hex] ?? (d[i + 3] < 128 ? '.' : '?');
        }
        rows.push(row);
      }
      res[n] = rows;
    }
    return res;
  }, DUMP);
  for (const [name, rows] of Object.entries(out)) {
    console.log(`--- ${name} ---`);
    rows.forEach((r) => console.log(r));
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
