// Player actions. Each returns {ok, msg} and emits 'dirty' so the UI redraws.
(function () {
  const HC = window.HC;
  const { util, data: D, bus } = HC;
  const S = () => HC.game;
  const f = () => HC.sim.f;

  function fail(msg) {
    bus.emit('fail', msg);
    return { ok: false, msg };
  }
  function done(msg, sound = 'buy') {
    bus.emit('dirty');
    if (sound) bus.emit('sfx', sound);
    return { ok: true, msg };
  }
  function spend(cost) {
    const s = S();
    if (s.coins < cost) return false;
    s.coins -= cost;
    return true;
  }

  // Put a new bee in the first hive with space, else the bee box.
  function placeBee(bee) {
    const s = S();
    const h = s.hives.find((hv) => hv.bees.length < f().hiveCap(hv));
    if (h) {
      h.bees.push(bee.id);
      return 'hive';
    }
    s.box.push(bee.id);
    return 'box';
  }
  function hasRoom() {
    const s = S();
    return s.hives.some((h) => h.bees.length < f().hiveCap(h)) || s.box.length < f().boxCap(s);
  }

  const act = {
    buyBee(sp) {
      const s = S();
      if (!f().marketUnlocked(s, sp)) return fail('That bee is not for sale yet.');
      if (!hasRoom()) return fail('No room. Build a hive or expand the bee box.');
      const cost = f().marketPrice(s, sp);
      if (!spend(cost)) return fail('Not enough coins.');
      s.market[sp] = (s.market[sp] || 0) + 1;
      const isNew = !s.discovered[sp];
      const bee = HC.state.makeBee(s, sp);
      const where = placeBee(bee);
      bus.emit('newBee', { bee, isNew, source: 'market' });
      return done(bee.name + ' the ' + D.species[sp].name + ' joined your ' + (where === 'hive' ? 'hive' : 'bee box') + '.');
    },

    buildHive() {
      const s = S();
      if (s.hives.length >= 6) return fail('The garden has room for six hives.');
      const cost = f().hiveCost(s);
      if (!spend(cost)) return fail('Not enough coins.');
      s.hives.push({ level: 0, bees: [] });
      // Fill it straight away from the bee box.
      const h = s.hives[s.hives.length - 1];
      while (s.box.length && h.bees.length < f().hiveCap(h)) h.bees.push(s.box.shift());
      bus.emit('hiveBuilt', s.hives.length - 1);
      return done('Hive ' + s.hives.length + ' is built.');
    },

    upgradeHive(i) {
      const s = S();
      const h = s.hives[i];
      if (!h) return fail('No such hive.');
      if (h.level >= D.HIVE_MAX_LEVEL) return fail('This hive is fully upgraded.');
      if (!spend(f().hiveUpgradeCost(s, i))) return fail('Not enough coins.');
      h.level++;
      while (s.box.length && h.bees.length < f().hiveCap(h)) h.bees.push(s.box.shift());
      return done('Hive ' + (i + 1) + ' is now level ' + (h.level + 1) + '.');
    },

    // target: hive index (number) or 'box'
    moveBee(id, target) {
      const s = S();
      if (!s.bees[id]) return fail('That bee is gone.');
      const from = f().hiveOf(s, id);
      if (target === 'box') {
        if (from < 0) return fail('Already in the bee box.');
        if (s.box.length >= f().boxCap(s)) return fail('The bee box is full.');
        s.hives[from].bees = s.hives[from].bees.filter((b) => b !== id);
        s.box.push(id);
        return done(s.bees[id].name + ' moved to the bee box.', 'click');
      }
      const h = s.hives[target];
      if (!h) return fail('No such hive.');
      if (from === target) return fail('Already in that hive.');
      if (h.bees.length >= f().hiveCap(h)) return fail('Hive ' + (target + 1) + ' is full.');
      if (from >= 0) s.hives[from].bees = s.hives[from].bees.filter((b) => b !== id);
      else s.box = s.box.filter((b) => b !== id);
      h.bees.push(id);
      return done(s.bees[id].name + ' moved to hive ' + (target + 1) + '.', 'click');
    },

    swapBee(boxId, hiveIdx, hiveBeeId) {
      const s = S();
      const h = s.hives[hiveIdx];
      if (!h || !h.bees.includes(hiveBeeId) || !s.box.includes(boxId)) return fail('Those bees moved.');
      h.bees[h.bees.indexOf(hiveBeeId)] = boxId;
      s.box[s.box.indexOf(boxId)] = hiveBeeId;
      return done('Swapped ' + s.bees[boxId].name + ' into hive ' + (hiveIdx + 1) + '.', 'click');
    },

    sellBee(id) {
      const s = S();
      const bee = s.bees[id];
      if (!bee) return fail('That bee is gone.');
      if (f().beeCount(s) <= 1) return fail('Keep at least one bee.');
      if (s.nursery.some((n) => n && (n.a === id || n.b === id))) return fail(bee.name + ' is busy in the nursery.');
      const price = f().sellPrice(bee);
      s.hives.forEach((h) => (h.bees = h.bees.filter((b) => b !== id)));
      s.box = s.box.filter((b) => b !== id);
      if (s.keepsake === id) s.keepsake = null;
      delete s.bees[id];
      HC.sim.earn(s, price);
      return done(bee.name + ' went to a keeper in the next town for ₵' + util.fmt(price) + '.', 'coin');
    },

    renameBee(id, name) {
      const s = S();
      const bee = s.bees[id];
      name = String(name || '').trim().slice(0, 16);
      if (!bee || !name) return fail('Enter a name.');
      bee.name = name;
      return done('Renamed to ' + name + '.', 'click');
    },

    setShelf(i, good) {
      const s = S();
      const sh = s.shelves[i];
      if (!sh) return fail('No such shelf.');
      if (good && !s.unlockedGoods[good]) return fail('You have not made that yet.');
      if (sh.good && sh.qty) s.store[sh.good] = (s.store[sh.good] || 0) + sh.qty; // return stock
      sh.good = good || null;
      sh.qty = 0;
      HC.sim.restock(s);
      return done(good ? 'Shelf ' + (i + 1) + ' now sells ' + D.good[good].name + '.' : 'Shelf ' + (i + 1) + ' cleared.', 'click');
    },

    buyUpgrade(id) {
      const s = S();
      const u = D.upgrade[id];
      if (!u) return fail('Unknown upgrade.');
      if (s.up[id] >= u.max) return fail(u.name + ' is maxed out.');
      if (!spend(f().upgradeCost(s, id))) return fail('Not enough coins.');
      s.up[id]++;
      if (id === 'shelf') {
        s.shelves.push({ good: null, qty: 0 });
        // Auto-fill the new shelf with the best product not already shelved.
        const shelved = new Set(s.shelves.map((x) => x.good));
        const best = D.GOODS.filter((g) => s.unlockedGoods[g.id] && !shelved.has(g.id)).pop();
        if (best) s.shelves[s.shelves.length - 1].good = best.id;
        HC.sim.restock(s);
      }
      if (id === 'nursery') s.nursery.push(null);
      bus.emit('upgraded', id);
      return done(u.name + ' is now level ' + s.up[id] + '.');
    },

    startBreed(slot, aId, bId) {
      const s = S();
      const a = s.bees[aId], b = s.bees[bId];
      if (!a || !b || aId === bId) return fail('Pick two different bees.');
      if (s.nursery[slot]) return fail('That cradle is busy.');
      if (s.nursery.some((n) => n && [n.a, n.b].some((x) => x === aId || x === bId))) return fail('One of those bees is already in the nursery.');
      const cost = f().breedCost(a, b);
      if (!spend(cost)) return fail('Not enough coins.');
      s.nursery[slot] = { a: aId, b: bId, t: 0, dur: f().breedTime(a, b), ready: false };
      bus.emit('breedStart', slot);
      return done(a.name + ' and ' + b.name + ' are tending an egg.');
    },

    hatch(slot) {
      const s = S();
      const n = s.nursery[slot];
      if (!n || !n.ready) return fail('The egg is not ready.');
      if (!hasRoom()) return fail('No room for a new bee. Free a space first.');
      const a = s.bees[n.a], b = s.bees[n.b];
      // Parents may have been sold mid-brood; fall back to whichever is left.
      const pa = a || b, pb = b || a;
      if (!pa) {
        s.nursery[slot] = null;
        return fail('Both parents are gone; the egg was lost.');
      }
      const egg = HC.sim.decideEgg(s, pa, pb);
      const isNew = !s.discovered[egg.sp];
      const newSparkle = egg.sparkle && !s.sparkleSeen[egg.sp];
      const bee = HC.state.makeBee(s, egg.sp, egg);
      placeBee(bee);
      s.nursery[slot] = null;
      s.stats.bred++;
      bus.emit('newBee', { bee, isNew, newSparkle, source: 'nursery' });
      return done(null, 'hatch');
    },

    cancelBreed(slot) {
      const s = S();
      if (!s.nursery[slot]) return fail('Nothing to cancel.');
      s.nursery[slot] = null;
      return done('The cradle is empty again.', 'click');
    },

    deliverOrder(id) {
      const s = S();
      const o = s.orders.find((x) => x.id === id);
      if (!o) return fail('That order has expired.');
      if ((s.store[o.good] || 0) < o.qty) return fail('Not enough ' + D.good[o.good].name + ' in the storehouse.');
      s.store[o.good] -= o.qty;
      s.orders = s.orders.filter((x) => x.id !== id);
      HC.sim.earn(s, o.reward);
      s.rep = Math.min(5, s.rep + 0.15);
      s.stats.orders++;
      bus.emit('orderDone', o);
      return done(o.who + ' paid ₵' + util.fmt(o.reward) + '. Word gets around.', 'order');
    },

    dismissOrder(id) {
      const s = S();
      s.orders = s.orders.filter((x) => x.id !== id);
      return done(null, 'click');
    },

    buyMerchant() {
      const s = S();
      if (!s.merchant) return fail('The merchant has left.');
      if (!hasRoom()) return fail('No room for another bee.');
      const o = s.merchant.offer;
      if (!spend(o.price)) return fail('Not enough coins.');
      const isNew = !s.discovered[o.sp];
      const newSparkle = o.sparkle && !s.sparkleSeen[o.sp];
      const bee = HC.state.makeBee(s, o.sp, o);
      placeBee(bee);
      s.merchant = null;
      bus.emit('newBee', { bee, isNew, newSparkle, source: 'merchant' });
      return done(null, 'hatch');
    },

    holdFestival(keepId) {
      const old = S();
      const gain = f().festivalRibbons(old);
      if (!gain) return fail('The town is not ready for a festival yet.');
      const s = HC.state.newGame();
      s.lifetime = old.lifetime;
      s.ribbons = old.ribbons + gain;
      s.festivals = old.festivals + 1;
      s.discovered = old.discovered;
      s.sparkleSeen = old.sparkleSeen;
      s.triedPairs = old.triedPairs;
      s.stats = old.stats;
      s.settings = old.settings;
      s.hints = old.hints;
      s.playTime = old.playTime;
      s.time = old.time;
      s.coins = 50 * (1 + s.ribbons);
      for (const sp of Object.keys(s.discovered)) s.unlockedGoods[D.species[sp].good] = true;
      const keep = old.bees[keepId];
      if (keep) {
        const copy = Object.assign({}, keep, { prog: 0 });
        s.bees[copy.id] = copy;
        s.hives[0].bees.push(copy.id);
      }
      HC.game = s;
      HC.sim.resetRuntime();
      bus.emit('festival', { gain, total: s.ribbons });
      return done(null, 'hatch');
    },
  };

  HC.act = act;
})();
