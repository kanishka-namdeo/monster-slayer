// BTL-verify FINAL: single-script visual verification of the 6 core battle fixes.
// Verification-only. Reads game state + canvas pixels; no src/ changes.
// Outputs -> scripts/btl-verify/out/ (V-prefixed PNGs, findings.json, findings.md)
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = '/home/z/my-project/scripts/btl-verify/out';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const INK = [15, 56, 15], DARK = [48, 98, 48], LIGHT = [139, 172, 15], PAPER = [155, 188, 15];
const lum = (r, g, b) => 0.3 * r + 0.6 * g + 0.1 * b;

let seq = 0;
const findings = { meta: { url: 'http://localhost:3000', viewport: '480x900', ts: new Date().toISOString() } };

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 480, height: 900 } });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page.goto('http://localhost:3000', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__game && window.__game.mode === 'title', null, { timeout: 30000, polling: 50 });

  // ---------- helpers ----------
  const shot = async (tag) => {
    const dataUrl = await page.evaluate(() => document.querySelector('canvas').toDataURL('image/png'));
    fs.writeFileSync(`${OUT}/${String(++seq).padStart(3, '0')}_V_${tag}.png`, Buffer.from(dataUrl.split(',')[1], 'base64'));
  };
  // raw RGBA region straight from the live canvas
  const region = (x, y, w, h) => page.evaluate(([x, y, w, h]) => {
    const ctx = document.querySelector('canvas').getContext('2d');
    return Array.from(ctx.getImageData(x, y, w, h).data);
  }, [x, y, w, h]);
  const diffCount = (A, B) => {
    let n = 0;
    for (let i = 0; i < A.length; i += 4)
      if (A[i] !== B[i] || A[i + 1] !== B[i + 1] || A[i + 2] !== B[i + 2]) n++;
    return n;
  };
  const countLum = (A, lo, hi) => { // pixels with luminance in [lo,hi)
    let n = 0;
    for (let i = 0; i < A.length; i += 4) {
      const l = lum(A[i], A[i + 1], A[i + 2]);
      if (l >= lo && l < hi) n++;
    }
    return n;
  };
  const tap = async (btn, hold = 70) => {
    await page.evaluate((b) => window.__game.press(b), btn);
    await sleep(hold);
    await page.evaluate((b) => window.__game.release(b), btn);
    await sleep(80);
  };
  const st = () => page.evaluate(() => {
    const g = window.__game, b = g.battle;
    return {
      mode: g.mode, gameoverT: g.gameoverT,
      phase: b ? b.phase : null, msgsLeft: b ? b.msgs.length : null,
      cur: b ? b.curMsg : null, monHp: b ? b.monHp : null, php: b ? b.php : null,
      itemIdx: b ? b.itemIdx : null, menuIdx: b ? b.menuIdx : null, monFirst: b ? b.monFirst : null,
      quenTurns: b ? b.quenTurns : null, doneResult: b ? b.doneResult : null,
      track: window.__audio ? window.__audio.currentTrack : null,
    };
  });

  // mode-transition logger (pure observation: catches transient 'world' set inside fade callbacks)
  await page.evaluate(() => {
    const g = window.__game;
    window.__modeLog = [];
    let _m = g.mode;
    Object.defineProperty(g, 'mode', {
      configurable: true,
      get: () => _m,
      set: (v) => { if (v !== _m) { _m = v; window.__modeLog.push({ t: Date.now(), mode: v }); } },
    });
  });

  // ---------- boot: title -> (menu) -> creation -> intro -> [dialogs] -> world ----------
  await tap('start', 120); // wake the title (titleStarted)
  for (let i = 0; i < 40; i++) {
    const m = await page.evaluate(() => ({ mode: window.__game.mode, dlg: !!window.__game.dialog }));
    if (m.mode === 'world' && !m.dlg) break;
    if (m.mode === 'title' || m.mode === 'creation' || m.mode === 'intro' || m.mode === 'dialog') { await tap('a', 90); await sleep(180); continue; }
    await sleep(200);
  }
  const bootMode = await page.evaluate(() => window.__game.mode);
  if (bootMode !== 'world') throw new Error(`boot failed, mode=${bootMode}`);
  // deterministic hero: L10 bear, tanky, fast-enough (pspd 8: slower than wolf 9, faster than leshen 6 / drowner 5)
  await page.evaluate(() => {
    const p = window.__game.player;
    p.school = 'bear'; p.lvl = 10; p.xp = 0;
    p.maxHp = 140; p.hp = 140; p.maxSta = 60; p.sta = 60; p.atk = 12; p.def = 8; p.tox = 0;
  });

  // ============ CHECK 2: monster attack lunge (wolf L4, monFirst preempt) ============
  // The wolf's move choice is random (BITE=lunge / HOWL=no anim), so retry until an
  // attack move lands; attribute the diff to curAnim==='playerhit' (the monster's own move).
  console.log('--- check2 monster lunge');
  await page.evaluate(() => window.__game.startBattle('wolf', 4));
  await page.waitForFunction(() => window.__game.mode === 'battle' && window.__game.battle, null, { timeout: 15000, polling: 20 });
  await sleep(2200); // let intro msgs start draining
  const c2pre = await st();
  const c2rounds = [];
  let c2pass = null;
  for (let round = 0; round < 6 && !c2pass; round++) {
    if (!(await page.evaluate(() => window.__game.battle))) { // wolf died -> fresh battle
      await page.evaluate(() => window.__game.startBattle('wolf', 4));
      await page.waitForFunction(() => window.__game.mode === 'battle' && window.__game.battle, null, { timeout: 15000, polling: 20 });
      await sleep(1500);
    }
    // wait for a quiet menu phase (previous round's turn chain drained)
    for (let i = 0; i < 60; i++) {
      const s = await st();
      if (s.phase === 'menu' && s.msgsLeft === 0) break;
      await sleep(200);
    }
    await page.evaluate(() => { const b = window.__game.battle; b.msgs = []; b.phase = 'menu'; b.monHp = 80; });
    await page.evaluate(() => window.__game.battle.playerAttack('steel')); // preempt monAct + our attack
    const lungeFrames = [];
    for (let i = 0; i < 6; i++) {
      lungeFrames.push(await region(100, 0, 60, 52));
      if (round === 0 || i === 0) await shot(`c2_lunge_r${round}_${i}`);
      if (i < 5) await sleep(120);
    }
    const c2post = await st();
    const anim = await page.evaluate(() => (window.__game.battle ? window.__game.battle.curAnim : 'gone'));
    const pairs = [];
    for (let i = 0; i + 1 < lungeFrames.length; i++)
      pairs.push({ pair: `${i}->${i + 1}`, changedPx: diffCount(lungeFrames[i], lungeFrames[i + 1]) });
    const max = Math.max(...pairs.map((p) => p.changedPx));
    const rec = { round, msgDuring: c2post.cur, curAnimAtEnd: anim, maxChangedPx: max, pairs };
    c2rounds.push(rec);
    if (max > 100 && anim !== 'gone') c2pass = rec; // frames captured during the monster's own move
  }
  findings.check2_lunge = {
    verdict: c2pass ? 'FIXED' : 'NOT FIXED',
    monFirstAtStart: c2pre.monFirst,
    monFirstAsserted: c2pre.monFirst === true,
    region: 'x100-160 y0-52 (3120 px)', threshold: '>100 px in >=1 consecutive pair (pre-fix: 0)',
    rounds: c2rounds.map((r) => ({ round: r.round, msgDuring: r.msgDuring, maxChangedPx: r.maxChangedPx })),
    best: c2pass || c2rounds[c2rounds.length - 1],
  };
  console.log('check2', JSON.stringify(findings.check2_lunge, null, 1));

  // ============ CHECK 4: item menu scroll (drowner L3) ============
  console.log('--- check4 item scroll');
  await page.evaluate(() => { window.__game.inv = { swallow: 2, thunder: 1, honey: 1, insectoil: 1 }; });
  await page.evaluate(() => window.__game.startBattle('drowner', 3));
  await page.waitForFunction(() => window.__game.mode === 'battle' && window.__game.battle, null, { timeout: 15000, polling: 20 });
  await sleep(1500);
  await page.evaluate(() => {
    const b = window.__game.battle;
    b.phase = 'menu'; b.menuIdx = 1; b.phase = 'item'; b.itemIdx = 0;
  });
  await sleep(150);
  const itemWinBefore = await page.evaluate(() => {
    const { list, start } = window.__game.battle.itemWindow();
    return { labels: list.map((l) => l.label), start, n: list.length };
  });
  for (let i = 0; i < 3; i++) { // down x3, 120ms gaps
    await page.evaluate(() => window.__game.press('down'));
    await sleep(60);
    await page.evaluate(() => window.__game.release('down'));
    await sleep(120);
  }
  await sleep(150);
  const itemState = await page.evaluate(() => {
    const b = window.__game.battle;
    const { list, start } = b.itemWindow();
    return { itemIdx: b.itemIdx, start, visible: list.slice(start, start + 3).map((l) => l.label), n: list.length, phase: b.phase };
  });
  await shot('c4_item_idx3_a');
  const row4text = await region(12, 118, 98, 12);      // 4th row text band (y 118-130)
  const cursorBand = await region(3, 121, 10, 9);      // cursor glyph slot at row4 (y123)
  await sleep(220); // catch the blinking scroll arrow in the other phase
  await shot('c4_item_idx3_b');
  const upArrowA = await region(144, 102, 12, 10);     // arrow at (148,105)
  await sleep(320);
  await shot('c4_item_idx3_c');
  const upArrowC = await region(144, 102, 12, 10);
  const c4 = {
    itemWindow: itemWinBefore,
    afterDowns: itemState,
    row4InkTextPx: countLum(row4text, 0, 60),
    cursorInkPx_row4: countLum(cursorBand, 0, 60),
    upArrowDarkPx_shotA: countLum(upArrowA, 60, 100),
    upArrowDarkPx_shotC: countLum(upArrowC, 60, 100),
  };
  c4.verdict = (itemState.itemIdx === 3 && itemState.start === 1 && itemState.visible.length === 3
    && c4.cursorInkPx_row4 >= 5 && c4.row4InkTextPx >= 20 && Math.max(c4.upArrowDarkPx_shotA, c4.upArrowDarkPx_shotC) >= 3)
    ? 'FIXED' : 'NOT FIXED';
  findings.check4_itemScroll = c4;
  console.log('check4', JSON.stringify(c4, null, 1));

  // ============ CHECK 5: QUEN VFX (same drowner battle) ============
  console.log('--- check5 quen vfx');
  await page.evaluate(() => { const b = window.__game.battle; b.phase = 'menu'; b.msgs = []; b.monFirst = false; });
  await sleep(100);
  const quenBase = await region(0, 50, 60, 46); // player region x0-60 y50-96 BEFORE cast
  await shot('c5_quen_base');
  await page.evaluate(() => window.__game.battle.castSign('quen'));
  const quenFrames = [];
  for (let i = 0; i < 2; i++) {
    await sleep(i === 0 ? 100 : 200); // ~100ms and ~300ms after cast
    quenFrames.push(await region(0, 50, 60, 46));
    await shot(`c5_quen_${i}`);
  }
  const c5 = {
    quenTurnsAfter: (await st()).quenTurns,
    region: 'x0-60 y50-96 (2760 px)',
    base_vs_f100ms: diffCount(quenBase, quenFrames[0]),
    base_vs_f300ms: diffCount(quenBase, quenFrames[1]),
    f100_vs_f300: diffCount(quenFrames[0], quenFrames[1]),
  };
  c5.verdict = (c5.base_vs_f100ms > 30 || c5.base_vs_f300 > 30) ? 'FIXED' : 'NOT FIXED';
  c5.note = 'pre-fix: 0 px anywhere on the battlefield (QUEN was a bare text label)';
  findings.check5_quenVfx = c5;
  console.log('check5', JSON.stringify(c5, null, 1));

  // ============ CHECK 3: IGNI flash over enemy panel (fresh drowner) ============
  console.log('--- check3 igni flash');
  await page.evaluate(() => window.__game.startBattle('drowner', 3));
  await page.waitForFunction(() => window.__game.mode === 'battle' && window.__game.battle, null, { timeout: 15000, polling: 20 });
  await sleep(2200);
  await page.evaluate(() => { const b = window.__game.battle; b.msgs = []; b.monFirst = false; b.phase = 'menu'; });
  await page.evaluate(() => window.__game.battle.castSign('igni'));
  // flash inverts the panel on a 70ms half-cycle; 70ms-spaced frames straddle the phases
  const igFrames = [];
  for (let i = 0; i < 7; i++) {
    igFrames.push(await region(100, 0, 60, 52));
    await shot(`c3_igni_flash_${i}`);
    if (i < 6) await sleep(70);
  }
  const c3pairs = [];
  for (let i = 0; i + 1 < igFrames.length; i++)
    c3pairs.push({ pair: `${i}->${i + 1}`, changedPx: diffCount(igFrames[i], igFrames[i + 1]) });
  let c3max = 0, c3maxPair = null;
  for (let i = 0; i < igFrames.length; i++)
    for (let j = i + 1; j < igFrames.length; j++) {
      const d = diffCount(igFrames[i], igFrames[j]);
      if (d > c3max) { c3max = d; c3maxPair = `${i}->${j}`; }
    }
  const c3 = {
    region: 'x100-160 y0-52 PAPER enemy panel (3120 px)', threshold: '>200 changed px (pre-fix: 0)',
    consecutivePairs: c3pairs, maxChangedPx: c3max, maxChangedPair: c3maxPair,
    curMsgAfter: (await st()).cur,
  };
  c3.verdict = c3max > 200 ? 'FIXED' : 'NOT FIXED';
  findings.check3_igniFlash = c3;
  console.log('check3', JSON.stringify(c3, null, 1));

  // ============ CHECK 1: sign-kill softlock -> victory -> world (leshen L8 boss) ============
  console.log('--- check1 sign-kill softlock');
  await page.evaluate(() => window.__game.startBattle('leshen', 8, true));
  await page.waitForFunction(() => window.__game.mode === 'battle' && window.__game.battle, null, { timeout: 15000, polling: 20 });
  await sleep(2000);
  const c1pre = await st();
  await page.evaluate(() => {
    const b = window.__game.battle;
    b.msgs = []; b.monHp = 1; b.monFirst = false; // witcher initiative: pure sign-kill repro (original bug path)
    b.castSign('igni');
  });
  const t0 = Date.now();
  const markLen = await page.evaluate(() => window.__modeLog.length); // ignore boot-phase modes
  const poll = [];
  let trackAtCollapse = null, collapseShot = false, worldT = null, doneT = null;
  while (Date.now() - t0 < 25000) {
    const s = await st();
    const rec = { t: Date.now() - t0, mode: s.mode, phase: s.phase, msgsLeft: s.msgsLeft, cur: s.cur, track: s.track, doneResult: s.doneResult };
    poll.push(rec);
    if (s.cur && s.cur.includes('collapses') && trackAtCollapse === null) {
      trackAtCollapse = s.track;
      if (!collapseShot) { await shot('c1_collapses'); collapseShot = true; }
    }
    if (s.doneResult === 'victory' && doneT === null) { doneT = Date.now() - t0; await shot('c1_done'); }
    const newModes = await page.evaluate((m) => window.__modeLog.slice(m).map((x) => x.mode), markLen);
    if (worldT === null && newModes.includes('world')) worldT = Date.now() - t0;
    if (worldT !== null && Date.now() - t0 > worldT + 400) break; // let world/notice settle
    await sleep(300);
  }
  await shot('c1_final');
  const modeLog = await page.evaluate(() => window.__modeLog);
  const c1 = {
    preCast: { mode: c1pre.mode, phase: c1pre.phase, track: c1pre.track, monHp: c1pre.monHp },
    trackAtCollapse, // must be 'victory'
    doneVictoryAtMs: doneT, worldSeenAtMs: worldT,
    reachedWorld: worldT !== null,
    within10s: worldT !== null && worldT <= 10000,
    modeLogTail: modeLog.slice(-8).map((m) => m.mode),
    pollTail: poll.slice(-6),
    distinctPhases: [...new Set(poll.map((p) => p.phase))],
    finalMode: poll[poll.length - 1].mode,
  };
  c1.verdict = (c1.reachedWorld && trackAtCollapse === 'victory') ? 'FIXED' : 'NOT FIXED';
  findings.check1_softlock = c1;
  fs.writeFileSync(`${OUT}/c1_poll_log.json`, JSON.stringify(poll, null, 1));
  console.log('check1', JSON.stringify({ ...c1, pollTail: undefined }, null, 1));

  // ============ CHECK 6: gameover redesign (leshen L8, php=2) ============
  // NB: leshen can roll 'CALL OF WOODS' (heal) — at full HP that is a wasted monster
  // turn and no damage lands, so retry the action until an attack move kills us.
  console.log('--- check6 gameover');
  await page.evaluate(() => { window.__game.player.hp = 140; });
  await page.evaluate(() => window.__game.startBattle('leshen', 8, true));
  await page.waitForFunction(() => window.__game.mode === 'battle' && window.__game.battle, null, { timeout: 15000, polling: 20 });
  for (let i = 0; i < 50; i++) { // drain intro to a quiet menu
    const s = await st();
    if (s.phase === 'menu' || s.mode !== 'battle') break;
    await sleep(200);
  }
  await page.evaluate(() => { const b = window.__game.battle; if (b) { b.msgs = []; b.php = 2; b.playerAttack('steel'); } });
  const g0 = Date.now();
  let overAt = null, c6tries = 1;
  while (Date.now() - g0 < 30000) {
    const s = await st();
    if (s.mode === 'gameover') { overAt = Date.now() - g0; break; }
    if (s.mode === 'battle' && s.phase === 'menu' && s.msgsLeft === 0) { // monster wasted its turn -> act again
      await page.evaluate(() => { const b = window.__game.battle; if (b) { b.msgs = []; b.php = Math.min(b.php, 2); b.playerAttack('steel'); } });
      c6tries++;
    }
    await sleep(200);
  }
  let c6 = { reachedGameover: overAt !== null, msToGameover: overAt, trackAtDetect: null, actionRetries: c6tries };
  if (overAt === null) {
    c6.diag = await page.evaluate(() => {
      const g = window.__game, b = g.battle;
      return { mode: g.mode, phase: b ? b.phase : null, php: b ? b.php : null, monHp: b ? b.monHp : null,
        msgs: b ? b.msgs.map((m) => m.text) : null, cur: b ? b.curMsg : null, afterQueue: b ? b.afterQueue : null };
    });
  }
  if (overAt !== null) {
    c6.trackAtDetect = (await st()).track;
    // shoot at gameoverT ~2350ms: all elements revealed, safely before the >2600ms respawn
    while (true) {
      const gt = await page.evaluate(() => window.__game.gameoverT);
      if (gt >= 2350) break;
      await sleep(50);
    }
    const gt1 = await page.evaluate(() => window.__game.gameoverT);
    await shot('c6_gameover_main');
    const titleBand = await region(20, 2, 120, 26);   // 'GAME OVER' 2x title, y~12
    const spriteBand = await region(40, 34, 80, 46);  // centered monster sprite y42-76
    const line1 = await region(30, 88, 100, 9);       // 'You black out...' PAPER y90
    const line2 = await region(2, 103, 120, 9);       // 'The world smells of iron.' LIGHT y106
    const pressABand = await region(55, 122, 50, 9);  // 'PRESS A' LIGHT y124 (blinks, on from t>2200)
    await sleep(220);
    await shot('c6_gameover_pressA');
    c6 = {
      ...c6, gameoverTAtShot: gt1, trackAtShot: (await st()).track,
      titleBandBrightPx: countLum(titleBand, 100, 256),  // PAPER/LIGHT text on INK bg
      spriteBandNonInkPx: countLum(spriteBand, 55, 256), // sprite body (alpha-blended)
      line1BrightPx: countLum(line1, 100, 256),
      line2BrightPx: countLum(line2, 100, 256),
      pressABrightPx: countLum(pressABand, 100, 256),
    };
    c6.verdict = (c6.titleBandBrightPx > 80 && c6.spriteBandNonInkPx > 40 && c6.line1BrightPx >= 15 && c6.line2BrightPx >= 15)
      ? 'FIXED' : 'NOT FIXED';
    // respawn check: after >2600ms the witcher wakes at the inn (mode world)
    await sleep(1200);
    const respawn = await st();
    c6.respawn = { mode: respawn.mode, track: respawn.track };
    await shot('c6_after_respawn');
  } else c6.verdict = 'NOT FIXED (never reached gameover)';
  findings.check6_gameover = c6;
  console.log('check6', JSON.stringify(c6, null, 1));

  fs.writeFileSync(`${OUT}/findings.json`, JSON.stringify(findings, null, 1));
  await browser.close();

  // ---------- findings.md ----------
  const V = (n) => (findings[n] || {}).verdict ?? '??';
  const md = `# BTL-verify findings (post-fix verification run)

Run: ${findings.meta.ts} — production server http://localhost:3000, headless chromium 480x900, native 160x144 canvas.
PNGs: V-prefixed files in this directory (c1_*/c2_*/... tags). Poll log: c1_poll_log.json.

## 1. Sign-kill softlock — ${V('check1_softlock')}
- Repro: startBattle('leshen',8,true) boss; msgs=[]; monHp=1; castSign('igni') (witcher initiative, pure sign-kill path).
- Reached mode='world': **${findings.check1_softlock.reachedWorld}** at t=${findings.check1_softlock.worldSeenAtMs}ms (within 10s: ${findings.check1_softlock.within10s}).
- Phase timeline: ${JSON.stringify(findings.check1_softlock.distinctPhases)} — no 'sign'-phase wedge; doneResult='victory' at ${findings.check1_softlock.doneVictoryAtMs}ms.
- Track at 'collapses into the mud!' line: **${findings.check1_softlock.trackAtCollapse}** (pre-fix: never left 'finalboss' / msgs never drained).
- Mode log tail: ${JSON.stringify(findings.check1_softlock.modeLogTail)} (leshen victory: world -> ending notice dialog).

## 2. Monster attack lunge — ${V('check2_lunge')}
- wolf L4, monFirst=${findings.check2_lunge.monFirstAtStart}; playerAttack('steel') triggers preempt monAct; 6 frames 120ms apart per round (wolf move choice is random: retry until an attack move).
- Rounds: ${JSON.stringify(findings.check2_lunge.rounds)}.
- Passing round consecutive-pair diffs: ${JSON.stringify((findings.check2_lunge.best || {}).pairs)}; msg during capture: "${(findings.check2_lunge.best || {}).msgDuring}".
- Max changed px: **${(findings.check2_lunge.best || {}).maxChangedPx}** (threshold >100; pre-fix: 0 across the entire wolf counter).

## 3. IGNI flash over enemy panel — ${V('check3_igniFlash')}
- drowner L3; msgs=[]; castSign('igni'); frames ~100ms apart; region x100-160 y0-52 (PAPER panel).
- Consecutive diffs: ${JSON.stringify(findings.check3_igniFlash.consecutivePairs)}; max **${findings.check3_igniFlash.maxChangedPx}** px (threshold >200; pre-fix: 0).

## 4. Item menu scroll — ${V('check4_itemScroll')}
- inv = swallow/thunder/honey/insectoil (4 rows). After 3x 'down': itemIdx=${findings.check4_itemScroll.afterDowns.itemIdx}, scrollStart=${findings.check4_itemScroll.afterDowns.start}, visible rows ${JSON.stringify(findings.check4_itemScroll.afterDowns.visible)}.
- Row-4 INK text px (y118-130, x12-110): **${findings.check4_itemScroll.row4InkTextPx}** (pre-fix: row not drawn).
- Cursor INK px in row-4 cursor slot: **${findings.check4_itemScroll.cursorInkPx_row4}** (pre-fix: invisible).
- Scroll ↑ indicator DARK px (blink, 2 shots): ${findings.check4_itemScroll.upArrowDarkPx_shotA} / ${findings.check4_itemScroll.upArrowDarkPx_shotC}.

## 5. QUEN VFX — ${V('check5_quenVfx')}
- phase='menu'; msgs=[]; castSign('quen'); player region x0-60 y50-96 vs pre-cast baseline.
- baseline->100ms: **${findings.check5_quenVfx.base_vs_f100ms}** px; baseline->300ms: **${findings.check5_quenVfx.base_vs_f300ms}** px; 100ms->300ms: ${findings.check5_quenVfx.f100_vs_f300} px. quenTurns=${findings.check5_quenVfx.quenTurnsAfter}. (pre-fix: 0 px battlefield-wide.)

## 6. Gameover redesign — ${V('check6_gameover')}
- leshen L8 boss, php=2, defeat via monster turn; reached gameover in ${findings.check6_gameover.msToGameover}ms (action retries due to monster heal-at-full-HP rolls: ${findings.check6_gameover.actionRetries}); shot at gameoverT=${findings.check6_gameover.gameoverTAtShot}ms (music '${findings.check6_gameover.trackAtDetect}'; respawn after >2600ms -> ${JSON.stringify(findings.check6_gameover.respawn)}).
- Title band bright px: **${findings.check6_gameover.titleBandBrightPx}**; monster sprite band px: **${findings.check6_gameover.spriteBandNonInkPx}**;
  'You black out...' px: **${findings.check6_gameover.line1BrightPx}**; 'The world smells of iron.' px: **${findings.check6_gameover.line2BrightPx}**; PRESS A px: ${findings.check6_gameover.pressABrightPx}.
- (Pre-fix: no title, 2nd line near-invisible C.DARK-on-C.INK.)

## Verdicts
1. ${V('check1_softlock')} 2. ${V('check2_lunge')} 3. ${V('check3_igniFlash')} 4. ${V('check4_itemScroll')} 5. ${V('check5_quenVfx')} 6. ${V('check6_gameover')}
`;
  fs.writeFileSync(`${OUT}/findings.md`, md);
  console.log('\n=== VERDICTS ===');
  ['check1_softlock', 'check2_lunge', 'check3_igniFlash', 'check4_itemScroll', 'check5_quenVfx', 'check6_gameover']
    .forEach((k) => console.log(k, '->', findings[k].verdict));
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
