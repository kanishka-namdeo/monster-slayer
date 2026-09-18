// ============================================================
// BTL-visual shared helpers (adapted from scripts/media/lib.cjs)
// Drives the real game at http://localhost:3100 through window.__game.
// VERIFICATION ONLY: never modifies game source.
// ============================================================
const { chromium } = require('playwright');

const GAME_URL = 'http://localhost:3100';
const OUT = '/home/z/my-project/scripts/btl-visual/out';
const fs = require('fs');

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

// New game: title -> start -> A (NEW GAME) -> A (confirm school) => intro mode
async function startNewGame(page) {
  await page.evaluate(() => { window.__game.press('start'); });
  await sleep(150);
  await page.evaluate(() => window.__game.release('start'));
  await sleep(250);
  await page.evaluate(() => window.__game.press('a'));
  await sleep(120);
  await page.evaluate(() => window.__game.release('a'));
  await sleep(250);
  await page.evaluate(() => window.__game.press('a'));
  await sleep(120);
  await page.evaluate(() => window.__game.release('a'));
  await sleep(300);
  const mode = await page.evaluate(() => window.__game.mode);
  return mode; // expect 'intro'
}

// Begin a battle via the real startBattle path (flash + fade included).
async function beginBattle(page, monId, lvl, boss = false) {
  await page.evaluate(([m, l, b]) => window.__game.startBattle(m, l, b), [monId, lvl, boss]);
  await page.waitForFunction(
    () => window.__game.mode === 'battle' && !!window.__game.battle,
    null,
    { timeout: 15000, polling: 30 },
  );
  await sleep(350); // let the fade-in overlay clear
}

// Full battle snapshot for traces (only public fields, read-only).
function BSTATE() {
  const g = window.__game;
  const b = g.battle;
  if (!b) return { mode: g.mode };
  return {
    mode: g.mode,
    phase: b.phase,
    menuIdx: b.menuIdx, subIdx: b.subIdx, itemIdx: b.itemIdx,
    monHp: b.monHp, monMaxHp: b.monMaxHp, php: b.php, psta: b.psta,
    dispMonHp: +b.dispMonHp.toFixed(2), dispPhp: +b.dispPhp.toFixed(2),
    curMsg: b.curMsg, charIdx: Math.floor(b.charIdx), msgHold: Math.round(b.msgHold),
    curAnim: b.curAnim, animT: Math.round(b.animT), shakeT: b.shakeT,
    introT: Math.round(b.introT), faintT: Math.round(b.faintT), monDead: b.monDead,
    doneResult: b.doneResult, nMsgs: b.msgs.length, afterQueue: b.afterQueue,
    quenTurns: b.quenTurns, poison: b.poison, ptox: b.ptox,
  };
}

async function bstate(page) {
  return page.evaluate(BSTATE);
}

// Capture the live canvas (native 160x144) as PNG. t0 = scenario epoch.
async function shot(page, trace, tag, meta = {}) {
  const n = trace.shots.length;
  const file = `${String(n).padStart(3, '0')}_${tag}.png`;
  const dataUrl = await page.evaluate(() => document.querySelector('canvas').toDataURL('image/png'));
  fs.writeFileSync(`${OUT}/${file}`, Buffer.from(dataUrl.split(',')[1], 'base64'));
  const st = await bstate(page);
  const entry = {
    file, tag, t: Math.round(performance.now() - trace.t0), ...meta, state: st,
  };
  trace.shots.push(entry);
  return entry;
}

// Literal element screenshot of the canvas (as displayed, integer CSS scale).
async function shotElement(page, file) {
  const el = page.locator('canvas');
  await el.screenshot({ path: `${OUT}/${file}` });
}

// Burst: capture n frames ~interval ms apart, tagged.
async function burst(page, trace, tag, n, interval) {
  const entries = [];
  for (let i = 0; i < n; i++) {
    entries.push(await shot(page, trace, `${tag}_${String(i).padStart(2, '0')}`));
    if (i < n - 1) await sleep(interval);
  }
  return entries;
}

async function waitPhase(page, phase, { timeout = 20000 } = {}) {
  await page.waitForFunction(
    (p) => window.__game.battle && window.__game.battle.phase === p,
    phase,
    { timeout, polling: 25 },
  );
}

async function waitNotPhase(page, phase, { timeout = 20000 } = {}) {
  await page.waitForFunction(
    (p) => window.__game.battle && window.__game.battle.phase !== p,
    phase,
    { timeout, polling: 25 },
  );
}

// Wait until battle over (mode != battle) or timeout; returns mode.
async function waitBattleEnd(page, { timeout = 40000 } = {}) {
  try {
    await page.waitForFunction(
      () => window.__game.mode !== 'battle',
      null, { timeout, polling: 60 },
    );
  } catch { /* timeout */ }
  return page.evaluate(() => window.__game.mode);
}

module.exports = {
  GAME_URL, OUT, fs, launchGame, sleep, pressKey, startNewGame,
  beginBattle, bstate, shot, shotElement, burst, waitPhase, waitNotPhase,
  waitBattleEnd, BSTATE,
};
