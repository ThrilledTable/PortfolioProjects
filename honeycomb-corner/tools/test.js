// Mechanics tests that run the real game modules under Node.
// Usage: node tools/test.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const root = path.join(__dirname, '..', 'js');
const files = ['util.js', 'data.js', 'state.js', 'sim.js', 'actions.js', 'goals.js'];

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
  HC.bus.on('fail', () => {});
  return HC;
}

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

test('every species is obtainable from the market or a recipe', (HC) => {
  const D = HC.data;
  const have = new Set(['meadow', 'clover']);
  let grew = true;
  while (grew) {
    grew = false;
    for (const r of D.RECIPES) if (have.has(r.a) && have.has(r.b) && !have.has(r.out)) { have.add(r.out); grew = true; }
  }
  for (const sp of D.SPECIES) assert(have.has(sp.id), sp.id + ' unreachable');
});

test('data references are consistent', (HC) => {
  const D = HC.data;
  for (const sp of D.SPECIES) assert(D.good[sp.good], sp.id + ' makes unknown good ' + sp.good);
  for (const r of D.RECIPES) for (const k of ['a', 'b', 'out']) assert(D.species[r[k]], 'recipe references ' + r[k]);
  const outs = D.RECIPES.map((r) => r.out);
  assert.strictEqual(new Set(outs).size, outs.length, 'one recipe per species');
});

test('new game starts with two meadow bees in hive 1 and wildflower on the shelf', (HC) => {
  const s = HC.game;
  assert.strictEqual(s.hives[0].bees.length, 2);
  assert.strictEqual(s.shelves[0].good, 'wildflower');
});

test('bees produce and customers buy over time', (HC) => {
  const s = HC.game;
  for (let i = 0; i < 20 * 120; i++) HC.sim.update(s, 0.05);
  assert(s.stats.customers > 5, 'served ' + s.stats.customers);
  assert(s.coins > 20, 'coins ' + s.coins);
});

test('buying past hive capacity lands bees in the bee box', (HC) => {
  const s = HC.game;
  s.coins = 1e6;
  HC.act.buyBee('meadow'); // fills hive 1 (cap 3)
  HC.act.buyBee('meadow');
  assert.strictEqual(s.hives[0].bees.length, 3);
  assert.strictEqual(s.box.length, 1);
});

test('breeding pity timer guarantees the recipe after four misses', (HC) => {
  const s = HC.game;
  const a = HC.state.makeBee(s, 'meadow');
  const b = HC.state.makeBee(s, 'clover');
  s.triedPairs['clover+meadow'] = 4;
  const egg = HC.sim.decideEgg(s, a, b);
  assert.strictEqual(egg.sp, 'waxwing');
  assert.strictEqual(s.triedPairs['clover+meadow'], 0);
});

test('same-species eggs keep the species and vigor stays in range', (HC) => {
  const s = HC.game;
  const a = HC.state.makeBee(s, 'meadow', { vigor: 2.4 });
  const b = HC.state.makeBee(s, 'meadow', { vigor: 2.4 });
  for (let i = 0; i < 200; i++) {
    const egg = HC.sim.decideEgg(s, a, b);
    assert.strictEqual(egg.sp, 'meadow');
    assert(egg.vigor >= 0.5 && egg.vigor <= 2.5);
  }
});

test('full breed flow through actions', (HC) => {
  const s = HC.game;
  s.coins = 1e6;
  s.lifetime = 500; // unlocks Clover at the market
  assert(HC.act.buyBee('clover').ok);
  const [m] = s.hives[0].bees;
  const c = Object.values(s.bees).find((b) => b.sp === 'clover').id;
  assert(HC.act.startBreed(0, m, c).ok);
  assert(!HC.act.hatch(0).ok, 'cannot hatch early');
  for (let i = 0; i < 20 * 60; i++) HC.sim.update(s, 0.05);
  assert(s.nursery[0].ready);
  const before = HC.sim.f.beeCount(s);
  assert(HC.act.hatch(0).ok);
  assert.strictEqual(HC.sim.f.beeCount(s), before + 1);
  assert.strictEqual(s.nursery[0], null);
});

test('selling the last bee is refused', (HC) => {
  const s = HC.game;
  const [a, b] = s.hives[0].bees;
  assert(HC.act.sellBee(a).ok);
  assert(!HC.act.sellBee(b).ok);
});

test('shelf reassignment returns stock to the storehouse', (HC) => {
  const s = HC.game;
  HC.sim.restock(s);
  const total = s.shelves[0].qty + (s.store.wildflower || 0);
  s.unlockedGoods.clover = true;
  HC.act.setShelf(0, 'clover');
  assert.strictEqual(s.store.wildflower, total);
});

test('orders deliver for a reward and raise reputation', (HC) => {
  const s = HC.game;
  const o = HC.sim.makeOrder(s);
  s.orders.push(o);
  s.store[o.good] = o.qty;
  const coins = s.coins, rep = s.rep;
  assert(HC.act.deliverOrder(o.id).ok);
  assert.strictEqual(s.coins, coins + o.reward);
  assert(s.rep > rep);
});

test('offline catch-up is capped at 8 hours and earns coins', (HC) => {
  const s = HC.game;
  const r = HC.sim.catchUp(s, 48 * 3600);
  assert.strictEqual(r.seconds, 8 * 3600);
  assert(r.coins > 0);
});

test('storehouse never exceeds its cap; Honey Cart sells overflow', (HC) => {
  const s = HC.game;
  s.shelves[0].good = null; // stop sales
  HC.sim.catchUp(s, 3600);
  assert.strictEqual(s.store.wildflower, HC.sim.f.storageCap(s));
  s.up.cart = 1;
  const coins = s.coins;
  HC.sim.catchUp(s, 600);
  assert(s.coins > coins, 'cart earned');
});

test('save round-trips through export/import and survives missing fields', (HC) => {
  const s = HC.game;
  s.coins = 12345;
  const back = HC.state.importSave(HC.state.exportSave(s));
  assert.strictEqual(back.coins, 12345);
  const old = JSON.parse(HC.state.serialize(s));
  delete old.goal;
  delete old.up.samples;
  delete old.stats;
  const migrated = HC.state.deserialize(JSON.stringify(old));
  assert.strictEqual(migrated.goal, 0);
  assert.strictEqual(migrated.up.samples, 0);
  assert.strictEqual(migrated.stats.sold, 0);
});

test('festival resets the run, keeps the guide, ribbons and keepsake', (HC) => {
  const s = HC.game;
  s.runEarned = 4e7;
  s.discovered.royal = true;
  const keep = s.hives[0].bees[0];
  assert(HC.act.holdFestival(keep).ok);
  const n = HC.game;
  assert.strictEqual(n.ribbons, 4);
  assert(n.discovered.royal);
  assert(n.bees[keep], 'keepsake kept');
  assert.strictEqual(n.hives.length, 1);
  assert.strictEqual(n.runEarned, 0);
});

test('goals claim in order and pay out', (HC) => {
  const s = HC.game;
  assert(!HC.goals.claim().ok, 'first goal not met yet');
  s.coins = 1000;
  HC.act.buyBee('meadow');
  const coins = s.coins;
  assert(HC.goals.claim().ok);
  assert.strictEqual(s.goal, 1);
  assert.strictEqual(s.coins, coins + HC.goals.GOALS[0].reward);
});

test('customer AI never gets stuck over a long live run', (HC) => {
  const s = HC.game;
  s.coins = 1e6;
  for (let i = 0; i < 3; i++) HC.act.buyUpgrade('shelf');
  HC.act.buyUpgrade('sign');
  let maxAge = 0;
  const born = new Map();
  for (let i = 0; i < 20 * 900; i++) {
    HC.sim.update(s, 0.05);
    for (const c of HC.sim.rt.customers) {
      if (!born.has(c.id)) born.set(c.id, i);
      maxAge = Math.max(maxAge, (i - born.get(c.id)) * 0.05);
    }
  }
  assert(maxAge < 90, 'a customer lingered ' + maxAge.toFixed(0) + 's');
  assert(HC.sim.rt.queue.every((c) => HC.sim.rt.customers.includes(c)), 'queue holds departed customers');
});

console.log(`\n${passed} passed${process.exitCode ? ', some FAILED' : ''}`);
