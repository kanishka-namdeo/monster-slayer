// ============================================================
// Game data: monsters, signs, items, shops, quests
// ============================================================

export type MonType = 'NECROPHAGE' | 'SPECTER' | 'BEAST' | 'CURSED';

export interface MonMove {
  name: string;
  mult: number;         // damage multiplier
  effect?: 'poison' | 'heal' | 'atkup' | 'stun' | 'defdown' | 'atkdown';
  weight: number;
}

export interface MonsterDef {
  id: string;
  name: string;
  type: MonType;
  hp: number;
  atk: number;
  def: number;
  xp: number;
  boss?: boolean;
  immuneToPlain?: boolean; // wraith: needs specter oil
  moves: MonMove[];
  drop?: { item: string; chance: number };
  lore: string;
}

export const MONSTERS: Record<string, MonsterDef> = {
  drowner: {
    id: 'drowner', name: 'DROWNER', type: 'NECROPHAGE',
    hp: 18, atk: 5, def: 1, xp: 12,
    moves: [
      { name: 'LASH', mult: 1.0, weight: 6 },
      { name: 'GRIME SPIT', mult: 0.8, effect: 'atkdown', weight: 3 },
    ],
    drop: { item: 'drownertongue', chance: 0.6 },
    lore: 'Drowned criminals thrown into the mire, risen as fiends. They lurk in reeds and drag the unwary under. Necrophages - silver and necrophage oil work well.',
  },
  ghoul: {
    id: 'ghoul', name: 'GHOUL', type: 'NECROPHAGE',
    hp: 22, atk: 6, def: 2, xp: 15,
    moves: [
      { name: 'REND', mult: 1.0, weight: 6 },
      { name: 'FESTERING BITE', mult: 0.9, effect: 'poison', weight: 3 },
    ],
    drop: { item: 'ghoulblood', chance: 0.6 },
    lore: 'Ghouls dig up graves and gnaw cold bones. Their bite festers - carry White Honey or a Swallow. Necrophages, weak to silver and necrophage oil.',
  },
  wolf: {
    id: 'wolf', name: 'WOLF', type: 'BEAST',
    hp: 20, atk: 7, def: 1, xp: 14,
    moves: [
      { name: 'BITE', mult: 1.0, weight: 6 },
      { name: 'HOWL', mult: 0, effect: 'atkup', weight: 2 },
    ],
    drop: { item: 'wolfpelt', chance: 0.6 },
    lore: 'Hunger made the packs bold this year. Beasts of flesh - a steel blade serves better than silver here. Beast oil adds an edge.',
  },
  waterhag: {
    id: 'waterhag', name: 'WATER HAG', type: 'NECROPHAGE',
    hp: 30, atk: 8, def: 3, xp: 22,
    moves: [
      { name: 'CLAW', mult: 1.0, weight: 6 },
      { name: 'MIRE GRAB', mult: 1.1, effect: 'defdown', weight: 3 },
    ],
    drop: { item: 'drownertongue', chance: 0.5 },
    lore: 'An old drowner that grew fat and clever. Hags wait beneath the swamp skin and strike when you drink. Necrophage - respect it.',
  },
  wraith: {
    id: 'wraith', name: 'WRAITH', type: 'SPECTER',
    hp: 26, atk: 8, def: 2, xp: 25,
    immuneToPlain: true,
    moves: [
      { name: 'CHILL TOUCH', mult: 1.0, weight: 6 },
      { name: 'WAIL', mult: 0.6, effect: 'atkdown', weight: 3 },
    ],
    drop: { item: 'ectoplasm', chance: 0.7 },
    lore: 'A spirit chained to grief. Plain steel and silver pass through it - only a blade anointed with SPECTER OIL can cut a specter.',
  },
  werewolf: {
    id: 'werewolf', name: 'WEREWOLF', type: 'CURSED',
    hp: 70, atk: 11, def: 4, xp: 60, boss: true,
    moves: [
      { name: 'REND', mult: 1.1, weight: 5 },
      { name: 'FRENZY', mult: 1.4, weight: 2 },
      { name: 'HOWL', mult: 0, effect: 'heal', weight: 2 },
    ],
    lore: 'A cursed one, man by day, beast by moon. Its wounds close as fast as they open. Fire - IGNI - burns the curse.',
  },
  leshen: {
    id: 'leshen', name: 'LESHEN', type: 'CURSED',
    hp: 120, atk: 13, def: 5, xp: 150, boss: true,
    moves: [
      { name: 'ROOT GRASP', mult: 1.0, effect: 'stun', weight: 4 },
      { name: 'BARK FIST', mult: 1.2, weight: 5 },
      { name: 'CALL OF WOODS', mult: 0, effect: 'heal', weight: 2 },
    ],
    lore: 'Old as the forest itself. It wears a skull of a stag and speaks in crows. The source of Hollow Creek\'s rot - the reason you came.',
  },
};

export const MON_TYPES_INFO: Record<MonType, string> = {
  NECROPHAGE: 'Weak to SILVER. Necrophage oil +50%.',
  SPECTER: 'Only SPECTER OIL can cut them.',
  BEAST: 'STEEL works best. Beast oil +50%.',
  CURSED: 'Weak to SILVER. IGNI burns the curse.',
};

// ---------------- SIGNS ----------------
export interface SignDef {
  id: string; name: string; cost: number; desc: string;
}
export const SIGNS: SignDef[] = [
  { id: 'igni', name: 'IGNI', cost: 3, desc: 'Blast of fire. Burns curses.' },
  { id: 'aard', name: 'AARD', cost: 3, desc: 'Telekinetic shock. May stun.' },
  { id: 'quen', name: 'QUEN', cost: 4, desc: 'Shield. Blocks damage 3 turns.' },
  { id: 'axii', name: 'AXII', cost: 3, desc: 'Hex. Foe may lose its turn.' },
];

// ---------------- ITEMS ----------------
export type ItemKind = 'potion' | 'oil' | 'part' | 'quest';

export interface ItemDef {
  id: string;
  name: string;
  kind: ItemKind;
  desc: string;
  price: number;   // buy price (0 = not sold)
  sell: number;    // sell price
}

export const ITEMS: Record<string, ItemDef> = {
  swallow:   { id: 'swallow', name: 'SWALLOW', kind: 'potion', desc: 'Heals 25 HP. Toxicity +3.', price: 15, sell: 7 },
  thunder:   { id: 'thunder', name: 'THUNDERBOLT', kind: 'potion', desc: 'Attack +50% this battle. Toxicity +3.', price: 20, sell: 10 },
  honey:     { id: 'honey', name: 'WHITE HONEY', kind: 'potion', desc: 'Purges toxicity and effects.', price: 12, sell: 6 },
  specteroil:{ id: 'specteroil', name: 'SPECTER OIL', kind: 'oil', desc: 'Coats blade: can cut specters, +50% dmg. 8 fights.', price: 25, sell: 12 },
  necrooil:  { id: 'necrooil', name: 'NECROPHAGE OIL', kind: 'oil', desc: 'Coats blade: +50% vs necrophages. 8 fights.', price: 18, sell: 9 },
  beastoil:  { id: 'beastoil', name: 'BEAST OIL', kind: 'oil', desc: 'Coats blade: +50% vs beasts. 8 fights.', price: 18, sell: 9 },
  drownertongue: { id: 'drownertongue', name: 'DROWNER TONGUE', kind: 'part', desc: 'Alchemical reagent. Smiths buy it.', price: 0, sell: 5 },
  ghoulblood:    { id: 'ghoulblood', name: 'GHOUL BLOOD', kind: 'part', desc: 'Thick and reeking. Smiths buy it.', price: 0, sell: 8 },
  wolfpelt:      { id: 'wolfpelt', name: 'WOLF PELT', kind: 'part', desc: 'Warm, heavy hide. Smiths buy it.', price: 0, sell: 7 },
  ectoplasm:     { id: 'ectoplasm', name: 'ECTOPLASM', kind: 'part', desc: 'Wraith residue. Herbalists covet it.', price: 0, sell: 15 },
  foolleaf:      { id: 'foolleaf', name: "FOOL'S LEAF", kind: 'part', desc: 'Bitter herb from the mire.', price: 0, sell: 4 },
  locket:        { id: 'locket', name: 'SILVER LOCKET', kind: 'quest', desc: "A widow's keepsake, cold to touch.", price: 0, sell: 0 },
};

// ---------------- SHOPS ----------------
export interface ShopEntry {
  item: string;
  /** extra cost in materials: [itemId, count] */
  mats?: [string, number];
  once?: boolean;      // one-time upgrade
  reqFlag?: string;    // requires flag
}

export const SHOPS: Record<string, { name: string; stock: ShopEntry[]; buysKinds: ItemKind[] }> = {
  torv: {
    name: "TORV'S FORGE",
    buysKinds: ['part'],
    stock: [
      { item: 'sword1', once: true, mats: ['drownertongue', 3] },
      { item: 'armor1', once: true, mats: ['wolfpelt', 2] },
    ],
  },
  mira: {
    name: "MIRA'S HUT",
    buysKinds: ['potion', 'oil', 'part', 'quest'],
    stock: [
      { item: 'swallow' },
      { item: 'thunder' },
      { item: 'honey' },
      { item: 'specteroil' },
      { item: 'necrooil' },
      { item: 'beastoil' },
    ],
  },
};

// special shop entries resolved as gear
export const GEAR = {
  sword1: { name: 'REFORGE SILVER +1', desc: 'Attack +3. Needs 3 drowner tongues.', price: 80, stat: 'atk', amount: 3 },
  armor1: { name: 'LEATHER ARMOR', desc: 'Defense +2. Needs 2 wolf pelts.', price: 60, stat: 'def', amount: 2 },
};

// ---------------- QUESTS ----------------
export interface QuestDef {
  id: string;
  title: string;
  desc: string;
  kind: 'hunt' | 'collect' | 'story';
  target?: string;
  count?: number;
  reward: string;
}

export const QUESTS: Record<string, QuestDef> = {
  q_intro: {
    id: 'q_intro', title: 'THE WITCHER', kind: 'story',
    desc: 'You are Vesk of the School of the Serpent. Hollow Creek posted work for a monster slayer.',
    reward: '-',
  },
  q_drowners: {
    id: 'q_drowners', title: 'RATS IN THE REEDS', kind: 'hunt',
    desc: 'Drowners drag fishermen from the shallows. Cull 3 in Mirelow Swamp (east).',
    target: 'drowner', count: 3, reward: '60 crowns',
  },
  q_wolves: {
    id: 'q_wolves', title: "A WOLF'S HUNGER", kind: 'hunt',
    desc: 'Wolves slaughter livestock by night. Cull 4 in Oldewood (north).',
    target: 'wolf', count: 4, reward: '70 crowns',
  },
  q_wraith: {
    id: 'q_wraith', title: 'THE WEEPING WIDOW', kind: 'story',
    desc: 'A wraith weeps in Weeping Graves (through the wood). Learn its name before you cut it.',
    reward: 'peace of mind',
  },
  q_herbs: {
    id: 'q_herbs', title: 'BITTER REMEDIES', kind: 'collect',
    desc: "Gather 3 FOOL'S LEAF from the swamp for Mira.",
    target: 'foolleaf', count: 3, reward: 'potions + discount',
  },
  q_main: {
    id: 'q_main', title: 'ROOT OF EVIL', kind: 'story',
    desc: 'The forest heart rots. A Leshen has claimed the old shrine past the thorns. End it.',
    reward: 'the serpentine path',
  },
};

export function xpForLevel(lvl: number): number {
  const table = [0, 35, 90, 170, 280, 420, 600, 830, 1120, 1480, 1950];
  return table[Math.min(lvl, table.length - 1)];
}
