// Browser smoke test: loads the game, checks for console errors, exercises
// the main flows and saves screenshots. Usage: node tools/smoke.js [outDir]
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
  const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });
  const errors = [];
  const run = async (name, viewport, script) => {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    // Fetch web fonts through Node (which honours the environment's proxy and
    // CA settings) so screenshots use the real typefaces.
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

  await run('desktop', { width: 1280, height: 860 }, async (page) => {
    await page.screenshot({ path: path.join(out, 'desktop-start.png') });
    // Dismiss the tutorial
    for (let i = 0; i < 8; i++) await page.click('#textbox', { force: true }).catch(() => {});
    // Fast-forward: give coins and run the sim for a few simulated minutes.
    await page.evaluate(() => {
      const s = HC.game;
      s.coins = 5000;
      HC.act.buyBee('meadow');
      HC.sim.catchUp(s, 200);
      HC.act.buyBee('clover');
      HC.act.buildHive();
      HC.act.buyUpgrade('shelf');
      HC.act.buyUpgrade('shelf');
      for (let i = 0; i < 400; i++) HC.sim.update(s, 0.05);
    });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(out, 'desktop-running.png') });
    await page.keyboard.press('Escape');
    for (const t of ['shop', 'nursery', 'town', 'guide', 'menu']) {
      await page.click(`.tabs [data-tab="${t}"]`);
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(out, `desktop-${t}.png`), fullPage: true });
    }
    // Breeding flow through the UI
    await page.click('.tabs [data-tab="nursery"]');
    await page.click('[data-act="breed"]');
    await page.locator('#modalBody .bee-tile').first().click();
    await page.locator('#modalBody .bee-tile').last().click();
    await page.screenshot({ path: path.join(out, 'desktop-breed-modal.png') });
    await page.click('#modalBody [data-act="startBreed"]');
    await page.evaluate(() => {
      const n = HC.game.nursery[0];
      if (n) n.t = n.dur;
      HC.sim.update(HC.game, 0.05);
    });
    await page.waitForTimeout(400);
    await page.click('[data-act="hatch"]');
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(out, 'desktop-hatch.png') });
    await page.keyboard.press('Escape');
    // Night scene
    await page.evaluate(() => { HC.game.time = HC.data.DAY_LENGTH * 0.8; });
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(out, 'desktop-night.png') });
    for (const [name, k] of [['autumn', 2], ['winter', 3]]) {
      await page.evaluate((k) => { HC.game.time = HC.data.DAY_LENGTH * (HC.data.SEASON_DAYS * k + 0.3); HC.sim.rt.drip = { hive: 0, left: 10 }; }, k);
      await page.waitForTimeout(700);
      await page.screenshot({ path: path.join(out, `desktop-${name}.png`) });
    }
    // Save/load round trip
    const ok = await page.evaluate(() => {
      const code = HC.state.exportSave(HC.game);
      const back = HC.state.importSave(code);
      return back.coins === HC.game.coins && Object.keys(back.bees).length === Object.keys(HC.game.bees).length;
    });
    if (!ok) errors.push('[desktop] save round trip mismatch');
  });

  await run('phone', { width: 390, height: 844 }, async (page) => {
    await page.screenshot({ path: path.join(out, 'phone-start.png') });
    for (let i = 0; i < 8; i++) await page.click('#textbox', { force: true }).catch(() => {});
    await page.evaluate(() => {
      HC.game.coins = 800;
      HC.sim.catchUp(HC.game, 120);
      for (let i = 0; i < 300; i++) HC.sim.update(HC.game, 0.05);
    });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(out, 'phone-running.png') });
    await page.keyboard.press('Escape');
    await page.click('.tabs [data-tab="shop"]');
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(out, 'phone-shop.png'), fullPage: true });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    if (overflow) errors.push('[phone] horizontal overflow');
  });

  await browser.close();
  if (errors.length) {
    console.log('ERRORS:\n' + errors.join('\n'));
    process.exitCode = 1;
  } else console.log('OK: no console errors. Screenshots in ' + out);
})();
