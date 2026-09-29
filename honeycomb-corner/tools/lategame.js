// Late-game soak: plays ~3 simulated hours inside the real page with a simple
// bot, then screenshots every tab with a full garden. Fails on console errors.
// Usage: node tools/lategame.js outDir
const path = require('path');
const fs = require('fs');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require(path.join(process.execPath, '../../lib/node_modules/playwright'))); }
const root = path.join(__dirname, '..');
const out = process.argv[2] || path.join(root, 'tools', 'shots');
fs.mkdirSync(out, { recursive: true });

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => m.type() === 'error' && !m.text().startsWith('Failed to load resource') && errors.push(m.text()));
  await p.route(/fonts\.(googleapis|gstatic)\.com/, async (route) => {
    try {
      const res = await fetch(route.request().url());
      await route.fulfill({ status: res.status, body: Buffer.from(await res.arrayBuffer()), headers: { 'content-type': res.headers.get('content-type') || 'text/css', 'access-control-allow-origin': '*' } });
    } catch (e) { await route.abort(); }
  });
  await p.goto('file://' + path.join(root, 'index.html'));
  await p.waitForTimeout(800);
  const summary = await p.evaluate(() => {
    const { sim, act, data: D } = HC;
    const f = sim.f;
    const s0 = HC.game;
    s0.hints = Object.fromEntries(['welcome', 'buyBee', 'clover', 'shelf2', 'nursery', 'order', 'merchant', 'boxfull', 'night', 'festival', 'drip'].map((k) => [k, true]));
    HC.bus.on('fail', () => {});
    const bot = () => {
      const s = HC.game;
      HC.goals.claim();
      const goods = D.GOODS.filter((g) => s.unlockedGoods[g.id]).map((g) => g.id).reverse();
      s.shelves.forEach((sh, i) => goods[i] && sh.good !== goods[i] && act.setShelf(i, goods[i]));
      for (const o of [...s.orders]) if ((s.store[o.good] || 0) >= o.qty) act.deliverOrder(o.id);
      s.nursery.forEach((n, i) => n && n.ready && act.hatch(i));
      s.nursery.forEach((n, i) => {
        if (n) return;
        const busy = new Set(s.nursery.filter(Boolean).flatMap((x) => [x.a, x.b]));
        const bees = Object.values(s.bees).filter((x) => !busy.has(x.id));
        for (const r of [...D.RECIPES].reverse()) {
          if (Object.values(s.bees).filter((x) => x.sp === r.out).length >= 5) continue;
          const a = bees.find((x) => x.sp === r.a), c = bees.find((x) => x.sp === r.b && x !== a);
          if (a && c && s.coins > f.breedCost(a, c) * 1.5) { act.startBreed(i, a.id, c.id); return; }
        }
      });
      const val = (x) => f.beeValue(x);
      for (const id of [...s.box]) {
        for (let hi = 0; hi < s.hives.length; hi++) {
          const h = s.hives[hi];
          if (h.bees.length < f.hiveCap(h)) { act.moveBee(id, hi); break; }
          const worst = h.bees.reduce((m, x) => (val(s.bees[x]) < val(s.bees[m]) ? x : m), h.bees[0]);
          if (val(s.bees[id]) > val(s.bees[worst]) * 1.2) { act.swapBee(id, hi, worst); break; }
        }
      }
      const busy = new Set(s.nursery.filter(Boolean).flatMap((x) => [x.a, x.b]));
      const sellable = s.box.filter((x) => !busy.has(x)).sort((a, c) => val(s.bees[a]) - val(s.bees[c]));
      while (s.box.length > f.boxCap(s) - 2 && sellable.length) act.sellBee(sellable.shift());
      const opts = [];
      if (s.hives.length < 6) opts.push([f.hiveCost(s), () => act.buildHive()]);
      s.hives.forEach((h, i) => h.level < 5 && opts.push([f.hiveUpgradeCost(s, i), () => act.upgradeHive(i)]));
      for (const u of D.UPGRADES) if (s.up[u.id] < u.max) opts.push([f.upgradeCost(s, u.id), () => act.buyUpgrade(u.id)]);
      if (s.hives.some((h) => h.bees.length < f.hiveCap(h))) {
        if (f.marketUnlocked(s, 'clover')) opts.push([f.marketPrice(s, 'clover'), () => act.buyBee('clover')]);
        opts.push([f.marketPrice(s, 'meadow') * 4, () => act.buyBee('meadow')]);
      }
      opts.sort((a, c) => a[0] - c[0]);
      if (opts.length && s.coins >= opts[0][0]) opts[0][1]();
    };
    const t0 = performance.now();
    for (let sec = 0; sec < 3 * 3600; sec++) {
      for (let k = 0; k < 10; k++) sim.update(HC.game, 0.1);
      if (sec % 2 === 0) bot();
    }
    const s = HC.game;
    HC.ui.markDirty();
    return { ms: Math.round(performance.now() - t0), species: Object.keys(s.discovered).length, coins: Math.floor(s.coins), goal: s.goal, bees: Object.keys(s.bees).length, customers: sim.rt.customers.length };
  });
  console.log(JSON.stringify(summary));
  await p.waitForTimeout(1500);
  for (const t of ['apiary', 'shop', 'nursery', 'town', 'guide']) {
    await p.click(`.tabs [data-tab="${t}"]`).catch(() => {});
    await p.keyboard.press('Escape');
    await p.click(`.tabs [data-tab="${t}"]`);
    await p.waitForTimeout(400);
    await p.screenshot({ path: path.join(out, `late-${t}.png`), fullPage: true });
  }
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  if (overflow) errors.push('horizontal overflow at late game');
  await b.close();
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'OK late game');
})();
