// ============================================================
// BTL-visual recording: ~25s WebM of a full drowner battle with
// real game audio (MediaRecorder canvas capture, lib.cjs pattern).
// VERIFICATION ONLY.
// ============================================================
const { chromium } = require('playwright');
const fs = require('fs');

const GAME_URL = 'http://localhost:3100';
const OUT = '/home/z/my-project/scripts/btl-visual/out';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const AUDIO_TAP_INIT = `
(() => {
  const origConnect = AudioNode.prototype.connect;
  let tapDest = null, tapCtx = null;
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
    } catch (e) {}
    return origConnect.call(this, destination, ...args);
  };
})();
`;

async function pressKey(page, btn, ms = 100) {
  await page.evaluate((b) => window.__game.press(b), btn);
  await sleep(ms);
  await page.evaluate((b) => window.__game.release(b), btn);
  await sleep(90);
}

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--autoplay-policy=no-user-gesture-required'],
  });
  const page = await browser.newPage({ viewport: { width: 480, height: 900 } });
  await page.addInitScript(AUDIO_TAP_INIT);
  await page.goto(GAME_URL, { waitUntil: 'load' });
  await page.waitForFunction(
    () => window.__game && window.__game.mode === 'title',
    null, { timeout: 30000, polling: 50 },
  );

  // new game: start, a, a
  for (const b of ['start', 'a', 'a']) { await pressKey(page, b, 140); await sleep(200); }
  await page.evaluate(() => {
    const g = window.__game;
    g.giveItem('swallow', 1);
  });

  // ---- install recorder (canvas 4x + game audio) ----
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

  // ---- start recording, then the battle ----
  await page.evaluate(() => window.__recStart());
  console.log('recording started');
  await page.evaluate(() => window.__game.startBattle('drowner', 3));
  await page.waitForFunction(
    () => window.__game.mode === 'battle' && !!window.__game.battle,
    null, { timeout: 15000, polling: 30 },
  );

  const bstate = () => page.evaluate(() => {
    const g = window.__game; const b = g.battle;
    if (!b) return { mode: g.mode };
    return { mode: g.mode, phase: b.phase, menuIdx: b.menuIdx, subIdx: b.subIdx, monHp: b.monHp, php: b.php, curMsg: b.curMsg, anim: b.curAnim };
  });
  const waitMenu = async (maxMs = 15000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < maxMs) {
      const st = await bstate();
      if (st.mode !== 'battle') return 'ended';
      if (st.phase === 'menu') return 'menu';
      await sleep(100);
    }
    return 'timeout';
  };
  async function navMenu(target) {
    for (let guard = 0; guard < 6; guard++) {
      const st = await bstate();
      if (st.menuIdx === target) return;
      if ((st.menuIdx & 1) !== (target & 1)) await pressKey(page, 'right', 70);
      else if ((st.menuIdx & 2) !== (target & 2)) await pressKey(page, 'down', 70);
    }
  }

  // battle script: browse menus a little, silver, igni, swallow, silver, igni...
  await sleep(600); // intro
  let r = await waitMenu(); console.log('menu1', r);
  await sleep(500);
  await navMenu(2); // SIGN
  await sleep(400);
  await navMenu(1); // ITEM
  await sleep(400);
  await navMenu(3); // RUN (drowner not boss: this would flee! don't press A)
  await sleep(400);
  await navMenu(0); // FIGHT
  await pressKey(page, 'a', 60); await sleep(200);
  await page.waitForFunction(() => window.__game.battle && window.__game.battle.phase === 'fight', null, { timeout: 8000, polling: 20 });
  await sleep(400);
  await pressKey(page, 'down', 60); // silver
  await sleep(300);
  await pressKey(page, 'a', 40);
  r = await waitMenu(); console.log('menu2', r);

  // turn 2: IGNI
  await navMenu(2);
  await pressKey(page, 'a', 60); await sleep(200);
  await page.waitForFunction(() => window.__game.battle && window.__game.battle.phase === 'sign', null, { timeout: 8000, polling: 20 });
  await sleep(500);
  await pressKey(page, 'a', 40);
  r = await waitMenu(); console.log('menu3', r);

  // turn 3: swallow potion
  await navMenu(1);
  await pressKey(page, 'a', 60); await sleep(200);
  await page.waitForFunction(() => window.__game.battle && window.__game.battle.phase === 'item', null, { timeout: 8000, polling: 20 });
  await sleep(500);
  await pressKey(page, 'a', 40);
  r = await waitMenu(); console.log('menu4', r);

  // turn 4+: silver until dead
  let turn = 4;
  for (;;) {
    const st = await bstate();
    if (st.mode !== 'battle') break;
    if (st.phase === 'menu') {
      await navMenu(0);
      await pressKey(page, 'a', 60); await sleep(200);
      await page.waitForFunction(() => window.__game.battle && window.__game.battle.phase === 'fight', null, { timeout: 8000, polling: 20 }).catch(() => {});
      await pressKey(page, 'down', 50);
      await sleep(150);
      await pressKey(page, 'a', 40);
      turn++;
      if (turn > 20) { await page.evaluate(() => window.__game.debugWinBattle()); }
    }
    await sleep(150);
  }
  console.log('battle over');
  await sleep(1800); // capture the fade back to world

  // ---- stop + save ----
  page.__recChunks = null;
  const info = await page.evaluate(() => window.__recStop());
  if (!info || !info.size) throw new Error('recorder produced nothing');
  const b64 = (page.__recChunks || []).join('');
  const buf = Buffer.from(b64, 'base64');
  const file = `${OUT}/battle-drowner-full.webm`;
  fs.writeFileSync(file, buf);
  console.log('saved', file, buf.length, 'bytes', info.mime);
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
