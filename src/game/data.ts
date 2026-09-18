// ============================================================
// Game data: monsters, signs, items, shops, quests
// ============================================================

export type MonType = 'NECROPHAGE' | 'SPECTER' | 'BEAST' | 'CURSED' | 'INSECTOID';

export interface MonMove {
  name: string;
  mult: number;         // damage multiplier
  effect?: 'poison' | 'heal' | 'atkup' | 'stun' | 'defdown' | 'atkdown';
  weight: number;
}

export interface MonsterDef {
  id: string;
  name: string;
  /** shorter name for the battle HUD when the full name won't fit */
  battleName?: string;
  type: MonType;
  hp: number;
  atk: number;
  def: number;
  /** initiative: monsters at higher spd strike before the witcher */
  spd?: number;
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
    hp: 18, atk: 5, def: 1, spd: 5, xp: 12,
    moves: [
      { name: 'LASH', mult: 1.0, weight: 6 },
      { name: 'GRIME SPIT', mult: 0.8, effect: 'atkdown', weight: 3 },
    ],
    drop: { item: 'drownertongue', chance: 0.6 },
    lore: 'Drowned criminals thrown into the mire, risen as fiends. They lurk in reeds and drag the unwary under. Necrophages - silver and necrophage oil work well.',
  },
  ghoul: {
    id: 'ghoul', name: 'GHOUL', type: 'NECROPHAGE',
    hp: 22, atk: 6, def: 2, spd: 5, xp: 15,
    moves: [
      { name: 'REND', mult: 1.0, weight: 6 },
      { name: 'FESTERING BITE', mult: 0.9, effect: 'poison', weight: 3 },
    ],
    drop: { item: 'ghoulblood', chance: 0.6 },
    lore: 'Ghouls dig up graves and gnaw cold bones. Their bite festers - carry White Honey or a Swallow. Necrophages, weak to silver and necrophage oil.',
  },
  wolf: {
    id: 'wolf', name: 'WOLF', type: 'BEAST',
    hp: 20, atk: 7, def: 1, spd: 9, xp: 14,
    moves: [
      { name: 'BITE', mult: 1.0, weight: 6 },
      { name: 'HOWL', mult: 0, effect: 'atkup', weight: 2 },
    ],
    drop: { item: 'wolfpelt', chance: 0.6 },
    lore: 'Hunger made the packs bold this year. Beasts of flesh - a steel blade serves better than silver here. Beast oil adds an edge.',
  },
  waterhag: {
    id: 'waterhag', name: 'WATER HAG', type: 'NECROPHAGE',
    hp: 30, atk: 8, def: 3, spd: 4, xp: 22,
    moves: [
      { name: 'CLAW', mult: 1.0, weight: 6 },
      { name: 'MIRE GRAB', mult: 1.1, effect: 'defdown', weight: 3 },
    ],
    drop: { item: 'drownertongue', chance: 0.5 },
    lore: 'An old drowner that grew fat and clever. Hags wait beneath the swamp skin and strike when you drink. Necrophage - respect it.',
  },
  wraith: {
    id: 'wraith', name: 'WRAITH', type: 'SPECTER',
    hp: 26, atk: 8, def: 2, spd: 7, xp: 25,
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
    hp: 70, atk: 11, def: 4, spd: 10, xp: 60, boss: true,
    moves: [
      { name: 'REND', mult: 1.1, weight: 5 },
      { name: 'FRENZY', mult: 1.4, weight: 2 },
      { name: 'HOWL', mult: 0, effect: 'heal', weight: 2 },
    ],
    lore: 'A cursed one, man by day, beast by moon. Its wounds close as fast as they open. Fire - IGNI - burns the curse.',
  },
  leshen: {
    id: 'leshen', name: 'LESHEN', type: 'CURSED',
    hp: 120, atk: 13, def: 5, spd: 6, xp: 150, boss: true,
    moves: [
      { name: 'ROOT GRASP', mult: 1.0, effect: 'stun', weight: 4 },
      { name: 'BARK FIST', mult: 1.2, weight: 5 },
      { name: 'CALL OF WOODS', mult: 0, effect: 'heal', weight: 2 },
    ],
    lore: 'Old as the forest itself. It wears a skull of a stag and speaks in crows. The source of Hollow Creek\'s rot - the reason you came.',
  },
  // ------- Northern Reaches bestiary -------
  nekker: {
    id: 'nekker', name: 'NEKKER', type: 'NECROPHAGE',
    hp: 24, atk: 7, def: 1, spd: 8, xp: 16,
    moves: [
      { name: 'SCRATCH', mult: 1.0, weight: 6 },
      { name: 'SWARM BITE', mult: 0.9, weight: 3 },
      { name: 'SHRIEK', mult: 0, effect: 'atkup', weight: 2 },
    ],
    drop: { item: 'nekkerheart', chance: 0.6 },
    lore: 'Small, black, and never alone. Nekkers nest in the deep mire and mark prey with mud shrines. Where there is one, there are ten. Necrophage - oil and silver serve.',
  },
  endrega: {
    id: 'endrega', name: 'ENDREGA', type: 'INSECTOID',
    hp: 28, atk: 8, def: 3, spd: 6, xp: 20,
    moves: [
      { name: 'MANDIBLES', mult: 1.0, weight: 6 },
      { name: 'VENOM SPIT', mult: 0.8, effect: 'poison', weight: 3 },
    ],
    drop: { item: 'endregavenom', chance: 0.6 },
    lore: 'Oviparous horror of the Oldewood - a man-sized wasp-worm that spits venom and guards cocooned eggs. INSECTOID OIL cracks its chitin.',
  },
  foglet: {
    id: 'foglet', name: 'FOGLET', type: 'NECROPHAGE',
    hp: 26, atk: 8, def: 2, spd: 6, xp: 22,
    moves: [
      { name: 'MIST CLAW', mult: 1.0, weight: 5 },
      { name: 'DAZZLING LIGHT', mult: 0, effect: 'defdown', weight: 3 },
    ],
    drop: { item: 'foglettear', chance: 0.6 },
    lore: 'It wears the mist like a cloak and the lantern light it carries is a lie. Travelers walk toward the glow and meet the claws behind it. Necrophage - burn the mist with IGNI.',
  },
  noonwraith: {
    id: 'noonwraith', name: 'NOONWRAITH', type: 'SPECTER',
    hp: 30, atk: 9, def: 2, spd: 7, xp: 26, immuneToPlain: true,
    moves: [
      { name: 'SCORCHING TOUCH', mult: 1.0, weight: 5 },
      { name: 'SOLAR FLARE', mult: 1.3, weight: 2 },
      { name: 'SHRILL CRY', mult: 0.6, effect: 'atkdown', weight: 2 },
    ],
    drop: { item: 'ectoplasm', chance: 0.7 },
    lore: 'A bride who danced until the sun killed her. At high noon she burns brightest over open fields. A specter - only SPECTER OIL can cut her light.',
  },
  rotfiend: {
    id: 'rotfiend', name: 'ROTFIEND', type: 'NECROPHAGE',
    hp: 26, atk: 8, def: 2, spd: 5, xp: 20,
    moves: [
      { name: 'REND', mult: 1.0, weight: 6 },
      { name: 'GAS BURST', mult: 0.9, effect: 'poison', weight: 2 },
      { name: 'TETANUS', mult: 0.7, effect: 'defdown', weight: 2 },
    ],
    drop: { item: 'rotfiendblood', chance: 0.6 },
    lore: 'Battlefield carrion-eaters, bloated with grave gas. Wounds fester fast - and when a rotfiend dies, it bursts. Keep your distance, mind your cures.',
  },
  barghest: {
    id: 'barghest', name: 'BARGHEST', type: 'BEAST',
    hp: 24, atk: 8, def: 1, spd: 9, xp: 17,
    moves: [
      { name: 'SAVAGE BITE', mult: 1.0, weight: 6 },
      { name: 'GNAW', mult: 0.9, weight: 3 },
      { name: 'HOWL', mult: 0, effect: 'atkup', weight: 2 },
    ],
    drop: { item: 'shadowpelt', chance: 0.6 },
    lore: 'Black hounds that run the high passes with embers for eyes. Long teeth, no fear, endless stamina. Beasts of flesh - steel and beast oil serve best.',
  },
  arachas: {
    id: 'arachas', name: 'ARACHAS', type: 'INSECTOID',
    hp: 90, atk: 12, def: 5, spd: 5, xp: 90, boss: true,
    moves: [
      { name: 'POUNCE', mult: 1.1, weight: 5 },
      { name: 'VENOM DRENCH', mult: 0.9, effect: 'poison', weight: 3 },
      { name: 'SPIN WEB', mult: 0.6, effect: 'stun', weight: 2 },
    ],
    lore: 'The mother of the bog - an armored spider grown vast on nekker meat, camouflaged in corpses and moss. Its venom melts leather. INSECTOID OIL, then fire.',
  },
  griffin: {
    id: 'griffin', name: 'ROYAL GRIFFIN', battleName: 'R. GRIFFIN', type: 'BEAST',
    hp: 85, atk: 13, def: 4, spd: 11, xp: 100, boss: true,
    moves: [
      { name: 'TALON DIVE', mult: 1.2, weight: 5 },
      { name: 'WING GUST', mult: 0.8, effect: 'defdown', weight: 3 },
      { name: 'SCREECH', mult: 0, effect: 'atkup', weight: 2 },
    ],
    lore: 'A royal griffin nesting over Fangtooth Pass. Her mate was shot by trappers; now she takes caravans, horses, and men in mourning. Steel and AARD - never let her dive twice.',
  },
  katakan: {
    id: 'katakan', name: 'KATAKAN', type: 'SPECTER',
    hp: 100, atk: 14, def: 5, spd: 9, xp: 130, boss: true, immuneToPlain: true,
    moves: [
      { name: 'SHADOW CLAW', mult: 1.1, weight: 5 },
      { name: 'NIGHT TERROR', mult: 1.4, weight: 2 },
      { name: 'BLOOD LEECH', mult: 0.8, effect: 'heal', weight: 2 },
    ],
    lore: 'A higher vampire that nested where the Serpent School fell. It wears the faces of the witchers it drank. Only SPECTER OIL bites it - and it bites back at night.',
  },
};

export const MON_TYPES_INFO: Record<MonType, string> = {
  NECROPHAGE: 'Silver +25%. Necrophage oil +50%. IGNI sears the dead.',
  SPECTER: 'Only SPECTER OIL can cut them. Silver +25%.',
  BEAST: 'Steel +25%. Beast oil +50%.',
  CURSED: 'Silver +25%. IGNI x1.5 - burns the curse.',
  INSECTOID: 'Silver +25%. Insectoid oil +50%. IGNI x1.3.',
};

// ---------------- SIGNS ----------------
export interface SignDef {
  id: string; name: string; cost: number; desc: string;
}
export const SIGNS: SignDef[] = [
  { id: 'igni', name: 'IGNI', cost: 3, desc: 'Blast of fire. Burns curses, chitin, dead flesh.' },
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
  insectoil:{ id: 'insectoil', name: 'INSECTOID OIL', kind: 'oil', desc: 'Coats blade: +50% vs insectoids. 8 fights.', price: 22, sell: 11 },
  drownertongue: { id: 'drownertongue', name: 'DROWNER TONGUE', kind: 'part', desc: 'Alchemical reagent. Smiths buy it.', price: 0, sell: 5 },
  ghoulblood:    { id: 'ghoulblood', name: 'GHOUL BLOOD', kind: 'part', desc: 'Thick and reeking. Smiths buy it.', price: 0, sell: 8 },
  wolfpelt:      { id: 'wolfpelt', name: 'WOLF PELT', kind: 'part', desc: 'Warm, heavy hide. Smiths buy it.', price: 0, sell: 7 },
  ectoplasm:     { id: 'ectoplasm', name: 'ECTOPLASM', kind: 'part', desc: 'Wraith residue. Herbalists covet it.', price: 0, sell: 15 },
  nekkerheart:   { id: 'nekkerheart', name: 'NEKKER HEART', kind: 'part', desc: 'Still beating, they say. Alchemists pay well.', price: 0, sell: 6 },
  endregavenom:  { id: 'endregavenom', name: 'ENDREGA VENOM', kind: 'part', desc: 'Potent toxin in a cracked gland.', price: 0, sell: 9 },
  foglettear:    { id: 'foglettear', name: 'FOGLET TEAR', kind: 'part', desc: 'Weeps cold mist. Very rare.', price: 0, sell: 8 },
  rotfiendblood: { id: 'rotfiendblood', name: 'ROTFIEND BLOOD', kind: 'part', desc: 'Corrosive. Bottle it fast.', price: 0, sell: 7 },
  shadowpelt:    { id: 'shadowpelt', name: 'SHADOW PELT', kind: 'part', desc: 'Pelt of the ember-eyed hound. Warm to touch.', price: 0, sell: 8 },
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
      { item: 'sword2', once: true, mats: ['endregavenom', 2], reqFlag: 'owned_sword1' },
      { item: 'armor2', once: true, mats: ['shadowpelt', 2], reqFlag: 'owned_armor1' },
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
  kettle: {
    name: "KETTLE'S HOLLOW",
    buysKinds: ['potion', 'oil', 'part'],
    stock: [
      { item: 'swallow' },
      { item: 'honey' },
      { item: 'necrooil' },
      { item: 'insectoil' },
    ],
  },
};

// special shop entries resolved as gear
export const GEAR = {
  sword1: { name: 'REFORGE SILVER +1', desc: 'Attack +3. Needs 3 drowner tongues.', price: 80, stat: 'atk', amount: 3 },
  armor1: { name: 'LEATHER ARMOR', desc: 'Defense +2. Needs 2 wolf pelts.', price: 60, stat: 'def', amount: 2 },
  sword2: { name: 'SERPENT STEEL', desc: 'Attack +3 more. Needs 2 endrega venom.', price: 120, stat: 'atk', amount: 3 },
  armor2: { name: 'SCALE HAUBERK', desc: 'Defense +2 more. Needs 2 shadow pelts.', price: 100, stat: 'def', amount: 2 },
};

// ---------------- SCHOOLS ----------------
export interface SchoolDef {
  id: string;
  name: string;
  blurb: string;
  hp: number; sta: number; atk: number; def: number;
  signDiscount?: number; // stamina cost reduction for signs
  startItem?: string;
}

export const SCHOOLS: SchoolDef[] = [
  {
    id: 'serpent', name: 'SERPENT',
    blurb: 'THE BALANCED PATH. +1 ATK, +1 DEF. Venoms and antidotes sit light in the blood.',
    hp: 0, sta: 0, atk: 1, def: 1,
  },
  {
    id: 'wolf', name: 'WOLF',
    blurb: 'SIGNS COME EASY. +4 STA, signs cost 1 less stamina.',
    hp: 0, sta: 4, atk: 0, def: 0, signDiscount: 1,
  },
  {
    id: 'bear', name: 'BEAR',
    blurb: 'OUTLAST THEM. +10 HP, +1 DEF.',
    hp: 10, sta: 0, atk: 0, def: 1,
  },
  {
    id: 'cat', name: 'CAT',
    blurb: 'FAST AND MEAN. +2 ATK. Kill it before it bites.',
    hp: 0, sta: 0, atk: 2, def: 0,
  },
  {
    id: 'griffin', name: 'GRIFFIN',
    blurb: 'STORM-CALLER. +2 STA, +1 ATK, signs cost 1 less stamina.',
    hp: 0, sta: 2, atk: 1, def: 0, signDiscount: 1,
  },
];

export function schoolById(id: string): SchoolDef {
  return SCHOOLS.find((s) => s.id === id) ?? SCHOOLS[0];
}

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
  // ------- Northern Reaches contracts -------
  q_pass: {
    id: 'q_pass', title: 'WINGS OVER THE PASS', kind: 'hunt',
    desc: 'Barghests run down carts on Fangtooth Pass. Cull 3 for the caravan master.',
    target: 'barghest', count: 3, reward: '90 crowns',
  },
  q_nekkers: {
    id: 'q_nekkers', title: 'LITTLE HORRORS', kind: 'hunt',
    desc: 'Nekkers nest by Crookback Bog. Cull 4 before they carry off a child.',
    target: 'nekker', count: 4, reward: '75 crowns',
  },
  q_fog: {
    id: 'q_fog', title: 'TEETH IN THE MIST', kind: 'hunt',
    desc: 'Foglets lure travelers with false lantern light in the bog. Banish 2.',
    target: 'foglet', count: 2, reward: '80 crowns',
  },
  q_griffin: {
    id: 'q_griffin', title: 'THE ROYAL GRIFFIN', kind: 'story',
    desc: 'A griffin mourns her dead mate over Fangtooth Pass and takes caravans for it. Her eyrie waits up the north ridge.',
    reward: '150 crowns',
  },
  q_arachas: {
    id: 'q_arachas', title: 'MOTHER OF THE BOG', kind: 'story',
    desc: 'Something armored and patient has been eating the bog\'s nekkers. Kettle fears it has finished the small ones.',
    reward: '120 crowns',
  },
  q_katakan: {
    id: 'q_katakan', title: "THE SERPENT'S COIL", kind: 'story',
    desc: 'In ruined Kaer Serpen something wears the faces of dead witchers. End the School\'s shame.',
    reward: '250 crowns',
  },
};

export function xpForLevel(lvl: number): number {
  const table = [0, 35, 90, 170, 280, 420, 600, 830, 1120, 1480, 1950];
  return table[Math.min(lvl, table.length - 1)];
}
