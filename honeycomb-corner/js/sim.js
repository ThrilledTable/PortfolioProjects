// =============================================================================
// sim.js: THE HEART OF THE GAME ("simulation")
// -----------------------------------------------------------------------------
// This file decides what happens as time passes. About 20 times a second the
// game calls `update(s, dt)`, where `s` is your save (see state.js) and `dt`
// is how many seconds passed since the last call (usually 0.05). Each update:
//   1. bees add honey to their hive (until the hive is full)
//   2. the Candle Machine turns wax into candles
//   3. customers walk, shop and queue (customers.js)
//   4. the shopkeeper and staff do their jobs (workers.js)
//   5. eggs in the Nursery get closer to hatching
//   6. the town pins requests, the merchant comes and goes
//   7. timers for upgrades tick down (builds.js)
//   8. each morning: wages are paid, a "today's special" is picked, and
//      maybe a food critic is booked for later in the day
//
// It never touches the screen directly. When something noteworthy happens it
// announces it on HC.bus (see util.js) and the UI/sound react.
//
// The `f` object below holds the game's FORMULAS: small functions that
// answer questions like "how fast does this bee work?" or "how much does the
// next upgrade cost?". Other files call these, so every rule lives in one
// place.
// =============================================================================
(function () {
  const HC = window.HC;
  const { util, data, bus } = HC;
  const D = data;

  // ---------------------------------------------------------------------------
  // FORMULAS
  // ---------------------------------------------------------------------------
  const f = {
    // -- Time of day and seasons ---------------------------------------------
    // dayPhase: how far through the current day we are, 0 (dawn) to 1.
    dayPhase: (s) => (s.time % D.DAY_LENGTH) / D.DAY_LENGTH,
    // Night is the last quarter of each day (70% to 95% of the way through).
    isNight(s) {
      const p = f.dayPhase(s);
      return p >= 0.7 && p < 0.95;
    },
    // The shop only serves customers while it isn't night.
    isOpen: (s) => !f.isNight(s),
    // The lunch rush: for a while around midday customers pour in.
    isRush(s) {
      const p = f.dayPhase(s);
      return f.isOpen(s) && p >= D.EVENTS.rush.from && p < D.EVENTS.rush.to;
    },
    // Bees sleep at night, except night-lovers: species with a night bonus
    // (Moonmoth) and bees with the Night Owl trait keep working.
    nightWorker(bee) {
      return !!(D.species[bee.sp].nightBonus || bee.trait === 'nightowl');
    },
    asleep: (s, bee) => f.isNight(s) && !f.nightWorker(bee),
    season(s) {
      const len = D.DAY_LENGTH * D.SEASON_DAYS;
      return D.SEASONS[Math.floor(s.time / len) % 4];
    },
    seasonLeft(s) {
      const len = D.DAY_LENGTH * D.SEASON_DAYS;
      return len - (s.time % len);
    },
    day: (s) => Math.floor(s.time / D.DAY_LENGTH) + 1,

    // -- Hives ------------------------------------------------------------------
    hiveCap: (h) => 3 + h.level, // how many BEES fit in a hive
    honeyCap: (h) => 16 + 12 * h.level, // how much HONEY a hive holds before bees stop
    honeyIn(h) {
      let n = 0;
      for (const g in h.stock) n += h.stock[g];
      return n;
    },
    hiveFull: (h) => f.honeyIn(h) >= f.honeyCap(h),
    hiveCost: (s) => D.HIVE_COSTS[s.hives.length],
    // All prices below go through util.nice so they're round numbers.
    // Steeper for later hives and levels since playtest 3 (money piled up).
    hiveUpgradeCost: (s, i) => util.nice(100 * Math.pow(3.6, s.hives[i].level) * Math.pow(1 + i, 2)),

    // -- Shop -------------------------------------------------------------------
    upgradeCost(s, id) {
      const u = D.upgrade[id];
      return util.nice(u.base * Math.pow(u.growth, s.up[id] || 0));
    },
    storageCap: (s) => Math.floor(40 * (1 + 0.6 * s.up.storage)), // per product
    shelfCap: () => 6, // items per shelf
    boxCap: (s) => 10 + 4 * s.up.beebox, // spare-bee spaces
    carryCap: (s) => 12 + 8 * s.up.basket, // jars one person can carry per trip
    priceMult: (s) => (1 + 0.08 * s.up.labels) * (1 + 0.1 * s.ribbons),
    // Sale price of one item right now, including all bonuses.
    price(s, goodId, mult = 1) {
      const se = f.season(s);
      let m = mult * (1 + (se.price || 0));
      if (goodId === 'candle' && se.candle) m *= 1 + se.candle;
      if (f.isSpecial(s, goodId)) m *= D.EVENTS.special.priceMult; // today's special
      return Math.max(1, Math.round(D.good[goodId].price * f.priceMult(s) * m));
    },
    // Is this product today's special?
    isSpecial: (s, goodId) => !!(s.special && s.special.good === goodId && s.special.day === f.day(s)),
    // The Honey Cart sells storehouse overflow at this fraction of the price.
    cartRate: (s) => (s.up.cart ? 0.2 + 0.05 * (s.up.cart - 1) : 0),
    // Seconds for the person at the register to ring up one customer.
    // A second person on the Register duty, bagging beside the till, makes
    // it almost twice as fast.
    checkoutTime: (s) => 1.6 * Math.pow(0.88, s.up.register) * (HC.workers && HC.workers.baggerPresent(s) ? 0.55 : 1),

    // -- Decorations --------------------------------------------------------------
    // Adds up one kind of bonus ('customers', 'prod' or 'rep') from every
    // placed decoration.
    decorBonus(s, key) {
      let b = 0;
      for (const id in s.cos.placed) {
        if (!s.cos.placed[id]) continue;
        const item = D.item[id];
        if (item && item.bonus && item.bonus[key]) b += item.bonus[key];
      }
      return b;
    },

    // -- Bees -------------------------------------------------------------------
    // Hive-wide multiplier: +15% per hive level, plus Nurse Bee auras.
    hiveMult(s, h) {
      let nurse = 0;
      for (const id of h.bees) {
        const sp = D.species[s.bees[id].sp];
        if (sp.aura && sp.aura.hive) nurse += sp.aura.hive;
      }
      return 1 + 0.15 * h.level + nurse;
    },
    // How many units per second one bee makes. Starts from its species' speed
    // and multiplies in vigor, sparkle, hive level, flower beds, season,
    // decorations and its trait.
    beeRate(s, bee, h, night) {
      const sp = D.species[bee.sp];
      let r = (1 / sp.secs) * bee.vigor * (bee.sparkle ? 2 : 1);
      r *= f.hiveMult(s, h) * (1 + 0.08 * s.up.flowers) * (1 + (f.season(s).prod || 0)) * (1 + f.decorBonus(s, 'prod'));
      const t = bee.trait && D.TRAITS[bee.trait];
      if (t) {
        if (t.prod) r *= 1 + t.prod;
        if (t.night && night) r *= 1 + t.night;
        if (t.day && !night) r *= 1 + t.day;
      }
      if (sp.nightBonus && night) r *= 1 + sp.nightBonus;
      return r;
    },
    // Ids of bees currently raising an egg. They rest instead of working.
    busyBees(s) {
      const busy = new Set();
      for (const n of s.nursery) if (n) busy.add(n.a).add(n.b);
      return busy;
    },
    // Units per second of each product across all hives (resting bees
    // excluded). `asDay` pretends it's daytime (used to size requests, so
    // they aren't tiny just because the bees are asleep).
    goodRates(s, asDay) {
      const night = !asDay && f.isNight(s);
      const busy = f.busyBees(s);
      const out = {};
      for (const h of s.hives) {
        for (const id of h.bees) {
          if (busy.has(id)) continue;
          const bee = s.bees[id];
          if (night && !f.nightWorker(bee)) continue; // asleep
          const g = D.species[bee.sp].good;
          out[g] = (out[g] || 0) + f.beeRate(s, bee, h, night);
        }
      }
      return out;
    },

    // -- Customers ----------------------------------------------------------------
    // Total bonus to customer visits from the sign, season, bees and decor.
    customerBoost(s) {
      let b = 0.15 * s.up.sign + (f.season(s).customers || 0) + f.decorBonus(s, 'customers');
      for (const h of s.hives) {
        for (const id of h.bees) {
          const bee = s.bees[id];
          const sp = D.species[bee.sp];
          if (sp.aura && sp.aura.customers) b += sp.aura.customers;
          if (bee.trait === 'charming') b += D.TRAITS.charming.customers;
        }
      }
      return b;
    },
    // Average seconds between customers arriving (smaller = busier shop).
    // During the lunch rush it's about three times busier.
    spawnInterval: (s) => Math.max(0.8, 9 / (1 + 0.2 * s.rep) / (1 + f.customerBoost(s))) * (f.isRush(s) ? D.EVENTS.rush.spawnMult : 1),

    // -- Buying bees ------------------------------------------------------------
    marketUnlocked(s, sp) {
      if (sp === 'meadow') return true;
      if (sp === 'clover') return s.lifetime >= 150 || !!s.discovered.clover;
      return false;
    },
    marketPrice(s, sp) {
      const n = s.market[sp] || 0;
      return util.nice(sp === 'meadow' ? 25 * Math.pow(1.2, n) : 150 * Math.pow(1.22, n));
    },
    beeValue: (bee) => 20 * Math.pow(3, D.species[bee.sp].tier) * bee.vigor * (bee.sparkle ? 5 : 1),
    sellPrice: (bee) => util.nice(f.beeValue(bee) * 0.4),

    // -- Breeding ---------------------------------------------------------------
    maxTier: (a, b) => Math.max(D.species[a.sp].tier, D.species[b.sp].tier),
    breedCost: (a, b) => util.nice(40 * Math.pow(3.4, f.maxTier(a, b))),
    breedTime: (a, b) => Math.round(30 * Math.pow(1 + f.maxTier(a, b), 1.6)),

    // -- Timers and gems --------------------------------------------------------
    // How long something that costs `cost` coins takes to build, in seconds.
    // About 40s for cheap things, a few minutes mid-game, up to 4 hours for
    // the priciest late-game upgrades.
    buildTime: (cost) => util.clamp(Math.round(8 * Math.pow(Math.max(1, cost), 0.36)), 20, 4 * 3600),
    // Gems needed to finish a timer right now: 1 gem per 2 minutes left.
    gemsToSkip: (secsLeft) => Math.max(1, Math.ceil(secsLeft / D.GEMS.secsPerGem)),

    // -- Candle Machine -----------------------------------------------------------
    machineCap: (s) => D.MACHINE.capacity(s.machine ? s.machine.level : 0),
    machineUpgradeCost: (s) => util.nice(D.MACHINE.upgradeBase * Math.pow(D.MACHINE.upgradeGrowth, s.machine ? s.machine.level : 0)),

    // -- Staff --------------------------------------------------------------------
    // Base wages for everyone hired.
    wagesPerDay(s) {
      let w = 0;
      for (const id in s.staff) if (s.staff[id] && D.staff[id]) w += D.staff[id].wage;
      return w;
    },
    // One helper's pay for a day: base wage + their share of `earned`.
    wageOf: (s, id, earned) => D.staff[id].wage + Math.round(D.WAGE_SHARE * earned),
    // What tomorrow morning's wages will be if today's earnings stay as they are.
    wagesDue(s) {
      let w = 0;
      for (const id in s.staff) if (s.staff[id] && D.staff[id]) w += f.wageOf(s, id, s.today || 0);
      return w;
    },

    // -- Misc ---------------------------------------------------------------------
    beeCount: (s) => Object.keys(s.bees).length,
    hiveOf(s, beeId) {
      return s.hives.findIndex((h) => h.bees.includes(beeId));
    },
    festivalRibbons: (s) => (s.runEarned >= D.FESTIVAL_AT ? Math.floor(2 * Math.sqrt(s.runEarned / D.FESTIVAL_AT)) : 0),
    // The most valuable product currently sitting on a shelf (by tier).
    bestStockedTier(s) {
      let best = -1;
      for (const sh of s.shelves) if (sh.good && sh.qty > 0) best = Math.max(best, D.good[sh.good].tier);
      return best;
    },
  };

  // ---------------------------------------------------------------------------
  // RUNTIME: things that change constantly but aren't saved. Reloading the
  // page simply starts these fresh.
  // ---------------------------------------------------------------------------
  const rt = {
    customers: [], // everyone currently walking around (see customers.js)
    queue: [], // customers lined up at the counter, first in line first
    workers: [], // the shopkeeper and staff (see workers.js)
    fx: [], // floating "+45" numbers and similar effects
    spawnT: 4, // seconds until the next customer walks in
    income: [], // recent earnings [time, amount], for the "per min" display
    clock: 0, // seconds since the page opened
    drip: null, // a golden drop waiting to be tapped: { hive, left }
    dripT: 60,
    silent: false, // true while fast-forwarding, so we don't spam notifications
    offlineAcc: 0,
  };

  // Add coins. If x/y are given, a floating "+amount" appears there.
  function earn(s, amt, x, y) {
    if (amt <= 0) return;
    s.today = (s.today || 0) + amt; // today's earnings (helpers take a share)
    s.coins += amt;
    s.lifetime += amt;
    s.runEarned += amt;
    rt.income.push([rt.clock, amt]);
    if (x != null) rt.fx.push({ kind: 'text', x, y, text: '+' + util.fmtShort(amt), t: 0, life: 1.4 });
  }

  // Add gems and announce it (the UI shows a toast unless we're fast-forwarding).
  function gainGems(s, n, why) {
    if (n <= 0) return;
    s.gems += n;
    if (!rt.silent) bus.emit('gems', { n, why });
  }

  // ---------------------------------------------------------------------------
  // REPUTATION. Every change goes through here so it can be explained: the
  // amount comes from data.js (REP), and it's added to today's log, which the
  // Reputation window shows. `key` is the reason ('served', 'walkout'...).
  // `scale` multiplies the amount. x/y float a little star in the scene.
  // ---------------------------------------------------------------------------
  function changeRep(s, key, scale = 1, x, y) {
    const rule = D.REP[key];
    let amt = rule.amt * scale;
    // Happy customers count for less near 5 stars, more with decorations.
    if (key === 'served' || key === 'special') amt *= (1 + f.decorBonus(s, 'rep')) * (1 - s.rep / 5.5);
    const before = s.rep;
    s.rep = util.clamp(s.rep + amt, 0, 5);
    const real = s.rep - before;
    const day = f.day(s);
    if (!s.repLog || s.repLog.day !== day) rollRepLog(s, day);
    const item = s.repLog.items[key] || (s.repLog.items[key] = { n: 0, amt: 0 });
    item.n++;
    item.amt += real;
    // Float a little face over the customer: a smiley with "+" when
    // reputation went up, a frowny face with "-" when it went down.
    if (x != null && !rt.silent) rt.fx.push({ kind: 'rep', x, y, happy: amt >= 0, t: 0, life: 1.6 });
    return real;
  }
  // Start a fresh log for a new day, keeping the last one as "yesterday".
  function rollRepLog(s, day) {
    if (s.repLog && Object.keys(s.repLog.items).length) s.repPrev = s.repLog;
    s.repLog = { day, items: {} };
  }

  // Coins earned in the last minute (shown as "per min" in the status bar).
  function incomePerMin() {
    const cutoff = rt.clock - 60;
    while (rt.income.length && rt.income[0][0] < cutoff) rt.income.shift();
    let sum = 0;
    for (const [, a] of rt.income) sum += a;
    const span = Math.min(60, Math.max(10, rt.clock - (rt.income[0] ? rt.income[0][0] : rt.clock)));
    return (sum / span) * 60;
  }

  // Put `n` of product `g` into the storehouse. Anything that doesn't fit is
  // sold off cheaply by the Honey Cart if you own one, otherwise lost.
  // Returns how many actually fit.
  function addToStore(s, g, n) {
    if (n <= 0) return 0;
    s.unlockedGoods[g] = true;
    const cap = f.storageCap(s);
    const have = s.store[g] || 0;
    const put = Math.min(n, Math.max(0, cap - have));
    s.store[g] = have + put;
    const over = n - put;
    if (over > 0 && s.up.cart) earn(s, over * f.price(s, g) * f.cartRate(s));
    return put;
  }

  // Take up to `max` jars out of hive number i. Returns what was taken, e.g.
  // { wildflower: 10, clover: 2 }.
  function takeFromHive(s, i, max) {
    const h = s.hives[i];
    const got = {};
    let left = max;
    for (const g of Object.keys(h.stock)) {
      if (left <= 0) break;
      const n = Math.min(h.stock[g], left);
      if (n > 0) {
        got[g] = n;
        h.stock[g] -= n;
        left -= n;
        s.stats.collected += n;
      }
      if (h.stock[g] <= 0) delete h.stock[g];
    }
    return got;
  }

  // Move goods from the storehouse straight onto shelves. Used when
  // fast-forwarding (while you're away the shopkeeper tidies the shelves).
  function restockInstant(s) {
    const cap = f.shelfCap(s);
    for (const sh of s.shelves) {
      if (!sh.good) continue;
      const take = Math.min(cap - sh.qty, s.store[sh.good] || 0);
      if (take > 0) {
        sh.qty += take;
        s.store[sh.good] -= take;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 1. BEES MAKE HONEY
  // Each bee fills a progress bar at its own speed. When the bar fills, one
  // unit goes into its hive. A full hive stops everyone in it until someone
  // collects. Bees raising an egg in the Nursery rest, and at night most bees
  // sleep (only Moonmoths and Night Owls keep working).
  // ---------------------------------------------------------------------------
  function produce(s, dt) {
    const night = f.isNight(s);
    const busy = f.busyBees(s);
    for (const h of s.hives) {
      const cap = f.honeyCap(h);
      let total = f.honeyIn(h);
      for (const id of h.bees) {
        if (busy.has(id)) continue;
        const bee = s.bees[id];
        if (night && !f.nightWorker(bee)) continue; // asleep for the night
        if (total >= cap) {
          bee.prog = Math.min(bee.prog, 0.999); // waiting for space
          continue;
        }
        bee.prog += f.beeRate(s, bee, h, night) * dt;
        if (bee.prog >= 1) {
          const n = Math.min(Math.floor(bee.prog), cap - total);
          bee.prog -= Math.floor(bee.prog);
          const g = D.species[bee.sp].good;
          h.stock[g] = (h.stock[g] || 0) + n;
          total += n;
          s.unlockedGoods[g] = true;
          if (total >= cap && !rt.silent) bus.emit('hiveFull', s.hives.indexOf(h));
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 2. THE CANDLE MACHINE
  // While it has wax inside and room for candles, it turns one wax into one
  // candle every few seconds. Candles wait inside until someone unloads them.
  // ---------------------------------------------------------------------------
  function updateMachine(s, dt) {
    const m = s.machine;
    if (!m || m.wax <= 0 || m.candles >= f.machineCap(s)) return;
    m.prog += dt / D.MACHINE.secsPerCandle(m.level);
    while (m.prog >= 1 && m.wax > 0 && m.candles < f.machineCap(s)) {
      m.prog -= 1;
      m.wax--;
      m.candles++;
      s.stats.candles++;
      s.unlockedGoods.candle = true;
    }
    if (m.wax <= 0) m.prog = 0;
  }

  // ---------------------------------------------------------------------------
  // 5. THE NURSERY
  // ---------------------------------------------------------------------------
  function updateNursery(s, dt) {
    s.nursery.forEach((slot, i) => {
      if (!slot || slot.ready) return;
      slot.t += dt * (1 + (f.season(s).breed || 0)); // autumn hatches faster
      if (slot.t >= slot.dur) {
        slot.ready = true;
        if (!rt.silent) bus.emit('eggReady', i);
        bus.emit('dirty');
      }
    });
  }

  // Decide what hatches from parents a and b. Returns the new bee's details.
  function decideEgg(s, a, b) {
    let sp;
    const key = [a.sp, b.sp].sort().join('+');
    const recipe = D.recipeFor(a.sp, b.sp);
    if (a.sp === b.sp) sp = a.sp;
    else if (recipe) {
      const fails = s.triedPairs[key] || 0;
      // "Pity timer": after 4 misses in a row the new species is guaranteed.
      if (fails >= 4 || Math.random() < recipe.p) {
        sp = recipe.out;
        s.triedPairs[key] = 0;
      } else {
        sp = Math.random() < 0.5 ? a.sp : b.sp;
        s.triedPairs[key] = fails + 1;
      }
    } else sp = Math.random() < 0.5 ? a.sp : b.sp;

    // Vigor: the parents' average, nudged randomly, with a small upward bias
    // (a bigger one when both parents are the same species).
    let vigor = (a.vigor + b.vigor) / 2 + util.gauss() * 0.07 + 0.015 + (a.sp === b.sp ? 0.03 : 0);
    vigor = util.clamp(vigor, 0.5, 2.5);

    // Sparkle chance: 1 in 80, tripled by a Lucky parent, doubled by a sparkle parent.
    let sparkleP = 1 / 80;
    if (a.trait === 'lucky' || b.trait === 'lucky') sparkleP *= D.TRAITS.lucky.lucky;
    if (a.sparkle || b.sparkle) sparkleP *= 2;

    // Traits are sometimes inherited, sometimes rolled fresh.
    let trait = null;
    if (a.trait && Math.random() < 0.35) trait = a.trait;
    else if (b.trait && Math.random() < 0.35) trait = b.trait;
    else if (Math.random() < 0.25) trait = util.pick(Object.keys(D.TRAITS));

    return { sp, vigor, sparkle: Math.random() < sparkleP, trait, gen: Math.max(a.gen, b.gen) + 1 };
  }

  // ---------------------------------------------------------------------------
  // 6. THE TOWN: requests and the travelling merchant
  // ---------------------------------------------------------------------------
  // Create a request for something you actually make, sized to roughly two
  // or three minutes of your production of it.
  function makeOrder(s) {
    const rates = f.goodRates(s, true);
    const goods = D.GOODS.filter((g) => s.unlockedGoods[g.id] && !g.raw);
    if (!goods.length) return null;
    const g = util.weighted(goods, (x) => (rates[x.id] || x.id === 'candle' ? 3 + x.tier : 0.5));
    const rate = Math.max(rates[g.id] || (g.id === 'candle' ? rates.wax : 0) || 0, 0.04);
    const qty = util.clamp(Math.round(rate * util.rand(100, 200)), 4, 999);
    return {
      id: util.uid(),
      who: util.pick(D.REQUESTERS),
      good: g.id,
      qty,
      reward: util.nice(qty * f.price(s, g.id) * 2.5),
      gems: Math.random() < D.GEMS.orderChance ? util.randInt(D.GEMS.orderMin, D.GEMS.orderMax) : 0,
      left: util.rand(480, 900), // seconds until it expires
    };
  }

  function makeMerchantOffer(s) {
    const pool = D.SPECIES.filter((sp) => s.discovered[sp.id] && sp.id !== 'meadow').map((sp) => sp.id);
    // Sometimes the merchant carries the next species you haven't found yet.
    const next = D.RECIPES.filter((r) => s.discovered[r.a] && s.discovered[r.b] && !s.discovered[r.out]).map((r) => r.out);
    let sp;
    if (next.length && Math.random() < 0.2) sp = util.pick(next);
    else sp = pool.length ? util.pick(pool) : 'clover';
    const offer = {
      sp,
      vigor: util.rand(1.1, 1.35),
      sparkle: Math.random() < 0.08,
      trait: Math.random() < 0.5 ? util.pick(Object.keys(D.TRAITS)) : null,
    };
    offer.price = util.nice(f.beeValue(offer) * 6);
    return offer;
  }

  // Pin a request on the board. Normally a townsperson walks up and pins it
  // (customers.js); while fast-forwarding it just appears.
  function pinOrder(s, o) {
    s.orders.push(o);
    if (!rt.silent) bus.emit('order', o);
    bus.emit('dirty');
  }

  function updateTown(s, dt) {
    s.nextOrderAt -= dt;
    if (s.nextOrderAt <= 0) {
      s.nextOrderAt = util.rand(90, 160);
      const pending = rt.customers.filter((c) => c.kind === 'requester').length;
      if (s.orders.length + pending < 3) {
        const o = makeOrder(s);
        if (o) {
          if (rt.silent || !HC.customers) pinOrder(s, o);
          else HC.customers.spawnRequester(s, o);
        }
      }
    }
    for (const o of s.orders) o.left -= dt;
    const before = s.orders.length;
    s.orders = s.orders.filter((o) => o.left > 0);
    if (s.orders.length !== before) bus.emit('dirty');

    if (s.merchant) {
      s.merchant.left -= dt;
      if (s.merchant.left <= 0) {
        s.merchant = null;
        bus.emit('merchantLeft');
        bus.emit('dirty');
      }
    } else {
      s.nextMerchantAt -= dt;
      if (s.nextMerchantAt <= 0 && s.lifetime > 150) {
        s.nextMerchantAt = util.rand(360, 720);
        s.merchant = { left: 90, offer: makeMerchantOffer(s) };
        if (!rt.silent) bus.emit('merchant', s.merchant);
        bus.emit('dirty');
      }
    }
  }

  // Golden drips: a bonus that appears on a random hive every minute or two.
  function updateDrip(s, dt) {
    if (rt.drip) {
      rt.drip.left -= dt;
      if (rt.drip.left <= 0) rt.drip = null;
      return;
    }
    rt.dripT -= dt;
    if (rt.dripT <= 0) {
      rt.dripT = util.rand(70, 140);
      rt.drip = { hive: util.randInt(0, s.hives.length - 1), left: 12 };
      bus.emit('drip');
    }
  }

  // Tapping a drip pays about half a minute of recent income (at least 25),
  // with a small chance of a gem too.
  function claimDrip(s) {
    if (!rt.drip) return 0;
    const [cx, cy] = HC.layout.hiveSlots[rt.drip.hive];
    const amt = Math.max(25, Math.round(incomePerMin() * 0.5));
    rt.drip = null;
    earn(s, amt, cx * 16 + 8, cy * 16 - 2);
    if (Math.random() < D.GEMS.dripChance) gainGems(s, 1, 'a golden drip');
    return amt;
  }

  // A new season brings a few gems.
  let lastSeason = null;
  function updateSeason(s) {
    const se = f.season(s);
    if (lastSeason && lastSeason !== se.id) {
      gainGems(s, D.GEMS.seasonChange, se.name + ' arriving');
      if (!rt.silent) bus.emit('season', se);
    }
    lastSeason = se.id;
  }

  // ---------------------------------------------------------------------------
  // 8. A NEW DAY. Once each morning:
  //   - wages are paid. If you can't afford everyone, the most expensive
  //     helpers quit until the rest can be paid.
  //   - a "today's special" product is picked (sells for 50% more)
  //   - on some days a food critic is booked to visit later
  //   - the reputation log starts a new page
  // ---------------------------------------------------------------------------
  function updateDay(s) {
    const day = Math.floor(s.time / D.DAY_LENGTH);
    // The very first day also needs a special.
    if (!s.special || s.special.day !== day + 1 || (!s.special.good && D.GOODS.filter((g) => s.unlockedGoods[g.id] && !g.raw).length >= D.EVENTS.special.minGoods)) pickSpecial(s, day + 1);
    if (day <= s.lastDay) return;
    s.lastDay = day;
    payWages(s);
    rollRepLog(s, day + 1);
    const c = D.EVENTS.critic;
    s.critic = Math.random() < c.chance ? { day: day + 1, at: util.rand(c.earliest, c.latest), done: false } : null;
  }

  // Pick today's special among the products you can actually sell,
  // preferring ones you have in stock. (With only one product there's no
  // special: it would just be a permanent price rise.)
  function pickSpecial(s, day) {
    const goods = D.GOODS.filter((g) => s.unlockedGoods[g.id] && !g.raw);
    if (goods.length < D.EVENTS.special.minGoods) {
      s.special = { day, good: null }; // no special until there's a choice
      return;
    }
    const g = util.weighted(goods, (x) => 1 + (s.store[x.id] || 0) + x.tier);
    s.special = { day, good: g.id };
    if (!rt.silent && day > 1) bus.emit('special', g);
    bus.emit('dirty');
  }

  // Each helper gets their base wage plus a share of yesterday's earnings.
  function payWages(s) {
    const earned = s.today || 0;
    s.yesterday = earned;
    s.today = 0;
    const pay = (id) => f.wageOf(s, id, earned);
    const hired = Object.keys(s.staff).filter((id) => s.staff[id] && D.staff[id]).sort((a, b) => D.staff[b].wage - D.staff[a].wage);
    let owed = hired.reduce((t, id) => t + pay(id), 0);
    for (const id of hired) {
      if (s.coins >= owed) break;
      delete s.staff[id];
      owed -= pay(id);
      if (HC.workers) HC.workers.sync(s);
      if (!rt.silent) bus.emit('staffQuit', D.staff[id]);
      bus.emit('dirty');
    }
    if (owed > 0) {
      s.coins -= owed;
      if (!rt.silent) bus.emit('wagesPaid', owed);
    }
  }

  // Announce the lunch rush, nightfall and morning, once each as they start.
  function updateAnnouncements(s) {
    const rush = f.isRush(s), open = f.isOpen(s);
    if (rush && !rt.wasRush && !rt.silent) bus.emit('rush');
    if (open !== rt.wasOpen && rt.wasOpen != null) {
      if (!rt.silent) bus.emit(open ? 'morning' : 'nightfall');
      bus.emit('dirty');
    }
    rt.wasRush = rush;
    rt.wasOpen = open;
  }

  function updateFx(dt) {
    for (const e of rt.fx) e.t += dt;
    rt.fx = rt.fx.filter((e) => e.t < e.life);
  }

  // ---------------------------------------------------------------------------
  // THE MAIN UPDATE: called about 20 times a second while the game is open.
  // ---------------------------------------------------------------------------
  function update(s, dt) {
    rt.clock += dt;
    s.time += dt;
    s.clock += dt;
    s.playTime += dt;
    produce(s, dt);
    updateMachine(s, dt);
    if (HC.customers) HC.customers.update(s, dt);
    if (HC.workers) HC.workers.update(s, dt);
    updateNursery(s, dt);
    updateTown(s, dt);
    updateDrip(s, dt);
    updateSeason(s);
    updateDay(s);
    updateAnnouncements(s);
    if (HC.builds) HC.builds.update(s);
    updateFx(dt);
  }

  // ---------------------------------------------------------------------------
  // FAST-FORWARD for time spent away (tab closed, phone locked).
  // Walking every step would be slow, so this uses shortcuts:
  //   - bees fill their hives as normal (so hives cap out if nobody collects)
  //   - bees sleep at night, as usual
  //   - each person on the Collect duty moves about one basket per 30s
  //   - the shopkeeper keeps the shelves stocked from the storehouse
  //   - while the shop is open, customers buy at 60% of the live rate
  //   - anyone on the Candle Machine duty keeps it running
  //   - timers, eggs, requests and wages all progress
  // Production and sales stop after OFFLINE_CAP (8 hours); timers keep going.
  // Returns a summary for the "While you were away" report.
  // ---------------------------------------------------------------------------
  function catchUp(s, seconds) {
    const active = Math.min(seconds, D.OFFLINE_CAP);
    const start = {
      coins: s.coins, sold: s.stats.sold, collected: s.stats.collected,
      store: Object.assign({}, s.store), orders: new Set(s.orders.map((o) => o.id)),
      season: f.season(s).id, gems: s.gems,
    };
    rt.silent = true;
    const step = 2;
    let left = active;
    while (left > 0) {
      const dt = Math.min(step, left);
      left -= dt;
      s.time += dt;
      s.clock += dt;
      produce(s, dt);
      updateMachine(s, dt);
      // Anyone on the Collect duty brings honey in; the Candle Machine duty
      // keeps the machine going. (See workers.js for duties.)
      const collectors = HC.workers ? HC.workers.onDuty(s, 'collect') : 0;
      if (collectors) offlineCollect(s, dt, collectors);
      if (s.machine && HC.workers && HC.workers.onDuty(s, 'candles')) offlineTend(s);
      restockInstant(s);
      if (f.isOpen(s)) instantCustomers(s, dt, 0.6);
      updateNursery(s, dt);
      updateTown(s, dt);
      updateSeason(s);
      updateDay(s);
      if (HC.builds) HC.builds.update(s);
    }
    // Any time beyond the 8-hour cap still counts for timers.
    if (seconds > active) {
      s.time += seconds - active;
      s.clock += seconds - active;
      updateDay(s);
      if (HC.builds) HC.builds.update(s);
    }
    rt.silent = false;
    lastSeason = f.season(s).id;
    const made = {};
    for (const g of Object.keys(s.store)) {
      const d = (s.store[g] || 0) - (start.store[g] || 0);
      if (d) made[g] = d;
    }
    return {
      seconds, made,
      coins: s.coins - start.coins,
      sold: s.stats.sold - start.sold,
      collected: s.stats.collected - start.collected,
      gems: s.gems - start.gems,
      fullHives: s.hives.map((h, i) => (f.hiveFull(h) ? i : -1)).filter((i) => i >= 0),
      newOrders: s.orders.filter((o) => !start.orders.has(o.id)).length,
      eggs: s.nursery.filter((n) => n && n.ready).length,
      merchant: !!s.merchant,
      season: f.season(s).id !== start.season ? f.season(s) : null,
    };
  }

  // While away: each collector moves roughly one basket every 30 seconds,
  // always from the fullest hive.
  function offlineCollect(s, dt, people) {
    rt.offlineCarry = (rt.offlineCarry || 0) + (f.carryCap(s) / 30) * dt * people;
    while (rt.offlineCarry >= 1) {
      const i = s.hives.reduce((bi, h, k) => (f.honeyIn(h) > f.honeyIn(s.hives[bi]) ? k : bi), 0);
      if (f.honeyIn(s.hives[i]) <= 0) {
        rt.offlineCarry = 0;
        break;
      }
      const want = Math.floor(rt.offlineCarry);
      const got = takeFromHive(s, i, want);
      let n = 0;
      for (const g in got) {
        addToStore(s, g, got[g]);
        n += got[g];
      }
      rt.offlineCarry -= Math.max(n, 1);
    }
  }

  // While away: the Candle Maker keeps wax going in and candles coming out.
  function offlineTend(s) {
    const m = s.machine;
    // Move only as many candles as the storehouse has room for; the rest wait.
    const space = Math.max(0, f.storageCap(s) - (s.store.candle || 0));
    const move = Math.min(m.candles, space);
    if (move > 0) {
      addToStore(s, 'candle', move);
      m.candles -= move;
    }
    const room = f.machineCap(s) - m.wax - m.candles;
    const wax = Math.min(room, s.store.wax || 0);
    if (wax > 0) {
      m.wax += wax;
      s.store.wax -= wax;
    }
  }

  // Offline customers skip walking and buy instantly.
  function instantCustomers(s, dt, efficiency) {
    rt.offlineAcc += (dt / f.spawnInterval(s)) * efficiency;
    while (rt.offlineAcc >= 1) {
      rt.offlineAcc -= 1;
      if (HC.customers) HC.customers.instantSale(s);
    }
  }

  // Clear everything that isn't saved (after fast-forwarding or a festival).
  // Anything a worker was carrying is put in the storehouse first.
  function resetRuntime() {
    if (HC.workers && HC.game) HC.workers.dropAll(HC.game);
    rt.customers = [];
    rt.queue = [];
    rt.fx = [];
    rt.spawnT = 3;
    rt.income = [];
    rt.drip = null;
    rt.dripT = 60;
    rt.workers = [];
    if (HC.workers && HC.game) HC.workers.sync(HC.game);
  }

  HC.sim = {
    f, rt, update, catchUp, resetRuntime, earn, gainGems, changeRep, addToStore, takeFromHive, restockInstant,
    decideEgg, makeOrder, makeMerchantOffer, pinOrder, incomePerMin, claimDrip, produce,
  };
})();
