// ============================================================
// BTL-visual dense capture part 3: boss leshen intro + hit.
// Standalone (waits for world mode to avoid fade races).
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

  await page.evaluate(() => {
    const p = window.__game.player;
    p.maxHp = 140; p.hp = 140; p.atk = 26; p.def = 12; p.lvl = 8;
  });
  await beginBattle(page, 'leshen', 8, true);
  const trace = { t0: performance.now(), shots: [] };
  for (let i = 0; i < 24; i++) {
    await shot(page, trace, `D3_intro_${String(i).padStart(2, '0')}`);
    await sleep(26);
  }
  const r = await (async () => {
    const t0 = performance.now();
    while (performance.now() - t0 < 12000) {
      const st = await bstate(page);
      if (st.mode !== 'battle') return 'ended';
      if (st.phase === 'menu') return 'menu';
      await sleep(100);
    }
    return 'timeout';
  })();
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
  await browser.close();
  console.log('DENSE-3 DONE');
})().catch((e) => { console.error(e); process.exit(1); });
