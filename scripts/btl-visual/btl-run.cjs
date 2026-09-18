// ============================================================
// BTL-visual main driver: wild battle (drowner), boss (leshen),
// higher-level (endrega) + defeat. Captures PNG frames of the
// canvas at native 160x144 with a full state trace per frame.
// VERIFICATION ONLY.
// ============================================================
const {
  launchGame, sleep, pressKey, startNewGame, beginBattle,
  bstate, shot, shotElement, burst, waitPhase, waitNotPhase, waitBattleEnd, OUT, fs,
} = require('./btl-lib.cjs');

const LOG = [];
const log = (s) => { LOG.push(s); console.log(s); };

(async () => {
  const { browser, page } = await launchGame();
  const mode = await startNewGame(page);
  log(`new game mode=${mode}`);
  await page.evaluate(() => {
    // richer pockets so ITEM submenu shows a real list (real game API)
    const g = window.__game;
    g.giveItem('thunder', 1);
    g.giveItem('honey', 1);
    g.giveItem('necrooil', 1);
  });
  const inv0 = await page.evaluate(() => JSON.parse(JSON.stringify(window.__game.inv)));
  log(`inv=${JSON.stringify(inv0)}`);

  // wait for menu with guard (softlock-aware)
  async function awaitMenu(trace, tag, maxMs = 9000) {
    const t0 = performance.now();
    while (performance.now() - t0 < maxMs) {
      const st = await bstate(page);
      if (st.mode !== 'battle') return 'ended';
      if (st.phase === 'menu') return 'menu';
      if (st.phase === 'done') return 'done';
      await sleep(120);
    }
    return 'timeout';
  }

  // navigate the 2x2 root menu to `target` (0 FIGHT, 1 ITEM, 2 SIGN, 3 RUN)
  // by reading the real cursor position (menuIdx) each step.
  async function navMenu(page, target) {
    for (let guard = 0; guard < 6; guard++) {
      const st = await bstate(page);
      if (st.phase !== 'menu') throw new Error(`navMenu: not in menu (phase=${st.phase})`);
      if (st.menuIdx === target) return true;
      const bit0diff = (st.menuIdx & 1) !== (target & 1);
      const bit1diff = (st.menuIdx & 2) !== (target & 2);
      if (bit0diff) await pressKey(page, 'right', 80);
      else if (bit1diff) await pressKey(page, 'down', 80);
    }
    throw new Error(`navMenu: could not reach ${target}`);
  }

  // ==========================================================
  // SCENARIO A — WILD BATTLE vs DROWNER lvl 3
  // ==========================================================
  {
    const trace = { t0: performance.now(), shots: [] };
    await beginBattle(page, 'drowner', 3);
    log('A: drowner battle started');

    // intro frames: fade-in + monster slide-in (intro 700ms, slide 500ms)
    await burst(page, trace, 'A_intro', 12, 70);

    // menu phase + submenu states
    await waitPhase(page, 'menu');
    await sleep(200);
    await shot(page, trace, 'A_menu_fight');
    await pressKey(page, 'down', 90);           // FIGHT(0) -> SIGN(2)
    await shot(page, trace, 'A_menu_sign');
    await pressKey(page, 'right', 90);          // SIGN(2) -> RUN(3)
    await shot(page, trace, 'A_menu_run');
    await pressKey(page, 'down', 90);            // RUN(3) -> ITEM(1)
    await shot(page, trace, 'A_menu_item');
    await pressKey(page, 'up', 90);              // ITEM(1) -> RUN(3)
    await shot(page, trace, 'A_menu_run2');
    await pressKey(page, 'up', 90);              // RUN(3) -> ITEM(1)
    await pressKey(page, 'left', 90);            // ITEM(1) -> FIGHT(0)
    await sleep(150);

    // open FIGHT submenu
    await pressKey(page, 'a', 90);
    await waitPhase(page, 'fight');
    await shot(page, trace, 'A_fight_submenu');
    await pressKey(page, 'down', 90);           // to silver
    await shot(page, trace, 'A_fight_submenu_silver');

    // ATTACK with silver — full resolution burst (msgs + anims + counter)
    await pressKey(page, 'a', 60);
    const tAttack = performance.now();
    for (let i = 0; i < 32; i++) {
      const dt = Math.round(performance.now() - tAttack);
      await shot(page, trace, `A_attack_${String(i).padStart(2, '0')}`, { msAfterAttack: dt });
      await sleep(110);
    }
    log('A: attack burst done');

    // turn 2: navigate to SIGN and cast IGNI (flash anim)
    const r2 = await awaitMenu(page);
    log(`A: turn2 awaitMenu=${r2}`);
    if (r2 !== 'menu') throw new Error('A: expected menu turn 2');
    await sleep(200);
    await shot(page, trace, 'A_menu_turn2');
    await navMenu(page, 2);                     // -> SIGN
    await pressKey(page, 'a', 90);
    await waitPhase(page, 'sign');
    await shot(page, trace, 'A_sign_submenu');   // IGNI selected
    await pressKey(page, 'down', 90);            // 0->2 QUEN
    await shot(page, trace, 'A_sign_submenu_quen');
    await pressKey(page, 'down', 90);            // 2->4 BACK
    await shot(page, trace, 'A_sign_submenu_back');
    await pressKey(page, 'up', 90);              // 4->2
    await pressKey(page, 'up', 90);              // 2->0 IGNI
    await sleep(120);

    await pressKey(page, 'a', 60);
    const tIgni = performance.now();
    for (let i = 0; i < 26; i++) {
      await shot(page, trace, `A_igni_${String(i).padStart(2, '0')}`, { msAfterIgni: Math.round(performance.now() - tIgni) });
      await sleep(110);
    }
    log('A: igni burst done');

    // Did IGNI kill the drowner? (softlock probe — kill-by-sign)
    const r3 = await awaitMenu(page, 4000);
    log(`A: after igni awaitMenu=${r3}`);
    if (r3 === 'timeout') {
      const st = await bstate(page);
      log(`A: SIGN-KILL STATE: ${JSON.stringify(st)}`);
      await shot(page, trace, 'A_SOFTLOCK_sign_kill');
      await sleep(1600);
      await shot(page, trace, 'A_SOFTLOCK_sign_kill_late');
      // unstick: confirm current sign selection (QUEN) -> queued msgs play,
      // dead monster may still take its turn
      await pressKey(page, 'a', 60);
      const tU = performance.now();
      for (let i = 0; i < 22; i++) {
        await shot(page, trace, `A_SOFTLOCK_unstick_${String(i).padStart(2, '0')}`, { msAfterUnstick: Math.round(performance.now() - tU) });
        await sleep(120);
      }
    }

    // ITEM submenu browse + back
    const r4 = await awaitMenu(page);
    log(`A: item awaitMenu=${r4}`);
    if (r4 === 'menu') {
      await sleep(150);
      await navMenu(page, 1);              // -> ITEM
      await pressKey(page, 'a', 80);
      await waitPhase(page, 'item');
      await shot(page, trace, 'A_item_submenu');
      await pressKey(page, 'b', 90);          // cancel back to menu
      await waitPhase(page, 'menu');
      await shot(page, trace, 'A_item_back_menu');
    }

    // finish the battle with silver attacks; capture key frames each turn
    let turn = 3;
    for (;;) {
      const st = await bstate(page);
      if (st.mode !== 'battle') break;
      if (st.phase === 'done') {
        await shot(page, trace, `A_done`);
        await sleep(700);
        const st2 = await bstate(page);
        if (st2.mode === 'battle') await shot(page, trace, `A_done_late`);
        break;
      }
      if (st.phase === 'menu') {
        if (turn > 14) { await page.evaluate(() => window.__game.debugWinBattle()); await sleep(300); continue; }
        await navMenu(page, 0);            // FIGHT
        await pressKey(page, 'a', 60);
        await waitPhase(page, 'fight');
        await pressKey(page, 'down', 60);   // silver
        await pressKey(page, 'a', 40);
        // capture the whole resolution of this turn incl. faint if it kills
        for (let i = 0; i < 12; i++) {
          await shot(page, trace, `A_turn${turn}_${String(i).padStart(2, '0')}`);
          await sleep(160);
          const s2 = await bstate(page);
          if (s2.mode !== 'battle') break;
          if (s2.phase === 'done') { await shot(page, trace, `A_turn${turn}_done`); break; }
        }
        turn++;
        continue;
      }
      await sleep(180);
    }
    const endMode = await waitBattleEnd(page, { timeout: 20000 });
    log(`A: battle ended mode=${endMode}`);
    await sleep(700);
    await shot(page, trace, 'A_after_battle');
    const rew = await page.evaluate(() => ({
      xp: window.__game.player.xp, lvl: window.__game.player.lvl,
      crowns: window.__game.player.crowns, hp: window.__game.player.hp,
      kills: JSON.parse(JSON.stringify(window.__game.kills)),
      inv: JSON.parse(JSON.stringify(window.__game.inv)),
      mode: window.__game.mode,
    }));
    log(`A: rewards=${JSON.stringify(rew)}`);
    fs.writeFileSync(`${OUT}/trace-A.json`, JSON.stringify({ log: LOG.slice(), trace, rewards: rew }, null, 1));
    await shotElement(page, 'A_element_canvas.png');
  }

  // ==========================================================
  // SCENARIO B — BOSS BATTLE vs LESHEN lvl 8
  // ==========================================================
  {
    const trace = { t0: performance.now(), shots: [] };
    await page.evaluate(() => {
      const p = window.__game.player;
      p.hp = p.maxHp; p.sta = p.maxSta; p.tox = 0;
      // endgame-grade test character so the lvl-8 boss fight can play out
      p.lvl = 8; p.maxHp = 140; p.hp = 140; p.atk = 26; p.def = 12;
    });
    await beginBattle(page, 'leshen', 8, true);
    const track = await page.evaluate(() => (window.__audio ? window.__audio.currentTrack : null));
    log(`B: leshen battle started, music=${track}`);
    await burst(page, trace, 'B_intro', 12, 70);
    await waitPhase(page, 'menu');
    await sleep(250);
    await shot(page, trace, 'B_menu');

    // turn 1: steel attack burst
    await pressKey(page, 'a', 60);
    await waitPhase(page, 'fight');
    await shot(page, trace, 'B_fight_submenu');
    await pressKey(page, 'a', 50);
    const tAtk = performance.now();
    for (let i = 0; i < 32; i++) {
      await shot(page, trace, `B_attack_${String(i).padStart(2, '0')}`, { msAfterAttack: Math.round(performance.now() - tAtk) });
      await sleep(110);
    }
    log('B: attack burst done');

    // turn 2: AARD (shake anim) burst
    let g = 0;
    let st = await bstate(page);
    while (st.phase !== 'menu' && st.mode === 'battle' && g++ < 250) { await sleep(150); st = await bstate(page); }
    await navMenu(page, 2);             // SIGN
    await pressKey(page, 'a', 90);
    await waitPhase(page, 'sign');
    // navigate to AARD (idx 1)
    st = await bstate(page);
    for (let k = 0; k < 6 && st.subIdx !== 1; k++) { await pressKey(page, 'right', 80); st = await bstate(page); }
    await shot(page, trace, 'B_sign_aard_selected');
    await pressKey(page, 'a', 50);
    const tAard = performance.now();
    for (let i = 0; i < 26; i++) {
      await shot(page, trace, `B_aard_${String(i).padStart(2, '0')}`, { msAfterAard: Math.round(performance.now() - tAard) });
      await sleep(110);
    }
    log('B: aard burst done');

    // turn 3: attack + capture counterattack frames (playerhit blink)
    g = 0; st = await bstate(page);
    while (st.phase !== 'menu' && st.mode === 'battle' && g++ < 250) { await sleep(150); st = await bstate(page); }
    if (st.mode !== 'battle') { log('B: battle over before turn 3'); }
    else {
    await navMenu(page, 0);
    await pressKey(page, 'a', 60);
    await waitPhase(page, 'fight');
    await pressKey(page, 'a', 50); // steel
    const tAtk2 = performance.now();
    for (let i = 0; i < 30; i++) {
      await shot(page, trace, `B_attack2_${String(i).padStart(2, '0')}`, { msAfterAttack: Math.round(performance.now() - tAtk2) });
      await sleep(110);
    }
    }

    // let the battle play out (record monster move variety from messages)
    const movesSeen = [];
    let lastMsg = '';
    g = 0;
    for (;;) {
      st = await bstate(page);
      if (st.mode !== 'battle') break;
      if (st.curMsg && st.curMsg !== lastMsg) {
        lastMsg = st.curMsg;
        if (/LESHEN uses/.test(st.curMsg)) movesSeen.push(st.curMsg);
      }
      if (st.phase === 'menu') {
        if (st.php < 25) {
          await navMenu(page, 1);              // -> ITEM
          await pressKey(page, 'a', 80);
          await waitPhase(page, 'item');
          st = await bstate(page);
          if (st.itemIdx === 0) { await pressKey(page, 'a', 60); }
          else { await pressKey(page, 'b', 80); await waitPhase(page, 'menu'); }
        } else {
          await navMenu(page, 0);
          await pressKey(page, 'a', 60);
          await waitPhase(page, 'fight');
          await pressKey(page, 'a', 40);
        }
      }
      await sleep(160);
      if (g++ > 900) { log('B: move-recording guard hit'); break; }
    }
    log(`B: moves seen: ${JSON.stringify(movesSeen)}`);
    const endMode = await waitBattleEnd(page, { timeout: 25000 });
    await sleep(500);
    await shot(page, trace, 'B_after_battle');
    log(`B: battle ended mode=${endMode}`);
    fs.writeFileSync(`${OUT}/trace-B.json`, JSON.stringify({ log: LOG.slice(-40), trace, movesSeen }, null, 1));
  }

  // ==========================================================
  // SCENARIO C — HIGHER-LEVEL MONSTER: ENDREGA lvl 6
  // ==========================================================
  {
    const trace = { t0: performance.now(), shots: [] };
    await page.evaluate(() => {
      const p = window.__game.player;
      p.hp = p.maxHp; p.sta = p.maxSta;
    });
    await beginBattle(page, 'endrega', 6);
    log('C: endrega battle started');
    await burst(page, trace, 'C_intro', 10, 70);
    await waitPhase(page, 'menu');
    await sleep(200);
    await shot(page, trace, 'C_menu');

    // silver attack burst
    await navMenu(page, 0);
    await pressKey(page, 'a', 60);
    await waitPhase(page, 'fight');
    await pressKey(page, 'down', 60);
    await shot(page, trace, 'C_fight_submenu');
    await pressKey(page, 'a', 50);
    const tAtk = performance.now();
    for (let i = 0; i < 30; i++) {
      await shot(page, trace, `C_attack_${String(i).padStart(2, '0')}`, { msAfterAttack: Math.round(performance.now() - tAtk) });
      await sleep(110);
    }
    // second turn burst (counterattack + possible VENOM SPIT poison)
    let g = 0; let st = await bstate(page);
    while (st.phase !== 'menu' && st.mode === 'battle' && g++ < 200) { await sleep(150); st = await bstate(page); }
    await navMenu(page, 0);
    await pressKey(page, 'a', 60);
    await waitPhase(page, 'fight');
    await pressKey(page, 'down', 60);
    await pressKey(page, 'a', 50);
    const tAtk2 = performance.now();
    for (let i = 0; i < 26; i++) {
      await shot(page, trace, `C_attack2_${String(i).padStart(2, '0')}`, { msAfterAttack: Math.round(performance.now() - tAtk2) });
      await sleep(110);
    }
    st = await bstate(page);
    log(`C: poison=${st.poison} php=${st.php}`);
    // resolve via debugWin (clean victory path at lvl 6 for rewards)
    g = 0;
    while (g++ < 120) {
      st = await bstate(page);
      if (st.mode !== 'battle') break;
      if (st.phase === 'menu') { await page.evaluate(() => window.__game.debugWinBattle()); }
      await sleep(200);
    }
    await waitBattleEnd(page, { timeout: 15000 });
    await sleep(500);
    await shot(page, trace, 'C_after_battle');
    fs.writeFileSync(`${OUT}/trace-C.json`, JSON.stringify({ log: LOG.slice(-20), trace }, null, 1));
  }

  // ==========================================================
  // SCENARIO D — DEFEAT (forced: php=1, let monster hit)
  // ==========================================================
  {
    const trace = { t0: performance.now(), shots: [] };
    await page.evaluate(() => {
      const p = window.__game.player;
      p.hp = Math.max(1, p.maxHp); p.sta = p.maxSta;
    });
    await beginBattle(page, 'drowner', 3);
    await waitPhase(page, 'menu');
    await sleep(150);
    await page.evaluate(() => { window.__game.battle.php = 1; });
    await shot(page, trace, 'D_menu_php1');
    await navMenu(page, 0);
    await pressKey(page, 'a', 60);   // FIGHT
    await waitPhase(page, 'fight');
    await pressKey(page, 'a', 50);    // steel -> mon turn -> counter kills
    const tD = performance.now();
    for (let i = 0; i < 26; i++) {
      await shot(page, trace, `D_death_${String(i).padStart(2, '0')}`, { msAfter: Math.round(performance.now() - tD) });
      await sleep(110);
    }
    const mode1 = await waitBattleEnd(page, { timeout: 15000 });
    log(`D: after defeat mode=${mode1}`);
    await sleep(400);
    await shot(page, trace, 'D_gameover');
    await sleep(1200);
    await shot(page, trace, 'D_gameover_late');
    const goState = await page.evaluate(() => ({
      mode: window.__game.mode, gameoverT: Math.round(window.__game.gameoverT || 0),
    }));
    log(`D: gameover state=${JSON.stringify(goState)}`);
    await pressKey(page, 'a', 100);
    await sleep(700);
    await shot(page, trace, 'D_gameover_after_a');
    const m2 = await page.evaluate(() => window.__game.mode);
    log(`D: after A on gameover mode=${m2}`);
    await pressKey(page, 'start', 120);
    await sleep(700);
    const m3 = await page.evaluate(() => window.__game.mode);
    await shot(page, trace, 'D_gameover_after_start');
    log(`D: after START on gameover mode=${m3}`);
    fs.writeFileSync(`${OUT}/trace-D.json`, JSON.stringify({ log: LOG.slice(-20), trace }, null, 1));
  }

  await browser.close();
  fs.writeFileSync(`${OUT}/run-log.json`, JSON.stringify(LOG, null, 1));
  console.log('ALL SCENARIOS DONE');
})().catch((e) => { console.error(e); process.exit(1); });
