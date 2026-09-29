// Mechanics tests: runs the real game code under Node (no browser) and checks
// each rule behaves as intended. Usage: node tools/test.js
//
// Each test gets a fresh game. `advance(HC, secs)` runs the simulation for
// that many seconds in 0.05s steps, exactly like the live game does.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const root = path.join(__dirname, '..', 'js');
const files = ['util.js', 'data.js', 'state.js', 'nav.js', 'sim.js', 'builds.js', 'customers.js', 'workers.js', 'actions.js', 'goals.js'];

function boot() {
  const store = {};
  const ctx = {
    console, Math, JSON, Date, Object, Array, Set, Map, String, Number, Error, isFinite,
    btoa, atob, escape, unescape, encodeURIComponent, decodeURIComponent,
    localStorage: { getItem: (k) => store[k] ?? null, setItem: (k, v) => (store[k] = v), removeItem: (k) => delete store[k] },
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  for (const f of files) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
  const HC = ctx.HC;
  HC.game = HC.state.newGame();
  HC.sim.resetRuntime();
  HC.workers.cancelErrands();
  HC.bus.on('fail', () => {});
  return HC;
}
const advance = (HC, secs) => { for (let i = 0; i < secs * 20; i++) HC.sim.update(HC.game, 0.05); };
// Put the clock at a given fraction of the day (0.1 = morning, 0.8 = night).
const setDay = (HC, frac) => { const D = HC.data; HC.game.time = Math.floor(HC.game.time / D.DAY_LENGTH) * D.DAY_LENGTH + frac * D.DAY_LENGTH; };

let passed = 0;
function test(name, fn) {
  try {
    fn(boot());
    passed++;
    console.log('  ok  ' + name);
  } catch (e) {
    console.log('  FAIL ' + name + '\n       ' + e.message);
    process.exitCode = 1;
  }
}

// ---- Data ------------------------------------------------------------------
test('every species is obtainable from the market or a recipe', (HC) => {
  const have = new Set(['meadow', 'clover']);
  let grew = true;
  while (grew) {
    grew = false;
    for (const r of HC.data.RECIPES) if (have.has(r.a) && have.has(r.b) && !have.has(r.out)) { have.add(r.out); grew = true; }
  }
  for (const sp of HC.data.SPECIES) assert(have.has(sp.id), sp.id + ' unreachable');
});

test('data references are consistent', (HC) => {
  const D = HC.data;
  for (const sp of D.SPECIES) assert(D.good[sp.good], sp.id + ' makes unknown good ' + sp.good);
  for (const r of D.RECIPES) for (const k of ['a', 'b', 'out']) assert(D.species[r[k]], 'recipe references ' + r[k]);
  const cats = new Set(D.STORE_SECTIONS.map((x) => x.cat));
  for (const it of D.CATALOG) {
    assert(cats.has(it.cat), it.id + ' has unknown category');
    assert(it.default || it.free || it.cost, it.id + ' has no price');
  }
  for (const sec of D.STORE_SECTIONS.filter((x) => x.pick)) assert(D.CATALOG.some((it) => it.cat === sec.cat && it.default), sec.cat + ' needs a default');
});

test('new game: two meadow bees, honey waiting in hive 1, default cosmetics', (HC) => {
  const s = HC.game;
  assert.strictEqual(s.hives[0].bees.length, 2);
  assert(HC.sim.f.honeyIn(s.hives[0]) > 0);
  assert.strictEqual(s.cos.equip.hat, 'hat-bandana');
  assert(s.cos.placed['deco-table']);
  assert.strictEqual(HC.workers.list.length, 1, 'just the shopkeeper');
});

// ---- Honey collection loop -------------------------------------------------------
test('hives fill up to their cap and then bees stop', (HC) => {
  const s = HC.game;
  s.shelves[0].good = null; // nobody restocking noise
  advance(HC, 600);
  const h = s.hives[0];
  assert.strictEqual(HC.sim.f.honeyIn(h), HC.sim.f.honeyCap(h));
  assert(HC.sim.f.hiveFull(h));
});

test('bees raising an egg rest instead of making honey', (HC) => {
  const s = HC.game;
  const [a, b] = s.hives[0].bees;
  s.hives[0].stock = {};
  s.coins = 1000;
  assert(HC.act.startBreed(0, a, b).ok);
  s.nursery[0].dur = 9999;
  advance(HC, 60);
  assert.strictEqual(HC.sim.f.honeyIn(s.hives[0]), 0);
});

test('tapping a hive sends the keeper out, honey ends up in the storehouse', (HC) => {
  const s = HC.game;
  s.hives[0].stock = { wildflower: 10 };
  s.store = {};
  s.shelves[0].good = null;
  assert(HC.act.collect(0).ok);
  advance(HC, 3);
  assert(HC.workers.keeper().job, 'keeper should be on the job');
  advance(HC, 60);
  assert(s.store.wildflower >= 10, 'store has ' + s.store.wildflower);
  assert(s.stats.collected >= 10);
  assert.strictEqual(HC.workers.keeper().node, 'DESK', 'keeper back at the register');
});

test('customers wait while nobody is at the register, then walk out', (HC) => {
  const s = HC.game;
  setDay(HC, 0.1);
  s.shelves[0].qty = 6;
  s.store = { wildflower: 40 };
  // Send the keeper on a long errand and keep them busy.
  s.hives[0].stock = { wildflower: 5 };
  for (let i = 0; i < 20; i++) {
    advance(HC, 5);
    if (!HC.workers.keeper().job) HC.workers.keeperJobs.push({ type: 'collect', hive: 0 }), (s.hives[0].stock = { wildflower: 5 });
  }
  assert(s.stats.walkouts > 0 || s.stats.customers < 5, 'expected lost customers while unattended');
});

test('a cashier lets customers pay while the keeper is out', (HC) => {
  const s = HC.game;
  setDay(HC, 0.05);
  s.coins = 1000;
  assert(HC.act.hire('cashier').ok);
  advance(HC, 10); // cashier walks in
  s.store = { wildflower: 40 };
  const before = s.stats.customers;
  for (let i = 0; i < 24; i++) {
    advance(HC, 5);
    if (!HC.workers.keeper().job) { s.hives[0].stock = { wildflower: 5 }; HC.workers.keeperJobs.push({ type: 'collect', hive: 0 }); }
  }
  assert(s.stats.customers - before >= 3, 'served ' + (s.stats.customers - before));
});

test('no customers come in at night', (HC) => {
  const s = HC.game;
  setDay(HC, 0.72);
  HC.sim.rt.customers = [];
  advance(HC, 60);
  assert.strictEqual(HC.sim.rt.customers.filter((c) => c.kind === 'customer').length, 0);
});

// ---- Timed builds and gems ------------------------------------------------------
test('upgrades take time, and gems finish them early', (HC) => {
  const s = HC.game;
  s.coins = 100000;
  assert(HC.act.buyUpgrade('sign').ok);
  assert.strictEqual(s.up.sign, 0, 'not applied yet');
  assert(!HC.act.buyUpgrade('labels').ok, 'only one builder');
  const b = s.builds[0];
  advance(HC, b.dur + 1);
  assert.strictEqual(s.up.sign, 1, 'applied when the timer ends');
  assert(HC.act.buyUpgrade('labels').ok);
  const gems = s.gems;
  assert(HC.act.skipBuild(s.builds[0].id).ok);
  assert.strictEqual(s.up.labels, 1);
  assert(s.gems < gems);
});

test('build times scale from under a minute to hours', (HC) => {
  const t = HC.sim.f.buildTime;
  assert(t(100) < 90, 'cheap build ' + t(100));
  assert(t(1e6) > 600 && t(1e6) < 3600, 'mid build ' + t(1e6));
  assert(t(1e9) >= 3 * 3600, 'late build ' + t(1e9));
});

test('a new hive appears only when its build completes', (HC) => {
  const s = HC.game;
  s.coins = 1000;
  assert(HC.act.buildHive().ok);
  assert.strictEqual(s.hives.length, 1);
  advance(HC, s.builds[0].dur + 1);
  assert.strictEqual(s.hives.length, 2);
});

// ---- Candle machine -----------------------------------------------------------
test('the candle machine turns wax into candles, and tending brings them in', (HC) => {
  const s = HC.game;
  s.coins = 5000;
  s.discovered.waxwing = true;
  assert(HC.act.buildMachine().ok);
  advance(HC, s.builds[0].dur + 1);
  assert(s.machine, 'machine built');
  s.store = { wax: 30 };
  s.shelves[0].good = null;
  assert(HC.act.tendMachine().ok);
  advance(HC, 40);
  assert(s.machine.wax <= HC.sim.f.machineCap(s), 'never overfilled');
  advance(HC, 120);
  assert(s.stats.candles > 0, 'made candles');
  assert(HC.act.tendMachine().ok);
  advance(HC, 40);
  assert((s.store.candle || 0) > 0, 'candles carried to the storehouse');
});

// ---- Staff and wages ----------------------------------------------------------
test('wages are paid each morning; staff quit if you cannot pay', (HC) => {
  const s = HC.game;
  s.coins = 2000;
  HC.act.hire('cashier');
  HC.act.hire('stocker');
  const after = s.coins;
  s.time = (s.lastDay + 1) * HC.data.DAY_LENGTH + 1; // next morning
  advance(HC, 0.1);
  assert.strictEqual(s.coins, after - 80, 'paid 30 + 50');
  s.coins = 40;
  s.time = (s.lastDay + 1) * HC.data.DAY_LENGTH + 1;
  advance(HC, 0.1);
  assert(!s.staff.stocker, 'the stocker quit');
  assert(s.staff.cashier, 'the cashier stayed and was paid');
});

test('a collector brings in honey on their own', (HC) => {
  const s = HC.game;
  s.coins = 2000;
  HC.act.hire('collector');
  s.hives[0].stock = { wildflower: 14 };
  s.store = {};
  s.shelves[0].good = null;
  advance(HC, 90);
  assert((s.store.wildflower || 0) > 0);
});

// ---- Requests, store, misc ------------------------------------------------------
test('requests are pinned by a townsperson walking to the board', (HC) => {
  const s = HC.game;
  const o = HC.sim.makeOrder(s);
  HC.customers.spawnRequester(s, o);
  assert.strictEqual(s.orders.length, 0);
  advance(HC, 15);
  assert.strictEqual(s.orders.length, 1);
});

test('store items cost coins or gems; decorations add bonuses', (HC) => {
  const s = HC.game;
  s.coins = 1000;
  s.gems = 20;
  const boost = HC.sim.f.customerBoost(s);
  assert(HC.act.buyItem('deco-chalk').ok);
  assert(HC.sim.f.customerBoost(s) > boost, 'chalkboard adds customers');
  assert(HC.act.buyItem('hat-beret').ok);
  assert.strictEqual(s.cos.equip.hat, 'hat-beret');
  assert.strictEqual(s.gems, 12);
  assert(!HC.act.buyItem('hive-royal').ok, 'not enough gems');
  HC.act.useItem('deco-chalk');
  assert(!s.cos.placed['deco-chalk'], 'put away');
});

test('away time: hives cap without a collector, timers keep running past 8 hours', (HC) => {
  const s = HC.game;
  s.coins = 100000;
  HC.act.buyUpgrade('storage');
  const r = HC.sim.catchUp(s, 12 * 3600);
  assert(r.fullHives.includes(0), 'hive 1 full');
  assert.strictEqual(s.builds.length, 0, 'build finished while away');
  assert.strictEqual(s.up.storage, 1);
});

test('save round-trips and old saves are upgraded', (HC) => {
  const s = HC.game;
  s.coins = 12345;
  const back = HC.state.importSave(HC.state.exportSave(s));
  assert.strictEqual(back.coins, 12345);
  const old = JSON.parse(HC.state.serialize(s));
  delete old.gems; delete old.cos; delete old.staff; delete old.builds; delete old.clock;
  old.v = 1;
  old.hives.forEach((h) => delete h.stock);
  old.shelves = [{ good: 'wax', qty: 3 }];
  const m = HC.state.deserialize(JSON.stringify(old));
  assert.strictEqual(m.gems, HC.data.GEMS.start);
  assert.strictEqual(Object.keys(m.hives[0].stock).length, 0, 'empty hive storage added');
  assert.strictEqual(m.cos.equip.hat, 'hat-bandana');
  assert.strictEqual(m.shelves[0].good, null, 'raw goods removed from shelves');
  assert.strictEqual(m.goal, 0, 'goal chain restarts for old saves');
});

test('festival keeps cosmetics, gems, ribbons and the keepsake', (HC) => {
  const s = HC.game;
  s.runEarned = 4e7;
  s.gems = 30;
  s.cos.owned['hat-straw'] = true;
  s.cos.equip.hat = 'hat-straw';
  const keep = s.hives[0].bees[0];
  assert(HC.act.holdFestival(keep).ok);
  const n = HC.game;
  assert.strictEqual(n.ribbons, 4);
  assert.strictEqual(n.gems, 30 + HC.data.GEMS.festival);
  assert.strictEqual(n.cos.equip.hat, 'hat-straw');
  assert(n.bees[keep]);
});

test('goals pay coins and gems', (HC) => {
  const s = HC.game;
  assert(!HC.goals.claim().ok, 'not done yet');
  s.stats.collected = 1;
  const gems = s.gems;
  assert(HC.goals.claim().ok);
  assert.strictEqual(s.gems, gems + HC.goals.GOALS[0].gems);
});

test('sell extras keeps the best of each species, sparkles and nursery bees', (HC) => {
  const s = HC.game;
  const mk = (sp, vigor, extra = {}) => {
    const b = HC.state.makeBee(s, sp, Object.assign({ vigor }, extra));
    s.box.push(b.id);
    return b;
  };
  const bestM = mk('meadow', 1.5);
  mk('meadow', 0.9);
  mk('meadow', 1.0);
  const spark = mk('meadow', 0.7, { sparkle: true });
  const busy = mk('clover', 0.8);
  const bestC = mk('clover', 1.2);
  s.nursery[0] = { a: busy.id, b: s.hives[0].bees[0], t: 0, dur: 99, ready: false };
  assert.strictEqual(HC.act.sellExtras(true).count, 2);
  assert(HC.act.sellExtras().ok);
  for (const b of [bestM, spark, busy, bestC]) assert(s.bees[b.id], 'kept ' + b.name);
});

test('bee names stay unique past the name pool', (HC) => {
  const s = HC.game;
  for (let i = 0; i < 200; i++) HC.state.makeBee(s, 'meadow');
  const names = Object.values(s.bees).map((b) => b.name);
  assert.strictEqual(new Set(names).size, names.length);
});

test('nobody gets stuck over a long run with a full staff', (HC) => {
  const s = HC.game;
  s.coins = 1e6;
  s.discovered.waxwing = true;
  for (const id of ['cashier', 'stocker', 'collector']) HC.act.hire(id);
  HC.act.buildMachine();
  advance(HC, s.builds[0].dur + 1);
  HC.act.hire('candler');
  s.store.wax = 40;
  let maxAge = 0;
  const born = new Map();
  for (let i = 0; i < 20 * 1200; i++) {
    HC.sim.update(s, 0.05);
    for (const c of HC.sim.rt.customers) {
      if (!born.has(c.id)) born.set(c.id, i);
      maxAge = Math.max(maxAge, (i - born.get(c.id)) * 0.05);
    }
    for (const w of HC.sim.rt.workers) if (w.job) w.jobAge = (w.jobAge || 0) + 0.05; else w.jobAge = 0;
    assert(HC.sim.rt.workers.every((w) => (w.jobAge || 0) < 120), 'a worker has been on one job for 2 minutes');
  }
  assert(maxAge < 150, 'a customer lingered ' + maxAge.toFixed(0) + 's');
  assert(HC.sim.rt.queue.every((c) => HC.sim.rt.customers.includes(c)), 'queue holds departed customers');
});

console.log(`\n${passed} passed${process.exitCode ? ', some FAILED' : ''}`);
