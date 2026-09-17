// ============================================================
// Pixel analysis: quantifies wall vs ground color blending
// Reads a native 160x144 canvas shot and reports shade usage
// in known tile regions (wall interior, grass, roofedge band).
// ============================================================
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const PAL = { '#0f380f': 'INK(0)', '#306230': 'DARK(1)', '#8bac0f': 'LIGHT(2)', '#9bbc0f': 'PAPER(3)' };

async function regionStats(name, buf, x, y, w, h) {
  const { data } = await sharp(buf).extract({ left: x, top: y, width: w, height: h }).raw().toBuffer({ resolveWithObject: true });
  const counts = {};
  for (let i = 0; i < data.length; i += 4) {
    const hex = '#' + [data[i], data[i + 1], data[i + 2]].map(v => v.toString(16).padStart(2, '0')).join('');
    counts[hex] = (counts[hex] || 0) + 1;
  }
  const total = w * h;
  const rows = Object.entries(counts).sort((a, b) => b[1] - a[1])
    .map(([hex, n]) => `${PAL[hex] || hex}: ${(100 * n / total).toFixed(1)}%`);
  console.log(`[${name}] ${w}x${h} @(${x},${y}) -> ${rows.join(' | ')}`);
}

(async () => {
  const file = process.argv[2];
  const buf = fs.readFileSync(file);

  // house-front shot: player at (4,8) facing up. Village rows 4..12 visible.
  // House: x=2..6, y=3..6. Wall row y=6 -> screen y = (6-4)*16 = 32..47.
  // Roofedge row y=5 -> screen y=16..31. Roof rows y=3,4 -> offscreen top (row 3 partially: y=4 visible => screen y=0..15)
  // Grass row y=7 -> screen y=48..63. Wall x=2..6 -> screen x=32..111.

  // Wall interior (W tile at map 4,6 => screen x=64..79, y=32..47)
  await regionStats('WALL tile (4,6) interior', buf, 65, 33, 14, 14);
  // Roofedge band interior (map (3,5) => screen x=48..63, y=16..31)
  await regionStats('ROOFEDGE band (3,5)', buf, 48, 17, 16, 13);
  // Grass tile below house (map (4,7) => screen x=64..79, y=48..63)
  await regionStats('GRASS below wall (4,7)', buf, 64, 49, 16, 14);
  // Grass tile left of house (map (1,5) => x=16..31, y=16..31)
  await regionStats('GRASS left of house (1,5)', buf, 17, 17, 14, 14);
  // Path tile (p at 4,8 => x=64..79, y=64..79)
  await regionStats('PATH (4,8)', buf, 64, 65, 16, 14);
})().catch(e => { console.error(e); process.exit(1); });
