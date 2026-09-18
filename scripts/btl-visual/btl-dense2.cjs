// ============================================================
// BTL-visual dense capture part 2: sign anims (IGNI flash, AARD
// shake), faint sequence, boss intro — with softlock guards.
// (Part 1 = D1 in btl-dense.cjs, already captured.)
// VERIFICATION ONLY.
// ============================================================
const {
  launchGame, sleep, pressKey, startNewGame, beginBattle,
  bstate, shot, OUT, fs,
} = require('./btl-lib.cjs');

const LOG = [];
const log = (s) => { LOG.push(s); console.log(s); };

(async () => {
  const { browser, page } = await launchGame();
  await startNewGame(page);

  async function navMenu(target) {
    for (let guard = 0; guard < 6; guard++) {
      const st = await bstate(page);
      if (st.phase !== 'menu') throw new Error(`navMenu: phase=${st.phase}`);
      if (st.menuIdx === target) return;
      if ((st.menuIdx & 1) !== (target & 1)) await pressKey(page, 'right', 70);
      else if ((st.menuIdx & 2) !== (target & 2)) await pressKey(page, 'down', 70);
    }
  }

  // wait for menu; returns 'menu' | 'ended' | 'softlock:<phase>'
  async function waitMenu(maxMs = 8000) {
    const t0 = performance.now();
    let last;
    while (performance.now() - t0 < maxMs) {
      const st = await bstate(page);
      last = st;
      if (st.mode !== 'battle') return 'ended';
      if (st.phase === 'menu') return 'menu';
      await sleep(100);
    }
    return `softlock:${last ? last.phase : '?'} msgs=${last ? last.nMsgs : '?'}`;
  }

  // ==========================================================
  // DENSE 2 — drowner: IGNI flash, AARD shake, faint (kill via SWORD)
  // ==========================================================
  {
    const trace = { t0: performance.now(), shots: [] };
    await page.evaluate(() => {
      const p = window.__game.player;
      p.lvl = 4; p.maxHp = 80; p.hp = 80; p.atk = 14; p.def = 8; p.sta = p.maxSta;
    });
    await beginBattle(page, 'drowner', 3);
    // wait menu
    let r = await waitMenu(12000);
    log(`D2: pre-menu ${r}`);
    await sleep(200);

    // IGNI
    await navMenu(2);
    await pressKey(page, 'a', 60);
    await page.waitForFunction(
      () => window.__game.battle && window.__game.battle.phase === 'sign',
      null, { timeout: 8000, polling: 20 },
    );
    await pressKey(page, 'a', 30); // IGNI selected
    const t2 = performance.now();
    for (let i = 0; i < 90; i++) {
      await shot(page, trace, `D2_igni_${String(i).padStart(2, '0')}`, { dt: Math.round(performance.now() - t2) });
      await sleep(34);
    }
    r = await waitMenu(9000);
    log(`D2: after igni ${r}`);

    // AARD (top the monster up first so AARD cannot kill it)
    if (r === 'menu') {
      await page.evaluate(() => { const b = window.__game.battle; if (b) { b.monHp = b.monMaxHp; b.dispMonHp = b.monMaxHp; } });
      await navMenu(2);
      await pressKey(page, 'a', 60);
      await page.waitForFunction(
        () => window.__game.battle && window.__game.battle.phase === 'sign',
        null, { timeout: 8000, polling: 20 },
      );
      await pressKey(page, 'right', 60); // 0 -> AARD
      await pressKey(page, 'a', 30);
      const t3 = performance.now();
      for (let i = 0; i < 90; i++) {
        await shot(page, trace, `D2_aard_${String(i).padStart(2, '0')}`, { dt: Math.round(performance.now() - t3) });
        await sleep(34);
      }
      r = await waitMenu(9000);
      log(`D2: after aard ${r}`);
    }

    // QUEN shield status row + faint: set up kill via SWORD
    if (r === 'menu') {
      // cast QUEN first for the status row, then sword-kill at 1hp
      await page.evaluate(() => { const b = window.__game.battle; if (b) { b.monHp = b.monMaxHp; b.dispMonHp = b.monMaxHp; } });
      await navMenu(2);
      await pressKey(page, 'a', 60);
      await page.waitForFunction(
        () => window.__game.battle && window.__game.battle.phase === 'sign',
        null, { timeout: 8000, polling: 20 },
      );
      await pressKey(page, 'down', 60);  // 0 -> 2 QUEN
      await pressKey(page, 'a', 30);
      const tQ = performance.now();
      for (let i = 0; i < 50; i++) {
        await shot(page, trace, `D2_quen_${String(i).padStart(2, '0')}`, { dt: Math.round(performance.now() - tQ) });
        await sleep(34);
      }
      r = await waitMenu(9000);
      log(`D2: after quen ${r}`);
    }
    if (r === 'menu') {
      await page.evaluate(() => { const b = window.__game.battle; if (b) { b.monHp = 1; } });
      await navMenu(0);
      await pressKey(page, 'a', 60);
      await page.waitForFunction(
        () => window.__game.battle && window.__game.battle.phase === 'fight',
        null, { timeout: 8000, polling: 20 },
      );
      await pressKey(page, 'down', 50);
      await pressKey(page, 'a', 30);
      const t4 = performance.now();
      for (let i = 0; i < 180; i++) {
        await shot(page, trace, `D2_faint_${String(i).padStart(3, '0')}`, { dt: Math.round(performance.now() - t4) });
        await sleep(36);
        const st = await bstate(page);
        if (st.mode !== 'battle') break;
      }
      log('D2: faint captured');
    }
    fs.writeFileSync(`${OUT}/trace-D2.json`, JSON.stringify({ trace, log: LOG.slice() }, null, 1));
  }

  // ==========================================================
  // DENSE 3 — boss leshen: intro slide + one hit + counter
  // ==========================================================
  {
    const trace = { t0: performance.now(), shots: [] };
    await page.evaluate(() => {
      const p = window.__game.player;
      p.maxHp = 140; p.hp = 140; p.atk = 26; p.def = 12; p.lvl = 8;
    });
    await beginBattle(page, 'leshen', 8, true);
    for (let i = 0; i < 24; i++) {
      await shot(page, trace, `D3_intro_${String(i).padStart(2, '0')}`);
      await sleep(26);
    }
    const r = await waitMenu(12000);
    log(`D3: menu ${r}`);
    await sleep(250);
    await navMenu(0);
    await pressKey(page, 'a', 60);
    await page.waitForFunction(
      () => window.__game.battle && window.__game.battle.phase === 'fight',
      null, { timeout: 8000, polling: 20 },
    );
    await pressKey(page, 'a', 30); // steel
    const t5 = performance.now();
    for (let i = 0; i < 110; i++) {
      await shot(page, trace, `D3_hit_${String(i).padStart(3, '0')}`, { dt: Math.round(performance.now() - t5) });
      await sleep(34);
    }
    log('D3: boss dense captured');
    fs.writeFileSync(`${OUT}/trace-D3.json`, JSON.stringify({ trace, log: LOG.slice() }, null, 1));
  }

  await browser.close();
  console.log('DENSE-2 DONE');
})().catch((e) => { console.error(e); process.exit(1); });
