// Clean, building-centered after-shots at 4x for VLM review.
const { launchGame, sleep, pressKey } = require('./lib.cjs');
const fs = require('fs');

(async () => {
  const outDir = '/home/z/my-project/tool-results/qa';
  fs.mkdirSync(outDir, { recursive: true });
  const { browser, page } = await launchGame();
  const put = (code) => page.evaluate(code);

  await pressKey(page, 'start', 120);
  await pressKey(page, 'a', 100);
  await put(`(() => {
    const g = window.__game;
    g.mode = 'world';
    g.switchMap('village', 4, 8, 'up');
    g.mapBannerT = 0; g.moving = false; g.moveT = 0;
  })()`);
  await sleep(400);

  const snap4x = async (name) => {
    const up = await page.evaluate(`(() => {
      const cv = document.querySelector('canvas');
      const big = document.createElement('canvas');
      big.width = cv.width * 4; big.height = cv.height * 4;
      const g = big.getContext('2d');
      g.imageSmoothingEnabled = false;
      g.drawImage(cv, 0, 0, big.width, big.height);
      return big.toDataURL('image/png');
    })()`);
    fs.writeFileSync(outDir + '/' + name, Buffer.from(up.split(',')[1], 'base64'));
    console.log('shot', name);
  };

  // Framing 1: elder house dead center (player below-left of it)
  await snap4x('after-4x-elder.png');

  // Framing 2: inn + pond (player at 16,8)
  await put(`(() => { const g = window.__game; g.player.x = 16; g.player.y = 8; g.player.dir = 'down'; return 'ok'; })()`);
  await sleep(350);
  await snap4x('after-4x-inn.png');

  // Framing 3: smithy row (player at 4,16)
  await put(`(() => { const g = window.__game; g.player.x = 4; g.player.y = 16; g.player.dir = 'down'; return 'ok'; })()`);
  await sleep(350);
  await snap4x('after-4x-smithy.png');

  // Framing 4: herbalist + haystack (player at 17,16)
  await put(`(() => { const g = window.__game; g.player.x = 17; g.player.y = 16; g.player.dir = 'down'; return 'ok'; })()`);
  await sleep(350);
  await snap4x('after-4x-herbalist.png');

  await browser.close();
  console.log('DONE');
})().catch((e) => { console.error(e); process.exit(1); });
