// Plays the opening minutes on a phone-sized viewport using only taps, and
// screenshots each step. Usage: node tools/phone-walkthrough.js outDir
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

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && !m.text().startsWith('Failed to load resource') && errors.push(m.text()));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, async (route) => {
    try {
      const res = await fetch(route.request().url());
      await route.fulfill({ status: res.status, body: Buffer.from(await res.arrayBuffer()), headers: { 'content-type': res.headers.get('content-type') || 'text/css', 'access-control-allow-origin': '*' } });
    } catch (e) { await route.abort(); }
  });
  await page.goto('file://' + path.join(root, 'index.html'));
  await page.waitForTimeout(1200);
  let n = 0;
  const shot = async (name, full = false) => page.screenshot({ path: path.join(out, `walk-${String(++n).padStart(2, '0')}-${name}.png`), fullPage: full });

  await shot('welcome');
  // Tap through the welcome lines
  for (let i = 0; i < 6; i++) { await page.tap('#textbox').catch(() => {}); await page.waitForTimeout(150); }
  // Let the shop run for ~40 real seconds at 10x via the sim clock
  await page.evaluate(() => { for (let i = 0; i < 20 * 40; i++) HC.sim.update(HC.game, 0.05); });
  await page.waitForTimeout(600);
  await shot('after-40s');
  // Buy a meadow bee through the market button (give enough coins first)
  await page.evaluate(() => { HC.game.coins = Math.max(HC.game.coins, 100); HC.ui.markDirty(); });
  await page.waitForTimeout(400);
  await page.locator('[data-act="buyBee"][data-sp="meadow"]').scrollIntoViewIfNeeded();
  await page.locator('[data-act="buyBee"][data-sp="meadow"]').tap();
  await page.waitForTimeout(400);
  await shot('bought-bee');
  // Claim the goal
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  const claim = page.locator('[data-act="claimGoal"]');
  if (await claim.count()) await claim.tap();
  await page.waitForTimeout(400);
  await shot('claimed-goal');
  // Tap a hive in the scene
  const box = await page.locator('#scene').boundingBox();
  await page.touchscreen.tap(box.x + box.width * (24 / 240), box.y + box.height * (24 / 160));
  await page.waitForTimeout(500);
  await shot('tapped-hive');
  // Tap the shelf in the scene
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.touchscreen.tap(box.x + box.width * (120 / 240), box.y + box.height * (20 / 160));
  await page.waitForTimeout(400);
  await shot('shelf-modal');
  await page.keyboard.press('Escape');
  // Bee detail
  await page.locator('.hive-card .bee-tile:not(.empty)').first().tap();
  await page.waitForTimeout(400);
  await shot('bee-detail');
  await page.locator('#modalBody [data-act="rename"]').tap();
  await page.fill('#renameInput', 'Queenie');
  await page.locator('#modalBody form button').tap();
  await page.waitForTimeout(300);
  await shot('renamed');
  await page.keyboard.press('Escape');
  for (const t of ['nursery', 'town', 'store']) {
    await page.locator(`.tabs [data-tab="${t}"]`).tap();
    await page.waitForTimeout(300);
    await shot('tab-' + t);
  }
  const name = await page.evaluate(() => Object.values(HC.game.bees).some((b) => b.name === 'Queenie'));
  if (!name) errors.push('rename did not stick');
  await browser.close();
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'OK walkthrough, shots in ' + out);
})();
