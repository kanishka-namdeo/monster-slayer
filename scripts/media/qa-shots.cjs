// Targeted canvas-native screenshots of the new art for visual QA
const { launchGame, sleep, pressKey } = require('./lib.cjs');
const fs = require('fs');

(async () => {
  const outDir = '/home/z/my-project/tool-results/qa';
  fs.mkdirSync(outDir, { recursive: true });
  const { browser, page } = await launchGame();
  const snap = async (name, wait = 500) => {
    await sleep(wait);
    const b64 = await page.evaluate(() => document.querySelector('canvas').toDataURL('image/png'));
    fs.writeFileSync(`${outDir}/${name}.png`, Buffer.from(b64.split(',')[1], 'base64'));
    console.log('shot', name);
  };
  const put = async (code) => { await page.evaluate(code); };

  await pressKey(page, 'start', 120);   // NEW GAME -> creation
  await pressKey(page, 'a', 100);       // school select -> intro
  await put(`(() => { const g = window.__game; g.mode='world'; g.switchMap('village', 10, 8, 'down'); g.mapBannerT = 0; return 'ok'; })()`);
  await snap('01-village-buildings');

  await put(`(() => { const g = window.__game; g.player.x = 4; g.player.y = 8; g.player.dir = 'up'; g.mapBannerT = 0; return 'ok'; })()`);
  await snap('02-elder-house-closeup');

  await put(`(() => { const g = window.__game; g.player.x = 17; g.player.y = 8; g.player.dir = 'right'; g.mapBannerT = 0; return 'ok'; })()`);
  await snap('03-inn-pond-garden');

  await put(`(() => { const g = window.__game; g.player.x = 10; g.player.y = 9; g.player.dir='down'; g.moving = true; g.moveFrom = {x:10,y:9}; g.moveT = 100; g.stepFrame = true; g.mapBannerT = 0; return 'ok'; })()`);
  await snap('04-walk-stride');
  await put(`(() => { const g = window.__game; g.moving=false; g.moveT=0; g.player.dir='up'; g.mapBannerT = 0; return 'ok'; })()`);
  await snap('05-back-view-xscabbards');
  await put(`(() => { const g = window.__game; g.player.dir='left'; g.mapBannerT = 0; return 'ok'; })()`);
  await snap('06-side-scabbard');

  await put(`(() => { const g = window.__game; g.switchMap('elder', 4, 5, 'up'); g.mapBannerT = 0; return 'ok'; })()`);
  await snap('07-elder-interior');
  await put(`(() => { const g = window.__game; g.switchMap('smithy', 4, 5, 'up'); g.mapBannerT = 0; return 'ok'; })()`);
  await snap('08-smithy-forge');
  await put(`(() => { const g = window.__game; g.switchMap('inn', 4, 5, 'up'); g.mapBannerT = 0; return 'ok'; })()`);
  await snap('09-inn-hearth');

  await put(`(() => { const g = window.__game; g.switchMap('deepforest', 8, 6, 'up'); g.mapBannerT = 0; return 'ok'; })()`);
  await snap('10-deepforest');
  await put(`(() => { const g = window.__game; g.switchMap('bog', 10, 3, 'down'); g.mapBannerT = 0; return 'ok'; })()`);
  await snap('11-bog');
  await put(`(() => { const g = window.__game; g.switchMap('graveyard', 7, 4, 'down'); g.mapBannerT = 0; return 'ok'; })()`);
  await snap('12-graveyard');
  await put(`(() => { const g = window.__game; g.switchMap('ruins', 9, 6, 'down'); g.mapBannerT = 0; return 'ok'; })()`);
  await snap('13-ruins-masonry');

  await browser.close();
  console.log('DONE');
})().catch((e) => { console.error(e); process.exit(1); });
