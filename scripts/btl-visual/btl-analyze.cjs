// BTL-visual pixel analysis: region diffs to prove/disprove audit claims.
const sharp = require('sharp');
const fs = require('fs');
const OUT = '/home/z/my-project/scripts/btl-visual/out';

async function raw(file) {
  const { data, info } = await sharp(`${OUT}/${file}`).raw().toBuffer({ resolveWithObject: true });
  return { w: info.width, h: info.height, ch: info.channels, data };
}

// count pixels differing between two frames within region
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

// monster sprite region (mob 32px @116,20; boss 48px @110,4) incl panel
const MON_MOB = [104, 0, 159, 53];
const MON_BOSS = [104, 0, 159, 53];
const PANEL_BG_STRIP = [100, 0, 108, 53];  // paper panel bg only (boss sprite starts x110)
const SPRITE_BOSS = [110, 4, 157, 51];
const SKY = [0, 31, 96, 51];              // dark sky left of enemy box/panel
const PLAYER_REG = [8, 55, 52, 95];
const MSG_BOX = [2, 100, 157, 141];

(async () => {
  const R = [];

  // ---- 1. MONSTER ATTACK NO-LUNGE: wolf counter frames (playerhit anim) ----
  const wolf = ['043_C_monatk_00.png', '044_C_monatk_01.png', '045_C_monatk_02.png', '046_C_monatk_03.png', '047_C_monatk_04.png', '048_C_monatk_05.png'];
  for (let i = 0; i + 1 < wolf.length; i++) {
    R.push(await diffRegion(wolf[i], wolf[i + 1], ...MON_MOB));
  }
  // also: whole counter vs pre-attack menu (monster region must be identical)
  R.push(await diffRegion('039_C_menu.png', '045_C_monatk_02.png', ...MON_MOB));

  // ---- 2. PLAYER LUNGE during player attack (monhit anim>300 vs anim done) ----
  R.push(await diffRegion('201_A2_hit_00.png', '207_A2_drain_00.png', ...PLAYER_REG)); // lunge 6px ON vs OFF
  R.push(await diffRegion('201_A2_hit_00.png', '204_A2_hit_03.png', ...PLAYER_REG));  // consecutive burst frames
  // player region during MONSTER attack (wolf bite) — blink expected, no other motion
  R.push(await diffRegion('043_C_monatk_00.png', '046_C_monatk_03.png', ...PLAYER_REG));

  // ---- 3. IGNI FLASH visibility ----
  // panel bg strip: flash frame vs pre-cast menu -> expect 0 (invisible over PAPER)
  R.push(await diffRegion('016_B_menu_boss.png', '018_B_igni_flash_01.png', ...PANEL_BG_STRIP));
  R.push(await diffRegion('016_B_menu_boss.png', '019_B_igni_flash_02.png', ...PANEL_BG_STRIP));
  // dark sky: flash frame vs pre-cast -> expect large (visible flash)
  R.push(await diffRegion('016_B_menu_boss.png', '018_B_igni_flash_01.png', ...SKY));
  // boss sprite under flash -> washed 50% toward paper
  R.push(await diffRegion('016_B_menu_boss.png', '018_B_igni_flash_01.png', ...SPRITE_BOSS));
  // flash vs flash (control — should be small, only text/typing)
  R.push(await diffRegion('017_B_igni_flash_00.png', '019_B_igni_flash_02.png', ...SKY));

  // ---- 4. QUEN / AXII / ITEM: no VFX (only msg text changes) ----
  R.push(await diffRegion('050_C_quen_cast_00.png', '052_C_quen_cast_02.png', 2, 0, 157, 99)); // whole battlefield above msg box
  R.push(await diffRegion('054_C_item_swallow_00.png', '056_C_item_swallow_02.png', 2, 0, 157, 99));
  R.push(await diffRegion('031_B_axii_00.png', '033_B_axii_02.png', 2, 0, 157, 99));

  // ---- 5. Dead-frame check: monster sprite gone BEFORE collapse msg ----
  // faint done (221) vs collapse msg (222): monster region identical (sprite already gone)
  R.push(await diffRegion('221_A2_faint_04.png', '222_A2_victory_msg_collapse.png', ...MON_MOB));

  // ---- 6. msg-only motion control: consecutive monster-attack frames full-frame ----
  R.push(await diffRegion('044_C_monatk_01.png', '045_C_monatk_02.png', 0, 0, 159, 143));

  const out = R.map((r) => `${r.a} vs ${r.b} [${r.region}] changed=${r.changed}/${r.total} (${r.pct}%)`).join('\n');
  fs.writeFileSync(`${OUT}/pixel-analysis.json`, JSON.stringify(R, null, 1));
  console.log(out);
})();
