// BTL-verify pixel analysis: region diffs proving/disproving the 10 fixes.
const sharp = require('sharp');
const fs = require('fs');
const OUT = '/home/z/my-project/scripts/btl-verify/out';

async function raw(file) {
  const { data, info } = await sharp(`${OUT}/${file}`).raw().toBuffer({ resolveWithObject: true });
  return { w: info.width, h: info.height, ch: info.channels, data };
}
async function diffRegion(a, b, x0, y0, x1, y1) {
  const A = await raw(a), B = await raw(b);
  let n = 0;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = (y * A.w + x) * A.ch;
      if (A.data[i] !== B.data[i] || A.data[i + 1] !== B.data[i + 1] || A.data[i + 2] !== B.data[i + 2]) n++;
    }
  }
  const total = (x1 - x0 + 1) * (y1 - y0 + 1);
  return { a, b, region: [x0, y0, x1, y1], changed: n, total, pct: +(100 * n / total).toFixed(2) };
}

// regions (160x144 GB frame)
const MON_MOB = [104, 0, 159, 53];       // monster + panel, mob slot (32px @116,20)
const MON_HEAD_MOB = [104, 14, 159, 36]; // axii orbit dots around a mob's head
const PANEL_BG_STRIP = [100, 0, 108, 53]; // enemy PAPER panel bg left of the sprite
const PANEL_FULL = [100, 0, 159, 53];
const SPRITE_BOSS = [110, 4, 157, 51];   // boss sprite slot (48px @110,4)
const PLAYER_REG = [8, 55, 52, 95];       // player back sprite + platform + brackets
const FULL = [0, 0, 159, 143];
const ITEM_WIN = [2, 100, 158, 142];     // item list window
const ENEMY_BOX = [4, 4, 96, 30];        // enemy info box (name/L/HP/STN)

(async () => {
  const R = [];
  const d = async (a, b, reg, tag) => { R.push({ tag: tag || '', ...(await diffRegion(a, b, ...reg)) }); };

  // ---- (1) MONSTER ATTACK LUNGE (wolf L4, its own attack, 6 frames) ----
  const g = ['038_G_mon_lunge_00.png', '039_G_mon_lunge_01.png', '040_G_mon_lunge_02.png', '041_G_mon_lunge_03.png', '042_G_mon_lunge_04.png', '043_G_mon_lunge_05.png'];
  for (let i = 0; i + 1 < g.length; i++) await d(g[i], g[i + 1], MON_MOB, 'G wolf lunge consecutive');
  await d(g[0], g[2], MON_MOB, 'G wolf lunge frame0 vs strike');
  await d(g[0], g[3], MON_MOB, 'G wolf lunge frame0 vs hold(-7px)');
  // control: wolf menu (static monster) consecutive 300ms-ish — text box only
  await d('037_G_menu_wolf.png', '037_G_menu_wolf.png', MON_MOB, 'G control self');

  // drowner counter lunge (mob, its own attack)
  const b2 = ['009_B_monatk_drowner_00.png', '010_B_monatk_drowner_01.png', '011_B_monatk_drowner_02.png', '012_B_monatk_drowner_03.png'];
  for (let i = 0; i + 1 < b2.length; i++) await d(b2[i], b2[i + 1], MON_MOB, 'B drowner counter consecutive');
  await d('004_A_menu.png', b2[1], MON_MOB, 'B drowner counter vs menu (sprite displacement)');

  // ---- (2) IGNI flash visible over the enemy PAPER panel (was 0 px) ----
  for (const f of ['046_H_igni_flash_00.png', '047_H_igni_flash_01.png', '048_H_igni_flash_02.png', '049_H_igni_flash_03.png', '050_H_igni_flash_04.png', '051_H_igni_flash_05.png']) {
    await d('044_H_menu_boss.png', f, PANEL_BG_STRIP, 'H igni flash vs menu (panel bg strip)');
  }
  await d('044_H_menu_boss.png', '047_H_igni_flash_01.png', PANEL_FULL, 'H igni flash vs menu (full panel)');
  await d('044_H_menu_boss.png', '047_H_igni_flash_01.png', SPRITE_BOSS, 'H igni flash vs menu (boss sprite + fire)');

  // ---- QUEN VFX: cast frames + persistent brackets ----
  const q = ['017_D_quen_cast_00.png', '018_D_quen_cast_01.png', '019_D_quen_cast_02.png', '020_D_quen_cast_03.png'];
  for (let i = 0; i + 1 < q.length; i++) await d(q[i], q[i + 1], PLAYER_REG, 'D quen cast consecutive');
  await d('004_A_menu.png', '021_D_quen_persist_1.png', PLAYER_REG, 'D quen persist_1 vs plain menu (brackets?)');
  await d('004_A_menu.png', '022_D_quen_persist_2.png', PLAYER_REG, 'D quen persist_2 vs plain menu (brackets?)');
  await d('021_D_quen_persist_1.png', '022_D_quen_persist_2.png', PLAYER_REG, 'D quen blink persist_1 vs 2');

  // ---- AXII orbit dots ----
  const x = ['025_E_axii_orbit_00.png', '026_E_axii_orbit_01.png', '027_E_axii_orbit_02.png', '028_E_axii_orbit_03.png'];
  for (let i = 0; i + 1 < x.length; i++) await d(x[i], x[i + 1], MON_HEAD_MOB, 'E axii orbit consecutive');

  // ---- swallow heal sparkles ----
  const h = ['031_F_heal_00.png', '032_F_heal_01.png', '033_F_heal_02.png', '034_F_heal_03.png', '035_F_heal_04.png'];
  for (let i = 0; i + 1 < h.length; i++) await d(h[i], h[i + 1], PLAYER_REG, 'F heal sparkle consecutive');

  // ---- oil glint ----
  const o = ['070_J_oil_glint_00.png', '071_J_oil_glint_01.png', '072_J_oil_glint_02.png', '073_J_oil_glint_03.png'];
  for (let i = 0; i + 1 < o.length; i++) await d(o[i], o[i + 1], PLAYER_REG, 'J oil glint consecutive');

  // ---- intro slide-in (both sprites move; player region slides from left) ----
  await d('000_A_intro_t0.png', '001_A_intro_t300.png', FULL, 'A intro t0->t300 full');
  await d('001_A_intro_t300.png', '002_A_intro_t600.png', FULL, 'A intro t300->t600 full');

  // ---- deferred faint: scorched (monster drawn) vs faint start (sink/blink) ----
  await d('101_H2_kill_scorched.png', '102_H2_faint_00.png', MON_MOB, 'H2 scorched->faint starts');
  await d('101_H2_kill_scorched.png', '107_H2_faint_05.png', MON_MOB, 'H2 scorched->faint end (gone)');

  // ---- player KO sink (defeat) ----
  const ko = ['061_I_player_ko_00.png', '062_I_player_ko_01.png', '063_I_player_ko_02.png', '064_I_player_ko_03.png', '065_I_player_ko_04.png'];
  for (let i = 0; i + 1 < ko.length; i++) await d(ko[i], ko[i + 1], PLAYER_REG, 'I player KO sink consecutive');

  // ---- item menu scroll (list window changes when scrolling to 4th row) ----
  await d('013_C_item_top.png', '014_C_item_idx3_a.png', ITEM_WIN, 'C item top vs idx3 (scrolled rows)');

  // ---- gameover screen evolves (title->monster->pressA) ----
  await d('066_I_gameover_0300.png', '067_I_gameover_1300.png', FULL, 'I gameover 300->1300');
  await d('067_I_gameover_1300.png', '068_I_gameover_2500.png', FULL, 'I gameover 1300->2500');

  // ---- HP/STA bar origins on the menu frame: columns of bar starts ----
  // (objective check done separately by scanning pixel rows; here: menu vs post-hit php bar)
  await d('004_A_menu.png', '029_F_swallow_blocked.png', FULL, 'A menu vs F blocked (control)');

  fs.writeFileSync(`${OUT}/pixel-analysis.json`, JSON.stringify(R, null, 1));
  for (const r of R) console.log(`${r.tag.padEnd(46)} ${r.a} vs ${r.b} [${r.region}] ${r.changed}/${r.total} (${r.pct}%)`);

  // ---- bar-origin scan on the menu frame (HP y=68/69, STA y=78/79; both start x=102) ----
  const M = await raw('004_A_menu.png');
  const scanRow = (y) => {
    let first = -1;
    for (let x = 100; x < 152; x++) {
      const i = (y * M.w + x) * M.ch;
      const v = [M.data[i], M.data[i + 1], M.data[i + 2]].join(',');
      // bar ink = darkest fill on the window bg
      if (v === '17,17,17' || v === '68,68,68') { if (first < 0) first = x; }
    }
    return first;
  };
  console.log('\nbar origin scan: HP row first-ink x =', scanRow(68), '| STA row first-ink x =', scanRow(78), '(expect both 102)');
})().catch((e) => { console.error(e); process.exit(1); });
