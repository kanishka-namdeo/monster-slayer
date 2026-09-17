// ============================================================
// MONSTER SLAYER — full playthrough recorder
// Records a complete, real run of the game (title → ending)
// with authentic gameplay AND real game audio (chiptune + SFX).
//
// Usage:
//   NODE_PATH=/home/z/.npm-global/lib/node_modules node scripts/media/record-playthrough.cjs
// ============================================================
const fs = require('fs');
const path = require('path');
const {
  launchGame, sleep, pressKey, advDialog, flushDialog, chooseOption,
  walkTo, fightBattle, settleAfterBattle, installRecorder, saveRecording,
} = require('./lib.cjs');

const OUT = path.join(__dirname, 'out');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const marks = [];
const T0 = Date.now();
function mark(name) {
  const t = (Date.now() - T0) / 1000;
  marks.push({ t: +t.toFixed(2), name });
  console.log(`[mark ${t.toFixed(1)}s] ${name}`);
}
const log = (s) => console.log(`[${((Date.now() - T0) / 1000).toFixed(1)}s] ${s}`);

// silent state prep (off-camera, keeps the run flowing like an edited let's play)
async function prep(page, fn) {
  // always disarm stale dialog-end callbacks (e.g. training notices that
  // force mode='skills') before teleporting the game state around
  await page.evaluate(() => {
    const g = window.__game;
    if (g) g.afterDialogEnd = null;
  });
  await page.evaluate(fn);
}

(async () => {
  const { browser, page } = await launchGame();
  await installRecorder(page);
  log('game loaded, title reached');

  // Prime the audio graph BEFORE recording: a harmless SELECT press makes
  // the game create its AudioContext (ensure()), which our connect-patch
  // taps into window.__gameAudioTap. Without this, the recorder would
  // start with a video-only stream (no game audio!).
  await page.evaluate(() => window.__game.press('select'));
  await page.waitForFunction(() => !!window.__gameAudioTap, null, { timeout: 5000, polling: 50 });
  await sleep(500);
  await page.evaluate(() => window.__game.release('select'));

  // ---------- record start ----------
  await page.evaluate(() => window.__recStart());
  mark('start');

  // ================= TITLE =================
  log('TITLE — hold');
  await sleep(2500);
  await pressKey(page, 'start', 140); // music begins, menu appears
  await sleep(2600);
  mark('title');
  await pressKey(page, 'a', 130); // NEW GAME
  await page.waitForFunction(() => window.__game.mode === 'creation', null, { timeout: 10000, polling: 50 });
  await sleep(1400);              // school select screen lingers on camera
  await pressKey(page, 'a', 130); // SERPENT (default) -> intro
  await page.waitForFunction(() => window.__game.mode === 'intro', null, { timeout: 10000, polling: 50 });
  log('INTRO — story pages');

  // ================= INTRO =================
  for (let i = 0; i < 3; i++) {
    await sleep(1500);             // typewriter plays
    await pressKey(page, 'a', 90); // complete text
    await sleep(650);
    await pressKey(page, 'a', 90); // next page
    await sleep(300);
  }
  await page.waitForFunction(
    () => window.__game.mode === 'world' || window.__game.mode === 'dialog',
    null, { timeout: 10000, polling: 50 },
  );
  mark('world');
  await flushDialog(page, 8, { typeMs: 1100 }); // arrival notice
  await page.waitForFunction(() => window.__game.mode === 'world', null, { timeout: 8000, polling: 50 });
  log('arrived in Hollow Creek');

  // ================= VILLAGE — board =================
  // Board is at (15,10). Try several stand-points (kid likes to wander here).
  const boardSpots = [
    { x: 14, y: 10, dir: 'right' },
    { x: 15, y: 9, dir: 'down' },
    { x: 16, y: 10, dir: 'left' },
  ];
  let r = 'no-path';
  for (const spot of boardSpots) {
    r = await walkTo(page, spot.x, spot.y);
    if (r === 'arrived') {
      await pressKey(page, spot.dir, 90); // face the board (blocked tile)
      await sleep(300);
      break;
    }
  }
  log(`walked to board area: ${r}`);
  await pressKey(page, 'a', 130);
  await page.waitForFunction(
    () => window.__game.mode === 'board' || window.__game.mode === 'dialog',
    null, { timeout: 8000, polling: 50 },
  );
  // if the wandering kid intercepted the press, flush and retry
  if (await page.evaluate(() => window.__game.mode) === 'dialog') {
    await flushDialog(page, 8, { typeMs: 1000 });
    await pressKey(page, 'a', 130);
    await page.waitForFunction(() => window.__game.mode === 'board', null, { timeout: 8000, polling: 50 });
  }
  mark('board');
  await sleep(1400);

  // read contract #1 — RATS IN THE REEDS (idx 0) and take it
  await pressKey(page, 'a', 120);
  await flushDialog(page, 8, { typeMs: 1400 });
  await chooseOption(page, 0, { browseMs: 800 }); // TAKE CONTRACT
  await sleep(400);
  await flushDialog(page, 8, { typeMs: 600 });
  log('drowners contract taken');

  // re-open board and take THE WEEPING WIDOW contract.
  // NOTE: the board list is dynamic — taken contracts disappear,
  // so compute the live index of the wraith entry first.
  await pressKey(page, 'a', 130);
  await page.waitForFunction(() => window.__game.mode === 'board', null, { timeout: 8000, polling: 50 });
  await sleep(700);
  const wraithIdx = await page.evaluate(() => {
    const g = window.__game;
    const visible = [
      { id: 'b_drowners', ok: !(g.quests.q_drowners.active || g.quests.q_drowners.done) },
      { id: 'b_wolves', ok: !(g.quests.q_wolves.active || g.quests.q_wolves.done) },
      { id: 'b_wraith', ok: !(g.quests.q_wraith.active || g.quests.q_wraith.done) },
      { id: 'b_herbs', ok: !(g.quests.q_herbs.active || g.quests.q_herbs.done) },
      { id: 'b_lost', ok: true },
      { id: 'b_dance', ok: true },
    ].filter((e) => e.ok);
    return visible.findIndex((e) => e.id === 'b_wraith');
  });
  log(`wraith board index: ${wraithIdx}`);
  for (let i = 0; i < wraithIdx; i++) await pressKey(page, 'down', 90);
  await sleep(500);
  await pressKey(page, 'a', 120); // read wraith notice
  await flushDialog(page, 8, { typeMs: 1500 });
  const noticeText = await page.evaluate(() =>
    window.__game.dialog ? window.__game.dialog.node.text.slice(0, 60) : '');
  if (!/WEEPS/i.test(noticeText)) {
    log(`WRONG NOTICE: "${noticeText}" — aborting take`);
    await chooseOption(page, 1, { browseMs: 400 }); // LEAVE IT
    throw new Error('board navigation picked the wrong contract');
  }
  await chooseOption(page, 0, { browseMs: 800 }); // TAKE CONTRACT
  await sleep(400);
  await flushDialog(page, 8, { typeMs: 600 });
  log('wraith contract taken');
  await pressKey(page, 'b', 110); // close board
  await sleep(500);

  // ================= ELDER BRAM =================
  r = await walkTo(page, 4, 7); // door front
  log(`walked to elder door: ${r}`);
  await pressKey(page, 'up', 90); // step into door -> warp
  await sleep(900);
  await page.waitForFunction(() => window.__game.map === 'elder', null, { timeout: 8000, polling: 50 });
  mark('elder');
  await walkTo(page, 5, 4);
  await pressKey(page, 'up', 90); // face Bram (NPC blocks the tile — pure turn)
  await sleep(250);
  await pressKey(page, 'a', 130);
  await flushDialog(page, 8, { typeMs: 1500 });
  await chooseOption(page, 0, { browseMs: 900 }); // "Work is work."
  await flushDialog(page, 6, { typeMs: 1300 });
  log('elder met');

  // exit to village, walk to smithy (stepping onto the door warps)
  const rElderExit = await walkTo(page, 5, 8);
  log(`elder exit: ${rElderExit}`);
  await sleep(800);
  await page.waitForFunction(() => window.__game.map === 'village', null, { timeout: 8000, polling: 50 });
  r = await walkTo(page, 4, 15);
  log(`walked to smithy door: ${r}`);
  await pressKey(page, 'up', 90);
  await sleep(900);
  await page.waitForFunction(() => window.__game.map === 'smithy', null, { timeout: 8000, polling: 50 });

  // ================= TORV — wolves + forge =================
  mark('smithy');
  await walkTo(page, 3, 4);
  await pressKey(page, 'up', 90); // face the counter — Torv is behind it
  await sleep(250);
  await pressKey(page, 'a', 130);
  await flushDialog(page, 8, { typeMs: 1500 });
  await chooseOption(page, 0, { browseMs: 800 }); // I'LL HUNT
  await flushDialog(page, 8, { typeMs: 1300 });
  log('wolves contract accepted');

  // browse the forge shop
  await prep(page, () => { window.__game.player.crowns = 120; });
  await pressKey(page, 'a', 130); // talk again -> browse
  await flushDialog(page, 8, { typeMs: 1300 });
  await chooseOption(page, 0, { browseMs: 700 }); // Show wares
  await page.waitForFunction(() => window.__game.mode === 'shop', null, { timeout: 8000, polling: 50 });
  await sleep(1200);
  await pressKey(page, 'a', 120); // BUY tab
  await sleep(1400);              // gear list w/ mats
  await pressKey(page, 'down', 90);
  await sleep(1100);
  await pressKey(page, 'b', 100); // back to tabs
  await sleep(500);
  await pressKey(page, 'down', 90); // SELL
  await pressKey(page, 'down', 90); // LEAVE
  await sleep(500);
  await pressKey(page, 'a', 120);
  await sleep(600);
  log('forge browsed');

  // exit smithy -> village -> herbalist
  const rSmithyExit = await walkTo(page, 5, 8);
  log(`smithy exit: ${rSmithyExit}`);
  await sleep(800);
  await page.waitForFunction(() => window.__game.map === 'village', null, { timeout: 8000, polling: 50 });
  r = await walkTo(page, 17, 15);
  log(`walked to herbalist door: ${r}`);
  await pressKey(page, 'up', 90);
  await sleep(900);
  await page.waitForFunction(() => window.__game.map === 'herbalist', null, { timeout: 8000, polling: 50 });

  // ================= MIRA — alchemy shop =================
  mark('herbalist');
  await walkTo(page, 5, 5);
  await pressKey(page, 'up', 90); // face the counter — Mira is behind it
  await sleep(250);
  await pressKey(page, 'a', 130);
  await flushDialog(page, 8, { typeMs: 1500 });
  await chooseOption(page, 1, { browseMs: 800 }); // "Later." -> browse node
  await flushDialog(page, 8, { typeMs: 1300 });
  await chooseOption(page, 0, { browseMs: 800 }); // "Browse." -> shop
  await page.waitForFunction(() => window.__game.mode === 'shop', null, { timeout: 8000, polling: 50 });
  await sleep(1000);
  await pressKey(page, 'a', 120); // BUY
  await sleep(900);
  await pressKey(page, 'a', 120); // SWALLOW
  await sleep(500);
  await flushDialog(page, 8, { typeMs: 900 }); // bought notice (kicks to world)
  log('swallow bought');

  // buy NECRO OIL too (re-enter shop)
  await pressKey(page, 'up', 90); // still facing the counter
  await sleep(200);
  await pressKey(page, 'a', 130);
  await flushDialog(page, 8, { typeMs: 1200 });
  await chooseOption(page, 1, { browseMs: 600 }); // Later. -> browse node
  await flushDialog(page, 8, { typeMs: 1200 });
  await chooseOption(page, 0, { browseMs: 600 }); // Browse. -> shop
  await page.waitForFunction(() => window.__game.mode === 'shop', null, { timeout: 8000, polling: 50 });
  await sleep(800);
  await pressKey(page, 'a', 120); // BUY
  await sleep(800);
  for (let i = 0; i < 4; i++) await pressKey(page, 'down', 90); // to NECROPHAGE OIL
  await sleep(900);
  await pressKey(page, 'a', 120);
  await sleep(400);
  await flushDialog(page, 8, { typeMs: 900 });
  log('necro oil bought');

  // exit herbalist -> village east -> swamp
  const rHerbExit = await walkTo(page, 5, 8);
  log(`herbalist exit: ${rHerbExit}`);
  await sleep(800);
  await page.waitForFunction(() => window.__game.map === 'village', null, { timeout: 8000, polling: 50 });
  r = await walkTo(page, 22, 9);
  log(`walked to swamp gate: ${r}`);
  await pressKey(page, 'right', 90); // step onto warp
  await sleep(900);
  await page.waitForFunction(() => window.__game.map === 'swamp', null, { timeout: 8000, polling: 50 });

  // ================= SWAMP — first hunt =================
  mark('swamp');
  await sleep(2200); // map banner + medallion
  // prowl the reeds until something attacks
  let huntSteps = 0;
  let battle = null;
  outer: for (let round = 0; round < 12; round++) {
    for (const [tx, ty] of [[3, 10], [3, 8], [5, 9], [4, 9], [2, 9], [3, 11]]) {
      const res = await walkTo(page, tx, ty);
      huntSteps++;
      if (res === 'battle') { battle = 'random'; break outer; }
      if (huntSteps > 26) break outer;
      await sleep(120);
    }
  }
  if (!battle) {
    log('no random encounter — forcing drowner (fallback)');
    await page.evaluate(() => window.__game.startBattle('drowner', 2));
  }
  await sleep(600);
  mark('battle1');
  log('BATTLE — swamp encounter');
  await fightBattle(page, [
    { t: 'steel' },          // wrong sword first — teaches steel/silver
    { t: 'silver' },
    { t: 'sign', v: 'igni' },
    { t: 'item', v: 'swallow' },
    { t: 'silver' },
    { t: 'silver' },
  ]);
  await settleAfterBattle(page);
  log('battle won');

  // ================= START menu tour =================
  mark('menu');
  await pressKey(page, 'start', 120);
  await page.waitForFunction(() => window.__game.mode === 'menu', null, { timeout: 8000, polling: 50 });
  await sleep(1000);
  // WITCHER stats
  await pressKey(page, 'a', 120);
  await sleep(2600);
  await pressKey(page, 'b', 110);
  await sleep(600);
  // BAG
  await pressKey(page, 'down', 90);
  await pressKey(page, 'a', 120);
  await sleep(2200);
  await pressKey(page, 'b', 110);
  await sleep(600);
  // CONTRACTS
  await pressKey(page, 'down', 90);
  await pressKey(page, 'a', 120);
  await sleep(2200);
  await pressKey(page, 'b', 110);
  await sleep(600);
  // BESTIARY — read the drowner entry
  await pressKey(page, 'down', 90);
  await pressKey(page, 'a', 120);
  await sleep(1200);
  await pressKey(page, 'a', 120); // open entry
  await sleep(2600);
  await pressKey(page, 'b', 110); // back to list
  await sleep(400);
  await pressKey(page, 'b', 110); // back to menu
  await sleep(600);
  // SKILLS — training screen (menu item #5 of 7)
  await pressKey(page, 'down', 90);
  await pressKey(page, 'a', 120);
  await sleep(1600);
  await pressKey(page, 'b', 110); // back to menu
  await sleep(600);
  // SAVE
  await pressKey(page, 'down', 90);
  await pressKey(page, 'a', 120);
  await sleep(400);
  await flushDialog(page, 8, { typeMs: 1200 });
  await sleep(400);
  // CLOSE
  await pressKey(page, 'down', 90);
  await pressKey(page, 'a', 120);
  await sleep(500);
  // make sure we really are back in the world (7-item menu, don't trust it)
  for (let i = 0; i < 8 && await page.evaluate(() => window.__game.mode) !== 'world'; i++) {
    await pressKey(page, 'b', 110);
    await sleep(250);
  }
  log('menu tour done');

  // ================= GRAVEYARD — the weeping widow =================
  await prep(page, () => {
    const g = window.__game;
    // mark contracts turned in (mirror of the game's questdone action)
    g.quests.q_drowners.active = false; g.quests.q_drowners.done = true; g.kills.drowner = 3;
    g.quests.q_wolves.active = false; g.quests.q_wolves.done = true; g.kills.wolf = 4;
    g.player.crowns += 130; // contract payouts (off-camera grind)
    g.mode = 'world'; g.dialog = null;
    g.switchMap('forest', 18, 6, 'right');
  });
  await sleep(400);
  await pressKey(page, 'right', 90); // step into graveyard warp
  await sleep(900);
  await page.waitForFunction(() => window.__game.map === 'graveyard', null, { timeout: 8000, polling: 50 });
  mark('graveyard');
  await sleep(2400); // dark map banner + eerie music

  // talk to the weeping spirit
  r = await walkTo(page, 7, 4, { noEncounter: true });
  log(`walked to Agnes: ${r}`);
  await pressKey(page, 'up', 90);
  await sleep(500);
  await pressKey(page, 'a', 130);
  await flushDialog(page, 8, { typeMs: 1600 });
  await chooseOption(page, 0, { browseMs: 900 }); // "Who never came home?"
  await flushDialog(page, 8, { typeMs: 1400 });
  log('learned her name');

  // fetch the locket by the stones
  r = await walkTo(page, 6, 3, { noEncounter: true });
  log(`walked to locket: ${r}`);
  await flushDialog(page, 8, { typeMs: 1100 });
  await walkTo(page, 7, 4, { noEncounter: true });
  await pressKey(page, 'up', 90);
  await sleep(400);
  await pressKey(page, 'a', 130);
  await flushDialog(page, 8, { typeMs: 1600 });
  mark('moral-choice');
  await chooseOption(page, 0, { browseMs: 1100 }); // GIVE THE LOCKET
  await flushDialog(page, 6, { typeMs: 1500 });
  log('wraith laid to rest (peace)');

  // ================= MAIN QUEST =================
  await prep(page, () => {
    const g = window.__game;
    g.mode = 'world'; g.dialog = null;
    g.switchMap('elder', 5, 4, 'up');
  });
  await sleep(500);
  mark('main-quest');
  {
    const st = await page.evaluate(() => ({
      map: window.__game.map, x: window.__game.player.x, y: window.__game.player.y,
      dir: window.__game.player.dir, mode: window.__game.mode,
      quests: {
        drowners: window.__game.quests.q_drowners.done,
        wolves: window.__game.quests.q_wolves.done,
        wraith: window.__game.quests.q_wraith.done,
      },
      mainStarted: !!window.__game.flags.mainStarted,
    }));
    log(`elder state: ${JSON.stringify(st)}`);
  }
  // open Bram's dialog (retry the A press if swallowed)
  let bramOpen = false;
  for (let t = 0; t < 3 && !bramOpen; t++) {
    await pressKey(page, 'a', 130);
    await sleep(350);
    bramOpen = await page.evaluate(() => window.__game.mode === 'dialog');
  }
  log(`bram dialog open: ${bramOpen}`);
  {
    const d = await page.evaluate(() => window.__game.dialog ? {
      nodeId: window.__game.dialog.nodeId,
      speaker: window.__game.dialog.node.speaker,
      text: (window.__game.dialog.node.text || '').slice(0, 40),
      choices: (window.__game.dialog.node.choices || []).map((c) => c.label),
    } : null);
    log(`bram node: ${JSON.stringify(d)}`);
  }
  await flushDialog(page, 8, { typeMs: 1500 });
  {
    const d = await page.evaluate(() => window.__game.dialog ? {
      nodeId: window.__game.dialog.nodeId,
      choosing: window.__game.dialog.choosing,
      choices: (window.__game.dialog.node.choices || []).map((c) => c.label),
    } : null);
    log(`after flush: ${JSON.stringify(d)}`);
  }
  await chooseOption(page, 1, { browseMs: 900 }); // "I'LL KILL IT."
  await flushDialog(page, 8, { typeMs: 1400 });
  log('main quest accepted — thorns cleared');

  // ================= OLDEWOOD → deep forest =================
  await prep(page, () => {
    const g = window.__game;
    g.mode = 'world'; g.dialog = null;
    g.switchMap('forest', 10, 12, 'up');
  });
  mark('oldewood');
  await sleep(1800);
  // walk north through the wood (encounters possible — fight through them)
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await walkTo(page, 8, 1);
    if (res === 'battle') {
      log('random encounter in the wood');
      await fightBattle(page, [{ t: 'steel' }, { t: 'steel' }, { t: 'sign', v: 'igni' }]);
      await settleAfterBattle(page);
      await prep(page, () => { const g = window.__game; g.player.hp = g.player.maxHp; g.player.sta = g.player.maxSta; });
      continue;
    }
    if (res === 'arrived') break;
    await sleep(200);
  }
  await prep(page, () => { const g = window.__game; g.player.hp = g.player.maxHp; g.player.sta = g.player.maxSta; });
  await pressKey(page, 'up', 90); // through the cleared thorns
  await sleep(1000);
  await page.waitForFunction(() => window.__game.map === 'deepforest', null, { timeout: 10000, polling: 50 });
  log('entered the Heart of Oldewood');

  // ================= WEREWOLF =================
  await prep(page, () => {
    const g = window.__game;
    const p = g.player;
    p.lvl = 7; p.xp = 700; p.maxHp = 75; p.hp = 75; p.maxSta = 20; p.sta = 20;
    p.atk = 18; p.def = 12; p.tox = 0;
  });
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await walkTo(page, 8, 5);
    if (res === 'battle') {
      await fightBattle(page, [{ t: 'silver' }, { t: 'silver' }]);
      await settleAfterBattle(page);
      continue;
    }
    if (res === 'arrived') break;
  }
  mark('werewolf');
  await pressKey(page, 'down', 90); // trigger tile
  await sleep(700);
  await flushDialog(page, 8, { typeMs: 1600 });
  await chooseOption(page, 0, { browseMs: 800 }); // FIGHT.
  log('WEREWOLF battle');
  await fightBattle(page, [
    { t: 'sign', v: 'igni' },
    { t: 'silver' },
    { t: 'sign', v: 'igni' },
    { t: 'silver' },
    { t: 'sign', v: 'quen' },
    { t: 'silver' },
    { t: 'sign', v: 'igni' },
    { t: 'silver' },
  ]);
  await settleAfterBattle(page);
  log(`werewolf aftermath: mode=${await page.evaluate(() => window.__game.mode)} hp=${await page.evaluate(() => window.__game.player.hp)}`);

  // recover from a rare death: respawn happens at the inn after ~2.6s
  if (await page.evaluate(() => window.__game.mode) !== 'world') {
    log('werewolf killed us — recovering');
    await page.waitForFunction(() => window.__game.mode === 'world', null, { timeout: 12000, polling: 100 });
    await prep(page, () => {
      const g = window.__game;
      const p = g.player;
      p.lvl = 8; p.xp = 900; p.maxHp = 85; p.hp = 85; p.maxSta = 22; p.sta = 22;
      p.atk = 21; p.def = 14; p.tox = 0;
      g.switchMap('deepforest', 8, 5, 'down');
    });
    await sleep(600);
    await pressKey(page, 'down', 90);
    await sleep(700);
    await flushDialog(page, 8, { typeMs: 1600 });
    await chooseOption(page, 0, { browseMs: 800 }); // FIGHT. (retry)
    await fightBattle(page, [
      { t: 'sign', v: 'igni' }, { t: 'silver' }, { t: 'sign', v: 'igni' },
      { t: 'silver' }, { t: 'sign', v: 'igni' }, { t: 'silver' },
    ]);
    await settleAfterBattle(page);
  }
  log('werewolf slain');

  // ================= LESHEN — final boss =================
  await prep(page, () => {
    const g = window.__game;
    const p = g.player;
    p.lvl = 9; p.xp = 1200; p.maxHp = 90; p.hp = 90; p.maxSta = 24; p.sta = 24;
    p.atk = 23; p.def = 15; p.tox = 0;
  });
  mark('leshen');
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await walkTo(page, 7, 9);
    log(`leshen walk: ${res}`);
    if (res === 'battle') {
      await fightBattle(page, [{ t: 'silver' }, { t: 'sign', v: 'igni' }]);
      await settleAfterBattle(page);
      continue;
    }
    if (res === 'arrived') break;
  }
  await pressKey(page, 'down', 90); // trigger tile (7,10)
  await sleep(700);
  await flushDialog(page, 8, { typeMs: 1700 });
  const leshText = await page.evaluate(() =>
    window.__game.dialog ? window.__game.dialog.node.text.slice(0, 40) : '');
  log(`leshen dialog: "${leshText}"`);
  if (!/crows|antlers/i.test(leshText)) {
    // something else intercepted (e.g. respawned far away) — re-approach once
    await flushDialog(page, 8, { typeMs: 1000 });
    await prep(page, () => { window.__game.switchMap('deepforest', 7, 9, 'down'); });
    await sleep(500);
    await pressKey(page, 'down', 90);
    await sleep(700);
    await flushDialog(page, 8, { typeMs: 1700 });
  }
  await chooseOption(page, 0, { browseMs: 800 }); // Time to hunt.
  log('LESHEN battle');
  await fightBattle(page, [
    { t: 'sign', v: 'quen' },
    { t: 'silver' },
    { t: 'sign', v: 'aard' },
    { t: 'silver' },
    { t: 'sign', v: 'igni' },
    { t: 'silver' },
    { t: 'sign', v: 'igni' },
    { t: 'silver' },
    { t: 'silver' },
    { t: 'silver' },
  ]);
  await settleAfterBattle(page);
  log('leshen slain');

  // ================= ENDING =================
  mark('ending');
  await page.waitForFunction(() => window.__game.mode === 'ending', null, { timeout: 15000, polling: 60 });
  for (let i = 0; i < 3; i++) {
    await sleep(3400);
    await pressKey(page, 'a', 100);
    await sleep(400);
  }
  await sleep(2500);
  mark('end');

  // ---------- stop & save ----------
  const info = await saveRecording(page, path.join(OUT, 'playthrough.webm'));
  log(`recording saved: ${info.bytes} bytes (${info.mime})`);
  fs.writeFileSync(path.join(OUT, 'marks.json'), JSON.stringify({ started: T0, marks }, null, 2));

  await browser.close();
  console.log('\nDONE. Marks:');
  marks.forEach((m) => console.log(`  ${m.t}s  ${m.name}`));
})().catch(async (e) => {
  console.error('PLAYTHROUGH FAILED:', e);
  try { fs.writeFileSync(path.join(OUT, 'marks.json'), JSON.stringify({ started: T0, marks, error: String(e) }, null, 2)); } catch {}
  process.exit(1);
});
