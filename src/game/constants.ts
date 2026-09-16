// ============================================================
// MONSTER SLAYER - Core constants: DMG Game Boy palette & config
// ============================================================

// Classic DMG 4-shade green palette
export const C = {
  INK: '#0f380f',   // darkest
  DARK: '#306230',  // dark
  LIGHT: '#8bac0f', // light
  PAPER: '#9bbc0f', // lightest
} as const;

// legacy alias used by sprite/font modules
export const PAL: Record<string, string> = {
  0: C.INK,
  1: C.DARK,
  2: C.LIGHT,
  3: C.PAPER,
};

export const SCREEN_W = 160;
export const SCREEN_H = 144;
export const TILE = 16;
export const TILES_X = SCREEN_W / TILE; // 10
export const TILES_Y = SCREEN_H / TILE; // 9

// Movement
export const WALK_MS = 220; // ms per tile
export const RUN_MS = 130;

// Encounters
export const ENCOUNTER_RATE = 0.14; // chance per step on encounter tile

// Battle config
export const RUN_BASE = 0.55;
export const CRIT_RATE = 0.09;

// Player base stats
export const BASE_STATS = {
  hp: 32, sta: 12, atk: 6, def: 2,
};

// XP needed to reach level (index = level-1)
export const XP_TABLE = [0, 35, 90, 170, 280, 420, 600, 830, 1120, 1480, 1950];

// Level-up gains
export const LVLUP = { hp: 5, sta: 2, atk: 1, def: 1 };

// Toxicity
export const TOX_MAX = 9;
export const TOX_WARN = 6;

// Controls shown in UI
export const KEY_HINTS: [string, string][] = [
  ['Arrows / WASD', 'Move'],
  ['Z / SPACE', 'A - Talk / Confirm'],
  ['X', 'B - Cancel / Hold: Run'],
  ['ENTER', 'START - Menu'],
  ['SHIFT', 'SELECT - Sound on/off'],
];

export const SAVE_KEY = 'monsterslayer-save-v1';
