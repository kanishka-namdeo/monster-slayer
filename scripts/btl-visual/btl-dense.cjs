// ============================================================
// BTL-visual dense capture: high-frequency frames (30-40ms) of
// the live battle canvas for pixel-level animation analysis.
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

  // wait for a message that matches re, then capture n frames ~interval apart
  async function denseOnMsg(trace, wantRe, tag, n, interval) {
    const t0 = performance.now();
    // wait for target message to start (typing begins)
    await page.waitForFunction(
      (re) => { const b = window.__game.battle; return b && b.phase === 'msg' && new RegExp(re).test(b.curMsg); },
      wantRe.source, { timeout: 20000, polling: 10 },
    ).catch(() => null);
    for (let i = 0; i < n; i++) {
      await shot(page, trace, `${tag}_${String(i).padStart(2, '0')}`, { dt: Math.round(performance.now() - t0) });
      if (i < n - 1) await sleep(interval);
    }
  }

  // ==========================================================
  // DENSE 1 — drowner: intro slide-in, hit anims, counter
  // ==========================================================
  {
    const trace = { t0: performance.now(), shots: [] };
    await beginBattle(page, 'drowner', 3);
    // intro: 700ms; slide 500ms — capture at 28ms
    for (let i = 0; i < 26; i++) {
      await shot(page, trace, `D1_intro_${String(i).padStart(2, '0')}`);
      await sleep(24);
    }
    await page.waitForFunction(
      () => window.__game.battle && window.__game.battle.phase === 'menu',
      null, { timeout: 15000, polling: 30 },
    );
    await sleep(250);

    // turn 1: silver attack — dense through the whole resolution
    await navMenu(0);
    await pressKey(page, 'a', 60);
    await page.waitForFunction(
      () => window.__game.battle && window.__game.battle.phase === 'fight',
      null, { timeout: 8000, polling: 20 },
    );
    await pressKey(page, 'down', 50); // silver
    await pressKey(page, 'a', 30);
    // dense capture 6s: pre-hit static msg + monhit anim + counter playerhit
    const t1 = performance.now();
    for (let i = 0; i < 150; i++) {
      await shot(page, trace, `D1_hit_${String(i).padStart(3, '0')}`, { dt: Math.round(performance.now() - t1) });
      await sleep(34);
    }
    log('D1: hit sequence captured');
    fs.writeFileSync(`${OUT}/trace-D1.json`, JSON.stringify({ trace, log: LOG.slice() }, null, 1));
  }

  // ==========================================================
  // DENSE 2 — drowner: sign anims (IGNI flash + AARD shake), faint
  // ==========================================================
  {
    const trace = { t0: performance.now(), shots: [] };
    // still in the same drowner battle (menu after turn 1) — wait for it
    await page.waitForFunction(
      () => window.__game.battle && window.__game.battle.phase === 'menu',
      null, { timeout: 25000, polling: 40 },
    );
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
    // wait menu
    await page.waitForFunction(
      () => window.__game.battle && window.__game.battle.phase === 'menu',
      null, { timeout: 25000, polling: 40 },
    );
    // AARD
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
    // wait menu, then set up the faint: monHp=1, silver kill, dense 8s
    await page.waitForFunction(
      () => window.__game.battle && window.__game.battle.phase === 'menu',
      null, { timeout: 25000, polling: 40 },
    );
    await page.evaluate(() => { window.__game.battle.monHp = 1; });
    await navMenu(0);
    await pressKey(page, 'a', 60);
    await page.waitForFunction(
      () => window.__game.battle && window.__game.battle.phase === 'fight',
      null, { timeout: 8000, polling: 20 },
    );
    await pressKey(page, 'down', 50);
    await pressKey(page, 'a', 30);
    const t4 = performance.now();
    for (let i = 0; i < 170; i++) {
      await shot(page, trace, `D2_faint_${String(i).padStart(3, '0')}`, { dt: Math.round(performance.now() - t4) });
      await sleep(38);
      const st = await bstate(page);
      if (st.mode !== 'battle') break;
    }
    log('D2: sign anims + faint captured');
    fs.writeFileSync(`${OUT}/trace-D2.json`, JSON.stringify({ trace, log: LOG.slice() }, null, 1));
  }

  // ==========================================================
  // DENSE 3 — boss leshen: intro slide + one hit + shake (aard)
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
    await page.waitForFunction(
      () => window.__game.battle && window.__game.battle.phase === 'menu',
      null, { timeout: 15000, polling: 30 },
    );
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
  console.log('DENSE CAPTURE DONE');
})().catch((e) => { console.error(e); process.exit(1); });
