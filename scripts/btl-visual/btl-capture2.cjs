// BTL-visual retry part 2: scenario A only with p.atk=14 so the drowner
// survives hits -> HP mid-drain, monster counter, separate faint, victory,
// done phase + post-battle. VERIFICATION ONLY.
const { chromium } = require('playwright');
const fs = require('fs');
const GAME_URL = 'http://localhost:3100';
const OUT = '/home/z/my-project/scripts/btl-visual/out';
const T0 = Date.now();
const trace = { shots: [], log: [] };
let seq = 200; // continue numbering space
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (s) => { trace.log.push(s); console.log(`[${((Date.now() - T0) / 1000).toFixed(1)}s] ${s}`); };
function BSTATE() {
  const g = window.__game; const b = g.battle;
  if (!b) return { mode: g.mode };
  return {
    mode: g.mode, phase: b.phase, menuIdx: b.menuIdx, subIdx: b.subIdx, itemIdx: b.itemIdx,
    monHp: b.monHp, monMaxHp: b.monMaxHp, php: b.php, psta: b.psta,
    dispMonHp: +b.dispMonHp.toFixed(2), dispPhp: +b.dispPhp.toFixed(2),
    curMsg: b.curMsg, charIdx: Math.floor(b.charIdx), curAnim: b.curAnim,
    animT: Math.round(b.animT), faintT: Math.round(b.faintT), monDead: b.monDead,
    doneResult: b.doneResult, nMsgs: b.msgs.length, msgsTexts: b.msgs.map((m) => m.text),
    afterQueue: b.afterQueue, quenTurns: b.quenTurns,
  };
}
const bstate = (page) => page.evaluate(BSTATE);
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
  return { file, st };
}
async function burst(page, tag, n, interval) {
  for (let i = 0; i < n; i++) { await shot(page, `${tag}_${String(i).padStart(2, '0')}`, { i }); if (i < n - 1) await sleep(interval); }
}
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
async function attackSteel(page) {
  for (let guard = 0; guard < 6; guard++) {
    const st = await bstate(page);
    if (st.phase === 'menu' && st.menuIdx === 0) break;
    if (st.phase !== 'menu') { await sleep(120); continue; }
    if ((st.menuIdx & 1) !== 0) await tap(page, 'left'); else if ((st.menuIdx & 2) !== 0) await tap(page, 'up');
  }
  await tap(page, 'a');
  await page.waitForFunction(() => window.__game.battle && window.__game.battle.phase === 'fight', null, { timeout: 8000, polling: 25 });
  await tap(page, 'a', 50);
}

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 480, height: 900 } });
  await page.goto(GAME_URL, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__game && window.__game.mode === 'title', null, { timeout: 30000, polling: 50 });
  await tap(page, 'start', 120); await tap(page, 'a', 100); await tap(page, 'a', 100);
  await sleep(400);
  await page.evaluate(() => {
    const g = window.__game; const p = g.player;
    p.maxHp = 140; p.hp = 140; p.atk = 14; p.def = 10; p.maxSta = 60; p.sta = 60;
    g.inv = { swallow: 2, thunder: 1, honey: 1, insectoil: 1 };
  });
  await page.evaluate(() => window.__game.startBattle('drowner', 3, false));
  await page.waitForFunction(() => window.__game.mode === 'battle' && !!window.__game.battle, null, { timeout: 15000, polling: 25 });
  await until(page, (s) => s.phase === 'menu', 10000, 'menu');
  await shot(page, 'A2_menu');

  // hit 1 (drowner survives) — resolution + drain + counter
  await attackSteel(page);
  await until(page, (s) => s.phase === 'msg' && /takes \d+/.test(s.curMsg || ''), 8000, 'dmg msg');
  await burst(page, 'A2_hit', 4, 60);
  await burst(page, 'A2_hit_blink', 2, 150);
  await burst(page, 'A2_drain', 5, 90); // mid-drain frame(s) picked from trace by dispMonHp
  await until(page, (s) => s.phase === 'msg' && (s.curMsg || '').startsWith('DROWNER'), 15000, 'monatk');
  await burst(page, 'A2_monatk', 5, 150);
  await drainMsgs(page);

  // hit 2 -> likely kill; if not, hit 3
  for (let i = 0; i < 3; i++) {
    const st = await bstate(page);
    if (st.mode !== 'battle') break;
    await until(page, (s) => s.phase === 'menu', 15000, 'menu');
    await attackSteel(page);
    const st2 = await bstate(page);
    if (st2.monDead || st2.monHp <= 0) break;
    await drainMsgs(page);
  }
  // faint animation
  await until(page, (s) => s.monDead, 8000, 'monDead');
  await burst(page, 'A2_faint', 5, 150);
  await until(page, (s) => s.phase === 'msg' && /collapses/.test(s.curMsg || ''), 8000, 'collapse msg');
  await shot(page, 'A2_victory_msg_collapse');
  await until(page, (s) => s.phase === 'msg' && /XP earned|LEVEL UP/.test(s.curMsg || ''), 12000, 'xp msg');
  await shot(page, 'A2_victory_msg_xp');
  await until(page, (s) => s.phase === 'done', 15000, 'done');
  const dSt = await shot(page, 'A2_done_phase');
  log(`A2: done state=${JSON.stringify({ phase: dSt.st.phase, doneResult: dSt.st.doneResult })}`);
  const endMode = await page.waitForFunction(() => window.__game.mode !== 'battle', null, { timeout: 20000, polling: 60 }).then(() => page.evaluate(() => window.__game.mode)).catch(() => 'timeout');
  log(`A2: battle ended mode=${endMode}`);
  await sleep(400);
  await shot(page, 'A2_after_battle');
  fs.writeFileSync(`${OUT}/trace-a2.json`, JSON.stringify(trace, null, 1));
  await browser.close();
  console.log('A2 DONE — shots from 200:', seq - 200);
})().catch((e) => { console.error(e); fs.writeFileSync(`${OUT}/trace-a2.json`, JSON.stringify(trace, null, 1)); process.exit(1); });
