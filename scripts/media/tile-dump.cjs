// ============================================================
// Dumps the dominant palette shade per 16x16 tile of a native
// 160x144 canvas shot. Prints an ASCII map: P=paper L=light
// D=dark I=ink  (dominant shade per tile)
// ============================================================
const fs = require('fs');
const sharp = require('sharp');

const CLOSE = { I: [15, 56, 15], D: [48, 98, 48], L: [139, 172, 15], P: [155, 188, 15] };

function classify(r, g, b) {
  let best = null, bd = 1e9;
  for (const [k, [cr, cg, cb]] of Object.entries(CLOSE)) {
    const d = (r - cr) ** 2 + (g - cg) ** 2 + (b - cb) ** 2;
    if (d < bd) { bd = d; best = k; }
  }
  return best;
}

(async () => {
  const file = process.argv[2];
  const { data, info } = await sharp(fs.readFileSync(file)).raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const lines = [];
  for (let ty = 0; ty + 16 <= H; ty += 16) {
    let line = '';
    for (let tx = 0; tx + 16 <= W; tx += 16) {
      const counts = { I: 0, D: 0, L: 0, P: 0 };
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const i = ((ty + y) * W + (tx + x)) * 4;
          counts[classify(data[i], data[i + 1], data[i + 2])]++;
        }
      }
      line += Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
    }
    lines.push(`${String(ty / 16).padStart(2)} ${line}`);
  }
  console.log(`   ${'0123456789'.repeat(Math.ceil(W / 16))}`);
  console.log(lines.join('\n'));
})().catch(e => { console.error(e); process.exit(1); });
