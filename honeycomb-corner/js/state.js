// =============================================================================
// state.js: THE SAVE FILE
// -----------------------------------------------------------------------------
// Everything the game needs to remember about *your* game lives in one object,
// usually called `s` (for "state") and stored at HC.game. This file:
//   - builds a brand-new game (newGame)
//   - creates new bees (makeBee)
//   - saves to / loads from the browser, and exports/imports save codes
//   - upgrades old saves so new features never break an existing game (migrate)
//
// Things that change every frame but don't need saving (where customers are
// walking, sparkle effects...) are NOT here; they live in HC.sim.rt
// ("runtime") in sim.js and simply restart when the page reloads.
// =============================================================================
(function () {
  const HC = window.HC;
  const { util, data } = HC;

  // ---------------------------------------------------------------------------
  // A fresh game. Each line below is one thing the game remembers.
  // ---------------------------------------------------------------------------
  function newGame() {
    const s = {
      v: 2, // save format version
      created: Date.now(),
      lastSeen: Date.now(), // when you last had the game open (for the away report)
      coins: 20,
      gems: data.GEMS.start,
      lifetime: 0, // coins earned across all festivals, ever
      runEarned: 0, // coins earned since the last festival
      ribbons: 0, // festival rewards: each is +10% sale prices forever
      festivals: 0,
      rep: 1, // reputation, 0 to 5 stars
      time: data.DAY_LENGTH * 0.12, // in-game time of day; starts in the morning
      clock: 0, // seconds the game has been running; timers count against this
      lastDay: 0, // which in-game day wages were last paid for
      playTime: 0,
      // Each hive: its upgrade level, the bees living in it, and the honey
      // waiting inside it to be collected (by product, e.g. {wildflower: 7}).
      hives: [{ level: 0, bees: [], stock: {} }],
      bees: {}, // every bee you own, looked up by its id
      box: [], // ids of spare bees not living in a hive
      store: { wildflower: 6 }, // the storehouse: product -> how many
      unlockedGoods: { wildflower: true }, // products you've made at least once
      shelves: [{ good: 'wildflower', qty: 0 }], // what each shelf sells and holds
      up: {}, // shop upgrade levels, e.g. {sign: 3}
      market: { meadow: 0, clover: 0 }, // how many bees you've bought (prices rise)
      discovered: { meadow: true }, // species in your Field Guide
      sparkleSeen: {}, // species you've had a sparkle of
      triedPairs: {}, // failed breeding attempts per pair (for the pity timer)
      nursery: [null], // breeding cradles: null = empty
      orders: [], // pinned town requests
      nextOrderAt: 90, // seconds until the next request is pinned
      merchant: null,
      nextMerchantAt: 420,
      staff: {}, // hired employees, e.g. {cashier: true}
      machine: null, // the Candle Machine once built: {level, wax, candles, prog}
      builds: [], // upgrades under construction (see builds.js)
      builders: 1, // how many things can be built at the same time
      // Cosmetics: what you own, what you're wearing/using, what's placed.
      cos: { owned: {}, equip: {}, placed: {} },
      stats: {
        sold: 0, customers: 0, disappointed: 0, walkouts: 0, bred: 0, orders: 0, best: 0,
        collected: 0, candles: 0, decor: 0, skips: 0,
      },
      hints: {}, // tutorial messages already shown
      settings: { sfx: true, music: false },
      keepsake: null,
      goal: 0, // which goal in the goal chain you're on
    };
    for (const u of data.UPGRADES) s.up[u.id] = 0;
    applyDefaultCosmetics(s);
    const a = makeBee(s, 'meadow', { vigor: 1 });
    const b = makeBee(s, 'meadow', { vigor: 0.95 });
    s.hives[0].bees.push(a.id, b.id);
    s.hives[0].stock = { wildflower: 4 }; // a little honey waiting, so the first tap does something
    return s;
  }

  // Give a game every "default" cosmetic (bandana, oak walls, display table...)
  // and equip/place them. Safe to run again on an existing save.
  function applyDefaultCosmetics(s) {
    s.cos = s.cos || { owned: {}, equip: {}, placed: {} };
    for (const item of data.CATALOG) {
      if (!item.default && !item.free) continue;
      s.cos.owned[item.id] = true;
      if (!item.default) continue;
      const section = data.STORE_SECTIONS.find((x) => x.cat === item.cat);
      if (section && section.pick) {
        if (!s.cos.equip[item.cat]) s.cos.equip[item.cat] = item.id;
      } else if (s.cos.placed[item.id] === undefined) {
        s.cos.placed[item.id] = true;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Create a new bee of species `sp` and add it to the game.
  // `opts` can set its vigor, sparkle, trait and generation (used when an egg
  // hatches or the merchant sells one). The caller decides where it lives.
  // ---------------------------------------------------------------------------
  function makeBee(s, sp, opts = {}) {
    // Give it a name nobody else has. If all names are taken, add II, III...
    const used = new Set(Object.values(s.bees).map((b) => b.name));
    const free = data.BEE_NAMES.filter((n) => !used.has(n));
    let name = free.length ? util.pick(free) : util.pick(data.BEE_NAMES);
    for (let k = 2; used.has(name); k++) name = name.replace(/ [IVX]+$/, '') + ' ' + ['II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][Math.min(k - 2, 8)];
    const bee = {
      id: util.uid(),
      sp, // species id
      name,
      vigor: opts.vigor != null ? opts.vigor : util.rand(0.85, 1.15), // work speed; 1.0 = 100%
      sparkle: !!opts.sparkle, // rare variant: double output
      trait: opts.trait || null,
      gen: opts.gen || 1, // generation: 1 for bought bees, +1 per breeding
      prog: Math.random(), // progress towards its next unit of honey (0 to 1)
      born: Date.now(),
    };
    s.bees[bee.id] = bee;
    s.discovered[sp] = true;
    if (bee.sparkle) s.sparkleSeen[sp] = true;
    const good = data.species[sp].good;
    if (!s.unlockedGoods[good]) {
      s.unlockedGoods[good] = true;
      // A brand-new sellable product goes straight onto an empty shelf.
      const empty = s.shelves.find((sh) => !sh.good);
      if (empty && !data.good[good].raw) empty.good = good;
    }
    return bee;
  }

  // ---------------------------------------------------------------------------
  // Old saves don't have fields added by later versions (gems, staff...).
  // `migrate` starts from a fresh game and lays the old save on top of it, so
  // anything missing gets a sensible default instead of crashing the game.
  // ---------------------------------------------------------------------------
  function migrate(loaded) {
    const base = newGame();
    const s = Object.assign(base, loaded);
    s.up = Object.assign({}, newGame().up, loaded.up || {});
    s.stats = Object.assign({}, base.stats, loaded.stats || {});
    s.settings = Object.assign({ sfx: true, music: false }, loaded.settings || {});
    s.market = Object.assign({ meadow: 0, clover: 0 }, loaded.market || {});
    if (loaded.gems == null) s.gems = data.GEMS.start;
    if (loaded.clock == null) s.clock = loaded.playTime || 0;
    s.staff = loaded.staff || {};
    s.builds = loaded.builds || [];
    s.cos = loaded.cos || { owned: {}, equip: {}, placed: {} };
    applyDefaultCosmetics(s);
    // Version 1 saves: hives had no honey storage, and Waxwings made candles
    // directly. Give hives empty storage and turn old candle-making into wax.
    s.hives.forEach((h) => (h.stock = h.stock || {}));
    if ((loaded.v || 1) < 2) {
      if (s.unlockedGoods.candle && !s.machine) s.unlockedGoods.wax = true;
      // The goal chain was rewritten: start it again. Goals you've already
      // met can be claimed straight away, a small welcome-back bonus.
      s.goal = 0;
    }
    s.v = 2;
    // Drop references to bees that no longer exist.
    s.hives.forEach((h) => (h.bees = h.bees.filter((id) => s.bees[id])));
    s.box = s.box.filter((id) => s.bees[id]);
    while (s.nursery.length < 1 + (s.up.nursery || 0)) s.nursery.push(null);
    while (s.shelves.length < 1 + (s.up.shelf || 0)) s.shelves.push({ good: null, qty: 0 });
    // Raw ingredients never belong on a shelf.
    s.shelves.forEach((sh) => {
      if (sh.good && data.good[sh.good] && data.good[sh.good].raw) sh.good = null;
    });
    return s;
  }

  // Turn the game into text (JSON) for saving.
  function serialize(s) {
    s.lastSeen = Date.now();
    return JSON.stringify(s);
  }

  // Turn saved text back into a game, checking it looks like one of ours.
  function deserialize(str) {
    const obj = JSON.parse(str);
    if (!obj || typeof obj !== 'object' || !obj.hives || !obj.bees) throw new Error('Not a Honeycomb Corner save');
    return migrate(obj);
  }

  // Save to this browser. Returns false if the browser refused.
  function save(s) {
    return util.store.set(data.SAVE_KEY, serialize(s));
  }

  // Load from this browser, or return null if there's no (readable) save.
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

  // A save "code" is the save text scrambled into letters and numbers
  // (base64) so it can be copied and pasted between devices.
  function exportSave(s) {
    // The extra encode step keeps accented bee names safe in the code.
    return btoa(unescape(encodeURIComponent(serialize(s))));
  }

  function importSave(code) {
    const json = decodeURIComponent(escape(atob(code.trim())));
    return deserialize(json);
  }

  HC.state = { newGame, makeBee, migrate, serialize, deserialize, save, load, exportSave, importSave, applyDefaultCosmetics };
})();
