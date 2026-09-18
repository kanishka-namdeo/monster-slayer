// BTL-verify: post-fix visual verification of the battle system.
// VERIFICATION ONLY — no game source modified. Output: scripts/btl-verify/out/
// Scenarios a-j per task BTL-verify. One Playwright run, chromium headless 480x900,
// canvas toDataURL -> native 160x144 PNGs + state trace + sign-kill poll JSON.
const { chromium } = require('playwright');
const fs = require('fs');

const GAME_URL = 'http://localhost:3000';
const OUT = '/home/z/my-project/scripts/btl-verify/out';
fs.mkdirSync(OUT, { recursive: true });

const T0 = Date.now();
const trace = { shots: [], log: [], softlock: [], drainCurves: {}, poisonLoop: null };
let seq = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (s) => { trace.log.push(`[${((Date.now() - T0) / 1000).toFixed(1)}s] ${s}`); console.log(`[${((Date.now() - T0) / 1000).toFixed(1)}s] ${s}`); };

function BSTATE() {
  const g = window.__game;
  const b = g.battle;
  const track = window.__audio ? window.__audio.currentTrack : null;
  if (!b) return { mode: g.mode, track };
  return {
    mode: g.mode, track,
    phase: b.phase, menuIdx: b.menuIdx, subIdx: b.subIdx, itemIdx: b.itemIdx,
    monName: b.monName, monHp: +b.monHp.toFixed(1), monMaxHp: b.monMaxHp,
    barMonHp: +b.barMonHp.toFixed(2), dispMonHp: +b.dispMonHp.toFixed(2),
    php: b.php, pmaxHp: b.pmaxHp, barPhp: +b.barPhp.toFixed(2), dispPhp: +b.dispPhp.toFixed(2),
    psta: b.psta,
    curMsg: (b.curMsg || '').slice(0, 48), charIdx: Math.floor(b.charIdx),
    curAnim: b.curAnim, animT: Math.round(b.animT),
    faintStarted: b.faintStarted, faintT: Math.round(b.faintT),
    pFaintStarted: b.pFaintStarted, pFaintT: Math.round(b.pFaintT),
    monDead: b.monDead, monFirst: b.monFirst, boss: b.boss,
    quenTurns: b.quenTurns, quenAmt: b.quenAmt,
    monStun: b.monStun, monHex: b.monHex,
    pStun: b.pStun, poison: b.poison, ptox: b.ptox, atkDownMul: b.atkDownMul,
    resolved: b.resolved, doneResult: b.doneResult, afterQueue: b.afterQueue,
    nMsgs: b.msgs.length, msgsTexts: b.msgs.slice(0, 4).map((m) => m.text.slice(0, 42)),
    introT: Math.round(b.introT), time: Math.round(b.time),
  };
}
const bstate = (page) => page.evaluate(BSTATE);

async function tap(page, btn, hold = 70) {
  await page.evaluate((b) => window.__game.press(b), btn);
  await sleep(hold);
  await page.evaluate((b) => window.__game.release(b), btn);
  await sleep(60);
}
async function shot(page, tag, meta = {}) {
  const dataUrl = await page.evaluate(() => document.querySelector('canvas').toDataURL('image/png'));
  const file = `${String(seq++).padStart(3, '0')}_${tag}.png`;
  fs.writeFileSync(`${OUT}/${file}`, Buffer.from(dataUrl.split(',')[1], 'base64'));
  const st = await bstate(page);
  trace.shots.push({ file, tag, t: Date.now() - T0, ...meta, state: st });
  return { file, st };
}
async function burst(page, tag, n, interval) {
  for (let i = 0; i < n; i++) {
    await shot(page, `${tag}_${String(i).padStart(2, '0')}`, { i });
    if (i < n - 1) await sleep(interval);
  }
}
async function until(page, pred, timeoutMs = 15000, label = '', poll = 25) {
  const t0 = Date.now();
  for (;;) {
    const st = await bstate(page);
    if (pred(st)) return st;
    if (Date.now() - t0 > timeoutMs) throw new Error(`until timeout: ${label} (phase=${st.phase} curMsg=${st.curMsg})`);
    await sleep(poll);
  }
}
async function drainMsgs(page, timeoutMs = 25000) {
  const t0 = Date.now();
  let lastPhase = null;
  while (Date.now() - t0 < timeoutMs) {
    const st = await bstate(page);
    if (st.mode !== 'battle') return 'ended';
    if (st.phase !== 'msg') return st.phase;
    lastPhase = st.phase;
    await tap(page, 'a', 60);
  }
  return `timeout(last=${lastPhase})`;
}
async function toMenu(page) {
  for (let i = 0; i < 4; i++) {
    const st = await bstate(page);
    if (st.mode !== 'battle') return st;
    if (st.phase === 'menu') return st;
    if (st.phase === 'msg') { await drainMsgs(page, 20000); continue; }
    await tap(page, 'b', 60);
    await sleep(120);
  }
  return bstate(page);
}
async function gotoMenuIdx(page, target) {
  await toMenu(page);
  for (let guard = 0; guard < 4; guard++) {
    const st = await bstate(page);
    if (st.phase !== 'menu') throw new Error(`gotoMenuIdx: not in menu (phase=${st.phase})`);
    if (st.menuIdx === target) return st;
    if ((st.menuIdx & 1) !== (target & 1)) await tap(page, 'left', 50);
    else if ((st.menuIdx & 2) !== (target & 2)) await tap(page, 'up', 50);
    await sleep(80);
  }
  throw new Error(`gotoMenuIdx failed for ${target}`);
}
async function attackSteel(page) {
  await gotoMenuIdx(page, 0);
  await tap(page, 'a', 60);
  await page.waitForFunction(() => window.__game.battle && window.__game.battle.phase === 'fight', null, { timeout: 8000, polling: 20 });
  await tap(page, 'a', 50);
}
// sign grid: right=+1, down=+2 over 5 entries (IGNI0 AARD1 / QUEN2 AXII3 / BACK4)
async function castSignUI(page, idx, label) {
  await gotoMenuIdx(page, 2);
  await tap(page, 'a', 60);
  await page.waitForFunction(() => window.__game.battle && window.__game.battle.phase === 'sign', null, { timeout: 8000, polling: 20 });
  let sub = 0;
  while (sub !== idx) {
    if ((idx - sub + 5) % 5 === 1) { await tap(page, 'right', 50); sub = (sub + 1) % 5; }
    else { await tap(page, 'down', 50); sub = (sub + 2) % 5; }
    await sleep(80);
  }
  const sel = await shot(page, `${label}_selected`);
  await tap(page, 'a', 50);
  return sel;
}
async function burstAnim(page, tag, anim, n, interval, minAnimT = 380) {
  await until(page, (s) => s.phase === 'msg' && s.curAnim === anim && s.animT >= minAnimT, 12000, `${tag} anim=${anim}`, 12);
  await burst(page, tag, n, interval);
}
async function startBattleAndWait(page, monId, lvl, boss) {
  await page.evaluate(([m, l, bo]) => window.__game.startBattle(m, l, bo), [monId, lvl, boss]);
  await page.waitForFunction(() => window.__game.mode === 'battle' && !!window.__game.battle && window.__game.battle.phase === 'intro', null, { timeout: 15000, polling: 10 });
  return bstate(page);
}

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 480, height: 900 } });
  try {
    await page.goto(GAME_URL, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__game && window.__game.mode === 'title', null, { timeout: 30000, polling: 50 });
    await tap(page, 'start', 120);
    for (let i = 0; i < 10; i++) {
      const st = await page.evaluate(() => window.__game.mode);
      if (st === 'world') break;
      if (st === 'title') { await sleep(200); continue; }
      await tap(page, 'a', 90);
      await sleep(120);
    }
    log(`boot done, mode=${await page.evaluate(() => window.__game.mode)}`);
    await page.evaluate(() => {
      const g = window.__game; const p = g.player;
      p.school = 'bear'; p.lvl = 1;
      p.maxHp = 140; p.hp = 140; p.atk = 10; p.def = 10; p.maxSta = 60; p.sta = 60;
      g.inv = { swallow: 2, thunder: 1, honey: 1, insectoil: 1 };
    });

    // ================= A: drowner L3 intro + menu =================
    let stA;
    for (let attempt = 0; attempt < 6; attempt++) {
      stA = await startBattleAndWait(page, 'drowner', 3, false);
      if (stA.monFirst === false) break;
      log(`A: drowner rolled monFirst=true (retry ${attempt})`);
    }
    log(`A: drowner monFirst=${stA.monFirst} hp=${stA.monHp}/${stA.monMaxHp}`);
    await shot(page, 'A_intro_t0', { note: 'slide-in start (player from left, mon from right)' });
    await sleep(290); await shot(page, 'A_intro_t300');
    await sleep(290); await shot(page, 'A_intro_t600');
    await sleep(260); await shot(page, 'A_intro_msg_typing', { note: 'appear line typing after 700ms intro' });
    await until(page, (s) => s.phase === 'menu', 12000, 'A menu');
    await shot(page, 'A_menu', { note: 'platform under witcher + HP/STA bar origins' });

    // ================= B: FIGHT -> steel resolution =================
    await attackSteel(page);
    await burstAnim(page, 'B_lunge', 'monhit', 3, 60); // player lunge arc + slash streaks
    const drainSamples = [];
    const tB = Date.now();
    while (Date.now() - tB < 2500) {
      const st = await bstate(page);
      drainSamples.push({ t: Date.now() - tB, dispMonHp: st.dispMonHp, barMonHp: st.barMonHp, curMsg: st.curMsg });
      if (st.barMonHp > 0 && st.barMonHp < st.monMaxHp && st.dispMonHp - st.barMonHp >= 1.5) {
        await shot(page, 'B_mid_drain', { note: 'HP draining as the damage msg lands' });
        break;
      }
      await sleep(20);
    }
    trace.drainCurves.B_steel = drainSamples;
    await until(page, (s) => s.phase === 'msg' && s.curAnim === 'playerhit', 12000, 'B drowner counter', 12);
    await burst(page, 'B_monatk_drowner', 4, 80);
    await drainMsgs(page);

    // ================= C: item menu scroll to 4th row =================
    await gotoMenuIdx(page, 1);
    await tap(page, 'a', 60);
    await page.waitForFunction(() => window.__game.battle && window.__game.battle.phase === 'item', null, { timeout: 8000, polling: 20 });
    await shot(page, 'C_item_top', { note: 'itemIdx=0: 3 rows + BACK visible' });
    for (let i = 0; i < 3; i++) { await tap(page, 'down', 60); await sleep(90); }
    const stC = await until(page, (s) => s.itemIdx === 3, 4000, 'C itemIdx=3', 20);
    log(`C: itemIdx=${stC.itemIdx}`);
    await shot(page, 'C_item_idx3_a', { note: '4th item visible after scroll, cursor row 3' });
    await sleep(340); await shot(page, 'C_item_idx3_b', { note: 'other blink phase (scroll arrow)' });
    await tap(page, 'b', 60);

    // ================= D: SIGN -> QUEN =================
    await castSignUI(page, 2, 'D_quen');
    await burstAnim(page, 'D_quen_cast', 'quen', 4, 70);
    await drainMsgs(page);
    await until(page, (s) => s.phase === 'menu', 8000, 'D menu');
    const stQ = await bstate(page);
    log(`D: quenTurns=${stQ.quenTurns} quenAmt=${stQ.quenAmt}`);
    await shot(page, 'D_quen_persist_1', { note: 'brackets while active (blink on)' });
    await sleep(320); await shot(page, 'D_quen_persist_2', { note: 'brackets blink off' });
    await sleep(320); await shot(page, 'D_quen_persist_3');

    // ================= E: SIGN -> AXII =================
    await castSignUI(page, 3, 'E_axii');
    await burstAnim(page, 'E_axii_orbit', 'hex', 4, 90);
    log(`E: monHex=${(await bstate(page)).monHex} after cast`);
    await drainMsgs(page);

    // ================= F: swallow blocked at full HP, then heal at php=10 =================
    await page.evaluate(() => { const b = window.__game.battle; b.php = 140; b.dispPhp = 140; b.barPhp = 140; });
    await gotoMenuIdx(page, 1);
    await tap(page, 'a', 60);
    await page.waitForFunction(() => window.__game.battle && window.__game.battle.phase === 'item', null, { timeout: 8000, polling: 20 });
    await tap(page, 'a', 50); // swallow at full HP -> must be refused
    await until(page, (s) => s.phase === 'msg' && /already whole/.test(s.curMsg || ''), 6000, 'F blocked msg', 15);
    await shot(page, 'F_swallow_blocked', { note: 'swallow refused at full HP' });
    await drainMsgs(page);
    await page.evaluate(() => { const b = window.__game.battle; b.php = 10; b.dispPhp = 10; b.barPhp = 10; });
    await gotoMenuIdx(page, 1);
    await tap(page, 'a', 60);
    await page.waitForFunction(() => window.__game.battle && window.__game.battle.phase === 'item', null, { timeout: 8000, polling: 20 });
    await tap(page, 'a', 50); // swallow now heals
    await until(page, (s) => s.phase === 'msg' && s.curAnim === 'heal', 6000, 'F heal msg', 12);
    const riseSamples = [];
    for (let i = 0; i < 6; i++) {
      const st = await bstate(page);
      riseSamples.push({ t: i * 80, dispPhp: st.dispPhp, barPhp: st.barPhp });
      if (st.barPhp > st.dispPhp && st.barPhp - st.dispPhp >= 3) { await shot(page, 'F_mid_rise', { note: 'HP bar rising as heal msg lands' }); }
      await shot(page, `F_heal_${String(i).padStart(2, '0')}`);
      await sleep(80);
    }
    trace.drainCurves.F_heal = riseSamples;
    await drainMsgs(page);

    // ================= G: wolf L4 — monster-first lunge =================
    await page.evaluate(() => window.__game.startBattle('wolf', 4, false));
    await page.waitForFunction(() => window.__game.mode === 'battle' && !!window.__game.battle && window.__game.battle.phase === 'intro', null, { timeout: 15000, polling: 10 });
    const stG0 = await bstate(page);
    log(`G: wolf monFirst=${stG0.monFirst} (expect true) hp=${stG0.monHp}/${stG0.monMaxHp}`);
    await drainMsgs(page);
    await until(page, (s) => s.phase === 'menu', 8000, 'G menu');
    await shot(page, 'G_menu_wolf');
    let lunged = false;
    for (let attempt = 0; attempt < 3 && !lunged; attempt++) {
      await attackSteel(page);
      try {
        await until(page, (s) => s.phase === 'msg' && s.curAnim === 'playerhit' && s.animT >= 400, 3500, 'G wolf lunge', 10);
        lunged = true;
      } catch { log(`G: wolf HOWLed instead of biting (retry ${attempt})`); await drainMsgs(page); await toMenu(page); }
    }
    if (lunged) await burst(page, 'G_mon_lunge', 6, 70);
    await drainMsgs(page);
    await toMenu(page);

    // ================= H: leshen L8 boss — IGNI flash + sign-kill softlock =================
    await page.evaluate(() => window.__game.startBattle('leshen', 8, true));
    await page.waitForFunction(() => window.__game.mode === 'battle' && !!window.__game.battle && window.__game.battle.phase === 'intro', null, { timeout: 15000, polling: 10 });
    const stH0 = await bstate(page);
    log(`H: leshen boss=${stH0.boss} monFirst=${stH0.monFirst} hp=${stH0.monHp}/${stH0.monMaxHp}`);
    await page.evaluate(() => { const b = window.__game.battle; b.psta = 60; b.dispSta = 60; b.barPsta = 60; b.php = 140; b.dispPhp = 140; b.barPhp = 140; });
    await drainMsgs(page);
    await until(page, (s) => s.phase === 'menu', 8000, 'H menu');
    await shot(page, 'H_menu_boss', { note: 'pre-flash reference frame' });
    await castSignUI(page, 0, 'H_igni');
    await burstAnim(page, 'H_igni_flash', 'flash', 6, 80, 470);
    await drainMsgs(page);
    await until(page, (s) => s.phase === 'menu', 8000, 'H menu 2');

    // --- sign kill: monHp=1 + IGNI must funnel msg->rewards->done->world, no stall ---
    await page.evaluate(() => { const b = window.__game.battle; b.monHp = 1; b.barMonHp = 1; b.dispMonHp = 1; b.psta = 60; b.barPsta = 60; b.dispSta = 60; });
    await castSignUI(page, 0, 'H_igni_kill');
    const poll = [];
    let capturedScorched = false, capturedCollapse = false, collapseState = null;
    const tH = Date.now();
    while (Date.now() - tH < 10500) {
      const st = await bstate(page);
      poll.push({ t: Date.now() - tH, phase: st.phase, msgs_left: st.nMsgs, curMsg: st.curMsg, faintStarted: st.faintStarted, faintT: st.faintT, mode: st.mode, track: st.track, doneResult: st.doneResult });
      if (!capturedScorched && st.phase === 'msg' && /scorched/.test(st.curMsg || '')) {
        capturedScorched = true;
        await shot(page, 'H_kill_scorched', { note: 'monster on screen during dmg msg, faint NOT started' });
      }
      if (!capturedCollapse && st.phase === 'msg' && /collapses/.test(st.curMsg || '')) {
        capturedCollapse = true;
        collapseState = await bstate(page);
        log(`H: collapse msg -> faintStarted=${collapseState.faintStarted} faintT=${collapseState.faintT} track=${collapseState.track}`);
        await burst(page, 'H_faint', 5, 150);
      }
      if (st.mode !== 'battle') break;
      await sleep(300);
    }
    trace.softlock = poll;
    const stHend = await bstate(page);
    log(`H: after kill mode=${stHend.mode} phase=${stHend.phase} doneResult=${stHend.doneResult} track=${stHend.track}`);
    await sleep(600);
    await shot(page, 'H_after_world', { note: 'returned to the world (no softlock)' });
    if (stHend.mode === 'battle') { await drainMsgs(page, 10000); await sleep(500); await shot(page, 'H_after_world2'); }

    // ================= I: defeat -> KO sink -> gameover =================
    await page.evaluate(() => { const g = window.__game; g.player.hp = 140; });
    await page.evaluate(() => window.__game.startBattle('leshen', 8, true));
    await page.waitForFunction(() => window.__game.mode === 'battle' && !!window.__game.battle && window.__game.battle.phase === 'intro', null, { timeout: 15000, polling: 10 });
    const stI0 = await bstate(page);
    log(`I: leshen monFirst=${stI0.monFirst}`);
    await page.evaluate(() => { const b = window.__game.battle; b.php = 2; }); // dispPhp stays 140 -> drains when hit msg lands
    await drainMsgs(page);
    await until(page, (s) => s.phase === 'menu', 8000, 'I menu');
    await attackSteel(page);
    await until(page, (s) => s.phase === 'msg' && s.curAnim === 'playerhit' && s.animT >= 400, 12000, 'I leshen strike', 10);
    await burst(page, 'I_mon_atk', 4, 80);
    await until(page, (s) => s.pFaintStarted === true || /fall to one knee/.test(s.curMsg || ''), 15000, 'I KO msg', 20);
    const stKO = await bstate(page);
    log(`I: KO msg="${stKO.curMsg}" pFaintStarted=${stKO.pFaintStarted} php=${stKO.php} dispPhp=${stKO.dispPhp} barPhp=${stKO.barPhp}`);
    await shot(page, 'I_player_ko_msg');
    await burst(page, 'I_player_ko', 5, 130);
    await page.waitForFunction(() => window.__game.mode === 'gameover', null, { timeout: 25000, polling: 50 });
    log('I: mode=gameover');
    await sleep(250); await shot(page, 'I_gameover_0300', { note: 'GAME OVER title' });
    await sleep(950); await shot(page, 'I_gameover_1300', { note: 'looming leshen faded in' });
    await sleep(1150); await shot(page, 'I_gameover_2500', { note: 'flavor lines + PRESS A (blink window 2400-2600)' });
    await tap(page, 'a', 80);
    await sleep(700);
    log(`I: after A at gameover -> mode=${await page.evaluate(() => window.__game.mode)} (respawn)`);
    await shot(page, 'I_after_respawn');

    // ================= J: status HUD (oil, PSN, QUN, STN, TOX/WEK/ROT) =================
    await page.evaluate(() => { const g = window.__game; const p = g.player; p.hp = 140; p.sta = 60; });
    await page.evaluate(() => window.__game.startBattle('ghoul', 4, false));
    await page.waitForFunction(() => window.__game.mode === 'battle' && !!window.__game.battle && window.__game.battle.phase === 'intro', null, { timeout: 15000, polling: 10 });
    await drainMsgs(page);
    await until(page, (s) => s.phase === 'menu', 8000, 'J menu');
    await page.evaluate(() => { const b = window.__game.battle; b.monHp = 60; b.monMaxHp = 60; b.barMonHp = 60; b.dispMonHp = 60; b.psta = 60; b.barPsta = 60; b.dispSta = 60; });
    await page.evaluate(() => { window.__game.inv.insectoil = 1; window.__game.battle.useItemBattle('insectoil'); });
    await burstAnim(page, 'J_oil_glint', 'oil', 4, 75);
    await drainMsgs(page);
    await toMenu(page);
    // wait through ghoul turns until FESTERING BITE poisons us (no QUEN — it would absorb)
    const loopLog = [];
    let poisoned = false;
    for (let round = 0; round < 7 && !poisoned; round++) {
      await page.evaluate(() => { const b = window.__game.battle; if (b.monHp < 40) { b.monHp = 60; b.barMonHp = 60; } b.php = 140; b.psta = 60; b.barPsta = 60; });
      await attackSteel(page);
      await drainMsgs(page);
      const st = await bstate(page);
      loopLog.push({ round, poison: st.poison, pStun: st.pStun, phase: st.phase });
      if (st.poison > 0) poisoned = true;
      else await toMenu(page);
    }
    trace.poisonLoop = loopLog;
    log(`J: poisoned=${poisoned} (rounds=${loopLog.length})`);
    if (poisoned) await shot(page, 'J_hud_psn', { note: 'PSN tag (natural poison)' });
    // AARD until the ghoul is staggered (enemy 'L4 STN' tag)
    let stunned = false;
    for (let i = 0; i < 6 && !stunned; i++) {
      await page.evaluate(() => { const b = window.__game.battle; if (b.monHp < 40) { b.monHp = 60; b.barMonHp = 60; } b.psta = 60; b.barPsta = 60; b.poison = Math.max(b.poison, 1); });
      await castSignUI(page, 1, 'J_aard');
      const st = await bstate(page);
      if (st.monStun > 0) {
        stunned = true;
        await until(page, (s) => /staggered/.test(s.curMsg || ''), 4000, 'J staggered msg', 20).catch(() => {});
        await shot(page, 'J_hud_stn', { note: "enemy 'L4 STN' tag" });
      }
      await drainMsgs(page);
      await toMenu(page);
    }
    log(`J: enemy stunned=${stunned}`);
    // QUN + PSN together (quen cast for real; refresh poison if it ticked away)
    await page.evaluate(() => { const b = window.__game.battle; b.quenAmt = 99; b.psta = 60; b.barPsta = 60; b.poison = Math.max(b.poison, 2); });
    await castSignUI(page, 2, 'J_quen');
    await burstAnim(page, 'J_quen_cast', 'quen', 3, 75);
    await drainMsgs(page);
    await toMenu(page);
    await shot(page, 'J_hud_natural', { note: 'QUN + PSN tags' });
    await sleep(320); await shot(page, 'J_hud_natural_b');
    // injected tag rendering coverage: TOX + WEK, then ROT
    await page.evaluate(() => { const b = window.__game.battle; b.ptox = 7; b.atkDownMul = 0.8; });
    await shot(page, 'J_hud_tox_wek', { note: 'TOX + WEK tag rendering (injected state)' });
    await page.evaluate(() => { const b = window.__game.battle; b.ptox = 0; b.atkDownMul = 1; b.pStun = 1; b.poison = 2; });
    await shot(page, 'J_hud_rot', { note: 'ROT (root-stun) tag rendering (injected state)' });

    fs.writeFileSync(`${OUT}/trace.json`, JSON.stringify(trace, null, 1));
    log(`DONE — ${seq} shots`);
    await browser.close();
  } catch (e) {
    trace.error = String((e && e.stack) || e);
    log(`ERROR: ${trace.error}`);
    fs.writeFileSync(`${OUT}/trace.json`, JSON.stringify(trace, null, 1));
    await browser.close().catch(() => {});
    process.exitCode = 1;
  }
})();
