// =============================================================================
// actions.js: EVERYTHING THE PLAYER CAN DO
// -----------------------------------------------------------------------------
// Every button in the game ends up calling one of these functions. Each one
// checks the move is allowed (enough coins? room for the bee?), changes the
// save, and returns { ok: true/false, msg: 'what happened' }. The UI shows
// `msg` as a little pop-up message.
//
// They also announce 'dirty' on the message bus, which tells the menus to
// redraw because something changed, plus a sound effect name ('buy', 'click'...).
// =============================================================================
(function () {
  const HC = window.HC;
  const { util, data: D, bus } = HC;
  const S = () => HC.game; // the current save
  const f = () => HC.sim.f; // the formulas in sim.js

  // Helpers for returning results.
  function fail(msg) {
    bus.emit('fail', msg);
    return { ok: false, msg };
  }
  function done(msg, sound = 'buy') {
    bus.emit('dirty');
    if (sound) bus.emit('sfx', sound);
    return { ok: true, msg };
  }
  // Pay `cost` coins if you can afford it. Returns true if paid.
  function spend(cost) {
    const s = S();
    if (s.coins < cost) return false;
    s.coins -= cost;
    return true;
  }
  // Pass a builds.js result through as an action result.
  function fromBuild(r) {
    return r.ok ? done(r.msg, 'buy') : fail(r.msg);
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
  // First time you get a species: gems, more for rarer species (none for
  // Common ones). See GEMS.newSpecies in data.js.
  function newSpeciesReward(isNew, sp) {
    const n = isNew ? D.GEMS.newSpecies[D.species[sp].rarity] || 0 : 0;
    if (n) HC.sim.gainGems(S(), n, 'discovering the ' + D.species[sp].name);
  }

  const act = {
    // -------------------------------------------------------------------------
    // BEES
    // -------------------------------------------------------------------------
    buyBee(sp) {
      const s = S();
      if (!f().marketUnlocked(s, sp)) return fail('That bee is not for sale yet.');
      if (!hasRoom()) return fail('No room. Build a hive or expand the bee box.');
      const cost = f().marketPrice(s, sp);
      if (!spend(cost)) return fail('Not enough coins.');
      if (cost > 0) s.market[sp] = (s.market[sp] || 0) + 1; // a free helping-hand bee doesn't raise prices
      const isNew = !s.discovered[sp];
      const bee = HC.state.makeBee(s, sp);
      const where = placeBee(bee);
      newSpeciesReward(isNew, bee.sp);
      bus.emit('newBee', { bee, isNew, source: 'market' });
      return done(bee.name + ' the ' + D.species[sp].name + ' joined your ' + (where === 'hive' ? 'hive' : 'bee box') + '.');
    },

    // Move a bee to hive number `target`, or to 'box'.
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

    // Swap a spare bee with one living in a hive.
    swapBee(boxId, hiveIdx, hiveBeeId) {
      const s = S();
      const h = s.hives[hiveIdx];
      if (!h || !h.bees.includes(hiveBeeId) || !s.box.includes(boxId)) return fail('Those bees moved.');
      h.bees[h.bees.indexOf(hiveBeeId)] = boxId;
      s.box[s.box.indexOf(boxId)] = hiveBeeId;
      return done('Swapped ' + s.bees[boxId].name + ' into hive ' + (hiveIdx + 1) + '.', 'click');
    },

    // Swap any two bees' homes (hive or bee box). Used when you drag a bee
    // onto another bee in a full hive: the two trade places.
    swapBees(aId, bId) {
      const s = S();
      if (!s.bees[aId] || !s.bees[bId] || aId === bId) return fail('Those bees moved.');
      // Find the list each bee lives in (a hive's bee list, or the box).
      const home = (id) => s.hives.find((h) => h.bees.includes(id))?.bees || (s.box.includes(id) ? s.box : null);
      const la = home(aId), lb = home(bId);
      if (!la || !lb) return fail('Those bees moved.');
      if (la === lb) return fail('They already live together.');
      la[la.indexOf(aId)] = bId;
      lb[lb.indexOf(bId)] = aId;
      return done(s.bees[aId].name + ' and ' + s.bees[bId].name + ' swapped places.', 'click');
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

    // Sell every spare bee except the best of each species, sparkles, and
    // any bee raising an egg. With dryRun, only reports what would happen.
    sellExtras(dryRun) {
      const s = S();
      const busy = f().busyBees(s);
      const best = {};
      for (const id of s.box) {
        const b = s.bees[id];
        if (b.sparkle) continue; // sparkles are always kept, so they can't displace the best normal bee
        if (!best[b.sp] || f().beeValue(b) > f().beeValue(s.bees[best[b.sp]])) best[b.sp] = id;
      }
      const sell = s.box.filter((id) => !busy.has(id) && best[s.bees[id].sp] !== id && !s.bees[id].sparkle);
      const total = sell.reduce((t, id) => t + f().sellPrice(s.bees[id]), 0);
      if (dryRun) return { ok: true, count: sell.length, total };
      if (!sell.length) return fail('Nothing to sell: the box only holds your best bee of each kind.');
      for (const id of sell) delete s.bees[id];
      s.box = s.box.filter((id) => s.bees[id]);
      HC.sim.earn(s, total);
      return done('Sold ' + sell.length + ' spare bees for ₵' + util.fmt(total) + '.', 'coin');
    },

    renameBee(id, name) {
      const s = S();
      const bee = s.bees[id];
      name = String(name || '').trim().slice(0, 16);
      if (!bee || !name) return fail('Enter a name.');
      bee.name = name;
      return done('Renamed to ' + name + '.', 'click');
    },

    // -------------------------------------------------------------------------
    // HONEY COLLECTION AND ERRANDS (the shopkeeper walks out to do these)
    // -------------------------------------------------------------------------
    collect(i) {
      const s = S();
      const h = s.hives[i];
      if (!h) return fail('No such hive.');
      if (f().honeyIn(h) <= 0) return fail('Hive ' + (i + 1) + ' has no honey yet.');
      const r = HC.workers.orderCollect(s, i);
      if (!r.ok) return fail(r.msg);
      return done('The shopkeeper will collect from Hive ' + (i + 1) + '.', 'click');
    },
    collectAll() {
      const s = S();
      let n = 0;
      s.hives.forEach((h, i) => {
        if (f().honeyIn(h) > 0 && HC.workers.orderCollect(s, i).ok) n++;
      });
      if (!n) return fail('No hives have honey waiting (or they are already on the list).');
      return done('The shopkeeper will visit ' + n + (n === 1 ? ' hive.' : ' hives.'), 'click');
    },
    tendMachine() {
      const s = S();
      if (!s.machine) return fail('Build the Candle Machine first.');
      if (!s.machine.candles && !(s.store.wax > 0)) return fail('No Beeswax in the storehouse and no candles to unload.');
      const r = HC.workers.orderTend();
      if (!r.ok) return fail(r.msg);
      return done('The shopkeeper will tend the Candle Machine.', 'click');
    },
    restockNow() {
      const r = HC.workers.orderRestock();
      if (!r.ok) return fail(r.msg);
      return done('The shopkeeper will restock the shelves.', 'click');
    },
    cancelErrands() {
      HC.workers.cancelErrands();
      return done('Errands cleared.', 'click');
    },

    // -------------------------------------------------------------------------
    // SHELVES
    // -------------------------------------------------------------------------
    // Choose what shelf i sells. Items already on it go back to the storehouse.
    setShelf(i, good) {
      const s = S();
      const sh = s.shelves[i];
      if (!sh) return fail('No such shelf.');
      if (good && !s.unlockedGoods[good]) return fail('You have not made that yet.');
      if (good && D.good[good].raw) return fail(D.good[good].name + ' is an ingredient, not something to sell.');
      if (sh.good && sh.qty) HC.sim.addToStore(s, sh.good, sh.qty);
      sh.good = good || null;
      sh.qty = 0;
      return done(good ? 'Shelf ' + (i + 1) + ' will sell ' + D.good[good].name + ' once it is restocked.' : 'Shelf ' + (i + 1) + ' cleared.', 'click');
    },

    // -------------------------------------------------------------------------
    // BUILDING (all timed: see builds.js)
    // -------------------------------------------------------------------------
    buyUpgrade(id) {
      const s = S();
      const u = D.upgrade[id];
      if (!u) return fail('Unknown upgrade.');
      if (s.up[id] >= u.max) return fail(u.name + ' is maxed out.');
      return fromBuild(HC.builds.start(s, 'upgrade', id, u.name + ' Lv ' + (s.up[id] + 1), f().upgradeCost(s, id)));
    },
    buildHive() {
      const s = S();
      if (s.hives.length >= 6) return fail('The garden has room for six hives.');
      if (HC.builds.find(s, 'hive', s.hives.length)) return fail('That hive is already being built.');
      return fromBuild(HC.builds.start(s, 'hive', s.hives.length, 'Hive ' + (s.hives.length + 1), f().hiveCost(s)));
    },
    upgradeHive(i) {
      const s = S();
      const h = s.hives[i];
      if (!h) return fail('No such hive.');
      if (h.level >= D.HIVE_MAX_LEVEL) return fail('This hive is fully upgraded.');
      return fromBuild(HC.builds.start(s, 'hiveUp', i, 'Hive ' + (i + 1) + ' → Lv ' + (h.level + 2), f().hiveUpgradeCost(s, i)));
    },
    buildMachine() {
      const s = S();
      if (s.machine) return fail('You already have a Candle Machine.');
      if (!s.discovered.waxwing) return fail('You need Waxwing Bees making Beeswax first.');
      return fromBuild(HC.builds.start(s, 'machine', 0, 'Candle Machine', D.MACHINE.buildCost));
    },
    upgradeMachine() {
      const s = S();
      if (!s.machine) return fail('Build the Candle Machine first.');
      if (s.machine.level >= D.MACHINE.maxLevel) return fail('The machine is fully upgraded.');
      return fromBuild(HC.builds.start(s, 'machineUp', 0, 'Candle Machine Lv ' + (s.machine.level + 2), f().machineUpgradeCost(s)));
    },
    skipBuild(id) {
      const r = HC.builds.skip(S(), id);
      return r.ok ? done(r.msg, 'discover') : fail(r.msg);
    },
    // -------------------------------------------------------------------------
    // STAFF
    // -------------------------------------------------------------------------
    // Helpers are hired in order (Rosa, then Theo...). Each starts on their
    // usual duty (Rosa: Register, Theo: Shelves, Mabel: Hives, Otis: Candles);
    // if that needs a machine you don't have, they take a free duty instead.
    hire(id) {
      const s = S();
      const st = D.staff[id];
      if (!st) return fail('Nobody by that name is looking for work.');
      if (s.staff[id]) return fail(st.name + ' already works here.');
      const next = D.STAFF.find((x) => !s.staff[x.id]);
      if (next !== st) return fail('Hire ' + next.name + ' first.');
      if (!spend(st.hire)) return fail('Not enough coins.');
      let duty = st.duty;
      if (D.duty[duty].needs && !s.machine) {
        const taken = new Set([s.keeperDuty, ...Object.values(s.staff).map((x) => x.duty)]);
        const open = D.DUTIES.find((d) => !taken.has(d.id) && !d.needs);
        duty = open ? open.id : 'collect';
      }
      s.staff[id] = { duty };
      HC.workers.sync(s);
      return done(st.name + ' joined the shop on ' + D.duty[s.staff[id].duty].name + ' duty. Wages are ₵' + st.wage + ' each morning.');
    },
    fire(id) {
      const s = S();
      if (!s.staff[id]) return fail('Nobody to let go.');
      delete s.staff[id];
      HC.workers.sync(s);
      return done(D.staff[id].name + ' has left. No more wages for them.', 'click');
    },
    // Closing time (8pm): sleep until morning (or just keep playing: the
    // night then plays out, shop closed, for restocking and collecting).
    sleep() {
      if (!HC.sim.sleepTillMorning(S())) return fail('It is not night yet.');
      return done('Good morning! The shop is open.', 'bell');
    },
    // Train a helper on one track ('speed' or 'basket'). Instant, coins only.
    train(id, track) {
      const s = S();
      const t = D.TRAINING[track];
      if (!s.staff[id] || !t) return fail('Nobody to train.');
      const lv = f().trainLevel(s, id, track);
      if (lv >= t.max) return fail(D.staff[id].name + ' is fully trained in ' + t.name + '.');
      if (!spend(f().trainCost(s, id, track))) return fail('Not enough coins.');
      s.staff[id][track] = lv + 1;
      return done(D.staff[id].name + ' finished ' + t.name + ' training (level ' + (lv + 1) + ').', 'discover');
    },
    // Give someone a new duty. `who` is 'keeper' or a helper's id.
    // Whatever they were doing is finished first (they won't drop a basket).
    setDuty(who, duty) {
      const s = S();
      const d = D.duty[duty];
      if (!d) return fail('Unknown duty.');
      if (d.needs === 'machine' && !s.machine) return fail('Build the Candle Machine first.');
      if (who === 'keeper') s.keeperDuty = duty;
      else if (s.staff[who]) s.staff[who].duty = duty;
      else return fail('Nobody to assign.');
      const name = who === 'keeper' ? 'The shopkeeper' : D.staff[who].name;
      return done(name + ' is now on ' + d.name + ' duty.', 'click');
    },

    // -------------------------------------------------------------------------
    // NURSERY
    // -------------------------------------------------------------------------
    startBreed(slot, aId, bId) {
      const s = S();
      const a = s.bees[aId], b = s.bees[bId];
      if (!a || !b || aId === bId) return fail('Pick two different bees.');
      if (s.nursery[slot]) return fail('That cradle is busy.');
      if (f().busyBees(s).has(aId) || f().busyBees(s).has(bId)) return fail('One of those bees is already in the nursery.');
      const cost = f().breedCost(a, b);
      if (!spend(cost)) return fail('Not enough coins.');
      s.nursery[slot] = { a: aId, b: bId, t: 0, dur: f().breedTime(a, b), ready: false };
      bus.emit('breedStart', slot);
      return done(a.name + ' and ' + b.name + ' are resting in the nursery with an egg.');
    },
    skipEgg(slot) {
      const s = S();
      const n = s.nursery[slot];
      if (!n || n.ready) return fail('Nothing to hurry.');
      const cost = f().gemsToSkip(n.dur - n.t);
      if (s.gems < cost) return fail('Not enough gems.');
      s.gems -= cost;
      s.stats.skips++;
      if (HC.track) HC.track.gemSkip(cost); // playtest notes (track.js)
      n.t = n.dur;
      n.ready = true;
      return done('The egg is ready to hatch!', 'discover');
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
      newSpeciesReward(isNew, bee.sp);
      bus.emit('newBee', { bee, isNew, newSparkle, source: 'nursery' });
      return done(null, 'hatch');
    },
    cancelBreed(slot) {
      const s = S();
      if (!s.nursery[slot]) return fail('Nothing to cancel.');
      s.nursery[slot] = null;
      return done('The cradle is empty again. The parents are back at work.', 'click');
    },

    // -------------------------------------------------------------------------
    // TOWN
    // -------------------------------------------------------------------------
    deliverOrder(id) {
      const s = S();
      const o = s.orders.find((x) => x.id === id);
      if (!o) return fail('That order has expired.');
      if ((s.store[o.good] || 0) < o.qty) return fail('Not enough ' + D.good[o.good].name + ' in the storehouse.');
      s.store[o.good] -= o.qty;
      s.orders = s.orders.filter((x) => x.id !== id);
      HC.sim.earn(s, o.reward);
      if (o.gems) HC.sim.gainGems(s, o.gems, o.who);
      HC.sim.changeRep(s, 'order');
      s.stats.orders++;
      bus.emit('orderDone', o);
      return done(o.who + ' paid ₵' + util.fmt(o.reward) + (o.gems ? ' and ' + o.gems + ' 💎' : '') + '. Word gets around.', 'order');
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
      newSpeciesReward(isNew, bee.sp);
      bus.emit('newBee', { bee, isNew, newSparkle, source: 'merchant' });
      return done(null, 'hatch');
    },

    // -------------------------------------------------------------------------
    // STORE (cosmetics)
    // -------------------------------------------------------------------------
    buyItem(id) {
      const s = S();
      const item = D.item[id];
      if (!item) return fail('Unknown item.');
      if (s.cos.owned[id]) return fail('You already own that.');
      // Seasonal specials can only be bought during their season.
      if (item.season && !f().inSeason(s, item)) return fail(item.name + ' is only sold in ' + D.SEASONS.find((x) => x.id === item.season).name + (item.cycle ? ' of every other year' : '') + '.');
      const cost = item.cost || {};
      if (cost.coins && s.coins < cost.coins) return fail('Not enough coins.');
      if (cost.gems && s.gems < cost.gems) return fail('Not enough gems.');
      if (cost.coins) s.coins -= cost.coins;
      if (cost.gems) s.gems -= cost.gems;
      s.cos.owned[id] = true;
      if (/Decor$/.test(item.cat) || item.cat === 'seasonal') s.stats.decor++;
      act.useItem(id, true);
      return done(item.name + ' is yours!', 'discover');
    },
    // Wear/use an owned item; decorations toggle between placed and stored.
    useItem(id, quiet) {
      const s = S();
      const item = D.item[id];
      if (!item || !s.cos.owned[id]) return fail('You do not own that yet.');
      const section = D.STORE_SECTIONS.find((x) => x.cat === item.cat);
      if (section.pick) s.cos.equip[item.cat] = id;
      else s.cos.placed[id] = quiet ? true : !s.cos.placed[id];
      // Choosing a hive style in the Store restyles EVERY hive (clearing any
      // hive's own style). To style one hive, use setHiveStyle below.
      if (item.cat === 'hiveStyle') s.hives.forEach((h) => delete h.style);
      if (quiet) return { ok: true };
      if (item.cat === 'hiveStyle') return done('All hives now use ' + item.name + '.', 'click');
      return done(section.pick ? item.name + ' equipped.' : item.name + (s.cos.placed[id] ? ' placed.' : ' put away.'), 'click');
    },
    // Give ONE hive its own style (playtest 3). `id` is a hive style you own,
    // or null to go back to the shop-wide style.
    setHiveStyle(i, id) {
      const s = S();
      const h = s.hives[i];
      if (!h) return fail('No such hive.');
      if (!id) {
        delete h.style;
        return done('Hive ' + (i + 1) + ' matches the others again.', 'click');
      }
      const item = D.item[id];
      if (!item || item.cat !== 'hiveStyle' || !s.cos.owned[id]) return fail('Buy that style in the Store first.');
      h.style = id;
      return done('Hive ' + (i + 1) + ' is now ' + item.name + '.', 'click');
    },

    // -------------------------------------------------------------------------
    // FESTIVAL (start over for permanent ribbons)
    // -------------------------------------------------------------------------
    holdFestival(keepId) {
      const old = S();
      const gain = f().festivalRibbons(old);
      if (!gain) return fail('The town is not ready for a festival yet.');
      const s = HC.state.newGame();
      // Carried over: lifetime totals, ribbons, the Field Guide, cosmetics,
      // gems, stats, settings and tutorial progress.
      s.lifetime = old.lifetime;
      s.ribbons = old.ribbons + gain;
      s.festivals = old.festivals + 1;
      s.discovered = old.discovered;
      s.sparkleSeen = old.sparkleSeen;
      s.triedPairs = old.triedPairs;
      s.stats = old.stats;
      s.settings = old.settings;
      s.hints = old.hints;
      s.goal = old.goal;
      s.cos = old.cos;
      s.gems = old.gems + D.GEMS.festival;
      s.keeperDuty = old.keeperDuty;
      s.playtest = old.playtest; // playtest notes carry over (track.js)
      s.playTime = old.playTime;
      s.time = old.time;
      s.clock = old.clock;
      s.lastDay = old.lastDay;
      s.coins = 50 * (1 + s.ribbons);
      for (const sp of Object.keys(s.discovered)) s.unlockedGoods[D.species[sp].good] = true;
      const keep = old.bees[keepId];
      if (keep) {
        const copy = Object.assign({}, keep, { prog: 0 });
        s.bees[copy.id] = copy;
        s.hives[0].bees.push(copy.id);
      }
      HC.game = s;
      HC.workers.cancelErrands();
      HC.sim.resetRuntime();
      bus.emit('festival', { gain, total: s.ribbons });
      return done(null, 'hatch');
    },
  };

  HC.act = act;
})();
