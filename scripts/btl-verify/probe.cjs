// Debug probe: why does the game not reach 'title' under fresh Playwright?
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 480, height: 900 } });
  page.on('console', (m) => console.log('CONSOLE:', m.type(), m.text().slice(0, 200)));
  page.on('pageerror', (e) => console.log('PAGEERROR:', String(e).slice(0, 300)));
  const resp = await page.goto('http://localhost:3000', { waitUntil: 'load', timeout: 20000 });
  console.log('status:', resp && resp.status());
  for (let i = 0; i < 12; i++) {
    const st = await page.evaluate(() => ({
      hasGame: !!window.__game,
      mode: window.__game ? window.__game.mode : null,
      canvas: document.querySelectorAll('canvas').length,
      bodyLen: document.body ? document.body.innerHTML.length : 0,
    })).catch((e) => ({ err: String(e).slice(0, 120) }));
    console.log(i, JSON.stringify(st));
    if (st.hasGame && st.mode === 'title') break;
    await new Promise((r) => setTimeout(r, 2000));
  }
  await browser.close();
})().catch((e) => { console.error('PROBE FAIL:', e); process.exit(1); });
