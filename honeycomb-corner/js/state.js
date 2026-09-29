// Game state: creation, bee factory, save/load and import/export.
(function () {
  const HC = window.HC;
  const { util, data } = HC;

  function newGame() {
    const s = {
      v: 1,
      created: Date.now(),
      lastSeen: Date.now(),
      coins: 20,
      lifetime: 0, // coins earned across all festivals
      runEarned: 0, // coins earned since the last festival
      ribbons: 0,
      festivals: 0,
      rep: 1,
      time: data.DAY_LENGTH * 0.12, // start in the morning
      playTime: 0,
      hives: [{ level: 0, bees: [] }],
      bees: {},
      box: [],
      store: { wildflower: 6 },
      unlockedGoods: { wildflower: true },
      shelves: [{ good: 'wildflower', qty: 0 }],
      up: {},
      market: { meadow: 0, clover: 0 },
      discovered: { meadow: true },
      sparkleSeen: {},
      triedPairs: {},
      nursery: [null],
      orders: [],
      nextOrderAt: 70,
      merchant: null,
      nextMerchantAt: 360,
      stats: { sold: 0, customers: 0, disappointed: 0, bred: 0, hatched: 0, orders: 0, best: 0 },
      hints: {},
      settings: { sfx: true, music: false },
      keepsake: null,
      goal: 0,
    };
    for (const u of data.UPGRADES) s.up[u.id] = 0;
    const a = makeBee(s, 'meadow', { vigor: 1 });
    const b = makeBee(s, 'meadow', { vigor: 0.95 });
    s.hives[0].bees.push(a.id, b.id);
    return s;
  }

  function makeBee(s, sp, opts = {}) {
    const used = new Set(Object.values(s.bees).map((b) => b.name));
    const free = data.BEE_NAMES.filter((n) => !used.has(n));
    let name = free.length ? util.pick(free) : util.pick(data.BEE_NAMES);
    // Pool exhausted: add a generation-style suffix, e.g. "Pip II".
    for (let k = 2; used.has(name); k++) name = name.replace(/ [IVX]+$/, '') + ' ' + ['II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][Math.min(k - 2, 8)];
    const bee = {
      id: util.uid(),
      sp,
      name,
      vigor: opts.vigor != null ? opts.vigor : util.rand(0.85, 1.15),
      sparkle: !!opts.sparkle,
      trait: opts.trait || null,
      gen: opts.gen || 1,
      prog: Math.random(),
      born: Date.now(),
    };
    s.bees[bee.id] = bee;
    s.discovered[sp] = true;
    if (bee.sparkle) s.sparkleSeen[sp] = true;
    const good = data.species[sp].good;
    if (!s.unlockedGoods[good]) {
      s.unlockedGoods[good] = true;
      // A brand-new product goes straight onto an empty shelf if there is one.
      const empty = s.shelves.find((sh) => !sh.good);
      if (empty) empty.good = good;
    }
    return bee;
  }

  // Fill any fields missing from older saves with defaults, so new features
  // never crash an existing save.
  function migrate(loaded) {
    const base = newGame();
    const s = Object.assign(base, loaded);
    s.up = Object.assign({}, newGame().up, loaded.up || {});
    s.stats = Object.assign({}, base.stats, loaded.stats || {});
    s.settings = Object.assign({ sfx: true, music: false }, loaded.settings || {});
    s.market = Object.assign({ meadow: 0, clover: 0 }, loaded.market || {});
    // Drop references to bees that no longer exist.
    s.hives.forEach((h) => (h.bees = h.bees.filter((id) => s.bees[id])));
    s.box = s.box.filter((id) => s.bees[id]);
    while (s.nursery.length < 1 + (s.up.nursery || 0)) s.nursery.push(null);
    while (s.shelves.length < 1 + (s.up.shelf || 0)) s.shelves.push({ good: null, qty: 0 });
    return s;
  }

  function serialize(s) {
    s.lastSeen = Date.now();
    return JSON.stringify(s);
  }

  function deserialize(str) {
    const obj = JSON.parse(str);
    if (!obj || typeof obj !== 'object' || !obj.hives || !obj.bees) throw new Error('Not a Honeycomb Corner save');
    return migrate(obj);
  }

  function save(s) {
    return util.store.set(data.SAVE_KEY, serialize(s));
  }

  function load() {
    const raw = util.store.get(data.SAVE_KEY);
    if (!raw) return null;
    try {
      return deserialize(raw);
    } catch (e) {
      console.warn('Save could not be read, starting fresh.', e);
      return null;
    }
  }

  function exportSave(s) {
    // btoa needs Latin-1; encode UTF-8 first so bee names with accents survive.
    return btoa(unescape(encodeURIComponent(serialize(s))));
  }

  function importSave(code) {
    const json = decodeURIComponent(escape(atob(code.trim())));
    return deserialize(json);
  }

  HC.state = { newGame, makeBee, migrate, serialize, deserialize, save, load, exportSave, importSave };
})();
