// Browser smoke test: loads the game in headless Chromium, plays through the
// main flows, saves screenshots and fails on any console error.
// Usage: node tools/smoke.js [outDir]
//
// The game is plain web files, so this opens index.html straight from disk.
// Web fonts are fetched through Node so screenshots use the real typefaces.
const path = require('path');
const fs = require('fs');
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch (e) {
  ({ chromium } = require(path.join(process.execPath, '../../lib/node_modules/playwright')));
}

const root = path.join(__dirname, '..');
const out = process.argv[2] || path.join(root, 'tools', 'shots');
fs.mkdirSync(out, { recursive: true });
const target = process.env.TARGET || 'file://' + path.join(root, 'index.html');

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const run = async (name, viewport, script) => {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await page.route(/fonts\.(googleapis|gstatic)\.com/, async (route) => {
      try {
        const res = await fetch(route.request().url());
        const body = Buffer.from(await res.arrayBuffer());
        await route.fulfill({ status: res.status, body, headers: { 'content-type': res.headers.get('content-type') || 'text/css', 'access-control-allow-origin': '*' } });
      } catch (e) {
        await route.abort();
      }
    });
    page.on('console', (m) => m.type() === 'error' && !m.text().startsWith('Failed to load resource') && errors.push(`[${name}] ${m.text()}`));
    page.on('pageerror', (e) => errors.push(`[${name}] ${e.message}`));
    await page.goto(target);
    await page.waitForTimeout(800);
    await script(page);
    await ctx.close();
  };
  const shot = (page, file, full = false) => page.screenshot({ path: path.join(out, file), fullPage: full });
  // Run the simulation forward quickly inside the page.
  const advance = (page, secs) => page.evaluate((secs) => { for (let i = 0; i < secs * 20; i++) HC.sim.update(HC.game, 0.05); }, secs);
  const closeAll = async (page) => {
    await page.keyboard.press('Escape');
    await page.evaluate(() => { HC.game.hints = Object.fromEntries(['welcome', 'collect', 'line', 'full', 'night', 'clover', 'build', 'nursery', 'wax', 'order', 'merchant', 'drip', 'boxfull', 'festival', 'duties', 'rush', 'critic', 'drag', 'feedback'].map((k) => [k, true])); });
    for (let i = 0; i < 6; i++) await page.click('#textbox', { force: true, timeout: 500 }).catch(() => {});
  };

  await run('desktop', { width: 1280, height: 900 }, async (page) => {
    await shot(page, 'desktop-start.png');
    // The tutorial box must sit below the picture, not on top of it.
    const overlap = await page.evaluate(() => {
      const a = document.querySelector('#scene').getBoundingClientRect();
      const b = document.querySelector('#textbox').getBoundingClientRect();
      return !document.querySelector('#textbox').hidden && b.top < a.bottom - 1;
    });
    if (overlap) errors.push('[desktop] the text box covers the scene');
    // Guided goals: goal 1 flashes the game picture.
    await page.waitForTimeout(400);
    if (!(await page.locator('.screen.spotlight').count())) errors.push('[desktop] goal 1 guide spotlight missing');
    await closeAll(page);

    // Tap hive 1 in the scene: the keeper should walk out and collect.
    const box = await page.locator('#scene').boundingBox();
    await page.mouse.click(box.x + box.width * (24 / 240), box.y + box.height * (22 / 160));
    await advance(page, 6);
    await page.waitForTimeout(300);
    await shot(page, 'desktop-keeper-walking.png');
    await advance(page, 30);
    const collected = await page.evaluate(() => HC.game.stats.collected);
    if (!collected) errors.push('[desktop] tapping a hive did not collect honey');

    // Money for testing the rest.
    await page.evaluate(() => { HC.game.coins = 50000; HC.game.gems = 500; HC.game.lifetime = 500; HC.ui.markDirty(); });
    // Hire Rosa from the Shop tab, then reassign her with a duty button.
    await page.click('.tabs [data-tab="shop"]');
    await page.waitForTimeout(300);
    await page.click('[data-act="hire"][data-id="rosa"]');
    await page.waitForTimeout(400);
    await page.click('[data-act="setDuty"][data-who="rosa"][data-duty="collect"]');
    await page.waitForTimeout(400);
    await shot(page, 'desktop-staff.png', true);
    if (await page.evaluate(() => HC.game.staff.rosa.duty) !== 'collect') errors.push('[desktop] duty button did not reassign Rosa');
    await page.click('[data-act="setDuty"][data-who="rosa"][data-duty="register"]');
    await page.waitForTimeout(300);
    // Start an upgrade and finish it with gems.
    await page.click('[data-act="upgrade"][data-id="shelf"]');
    await page.waitForTimeout(400);
    await shot(page, 'desktop-building.png');
    await page.locator('#goalbar [data-act="skipBuild"]').first().click();
    await page.waitForTimeout(300);
    const shelves = await page.evaluate(() => HC.game.shelves.length);
    if (shelves !== 2) errors.push('[desktop] shelf upgrade did not finish via gems (shelves=' + shelves + ')');

    // Breed a Waxwing, build the Candle Machine and tend it.
    await page.evaluate(() => {
      HC.act.buyBee('clover');
      const s = HC.game;
      const m = Object.values(s.bees).find((b) => b.sp === 'meadow');
      const c = Object.values(s.bees).find((b) => b.sp === 'clover');
      s.triedPairs['clover+meadow'] = 4; // guarantee the recipe
      HC.act.startBreed(0, m.id, c.id);
    });
    await closeAll(page);
    await page.click('.tabs [data-tab="nursery"]');
    await page.waitForTimeout(300);
    await shot(page, 'desktop-nursery.png');
    await page.click('[data-act="skipEgg"]');
    await page.click('[data-act="hatch"]');
    await page.waitForTimeout(600);
    await shot(page, 'desktop-hatch.png');
    await closeAll(page);
    await page.evaluate(() => {
      HC.act.buildMachine();
      HC.act.skipBuild(HC.game.builds[0].id);
      HC.game.store.wax = 20;
      HC.act.tendMachine();
      HC.act.hire('theo');
      HC.act.hire('mabel');
      HC.act.hire('otis');
    });
    await advance(page, 60);
    const machine = await page.evaluate(() => HC.game.machine && HC.game.stats.candles);
    if (!machine) errors.push('[desktop] candle machine made no candles');

    // Drag a bee from hive 1 onto hive 2 with a long press.
    await page.evaluate(() => { HC.act.buildHive(); HC.act.skipBuild(HC.game.builds[0].id); });
    await closeAll(page);
    await page.click('.tabs [data-tab="apiary"]');
    await page.waitForTimeout(500);
    const beeId = await page.evaluate(() => HC.game.hives[0].bees[0]);
    const tile = await page.locator(`#hive-0 .bee-tile[data-id="${beeId}"]`).boundingBox();
    const target = await page.locator('#hive-1').boundingBox();
    await page.mouse.move(tile.x + tile.width / 2, tile.y + tile.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(500);
    await page.mouse.move(target.x + target.width / 2, target.y + 20, { steps: 8 });
    await shot(page, 'desktop-drag.png');
    await page.mouse.up();
    await page.waitForTimeout(400);
    const movedTo = await page.evaluate((id) => HC.sim.f.hiveOf(HC.game, id), beeId);
    if (movedTo !== 1) errors.push('[desktop] long-press drag did not move the bee (hive ' + movedTo + ')');
    if (await page.locator('#modal:not([hidden])').count()) errors.push('[desktop] drag also opened the bee details');
    await closeAll(page);

    // Give hive 2 its own style from the Apiary tab.
    await page.evaluate(() => { HC.game.cos.owned['hive-skep'] = true; HC.ui.markDirty(); });
    await page.waitForTimeout(400);
    await page.click('[data-act="hiveStyle"][data-i="1"]');
    await page.waitForTimeout(300);
    await shot(page, 'desktop-hive-style.png');
    await page.click('#modalBody [data-act="pickHiveStyle"][data-id="hive-skep"]');
    await page.waitForTimeout(300);
    if (await page.evaluate(() => HC.game.hives[1].style) !== 'hive-skep') errors.push('[desktop] per-hive style not applied');
    await closeAll(page);

    // Reputation window from the status bar.
    await page.click('[data-act="rep"]');
    await page.waitForTimeout(300);
    await shot(page, 'desktop-rep.png');
    if (!(await page.locator('#modalBody h2').innerText()).includes('Reputation')) errors.push('[desktop] reputation window did not open');
    await closeAll(page);

    // Store: buy and place a few things, change hive style.
    await page.click('.tabs [data-tab="store"]');
    await page.waitForTimeout(400);
    await page.evaluate(() => ['hat-straw', 'deco-chalk', 'deco-bench', 'deco-lights', 'deco-fountain', 'hive-painted', 'wall-honeycomb', 'floor-wood'].forEach((id) => HC.act.buyItem(id)));
    await closeAll(page);
    await page.waitForTimeout(400);
    await shot(page, 'desktop-store.png', true);

    // A requester pins an order on the board.
    await page.evaluate(() => { const o = HC.sim.makeOrder(HC.game); HC.customers.spawnRequester(HC.game, o); });
    await advance(page, 8);
    await page.waitForTimeout(300);
    await shot(page, 'desktop-board.png');
    const orders = await page.evaluate(() => HC.game.orders.length);
    if (!orders) errors.push('[desktop] requester never pinned the order');

    // Upgraded hives with the painted style.
    await page.evaluate(() => {
      const s = HC.game;
      s.hives.push({ level: 3, bees: [], stock: { wildflower: 40 } }, { level: 5, bees: [], stock: {} });
      s.hives[0].level = 1;
      s.up.flowers = 6;
      HC.ui.markDirty();
    });
    await page.waitForTimeout(400);
    for (const t of ['apiary', 'shop', 'nursery', 'town', 'store', 'guide']) {
      await page.click(`.tabs [data-tab="${t}"]`);
      await page.waitForTimeout(300);
      await shot(page, `desktop-${t}.png`, true);
    }
    await page.click('.hud-gear');
    await page.waitForTimeout(300);
    await shot(page, 'desktop-menu.png');

    // Night and winter scenes
    await page.evaluate(() => { HC.game.time = HC.data.DAY_LENGTH * 0.8; });
    await page.waitForTimeout(500);
    await shot(page, 'desktop-night.png');
    await page.evaluate(() => { HC.game.time = HC.data.DAY_LENGTH * (HC.data.SEASON_DAYS * 3 + 0.3); HC.sim.rt.drip = { hive: 0, left: 10 }; });
    await page.waitForTimeout(500);
    await shot(page, 'desktop-winter.png');

    // Audio: every effect and the music loop run without errors.
    await page.evaluate(() => {
      HC.audio.unlock();
      HC.game.settings.music = true;
      HC.audio.syncMusic();
      ['coin', 'buy', 'click', 'fail', 'hatch', 'order', 'discover', 'bell', 'text'].forEach((n) => HC.audio.play(n));
    });
    await page.waitForTimeout(400);
    await page.evaluate(() => { HC.game.settings.music = false; HC.audio.syncMusic(); });

    // Save round trip
    const ok = await page.evaluate(() => {
      const back = HC.state.importSave(HC.state.exportSave(HC.game));
      return back.coins === HC.game.coins && Object.keys(back.bees).length === Object.keys(HC.game.bees).length && !!back.staff.rosa;
    });
    if (!ok) errors.push('[desktop] save round trip mismatch');

    // Festival through the UI (first close the 8pm closing-time window, which
    // the night screenshot above triggers).
    await closeAll(page);
    await page.evaluate(() => { HC.game.runEarned = 2e7; HC.ui.markDirty(); });
    await page.click('.tabs [data-tab="town"]');
    await page.waitForTimeout(400);
    await page.click('[data-act="festival"]');
    await page.locator('#modalBody .bee-tile').first().click();
    await page.click('#modalBody [data-act="holdFestival"]');
    await page.waitForTimeout(500);
    const fest = await page.evaluate(() => ({ ribbons: HC.game.ribbons, festivals: HC.game.festivals, bees: Object.keys(HC.game.bees).length, hat: HC.game.cos.equip.hat }));
    if (fest.ribbons < 1 || fest.festivals !== 1 || fest.bees !== 3 || fest.hat !== 'hat-straw') errors.push('[desktop] festival state wrong ' + JSON.stringify(fest));
  });

  // Returning player: a save two hours old shows the away report.
  await run('returning', { width: 1280, height: 860 }, async (page) => {
    await page.evaluate(() => {
      HC.game.hints.welcome = true;
      HC.game.lastSeen = Date.now() - 2 * 3600 * 1000;
      localStorage.setItem(HC.data.SAVE_KEY, JSON.stringify(HC.game));
      HC.state.save = () => {};
      HC.main.save = () => {};
    });
    await page.reload();
    await page.waitForTimeout(1200);
    const text = await page.textContent('#modalBody').catch(() => '');
    if (!/While you were away/.test(text || '')) errors.push('[returning] no away report shown');
    await shot(page, 'desktop-returning.png');
  });

  await run('phone', { width: 390, height: 844 }, async (page) => {
    await shot(page, 'phone-start.png');
    await closeAll(page);
    await advance(page, 60);
    await page.waitForTimeout(800);
    await shot(page, 'phone-running.png');
    for (const t of ['shop', 'store']) {
      await page.click(`.tabs [data-tab="${t}"]`);
      await page.waitForTimeout(300);
      await shot(page, `phone-${t}.png`, true);
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    if (overflow) errors.push('[phone] horizontal overflow');
  });

  await browser.close();
  if (errors.length) {
    console.log('ERRORS:\n' + errors.join('\n'));
    process.exitCode = 1;
  } else console.log('OK: no console errors. Screenshots in ' + out);
})();
