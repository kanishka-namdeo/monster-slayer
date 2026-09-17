// Exact pixel ground-truth at wall↔ground seams, with real camera coords.
const { launchGame, sleep, pressKey } = require('./lib.cjs');

(async () => {
  const { browser, page } = await launchGame();
  await pressKey(page, 'start', 120);
  await pressKey(page, 'a', 100);

  await page.evaluate(`(() => {
    const g = window.__game;
    g.mode = 'world';
    g.switchMap('village', 4, 8, 'up');
    g.mapBannerT = 0; g.moving = false; g.moveT = 0;
  })()`);
  await sleep(400);

  const dump = await page.evaluate(`(() => {
    const g = window.__game;
    const cam = g.camera();
    const cv = document.querySelector('canvas');
    const ctx = cv.getContext('2d');
    const id = ctx.getImageData(0, 0, cv.width, cv.height).data;

    const PALN = ['INK', 'DK', 'LT', 'PP'];
    // calibrate 4 shades from known palette hexes in window.C or constants
    const C = (window.C || {});
    // fall back: sample known tile pixels. Use luminance clustering instead.
    const lum = (i) => 0.299 * id[i] + 0.587 * id[i + 1] + 0.114 * id[i + 2];
    // collect lums of a few known points: player hair (paper), tree (dark)...
    const all = [];
    for (let y = 0; y < cv.height; y += 7) for (let x = 0; x < cv.width; x += 7) all.push(lum((y * cv.width + x) * 4));
    all.sort((a, b) => a - b);
    const pick = (f) => all[Math.floor(f * (all.length - 1))];
    const reps = [pick(0.02), pick(0.35), pick(0.68), pick(0.97)];
    const shade = (x, y) => {
      const l = lum((y * cv.width + x) * 4);
      let bi = 0, bd = 1e9;
      for (let i = 0; i < 4; i++) { const d = Math.abs(reps[i] - l); if (d < bd) { bd = d; bi = i; } }
      return bi;
    };

    // elder house: wall row = map row 6, wall cols 2..6. Player (4,8).
    // screen coords: sx = mapX*16 - cam.camX
    const S = (mx) => mx * 16 - cam.camX;
    const T = (my) => my * 16 - cam.camY;
    const out = { cam, bands: {} };

    const strip = (x0, x1, y0, y1) => {
      const rows = [];
      for (let y = y0; y <= y1; y++) {
        let s = '';
        for (let x = x0; x <= x1; x++) s += '' + shade(x, y);
        rows.push(s);
      }
      return rows;
    };

    // LEFT edge of wall block: between map col1 (grass) and col2 (wall)
    const L = S(2);
    out.bands.leftEdge = strip(L - 3, L + 3, T(6), T(7) - 1);   // full wall tile height
    // RIGHT edge: wall col 6 ends at S(7)-1
    const R = S(7);
    out.bands.rightEdge = strip(R - 3, R + 2, T(6), T(7) - 1);
    // BOTTOM edge: wall row 6 ends at T(7)-1; grass row 7 starts T(7)
    out.bands.bottomEdge = strip(S(2), S(7) - 1, T(7) - 3, T(7) + 3);  // 3 rows above/below seam across full facade
    // also door bottom specifically: door tile is map (4,6)
    out.bands.doorBottom = strip(S(4), S(5) - 1, T(7) - 3, T(7) + 3);
    // eave row bottom (row5) meets wall row6? no - same building. skip.
    // wall vs path: map row 7 col 3 = 'p' path below wall col 3
    out.bands.wallToPath = strip(S(3), S(4) - 1, T(7) - 3, T(7) + 3);
    return JSON.stringify(out);
  })()`);
  const d = JSON.parse(dump);
  console.log('camera', JSON.stringify(d.cam));
  const show = (name, band) => {
    console.log('\n== ' + name + ' ==   (0=INK 1=DARK 2=LIGHT 3=PAPER; rows top→bottom)');
    for (const r of band) console.log('  ' + r);
  };
  show('LEFT EDGE  (3px grass | wall cols, full 16 rows)', d.bands.leftEdge);
  show('RIGHT EDGE (wall | 3px grass, full 16 rows)', d.bands.rightEdge);
  show('BOTTOM EDGE across facade (3 rows wall .. seam .. 3 rows grass)', d.bands.bottomEdge);
  show('DOOR BOTTOM (door col, seam ±3)', d.bands.doorBottom);
  show('WALL→PATH (wall col3 over path, seam ±3)', d.bands.wallToPath);

  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
