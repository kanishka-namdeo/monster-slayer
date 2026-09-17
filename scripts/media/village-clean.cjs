// Clean full-screen village shot — banner faded, both house rows visible
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { launchGame, sleep } = require('./lib.cjs');

(async () => {
  const { browser, page } = await launchGame();
  await page.evaluate(() => {
    const g = window.__game;
    g.newGame(); g.mode = 'world'; g.dialog = null;
    g.switchMap('village', 4, 8, 'up'); // full top-left house in frame
  });
  await sleep(2600); // banner fully faded
  const b64 = await page.evaluate(() => document.querySelector('canvas').toDataURL('image/png'));
  const buf = Buffer.from(b64.split(',')[1], 'base64');
  const out = path.join(__dirname, 'out', 'wall-analysis');
  if (!fs.existsSync(out)) fs.mkdirSync(out, { recursive: true });
  await sharp(buf).resize(640, 576, { kernel: 'nearest' }).png().toFile(path.join(out, 'after-village-clean.png'));
  console.log('shot: after-village-clean.png');

  await page.evaluate(() => {
    window.__game.switchMap('village', 4, 16, 'up'); // full bottom-left house + grass below
  });
  await sleep(2600);
  const b642 = await page.evaluate(() => document.querySelector('canvas').toDataURL('image/png'));
  const buf2 = Buffer.from(b642.split(',')[1], 'base64');
  await sharp(buf2).resize(640, 576, { kernel: 'nearest' }).png().toFile(path.join(out, 'after-house-ground.png'));
  console.log('shot: after-house-ground.png');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
