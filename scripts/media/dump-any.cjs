// Dump rendered TILE + PLAYER + NPC canvases as ASCII (pixel ground truth).
// Usage: node scripts/media/dump-any.cjs tile:roof tile:chimney player:down0 ...
const { launchGame, sleep } = require('./lib.cjs');

const args = process.argv.slice(2);

(async () => {
  const { browser, page } = await launchGame();
  await sleep(400);
  const out = await page.evaluate((specs) => {
    const { TILES, PLAYER, NPCS } = window.__gfx;
    const map = { '#0f380f': '0', '#306230': '1', '#8bac0f': '2', '#9bbc0f': '3' };
    const dump = (img, frame) => {
      const im = frame !== undefined ? img[frame] : img;
      const g = im.getContext('2d');
      const d = g.getImageData(0, 0, im.width, im.height).data;
      const rows = [];
      for (let y = 0; y < im.height; y++) {
        let row = '';
        for (let x = 0; x < im.width; x++) {
          const i = (y * im.width + x) * 4;
          const hex = '#' + [d[i], d[i + 1], d[i + 2]].map((v) => v.toString(16).padStart(2, '0')).join('');
          row += map[hex] ?? (d[i + 3] < 128 ? '.' : '?');
        }
        rows.push(row);
      }
      return rows;
    };
    const res = {};
    for (const s of specs) {
      const [kind, name, fr] = s.split(':');
      const frame = fr !== undefined ? parseInt(fr, 10) : undefined;
      if (kind === 'tile') {
        const a = TILES[name];
        if (!a) { res[s] = ['MISSING']; continue; }
        if (Array.isArray(a)) { for (let f = 0; f < a.length; f++) res[`${s}#${f}`] = dump(a[f]); }
        else res[s] = dump(a);
      } else if (kind === 'player') {
        res[s] = dump(PLAYER[name]);
      } else if (kind === 'npc') {
        res[s] = dump(NPCS[name]);
      }
    }
    return res;
  }, args);
  for (const [name, rows] of Object.entries(out)) {
    console.log(`--- ${name} ---`);
    rows.forEach((r) => console.log(r));
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
