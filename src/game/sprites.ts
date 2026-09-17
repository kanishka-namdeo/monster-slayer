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
};

function buildTiles() {
  // grass: hand-placed tufts (ordered GB dithering — no random speckle)
  const grassA = handTile('3', [
    [3, 5, 1, 2, '2'], [5, 5, 1, 2, '2'], [4, 4, 1, 1, '2'],
    [10, 10, 1, 2, '2'], [12, 10, 1, 2, '2'], [11, 9, 1, 1, '2'],
    [7, 2, 2, 1, '2'], [14, 7, 1, 2, '2'],
    [1, 8, 1, 1, '1'], [13, 2, 1, 1, '1'], [6, 13, 1, 1, '1'], [2, 12, 1, 1, '1'],
  ]);
  const grassB = handTile('3', [
    [2, 3, 2, 1, '2'], [11, 6, 2, 1, '2'], [5, 12, 2, 1, '2'],
    [8, 1, 2, 1, '2'], [13, 9, 2, 1, '2'],
    [4, 8, 1, 1, '1'], [14, 13, 1, 1, '1'], [7, 15, 1, 1, '1'],
  ]);
  const grassC = handTile('3', [
    [6, 6, 1, 2, '2'], [12, 12, 1, 2, '2'], [14, 8, 1, 1, '2'], [9, 3, 1, 1, '2'],
    [2, 13, 1, 1, '1'], [4, 1, 1, 1, '1'],
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

  // water: 3 frames (traveling glints)
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
      g.fillRect((off + y * 2 + 2) % 16, yy + 1, 3, 1);
      g.fillRect((off + y * 2 + 9) % 16, (yy + 2) % 16, 4, 1);
      g.fillStyle = PAL[1];
    }
    return cv;
  };
  TILES.water = [waterFrame(0), waterFrame(2), waterFrame(4)];

  // swamp water: murkier
  const swampFrame = (off: number) => {
    const cv = document.createElement('canvas');
    cv.width = 16; cv.height = 16;
    const g = cv.getContext('2d')!;
    g.fillStyle = PAL[1];
    g.fillRect(0, 0, 16, 16);
    g.fillStyle = PAL[0];
    for (let y = 0; y < 16; y += 5) {
      const yy = (y + off) % 16;
      g.fillRect(0, yy, 16, 1);
      g.fillStyle = PAL[2];
      g.fillRect((off * 3 + y * 2 + 3) % 16, yy + 1, 3, 1);
      g.fillStyle = PAL[0];
    }
    return cv;
  };
  TILES.swampw = [swampFrame(0), swampFrame(2), swampFrame(4)];

  // path: worn dirt with ruts and pebbles (hand-placed)
  const pathA = handTile('3', [
    [3, 5, 2, 1, '2'], [10, 11, 2, 1, '2'], [6, 2, 2, 1, '2'], [12, 7, 2, 1, '2'],
    [7, 3, 1, 1, '1'], [12, 8, 1, 1, '1'], [5, 13, 1, 1, '1'], [1, 10, 1, 1, '1'],
  ]);
  const pathB = handTile('3', [
    [6, 8, 3, 1, '2'], [9, 1, 2, 1, '2'], [2, 12, 2, 1, '2'],
    [13, 4, 1, 1, '1'], [1, 6, 1, 1, '1'], [14, 13, 1, 1, '1'],
  ]);
  TILES.path = pathA;
  TILE_VARIANTS.path = [pathA, pathA, pathB];
  // mud: wet hollows (light base + dark streaks + dry patches)
  const mudA = handTile('2', [
    [2, 3, 3, 1, '1'], [9, 8, 3, 1, '1'], [4, 13, 3, 1, '1'], [13, 5, 2, 1, '1'], [6, 10, 2, 1, '1'],
    [12, 11, 1, 1, '3'], [1, 7, 1, 1, '3'],
  ]);
  const mudB = handTile('2', [
    [6, 6, 2, 1, '1'], [12, 10, 2, 1, '1'], [3, 2, 2, 1, '1'], [9, 14, 2, 1, '1'],
    [3, 10, 1, 1, '3'], [10, 2, 1, 1, '3'], [14, 7, 1, 1, '3'],
  ]);
  TILES.mud = mudA;
  TILE_VARIANTS.mud = [mudA, mudA, mudB];
  TILES.cavefloor = texTile('2', 61, [{ color: '1', n: 10 }, { color: '0', n: 4 }]);

  // tree (round, classic GB)
  TILES.tree = makeSprite(mirror([
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
  ], 8), 16, 16);
  // add grass under trunk bottom corners
  {
    const g = (TILES.tree as HTMLCanvasElement).getContext('2d')!;
    g.fillStyle = PAL[3];
    g.fillRect(0, 13, 3, 1); g.fillRect(0, 14, 3, 2); g.fillRect(13, 13, 3, 1); g.fillRect(13, 14, 3, 2);
    g.fillRect(0, 12, 2, 1); g.fillRect(14, 12, 2, 1);
  }

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

  // pine (forest tree)
  TILES.pine = makeSprite(mirror([
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
  ], 8), 16, 16);
  {
    const g = (TILES.pine as HTMLCanvasElement).getContext('2d')!;
    g.fillStyle = PAL[3];
    g.fillRect(0, 13, 3, 1); g.fillRect(0, 14, 3, 2); g.fillRect(13, 13, 3, 1); g.fillRect(13, 14, 3, 2);
    g.fillRect(0, 12, 2, 1); g.fillRect(14, 12, 2, 1);
    // snow-light highlights on branches
    g.fillStyle = PAL[2];
    g.fillRect(6, 4, 2, 1); g.fillRect(5, 7, 2, 1); g.fillRect(9, 9, 2, 1); g.fillRect(4, 10, 2, 1);
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

  // house wall (plaster + beam)
  TILES.wall = makeSprite([
    '0000000000000000',
    '0333333333333330',
    '0333333333333330',
    '0333333333333330',
    '0333333333333330',
    '0333333333333330',
    '0000000000000000',
    '0111111111111110',
    '0333333333333330',
    '0333333333333330',
    '0333333333333330',
    '0333333333333330',
    '0333333333333330',
    '0333333333333330',
    '0333333333333330',
    '0000000000000000',
  ]);

  // window
  TILES.window = makeSprite([
    '0000000000000000',
    '0333333333333330',
    '0333333333333330',
    '0330000000000030',
    '0330110110110030',
    '0330100000010030',
    '0330110110110030',
    '0330000000000030',
    '0330110110110030',
    '0330100000010030',
    '0330110110110030',
    '0330000000000030',
    '0333333333333330',
    '0333333333333330',
    '0333333333333330',
    '0000000000000000',
  ]);

  // roof (straw rows)
  TILES.roof = makeSprite(mirror([
    '11111111',
    '10303030',
    '11111111',
    '03030301',
    '11111111',
    '10303030',
    '11111111',
    '03030301',
    '11111111',
    '10303030',
    '11111111',
    '03030301',
    '11111111',
    '10303030',
    '11111111',
    '11111111',
  ], 8), 16, 16);

  // roof edge
  TILES.roofedge = makeSprite([
    '1111111111111111',
    '1030301030303011',
    '1111111111111111',
    '0000000000000000',
    '3333333333333333',
    '3333333333333333',
    '3333333333333333',
    '3333333333333333',
    '3333333333333333',
    '3333333333333333',
    '3333333333333333',
    '3333333333333333',
    '3333333333333333',
    '3333333333333333',
    '3333333333333333',
    '3333333333333333',
  ]);

  // door
  TILES.door = makeSprite(mirror([
    '00000000',
    '01111111',
    '01313311',
    '01111111',
    '01111111',
    '01131111',
    '01111111',
    '01111111',
    '01111311',
    '01111111',
    '01111111',
    '01111111',
    '01111111',
    '01111111',
    '01111111',
    '00000000',
  ], 8), 16, 16);
  {
    const g = (TILES.door as HTMLCanvasElement).getContext('2d')!;
    g.fillStyle = PAL[3]; // knob
    g.fillRect(10, 8, 1, 1);
  }

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

  // gravestones
  TILES.grave1 = makeSprite(mirror([
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
  ], 8), 16, 16);
  TILES.grave2 = makeSprite([
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
  ]);

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

  // cauldron (herbalist) — one solid pot, 2-frame bubbling
  const cauldronFrame = (phase: number) => makeSprite(mirror(phase === 0 ? [
    '........',
    '..00....',
    '.0220...',
    '022220..',
    '0222220.',
    '00000000',
    '.0111111',
    '.0122221',
    '.0122221',
    '.0111111',
    '.0111111',
    '..000000',
    '........',
    '........',
    '........',
    '........',
  ] : [
    '.......3',
    '....00..',
    '...0220.',
    '..022220',
    '.0222220',
    '00000000',
    '.0111111',
    '.0122221',
    '.0122221',
    '.0111111',
    '.0111111',
    '..000000',
    '........',
    '........',
    '........',
    '........',
  ], 8), 16, 16);
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

  // shrine stone (leshen arena) — carved spiral + votive candle, 2-frame flicker
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
    // votive candle flame + wick
    g.fillStyle = PAL[3];
    if (flicker === 0) g.fillRect(7, 2, 2, 2);
    else { g.fillRect(7, 2, 1, 2); g.fillRect(8, 2, 1, 1); }
    g.fillStyle = PAL[0];
    g.fillRect(7, 4, 2, 1);
    return cv;
  };
  TILES.shrine = [shrineFrame(0), shrineFrame(1)];

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

  // scree (encounter tile): grass + scattered stones
  const scree = texTile('3', 31, [{ color: '2', n: 10 }, { color: '1', n: 4 }]);
  {
    const g = scree.getContext('2d')!;
    const stones: [number, number][] = [[2, 3], [3, 3], [2, 4], [3, 4], [9, 7], [10, 7], [13, 11], [14, 11], [6, 12], [7, 12], [11, 2], [12, 2]];
    for (const [x, y] of stones) g.fillRect(x, y, 1, 1);
    g.fillStyle = PAL[2] as string;
    for (const [x, y] of [[2, 3], [9, 7], [13, 11], [6, 12], [11, 2]] as [number, number][]) g.fillRect(x, y, 1, 1);
  }
  TILES.scree = scree;
  {
    const s2 = cloneTile(grassA);
    const g = s2.getContext('2d')!;
    g.fillStyle = PAL[1];
    const stones: [number, number][] = [[5, 4], [6, 4], [5, 5], [10, 8], [11, 8], [2, 11], [8, 12], [13, 3], [3, 7]];
    for (const [x, y] of stones) g.fillRect(x, y, 1, 1);
    g.fillStyle = PAL[2];
    for (const [x, y] of [[5, 4], [10, 8], [2, 11], [13, 3]] as [number, number][]) g.fillRect(x, y, 1, 1);
    TILE_VARIANTS.scree = [scree, s2];
  }

  // ruined wall (Kaer Serpen)
  TILES.ruinwall = makeSprite([
    '1..11.11..111.1.',
    '1111111011111111',
    '1110111111101111',
    '1111111111111111',
    '1111111011111111',
    '1110111111111011',
    '1111111111111111',
    '1111111110111111',
    '1101111111111111',
    '1111111111110111',
    '1111111111111111',
    '1110111111111111',
    '1111111101111111',
    '1111111111111111',
    '1111111111111111',
    '1111111111111111',
  ]);

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
}

// ------------------------------------------------------------
// PLAYER — witcher with two swords on back
// ------------------------------------------------------------
export const PLAYER: Record<string, HTMLCanvasElement> = {};

function buildPlayer() {
  const down0 = mirror([
    '.....000',
    '....0333',
    '...03333',
    '...03333',
    '...03033',
    '...03333',
    '....0333',
    '.00.0111',
    '.0301111',
    '.0301111',
    '.00.1111',
    '...02222',
    '....0111',
    '....0110',
    '....0110',
    '...01110',
  ], 8);
  const down1 = mirror([
    '.....000',
    '....0333',
    '...03333',
    '...03333',
    '...03033',
    '...03333',
    '....0333',
    '.00.0111',
    '.0301111',
    '.0301111',
    '.00.1111',
    '...02222',
    '....0111',
    '...01101',
    '..011.01',
    '..011..0',
  ], 8);

  const up0 = mirror([
    '.....000',
    '....0333',
    '...03333',
    '...03333',
    '...03333',
    '...03333',
    '...03333',
    '.00.0011',
    '.0000001',
    '.0300001',
    '.0000001',
    '.00.0111',
    '....0111',
    '....0110',
    '....0110',
    '...01110',
  ], 8);
  const up1 = mirror([
    '.....000',
    '....0333',
    '...03333',
    '...03333',
    '...03333',
    '...03333',
    '...03333',
    '.00.0011',
    '.0000001',
    '.0300001',
    '.0000001',
    '.00.0111',
    '....0111',
    '...01101',
    '..011.01',
    '..011..0',
  ], 8);

  const left0 = [
    '......00000.....',
    '.....0333330....',
    '....033333330...',
    '....033333330...',
    '....033033330...',
    '....033333330...',
    '.....0333330....',
    '..000011110.....',
    '.0330111110.....',
    '..0001121110....',
    '...011111100....',
    '...02222200.....',
    '....011110......',
    '....011100......',
    '....011.00......',
    '...0110.00......',
  ];
  const left1 = [
    '......00000.....',
    '.....0333330....',
    '....033333330...',
    '....033333330...',
    '....033033330...',
    '....033333330...',
    '.....0333330....',
    '..000011110.....',
    '.0330111110.....',
    '..0001121110....',
    '...011111100....',
    '...02222200.....',
    '....011110......',
    '...0011100......',
    '...0.0110.......',
    '...00.0110......',
  ];

  PLAYER.down0 = makeSprite(down0);
  PLAYER.down1 = makeSprite(down1);
  PLAYER.up0 = makeSprite(up0);
  PLAYER.up1 = makeSprite(up1);
  PLAYER.left0 = makeSprite(left0);
  PLAYER.left1 = makeSprite(left1);
  // silver scabbard diagonal on side views (stamped before the flip so right views inherit it)
  for (const cv of [PLAYER.left0, PLAYER.left1]) {
    const g = cv.getContext('2d')!;
    g.fillStyle = PAL[2];
    g.fillRect(11, 8, 1, 1); g.fillRect(12, 9, 1, 1); g.fillRect(13, 10, 1, 1);
    g.fillStyle = PAL[3];
    g.fillRect(14, 11, 1, 1);
  }
  // right = flipped left
  for (const f of ['0', '1']) {
    const src = PLAYER['left' + f];
    const cv = document.createElement('canvas');
    cv.width = 16; cv.height = 16;
    const g = cv.getContext('2d')!;
    g.translate(16, 0);
    g.scale(-1, 1);
    g.drawImage(src, 0, 0);
    PLAYER['right' + f] = cv;
  }
  // witcher medallion (wolf-head) on the chest — stamped post-mirror on front/back views
  for (const cv of [PLAYER.down0, PLAYER.down1, PLAYER.up0, PLAYER.up1]) {
    const g = cv.getContext('2d')!;
    g.fillStyle = PAL[2];
    g.fillRect(7, 9, 2, 1);
    g.fillStyle = PAL[1];
    g.fillRect(7, 10, 2, 1);
  }
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
