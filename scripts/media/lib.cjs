// ============================================================
// Shared game-automation + recording library (Playwright)
// Drives the real game through window.__game — same code paths
// a player's button presses take.
// ============================================================
const { chromium } = require('playwright');

const GAME_URL = 'http://localhost:3000';

// Page-realm script: mirror the game's master audio gain into a
// MediaStreamDestination so MediaRecorder can capture real game audio.
const AUDIO_TAP_INIT = `
(() => {
  const origConnect = AudioNode.prototype.connect;
  let tapDest = null;
  let tapCtx = null;
  AudioNode.prototype.connect = function (destination, ...args) {
    try {
      if (destination && destination instanceof AudioDestinationNode) {
        if (!tapCtx || tapCtx !== destination.context) {
          tapCtx = destination.context;
          tapDest = tapCtx.createMediaStreamDestination();
          window.__gameAudioTap = tapDest.stream;
        }
        origConnect.call(this, tapDest, 0, 0);
      }
    } catch (e) { /* never break gameplay */ }
    return origConnect.call(this, destination, ...args);
  };
})();
`;

async function launchGame() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--autoplay-policy=no-user-gesture-required'],
  });
  const page = await browser.newPage({ viewport: { width: 480, height: 900 } });
  await page.addInitScript(AUDIO_TAP_INIT);
  await page.goto(GAME_URL, { waitUntil: 'load' });
  await page.waitForFunction(
    () => window.__game && window.__game.mode === 'title',
    null,
    { timeout: 30000, polling: 50 },
  );
  return { browser, page };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function pressKey(page, btn, ms = 100) {
  await page.evaluate((b) => window.__game.press(b), btn);
  await sleep(ms);
  await page.evaluate((b) => window.__game.release(b), btn);
  await sleep(90);
}

// -------- dialog helpers --------
// Completes the current dialog text. If the node has choices, stops there
// (returns 'choosing') instead of pressing A (which would auto-select).
// Pagination-aware: presses A through every page of the current node.
async function advDialog(page, { typeMs = null, timeout = 15000 } = {}) {
  try {
    await page.waitForFunction(() => !!window.__game.dialog, null, { timeout, polling: 40 });
  } catch { return false; }
  for (let i = 0; i < 24; i++) {
    const st = await page.evaluate(() => {
      const d = window.__game.dialog;
      if (!d) return 'gone';
      return d.choosing ? 'choosing' : 'text';
    });
    if (st === 'gone') return true;
    if (st === 'choosing') return 'choosing';
    const len = await page.evaluate(() =>
      window.__game.dialog ? (window.__game.dialog.node.text || '').length : 0);
    const wait = typeMs !== null ? typeMs : Math.min(1200, 250 + len * 8);
    await sleep(wait);
    await page.evaluate(() => { if (window.__game.dialog) window.__game.dialog.charIdx = 1e9; });
    await sleep(220);
    await page.evaluate(() => window.__game.press('a'));
    await sleep(120);
    await page.evaluate(() => window.__game.release('a'));
    await sleep(150);
  }
  return true;
}

// Advance until the dialog is gone (or a choice appears).
async function flushDialog(page, max = 16, { typeMs = null } = {}) {
  for (let i = 0; i < max; i++) {
    const st = await page.evaluate(() => {
      const d = window.__game.dialog;
      if (!d) return 'gone';
      return d.choosing ? 'choosing' : 'text';
    });
    if (st === 'gone') return 'gone';
    if (st === 'choosing') return 'choosing';
    await advDialog(page, { typeMs });
  }
  return 'timeout';
}

// Complete text, move cursor to choice idx with real presses, confirm.
// Verifies the real in-game cursor after each press (recording load can
// swallow inputs) and retries until the selection is confirmed.
async function chooseOption(page, idx, { browseMs = 650 } = {}) {
  await page.waitForFunction(() => {
    const d = window.__game.dialog;
    return d && d.choosing;
  }, null, { timeout: 8000, polling: 40 });
  const startNodeId = await page.evaluate(() => window.__game.dialog.nodeId);
  await page.evaluate(() => { if (window.__game.dialog) window.__game.dialog.charIdx = 1e9; });
  await sleep(browseMs);

  const readCur = () => page.evaluate(() => (window.__game.dialog ? window.__game.dialog.choiceIdx : -1));
  const n = await page.evaluate(() => {
    const d = window.__game.dialog;
    return d.node.choices.filter((c) => window.__game.checkCond(c.cond)).length;
  });
  const target = ((idx % n) + n) % n;
  if (process.env.MEDIA_DEBUG) console.log(`    [choose] node=${startNodeId} want=${target} of ${n}`);

  // navigate with verification
  for (let guard = 0; guard < 10; guard++) {
    const cur = await readCur();
    if (process.env.MEDIA_DEBUG) console.log(`    [choose] cur=${cur}`);
    if (cur === target) break;
    await pressKey(page, 'down', 110);
  }

  // press A and verify the selection actually took effect
  for (let guard = 0; guard < 4; guard++) {
    await sleep(150);
    await pressKey(page, 'a', 100);
    await sleep(220);
    const st = await page.evaluate(() => ({
      mode: window.__game.mode,
      nodeId: window.__game.dialog ? window.__game.dialog.nodeId : null,
      choosing: window.__game.dialog ? window.__game.dialog.choosing : false,
    }));
    if (process.env.MEDIA_DEBUG) console.log(`    [choose] after A #${guard}: ${JSON.stringify(st)}`);
    if (st.mode !== 'dialog' || st.nodeId !== startNodeId || !st.choosing) {
      return; // choice consumed — dialog advanced or closed
    }
  }
}

// -------- world movement: BFS pathfinding inside the page --------
// NOTE: must be passed as a real function (not a string) — Playwright
// only auto-invokes function-typed sources with args.
function bfsStep(t) {
  const g = window.__game;
  const rows = g.mapDef.rows;
  const H = rows.length, W = rows[0].length;
  const BLOCKED = new Set('TPfWwreuALKsctBbGgSz qL o~v#C'.split('').filter(c => c !== ' '));
  const blocked = (x, y) => {
    if (y < 0 || y >= H || x < 0 || x >= W) return true;
    const tch = rows[y][x];
    if (tch === undefined || BLOCKED.has(tch)) return true;
    if (g.npcAt(x, y)) return true;
    return false;
  };
  const start = g.player.x + ',' + g.player.y;
  const q = [[g.player.x, g.player.y]];
  const prev = new Map([[start, null]]);
  while (q.length) {
    const [cx, cy] = q.shift();
    if (cx === t.x && cy === t.y) {
      let cur = cx + ',' + cy, par = prev.get(cur);
      if (par === null) return { dir: null, dist: 0 };
      while (prev.get(par) !== null) { cur = par; par = prev.get(par); }
      const [fx, fy] = cur.split(',').map(Number);
      const dx = fx - g.player.x, dy = fy - g.player.y;
      return { dir: dx === 1 ? 'right' : dx === -1 ? 'left' : dy === 1 ? 'down' : 'up', dist: 0 };
    }
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      const nx = cx + dx, ny = cy + dy;
      const k = nx + ',' + ny;
      if (prev.has(k) || blocked(nx, ny)) continue;
      prev.set(k, cx + ',' + cy);
      q.push([nx, ny]);
    }
  }
  return { dir: null, dist: -1 };
}

// Walk to (tx,ty) on the current map, one tile at a time via real held input.
// Retries transient no-path situations (wandering NPCs) before giving up.
// Returns: 'arrived' | 'warped' (map changed) | 'battle' | 'no-path' | 'timeout'
async function walkTo(page, tx, ty, { run = false, maxSteps = 90, retries = 5 } = {}) {
  for (let retry = 0; retry < retries; retry++) {
    const res = await walkToOnce(page, tx, ty, { run, maxSteps });
    if (res !== 'no-path') return res;
    await sleep(650); // let NPCs wander off the path
  }
  return 'no-path';
}

async function walkToOnce(page, tx, ty, { run = false, maxSteps = 90 } = {}) {
  const startMap = await page.evaluate(() => window.__game.map);
  for (let i = 0; i < maxSteps; i++) {
    const st = await page.evaluate(() => ({
      x: window.__game.player.x, y: window.__game.player.y,
      mode: window.__game.mode, map: window.__game.map, moving: window.__game.moving,
    }));
    if (st.mode !== 'world') return st.mode === 'battle' ? 'battle' : 'mode:' + st.mode;
    if (st.map !== startMap) return 'warped';
    if (st.x === tx && st.y === ty) return 'arrived';
    if (st.moving) { await sleep(60); continue; }

    const step = await page.evaluate(bfsStep, { x: tx, y: ty });
    if (!step || !step.dir) return 'no-path';

    // Press, wait for the step to START, then release immediately —
    // steps self-complete once started, and holding past completion
    // would chain into an unintended extra tile (doors!).
    if (run) await page.evaluate(() => window.__game.press('b'));
    await page.evaluate((d) => window.__game.press(d), step.dir);
    let started = false;
    let t0 = Date.now();
    while (Date.now() - t0 < 700) {
      await sleep(15);
      const now = await page.evaluate(() => ({
        moving: window.__game.moving, mode: window.__game.mode, map: window.__game.map,
      }));
      if (now.mode !== 'world') {
        await page.evaluate((d) => window.__game.release(d), step.dir);
        if (run) await page.evaluate(() => window.__game.release('b'));
        return now.mode === 'battle' ? 'battle' : 'mode:' + now.mode;
      }
      if (now.moving) { started = true; break; }
    }
    await page.evaluate((d) => window.__game.release(d), step.dir);
    if (run) await page.evaluate(() => window.__game.release('b'));
    if (!started) { await sleep(70); continue; } // blocked tile — only turned

    // wait for the step to complete (warp / encounter may fire here)
    t0 = Date.now();
    while (Date.now() - t0 < 1200) {
      await sleep(20);
      const now = await page.evaluate(() => ({
        moving: window.__game.moving, mode: window.__game.mode, map: window.__game.map,
      }));
      if (now.mode !== 'world') {
        return now.mode === 'battle' ? 'battle' : 'mode:' + now.mode;
      }
      if (now.map !== startMap) return 'warped';
      if (!now.moving) break;
    }
    await sleep(70);
  }
  return 'timeout';
}

// Face a direction by tapping it against an obstacle-free approach:
// if tapping would move, this still moves one tile — use faceOnly when
// standing against a blocked tile (NPC/wall) in that direction.
async function face(page, dir) {
  await pressKey(page, dir, 90);
}

// -------- battle driver --------
// script: list of actions
//   {t:'steel'} {t:'silver'} {t:'sign', v:'igni'|'aard'|'quen'|'axii'} {t:'item', v:'swallow'|...}
// After the script is exhausted, defaults to 'silver'.
async function fightBattle(page, script, { turnCap = 30 } = {}) {
  await page.waitForFunction(() => window.__game.mode === 'battle', null, { timeout: 15000, polling: 40 });
  let si = 0;
  let turns = 0;
  let pending = null;
  const t0 = Date.now();
  while (Date.now() - t0 < 300000) {
    const st = await page.evaluate(() => {
      const g = window.__game;
      const b = g.battle;
      if (!b) return { mode: g.mode };
      return {
        mode: g.mode, phase: b.phase, menuIdx: b.menuIdx, subIdx: b.subIdx, itemIdx: b.itemIdx,
        monHp: b.monHp, php: b.php, psta: b.psta, mon: b.monName, done: b.doneResult,
      };
    });
    if (st.mode !== 'battle' || !st.phase) return 'ended';
    if (st.phase === 'intro') { await sleep(150); continue; }
    if (st.phase === 'done') { await sleep(150); continue; }

    if (st.phase === 'msg') {
      // messages auto-advance (typing + 480ms hold) — just let them play
      await sleep(220);
      continue;
    }

    if (st.phase === 'menu') {
      if (turns >= turnCap) {
        await page.evaluate(() => window.__game.debugWinBattle());
        turns++;
        await sleep(200);
        continue;
      }
      pending = script[Math.min(si, script.length - 1)] || { t: 'silver' };
      si++; turns++;
      const target = pending.t === 'sign' ? 2 : pending.t === 'item' ? 1 : 0;
      if ((st.menuIdx & 1) !== (target & 1)) await pressKey(page, (target & 1) ? 'right' : 'left', 90);
      if ((st.menuIdx & 2) !== (target & 2)) await pressKey(page, (target & 2) ? 'down' : 'up', 90);
      await sleep(130);
      await pressKey(page, 'a', 90);
      await sleep(200);
      continue;
    }

    if (st.phase === 'fight') {
      const want = pending && pending.t === 'steel' ? 0 : 1;
      if (st.subIdx !== want) await pressKey(page, 'down', 90);
      await sleep(120);
      await pressKey(page, 'a', 90);
      await sleep(190);
      continue;
    }

    if (st.phase === 'sign') {
      const order = ['igni', 'aard', 'quen', 'axii'];
      const want = Math.max(0, order.indexOf(pending && pending.v));
      let pos = st.subIdx;
      let guard = 0;
      while (pos !== want && guard++ < 6) { await pressKey(page, 'down', 90); pos = (pos + 1) % 5; }
      await sleep(120);
      await pressKey(page, 'a', 90);
      await sleep(190);
      continue;
    }

    if (st.phase === 'item') {
      const { wantIdx, n } = await page.evaluate((id) => {
        const b = window.__game.battle;
        const list = b.battleItemList();
        return { wantIdx: Math.max(0, list.findIndex((x) => x.id === id)), n: list.length + 1 };
      }, (pending && pending.v) || 'swallow');
      let pos = st.itemIdx;
      let guard = 0;
      while (pos !== wantIdx && guard++ < 10) { await pressKey(page, 'down', 90); pos = (pos + 1) % n; }
      await sleep(120);
      await pressKey(page, 'a', 90);
      await sleep(190);
      continue;
    }
    await sleep(120);
  }
  return 'timeout';
}

// Wait for a battle to be over and flush post-battle notices.
async function settleAfterBattle(page, { timeout = 60000 } = {}) {
  await page.waitForFunction(() => window.__game.mode !== 'battle', null, { timeout, polling: 60 });
  await sleep(400);
  await flushDialog(page, 8, { typeMs: 900 });
  await sleep(250);
}

// -------- recorder (canvas x4 nearest-neighbor + real game audio) --------
async function installRecorder(page) {
  await page.exposeFunction('__nodeSaveChunk', async (idx, b64) => {
    if (!page.__recChunks) page.__recChunks = [];
    page.__recChunks[idx] = b64;
  });

  await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const rec = document.createElement('canvas');
    rec.width = 640; rec.height = 576;
    const rctx = rec.getContext('2d');
    rctx.imageSmoothingEnabled = false;
    const draw = () => { rctx.drawImage(canvas, 0, 0, 640, 576); requestAnimationFrame(draw); };
    draw();

    window.__recState = { chunks: [], stopped: false };
    window.__recStart = () => {
      const vstream = rec.captureStream(30);
      const tracks = [...vstream.getVideoTracks()];
      if (window.__gameAudioTap) tracks.push(...window.__gameAudioTap.getAudioTracks());
      const stream = new MediaStream(tracks);
      const mp4 = 'video/mp4;codecs="avc1.42E01E,mp4a.40.2"';
      const webm = 'video/webm;codecs=vp8,opus';
      const mime = MediaRecorder.isTypeSupported(mp4) ? mp4 : webm;
      const mr = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 3000000, audioBitsPerSecond: 128000 });
      mr.ondataavailable = (e) => { if (e.data.size) window.__recState.chunks.push(e.data); };
      window.__recState.mr = mr;
      window.__recState.mime = mime;
      mr.start(1000);
    };
    window.__recStop = async () => {
      const st = window.__recState;
      if (!st || !st.mr || st.stopped) return { size: 0, mime: '' };
      st.stopped = true;
      await new Promise((res) => { st.mr.onstop = res; st.mr.stop(); });
      const blob = new Blob(st.chunks, { type: st.mime });
      const buf = new Uint8Array(await blob.arrayBuffer());
      const CH = 0xC0000;
      const n = Math.ceil(buf.length / CH);
      for (let i = 0; i < n; i++) {
        let bin = '';
        const sub = buf.subarray(i * CH, Math.min((i + 1) * CH, buf.length));
        const STR = 0x8000;
        for (let j = 0; j < sub.length; j += STR) {
          bin += String.fromCharCode.apply(null, sub.subarray(j, j + STR));
        }
        await window.__nodeSaveChunk(i, btoa(bin));
      }
      return { size: blob.size, mime: st.mime };
    };
  });
}

async function saveRecording(page, outPath) {
  page.__recChunks = null;
  const info = await page.evaluate(() => window.__recStop());
  if (!info || !info.size) throw new Error('recorder produced nothing');
  const b64 = (page.__recChunks || []).join('');
  const buf = Buffer.from(b64, 'base64');
  require('fs').writeFileSync(outPath, buf);
  return { ...info, file: outPath, bytes: buf.length };
}

module.exports = {
  launchGame, sleep, pressKey, advDialog, flushDialog, chooseOption,
  walkTo, face, fightBattle, settleAfterBattle, installRecorder, saveRecording,
};
