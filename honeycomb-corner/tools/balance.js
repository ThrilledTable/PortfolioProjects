// Balance check: plays the real game code headlessly with a simple "bot"
// player and reports when milestones are reached. Used to tune pacing.
// Usage: node tools/balance.js [hours] [runs] [secondsBetweenBotActions]
//   e.g. node tools/balance.js 6 2 10   -> two 6-hour runs, bot acts every 10s
// A smaller last number = a more attentive player.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const BOT_EVERY = Number(process.argv[4] || 5);
const root = path.join(__dirname, '..', 'js');
const files = ['util.js', 'data.js', 'state.js', 'nav.js', 'sim.js', 'builds.js', 'customers.js', 'workers.js', 'actions.js', 'goals.js'];

function boot() {
  const store = {};
  const ctx = {
    console, Math, JSON, Date, Object, Array, Set, Map, String, Number, Error, isFinite, btoa, atob, escape, unescape,
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
  HC.bus.on('fail', () => {});

  const milestones = {};
  const mark = (k, t) => { if (!(k in milestones)) milestones[k] = t; };
  const dt = 0.1;
  let t = 0, nextBot = 0;

  function bot() {
    const s = HC.game;
    HC.goals.claim();
    // Shelves: best sellable goods first.
    const goods = D.GOODS.filter((g) => s.unlockedGoods[g.id] && !g.raw).map((g) => g.id).reverse();
    s.shelves.forEach((sh, i) => { if (goods[i] && sh.good !== goods[i]) act.setShelf(i, goods[i]); });
    // Send the keeper for honey (a player tapping hives), unless a collector does it.
    if (!s.staff.collector) s.hives.forEach((h, i) => { if (f.honeyIn(h) / f.honeyCap(h) > 0.5) act.collect(i); });
    if (s.machine && !s.staff.candler && (s.machine.candles > 3 || (s.store.wax > 5 && s.machine.wax < 3))) act.tendMachine();
    for (const o of [...s.orders]) if ((s.store[o.good] || 0) >= o.qty) act.deliverOrder(o.id);
    s.nursery.forEach((n, i) => n && n.ready && act.hatch(i));
    // Breeding: prefer the highest recipe we can do and still need.
    const busy = f.busyBees(s);
    s.nursery.forEach((n, i) => {
      if (n) return;
      const free = Object.values(s.bees).filter((b) => !busy.has(b.id));
      const count = (sp) => Object.values(s.bees).filter((b) => b.sp === sp).length;
      for (const r of [...D.RECIPES].sort((a, b) => D.species[b.out].tier - D.species[a.out].tier)) {
        if (count(r.out) >= 6) continue;
        const a = free.find((b) => b.sp === r.a);
        const b = free.find((x) => x.sp === r.b && x !== a);
        if (a && b && s.coins >= f.breedCost(a, b) * 1.5) { act.startBreed(i, a.id, b.id); busy.add(a.id).add(b.id); return; }
      }
    });
    // Put better bees into hives.
    const val = (b) => f.beeValue(b);
    for (const id of [...s.box]) {
      for (let hi = 0; hi < s.hives.length; hi++) {
        const h = s.hives[hi];
        if (h.bees.length < f.hiveCap(h)) { act.moveBee(id, hi); break; }
        const worst = h.bees.filter((x) => !busy.has(x)).reduce((m, x) => (!m || val(s.bees[x]) < val(s.bees[m]) ? x : m), null);
        if (worst && val(s.bees[id]) > val(s.bees[worst]) * 1.2) { act.swapBee(id, hi, worst); break; }
      }
    }
    if (s.box.length > f.boxCap(s) - 2) act.sellExtras();
    // Staff, in a sensible order, when there's a comfortable buffer.
    for (const st of ['cashier', 'collector', 'stocker', 'candler']) {
      const d = D.staff[st];
      if (!s.staff[st] && (st !== 'candler' || s.machine) && s.coins > d.hire + d.wage * 3) act.hire(st);
    }
    if (s.discovered.waxwing && !s.machine) act.buildMachine();
    // Use gems only on nearly-finished builds (a thrifty player).
    for (const b of s.builds) if (f.gemsToSkip(HC.builds.left(s, b)) <= 2 && s.gems > 20) act.skipBuild(b.id);
    // Spend: the cheapest useful thing.
    const options = [];
    if (s.hives.length < 6) options.push([f.hiveCost(s) * 0.8, () => act.buildHive()]);
    s.hives.forEach((h, i) => h.level < 5 && options.push([f.hiveUpgradeCost(s, i), () => act.upgradeHive(i)]));
    for (const u of D.UPGRADES) {
      if (s.up[u.id] >= u.max) continue;
      if (u.id === 'nursery' && s.up.nursery >= 1 && !s.discovered.royal) continue;
      options.push([f.upgradeCost(s, u.id) * (u.id === 'shelf' ? 0.6 : 1), () => act.buyUpgrade(u.id)]);
    }
    if (s.machine && s.machine.level < 5) options.push([f.machineUpgradeCost(s) * 1.5, () => act.upgradeMachine()]);
    if (s.hives.some((h) => h.bees.length < f.hiveCap(h))) {
      if (f.marketUnlocked(s, 'clover')) options.push([f.marketPrice(s, 'clover') * 0.7, () => act.buyBee('clover')]);
      options.push([f.marketPrice(s, 'meadow') * (f.marketUnlocked(s, 'clover') ? 4 : 1), () => act.buyBee('meadow')]);
    }
    options.sort((a, b) => a[0] - b[0]);
    if (options.length && s.coins >= options[0][0] * 1.25) options[0][1]();
  }

  while (t < hours * 3600) {
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
    for (const st of Object.keys(s.staff)) if (s.staff[st]) mark('hire:' + st, t);
    if (s.machine) mark('machine', t);
    mark('goal' + s.goal, t);
  }
  return { milestones, s: HC.game, rate: sim.incomePerMin() };
}

const hours = Number(process.argv[2] || 3);
const runs = Number(process.argv[3] || 1);
const fmtT = (t) => (t / 60).toFixed(1) + 'm';
for (let r = 0; r < runs; r++) {
  const { milestones, s, rate } = run(hours);
  console.log('--- run', r + 1, `(${hours}h, bot every ${BOT_EVERY}s)`);
  const keys = Object.entries(milestones).filter(([k]) => !/^goal/.test(k) || [5, 10, 15, 20, 25, 30].includes(Number(k.slice(4))));
  console.log(keys.sort((a, b) => a[1] - b[1]).map(([k, t]) => `${k.padEnd(16)} ${fmtT(t)}`).join('\n'));
  console.log('coins', Math.floor(s.coins), 'gems', s.gems, 'lifetime', Math.floor(s.lifetime), 'rep', s.rep.toFixed(2), 'income/min', Math.floor(rate), 'goal', s.goal);
  console.log('stats', JSON.stringify(s.stats));
}
