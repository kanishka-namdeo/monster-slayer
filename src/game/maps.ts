// ============================================================
// World maps, warps, NPCs, pickups, encounter tables
// Tile chars:
//  . grass   , flowers  T tree   P pine    f fence
//  R reeds(enc)  n darkgrass(enc)  ~ water  o swampwater
//  p path    m mud      = bridge  x bones(walk)
//  W wall w window  r roof  e roofedge  D door(warp)
//  F floor   # intwall  b bed  t table  c counter  s shelf
//  B board   g/G graves  u well   a anvil  l cauldron
//  k barrel  K bookshelf  S shrine  z thorns  q rock  L stump
//  v void(border)
// ============================================================

export interface WarpDef {
  x: number; y: number;
  to: string; tx: number; ty: number;
  dir?: 'up' | 'down' | 'left' | 'right';
  requires?: string; // flag required to use
}

export interface NpcDef {
  id: string;
  x: number; y: number;
  sprite: string;
  wander?: number; // radius
  dialogue: string;
  requires?: string;   // flag to be visible
  hideFlag?: string;   // flag to be hidden
}

export interface PickupDef {
  id: string;
  x: number; y: number;
  item: string;
  requires?: string; // quest flag
}

export interface EncounterDef {
  monster: string;
  weight: number;
  min: number;
  max: number;
}

export interface MapDef {
  name: string;
  rows: string[];
  warps: WarpDef[];
  npcs: NpcDef[];
  pickups: PickupDef[];
  encounters: EncounterDef[];
  music: string;
  dark?: boolean; // graveyard tint
}

const BLOCKED = new Set('TPfWwreuALKsctBbGgSz qL o~v#CMYA'.split('').filter(c => c !== ' '));

export function tileAt(map: MapDef, x: number, y: number): string {
  if (y < 0 || y >= map.rows.length) return 'v';
  const row = map.rows[y];
  if (x < 0 || x >= row.length) return 'v';
  return row[x];
}

export function isBlocked(map: MapDef, x: number, y: number): boolean {
  const t = tileAt(map, x, y);
  return BLOCKED.has(t) || t === undefined || t === ' ';
}

export function isEncounterTile(t: string): boolean {
  return t === 'R' || t === 'n' || t === 'i';
}

// ------------------------------------------------------------
export const MAPS: Record<string, MapDef> = {
  // ================= VILLAGE =================
  village: {
    name: 'Hollow Creek',
    music: 'town',
    rows: [
      'TTTTTTTTTTppTTTTTTTTTTTT',
      'TTTTTTTTTTppTTTTTTTTTTTT',
      'T,........pp..........,T',
      'T.rrrrr...pp...rrrrr...T',
      'T.rrrrr...pp...rrrrr...T',
      'T.eeeee...pp...eeeee...T',
      'T.WwDwW...pp...WwDwW...T',
      'T...p.....pp.....p.....T',
      'T...p.....pp.....p.....T',
      'T..ppppppppppppppppppppp',
      'T...p..u..pp...B..p....T',
      'T.rrrrr...pp...rrrrr...T',
      'T.rrrrr...pp...rrrrr...T',
      'T.eeeee...pp...eeeee...T',
      'T.WwDwW...pp...WwDwW...T',
      'T...p.....pp.....p.....T',
      'T...p....,pp,....p..,..T',
      'TTTTTTTTTTTTTTTTTTTTTTTT',
    ],
    warps: [
      { x: 4, y: 6, to: 'elder', tx: 5, ty: 7, dir: 'up' },
      { x: 17, y: 6, to: 'inn', tx: 5, ty: 7, dir: 'up' },
      { x: 4, y: 14, to: 'smithy', tx: 5, ty: 7, dir: 'up' },
      { x: 17, y: 14, to: 'herbalist', tx: 5, ty: 7, dir: 'up' },
      { x: 10, y: 0, to: 'forest', tx: 10, ty: 12, dir: 'up' },
      { x: 11, y: 0, to: 'forest', tx: 11, ty: 12, dir: 'up' },
      { x: 23, y: 9, to: 'swamp', tx: 2, ty: 12, dir: 'right' },
    ],
    npcs: [
      { id: 'kid', x: 13, y: 10, sprite: 'kid', wander: 2, dialogue: 'kid' },
      { id: 'villager1', x: 8, y: 7, sprite: 'man', wander: 2, dialogue: 'villager1' },
    ],
    pickups: [],
    encounters: [],
  },

  // ================= INN =================
  inn: {
    name: 'The Sleeping Griffin',
    music: 'inn',
    rows: [
      '############',
      '#FFFFFFbbFF#',
      '#FkFFtFFFFF#',
      '#FFkFFFFFFF#',
      '#FFFcccFFFF#',
      '#FFFFFFFFFF#',
      '#FFFFFFFFFF#',
      '#FFFFFFFFFF#',
      '#####DD#####',
    ],
    warps: [
      { x: 5, y: 8, to: 'village', tx: 17, ty: 7, dir: 'down' },
      { x: 6, y: 8, to: 'village', tx: 17, ty: 7, dir: 'down' },
    ],
    npcs: [
      { id: 'petra', x: 5, y: 3, sprite: 'innkeep', dialogue: 'petra' },
      { id: 'patron', x: 8, y: 3, sprite: 'man', dialogue: 'patron' },
    ],
    pickups: [],
    encounters: [],
  },

  // ================= SMITHY =================
  smithy: {
    name: "Torv's Forge",
    music: 'town',
    rows: [
      '############',
      '#FFFFFFFFFF#',
      '#FFFFFFFaFF#',
      '#FcccFFFFFk#',
      '#FFFFFFFFFF#',
      '#FFFtFFFFFF#',
      '#FFFFFFFFFF#',
      '#FFFFFFFFFF#',
      '#####DD#####',
    ],
    warps: [
      { x: 5, y: 8, to: 'village', tx: 4, ty: 15, dir: 'down' },
      { x: 6, y: 8, to: 'village', tx: 4, ty: 15, dir: 'down' },
    ],
    npcs: [
      { id: 'torv', x: 3, y: 2, sprite: 'smith', dialogue: 'torv' },
    ],
    pickups: [],
    encounters: [],
  },

  // ================= HERBALIST =================
  herbalist: {
    name: "Mira's Hut",
    music: 'town',
    rows: [
      '############',
      '#FFFFFFFFFF#',
      '#FsFlFFsFFF#',
      '#FFFFFFFFFF#',
      '#FFFcccFFFF#',
      '#FsFFFFFFFF#',
      '#FFFFFFFFFF#',
      '#FFFFFFFFbF#',
      '#####DD#####',
    ],
    warps: [
      { x: 5, y: 8, to: 'village', tx: 17, ty: 15, dir: 'down' },
      { x: 6, y: 8, to: 'village', tx: 17, ty: 15, dir: 'down' },
    ],
    npcs: [
      { id: 'mira', x: 5, y: 3, sprite: 'herb', dialogue: 'mira' },
    ],
    pickups: [],
    encounters: [],
  },

  // ================= ELDER =================
  elder: {
    name: "Elder's House",
    music: 'town',
    rows: [
      '############',
      '#KFFFFFFFKF#',
      '#FFtFFtFFFF#',
      '#FFFFFFFFFF#',
      '#FFFFFFFFFF#',
      '#FFtFFFFbFF#',
      '#FFFFFFFFFF#',
      '#FFFFFFFFFF#',
      '#####DD#####',
    ],
    warps: [
      { x: 5, y: 8, to: 'village', tx: 4, ty: 7, dir: 'down' },
      { x: 6, y: 8, to: 'village', tx: 4, ty: 7, dir: 'down' },
    ],
    npcs: [
      { id: 'bram', x: 5, y: 3, sprite: 'elder', dialogue: 'bram' },
    ],
    pickups: [],
    encounters: [],
  },

  // ================= SWAMP =================
  swamp: {
    name: 'Mirelow Swamp',
    music: 'swamp',
    rows: [
      'vvvvvvvvvvvvvvvvvvvv',
      'v..RRRR....oo...RRRv',
      'v.RRRR....oooo..RRRv',
      'v..RR.....oooo...RRv',
      'voo....m......oo...v',
      'vooo..mmmm....ooo...',
      'v.oo..mRRm......oo.v',
      'v.....mRRm....oo...v',
      'v..RR.mmm..RR..o...v',
      'v.RRR....RRRR......v',
      'v..R......RRR..RRR.v',
      'v.....mm....RRRR...v',
      'pppppppp.......RR..v',
      'vvvvvvvvvvvvvvvvvvvv',
    ],
    warps: [
      { x: 0, y: 12, to: 'village', tx: 22, ty: 9, dir: 'left' },
      { x: 19, y: 5, to: 'bog', tx: 2, ty: 6, dir: 'right' },
    ],
    npcs: [
      { id: 'fisher', x: 3, y: 11, sprite: 'fisher', dialogue: 'fisher' },
    ],
    pickups: [
      { id: 'sw1', x: 7, y: 3, item: 'foolleaf' },
      { id: 'sw2', x: 11, y: 8, item: 'foolleaf' },
      { id: 'sw3', x: 6, y: 11, item: 'foolleaf' },
    ],
    encounters: [
      { monster: 'drowner', weight: 5, min: 2, max: 4 },
      { monster: 'ghoul', weight: 2, min: 3, max: 5 },
      { monster: 'waterhag', weight: 2, min: 4, max: 6 },
    ],
  },

  // ================= FOREST =================
  forest: {
    name: 'Oldewood',
    music: 'forest',
    rows: [
      'vvppvvvvzzvvvvvvvvvv',
      'vPP..PP....PP..PPPPv',
      'vP..nn..PP..nn..PP.v',
      'v..nnnn....nnnn....v',
      'vPP....PP......PP..v',
      'v..PP..nnnn..PP....v',
      'vP.....nnnn.....pppp',
      'v..PP.......PP..nn.v',
      'vP....PPPP..nn..nn.v',
      'v..PP......nnnn....v',
      'vP....PPPP....PPPP.v',
      'v..nn....PP..nn....v',
      'vpppppppppppppppppppv',
      'vvvvvvvvvvppvvvvvvvv',
    ],
    warps: [
      { x: 10, y: 13, to: 'village', tx: 10, ty: 1, dir: 'down' },
      { x: 11, y: 13, to: 'village', tx: 11, ty: 1, dir: 'down' },
      { x: 19, y: 6, to: 'graveyard', tx: 2, ty: 9, dir: 'right' },
      { x: 2, y: 0, to: 'fangs', tx: 9, ty: 13, dir: 'up' },
      { x: 3, y: 0, to: 'fangs', tx: 10, ty: 13, dir: 'up' },
      { x: 8, y: 0, to: 'deepforest', tx: 4, ty: 11, dir: 'up', requires: 'thornsCleared' },
      { x: 9, y: 0, to: 'deepforest', tx: 5, ty: 11, dir: 'up', requires: 'thornsCleared' },
    ],
    npcs: [],
    pickups: [],
    encounters: [
      { monster: 'wolf', weight: 5, min: 3, max: 5 },
      { monster: 'ghoul', weight: 3, min: 3, max: 5 },
      { monster: 'drowner', weight: 2, min: 2, max: 4 },
      { monster: 'noonwraith', weight: 1, min: 6, max: 8 },
    ],
  },

  // ================= GRAVEYARD =================
  graveyard: {
    name: 'Weeping Graves',
    music: 'graveyard',
    dark: true,
    rows: [
      'vvvvvvvvvvvvvv',
      'v,..g..gGg..,v',
      'v.g..n..g..g.v',
      'v..Gg.....g..v',
      'v.g..g..nG...v',
      'v..g...g...g.v',
      'v.g..Gg..g.n.v',
      'v..n...g...g.v',
      'v.g..g..n..g.v',
      'pppppppppppppv',
      'vvvvvvvvvvvvvv',
    ],
    warps: [
      { x: 0, y: 9, to: 'forest', tx: 18, ty: 6, dir: 'left' },
    ],
    npcs: [
      { id: 'agnes', x: 7, y: 2, sprite: 'ghost', dialogue: 'agnes', requires: 'wraithStarted', hideFlag: 'wraithDone' },
    ],
    pickups: [
      { id: 'locket', x: 6, y: 3, item: 'locket', requires: 'wraithStarted' },
    ],
    encounters: [
      { monster: 'wraith', weight: 4, min: 5, max: 7 },
      { monster: 'ghoul', weight: 6, min: 4, max: 6 },
    ],
  },

  // ================= DEEP FOREST =================
  deepforest: {
    name: 'Heart of Oldewood',
    music: 'cave',
    dark: true,
    rows: [
      'vvvvvvvvvvvvvvvv',
      'vPP..PP..PP..PPv',
      'v..nn..PP..nn..v',
      'vPP....nn....PPv',
      'v..PP..nn..PP..v',
      'vP....PP....P..v',
      'v..PP......PP..v',
      'vP....PP....nn.v',
      'v..PP......nn..v',
      'vP..PP..PP..PP.v',
      'v....PP..PP....v',
      'v.....SSSS.....v',
      'vvvvppvvvvvvvvvv',
    ],
    warps: [
      { x: 4, y: 12, to: 'forest', tx: 8, ty: 1, dir: 'down' },
      { x: 5, y: 12, to: 'forest', tx: 9, ty: 1, dir: 'down' },
    ],
    npcs: [],
    pickups: [],
    encounters: [
      { monster: 'ghoul', weight: 3, min: 5, max: 7 },
      { monster: 'wolf', weight: 3, min: 5, max: 7 },
      { monster: 'waterhag', weight: 3, min: 5, max: 7 },
    ],
  },

  // ================= FANGTOOTH PASS =================
  fangs: {
    name: 'Fangtooth Pass',
    music: 'mountain',
    rows: [
      'vvvvvvvvvppvvvvvvvvv',
      'vMMMMMMM.pp.MMMMMMMv',
      'vM.i.i...pp...i.i.Mv',
      'vM.i.....pp.....i.Mv',
      'v..qq.i..pp..i.qq..v',
      'v.i......pp......i.v',
      'vM..qq...pp...qq..Mv',
      'vM.i.....pp.....i.Mv',
      'v..P..,..pp..,..P..v',
      'v.i..q...pp...q..i.v',
      'vM...i...pp...i...Mv',
      'vM..P.i..pp..i.P..Mv',
      'v.i......pp......i.v',
      'vqq.i....pp....i.qqv',
      'vvvvvvvvvppvvvvvvvvv',
    ],
    warps: [
      { x: 9, y: 14, to: 'forest', tx: 2, ty: 1, dir: 'down' },
      { x: 10, y: 14, to: 'forest', tx: 3, ty: 1, dir: 'down' },
      { x: 9, y: 0, to: 'ruins', tx: 8, ty: 11, dir: 'up' },
      { x: 10, y: 0, to: 'ruins', tx: 9, ty: 11, dir: 'up' },
    ],
    npcs: [
      { id: 'woy', x: 5, y: 8, sprite: 'trapper', dialogue: 'trapper' },
    ],
    pickups: [],
    encounters: [
      { monster: 'barghest', weight: 4, min: 5, max: 7 },
      { monster: 'endrega', weight: 3, min: 5, max: 8 },
      { monster: 'wolf', weight: 2, min: 5, max: 7 },
    ],
  },

  // ================= CROOKBACK BOG =================
  bog: {
    name: 'Crookback Bog',
    music: 'swamp',
    rows: [
      'vvvvvvvvvvvvvvvvvvvv',
      'v.RRR..oo..RRR..RR.v',
      'vRR..ooo...oo..RRR.v',
      'vR...oo..RR...o....v',
      'v.RR....oo...mmm..Rv',
      'v..o..RR....mm...RRv',
      '..RR.....LL......R.v',
      'v..o..RR....mm...RRv',
      'v.RR....oo...mmm..Rv',
      'vR...oo..RR...o....v',
      'vRR..ooo...oo..RRR.v',
      'v.RRR..oo..RRR..RR.v',
      'vvvvvvvvvvvvvvvvvvvv',
    ],
    warps: [
      { x: 0, y: 6, to: 'swamp', tx: 18, ty: 5, dir: 'left' },
      { x: 1, y: 6, to: 'swamp', tx: 18, ty: 5, dir: 'left' },
    ],
    npcs: [
      { id: 'kettle', x: 12, y: 6, sprite: 'kettle', dialogue: 'kettle', wander: 1 },
    ],
    pickups: [
      { id: 'bog1', x: 15, y: 3, item: 'foolleaf' },
      { id: 'bog2', x: 3, y: 9, item: 'foolleaf' },
    ],
    encounters: [
      { monster: 'nekker', weight: 4, min: 5, max: 8 },
      { monster: 'foglet', weight: 3, min: 6, max: 8 },
      { monster: 'drowner', weight: 2, min: 5, max: 7 },
      { monster: 'waterhag', weight: 2, min: 6, max: 8 },
    ],
  },

  // ================= KAER SERPEN =================
  ruins: {
    name: 'Kaer Serpen',
    music: 'ruins',
    dark: true,
    rows: [
      'vvvvvvvvvvvvvvvvvv',
      'vYYYAYYYY..YYYYAYv',
      'vYyy...yy..yy...Yv',
      'vYy..YYy....yY..Yv',
      'v....YY..SS..YY..v',
      'v..y........y....v',
      'vYY...g..x..g..YYv',
      'v..y..YY....YY..yv',
      'v....yy....yy....v',
      'vYY............YYv',
      'v..y..YY....YY..yv',
      'v....yy.xx.yy....v',
      'vYYY..........YYYv',
      'vvvvvvvvppvvvvvvvv',
    ],
    warps: [
      { x: 8, y: 13, to: 'fangs', tx: 9, ty: 1, dir: 'down' },
      { x: 9, y: 13, to: 'fangs', tx: 10, ty: 1, dir: 'down' },
    ],
    npcs: [
      { id: 'shade', x: 5, y: 10, sprite: 'shade', dialogue: 'shade' },
    ],
    pickups: [
      { id: 'keep1', x: 8, y: 9, item: 'ectoplasm' },
    ],
    encounters: [
      { monster: 'rotfiend', weight: 4, min: 7, max: 9 },
      { monster: 'wraith', weight: 3, min: 7, max: 9 },
      { monster: 'endrega', weight: 2, min: 7, max: 9 },
    ],
  },
};

// Village door-front spawn points (after exiting interiors)
export function villageDoorFront(map: string): { tx: number; ty: number } {
  switch (map) {
    case 'elder': return { tx: 4, ty: 7 };
    case 'inn': return { tx: 17, ty: 7 };
    case 'smithy': return { tx: 4, ty: 15 };
    case 'herbalist': return { tx: 17, ty: 15 };
    default: return { tx: 10, ty: 8 };
  }
}
