// ============================================================
// BTL-visual (retry) — ONE comprehensive battle-system capture.
// Drives the real game at http://localhost:3100 via window.__game.
// VERIFICATION ONLY: never modifies game source.
// Scenarios: A drowner menus+attack+victory / B leshen boss signs
// + softlock / C wolf monster-attack + quen + item / D defeat.
// ============================================================
const { chromium } = require('playwright');
const fs = require('fs');

const GAME_URL = 'http://localhost:3100';
const OUT = '/home/z/my-project/scripts/btl-visual/out';
const T0 = Date.now();
const trace = { shots: [], log: [] };
let seq = 0;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (s) => { trace.log.push(s); console.log(`[${((Date.now() - T0) / 1000).toFixed(1)}s] ${s}`); };

// read-only full battle state
function BSTATE() {
  const g = window.__game;
  const b = g.battle;
  if (!b) return { mode: g.mode };
  return {
    mode: g.mode, phase: b.phase,
    menuIdx: b.menuIdx, subIdx: b.subIdx, itemIdx: b.itemIdx,
    monHp: b.monHp, monMaxHp: b.monMaxHp, php: b.php, psta: b.psta,
    dispMonHp: +b.dispMonHp.toFixed(2), dispPhp: +b.dispPhp.toFixed(2),
    curMsg: b.curMsg, charIdx: Math.floor(b.charIdx), msgHold: Math.round(b.msgHold),
    curAnim: b.curAnim, animT: Math.round(b.animT), shakeT: Math.round(b.shakeT),
    introT: Math.round(b.introT), faintT: Math.round(b.faintT), monDead: b.monDead,
    doneResult: b.doneResult, nMsgs: b.msgs.length,
    msgsTexts: b.msgs.map((m) => m.text), afterQueue: b.afterQueue,
    quenTurns: b.quenTurns, poison: b.poison, ptox: b.ptox,
    monStun: b.monStun, monHex: b.monHex, boss: b.boss,
  };
}
const bstate = (page) => page.evaluate(BSTATE);

async function launch() {
  const browser = await chromium.launch({ headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 480, height: 900 } });
  await page.goto(GAME_URL, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__game && window.__game.mode === 'title', null, { timeout: 30000, polling: 50 });
  return { browser, page };
}

async function tap(page, btn, hold = 70) {
  await page.evaluate((b) => window.__game.press(b), btn);
  await sleep(hold);
  await page.evaluate((b) => window.__game.release(b), btn);
  await sleep(80);
}

async function shot(page, tag, meta = {}) {
  const dataUrl = await page.evaluate(() => document.querySelector('canvas').toDataURL('image/png'));
  const file = `${String(seq++).padStart(3, '0')}_${tag}.png`;
  fs.writeFileSync(`${OUT}/${file}`, Buffer.from(dataUrl.split(',')[1], 'base64'));
  const st = await bstate(page);
  trace.shots.push({ file, tag, t: Date.now() - T0, ...meta, state: st });
  return entry = { file, st };
}
let entry; // last shot

async function startNewGame(page) {
  await tap(page, 'start', 120);
  await tap(page, 'a', 100); // NEW GAME
  await tap(page, 'a', 100); // confirm school
  await sleep(400);
  log(`new game mode=${await page.evaluate(() => window.__game.mode)}`);
}

async function startBattle(page, mon, lvl, boss = false) {
  await page.evaluate(([m, l, b]) => window.__game.startBattle(m, l, b), [mon, lvl, boss]);
  await page.waitForFunction(() => window.__game.mode === 'battle' && !!window.__game.battle, null, { timeout: 15000, polling: 25 });
}

async function waitPhase(page, ph, timeout = 20000) {
  await page.waitForFunction((p) => window.__game.battle && window.__game.battle.phase === p, ph, { timeout, polling: 25 });
}

// menu 2x2: FIGHT(0) ITEM(1) / SIGN(2) RUN(3); toggling bits
async function navMenu(page, target) {
  for (let guard = 0; guard < 6; guard++) {
    const st = await bstate(page);
    if (st.phase !== 'menu') throw new Error(`navMenu: phase=${st.phase}`);
    if (st.menuIdx === target) return;
    if ((st.menuIdx & 1) !== (target & 1)) await tap(page, (target & 1) ? 'right' : 'left');
    else if ((st.menuIdx & 2) !== (target & 2)) await tap(page, (target & 2) ? 'down' : 'up');
  }
}

// Fast-forward msg phase: A completes typing, A again skips hold.
async function drainMsgs(page, timeoutMs = 30000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const st = await bstate(page);
    if (st.mode !== 'battle') return 'ended';
    if (st.phase !== 'msg') return st.phase;
    await tap(page, 'a', 60);
  }
  return 'timeout';
}

// burst n frames ~interval ms apart
async function burst(page, tag, n, interval, meta = {}) {
  const arr = [];
  for (let i = 0; i < n; i++) {
    arr.push(await shot(page, `${tag}_${String(i).padStart(2, '0')}`, { ...meta, i }));
    if (i < n - 1) await sleep(interval);
  }
  return arr;
}

// poll until predicate(st) true, poll every ~25ms
async function until(page, pred, timeoutMs = 15000, label = '') {
  const t0 = Date.now();
  for (;;) {
    const st = await bstate(page);
    if (pred(st)) return st;
    if (st.mode !== 'battle') return st;
    if (Date.now() - t0 > timeoutMs) throw new Error(`until timeout: ${label} (phase=${st.phase} curMsg=${st.curMsg})`);
    await sleep(25);
  }
}

// select FIGHT -> steel
async function attackSteel(page) {
  await navMenu(page, 0);
  await tap(page, 'a');
  await waitPhase(page, 'fight');
  await tap(page, 'a', 50);
}
// open SIGN submenu (leaves phase 'sign', subIdx 0)
async function openSign(page) {
  await navMenu(page, 2);
  await tap(page, 'a');
  await waitPhase(page, 'sign');
}

(async () => {
  const { browser, page } = await launch();
  await startNewGame(page);

  // ================= SCENARIO A: drowner menus + attack + victory ==========
  try {
    await page.evaluate(() => {
      const g = window.__game;
      const p = g.player;
      p.maxHp = 140; p.hp = 140; p.atk = 30; p.def = 10; p.maxSta = 60; p.sta = 60;
      g.inv = { swallow: 2, thunder: 1, honey: 1, insectoil: 1 };
    });
    await startBattle(page, 'drowner', 3);
    await shot(page, 'A_intro_t0');
    await sleep(280); await shot(page, 'A_intro_t300');
    await sleep(280); await shot(page, 'A_intro_t600');
    await until(page, (s) => s.phase === 'msg' || s.phase === 'menu', 4000, 'A first msg');
    await shot(page, 'A_intro_msg');
    await until(page, (s) => s.phase === 'menu', 8000, 'A menu');
    await shot(page, 'A_menu');

    await navMenu(page, 0); await tap(page, 'a');
    await waitPhase(page, 'fight'); await shot(page, 'A_fight_submenu');
    await tap(page, 'b'); await until(page, (s) => s.phase === 'menu', 4000, 'back1');

    await openSign(page); await shot(page, 'A_sign_submenu');
    await tap(page, 'b'); await until(page, (s) => s.phase === 'menu', 4000, 'back2');

    await navMenu(page, 1); await tap(page, 'a');
    await waitPhase(page, 'item'); await shot(page, 'A_item_4rows_idx0');
    await tap(page, 'down'); await tap(page, 'down'); await tap(page, 'down');
    await shot(page, 'A_item_idx3_invisible_row4'); // cursor + 4th item (insectoil) not drawn
    await tap(page, 'down'); await shot(page, 'A_item_idx4_BACK');
    await tap(page, 'b'); await until(page, (s) => s.phase === 'menu', 4000, 'back3');

    // FIGHT -> steel, dense frames during resolution
    await attackSteel(page);
    // msg1 "You draw STEEL!" then msg2 "DROWNER takes X damage." (anim monhit 420ms)
    await until(page, (s) => s.phase === 'msg' && /takes \d+/.test(s.curMsg || ''), 8000, 'A dmg msg');
    await burst(page, 'A_hit', 4, 60);   // streaks + player lunge window (animT>300)
    await burst(page, 'A_hit_blink', 2, 150); // monster blink
    // HP bar mid-drain
    await until(page, (s) => s.dispMonHp > s.monHp && s.dispMonHp - s.monHp > 0.5, 3000, 'A drain');
    await shot(page, 'A_hp_mid_drain');
    // monster counter (if drowner survived)
    const alive = await bstate(page);
    if (alive.monHp > 0) {
      await until(page, (s) => s.phase === 'msg' && (s.curMsg || '').startsWith('DROWNER'), 12000, 'A monatk');
      await burst(page, 'A_monatk', 5, 150);
      await drainMsgs(page);
    }
    // turn 2 if needed -> victory
    const st1 = await bstate(page);
    if (st1.mode === 'battle' && st1.monHp > 0 && st1.phase === 'menu') {
      await attackSteel(page);
      await drainMsgs(page);
    }
    // victory: faint anim + msgs + done
    await until(page, (s) => s.monDead, 8000, 'A monDead');
    await burst(page, 'A_faint', 5, 150);
    await until(page, (s) => s.phase === 'msg' && /collapses/.test(s.curMsg || ''), 8000, 'A collapse msg');
    await shot(page, 'A_victory_msg_collapse');
    await until(page, (s) => s.phase === 'msg' && /XP earned|LEVEL UP/.test(s.curMsg || ''), 12000, 'A xp msg');
    await shot(page, 'A_victory_msg_xp');
    await until(page, (s) => s.phase === 'done', 12000, 'A done');
    await shot(page, 'A_done_phase');
    const endMode = await page.waitForFunction(() => window.__game.mode !== 'battle', null, { timeout: 20000, polling: 60 }).then(() => page.evaluate(() => window.__game.mode)).catch(() => 'timeout');
    log(`A: battle ended mode=${endMode}`);
    await sleep(300);
    await shot(page, 'A_after_battle');
  } catch (e) { log(`A FAILED: ${e.message}`); }

  // ================= SCENARIO B: leshen boss — IGNI/AARD/AXII + SOFTLOCK ====
  try {
    await page.evaluate(() => {
      const g = window.__game;
      const p = g.player;
      p.maxHp = 200; p.hp = 200; p.maxSta = 60; p.sta = 60; p.atk = 30; p.def = 10;
    });
    await startBattle(page, 'leshen', 8, true);
    await until(page, (s) => s.phase === 'menu', 10000, 'B menu');
    await shot(page, 'B_menu_boss');

    // --- IGNI flash ---
    await openSign(page);
    await tap(page, 'a', 40); // IGNI at subIdx 0
    await burst(page, 'B_igni_flash', 6, 90); // flash anim 420ms: t≈40..500ms
    await until(page, (s) => s.phase === 'msg' && /scorched/.test(s.curMsg || ''), 8000, 'B scorch msg');
    await shot(page, 'B_igni_scorched');
    await drainMsgs(page);
    await shot(page, 'B_after_igni'); // enemy HP bar after drain

    // --- AARD shake ---
    await openSign(page);
    await tap(page, 'right'); // subIdx 1 = AARD
    await tap(page, 'a', 40);
    await burst(page, 'B_aard_shake', 6, 90);
    await drainMsgs(page);

    // --- AXII (no VFX expected) ---
    await openSign(page);
    await tap(page, 'down');  // subIdx 2 = QUEN
    await tap(page, 'right'); // subIdx 3 = AXII
    const axSt = await bstate(page);
    log(`B: axii subIdx=${axSt.subIdx} (expect 3)`);
    await tap(page, 'a', 40);
    await burst(page, 'B_axii', 3, 200);
    await drainMsgs(page);

    // --- SOFTLOCK: monHp=1, IGNI kill ---
    await page.evaluate(() => { window.__game.battle.monHp = 1; });
    await openSign(page);
    await tap(page, 'a', 40); // IGNI lethal
    await sleep(2000); // let any queued msgs play — none will
    await shot(page, 'B_SOFTLOCK_stuck');
    const soft = await bstate(page);
    log(`B: SOFTLOCK state phase=${soft.phase} monHp=${soft.monHp} nMsgs=${soft.nMsgs} afterQueue=${soft.afterQueue} monDead=${soft.monDead}`);
    fs.writeFileSync(`${OUT}/softlock-state.json`, JSON.stringify({
      capturedAt: new Date().toISOString(), afterWaitMs: 2000, state: soft,
      msgs: soft.msgsTexts, curMsg: soft.curMsg,
    }, null, 2));

    // --- zombie turn escape via B -> FIGHT steel ---
    await tap(page, 'b');
    const afterB = await bstate(page);
    log(`B: after B phase=${afterB.phase} (menuIdx=${afterB.menuIdx})`);
    await shot(page, 'B_after_B_escape');
    await attackSteel(page);
    await until(page, (s) => s.phase === 'msg', 6000, 'B zombie msg');
    const zmb = await bstate(page);
    log(`B: zombie turn msgs=${JSON.stringify(zmb.msgsTexts)} curMsg="${zmb.curMsg}"`);
    await shot(page, 'B_zombie_turn_msg1');
    await sleep(900); await shot(page, 'B_zombie_turn_msg2');
    await drainMsgs(page);
    await until(page, (s) => s.phase === 'done' || s.mode !== 'battle', 20000, 'B done');
    const st = await bstate(page);
    log(`B: end phase=${st.phase} mode=${st.mode} doneResult=${st.doneResult}`);
    await shot(page, 'B_done');
  } catch (e) { log(`B FAILED: ${e.message}`); }

  // ================= SCENARIO C: wolf — monster attack + QUEN + item ======
  try {
    await page.evaluate(() => {
      const g = window.__game;
      const p = g.player;
      p.maxHp = 200; p.hp = 200; p.maxSta = 60; p.sta = 60; p.atk = 20; p.def = 8;
      g.inv = { swallow: 2, thunder: 1, honey: 1, insectoil: 1 };
    });
    await startBattle(page, 'wolf', 4);
    await until(page, (s) => s.phase === 'menu', 10000, 'C menu');
    await shot(page, 'C_menu');

    // player steel attack frames
    await attackSteel(page);
    await until(page, (s) => s.phase === 'msg' && /takes \d+/.test(s.curMsg || ''), 8000, 'C dmg msg');
    await burst(page, 'C_hit', 3, 90);
    // MONSTER COUNTER — the key no-lunge evidence
    await until(page, (s) => s.phase === 'msg' && (s.curMsg || '').startsWith('WOLF') && /uses/.test(s.curMsg || ''), 15000, 'C monatk');
    await burst(page, 'C_monatk', 6, 150);
    await drainMsgs(page);
    await shot(page, 'C_after_counter');

    // QUEN
    await openSign(page);
    await tap(page, 'down'); // subIdx 2 = QUEN
    const qSt = await bstate(page);
    log(`C: quen subIdx=${qSt.subIdx} (expect 2)`);
    await tap(page, 'a', 40);
    await burst(page, 'C_quen_cast', 3, 200);
    await drainMsgs(page); // wolf hits quen: "QUEN absorbs"
    await shot(page, 'C_quen_label');

    // ITEM: swallow
    await navMenu(page, 1); await tap(page, 'a');
    await waitPhase(page, 'item');
    const itSt = await bstate(page);
    log(`C: item idx0=${itSt.itemIdx}`);
    await tap(page, 'a', 40); // swallow
    await burst(page, 'C_item_swallow', 3, 200);
    await drainMsgs(page);
    await shot(page, 'C_after_item');

    // finish wolf (steel) — no victory capture needed
    await until(page, (s) => s.phase === 'menu', 12000, 'C menu2');
    await attackSteel(page);
    await drainMsgs(page, 20000);
    await until(page, (s) => s.phase === 'done' || s.phase === 'menu' || s.mode !== 'battle', 20000, 'C end');
    log(`C: end phase=${(await bstate(page)).phase}`);
  } catch (e) { log(`C FAILED: ${e.message}`); }

  // ================= SCENARIO D: defeat -> gameover =========================
  try {
    await page.evaluate(() => {
      const g = window.__game;
      const p = g.player;
      p.atk = 4; p.def = 0; p.maxHp = 200; p.hp = 200; p.maxSta = 60; p.sta = 60;
    });
    await startBattle(page, 'wolf', 8);
    await until(page, (s) => s.phase === 'menu', 10000, 'D menu');
    await page.evaluate(() => { const b = window.__game.battle; b.php = 2; }); // leave dispPhp high -> visible drain
    await shot(page, 'D_menu_php2');
    await attackSteel(page);
    await until(page, (s) => s.php <= 0, 20000, 'D php0');
    await shot(page, 'D_defeat_msgs');
    await burst(page, 'D_defeat_transition', 4, 350);
    await page.waitForFunction(() => window.__game.mode !== 'battle', null, { timeout: 25000, polling: 60 });
    const gm = await page.evaluate(() => ({ mode: window.__game.mode, gameoverT: Math.round(window.__game.gameoverT || 0) }));
    log(`D: gameover=${JSON.stringify(gm)}`);
    await burst(page, 'D_gameover', 4, 350);
    await sleep(1500);
    await shot(page, 'D_gameover_final');
    fs.writeFileSync(`${OUT}/gameover-state.json`, JSON.stringify(gm, null, 2));
  } catch (e) { log(`D FAILED: ${e.message}`); }

  fs.writeFileSync(`${OUT}/trace.json`, JSON.stringify(trace, null, 1));
  await browser.close();
  console.log('CAPTURE DONE — shots:', seq);
})().catch((e) => { console.error(e); fs.writeFileSync(`${OUT}/trace.json`, JSON.stringify(trace, null, 1)); process.exit(1); });
