// Interior regression check: exit doors + thresholds in all 4 interiors.
const { launchGame, sleep, pressKey } = require('./lib.cjs');
const fs = require('fs');

(async () => {
  const outDir = '/home/z/my-project/tool-results/qa';
  const { browser, page } = await launchGame();
  const put = (code) => page.evaluate(code);
  await pressKey(page, 'start', 120);
  await pressKey(page, 'a', 100);

  const snap4x = async (name) => {
    await sleep(400);
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

  await put(`(() => { const g = window.__game; g.mode = 'world'; g.mapBannerT = 0; return 'ok'; })()`);
  for (const room of ['elder', 'inn', 'smithy', 'herbalist']) {
    await put(`(() => { const g = window.__game; g.switchMap('${room}', 5, 7, 'up'); g.mapBannerT = 0; return 'ok'; })()`);
    await snap4x(`after-4x-int-${room}.png`);
  }
  await browser.close();
  console.log('DONE');
})().catch((e) => { console.error(e); process.exit(1); });
