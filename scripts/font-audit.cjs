// Font/text overflow audit for Monster Slayer — POST-FIX geometry verification
// Screen 160x144, 6px char advance, 5x7 glyphs.
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(__dirname, 'audit-build');
const files = ['constants', 'font', 'data', 'dialogue', 'maps'];
fs.mkdirSync(OUT, { recursive: true });
execSync(
  `npx tsc ${files.map(f => `src/game/${f}.ts`).join(' ')} --outDir ${OUT} --module commonjs --target es2020 --moduleResolution node --skipLibCheck`,
  { cwd: ROOT, stdio: 'inherit' },
);

const { wrapText, textWidth, paginateLines } = require(path.join(OUT, 'font.js'));
const { MONSTERS, ITEMS, QUESTS, SHOPS, GEAR, SCHOOLS, SIGNS, MON_TYPES_INFO } = require(path.join(OUT, 'data.js'));
const { DIALOGUES, BOARD_ENTRIES } = require(path.join(OUT, 'dialogue.js'));
const { MAPS } = require(path.join(OUT, 'maps.js'));

const ADV = 6, SCREEN_W = 160;
const fails = [];
const bad = (area, msg) => fails.push(`[${area}] ${msg}`);
const lines = (t, px) => wrapText(t, px).length;

// ---- 1. dialog: paginated (3 lines w/ speaker, 4 w/o; wrap 138). Must always fit.
console.log('=== DIALOG (paginated, wrap 138) ===');
let multi = 0;
for (const [treeId, tree] of Object.entries(DIALOGUES)) {
  if (treeId === '__notice') continue;
  for (const [nodeId, node] of Object.entries(tree)) {
    if (!node.text) continue;
    const per = node.speaker ? 3 : 4;
    const pages = paginateLines(wrapText(node.text, 138), per);
    if (pages.length > 1) multi++;
    if (pages.some(p => p.length > per)) bad('dialog', `${treeId}.${nodeId} page overflow`);
    if (node.speaker && textWidth(node.speaker) > 138) bad('dialog', `speaker too wide: ${node.speaker}`);
  }
}
console.log(`  all nodes fit; ${multi} texts use multiple pages (now shown fully via pagination)`);

// ---- 2. choice labels: slice(0,21) at x=28 in window (14,cy,142,ch); inner right 154
console.log('=== CHOICES (max 21 chars) ===');
for (const [treeId, tree] of Object.entries(DIALOGUES)) {
  for (const [nodeId, node] of Object.entries(tree)) {
    (node.choices || []).forEach(c => {
      if (c.label.length > 21) bad('choice', `"${c.label}" ${c.label.length}ch (${treeId}.${nodeId})`);
    });
  }
}
console.log('  ok');

// ---- 3. battle enemy name vs right-aligned level (window 4,4,92,26; inner right 90)
console.log('=== BATTLE enemy box ===');
for (const [id, m] of Object.entries(MONSTERS)) {
  const nm = m.battleName ?? m.name;
  for (let lvl = 1; lvl <= 12; lvl++) {
    const lvlX = 90 - textWidth(`L${lvl}`);
    const nameMax = Math.max(4, Math.floor((lvlX - 8 - 4) / ADV));
    if (nm.length > nameMax) { bad('battle', `${id} "${nm}" ${nm.length}ch > ${nameMax} at L${lvl}`); break; }
  }
}
console.log('  ok');

// ---- 4. battle messages: 4 lines at wrap 138
console.log('=== BATTLE messages (4 lines, wrap 138) ===');
const APPEAR = {
  drowner: 'A DROWNER claws up from the mire!', ghoul: 'A GHOUL rises, hungry for graves!',
  wolf: 'A WOLF prowls from the brush!', waterhag: 'A WATER HAG surges from the swamp!',
  wraith: 'The air freezes... A WRAITH weeps awake!', werewolf: 'A WEREWOLF bares its yellowed fangs!',
  leshen: 'The LESHEN speaks in a murder of crows!', nekker: 'A NEKKER shrieks - and the reeds answer!',
  endrega: 'An ENDREGA rears, mandibles dripping!', foglet: 'A false lantern gutters... A FOGLET steps out of the mist!',
  noonwraith: 'The sun dims. A NOONWRAITH burns where the bride fell!', rotfiend: 'A ROTFIEND waddles close, bloated with grave gas!',
  barghest: 'A BARGHEST lopes down the scree, embers for eyes!', arachas: 'The bone-wall unfolds! The ARACHAS was the nest!',
  griffin: 'Wings like torn sailcloth! The ROYAL GRIFFIN dives!', katakan: "The KATAKAN smiles with a dead witcher's face!",
};
const msgs = [...Object.values(APPEAR), 'HP+5 STA+2 ATK+1 DEF+1. +1 SKILL POINT - train in the menu!',
  'Too many potions! Drink WHITE HONEY or rest!', 'Roots bind your boots! You cannot move!',
  'You fall to one knee... The world goes dark.'];
for (const m of Object.values(MONSTERS)) {
  const nm = m.battleName ?? m.name;
  for (const mv of m.moves) {
    msgs.push(`${nm} uses ${mv.name}! Regenerates 34!`, `${nm} uses ${mv.name}! QUEN absorbs 25!`);
  }
  msgs.push(`The blade passes through the ${nm}! It needs SPECTER OIL!`, `A clean cut! ${nm} takes 99!`);
}
msgs.forEach(t => { if (lines(t, 138) > 4) bad('battle-msg', `${lines(t, 138)}L "${t}"`); });
console.log(`  ${msgs.length} worst-case messages ok`);

// ---- 5. start menu (x=100, inner right 154)
console.log('=== START MENU ===');
['WITCHER', 'BAG', 'CONTRACTS', 'BESTIARY', 'SKILLS', 'SAVE', 'CLOSE'].forEach(it => {
  if (100 + textWidth(it) > 154) bad('menu', `"${it}" overflows`);
});
console.log('  ok');

// ---- 6. stats rows (x=10, inner right 150)
console.log('=== STATS worst cases ===');
const armorName = 'SCALE'; // armorLvl 2
[ `VESK OF THE ${SCHOOLS.reduce((a, s) => s.name.length > a.length ? s.name : a, '')}`,
  `LEVEL 10  XP 9999/1950`, `HP 99/99    STA 99/99`, `ATTACK 99+99`, `DEFENSE 99+99`,
  `TOXICITY 9/9 !`, `CROWNS 9999`, `SKILL PTS 9 - TRAIN!`, `SWORD    SILVER +9`,
  `ARMOR    ${armorName}`,
].forEach(r => { if (10 + textWidth(r) > 150) bad('stats', `"${r}" ends ${10 + textWidth(r)}`); });
// oils value wraps at 90px from x=58
['SPECTER, NECRO, BEAST, INSECT'].forEach(v => {
  wrapText(v, 90).slice(0, 2).forEach(l => { if (58 + textWidth(l) > 150) bad('stats-oils', `"${l}"`); });
});
console.log('  ok');

// ---- 7. bestiary detail: paginated 10 lines/page, wrap 144 lore / 130 weakness
console.log('=== BESTIARY (paginated) ===');
for (const [id, m] of Object.entries(MONSTERS)) {
  const body = [`TYPE: ${m.type}`, '', 'WEAKNESS:', ...wrapText(MON_TYPES_INFO[m.type], 130), '', ...wrapText(m.lore, 144)];
  const pages = paginateLines(body, 10);
  if (pages.length > 2) bad('bestiary', `${id} needs ${pages.length} pages (>2)`);
  if (textWidth(m.name) > 144) bad('bestiary', `name wide: ${m.name}`);
}
console.log('  ok');

// ---- 8. quests (label slice 24 @8; desc+progress 5 lines wrap 144)
console.log('=== QUESTS ===');
const prog = { q_drowners: ' Culled: 3/3', q_wolves: ' Culled: 4/4', q_herbs: ' Leaves: 3/3' };
for (const [id, q] of Object.entries(QUESTS)) {
  if (textWidth(`> ${q.title}`) > 143) bad('quest', `title sliced: ${q.title}`);
  if (lines(q.desc + (prog[id] || ''), 144) > 5) bad('quest', `desc >5L: ${id}`);
}
console.log('  ok');

// ---- 9. items & shops
console.log('=== ITEMS / SHOPS ===');
for (const [id, it] of Object.entries(ITEMS)) {
  if (it.name.length > 18) bad('item', `bag name sliced: ${it.name}`);
  if (lines(it.desc, 144) > 4) bad('item', `bag desc >4L: ${id}`);
}
for (const [sid, shop] of Object.entries(SHOPS)) {
  for (const s of shop.stock) {
    const g = GEAR[s.item];
    const row = g ? `${g.name} ${g.price}c` : `${ITEMS[s.item].name} ${ITEMS[s.item].price}c`;
    if (14 + textWidth(row.slice(0, 23)) > 154) bad('shop', `buy row wide: ${row}`);
    const d = g ? g.desc : ITEMS[s.item].desc;
    if (lines(d, 144) > 3) bad('shop', `desc >3L: ${s.item}`);
  }
  for (const [iid, it] of Object.entries(ITEMS)) {
    if (!shop.buysKinds.includes(it.kind) || it.sell <= 0) continue;
    const row = `${it.name} x99 =${it.sell}c`;
    if (14 + textWidth(row.slice(0, 23)) > 154) bad('shop', `sell row wide: ${row}`);
  }
  // shop name + right-aligned COIN at 154 must not collide
  const nameEnd = 4 + textWidth(shop.name);
  const coinStart = 154 - textWidth('COIN 99999');
  if (nameEnd + 2 > coinStart) bad('shop', `"${shop.name}" collides with COIN counter`);
}
console.log('  ok');

// ---- 10. board entries (label slice 22 @14 -> end <=145; text paginated)
console.log('=== BOARD ===');
BOARD_ENTRIES.forEach(e => {
  if (textWidth(e.label) > 131) bad('board', `label sliced: ${e.label}`);
  const pages = paginateLines(wrapText(e.text, 138), 4);
  if (pages.some(p => p.length > 4)) bad('board', `page overflow: ${e.id}`);
});
console.log('  ok');

// ---- 11. map banner
console.log('=== MAP NAMES ===');
for (const [id, m] of Object.entries(MAPS)) {
  const w = Math.min(156, textWidth(m.name) + 14);
  if (8 + textWidth(m.name) > w - 2) bad('map', `banner tight: ${m.name}`);
}
console.log('  ok');

// ---- 12. scaled titles
console.log('=== drawTitleText ===');
[['MONSTER', 3], ['SLAYER', 3], ['* GREEN EDITION *', 1], ['SERPENTSOFT', 2],
 ['THE FOREST', 2], ['EXHALES', 2], ['THE CHRONICLE', 1], ['MONSTER', 2], ['SLAYER', 2],
 ['GREEN EDITION', 1], ['CHOOSE YOUR', 1], ['SCHOOL', 1], ['TRAINING', 1]].forEach(([t, k]) => {
  if (textWidth(t) * k > 160) bad('title', `k=${k} "${t}" width ${textWidth(t) * k}`);
});
console.log('  ok');

// ---- 13. fixed strings vs bounds
console.log('=== FIXED STRINGS ===');
function fullLine(ch) { return ch.repeat(23); }
const fixed = [
  ['board footer', 'Nail it. Take it. Live.', 8, 154],
  ['skills hint', 'A:TRAIN B:BACK', 38, 154],
  ['creation hint', 'A: CHOOSE  B: BACK', 26, 154],
  ['fight steel', 'STEEL SWORD - beasts', 12, 154],
  ['fight silver', 'SILVER SWORD - monsters', 12, 154],
  ['ending moral', 'The wraith was destroyed.', 5, 155], // centered: (160-149)/2=5
  ['ending thanks', 'Thank you for playing.', 26, 158],
  ['bestiary hint', 'A: MORE  B: BACK', 8, 154],
  ['shop hint', 'B: back', 108, 154],
  ['medallion', 'Your medallion hums...', 4, 158],
  ['bestiary empty', 'Nothing slain yet.', 8, 154],
  ['signs grid', 'AARD (3)', 88, 154],
  ['signs back', 'B: back', 108, 154],
  ['msg box', fullLine('X'), 8, 145],
  ['dialog line', fullLine('Y'), 8, 145],
];
function fullLine(ch) { return ch.repeat(23); }
fixed.forEach(([where, t, x, right]) => {
  const end = x + textWidth(t);
  if (end > right) bad('fixed', `${where}: "${t}" ends ${end} > ${right}`);
});
console.log('  ok');

// ---- result
if (fails.length) {
  console.log(`\n!!! ${fails.length} FAILURES:`);
  fails.forEach(f => console.log('  ' + f));
  process.exit(1);
} else {
  console.log('\nALL CHECKS PASS — no overflow, no cutoff, no collisions.');
}
