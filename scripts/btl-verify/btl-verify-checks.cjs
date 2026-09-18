// BTL-verify follow-up pixel checks: bar origins (correct palette), QUEN blink,
// bracket coordinates, platform presence, PRESS A presence.
const sharp = require('sharp');
const OUT = '/home/z/my-project/scripts/btl-verify/out';
const PAL = { INK: [15, 56, 15], DARK: [48, 98, 48], LIGHT: [139, 172, 15], PAPER: [155, 188, 15] };

async function raw(file) {
  const { data, info } = await sharp(`${OUT}/${file}`).raw().toBuffer({ resolveWithObject: true });
  return { w: info.width, h: info.height, ch: info.channels, data };
}
const pxAt = (im, x, y) => {
  const i = (y * im.w + x) * im.ch;
  return [im.data[i], im.data[i + 1], im.data[i + 2]];
};
const palOf = (p) => {
  for (const [k, v] of Object.entries(PAL)) if (v[0] === p[0] && v[1] === p[1] && v[2] === p[2]) return k;
  return null;
};
async function diffRegion(a, b, x0, y0, x1, y1) {
  const A = await raw(a), B = await raw(b);
  const pts = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const i = (y * A.w + x) * A.ch;
    if (A.data[i] !== B.data[i] || A.data[i + 1] !== B.data[i + 1] || A.data[i + 2] !== B.data[i + 2]) pts.push([x, y]);
  }
  return { changed: pts.length, pts };
}

(async () => {
  // ---- 1. bar origins (palette-aware): first non-PAPER pixel from x=98 in the player box ----
  const M = await raw('004_A_menu.png');
  const firstNonPaper = (y, xFrom, xTo) => {
    for (let x = xFrom; x <= xTo; x++) { const p = pxAt(M, x, y); if (palOf(p) !== 'PAPER') return { x, pal: palOf(p) }; }
    return null;
  };
  console.log('player HP bar row y=69 :', JSON.stringify(firstNonPaper(69, 98, 120)), '(expect x=102 INK border)');
  console.log('player STA bar row y=79:', JSON.stringify(firstNonPaper(79, 98, 120)), '(expect x=102 INK border)');
  console.log('enemy HP bar row y=21 :', JSON.stringify(firstNonPaper(21, 20, 30)), '(enemy bar at x=24)');

  // ---- 2. QUEN blink across the 3 persist frames ----
  const p1 = await diffRegion('021_D_quen_persist_1.png', '022_D_quen_persist_2.png', 8, 54, 54, 96);
  const p3 = await diffRegion('021_D_quen_persist_1.png', '023_D_quen_persist_3.png', 8, 54, 54, 96);
  const p2 = await diffRegion('022_D_quen_persist_2.png', '023_D_quen_persist_3.png', 8, 54, 54, 96);
  const m1 = await diffRegion('004_A_menu.png', '021_D_quen_persist_1.png', 8, 54, 54, 96);
  const m2 = await diffRegion('004_A_menu.png', '022_D_quen_persist_2.png', 8, 54, 54, 96);
  const m3 = await diffRegion('004_A_menu.png', '023_D_quen_persist_3.png', 8, 54, 54, 96);
  console.log(`quen persist diffs 1v2=${p1.changed} 1v3=${p3.changed} 2v3=${p2.changed}`);
  console.log(`quen vs plain menu  1=${m1.changed} 2=${m2.changed} 3=${m3.changed} px (bracket overlay)`);
  if (m1.pts.length) {
    const xs = m1.pts.map((p) => p[0]), ys = m1.pts.map((p) => p[1]);
    console.log(`bracket-ish changed-px bbox: x ${Math.min(...xs)}-${Math.max(...xs)}, y ${Math.min(...ys)}-${Math.max(...ys)}`);
  }

  // ---- 3. platform under the witcher (LIGHT band at y86-87, x10-50) ----
  const A0 = await raw('000_A_intro_t0.png');
  const Am = M;
  let plat = 0, platX = [];
  for (let x = 10; x <= 50; x++) { const p = palOf(pxAt(Am, x, 86)); if (p === 'LIGHT') { plat++; platX.push(x); } }
  console.log(`platform LIGHT px on menu y=86: ${plat}/41 (x ${platX[0] ?? '-'}..${platX[platX.length - 1] ?? '-'})`);
  let plat0 = 0;
  for (let x = 10; x <= 50; x++) { if (palOf(pxAt(A0, x, 86)) === 'LIGHT') plat0++; }
  console.log(`same row on intro t0 (mid-slide): ${plat0} px (platform arrives with the witcher)`);

  // ---- 4. PRESS A on the gameover frame (LIGHT text pixels y122-132, x56-104) ----
  const G = await raw('068_I_gameover_2500.png');
  let pressA = 0;
  for (let y = 122; y <= 132; y++) for (let x = 56; x <= 104; x++) { if (palOf(pxAt(G, x, y)) === 'LIGHT') pressA++; }
  console.log(`gameover 'PRESS A' LIGHT px count: ${pressA} (text present if >20)`);
  // looming monster: monster-slot pixels INK/DARK in the center band
  let mon = 0;
  for (let y = 40; y <= 84; y++) for (let x = 56; x <= 104; x++) { const k = palOf(pxAt(G, x, y)); if (k === 'INK' || k === 'DARK') mon++; }
  console.log(`gameover looming-monster dark px: ${mon}`);
  // GAME OVER title: PAPER pixels near y12
  let title = 0;
  for (let y = 4; y <= 24; y++) for (let x = 20; x <= 140; x++) { if (palOf(pxAt(G, x, y)) === 'PAPER') title++; }
  console.log(`gameover title PAPER px: ${title}`);
})().catch((e) => { console.error(e); process.exit(1); });
