// Headless balance check: runs the real sim with a greedy bot and reports when
// milestones are reached. Usage: node tools/balance.js [hours] [runs] [secondsBetweenBotActions]
const fs = require('fs');
const BOT_EVERY = Number(process.argv[4] || 1); // seconds between bot decisions
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..', 'js');
const files = ['util.js', 'data.js', 'state.js', 'sim.js', 'actions.js', 'goals.js'];

function boot() {
  const store = {};
  const ctx = {
    console,
    Math, JSON, Date, Object, Array, Set, Map, String, Number, Error, isFinite, btoa, atob, escape, unescape,
    encodeURIComponent, decodeURIComponent,
    localStorage: { getItem: (k) => store[k] ?? null, setItem: (k, v) => (store[k] = v), removeItem: (k) => delete store[k] },
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  for (const f of files) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
  return ctx.HC;
}

function run(hours) {
  const HC = boot();
  const { sim, act, data: D } = HC;
  const f = sim.f;
  HC.game = HC.state.newGame();
  sim.resetRuntime();
  const quiet = () => {};
  HC.bus.on('fail', quiet);

  const milestones = {};
  const mark = (k, t) => { if (!(k in milestones)) milestones[k] = t; };
  const dt = 0.1;
  const total = hours * 3600;
  let t = 0;
  let nextBot = 0;

  function bot() {
    const s = HC.game;
    // Shelves: best unlocked goods, highest first.
    const goods = D.GOODS.filter((g) => s.unlockedGoods[g.id]).map((g) => g.id).reverse();
    s.shelves.forEach((sh, i) => {
      const want = goods[i] || null;
      if (sh.good !== want && want) act.setShelf(i, want);
    });
    HC.goals.claim();
    // Orders
    for (const o of [...s.orders]) if ((s.store[o.good] || 0) >= o.qty) act.deliverOrder(o.id);
    // Hatch
    s.nursery.forEach((n, i) => n && n.ready && act.hatch(i));
    // Breed: find a recipe whose parents we own and whose output we lack or have few of.
    s.nursery.forEach((n, i) => {
      if (n) return;
      const busy = new Set(s.nursery.filter(Boolean).flatMap((x) => [x.a, x.b]));
      const bees = Object.values(s.bees).filter((b) => !busy.has(b.id));
      const count = (sp) => Object.values(s.bees).filter((b) => b.sp === sp).length;
      const recipes = [...D.RECIPES].sort((a, b) => D.species[b.out].tier - D.species[a.out].tier);
      for (const r of recipes) {
        if (count(r.out) >= 6) continue;
        const a = bees.find((b) => b.sp === r.a);
        const b = bees.find((x) => x.sp === r.b && x !== a);
        if (a && b && s.coins >= f.breedCost(a, b) * 1.5) {
          act.startBreed(i, a.id, b.id);
          return;
        }
      }
    });
    // Replace weakest hive bee with better box bee.
    const val = (b) => f.beeValue(b);
    for (const id of [...s.box]) {
      for (let hi = 0; hi < s.hives.length; hi++) {
        const h = s.hives[hi];
        if (h.bees.length < f.hiveCap(h)) { act.moveBee(id, hi); break; }
        const worst = h.bees.reduce((m, x) => (val(s.bees[x]) < val(s.bees[m]) ? x : m), h.bees[0]);
        if (worst && val(s.bees[id]) > val(s.bees[worst]) * 1.2) { act.swapBee(id, hi, worst); break; }
      }
    }
    // Box overflow: sell weakest box bees.
    const busyIds = new Set(s.nursery.filter(Boolean).flatMap((x) => [x.a, x.b]));
    const sellable = s.box.filter((x) => !busyIds.has(x));
    while (s.box.length > f.boxCap(s) - 2 && sellable.length) {
      sellable.sort((a, b) => val(s.bees[a]) - val(s.bees[b]));
      act.sellBee(sellable.shift());
    }
    // Purchases: pick the cheapest of a few options.
    const options = [];
    if (s.hives.length < 6) options.push([f.hiveCost(s) * 0.8, () => act.buildHive()]);
    s.hives.forEach((h, i) => h.level < 5 && options.push([f.hiveUpgradeCost(s, i), () => act.upgradeHive(i)]));
    for (const u of D.UPGRADES) {
      if (s.up[u.id] >= u.max) continue;
      if (u.id === 'nursery' && s.up.nursery >= 1 && !s.discovered.royal) continue;
      options.push([f.upgradeCost(s, u.id) * (u.id === 'shelf' ? 0.6 : 1), () => act.buyUpgrade(u.id)]);
    }
    const hasSpace = s.hives.some((h) => h.bees.length < f.hiveCap(h));
    if (hasSpace) {
      if (f.marketUnlocked(s, 'clover')) options.push([f.marketPrice(s, 'clover') * 0.7, () => act.buyBee('clover')]);
      options.push([f.marketPrice(s, 'meadow') * (f.marketUnlocked(s, 'clover') ? 4 : 1), () => act.buyBee('meadow')]);
    }
    if (s.merchant && s.coins > s.merchant.offer.price * 1.5 && D.species[s.merchant.offer.sp].tier >= 2) options.push([s.merchant.offer.price, () => act.buyMerchant()]);
    options.sort((a, b) => a[0] - b[0]);
    if (options.length && s.coins >= options[0][0] / (options[0][0] === f.hiveCost(s) * 0.8 ? 0.8 : 1)) options[0][1]();
  }

  while (t < total) {
    sim.update(HC.game, dt);
    t += dt;
    if (t >= nextBot) {
      bot();
      nextBot = t + BOT_EVERY;
    }
    const s = HC.game;
    for (const sp of D.SPECIES) if (s.discovered[sp.id]) mark(sp.id, t);
    for (const k of [1e3, 1e4, 1e5, 1e6, 1e7]) if (s.lifetime >= k) mark('₵' + k.toExponential(0), t);
    mark('hive' + s.hives.length, t);
  }
  const s = HC.game;
  return { milestones, s, rate: sim.incomePerMin() };
}

const hours = Number(process.argv[2] || 3);
const runs = Number(process.argv[3] || 1);
const fmtT = (t) => (t / 60).toFixed(1) + 'm';
for (let r = 0; r < runs; r++) {
  const { milestones, s, rate } = run(hours);
  console.log('--- run', r + 1, `(${hours}h)`);
  console.log(Object.entries(milestones).sort((a, b) => a[1] - b[1]).map(([k, t]) => `${k.padEnd(10)} ${fmtT(t)}`).join('\n'));
  console.log('coins', Math.floor(s.coins), 'lifetime', Math.floor(s.lifetime), 'rep', s.rep.toFixed(2), 'income/min', Math.floor(rate));
  console.log('upgrades', JSON.stringify(s.up));
  console.log('hives', s.hives.map((h) => `L${h.level}:` + h.bees.map((id) => s.bees[id].sp.slice(0, 4)).join(',')).join(' | '));
  console.log('stats', JSON.stringify(s.stats));
}
