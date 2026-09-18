// BTL-verify part 3: gameover PRESS A blink-window capture (missed the on-phase in run 1).
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = '/home/z/my-project/scripts/btl-verify/out';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let seq = 120;
async function tap(page, btn, hold = 70) {
  await page.evaluate((b) => window.__game.press(b), btn);
  await sleep(hold);
  await page.evaluate((b) => window.__game.release(b), btn);
  await sleep(60);
}
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 480, height: 900 } });
  const shot = async (tag) => {
    const dataUrl = await page.evaluate(() => document.querySelector('canvas').toDataURL('image/png'));
    fs.writeFileSync(`${OUT}/${String(seq++).padStart(3, '0')}_${tag}.png`, Buffer.from(dataUrl.split(',')[1], 'base64'));
  };
  await page.goto('http://localhost:3000', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__game && window.__game.mode === 'title', null, { timeout: 30000, polling: 50 });
  await tap(page, 'start', 120);
  for (let i = 0; i < 10; i++) {
    const m = await page.evaluate(() => window.__game.mode);
    if (m === 'world') break;
    if (m === 'title') { await sleep(200); continue; }
    await tap(page, 'a', 90); await sleep(120);
  }
  await page.evaluate(() => { const p = window.__game.player; p.school = 'bear'; p.maxHp = 140; p.hp = 140; p.atk = 10; p.def = 10; p.maxSta = 60; p.sta = 60; });
  await page.evaluate(() => window.__game.startBattle('leshen', 8, true));
  await page.waitForFunction(() => window.__game.mode === 'battle' && !!window.__game.battle && window.__game.battle.phase === 'intro', null, { timeout: 15000, polling: 10 });
  await page.evaluate(() => { window.__game.battle.php = 1; });
  // drain intro+appear msgs via taps
  for (let i = 0; i < 30; i++) {
    const st = await page.evaluate(() => ({ phase: window.__game.battle ? window.__game.battle.phase : 'gone', mode: window.__game.mode }));
    if (st.mode === 'gameover') break;
    if (st.phase === 'menu') break;
    if (st.phase === 'msg') await tap(page, 'a', 50);
    else await sleep(150);
  }
  // any action: leshen (faster) strikes first and kills — FIGHT -> STEEL
  await tap(page, 'a', 60);
  await page.waitForFunction(() => window.__game.battle && window.__game.battle.phase === 'fight', null, { timeout: 8000, polling: 20 });
  await tap(page, 'a', 50);
  await page.waitForFunction(() => window.__game.mode === 'gameover', null, { timeout: 25000, polling: 25 });
  // PRESS A visible in gameoverT [2400,2800): shoot at 2450 and 2620
  const t0 = Date.now();
  while (Date.now() - t0 < 2400) await sleep(Math.max(20, 2350 - (Date.now() - t0)));
  await shot('I_gameover_2450_pressA');
  await sleep(160); await shot('I_gameover_2610_pressA');
  await browser.close();
  console.log('done part3');
})().catch((e) => { console.error(e); process.exit(1); });
