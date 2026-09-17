// ============================================================
// MONSTER SLAYER — screenshot tour
// Sets up each key scene precisely and captures the canvas at
// native 160x144, then upscales x4 (nearest) to crisp 640x576.
// Also captures full-page device shots (desktop + mobile).
//
// Usage: NODE_PATH=/home/z/.npm-global/lib/node_modules node scripts/media/screenshot-tour.cjs
// ============================================================
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { launchGame, sleep, pressKey, advDialog } = require('./lib.cjs');

const OUT = path.join(__dirname, 'out', 'shots');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

async function snap(page, name, { wait = 350 } = {}) {
  await sleep(wait);
  const b64 = await page.evaluate(() => document.querySelector('canvas').toDataURL('image/png'));
  const buf = Buffer.from(b64.split(',')[1], 'base64');
  const file = path.join(OUT, `${name}.png`);
  await sharp(buf).resize(640, 576, { kernel: 'nearest' }).png().toFile(file);
  console.log(`shot: ${name}.png`);
}

// jump into a fresh world state (post-intro) with quest progress
async function enterWorld(page, prep) {
  await page.evaluate(() => {
    const g = window.__game;
    g.newGame();
    g.mode = 'world';
    g.dialog = null;
  });
  if (prep) await page.evaluate(prep);
}

(async () => {
  const { browser, page } = await launchGame();

  // ---------- 1. title ----------
  await sleep(1200);
  await pressKey(page, 'start', 120); // menu appears
  await snap(page, '01-title', { wait: 900 });

  // ---------- 2. school select (character creation) ----------
  await pressKey(page, 'a', 100); // NEW GAME -> creation
  await page.waitForFunction(() => window.__game.mode === 'creation', null, { timeout: 8000, polling: 50 });
  await snap(page, '20-school-select', { wait: 400 });
  await pressKey(page, 'a', 100); // SERPENT (default) -> intro

  // ---------- 2. intro ----------
  await page.waitForFunction(() => window.__game.mode === 'intro', null, { timeout: 8000, polling: 50 });
  await snap(page, '02-intro', { wait: 2600 }); // partially typed story

  // ---------- 3. village with banner ----------
  await enterWorld(page, () => {
    window.__game.switchMap('village', 10, 8, 'down');
  });
  await snap(page, '03-village', { wait: 500 }); // map banner visible

  // ---------- 4. notice board ----------
  await page.evaluate(() => {
    const g = window.__game;
    g.player.x = 14; g.player.y = 10; g.player.dir = 'right';
    g.mode = 'board'; g.boardIdx = 0;
  });
  await snap(page, '04-board', { wait: 300 });

  // ---------- 5. elder dialog with choices ----------
  await page.evaluate(() => {
    const g = window.__game;
    g.mode = 'world';
    g.switchMap('elder', 5, 4, 'up');
  });
  await sleep(300);
  await pressKey(page, 'a', 120);
  await page.waitForFunction(() => window.__game.mode === 'dialog', null, { timeout: 8000, polling: 50 });
  await page.evaluate(() => { if (window.__game.dialog) window.__game.dialog.charIdx = 1e9; });
  await page.waitForFunction(() => !!(window.__game.dialog && window.__game.dialog.choosing), null, { timeout: 8000, polling: 40 });
  await snap(page, '05-elder-choice', { wait: 250 });

  // ---------- 6. herbalist shop ----------
  await page.evaluate(() => {
    const g = window.__game;
    g.mode = 'world'; g.dialog = null;
    g.player.crowns = 87;
    g.switchMap('herbalist', 5, 5, 'up');
    g.shopId = 'mira'; g.shopTab = 1; g.shopIdx = 3; // BUY tab, SPECTER OIL
    g.mode = 'shop';
  });
  await snap(page, '06-shop', { wait: 300 });

  // ---------- 7. bag / inventory ----------
  await page.evaluate(() => {
    const g = window.__game;
    g.mode = 'world';
    g.inv = { swallow: 2, thunder: 1, necrooil: 1, drownertongue: 2 };
    g.bagIdx = 0;
    g.mode = 'bag';
  });
  await snap(page, '07-bag', { wait: 300 });

  // ---------- 8. witcher stats ----------
  await page.evaluate(() => {
    const g = window.__game;
    const p = g.player;
    p.lvl = 4; p.xp = 120; p.hp = 31; p.maxHp = 37; p.sta = 14; p.maxSta = 16;
    p.atk = 9; p.def = 5; p.crowns = 132; p.tox = 3; p.skillPoints = 2;
    p.oil = { specter: 0, necro: 6, beast: 0, insectoid: 0 };
    g.bagIdx = -1; // stats page
  });
  await snap(page, '08-stats', { wait: 300 });

  // ---------- 8b. training screen ----------
  await page.evaluate(() => {
    const g = window.__game;
    g.player.skillPoints = 3;
    g.skillsIdx = 2; // SWORDPLAY
    g.mode = 'skills';
  });
  await snap(page, '24-training', { wait: 300 });

  // ---------- 9. contracts ----------
  await page.evaluate(() => {
    const g = window.__game;
    g.quests.q_drowners.active = true; g.kills.drowner = 2;
    g.quests.q_wolves.active = true; g.kills.wolf = 1;
    g.quests.q_wraith.active = true;
    g.questIdx = 2;
    g.mode = 'quests';
  });
  await snap(page, '09-contracts', { wait: 300 });

  // ---------- 10. bestiary entry ----------
  await page.evaluate(() => {
    const g = window.__game;
    g.bestiary = { drowner: true, ghoul: true, wolf: true, barghest: true, nekker: true, endrega: true };
    g.bestIdx = 0; g.bestPage = 1;
    g.mode = 'bestiary';
  });
  await snap(page, '10-bestiary', { wait: 300 });

  // ---------- 10b. new bestiary page (barghest) ----------
  await page.evaluate(() => {
    const g = window.__game;
    g.bestIdx = 3; // barghest
    g.mode = 'bestiary'; g.bestPage = 1;
  });
  await snap(page, '26-new-bestiary', { wait: 300 });

  // ---------- 11-13. battle scenes ----------
  await page.evaluate(() => {
    const g = window.__game;
    g.mode = 'world';
    g.player.lvl = 4; g.player.hp = 26; g.player.sta = 9;
    g.startBattle('drowner', 3);
  });
  await page.waitForFunction(
    () => window.__game.battle && window.__game.battle.phase === 'menu',
    null, { timeout: 8000, polling: 40 },
  );
  await snap(page, '11-battle-menu', { wait: 350 });

  // sign submenu
  await page.evaluate(() => {
    const b = window.__game.battle;
    b.phase = 'sign'; b.subIdx = 0;
  });
  await snap(page, '12-battle-signs', { wait: 250 });

  // IGNI action shot (frozen flash frame)
  await page.evaluate(() => {
    const b = window.__game.battle;
    b.phase = 'msg';
    b.msgs = [];
    b.curMsg = 'IGNI! A torrent of flame!';
    b.charIdx = b.curMsg.length;
    b.curAnim = 'flash'; b.animT = 360;
    b.monHp = Math.max(1, b.monHp - 14);
  });
  await snap(page, '13-battle-igni', { wait: 200 });

  // ---------- 14. final boss ----------
  await page.evaluate(() => {
    const g = window.__game;
    g.mode = 'world';
    g.player.lvl = 9; g.player.hp = 68; g.player.maxHp = 90; g.player.sta = 16;
    g.startBattle('leshen', 10);
  });
  await page.waitForFunction(
    () => window.__game.battle && window.__game.battle.phase === 'menu',
    null, { timeout: 8000, polling: 40 },
  );
  await snap(page, '14-boss-leshen', { wait: 400 });

  // ---------- 14b. royal griffin boss (Fangtooth Pass) ----------
  await page.evaluate(() => {
    const g = window.__game;
    g.mode = 'world'; g.battle = null;
    g.player.hp = 60; g.player.sta = 14;
    g.startBattle('griffin', 9);
  });
  await page.waitForFunction(
    () => window.__game.battle && window.__game.battle.phase === 'menu',
    null, { timeout: 8000, polling: 40 },
  );
  await snap(page, '25-griffin', { wait: 400 });

  // ---------- 14c. katakan superboss (Kaer Serpen) ----------
  await page.evaluate(() => {
    const g = window.__game;
    g.mode = 'world'; g.battle = null;
    g.player.hp = 55; g.player.sta = 12; g.player.oil.specter = 8;
    g.startBattle('katakan', 10);
  });
  await page.waitForFunction(
    () => window.__game.battle && window.__game.battle.phase === 'menu',
    null, { timeout: 8000, polling: 40 },
  );
  await snap(page, '27-katakan', { wait: 400 });

  // ---------- 15. ending chronicle ----------
  await page.evaluate(() => {
    const g = window.__game;
    g.mode = 'world'; g.battle = null;
    g.flags.leshenDone = true; g.flags.wraithPeace = true;
    g.kills = { drowner: 4, ghoul: 2, wolf: 2, waterhag: 1, wraith: 0, werewolf: 1, leshen: 1 };
    g.quests.q_drowners.done = true; g.quests.q_wolves.done = true; g.quests.q_wraith.done = true;
    g.quests.q_main.done = true; g.quests.q_herbs.done = true;
    g.player.crowns = 214; g.player.lvl = 9;
    g.mode = 'ending'; g.endingPage = 1; g.endingT = 2500;
  });
  await snap(page, '15-ending', { wait: 300 });

  // ---------- 16. graveyard (dark map) ----------
  await page.evaluate(() => {
    const g = window.__game;
    g.mode = 'world';
    g.flags.wraithStarted = true;
    g.switchMap('graveyard', 7, 4, 'up');
  });
  await snap(page, '16-graveyard', { wait: 500 }); // banner + dark tint

  // ---------- 16b. Fangtooth Pass ----------
  await page.evaluate(() => {
    const g = window.__game;
    g.mode = 'world';
    g.switchMap('fangs', 9, 12, 'up');
  });
  await snap(page, '21-fangtooth', { wait: 500 });

  // ---------- 16c. Crookback Bog (Kettle visible) ----------
  await page.evaluate(() => {
    const g = window.__game;
    g.mode = 'world';
    g.switchMap('bog', 9, 6, 'right');
    g.player.x = 9; g.player.y = 6; g.player.dir = 'right';
  });
  await snap(page, '22-crookback', { wait: 500 });

  // ---------- 16d. Kaer Serpen ruins (the Pale Witcher) ----------
  await page.evaluate(() => {
    const g = window.__game;
    g.mode = 'world';
    g.switchMap('ruins', 8, 11, 'up');
    g.player.x = 6; g.player.y = 10; g.player.dir = 'left';
  });
  await snap(page, '23-kaer-serpen', { wait: 500 });

  // ---------- 17-18. device shell shots ----------
  await page.evaluate(() => {
    const g = window.__game;
    g.mode = 'world';
    g.switchMap('village', 10, 8, 'down');
  });
  await sleep(400);
  await page.setViewportSize({ width: 520, height: 1080 });
  await sleep(700);
  await page.screenshot({ path: path.join(OUT, '17-device-desktop.png') });
  console.log('shot: 17-device-desktop.png');

  await page.setViewportSize({ width: 390, height: 844 });
  await sleep(700);
  await page.screenshot({ path: path.join(OUT, '18-device-mobile.png') });
  console.log('shot: 18-device-mobile.png');

  // ---------- 19. og-banner 1280x640 ----------
  {
    const titleShot = path.join(OUT, '01-title.png');
    const W = 1280, H = 640;
    const svg = Buffer.from(`
      <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#0f380f"/>
            <stop offset="1" stop-color="#306230"/>
          </linearGradient>
          <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
            <path d="M 32 0 L 0 0 0 32" fill="none" stroke="#8bac0f" stroke-opacity="0.07" stroke-width="2"/>
          </pattern>
        </defs>
        <rect width="${W}" height="${H}" fill="url(#bg)"/>
        <rect width="${W}" height="${H}" fill="url(#grid)"/>
        <rect x="36" y="28" width="584" height="584" fill="#0f380f" stroke="#8bac0f" stroke-width="4"/>
        <text x="700" y="205" font-family="monospace" font-weight="bold" font-size="64" fill="#9bbc0f" letter-spacing="2">MONSTER</text>
        <text x="700" y="285" font-family="monospace" font-weight="bold" font-size="64" fill="#9bbc0f" letter-spacing="2">SLAYER</text>
        <text x="702" y="330" font-family="monospace" font-size="26" fill="#8bac0f" letter-spacing="6">GREEN EDITION</text>
        <text x="702" y="420" font-family="monospace" font-size="24" fill="#cfe8a0">A witcher RPG in Game Boy style.</text>
        <text x="702" y="456" font-family="monospace" font-size="24" fill="#cfe8a0">Steel for beasts, silver for monsters.</text>
        <text x="702" y="530" font-family="monospace" font-size="22" fill="#8bac0f">160x144 &#183; 4-shade green &#183; chiptune audio</text>
        <text x="702" y="566" font-family="monospace" font-size="22" fill="#8bac0f">Contracts &#183; Signs &#183; Alchemy &#183; Bosses</text>
      </svg>`);
    await sharp(svg)
      .composite([{ input: titleShot, left: 40, top: 32 }])
      .png()
      .toFile(path.join(OUT, '19-og-banner.png'));
    console.log('shot: 19-og-banner.png');
  }

  await browser.close();
  console.log('DONE');
})().catch((e) => { console.error('TOUR FAILED:', e); process.exit(1); });
