// ============================================================
// Pixel art: tiles + player witcher + NPCs
// Chars: '.'=transparent 0=ink 1=dark 2=light 3=paper(lightest)
// ============================================================
import { PAL } from './constants';

export type Rows = string[];

/** Build a sprite canvas from string rows. */
export function makeSprite(rows: Rows, w = 16, h = rows.length): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const g = cv.getContext('2d')!;
  for (let y = 0; y < h; y++) {
    const row = rows[y] ?? '';
    for (let x = 0; x < w; x++) {
      const ch = row[x];
      if (ch === undefined || ch === '.') continue;
      const col = (PAL as Record<string, string>)[ch];
      if (!col) continue;
      g.fillStyle = col;
      g.fillRect(x, y, 1, 1);
    }
  }
  return cv;
}

/** Complete a symmetric sprite: given LEFT HALF rows, mirror them. */
export function mirror(left: Rows, half: number): Rows {
  return left.map((r) => {
    const padded = (r + '.'.repeat(half)).slice(0, half);
    const rev = padded.split('').reverse().join('');
    return padded + rev;
  });
}

// deterministic PRNG for texture tiles
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function texTile(base: string, seed: number, dots: { color: string; n: number }[], w = 16, h = 16): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const g = cv.getContext('2d')!;
  g.fillStyle = PAL[base as keyof typeof PAL];
  g.fillRect(0, 0, w, h);
  const rand = rng(seed);
  for (const d of dots) {
    g.fillStyle = PAL[d.color as keyof typeof PAL];
    for (let i = 0; i < d.n; i++) {
      const x = Math.floor(rand() * w);
      const y = Math.floor(rand() * h);
      g.fillRect(x, y, 1, 1);
    }
  }
  return cv;
}

/** Hand-placed texture tile: base fill + explicit pixel stamps [x,y,w,h,color].
 *  Ordered, deliberate dithering in the classic GB tradition (no random speckle). */
function handTile(base: string, stamps: Array<[number, number, number, number, string]>): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = 16; cv.height = 16;
  const g = cv.getContext('2d')!;
  g.fillStyle = PAL[base as keyof typeof PAL];
  g.fillRect(0, 0, 16, 16);
  for (const [x, y, w, h, color] of stamps) {
    g.fillStyle = PAL[color as keyof typeof PAL];
    g.fillRect(x, y, w, h);
  }
  return cv;
}

/** Pixel-exact copy of a tile canvas, for stamping variants. */
function cloneTile(src: HTMLCanvasElement): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = src.width; cv.height = src.height;
  const g = cv.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  g.drawImage(src, 0, 0);
  return cv;
}

// ------------------------------------------------------------
// TILES (char → canvas). Animated tiles get frame arrays.
// ------------------------------------------------------------
export const TILES: Record<string, HTMLCanvasElement | HTMLCanvasElement[]> = {};
/** Deterministic per-position terrain variants (GB-style repetition breaker).
 *  Engine picks via a stable (tx,ty) hash so the pattern never flickers. */
export const TILE_VARIANTS: Record<string, HTMLCanvasElement[]> = {};

/** map char → TILES key */
export const TILE_KEY: Record<string, string> = {
  '.': 'grass', ',': 'flowers', 'T': 'tree', 'P': 'pine', 'f': 'fence',
  'R': 'reeds', 'n': 'darkgrass', '~': 'water', 'o': 'swampw', 'p': 'path',
  'm': 'mud', '=': 'bridge', 'x': 'bones', 'W': 'wall', 'w': 'window',
  'r': 'roof', 'e': 'roofedge', 'D': 'door', 'F': 'floor', '#': 'intwall',
  'b': 'bed', 't': 'table', 'c': 'counter', 's': 'shelf', 'B': 'board',
  'g': 'grave1', 'G': 'grave2', 'u': 'well', 'a': 'anvil', 'l': 'cauldron',
  'k': 'barrel', 'K': 'bookshelf', 'S': 'shrine', 'z': 'thorns', 'q': 'rock',
  'L': 'stump', 'v': 'void',
  'M': 'mountain', 'i': 'scree', 'Y': 'ruinwall', 'y': 'crackfloor', 'A': 'arch',
  'C': 'chimney', 'h': 'signInn', 'H': 'signSmith', 'j': 'signHerb', 'J': 'signElder',
  'X': 'hearth', 'V': 'intwindow', 'Z': 'picture', 'O': 'crate', 'U': 'woodpile',
  'N': 'haystack',
};

function buildTiles() {
  // grass: hand-placed tufts (ordered GB dithering — no random speckle).
  // Tufts are 2px blades (v-shapes), never single-pixel dots.
  const grassA = handTile('3', [
    [2, 5, 2, 1, '2'], [5, 5, 1, 2, '2'], [4, 4, 1, 1, '2'],
    [9, 10, 2, 1, '2'], [12, 10, 1, 2, '2'], [11, 9, 1, 1, '2'],
    [7, 2, 2, 1, '2'], [14, 7, 1, 2, '2'],
    [1, 8, 1, 1, '1'], [13, 2, 1, 1, '1'], [6, 13, 1, 1, '1'], [2, 12, 1, 1, '1'],
  ]);
  const grassB = handTile('3', [
    [2, 3, 2, 1, '2'], [11, 6, 2, 1, '2'], [5, 12, 2, 1, '2'], [4, 11, 1, 2, '2'],
    [8, 1, 2, 1, '2'], [13, 9, 2, 1, '2'], [12, 8, 1, 2, '2'],
    [4, 8, 1, 1, '1'], [14, 13, 1, 1, '1'], [7, 15, 1, 1, '1'],
  ]);
  const grassC = handTile('3', [
    [6, 6, 2, 1, '2'], [12, 12, 2, 1, '2'], [14, 8, 1, 2, '2'], [9, 3, 2, 1, '2'], [8, 2, 1, 2, '2'],
    [2, 13, 2, 1, '2'], [4, 1, 1, 1, '2'],
    [3, 9, 1, 1, '1'], [10, 14, 1, 1, '1'],
  ]);
  TILES.grass = grassA;
  TILE_VARIANTS.grass = [grassA, grassA, grassB, grassC];

  // flowers: grass base + hand plus-blooms, 2-frame sway
  const flowersFrame = (dx: number) => {
    const cv = cloneTile(grassA);
    const g = cv.getContext('2d')!;
    const blooms: [number, number][] = [[4, 4], [11, 10], [7, 13]];
    g.fillStyle = PAL[0];
    for (const [cx, cy] of blooms) {
      g.fillRect(cx + dx, cy - 1, 1, 1);
      g.fillRect(cx - 1 + dx, cy, 1, 1);
      g.fillRect(cx + 1 + dx, cy, 1, 1);
      g.fillRect(cx + dx, cy + 1, 1, 1);
    }
    g.fillStyle = PAL[2];
    for (const [cx, cy] of blooms) g.fillRect(cx + dx, cy, 1, 1);
    return cv;
  };
  TILES.flowers = [flowersFrame(0), flowersFrame(1)];
  // reeds (encounter tile): grass base + tall blades, 2-frame sway
  const reedsFrame = (shift: number) => {
    const cv = cloneTile(grassA);
    const g = cv.getContext('2d')!;
    const blades: [number, number, number][] = [[2, 5, 8], [4, 3, 10], [6, 6, 7], [8, 4, 9], [10, 6, 8], [12, 3, 10], [14, 5, 8]];
    for (const [x, y, len] of blades) {
      // top 3 rows bend with the wind, the rest stays anchored
      g.fillStyle = PAL[1];
      g.fillRect(x + shift, y, 1, 3);
      g.fillRect(x, y + 3, 1, len - 3);
      g.fillStyle = PAL[0];
      g.fillRect(x + 1 + shift, y + 2, 1, 1);
      g.fillRect(x + 1, y + 3, 1, Math.max(1, len - 5));
      g.fillStyle = PAL[2];
      g.fillRect(x - 1, y + 1, 1, 3);
    }
    g.fillStyle = PAL[0];
    g.fillRect(3 + shift, 2, 1, 4); g.fillRect(9 + shift, 1, 1, 5); g.fillRect(13 + shift, 2, 1, 4);
    return cv;
  };
  TILES.reeds = [reedsFrame(0), reedsFrame(1)];

  // dark grass (forest encounter): clean base + ink blades, 2 variants
  const darkGrassTile = (blades: [number, number, number][]) => {
    const cv = document.createElement('canvas');
    cv.width = 16; cv.height = 16;
    const g = cv.getContext('2d')!;
    g.fillStyle = PAL[2];
    g.fillRect(0, 0, 16, 16);
    for (const [x, y, len] of blades) {
      g.fillStyle = PAL[0];
      g.fillRect(x, y, 1, len);
      g.fillStyle = PAL[1];
      g.fillRect(x + 1, y + 1, 1, len - 2);
    }
    return cv;
  };
  TILES.darkgrass = darkGrassTile([[2, 6, 7], [5, 4, 9], [8, 7, 6], [11, 5, 8], [14, 6, 7], [12, 2, 4], [6, 2, 3]]);
  TILE_VARIANTS.darkgrass = [
    TILES.darkgrass as HTMLCanvasElement,
    TILES.darkgrass as HTMLCanvasElement,
    darkGrassTile([[3, 5, 8], [6, 3, 9], [9, 8, 5], [13, 4, 7], [11, 9, 6], [4, 11, 4]]),
  ];

  // water: 3 frames — wave lines travel 1px per frame (no double-line artifact)
  const waterFrame = (off: number) => {
    const cv = document.createElement('canvas');
    cv.width = 16; cv.height = 16;
    const g = cv.getContext('2d')!;
    g.fillStyle = PAL[2];
    g.fillRect(0, 0, 16, 16);
    g.fillStyle = PAL[1];
    for (let y = 0; y < 16; y += 4) {
      const yy = (y + off) % 16;
      g.fillRect(0, yy, 16, 1);
      g.fillStyle = PAL[3];
      g.fillRect((off * 4 + y * 2 + 2) % 13, yy + 1, 3, 1);
      g.fillRect((off * 4 + y * 2 + 9) % 13, (yy + 2) % 16, 4, 1);
      g.fillStyle = PAL[1];
    }
    return cv;
  };
  TILES.water = [waterFrame(0), waterFrame(1), waterFrame(2)];

  // swamp water: murkier — lines 4px apart drifting 1px/frame (fixes the old
  // adjacent double-line band caused by the y+=5 wrap)
  const swampFrame = (off: number) => {
    const cv = document.createElement('canvas');
    cv.width = 16; cv.height = 16;
    const g = cv.getContext('2d')!;
    g.fillStyle = PAL[1];
    g.fillRect(0, 0, 16, 16);
    g.fillStyle = PAL[0];
    for (let y = 0; y < 16; y += 4) {
      const yy = (y + off) % 16;
      g.fillRect(0, yy, 16, 1);
      g.fillStyle = PAL[2];
      g.fillRect((off * 5 + y * 2 + 3) % 13, (yy + 2) % 16, 3, 1);
      g.fillStyle = PAL[0];
    }
    return cv;
  };
  TILES.swampw = [swampFrame(0), swampFrame(1), swampFrame(2)];

  // path: packed dirt — clearly darker than grass. Cart pebbles + dry glints.
  const pathA = handTile('2', [
    [3, 4, 2, 1, '1'], [11, 3, 2, 1, '1'], [6, 9, 2, 1, '1'], [13, 12, 2, 1, '1'], [1, 7, 2, 1, '1'],
    [8, 13, 1, 1, '1'], [14, 5, 1, 1, '1'], [4, 1, 1, 1, '1'],
    [5, 2, 1, 1, '3'], [9, 11, 1, 1, '3'], [2, 14, 1, 1, '3'], [12, 7, 1, 1, '3'], [7, 5, 1, 1, '3'],
  ]);
  const pathB = handTile('2', [
    [5, 5, 2, 1, '1'], [12, 9, 2, 1, '1'], [2, 3, 2, 1, '1'], [9, 13, 2, 1, '1'],
    [14, 2, 1, 1, '1'], [0, 11, 1, 1, '1'], [7, 7, 1, 1, '1'],
    [3, 8, 1, 1, '3'], [11, 6, 1, 1, '3'], [13, 14, 1, 1, '3'], [6, 1, 1, 1, '3'],
  ]);
  TILES.path = pathA;
  TILE_VARIANTS.path = [pathA, pathA, pathB];
  // mud: wet hollows — darker than path (base '1'), ink streaks, dry '2' patches
  const mudA = handTile('1', [
    [2, 3, 3, 1, '0'], [9, 8, 3, 1, '0'], [4, 13, 3, 1, '0'], [13, 5, 2, 1, '0'], [6, 10, 2, 1, '0'],
    [12, 11, 1, 1, '2'], [1, 7, 1, 1, '2'], [8, 1, 2, 1, '2'],
  ]);
  const mudB = handTile('1', [
    [6, 6, 2, 1, '0'], [12, 10, 2, 1, '0'], [3, 2, 2, 1, '0'], [9, 14, 2, 1, '0'], [0, 9, 2, 1, '0'],
    [3, 10, 1, 1, '2'], [10, 2, 1, 1, '2'], [14, 7, 1, 1, '2'], [7, 4, 1, 1, '2'],
  ]);
  TILES.mud = mudA;
  TILE_VARIANTS.mud = [mudA, mudA, mudB];
  TILES.cavefloor = texTile('2', 61, [{ color: '1', n: 10 }, { color: '0', n: 4 }]);

  // tree (round, classic GB) — drawn over a grass base so its transparent
  // corners never show the ink screen-fill underneath (Gen-1 trees sit on grass)
  const overGrass = (art: HTMLCanvasElement): HTMLCanvasElement => {
    const cv = cloneTile(grassA);
    cv.getContext('2d')!.drawImage(art, 0, 0);
    return cv;
  };
  TILES.tree = overGrass(makeSprite(mirror([
    '.....000',
    '...00222',
    '..022222',
    '..022322',
    '.0222222',
    '.0222222',
    '.0223222',
    '.0222222',
    '..022222',
    '..002222',
    '....0011',
    '.....011',
    '.....011',
    '....0111',
  ], 8), 16, 16));

  // tree variant: canopy highlights shifted (breaks border repetition)
  {
    const t2 = cloneTile(TILES.tree as HTMLCanvasElement);
    const g = t2.getContext('2d')!;
    g.fillStyle = PAL[2];
    g.fillRect(5, 3, 1, 1); g.fillRect(10, 3, 1, 1); g.fillRect(4, 6, 1, 1); g.fillRect(11, 6, 1, 1);
    g.fillStyle = PAL[3];
    g.fillRect(6, 2, 1, 1); g.fillRect(9, 2, 1, 1); g.fillRect(3, 5, 1, 1); g.fillRect(12, 5, 1, 1);
    TILE_VARIANTS.tree = [TILES.tree as HTMLCanvasElement, TILES.tree as HTMLCanvasElement, t2];
  }

  // pine (forest tree) — over grass base
  TILES.pine = overGrass(makeSprite(mirror([
    '......00',
    '.....011',
    '....0111',
    '...01111',
    '..011111',
    '...01111',
    '..011111',
    '.0111111',
    '..011111',
    '.0111111',
    '01111111',
    '....0011',
    '.....011',
    '.....011',
    '....0111',
  ], 8), 16, 16));
  {
    const g = (TILES.pine as HTMLCanvasElement).getContext('2d')!;
    // snow-light highlights on branches
    g.fillStyle = PAL[2];
    g.fillRect(6, 4, 2, 1); g.fillRect(5, 7, 2, 1); g.fillRect(9, 9, 2, 1); g.fillRect(4, 10, 2, 1);
  }
  // pine variant: asymmetric lean — one branch droops, highlights shifted
  {
    const p2 = cloneTile(TILES.pine as HTMLCanvasElement);
    const g = p2.getContext('2d')!;
    g.fillStyle = PAL[1];
    g.fillRect(0, 8, 4, 1); g.fillRect(1, 7, 3, 1);   // drooping branch flare
    g.fillStyle = PAL[2];
    g.fillRect(9, 4, 2, 1); g.fillRect(10, 7, 2, 1); g.fillRect(5, 10, 2, 1); g.fillRect(8, 9, 1, 1);
    TILE_VARIANTS.pine = [TILES.pine as HTMLCanvasElement, TILES.pine as HTMLCanvasElement, p2];
  }

  // fence
  TILES.fence = makeSprite([
    '................',
    '..0.........0...',
    '..0.........0...',
    '..0.........0...',
    '..00000000000...',
    '..0.........0...',
    '..0..0......0...',
    '..0..0......0...',
    '..00000000000...',
    '..0.........0...',
    '..0.........0...',
    '..0.........0...',
    '..0.........0...',
    '.000.......000..',
    '.000.......000..',
    '................',
  ]);

  // ————————————————— VILLAGE BUILDINGS —————————————————
  // Gen-1-style anatomy: plaster wall + timber course + plinth, cross-mullion
  // windows with lit-pane glint, plank door with lintel and step, thatch
  // shingle courses with staggered stitches, eave with tab gaps + shadow.
  const wallTile = (extra?: (g: CanvasRenderingContext2D) => void): HTMLCanvasElement => {
    const cv = document.createElement('canvas');
    cv.width = 16; cv.height = 16;
    const g = cv.getContext('2d')!;
    g.fillStyle = PAL[3];
    g.fillRect(0, 0, 16, 16);              // plaster
    g.fillStyle = PAL[2];                  // plaster mottling
    g.fillRect(4, 1, 2, 1); g.fillRect(10, 1, 1, 1); g.fillRect(1, 4, 1, 1);
    g.fillRect(12, 4, 2, 1); g.fillRect(6, 9, 2, 1); g.fillRect(2, 12, 1, 1); g.fillRect(13, 12, 2, 1);
    g.fillStyle = PAL[1];                  // timber beam course
    g.fillRect(0, 7, 16, 1);
    g.fillStyle = PAL[3];                   // beam pegs
    g.fillRect(3, 7, 1, 1); g.fillRect(12, 7, 1, 1);
    g.fillStyle = PAL[1];                  // stone base course
    g.fillRect(0, 14, 16, 1);
    g.fillStyle = PAL[0];                  // stone joints...
    g.fillRect(3, 14, 1, 1); g.fillRect(11, 14, 1, 1);
    g.fillRect(0, 15, 16, 1);              // ...and ink plinth
    if (extra) extra(g);
    return cv;
  };
  TILES.wall = wallTile();

  // window: cross-mullion panes, one lit pane glint, sill under
  TILES.window = wallTile((g) => {
    g.fillStyle = PAL[0];
    g.fillRect(3, 3, 10, 7);                // frame block
    g.fillStyle = PAL[1];                   // four panes
    g.fillRect(4, 4, 3, 2); g.fillRect(9, 4, 3, 2);
    g.fillRect(4, 7, 3, 2); g.fillRect(9, 7, 3, 2);
    g.fillStyle = PAL[0];                   // mullion cross
    g.fillRect(7, 4, 2, 5);
    g.fillRect(4, 6, 8, 1);
    g.fillStyle = PAL[3];
    g.fillRect(5, 4, 1, 1);                 // lit-pane glint
    g.fillStyle = PAL[2];
    g.fillRect(2, 10, 12, 1);               // sill
  });

  // door: plank slab, vertical seams, lintel, iron knob, doorstep
  TILES.door = wallTile((g) => {
    g.fillStyle = PAL[0];
    g.fillRect(3, 2, 10, 1);                // lintel
    g.fillStyle = PAL[1];
    g.fillRect(4, 3, 8, 11);                // door slab
    g.fillStyle = PAL[0];
    g.fillRect(4, 3, 1, 11); g.fillRect(11, 3, 1, 11);   // stiles
    g.fillRect(6, 4, 1, 10); g.fillRect(9, 4, 1, 10);    // plank seams
    g.fillStyle = PAL[3];
    g.fillRect(10, 8, 1, 1);                // iron knob
    g.fillStyle = PAL[2];
    g.fillRect(2, 14, 12, 1);               // doorstep
  });

  // roof: thatch shingle courses — '2' straw, '1' course lines every 4px,
  // staggered '0' stitches (2px tall), '3' straw glints
  {
    const cv = document.createElement('canvas');
    cv.width = 16; cv.height = 16;
    const g = cv.getContext('2d')!;
    g.fillStyle = PAL[2];
    g.fillRect(0, 0, 16, 16);
    g.fillStyle = PAL[1];
    for (let y = 0; y < 16; y += 4) g.fillRect(0, y, 16, 1);
    g.fillStyle = PAL[0];
    g.fillRect(2, 1, 1, 2); g.fillRect(6, 5, 1, 2); g.fillRect(12, 9, 1, 2); g.fillRect(8, 13, 1, 2);
    g.fillStyle = PAL[3];
    g.fillRect(13, 1, 1, 1); g.fillRect(10, 6, 1, 1); g.fillRect(3, 10, 1, 1); g.fillRect(14, 14, 1, 1);
    TILES.roof = cv;
  }

  // eave: thatch tabs, ink edge line, shadow dither fading into plaster
  {
    const cv = document.createElement('canvas');
    cv.width = 16; cv.height = 16;
    const g = cv.getContext('2d')!;
    g.fillStyle = PAL[2];
    g.fillRect(0, 0, 16, 3);                // thatch
    g.fillStyle = PAL[1];                   // shingle tab gaps
    g.fillRect(2, 2, 1, 1); g.fillRect(7, 2, 1, 1); g.fillRect(12, 2, 1, 1);
    g.fillStyle = PAL[3];
    g.fillRect(5, 0, 1, 1); g.fillRect(13, 1, 1, 1);
    g.fillStyle = PAL[0];
    g.fillRect(0, 3, 16, 1);                // eave ink line
    g.fillStyle = PAL[2];
    g.fillRect(0, 4, 16, 1);                // shadow band
    g.fillStyle = PAL[3];
    g.fillRect(0, 5, 16, 1);                // wall base under dither
    g.fillStyle = PAL[2];
    for (let x = 0; x < 16; x += 2) g.fillRect(x, 5, 1, 1);  // 50% shadow dither
    g.fillStyle = PAL[3];
    g.fillRect(0, 6, 16, 10);               // wall under eave
    g.fillStyle = PAL[2];
    g.fillRect(4, 7, 2, 1); g.fillRect(11, 7, 1, 1); g.fillRect(1, 10, 1, 1); g.fillRect(13, 12, 2, 1);
    TILES.roofedge = cv;
  }

  // chimney: brick stack with rim/joints/base flare over thatch + drifting smoke (2-frame)
  const chimneyFrame = (f: number) => {
    const cv = cloneTile(TILES.roof as HTMLCanvasElement);
    const g = cv.getContext('2d')!;
    g.fillStyle = PAL[0];
    g.fillRect(3, 2, 10, 1);                // rim
    g.fillRect(4, 3, 8, 9);                 // stack block
    g.fillStyle = PAL[1];
    g.fillRect(5, 4, 6, 7);                 // brick fill
    g.fillStyle = PAL[2];
    g.fillRect(5, 4, 2, 7);                 // left-light highlight
    g.fillStyle = PAL[0];
    g.fillRect(4, 6, 8, 1); g.fillRect(4, 9, 8, 1);      // brick joint courses
    g.fillRect(7, 4, 1, 2); g.fillRect(6, 7, 1, 2); g.fillRect(8, 10, 1, 1);  // staggered verticals
    g.fillStyle = PAL[1];
    g.fillRect(3, 11, 10, 1);               // base flare
    g.fillStyle = PAL[0];
    g.fillRect(4, 12, 8, 1);                // base shadow
    // smoke puffs drifting right, 2-frame
    g.fillStyle = PAL[3];
    if (f === 0) { g.fillRect(5, 0, 2, 2); g.fillRect(8, 1, 2, 1); }
    else { g.fillRect(7, 0, 2, 2); g.fillRect(10, 1, 2, 1); }
    g.fillStyle = PAL[2];
    if (f === 0) g.fillRect(7, 0, 1, 1); else g.fillRect(9, 0, 1, 1);
    return cv;
  };
  TILES.chimney = [chimneyFrame(0), chimneyFrame(1)];

  // hanging shop signs — differentiate the four identical facades
  const signTile = (icon: 'griffin' | 'hammer' | 'leaf' | 'rune'): HTMLCanvasElement => {
    const cv = wallTile();
    const g = cv.getContext('2d')!;
    g.fillStyle = PAL[0];
    g.fillRect(2, 1, 12, 1);                // bracket bar
    g.fillRect(4, 2, 1, 2); g.fillRect(11, 2, 1, 2);  // chains
    g.fillRect(3, 4, 10, 8);                // board block
    g.fillStyle = PAL[1];
    g.fillRect(4, 5, 8, 6);                  // board field
    g.fillStyle = PAL[3];
    if (icon === 'griffin') {                // spread wing
      g.fillRect(5, 6, 2, 1); g.fillRect(9, 6, 2, 1);
      g.fillRect(6, 7, 4, 1);
      g.fillRect(5, 8, 1, 1); g.fillRect(10, 8, 1, 1);
      g.fillRect(7, 9, 2, 1);
    } else if (icon === 'hammer') {          // smithy
      g.fillRect(5, 5, 5, 2);
      g.fillRect(7, 7, 1, 4);
    } else if (icon === 'leaf') {            // herbalist
      g.fillRect(9, 5, 1, 1); g.fillRect(8, 6, 1, 1); g.fillRect(7, 7, 1, 1);
      g.fillRect(6, 8, 1, 1); g.fillRect(5, 9, 1, 1);
      g.fillRect(6, 9, 2, 1);
    } else {                                 // rune sigil (elder)
      g.fillRect(6, 5, 1, 1); g.fillRect(8, 6, 1, 1); g.fillRect(6, 7, 1, 1);
      g.fillRect(8, 8, 1, 1); g.fillRect(6, 9, 1, 1); g.fillRect(8, 10, 1, 1);
    }
    return cv;
  };
  TILES.signInn = signTile('griffin');
  TILES.signSmith = signTile('hammer');
  TILES.signHerb = signTile('leaf');
  TILES.signElder = signTile('rune');

  // interior floor (planks)
  TILES.floor = (() => {
    const cv = document.createElement('canvas');
    cv.width = 16; cv.height = 16;
    const g = cv.getContext('2d')!;
    g.fillStyle = PAL[3];
    g.fillRect(0, 0, 16, 16);
    g.fillStyle = PAL[2];
    for (let y = 3; y < 16; y += 4) g.fillRect(0, y, 16, 1);
    g.fillStyle = PAL[1];
    g.fillRect(5, 0, 1, 3); g.fillRect(11, 4, 1, 3); g.fillRect(3, 8, 1, 3); g.fillRect(9, 12, 1, 3);
    return cv;
  })();

  // interior wall
  TILES.intwall = makeSprite([
    '1111111111111111',
    '1222222222222221',
    '1222222222222221',
    '1222222222222221',
    '1222222222222221',
    '1222222222222221',
    '1222222222222221',
    '1222222222222221',
    '1222222222222221',
    '1222222222222221',
    '1222222222222221',
    '1222222222222221',
    '1222222222222221',
    '1111111111111111',
    '0000000000000000',
    '3333333333333333',
  ]);

  // bed
  TILES.bed = makeSprite(mirror([
    '00000000',
    '03333333',
    '03222222',
    '03222222',
    '03222222',
    '01111111',
    '01222222',
    '01222222',
    '01222222',
    '01222222',
    '01222222',
    '01222222',
    '01222222',
    '01222222',
    '01111111',
    '00000000',
  ], 8), 16, 16);

  // table
  TILES.table = makeSprite([
    '................',
    '................',
    '................',
    '0000000000000000',
    '0222222222222220',
    '0222222222222220',
    '0222222222222220',
    '0222222222222220',
    '0000000000000000',
    '0100000000000010',
    '0100000000000010',
    '0100000000000010',
    '0100000000000010',
    '0100000000000010',
    '0100000000000010',
    '0000000000000000',
  ]);

  // counter (shop)
  TILES.counter = makeSprite([
    '................',
    '................',
    '0000000000000000',
    '0222222222222220',
    '0222222222222220',
    '0232323232323230',
    '0222222222222220',
    '0222222222222220',
    '0222222222222220',
    '0222222222222220',
    '0222222222222220',
    '0222222222222220',
    '0222222222222220',
    '0000000000000000',
    '................',
    '................',
  ]);

  // shelf (goods)
  TILES.shelf = makeSprite([
    '0000000000000000',
    '0111111111111110',
    '0131313131313310',
    '0111111111111110',
    '0000000000000000',
    '0111111111111110',
    '0313131313131310',
    '0111111111111110',
    '0000000000000000',
    '0111111111111110',
    '0133131313131310',
    '0111111111111110',
    '0000000000000000',
    '0111111111111110',
    '0111111111111110',
    '0000000000000000',
  ]);

  // notice board (contracts!)
  TILES.board = makeSprite(mirror([
    '......00',
    '....0011',
    '.0001111',
    '01111311',
    '01131111',
    '01111131',
    '01131111',
    '01111113',
    '01131111',
    '01111111',
    '01111311',
    '01111111',
    '.001111.',
    '...011..',
    '...011..',
    '..0111..',
  ], 8), 16, 16);
  {
    const g = (TILES.board as HTMLCanvasElement).getContext('2d')!;
    g.fillStyle = PAL[0];
    g.fillRect(4, 4, 2, 2); g.fillRect(9, 5, 3, 2); g.fillRect(5, 8, 3, 1); g.fillRect(10, 9, 2, 2);
  }

  // gravestones — over grass base; grave1 gets a cross-carved variant
  TILES.grave1 = overGrass(makeSprite(mirror([
    '................',
    '.....000',
    '....0222',
    '...02222',
    '...02212',
    '...02022',
    '...02222',
    '...02212',
    '...02222',
    '...02222',
    '...02222',
    '..002222',
    '..000222',
    '..222222',
    '................',
    '................',
  ], 8), 16, 16));
  TILES.grave2 = overGrass(makeSprite([
    '................',
    '......0000......',
    '.....022220.....',
    '....02222220....',
    '....02202020....',
    '....02222220....',
    '....02202220....',
    '....02222220....',
    '....02202020....',
    '....02222220....',
    '....02222220....',
    '...002222200....',
    '...000222000....',
    '..2222222222....',
    '................',
    '................',
  ]));
  {
    const g1c = cloneTile(TILES.grave1 as HTMLCanvasElement);
    const g = g1c.getContext('2d')!;
    g.fillStyle = PAL[0];
    g.fillRect(7, 5, 2, 6); g.fillRect(5, 7, 6, 1);   // carved cross variant
    TILE_VARIANTS.grave1 = [TILES.grave1 as HTMLCanvasElement, TILES.grave1 as HTMLCanvasElement, g1c];
  }

  // cave wall
  TILES.cavewall = makeSprite([
    '1111111111111111',
    '1221122112211221',
    '1222222222222221',
    '1221222112212221',
    '1222222222222221',
    '1222112211221221',
    '1222222222222221',
    '1222212212221221',
    '1222222222222221',
    '1221222112212221',
    '1222222222222221',
    '1222112211221221',
    '1222222222222221',
    '1222212212221221',
    '1222222222222221',
    '1111111111111111',
  ]);

  // bones
  {
    const cv = texTile('2', 61, [{ color: '1', n: 10 }, { color: '0', n: 4 }]);
    const g = cv.getContext('2d')!;
    g.fillStyle = PAL[3];
    g.fillRect(3, 4, 6, 1); g.fillRect(2, 3, 1, 3); g.fillRect(9, 3, 1, 3);
    g.fillRect(5, 10, 1, 4); g.fillRect(4, 9, 3, 1); g.fillRect(4, 14, 3, 1);
    g.fillStyle = PAL[0];
    g.fillRect(4, 3, 1, 1); g.fillRect(8, 3, 1, 1);
    TILES.bones = cv;
  }

  // herb (collectible shimmer)
  {
    const cv = texTile('2', 71, [{ color: '1', n: 8 }]);
    const g = cv.getContext('2d')!;
    g.fillStyle = PAL[3];
    g.fillRect(7, 5, 2, 2); g.fillRect(5, 7, 2, 2); g.fillRect(9, 7, 2, 2);
    g.fillRect(7, 9, 2, 2); g.fillRect(7, 11, 1, 3);
    g.fillStyle = PAL[1];
    g.fillRect(6, 10, 1, 2); g.fillRect(9, 10, 1, 2);
    TILES.herb = cv;
  }

  // well
  TILES.well = makeSprite(mirror([
    '...00000',
    '..011111',
    '..011111',
    '.0011111',
    '.0333311',
    '.0300311',
    '.0300311',
    '.0300311',
    '.0333311',
    '.0011111',
    '.0122211',
    '.0122211',
    '.0011111',
    '..011111',
    '..000000',
    '................'.slice(0, 8),
  ], 8), 16, 16);

  // bridge (over water)
  TILES.bridge = makeSprite([
    '2222222222222222',
    '2000000000000002',
    '2333333333333332',
    '2333333333333332',
    '2000000000000002',
    '2222222222222222',
    '0000000000000000',
    '2222222222222222',
    '2000000000000002',
    '2333333333333332',
    '2333333333333332',
    '2000000000000002',
    '2222222222222222',
    '0000000000000000',
    '2222222222222222',
    '2222222222222222',
  ]);

  // stump
  TILES.stump = makeSprite(mirror([
    '................'.slice(0, 8),
    '................'.slice(0, 8),
    '.....000',
    '....0222',
    '...02322',
    '...02222',
    '...02232',
    '...02222',
    '...02222',
    '...02222',
    '...02222',
    '...02222',
    '..002222',
    '..000222',
    '..222222',
    '................'.slice(0, 8),
  ], 8), 16, 16);

  // void (border)
  {
    const cv = document.createElement('canvas');
    cv.width = 16; cv.height = 16;
    const g = cv.getContext('2d')!;
    g.fillStyle = PAL[0];
    g.fillRect(0, 0, 16, 16);
    TILES.void = cv;
  }

  // cauldron (herbalist) — one solid pot, 2-frame bubbling.
  // Full-width half-rows (8 chars) so mirror() never splits the pot body.
  const cauldronFrame = (phase: number) => {
    const cv = makeSprite(mirror([
      '........',
      '........',
      '........',
      '........',
      '........',
      '.00.....',        // bail handle stubs outside the rim
      '00000000',        // rim
      '.0111111',        // body
      '.0112211',        // glint band
      '.0111111',
      '.0111111',
      '..000000',        // base
      '........',
      '........',
      '........',
      '........',
    ], 8), 16, 16);
    const g = cv.getContext('2d')!;
    // bubbles above the rim, alternating between frames
    g.fillStyle = PAL[3];
    if (phase === 0) { g.fillRect(7, 4, 1, 1); g.fillRect(10, 3, 1, 1); }
    else { g.fillRect(8, 3, 1, 1); g.fillRect(6, 4, 1, 1); }
    g.fillStyle = PAL[2];
    g.fillRect(8, 4, 1, 1);
    return cv;
  };
  TILES.cauldron = [cauldronFrame(0), cauldronFrame(1)];

  // anvil (smith)
  TILES.anvil = makeSprite(mirror([
    '................'.slice(0, 8),
    '................'.slice(0, 8),
    '................'.slice(0, 8),
    '................'.slice(0, 8),
    '....0000',
    '...02222',
    '...02222',
    '...022220'.slice(0, 8),
    '..002222',
    '....0111',
    '....0111',
    '...01111',
    '..001111',
    '..000000',
    '.........'.slice(0, 8),
    '.........'.slice(0, 8),
  ], 8), 16, 16);

  // barrel (inn) — solid staved body (seam bug fixed)
  TILES.barrel = makeSprite(mirror([
    '........',
    '..000000',
    '..022220',
    '..020020',
    '..022222',
    '..022222',
    '..022222',
    '..022222',
    '..022222',
    '..022222',
    '..022222',
    '..020020',
    '..022220',
    '..000000',
    '........',
    '........',
  ], 8), 16, 16);

  // bookshelf (elder)
  TILES.bookshelf = makeSprite([
    '0000000000000000',
    '0111111111111110',
    '0131313313131310',
    '0111111111111110',
    '0000000000000000',
    '0111111111111110',
    '0133131313313130',
    '0111111111111110',
    '0000000000000000',
    '0111111111111110',
    '0131313313133310',
    '0111111111111110',
    '0000000000000000',
    '0111111111111110',
    '0111111111111110',
    '0000000000000000',
  ]);

  // thorns (deep forest gate) — 2-frame crawl
  const thornsRows = [
    '0000000000000000',
    '0100100100010010',
    '0011011001100110',
    '0100100100010010',
    '0011001100110010',
    '0100100100010010',
    '0011001100100110',
    '0000100100010010',
    '0100100100010010',
    '0011011001100110',
    '0100100100010010',
    '0011001100110010',
    '0100100100010010',
    '0011001100100110',
    '0000100100010010',
    '0000000000000000',
  ];
  TILES.thorns = [
    makeSprite(thornsRows),
    makeSprite([thornsRows[15], ...thornsRows.slice(0, 15)]),
  ];

  // shrine stone (leshen arena) — carved spiral + votive candle, 3-frame flame
  const shrineFrame = (flicker: number) => {
    const cv = makeSprite(mirror([
      '...00000',
      '..022222',
      '..022222',
      '..022222',
      '..022222',
      '..022222',
      '..022222',
      '..022222',
      '..022222',
      '..022222',
      '..022222',
      '..022222',
      '.0022222',
      '.0002222',
      '.2222222',
      '.2222222',
    ], 8), 16, 16);
    const g = cv.getContext('2d')!;
    // concentric carved spiral
    g.fillStyle = PAL[0];
    g.fillRect(6, 5, 4, 1); g.fillRect(6, 8, 4, 1);
    g.fillRect(6, 5, 1, 4); g.fillRect(9, 5, 1, 4);
    g.fillStyle = PAL[3];
    g.fillRect(7, 6, 2, 2);
    // votive candle — 3-frame flame: tall / lean-left / lean-right
    g.fillStyle = PAL[3];
    if (flicker === 0) { g.fillRect(7, 1, 2, 3); }
    else if (flicker === 1) { g.fillRect(6, 2, 2, 2); g.fillRect(8, 1, 1, 1); }
    else { g.fillRect(8, 2, 2, 2); g.fillRect(7, 1, 1, 1); }
    g.fillStyle = PAL[2];
    if (flicker === 0) g.fillRect(7, 3, 2, 1);
    g.fillStyle = PAL[0];
    g.fillRect(6, 4, 4, 1);                // candle base
    return cv;
  };
  TILES.shrine = [shrineFrame(0), shrineFrame(1), shrineFrame(2)];

  // rock
  TILES.rock = makeSprite(mirror([
    '................'.slice(0, 8),
    '................'.slice(0, 8),
    '................'.slice(0, 8),
    '.....000',
    '....0111',
    '...01112',
    '..011112',
    '..011122',
    '..011112',
    '..011122',
    '..011112',
    '..001112',
    '...00112',
    '...00000',
    '....2222',
    '.........'.slice(0, 8),
  ], 8), 16, 16);

  // mountain peak (Fangtooth Pass)
  TILES.mountain = makeSprite([
    '.......33.......',
    '......3223......',
    '......0220......',
    '.....023322.....',
    '.....022220.....',
    '....02233222....',
    '....02222222....',
    '...0222233222...',
    '...0222222222...',
    '..022223322222..',
    '..022222222222..',
    '.02222332222222.',
    '.02222222222222.',
    '0222223322222220',
    '0222222222222220',
    '0000000000000000',
  ]);
  // mountain variant: dark ridge line instead of snow (breaks picket-fence walls)
  {
    const m2 = cloneTile(TILES.mountain as HTMLCanvasElement);
    const g = m2.getContext('2d')!;
    g.fillStyle = PAL[1];
    g.fillRect(7, 0, 2, 1); g.fillRect(7, 3, 2, 1); g.fillRect(7, 6, 2, 1);
    g.fillRect(7, 9, 2, 1); g.fillRect(6, 12, 2, 1); g.fillRect(6, 13, 2, 1);
    g.fillStyle = PAL[3];
    g.fillRect(8, 4, 2, 1); g.fillRect(10, 7, 2, 1);
    TILE_VARIANTS.mountain = [TILES.mountain as HTMLCanvasElement, TILES.mountain as HTMLCanvasElement, m2];
  }

  // scree (encounter tile): grass + 2x2 stone clusters with shadow faces
  const scree = texTile('3', 31, [{ color: '2', n: 6 }]);
  {
    const g = scree.getContext('2d')!;
    const stones: [number, number][] = [[2, 3], [9, 6], [13, 11], [5, 12], [11, 1], [1, 8], [7, 9]];
    for (const [x, y] of stones) {
      g.fillStyle = PAL[2]; g.fillRect(x, y, 2, 2);
      g.fillStyle = PAL[3]; g.fillRect(x, y, 1, 1);         // top-left light
      g.fillStyle = PAL[1]; g.fillRect(x + 1, y + 1, 1, 1); // bottom-right shadow
    }
    TILES.scree = scree;
  }
  {
    const s2 = cloneTile(grassA);
    const g = s2.getContext('2d')!;
    const stones: [number, number][] = [[5, 4], [10, 8], [2, 11], [13, 3], [7, 13]];
    for (const [x, y] of stones) {
      g.fillStyle = PAL[2]; g.fillRect(x, y, 2, 2);
      g.fillStyle = PAL[3]; g.fillRect(x, y, 1, 1);
      g.fillStyle = PAL[1]; g.fillRect(x + 1, y + 1, 1, 1);
    }
    g.fillStyle = PAL[2]; g.fillRect(3, 7, 3, 2);         // one flat slab
    g.fillStyle = PAL[3]; g.fillRect(3, 7, 3, 1);
    TILE_VARIANTS.scree = [scree, s2];
  }

  // ruined wall (Kaer Serpen) — proper masonry: mortar courses + staggered
  // vertical joints + top-left block highlights; variant with missing blocks
  const ruinMasonry = (gaps: [number, number][]) => {
    const cv = document.createElement('canvas');
    cv.width = 16; cv.height = 16;
    const g = cv.getContext('2d')!;
    g.fillStyle = PAL[1];
    g.fillRect(0, 0, 16, 16);              // block faces
    g.fillStyle = PAL[0];
    g.fillRect(0, 0, 16, 1); g.fillRect(0, 5, 16, 1);      // mortar courses
    g.fillRect(0, 10, 16, 1); g.fillRect(0, 15, 16, 1);
    g.fillRect(4, 1, 1, 4); g.fillRect(11, 1, 1, 4);      // joints, course A
    g.fillRect(7, 6, 1, 4); g.fillRect(14, 6, 1, 4);      // joints, course B
    g.fillRect(2, 11, 1, 4); g.fillRect(9, 11, 1, 4);    // joints, course C
    g.fillStyle = PAL[2];                   // top-left block highlights
    g.fillRect(1, 1, 2, 1); g.fillRect(5, 1, 2, 1); g.fillRect(12, 1, 2, 1);
    g.fillRect(1, 6, 2, 1); g.fillRect(8, 6, 2, 1);
    g.fillRect(3, 11, 2, 1); g.fillRect(10, 11, 2, 1);
    for (const [gx, gy] of gaps) {           // missing blocks = daylight
      g.clearRect(gx, gy, 3, 4);
    }
    return cv;
  };
  TILES.ruinwall = ruinMasonry([]);
  TILE_VARIANTS.ruinwall = [
    TILES.ruinwall as HTMLCanvasElement,
    TILES.ruinwall as HTMLCanvasElement,
    ruinMasonry([[5, 6]]),
    ruinMasonry([[12, 1]]),
  ];

  // cracked stone floor: ordered 25% checker + hand cracks, 2 variants
  const crackFloorTile = (phase: number) => {
    const cv = document.createElement('canvas');
    cv.width = 16; cv.height = 16;
    const g = cv.getContext('2d')!;
    g.fillStyle = PAL[2];
    g.fillRect(0, 0, 16, 16);
    g.fillStyle = PAL[3];
    for (let y = 0; y < 16; y += 2) {
      for (let x = (y / 2 + phase) % 2; x < 16; x += 2) g.fillRect(x, y, 1, 1);
    }
    g.fillStyle = PAL[0];
    g.fillRect(0, 0, 16, 1);
    g.fillRect(0, 8, 16, 1);
    g.fillRect(5, 0, 1, 8);
    g.fillRect(11, 8, 1, 8);
    g.fillRect(7, 2, 4, 1);
    g.fillRect(10, 3, 1, 3);
    g.fillRect(2, 10, 1, 4);
    g.fillRect(2, 13, 4, 1);
    return cv;
  };
  TILES.crackfloor = crackFloorTile(0);
  TILE_VARIANTS.crackfloor = [crackFloorTile(0), crackFloorTile(1)];

  // dark archway
  TILES.arch = makeSprite([
    '..111111111111..',
    '.11111111111111.',
    '.11100000000111.',
    '.1100..00..0011.',
    '.110...00...011.',
    '.10....00....01.',
    '.10....00....01.',
    '.10....00....01.',
    '.10....00....01.',
    '.10....00....01.',
    '.10....00....01.',
    '.10....00....01.',
    '.10....00....01.',
    '.10....00....01.',
    '.10....00....01.',
    '110...0000...011',
  ]);

  // ————————————————— NEW PROPS —————————————————
  // hearth: stone chimney breast + firebox with 2-frame fire (also the smithy forge)
  const hearthFrame = (f: number) => {
    const cv = document.createElement('canvas');
    cv.width = 16; cv.height = 16;
    const g = cv.getContext('2d')!;
    // floor under (merge with the F tile below)
    g.fillStyle = PAL[3];
    g.fillRect(0, 0, 16, 16);
    g.fillStyle = PAL[2];
    g.fillRect(0, 15, 16, 1);
    // stone breast
    g.fillStyle = PAL[2];
    g.fillRect(0, 0, 16, 4);
    g.fillStyle = PAL[1];
    g.fillRect(0, 0, 16, 1);
    g.fillRect(0, 2, 16, 1);
    g.fillStyle = PAL[3];
    g.fillRect(3, 1, 2, 1); g.fillRect(11, 3, 2, 1);
    // firebox
    g.fillStyle = PAL[0];
    g.fillRect(2, 4, 12, 9);
    g.fillStyle = PAL[1];
    g.fillRect(3, 12, 10, 1);              // firebox floor
    // logs
    g.fillStyle = PAL[1];
    g.fillRect(4, 11, 8, 1);
    g.fillStyle = PAL[0];
    g.fillRect(4, 11, 1, 1); g.fillRect(11, 11, 1, 1);
    // fire — bright core + glow + rising sparks, 2-frame
    g.fillStyle = PAL[2];
    g.fillRect(5, 6, 6, 5);                // glow backdrop
    g.fillStyle = PAL[3];
    if (f === 0) {
      g.fillRect(7, 6, 2, 4);              // central flame
      g.fillRect(5, 8, 2, 3); g.fillRect(9, 8, 2, 3);  // side tongues
    } else {
      g.fillRect(7, 5, 2, 5);              // taller lick
      g.fillRect(6, 7, 1, 3); g.fillRect(9, 7, 1, 3);
    }
    g.fillStyle = PAL[2];
    g.fillRect(7, 10, 2, 1);               // ember base
    g.fillStyle = PAL[3];                  // sparks: "like tiny orange crows"
    if (f === 0) { g.fillRect(4, 5, 1, 1); g.fillRect(11, 6, 1, 1); g.fillRect(13, 8, 1, 1); }
    else { g.fillRect(5, 4, 1, 1); g.fillRect(10, 4, 1, 1); g.fillRect(2, 7, 1, 1); }
    return cv;
  };
  TILES.hearth = [hearthFrame(0), hearthFrame(1)];

  // interior wall base (dark plaster band + top/bottom rails)
  const intwallBase = (): HTMLCanvasElement => {
    const cv = document.createElement('canvas');
    cv.width = 16; cv.height = 16;
    const g = cv.getContext('2d')!;
    g.fillStyle = PAL[1];
    g.fillRect(0, 0, 16, 16);
    g.fillStyle = PAL[2];
    g.fillRect(1, 1, 14, 12);
    g.fillStyle = PAL[1];
    g.fillRect(1, 6, 14, 1);
    g.fillStyle = PAL[0];
    g.fillRect(0, 0, 16, 1);
    g.fillRect(0, 13, 16, 1);
    return cv;
  };

  // interior window: lit '3' panes — warm light inside
  TILES.intwindow = (() => {
    const cv = intwallBase();
    const g = cv.getContext('2d')!;
    g.fillStyle = PAL[0];
    g.fillRect(3, 3, 10, 8);                // frame
    g.fillStyle = PAL[3];
    g.fillRect(4, 4, 8, 6);                  // lit panes
    g.fillStyle = PAL[1];
    g.fillRect(7, 4, 2, 6); g.fillRect(4, 6, 8, 1);   // mullion cross
    g.fillStyle = PAL[2];
    g.fillRect(2, 11, 12, 1);               // sill
    return cv;
  })();

  // framed picture on the interior wall: moon-and-hill landscape
  TILES.picture = (() => {
    const cv = intwallBase();
    const g = cv.getContext('2d')!;
    g.fillStyle = PAL[0];
    g.fillRect(2, 3, 12, 9);                // frame
    g.fillStyle = PAL[2];
    g.fillRect(3, 4, 10, 7);                 // canvas
    g.fillStyle = PAL[3];
    g.fillRect(10, 5, 2, 2);                 // moon
    g.fillStyle = PAL[1];
    g.fillRect(3, 8, 4, 3); g.fillRect(7, 9, 6, 2);   // hills
    return cv;
  })();

  // crate: X-braced shipping box (village clutter)
  TILES.crate = overGrass((() => {
    const cv = document.createElement('canvas');
    cv.width = 16; cv.height = 16;
    const g = cv.getContext('2d')!;
    g.fillStyle = PAL[0];
    g.fillRect(2, 4, 12, 11);               // box outline
    g.fillStyle = PAL[1];
    g.fillRect(3, 5, 10, 9);                 // boards
    g.fillStyle = PAL[2];
    g.fillRect(3, 5, 10, 1);                 // top-light board
    g.fillStyle = PAL[0];
    g.fillRect(3, 9, 10, 1);                 // mid rail
    for (let i = 0; i < 4; i++) {            // X brace
      g.fillRect(4 + i, 6 + i, 1, 1);
      g.fillRect(11 - i, 6 + i, 1, 1);
    }
    g.fillStyle = PAL[2];
    g.fillRect(5, 7, 1, 1); g.fillRect(10, 7, 1, 1);
    return cv;
  })());

  // woodpile: stacked log ends facing the camera
  TILES.woodpile = overGrass((() => {
    const cv = document.createElement('canvas');
    cv.width = 16; cv.height = 16;
    const g = cv.getContext('2d')!;
    const log = (x: number, y: number) => {
      g.fillStyle = PAL[0]; g.fillRect(x, y, 3, 3);
      g.fillStyle = PAL[2]; g.fillRect(x + 1, y + 1, 2, 2);
      g.fillStyle = PAL[1]; g.fillRect(x + 1, y + 1, 1, 1);
    };
    log(2, 11); log(6, 11); log(10, 11); log(13, 12);
    log(4, 8); log(8, 8); log(12, 9);
    log(6, 5); log(10, 6);
    log(8, 2);
    return cv;
  })());

  // haystack: thatched dome with stroke lines
  TILES.haystack = overGrass((() => {
    const cv = document.createElement('canvas');
    cv.width = 16; cv.height = 16;
    const g = cv.getContext('2d')!;
    g.fillStyle = PAL[0];
    g.fillRect(4, 4, 8, 1); g.fillRect(2, 6, 12, 1); g.fillRect(1, 8, 14, 1); g.fillRect(1, 11, 14, 1);
    g.fillStyle = PAL[2];
    g.fillRect(5, 5, 6, 1); g.fillRect(3, 7, 10, 1); g.fillRect(2, 9, 12, 2); g.fillRect(2, 12, 12, 2);
    g.fillStyle = PAL[3];
    g.fillRect(6, 5, 1, 1); g.fillRect(4, 7, 1, 1); g.fillRect(3, 9, 1, 2);   // top-light
    g.fillStyle = PAL[1];
    for (let x = 5; x <= 11; x += 2) g.fillRect(x, 8, 1, 3);   // thatch strokes
    g.fillRect(7, 5, 1, 3); g.fillRect(9, 6, 1, 2);
    g.fillRect(2, 14, 12, 1);                // base shadow
    return cv;
  })());
}

// ------------------------------------------------------------
// PLAYER — witcher with two swords on back
// ------------------------------------------------------------
export const PLAYER: Record<string, HTMLCanvasElement> = {};

function buildPlayer() {
  const flip = (src: HTMLCanvasElement): HTMLCanvasElement => {
    const cv = document.createElement('canvas');
    cv.width = src.width; cv.height = src.height;
    const g = cv.getContext('2d')!;
    g.translate(src.width, 0);
    g.scale(-1, 1);
    g.drawImage(src, 0, 0);
    return cv;
  };

  // ---- FRONT (down): white swept hair, cat eyes, pommels breaking the
  // silhouette, wolf medallion on the chest, alternating-gait boots ----
  const down0 = makeSprite(mirror([
    '.....000',
    '....0333',
    '...03223',       // swept white hair with gray streaks
    '...03033',       // cat eyes
    '...03333',
    '....0333',
    '....0333',
    '.00.0111',       // shoulder line + sword pommels flanking the body
    '.0301111',
    '.0301111',
    '.00.1111',
    '...02222',       // belt
    '....0111',       // hips
  ], 8), 16, 16);
  {
    const g = down0.getContext('2d')!;
    // alternating-gait boots: left planted, right heel lifted.
    // Ink outline columns + a transparent gap between the legs.
    g.fillStyle = PAL[0];
    g.fillRect(4, 13, 1, 3); g.fillRect(11, 13, 1, 2);   // outline columns
    g.fillStyle = PAL[1];
    g.fillRect(5, 13, 2, 3);                               // left boot (planted)
    g.fillStyle = PAL[0];
    g.fillRect(5, 15, 2, 1);                              // planted sole
    g.fillStyle = PAL[1];
    g.fillRect(9, 13, 2, 2);                               // right boot (lifted)
    g.fillStyle = PAL[0];
    g.fillRect(9, 14, 2, 1);                               // lifted sole
    // wolf-head medallion: ink border + light face, readable on dark armor
    g.fillStyle = PAL[0];
    g.fillRect(7, 8, 2, 2);
    g.fillStyle = PAL[2];
    g.fillRect(7, 8, 2, 1);
  }
  PLAYER.down0 = down0;
  PLAYER.down1 = flip(down0);            // right foot forward — true gait alternation

  // ---- BACK (up): full white mane, X-crossed scabbards (silver over steel) ----
  const up0 = makeSprite(mirror([
    '.....000',
    '....0333',
    '...03333',
    '...03333',
    '...03333',
    '...03333',
    '....0333',
    '....0111',
    '....0111',
    '....0111',
    '....0111',
    '....0111',
    '....0111',
  ], 8), 16, 16);
  {
    const g = up0.getContext('2d')!;
    // crossed scabbards between the shoulders — 2px bands: silver over steel
    g.fillStyle = PAL[2];                  // steel sword, hip to shoulder
    g.fillRect(9, 7, 2, 1); g.fillRect(8, 8, 2, 1); g.fillRect(7, 9, 2, 1);
    g.fillRect(6, 10, 2, 1); g.fillRect(5, 11, 2, 1);
    g.fillStyle = PAL[3];                  // silver sword, shoulder to hip
    g.fillRect(5, 7, 2, 1); g.fillRect(6, 8, 2, 1); g.fillRect(7, 9, 2, 1);
    g.fillRect(8, 10, 2, 1); g.fillRect(9, 11, 2, 1);
    g.fillStyle = PAL[0];                 // ink hilt ends + pommel tips above shoulders
    g.fillRect(4, 7, 1, 2); g.fillRect(10, 7, 1, 2);
    g.fillRect(5, 6, 1, 1); g.fillRect(10, 6, 1, 1);
    // same alternating-gait boots as the front view
    g.fillStyle = PAL[0];
    g.fillRect(4, 13, 1, 3); g.fillRect(11, 13, 1, 2);
    g.fillStyle = PAL[1];
    g.fillRect(5, 13, 2, 3);
    g.fillStyle = PAL[0];
    g.fillRect(5, 15, 2, 1);
    g.fillStyle = PAL[1];
    g.fillRect(9, 13, 2, 2);
    g.fillStyle = PAL[0];
    g.fillRect(9, 14, 2, 1);
  }
  PLAYER.up0 = up0;
  PLAYER.up1 = flip(up0);

  // ---- SIDE (left; right = flipped): profile nose, hair spikes, one
  // connected scabbard diagonal with hilt above the shoulder, stride gait ----
  const leftBase = [
    '......00000.....',
    '.....03333330...',
    '....033323330...',
    '....033033330...',
    '....033333330...',
    '....033333330...',
    '.....0333330....',
    '..000011110.....',
    '.0330111110.....',
    '..0001121110....',
    '...011111100....',
    '...02222200.....',
    '....011110......',
  ];
  const stampSide = (g: CanvasRenderingContext2D, stride: boolean) => {
    // profile nose + trailing mane fin behind the head (facing left)
    g.fillStyle = PAL[0];
    g.fillRect(3, 4, 1, 1);                // nose
    g.fillStyle = PAL[3];
    g.fillRect(14, 1, 1, 3);               // connected white mane fin
    // connected silver scabbard down the back, ink outline, hilt behind head
    g.fillStyle = PAL[2];
    g.fillRect(11, 8, 1, 1); g.fillRect(10, 9, 1, 1); g.fillRect(9, 10, 1, 1); g.fillRect(8, 11, 1, 1);
    g.fillStyle = PAL[0];
    g.fillRect(12, 8, 1, 1); g.fillRect(11, 9, 1, 1); g.fillRect(10, 10, 1, 1); g.fillRect(9, 11, 1, 1);
    g.fillStyle = PAL[3];
    g.fillRect(13, 6, 1, 1);               // pommel glint above the shoulder
    g.fillStyle = PAL[0];
    g.fillRect(12, 7, 1, 1);
    // gait: stride (legs apart) vs passing (legs together)
    g.clearRect(2, 13, 12, 3);
    if (stride) {
      g.fillStyle = PAL[1];
      g.fillRect(4, 13, 2, 2);            // rear boot (lifted)
      g.fillRect(7, 13, 2, 3);            // front boot (planted)
      g.fillStyle = PAL[0];
      g.fillRect(4, 14, 2, 1);
      g.fillRect(7, 15, 2, 1);
    } else {
      g.fillStyle = PAL[1];
      g.fillRect(6, 13, 3, 2);
      g.fillStyle = PAL[0];
      g.fillRect(6, 15, 3, 1);
    }
  };
  const left0 = makeSprite(leftBase, 16, 16);
  stampSide(left0.getContext('2d')!, true);
  const left1 = makeSprite(leftBase, 16, 16);
  stampSide(left1.getContext('2d')!, false);
  PLAYER.left0 = left0;
  PLAYER.left1 = left1;
  // right = flipped left
  PLAYER.right0 = flip(left0);
  PLAYER.right1 = flip(left1);
}

// ------------------------------------------------------------
// NPC sprites (single frame, facing down / idle)
// ------------------------------------------------------------
export const NPCS: Record<string, HTMLCanvasElement> = {};

function buildNpcs() {
  // Elder: gray hair, long robe, staff
  NPCS.elder = makeSprite(mirror([
    '.....000',
    '....0222',
    '...02222',
    '...02020',
    '...02222',
    '....0222',
    '..0.0111',
    '..0.0111',
    '.0..0111',
    '.0..0121',
    '.0..0111',
    '.0..0111',
    '.0..0111',
    '.0..0111',
    '.0..0111',
    '.0000110',
  ], 8));

  // Innkeeper Petra: hair bun, dress, apron
  NPCS.innkeep = makeSprite(mirror([
    '.....000',
    '....0333',
    '...03030',
    '...03333',
    '...03003',
    '....0330',
    '...01111',
    '..012221',
    '..012321',
    '..012221',
    '..012321',
    '..012221',
    '..012321',
    '...02221',
    '...02221',
    '...00000',
  ], 8));

  // Smith Torv: bald, beard, apron
  NPCS.smith = makeSprite(mirror([
    '.....000',
    '....0333',
    '...03333',
    '...03033',
    '...03333',
    '....0222',
    '...01111',
    '..011111',
    '..012221',
    '..012321',
    '..012221',
    '..012321',
    '..011111',
    '...01111',
    '...01010',
    '...00000',
  ], 8));

  // Herbalist Mira: hood
  NPCS.herb = makeSprite(mirror([
    '.....000',
    '....0111',
    '...01111',
    '...01030',
    '...01010',
    '...01111',
    '...01111',
    '..022222',
    '..022222',
    '..022322',
    '..022222',
    '..022222',
    '..022222',
    '..022222',
    '..022222',
    '..000000',
  ], 8));

  // Kid
  NPCS.kid = makeSprite(mirror([
    '........',
    '........',
    '.....000',
    '....0333',
    '...03030',
    '...03333',
    '....0330',
    '...01111',
    '...01211',
    '...01111',
    '...02221',
    '...01110',
    '...01010',
    '...00000',
    '........',
    '........',
  ], 8));

  // Fisherman: wide hat
  NPCS.fisher = makeSprite(mirror([
    '........',
    '.0000000',
    '022222222'.slice(0, 8),
    '.0000000',
    '...03333',
    '...03030',
    '...03333',
    '...01111',
    '..011111',
    '..011211',
    '..011111',
    '..011111',
    '..011111',
    '...01111',
    '...01110',
    '...00000',
  ], 8));

  // Widow ghost (pale, floating)
  NPCS.ghost = makeSprite(mirror([
    '.....000',
    '....0333',
    '...03333',
    '...03030',
    '...03333',
    '...03333',
    '..033333',
    '..033333',
    '..033323',
    '..033333',
    '..033333',
    '..033323',
    '...03333',
    '...03.33',
    '....3.3.',
    '........',
  ], 8));

  // Villager man
  NPCS.man = makeSprite(mirror([
    '.....000',
    '....0333',
    '...03333',
    '...03030',
    '...03333',
    '....0330',
    '...01111',
    '..011111',
    '..011221',
    '..011111',
    '..011111',
    '...01111',
    '...01110',
    '...01010',
    '...00000',
    '........',
  ], 8));

  // Werewolf NPC (cursed hunter) - looks like man but hunched
  NPCS.hunter = makeSprite(mirror([
    '.....000',
    '....0111',
    '...01111',
    '...01030',
    '...01111',
    '....0111',
    '..0.0111',
    '..0.0111',
    '.0..0111',
    '.0..0111',
    '.0..0111',
    '....0111',
    '....0111',
    '....0110',
    '....0110',
    '...01110',
  ], 8));

  // Trapper Woy: fur hat, bandaged arm
  NPCS.trapper = makeSprite(mirror([
    '.....000',
    '....0111',
    '...01111',
    '...01030',
    '...01111',
    '....0110',
    '...02222',
    '..022222',
    '..023322',
    '..022332',
    '..022222',
    '...02222',
    '...02220',
    '...02020',
    '...00000',
    '........',
  ], 8));

  // Old Kettle: hunched bog crone in shawl
  NPCS.kettle = makeSprite([
    '........000.....',
    '.......01110....',
    '......011110....',
    '......010301....',
    '......011111....',
    '.....0011110....',
    '...0001111100...',
    '..011111111100..',
    '..011111111110..',
    '..011112111110..',
    '..011111111110..',
    '..0111111110....',
    '..0111111110....',
    '..0110..0110....',
    '..000....000....',
    '................',
  ]);

  // The Pale Witcher: ghost of the Serpent School, two swords on back
  NPCS.shade = makeSprite(mirror([
    '.....000',
    '....0131',
    '...01331',
    '...01310',
    '...01331',
    '....0131',
    '.00.0111',
    '.00.0111',
    '.00.0111',
    '.00.0111',
    '....0111',
    '....0111',
    '....0110',
    '....0310',
    '.....3..',
    '........',
  ], 8));

  // hunter: bow slung across the back (differentiates from the elder)
  {
    const g = (NPCS.hunter as HTMLCanvasElement).getContext('2d')!;
    g.fillStyle = PAL[0];
    g.fillRect(11, 6, 1, 1); g.fillRect(12, 7, 1, 1); g.fillRect(13, 8, 1, 1); g.fillRect(14, 9, 1, 1);
    g.fillStyle = PAL[3];
    g.fillRect(12, 8, 1, 1);
  }
  // villager man: flat cap brim (differentiates from the smith)
  {
    const g = (NPCS.man as HTMLCanvasElement).getContext('2d')!;
    g.fillStyle = PAL[0];
    g.fillRect(5, 1, 6, 1);
    g.fillRect(4, 2, 8, 1);
  }
  // smith: hammer resting at his side
  {
    const g = (NPCS.smith as HTMLCanvasElement).getContext('2d')!;
    g.fillStyle = PAL[0];
    g.fillRect(12, 7, 3, 2);
    g.fillStyle = PAL[1];
    g.fillRect(13, 9, 1, 4);
  }
}

let built = false;
export function ensureSprites() {
  if (built) return;
  built = true;
  buildTiles();
  buildPlayer();
  buildNpcs();
}
