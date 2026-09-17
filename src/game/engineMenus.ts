// ============================================================
// Overlay modes: menu, bag, quests, bestiary, shop, board, ending
// ============================================================
import type { Game } from './engine';
import { C, SCREEN_W, SCREEN_H, TOX_MAX } from './constants';
import { drawWindow, drawDarkWindow, drawCursor, drawTitleText } from './render';
import { drawText, wrapText } from './font';
import { ITEMS, QUESTS, SHOPS, GEAR, MONSTERS, MON_TYPES_INFO, xpForLevel, schoolById } from './data';
import { BOARD_ENTRIES } from './dialogue';
import { audio } from './audio';

// ---------------- helpers ----------------
function invList(g: Game): { id: string; n: number }[] {
  return Object.entries(g.inv)
    .filter(([, n]) => n > 0)
    .map(([id, n]) => ({ id, n }));
}

function moveIdx(g: Game, len: number, key: string): boolean {
  if (len <= 1) return false;
  if (key === 'up') { g.bagIdx = (g.bagIdx + len - 1) % len; audio.sfx('blip'); return true; }
  if (key === 'down') { g.bagIdx = (g.bagIdx + 1) % len; audio.sfx('blip'); return true; }
  return false;
}

// ---------------- main menu ----------------
const MENU_ITEMS = ['WITCHER', 'BAG', 'CONTRACTS', 'BESTIARY', 'SKILLS', 'SAVE', 'CLOSE'];

function updateMenu(g: Game) {
  const J = g.just;
  if (J.has('up')) { g.menuIdx = (g.menuIdx + MENU_ITEMS.length - 1) % MENU_ITEMS.length; audio.sfx('blip'); }
  if (J.has('down')) { g.menuIdx = (g.menuIdx + 1) % MENU_ITEMS.length; audio.sfx('blip'); }
  if (J.has('b') || J.has('start')) { g.mode = 'world'; audio.sfx('cancel'); return; }
  if (J.has('a')) {
    audio.sfx('confirm');
    switch (MENU_ITEMS[g.menuIdx]) {
      case 'WITCHER': g.mode = 'bag'; g.bagIdx = -1; break; // stats page
      case 'BAG': g.mode = 'bag'; g.bagIdx = 0; break;
      case 'CONTRACTS': g.mode = 'quests'; g.questIdx = 0; break;
      case 'BESTIARY': g.mode = 'bestiary'; g.bestIdx = 0; g.bestPage = 0; break;
      case 'SKILLS': g.mode = 'skills'; g.skillsIdx = 0; break;
      case 'SAVE':
        g.save();
        g.startNotice('The chronicle of Vesk is written. (Game saved)');
        break;
      case 'CLOSE': g.mode = 'world'; break;
    }
  }
}

function renderMenu(g: Game, ctx: CanvasRenderingContext2D) {
  g.renderWorld(ctx);
  const h = MENU_ITEMS.length * 11 + 12;
  drawWindow(ctx, 92, 4, 64, h);
  MENU_ITEMS.forEach((it, i) => {
    const y = 10 + i * 11;
    drawText(ctx, it, 106, y, C.INK);
    if (i === g.menuIdx) drawCursor(ctx, 98, y, C.INK);
  });
}

// ---------------- bag & witcher stats ----------------
function updateBag(g: Game) {
  const J = g.just;
  if (g.bagIdx === -1) {
    // stats page
    if (J.has('b') || J.has('a')) { g.mode = 'menu'; audio.sfx('cancel'); }
    return;
  }
  const list = invList(g);
  if (J.has('up')) { g.bagIdx = (g.bagIdx + Math.max(1, list.length) - 1) % Math.max(1, list.length); audio.sfx('blip'); }
  if (J.has('down')) { g.bagIdx = (g.bagIdx + 1) % Math.max(1, list.length); audio.sfx('blip'); }
  if (J.has('b')) { g.mode = 'menu'; audio.sfx('cancel'); return; }
  if (J.has('a') && list.length > 0) {
    const item = list[g.bagIdx];
    if (!item) return;
    const it = ITEMS[item.id];
    audio.sfx('confirm');
    if (it.kind === 'potion') {
      if (item.id === 'swallow') {
        if (g.player.hp >= g.player.maxHp) { g.startNotice('You are unhurt. Waste not.'); return; }
        g.player.hp = Math.min(g.player.maxHp, g.player.hp + 25);
        g.player.tox = Math.min(TOX_MAX, g.player.tox + 3);
        g.inv[item.id]--;
        g.startNotice('SWALLOW: wounds knit. Toxicity +3.');
      } else if (item.id === 'honey') {
        g.player.tox = 0;
        g.inv[item.id]--;
        g.startNotice('WHITE HONEY: your veins run clear.');
      } else if (item.id === 'thunder') {
        g.startNotice('Save the THUNDERBOLT for a fight.');
      }
    } else if (it.kind === 'oil') {
      if (item.id === 'specteroil') g.player.oil.specter = 8;
      if (item.id === 'necrooil') g.player.oil.necro = 8;
      if (item.id === 'beastoil') g.player.oil.beast = 8;
      g.inv[item.id]--;
      g.startNotice(`${it.name} coats your blade. (8 fights)`);
    } else if (it.kind === 'part') {
      g.startNotice('Better sold, or delivered to whoever wants it.');
    } else {
      g.startNotice('Some things are worth more than coin.');
    }
    if ((g.inv[item.id] ?? 0) <= 0) { delete g.inv[item.id]; g.bagIdx = Math.max(0, g.bagIdx - 1); }
  }
}

function renderBag(g: Game, ctx: CanvasRenderingContext2D) {
  if (g.bagIdx === -1) { renderStats(g, ctx); return; }
  g.renderWorld(ctx);
  const list = invList(g);
  drawWindow(ctx, 2, 2, 156, 84);
  if (list.length === 0) {
    drawText(ctx, 'Your pockets hold only lint.', 8, 8, C.INK);
  }
  const start = Math.max(0, Math.min(g.bagIdx - 4, list.length - 7));
  list.slice(start, start + 7).forEach((item, i) => {
    const idx = start + i;
    const it = ITEMS[item.id];
    const y = 8 + i * 11;
    drawText(ctx, `${it.name}`.slice(0, 18), 14, y, C.INK);
    drawText(ctx, `x${item.n}`, 132, y, C.INK);
    if (idx === g.bagIdx) drawCursor(ctx, 6, y, C.INK);
  });
  // desc
  drawWindow(ctx, 2, 88, 156, 54);
  const item = list[g.bagIdx];
  if (item) {
    const it = ITEMS[item.id];
    const lines = wrapText(it.desc, 144);
    lines.slice(0, 4).forEach((l, i) => drawText(ctx, l, 8, 94 + i * 10, C.INK));
  } else {
    drawText(ctx, 'A: use   B: back', 8, 94, C.DARK);
  }
}

function renderStats(g: Game, ctx: CanvasRenderingContext2D) {
  g.renderWorld(ctx);
  const p = g.player;
  const sc = schoolById(p.school);
  drawWindow(ctx, 2, 2, 156, 140);
  drawText(ctx, `VESK OF THE ${sc.name}`, 8, 8, C.INK);
  drawText(ctx, `LEVEL    ${p.lvl}`, 10, 22, C.INK);
  drawText(ctx, `HP       ${p.hp}/${p.maxHp}`, 10, 32, C.INK);
  drawText(ctx, `STAMINA  ${p.sta}/${p.maxSta}`, 10, 42, C.INK);
  drawText(ctx, `ATTACK   ${p.atk}${p.swordLvl ? '+' + p.swordLvl * 3 : ''}`, 10, 52, C.INK);
  drawText(ctx, `DEFENSE  ${p.def}${p.armorLvl ? '+' + p.armorLvl * 2 : ''}`, 10, 62, C.INK);
  drawText(ctx, `TOXICITY ${p.tox}/${TOX_MAX}${p.tox > 6 ? ' !' : ''}`, 10, 72, C.INK);
  drawText(ctx, `CROWNS   ${p.crowns}`, 10, 82, C.INK);
  const next = p.lvl < 10 ? xpForLevel(p.lvl + 1) : xpForLevel(10);
  drawText(ctx, `XP       ${p.xp}/${next}`, 10, 92, C.INK);
  drawText(ctx, `SKILL PTS ${p.skillPoints}${p.skillPoints > 0 ? ' - TRAIN!' : ''}`, 10, 104, p.skillPoints > 0 ? C.INK : C.DARK);
  drawText(ctx, `SWORD    SILVER${p.swordLvl ? ' +' + p.swordLvl : ''}`, 10, 114, C.INK);
  drawText(ctx, `ARMOR    NONE${p.armorLvl ? '/LEATHER' : ''}${p.armorLvl > 1 ? '/SCALE' : ''}`, 10, 124, C.INK);
  const oils = [p.oil.specter ? 'SPECTER ' : '', p.oil.necro ? 'NECRO ' : '', p.oil.beast ? 'BEAST' : '', p.oil.insectoid ? ' INSECT' : ''].filter(Boolean).join(' ');
  drawText(ctx, oils ? `OILS: ${oils}` : 'OILS: none', 10, 134, C.DARK);
}

// ---------------- quests ----------------
function questList(g: Game): { id: string; label: string }[] {
  const out: { id: string; label: string }[] = [];
  for (const [id, q] of Object.entries(g.quests)) {
    if (!q.active && !q.done) continue;
    const def = QUESTS[id];
    if (!def) continue;
    out.push({ id, label: `${q.done ? '*' : '>'} ${def.title}` });
  }
  return out;
}

function updateQuests(g: Game) {
  const J = g.just;
  const list = questList(g);
  if (J.has('up') && list.length) { g.questIdx = (g.questIdx + list.length - 1) % list.length; audio.sfx('blip'); }
  if (J.has('down') && list.length) { g.questIdx = (g.questIdx + 1) % list.length; audio.sfx('blip'); }
  if (J.has('b') || J.has('a')) { g.mode = 'menu'; audio.sfx('cancel'); }
}

function renderQuests(g: Game, ctx: CanvasRenderingContext2D) {
  g.renderWorld(ctx);
  const list = questList(g);
  drawWindow(ctx, 2, 2, 156, 62);
  if (list.length === 0) {
    drawText(ctx, 'No contracts yet. Read the BOARD.', 8, 8, C.INK);
  }
  list.slice(0, 4).forEach((q, i) => {
    const y = 8 + i * 12;
    drawText(ctx, q.label.slice(0, 24), 8, y, C.INK);
  });
  drawWindow(ctx, 2, 66, 156, 76);
  const sel = list[Math.min(g.questIdx, Math.max(0, list.length - 1))];
  if (sel) {
    const def = QUESTS[sel.id];
    const st = g.quests[sel.id];
    let progress = '';
    if (sel.id === 'q_drowners' && st.active) progress = ` Culled: ${Math.min(3, g.kills.drowner ?? 0)}/3`;
    if (sel.id === 'q_wolves' && st.active) progress = ` Culled: ${Math.min(4, g.kills.wolf ?? 0)}/4`;
    if (sel.id === 'q_herbs' && st.active) progress = ` Leaves: ${Math.min(3, g.inv.foolleaf ?? 0)}/3`;
    const lines = wrapText(def.desc + progress, 144);
    lines.slice(0, 5).forEach((l, i) => drawText(ctx, l, 8, 72 + i * 10, C.INK));
    drawText(ctx, st.done ? 'STATUS: DONE' : 'STATUS: ACTIVE', 8, 126, C.DARK);
  }
}

// ---------------- bestiary ----------------
function bestList(g: Game): string[] {
  return Object.keys(MONSTERS).filter((id) => g.bestiary[id]);
}

function updateBestiary(g: Game) {
  const J = g.just;
  const list = bestList(g);
  if (g.bestPage > 0) {
    if (J.has('b') || J.has('a')) { g.bestPage = 0; audio.sfx('cancel'); }
    return;
  }
  if (J.has('up') && list.length) { g.bestIdx = (g.bestIdx + list.length - 1) % list.length; audio.sfx('blip'); }
  if (J.has('down') && list.length) { g.bestIdx = (g.bestIdx + 1) % list.length; audio.sfx('blip'); }
  if (J.has('b')) { g.mode = 'menu'; audio.sfx('cancel'); return; }
  if (J.has('a') && list.length) { g.bestPage = 1; audio.sfx('confirm'); }
}

function renderBestiary(g: Game, ctx: CanvasRenderingContext2D) {
  g.renderWorld(ctx);
  const list = bestList(g);
  if (g.bestPage === 0) {
    drawWindow(ctx, 2, 2, 156, 58);
    drawText(ctx, 'BESTIARY', 60, 8, C.INK);
    if (list.length === 0) drawText(ctx, 'Nothing slain, nothing learned.', 8, 26, C.INK);
    list.slice(0, 3).forEach((id, i) => {
      const m = MONSTERS[id];
      const y = 22 + i * 11;
      drawText(ctx, m.name, 14, y, C.INK);
      if (i === g.bestIdx) drawCursor(ctx, 6, y, C.INK);
    });
    if (list.length > 3) drawText(ctx, `+${list.length - 3} more`, 100, 44, C.DARK);
    drawText(ctx, `A: read   B: back`, 34, 66, C.DARK);
  } else {
    const id = list[Math.min(g.bestIdx, list.length - 1)];
    const m = MONSTERS[id];
    drawWindow(ctx, 2, 2, 156, 140);
    drawText(ctx, m.name, 8, 8, C.INK);
    drawText(ctx, `TYPE: ${m.type}`, 8, 20, C.INK);
    drawText(ctx, 'WEAKNESS:', 8, 32, C.INK);
    const w = wrapText(MON_TYPES_INFO[m.type], 130);
    w.slice(0, 2).forEach((l, i) => drawText(ctx, l, 14, 42 + i * 10, C.INK));
    const lines = wrapText(m.lore, 144);
    lines.slice(0, 6).forEach((l, i) => drawText(ctx, l, 8, 66 + i * 10, C.INK));
    drawText(ctx, 'A/B: back', 100, 132, C.DARK);
  }
}

// ---------------- skills ----------------
const SKILL_OPTIONS: { key: string; label: string; desc: string }[] = [
  { key: 'vit', label: 'VITALITY', desc: 'Max HP +3. A dead witcher hunts nothing.' },
  { key: 'sta', label: 'STAMINA', desc: 'Max STA +2. More signs per fight.' },
  { key: 'atk', label: 'SWORDPLAY', desc: 'Attack +1. The fast road through a fight.' },
  { key: 'def', label: 'ARMOR', desc: 'Defense +1. Outlast the big ones.' },
];

function updateSkills(g: Game) {
  const J = g.just;
  const n = SKILL_OPTIONS.length + 1; // + DONE
  if (J.has('up')) { g.skillsIdx = (g.skillsIdx + n - 1) % n; audio.sfx('blip'); }
  if (J.has('down')) { g.skillsIdx = (g.skillsIdx + 1) % n; audio.sfx('blip'); }
  if (J.has('b') || J.has('start')) { g.mode = 'menu'; g.menuIdx = 4; audio.sfx('cancel'); return; }
  if (J.has('a')) {
    if (g.skillsIdx >= SKILL_OPTIONS.length) { g.mode = 'menu'; g.menuIdx = 4; audio.sfx('confirm'); return; }
    const p = g.player;
    if (p.skillPoints <= 0) {
      audio.sfx('cancel');
      g.startNotice('No skill points. Levels grant them - go earn one.', undefined, () => { g.mode = 'skills'; });
      return;
    }
    const opt = SKILL_OPTIONS[g.skillsIdx];
    p.skillPoints--;
    if (opt.key === 'vit') { p.maxHp += 3; p.hp += 3; }
    if (opt.key === 'sta') { p.maxSta += 2; p.sta += 2; }
    if (opt.key === 'atk') p.atk += 1;
    if (opt.key === 'def') p.def += 1;
    audio.sfx('levelup');
    const gain = opt.key === 'vit' ? 'HP+3' : opt.key === 'sta' ? 'STA+2' : opt.key === 'atk' ? 'ATK+1' : 'DEF+1';
    g.startNotice(`${opt.label} trained! ${gain} (${p.skillPoints} point${p.skillPoints === 1 ? '' : 's'} left)`, undefined, () => { g.mode = 'skills'; });
  }
}

function renderSkills(g: Game, ctx: CanvasRenderingContext2D) {
  g.renderWorld(ctx);
  ctx.fillStyle = 'rgba(15,56,15,0.92)';
  ctx.fillRect(0, 0, 160, 144);
  drawTitleText(ctx, 'TRAINING', 80, 10, 1, C.PAPER);
  const sc = schoolById(g.player.school);
  drawText(ctx, `SCHOOL: ${sc.name}`, 14, 26, C.LIGHT);
  drawText(ctx, `POINTS: ${g.player.skillPoints}`, 96, 26, g.player.skillPoints > 0 ? C.PAPER : C.DARK);
  SKILL_OPTIONS.forEach((o, i) => {
    const y = 40 + i * 14;
    drawText(ctx, o.label, 22, y, i === g.skillsIdx ? C.INK : C.DARK);
    if (i === g.skillsIdx) drawCursor(ctx, 12, y, C.INK);
  });
  const sel = SKILL_OPTIONS[g.skillsIdx];
  if (sel) {
    wrapText(sel.desc, 148).forEach((line, i) => {
      drawText(ctx, line, 6, 102 + i * 10, C.PAPER);
    });
  }
  const doneY = 40 + SKILL_OPTIONS.length * 14;
  drawText(ctx, 'DONE', 22, doneY, g.skillsIdx === SKILL_OPTIONS.length ? C.INK : C.DARK);
  if (g.skillsIdx === SKILL_OPTIONS.length) drawCursor(ctx, 12, doneY, C.INK);
  drawText(ctx, 'A:TRAIN B:BACK', 38, 136, C.LIGHT);
}

// ---------------- shop ----------------
function shopEntries(g: Game, shopId: string): { key: string; label: string; desc: string; price: number; mats?: [string, number]; gear?: string }[] {
  const shop = SHOPS[shopId];
  const out: { key: string; label: string; desc: string; price: number; mats?: [string, number]; gear?: string }[] = [];
  for (const s of shop.stock) {
    if (s.once && g.flags[`owned_${s.item}`]) continue;
    if (s.reqFlag && !g.flags[s.reqFlag]) continue;
    if (GEAR[s.item]) {
      const gr = GEAR[s.item];
      out.push({
        key: s.item,
        label: `${gr.name} ${gr.price}c`,
        desc: gr.desc,
        price: gr.price,
        mats: s.mats,
        gear: s.item,
      });
    } else {
      const it = ITEMS[s.item];
      out.push({ key: s.item, label: `${it.name} ${it.price}c`, desc: it.desc, price: it.price });
    }
  }
  return out;
}

function sellList(g: Game, shopId: string): { id: string; label: string; sell: number }[] {
  const shop = SHOPS[shopId];
  return invList(g)
    .filter(({ id }) => {
      const it = ITEMS[id];
      return it && it.sell > 0 && shop.buysKinds.includes(it.kind);
    })
    .map(({ id, n }) => ({ id, label: `${ITEMS[id].name} x${n}`, sell: ITEMS[id].sell }));
}

function updateShop(g: Game) {
  const J = g.just;
  if (g.shopTab === 0) {
    const opts = ['BUY', 'SELL', 'LEAVE'];
    if (J.has('up')) { g.shopIdx = (g.shopIdx + 2) % 3; audio.sfx('blip'); }
    if (J.has('down')) { g.shopIdx = (g.shopIdx + 1) % 3; audio.sfx('blip'); }
    if (J.has('b')) { g.mode = 'world'; audio.playMusic(g.mapDef.music); audio.sfx('cancel'); return; }
    if (J.has('a')) {
      audio.sfx('confirm');
      if (g.shopIdx === 0) { g.shopTab = 1; g.shopIdx = 0; }
      else if (g.shopIdx === 1) { g.shopTab = 2; g.shopIdx = 0; }
      else { g.mode = 'world'; audio.playMusic(g.mapDef.music); }
    }
    return;
  }
  if (g.shopTab === 1) {
    const entries = shopEntries(g, g.shopId);
    const n = entries.length + 1;
    if (J.has('up') && n > 1) { g.shopIdx = (g.shopIdx + n - 1) % n; audio.sfx('blip'); }
    if (J.has('down') && n > 1) { g.shopIdx = (g.shopIdx + 1) % n; audio.sfx('blip'); }
    if (J.has('b')) { g.shopTab = 0; g.shopIdx = 0; audio.sfx('cancel'); return; }
    if (J.has('a')) {
      if (g.shopIdx >= entries.length || entries.length === 0) { g.shopTab = 0; g.shopIdx = 0; audio.sfx('cancel'); return; }
      const e = entries[g.shopIdx];
      const p = g.player;
      if (p.crowns < e.price) { g.startNotice('Not enough crowns. The forge does not do credit.'); return; }
      if (e.mats) {
        const [mid, mn] = e.mats;
        if ((g.inv[mid] ?? 0) < mn) {
          g.startNotice(`You lack the materials: ${ITEMS[mid].name} x${mn}.`);
          return;
        }
      }
      p.crowns -= e.price;
      if (e.mats) {
        const [mid, mn] = e.mats;
        g.inv[mid] = (g.inv[mid] ?? 0) - mn;
        if (g.inv[mid] <= 0) delete g.inv[mid];
      }
      if (e.gear === 'sword1' || e.gear === 'sword2') { p.swordLvl = e.gear === 'sword2' ? 2 : 1; g.flags.owned_sword1 = true; g.flags.owned_sword2 = true; }
      if (e.gear === 'armor1' || e.gear === 'armor2') { p.armorLvl = e.gear === 'armor2' ? 2 : 1; g.flags.owned_armor1 = true; g.flags.owned_armor2 = true; }
      if (!e.gear) g.inv[e.key] = (g.inv[e.key] ?? 0) + 1;
      audio.sfx('coin');
      g.startNotice(e.gear ? 'Torv hammers the steel. It sings a new, sharper song.' : `Bought: ${ITEMS[e.key].name}.`);
    }
    return;
  }
  // sell
  const list = sellList(g, g.shopId);
  const n = list.length + 1;
  if (J.has('up') && n > 1) { g.shopIdx = (g.shopIdx + n - 1) % n; audio.sfx('blip'); }
  if (J.has('down') && n > 1) { g.shopIdx = (g.shopIdx + 1) % n; audio.sfx('blip'); }
  if (J.has('b')) { g.shopTab = 0; g.shopIdx = 0; audio.sfx('cancel'); return; }
  if (J.has('a')) {
    if (g.shopIdx >= list.length || list.length === 0) { g.shopTab = 0; g.shopIdx = 0; audio.sfx('cancel'); return; }
    const e = list[g.shopIdx];
    g.inv[e.id]--;
    if (g.inv[e.id] <= 0) delete g.inv[e.id];
    g.player.crowns += e.sell;
    audio.sfx('coin');
    g.startNotice(`Sold ${ITEMS[e.id].name} for ${e.sell} crowns.`);
    if (g.shopIdx >= list.length - 1) g.shopIdx = Math.max(0, list.length - 2);
  }
}

function renderShop(g: Game, ctx: CanvasRenderingContext2D) {
  g.renderWorld(ctx);
  const shop = SHOPS[g.shopId];
  drawText(ctx, shop.name, 4, 2, C.INK);
  drawText(ctx, `CROWNS ${g.player.crowns}`, 96, 2, C.INK);

  if (g.shopTab === 0) {
    drawWindow(ctx, 2, 12, 156, 46);
    ['BUY', 'SELL', 'LEAVE'].forEach((it, i) => {
      const y = 18 + i * 12;
      drawText(ctx, it, 20, y, C.INK);
      if (i === g.shopIdx) drawCursor(ctx, 10, y, C.INK);
    });
    drawText(ctx, 'Coin for goods.', 76, 22, C.DARK);
    drawText(ctx, 'Goods for coin.', 76, 34, C.DARK);
    return;
  }

  drawWindow(ctx, 2, 12, 156, 80);
  if (g.shopTab === 1) {
    const entries = shopEntries(g, g.shopId);
    if (entries.length === 0) drawText(ctx, 'Sold out of everything useful.', 8, 18, C.INK);
    entries.slice(0, 6).forEach((e, i) => {
      const y = 18 + i * 12;
      const mat = e.mats ? ` +${e.mats[1]} ${ITEMS[e.mats[0]].name.split(' ')[0]}` : '';
      drawText(ctx, `${e.label}${mat}`.slice(0, 24), 14, y, C.INK);
      if (i === g.shopIdx) drawCursor(ctx, 6, y, C.INK);
    });
    const y = 18 + Math.min(6, entries.length) * 12;
    drawText(ctx, 'BACK', 14, y, C.INK);
    if (g.shopIdx >= entries.length) drawCursor(ctx, 6, y, C.INK);
  } else {
    const list = sellList(g, g.shopId);
    if (list.length === 0) drawText(ctx, 'Nothing they would buy.', 8, 18, C.INK);
    list.slice(0, 6).forEach((e, i) => {
      const y = 18 + i * 12;
      drawText(ctx, `${e.label} =${e.sell}c`.slice(0, 24), 14, y, C.INK);
      if (i === g.shopIdx) drawCursor(ctx, 6, y, C.INK);
    });
    const y = 18 + Math.min(6, list.length) * 12;
    drawText(ctx, 'BACK', 14, y, C.INK);
    if (g.shopIdx >= list.length) drawCursor(ctx, 6, y, C.INK);
  }

  // desc
  drawWindow(ctx, 2, 94, 156, 48);
  if (g.shopTab === 1) {
    const entries = shopEntries(g, g.shopId);
    const e = entries[g.shopIdx];
    if (e) {
      const lines = wrapText(e.desc, 144);
      lines.slice(0, 3).forEach((l, i) => drawText(ctx, l, 8, 100 + i * 10, C.INK));
    }
  } else {
    const list = sellList(g, g.shopId);
    const e = list[g.shopIdx];
    if (e) drawText(ctx, `Sells for ${e.sell} crowns.`, 8, 100, C.INK);
  }
  drawText(ctx, 'B: back', 108, 134, C.DARK);
}

// ---------------- notice board ----------------
function boardList(g: Game) {
  return BOARD_ENTRIES.filter((e) => g.checkCond(e.cond));
}

function updateBoard(g: Game) {
  const J = g.just;
  const entries = boardList(g);
  const n = entries.length + 1;
  if (J.has('up') && n > 1) { g.boardIdx = (g.boardIdx + n - 1) % n; audio.sfx('blip'); }
  if (J.has('down') && n > 1) { g.boardIdx = (g.boardIdx + 1) % n; audio.sfx('blip'); }
  if (J.has('b')) { g.mode = 'world'; audio.sfx('cancel'); return; }
  if (J.has('a')) {
    if (g.boardIdx >= entries.length || entries.length === 0) { g.mode = 'world'; audio.sfx('cancel'); return; }
    const e = entries[g.boardIdx];
    audio.sfx('confirm');
    g.startNotice(
      e.text,
      e.action
        ? [
            { label: 'TAKE CONTRACT', next: null, action: `${e.action},save` },
            { label: 'LEAVE IT', next: null },
          ]
        : undefined,
    );
  }
}

function renderBoard(g: Game, ctx: CanvasRenderingContext2D) {
  g.renderWorld(ctx);
  const entries = boardList(g);
  drawWindow(ctx, 2, 2, 156, 110);
  drawText(ctx, 'NOTICE BOARD', 46, 8, C.INK);
  entries.slice(0, 6).forEach((e, i) => {
    const y = 22 + i * 12;
    drawText(ctx, e.label.slice(0, 22), 14, y, C.INK);
    if (i === g.boardIdx) drawCursor(ctx, 6, y, C.INK);
  });
  const y = 22 + Math.min(6, entries.length) * 12;
  drawText(ctx, 'CLOSE', 14, y, C.INK);
  if (g.boardIdx >= entries.length) drawCursor(ctx, 6, y, C.INK);
  drawWindow(ctx, 2, 114, 156, 28);
  drawText(ctx, 'A: read   B: back', 8, 122, C.INK);
  drawText(ctx, 'Nail it. Take it. Survive it.', 8, 132, C.DARK);
}

// ---------------- ending ----------------
function updateEnding(g: Game) {
  const J = g.just;
  g.endingT += 16;
  if (J.has('a') || J.has('start')) {
    audio.sfx('confirm');
    g.endingPage++;
    if (g.endingPage > 2) {
      g.mode = 'title';
      g.titleStarted = false;
      g.titleT = 0;
      audio.playMusic('title');
    }
  }
}

function renderEnding(g: Game, ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = C.INK;
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
  const p = g.player;
  if (g.endingPage === 0) {
    drawTitleText(ctx, 'THE FOREST', SCREEN_W / 2, 30, 2, C.PAPER);
    drawTitleText(ctx, 'EXHALES', SCREEN_W / 2, 50, 2, C.PAPER);
    if (g.endingT > 800) {
      const lines = wrapText('The leshen is slain. The crows return to Hollow Creek, and the village breathes again.', 140);
      lines.slice(0, 4).forEach((l, i) => drawText(ctx, l, 10, 76 + i * 11, C.LIGHT));
    }
  } else if (g.endingPage === 1) {
    drawTitleText(ctx, 'THE CHRONICLE', SCREEN_W / 2, 12, 1, C.LIGHT);
    const totalKills = Object.values(g.kills).reduce((a, b) => a + b, 0);
    const done = Object.values(g.quests).filter((q) => q.done).length;
    drawText(ctx, `LEVEL REACHED   ${p.lvl}`, 14, 34, C.PAPER);
    drawText(ctx, `MONSTERS SLAIN  ${totalKills}`, 14, 48, C.PAPER);
    drawText(ctx, `CONTRACTS DONE  ${done}/6`, 14, 62, C.PAPER);
    drawText(ctx, `CROWNS EARNED   ${p.crowns}`, 14, 76, C.PAPER);
    let moral = 'The graves still weep.';
    if (g.flags.wraithPeace) moral = 'The widow found peace.';
    else if (g.flags.wraithDestroy) moral = 'The wraith was destroyed.';
    drawText(ctx, 'AND IN THE END...', 14, 94, C.LIGHT);
    drawText(ctx, moral, 14, 108, C.PAPER);
  } else {
    drawTitleText(ctx, 'MONSTER SLAYER', SCREEN_W / 2, 40, 2, C.PAPER);
    drawTitleText(ctx, 'GREEN EDITION', SCREEN_W / 2, 62, 1, C.LIGHT);
    drawText(ctx, 'THE END', 58, 90, C.PAPER);
    drawText(ctx, 'Thank you for playing.', 26, 108, C.LIGHT);
    drawText(ctx, '- SERPENTSOFT 1273 -', 16, 122, C.DARK);
  }
  if (Math.floor(g.time / 400) % 2 === 0) drawText(ctx, '▼', 146, 132, C.LIGHT);
}

// ---------------- dispatch ----------------
export function updateOverlayMode(g: Game, _dt: number) {
  switch (g.mode) {
    case 'menu': updateMenu(g); break;
    case 'bag': updateBag(g); break;
    case 'quests': updateQuests(g); break;
    case 'bestiary': updateBestiary(g); break;
    case 'skills': updateSkills(g); break;
    case 'shop': updateShop(g); break;
    case 'board': updateBoard(g); break;
    case 'ending': updateEnding(g); break;
    default: break;
  }
}

export function renderOverlayMode(g: Game, ctx: CanvasRenderingContext2D) {
  switch (g.mode) {
    case 'menu': renderMenu(g, ctx); break;
    case 'bag': renderBag(g, ctx); break;
    case 'quests': renderQuests(g, ctx); break;
    case 'bestiary': renderBestiary(g, ctx); break;
    case 'skills': renderSkills(g, ctx); break;
    case 'shop': renderShop(g, ctx); break;
    case 'board': renderBoard(g, ctx); break;
    case 'ending': renderEnding(g, ctx); break;
    default: break;
  }
}
