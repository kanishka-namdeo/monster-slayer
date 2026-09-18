// BTL-verify part 2: the actual sign-kill (IGNI on leshen boss with monHp=1)
// + enemy HEX tag retry. The first run's leshen healed itself (CALL OF WOODS)
// before IGNI resolved, so no kill happened. VERIFICATION ONLY.
const { chromium } = require('playwright');
const fs = require('fs');

const GAME_URL = 'http://localhost:3000';
const OUT = '/home/z/my-project/scripts/btl-verify/out';
const T0 = Date.now();
const trace = { shots: [], log: [], softlock2: [] };
let seq = 100;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (s) => { trace.log.push(`[${((Date.now() - T0) / 1000).toFixed(1)}s] ${s}`); console.log(`[${((Date.now() - T0) / 1000).toFixed(1)}s] ${s}`); };

function BSTATE() {
  const g = window.__game;
  const b = g.battle;
  const track = window.__audio ? window.__audio.currentTrack : null;
  if (!b) return { mode: g.mode, track };
  return {
    mode: g.mode, track,
    phase: b.phase, menuIdx: b.menuIdx, subIdx: b.subIdx,
    monName: b.monName, monHp: +b.monHp.toFixed(1), barMonHp: +b.barMonHp.toFixed(2), dispMonHp: +b.dispMonHp.toFixed(2),
    php: b.php, curMsg: (b.curMsg || '').slice(0, 48), charIdx: Math.floor(b.charIdx),
    curAnim: b.curAnim, animT: Math.round(b.animT),
    faintStarted: b.faintStarted, faintT: Math.round(b.faintT), pFaintStarted: b.pFaintStarted,
    monDead: b.monDead, monFirst: b.monFirst, monHex: b.monHex, quenTurns: b.quenTurns,
    resolved: b.resolved, doneResult: b.doneResult, afterQueue: b.afterQueue, nMsgs: b.msgs.length,
    msgsTexts: b.msgs.slice(0, 4).map((m) => m.text.slice(0, 42)),
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
async function until(page, pred, timeoutMs = 15000, label = '', poll = 20) {
  const t0 = Date.now();
  for (;;) {
    const st = await bstate(page);
    if (pred(st)) return st;
    if (Date.now() - t0 > timeoutMs) throw new Error(`until timeout: ${label} (phase=${st.phase} msg=${st.curMsg})`);
    await sleep(poll);
  }
}
async function drainMsgs(page, timeoutMs = 25000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const st = await bstate(page);
    if (st.mode !== 'battle') return 'ended';
    if (st.phase !== 'msg') return st.phase;
    await tap(page, 'a', 60);
  }
  return 'timeout';
}
async function gotoMenuIdx(page, target) {
  for (let i = 0; i < 4; i++) {
    const st = await bstate(page);
    if (st.mode !== 'battle') return st;
    if (st.phase === 'menu') {
      if (st.menuIdx === target) return st;
      if ((st.menuIdx & 1) !== (target & 1)) await tap(page, 'left', 50);
      else if ((st.menuIdx & 2) !== (target & 2)) await tap(page, 'up', 50);
      await sleep(80);
    } else if (st.phase === 'msg') await drainMsgs(page, 20000);
    else { await tap(page, 'b', 60); await sleep(120); }
  }
  throw new Error('gotoMenuIdx failed');
}

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 480, height: 900 } });
  try {
    await page.goto(GAME_URL, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__game && window.__game.mode === 'title', null, { timeout: 30000, polling: 50 });
    await tap(page, 'start', 120);
    for (let i = 0; i < 10; i++) {
      const m = await page.evaluate(() => window.__game.mode);
      if (m === 'world') break;
      if (m === 'title') { await sleep(200); continue; }
      await tap(page, 'a', 90);
      await sleep(120);
    }
    await page.evaluate(() => {
      const g = window.__game; const p = g.player;
      p.school = 'bear'; p.lvl = 1; p.maxHp = 140; p.hp = 140; p.atk = 10; p.def = 10; p.maxSta = 60; p.sta = 60;
      g.inv = { swallow: 2, thunder: 1, honey: 1, insectoil: 1 };
    });
    await page.evaluate(() => window.__game.startBattle('leshen', 8, true));
    await page.waitForFunction(() => window.__game.mode === 'battle' && !!window.__game.battle && window.__game.battle.phase === 'intro', null, { timeout: 15000, polling: 10 });
    await until(page, (s) => s.phase === 'menu', 15000, 'menu');
    // --- sign kill: monHp=1, witcher strikes first (same dev hook as engine.debugWinBattle) ---
    await page.evaluate(() => { const b = window.__game.battle; b.monHp = 1; b.barMonHp = 1; b.dispMonHp = 1; b.monFirst = false; b.psta = 60; b.barPsta = 60; b.dispSta = 60; });
    await gotoMenuIdx(page, 2);
    await tap(page, 'a', 60);
    await page.waitForFunction(() => window.__game.battle && window.__game.battle.phase === 'sign', null, { timeout: 8000, polling: 20 });
    await shot(page, 'H2_kill_selected', { note: 'sign menu before lethal IGNI' });
    await tap(page, 'a', 50);
    // poll every 300ms; capture scorched + collapse inline (no taps: real holds)
    const poll = [];
    let capSc = false, capCo = false;
    const tH = Date.now();
    while (Date.now() - tH < 12000) {
      const st = await bstate(page);
      poll.push({ t: Date.now() - tH, phase: st.phase, msgs_left: st.nMsgs, curMsg: st.curMsg, faintStarted: st.faintStarted, faintT: st.faintT, mode: st.mode, track: st.track, doneResult: st.doneResult, monHp: st.monHp });
      if (!capSc && st.phase === 'msg' && /scorched/.test(st.curMsg || '')) {
        capSc = true;
        await shot(page, 'H2_kill_scorched', { note: 'monster alive on screen during dmg msg, faint NOT started' });
      }
      if (!capCo && st.phase === 'msg' && /collapses/.test(st.curMsg || '')) {
        capCo = true;
        const pre = await bstate(page);
        log(`H2: collapse landed -> faintStarted=${pre.faintStarted} faintT=${pre.faintT} track=${pre.track}`);
        for (let i = 0; i < 6; i++) { await shot(page, `H2_faint_${String(i).padStart(2, '0')}`); if (i < 5) await sleep(120); }
      }
      if (st.mode !== 'battle') break;
      await sleep(300);
    }
    trace.softlock2 = poll;
    const stEnd = await bstate(page);
    log(`H2: end mode=${stEnd.mode} phase=${stEnd.phase} doneResult=${stEnd.doneResult} track=${stEnd.track} monDead=${stEnd.monDead}`);
    await sleep(400);
    await shot(page, 'H2_after_kill', { note: 'post-battle state' });

    // --- enemy HEX tag retry (new drowner battle; AXII until hex lands) ---
    await page.evaluate(() => { const g = window.__game; g.player.hp = 140; });
    await page.evaluate(() => window.__game.startBattle('drowner', 3, false));
    await page.waitForFunction(() => window.__game.mode === 'battle' && !!window.__game.battle && window.__game.battle.phase === 'intro', null, { timeout: 15000, polling: 10 });
    await until(page, (s) => s.phase === 'menu', 15000, 'menu2');
    let hexed = false;
    for (let i = 0; i < 5 && !hexed; i++) {
      await page.evaluate(() => { const b = window.__game.battle; if (b.monHp < 8) { b.monHp = 18; b.barMonHp = 18; } b.psta = 60; b.barPsta = 60; });
      await gotoMenuIdx(page, 2);
      await tap(page, 'a', 60);
      await page.waitForFunction(() => window.__game.battle && window.__game.battle.phase === 'sign', null, { timeout: 8000, polling: 20 });
      await tap(page, 'right', 50); await sleep(70); // AARD slot -> subIdx 1
      await tap(page, 'down', 50); await sleep(70);  // -> AXII (3)
      await tap(page, 'a', 50);
      const st = await bstate(page);
      if (st.monHex > 0) {
        hexed = true;
        await until(page, (s) => /confused/.test(s.curMsg || ''), 5000, 'hex msg', 20).catch(() => {});
        await shot(page, 'H2_hud_hex', { note: "enemy 'L3 HEX' tag" });
      }
      await drainMsgs(page, 15000);
      await until(page, (s) => s.phase === 'menu' || s.mode !== 'battle', 10000, 'menu after axii').catch(() => {});
    }
    log(`H2: enemy hexed=${hexed}`);
    fs.writeFileSync(`${OUT}/trace2.json`, JSON.stringify(trace, null, 1));
    log('DONE part2');
    await browser.close();
  } catch (e) {
    trace.error = String((e && e.stack) || e);
    log(`ERROR: ${trace.error}`);
    fs.writeFileSync(`${OUT}/trace2.json`, JSON.stringify(trace, null, 1));
    await browser.close().catch(() => {});
    process.exitCode = 1;
  }
})();
