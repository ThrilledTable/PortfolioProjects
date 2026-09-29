// Simulation: formulas, production, customers, nursery, orders, merchant.
// Pure game logic. It never touches the DOM; it emits events on HC.bus.
(function () {
  const HC = window.HC;
  const { util, data, bus } = HC;
  const D = data;

  // ---- Scene layout (240x160, 16px tiles) shared with the renderer ---------
  const layout = {
    W: 240, H: 160, T: 16,
    doorX: 152, streetY: 152, doorY: 136, insideY: 120, aisleY: 40,
    corridorX: 168, turnY: 56,
    keeper: { x: 216, y: 99 },
    shelfX: (i) => (7 + i) * 16 + 8,
    queueSlot: (i) => (i < 3 ? { x: 216 - 16 * i, y: 120 } : { x: 184, y: 104 - 16 * (i - 3) }),
    hiveSlots: [[1, 1], [4, 1], [1, 4], [4, 4], [1, 7], [4, 7]],
    wagon: { x: 40, y: 152 },
  };

  // ---- Formulas -------------------------------------------------------------
  const f = {
    dayPhase: (s) => (s.time % D.DAY_LENGTH) / D.DAY_LENGTH,
    isNight(s) {
      const p = f.dayPhase(s);
      return p >= 0.7 && p < 0.95;
    },
    season(s) {
      const len = D.DAY_LENGTH * D.SEASON_DAYS;
      return D.SEASONS[Math.floor(s.time / len) % 4];
    },
    seasonLeft(s) {
      const len = D.DAY_LENGTH * D.SEASON_DAYS;
      return len - (s.time % len);
    },
    day: (s) => Math.floor(s.time / D.DAY_LENGTH) + 1,
    hiveCap: (h) => 3 + h.level,
    hiveCost: (s) => D.HIVE_COSTS[s.hives.length],
    hiveUpgradeCost: (s, i) => Math.ceil(100 * Math.pow(3, s.hives[i].level) * Math.pow(1 + i, 1.4)),
    upgradeCost(s, id) {
      const u = D.upgrade[id];
      return Math.ceil(u.base * Math.pow(u.growth, s.up[id] || 0));
    },
    storageCap: (s) => Math.floor(40 * (1 + 0.6 * s.up.storage)),
    shelfCap: () => 6,
    boxCap: (s) => 10 + 4 * s.up.beebox,
    priceMult: (s) => (1 + 0.08 * s.up.labels) * (1 + 0.1 * s.ribbons),
    price(s, goodId, mult = 1) {
      const se = f.season(s);
      let m = mult * (1 + (se.price || 0));
      if (goodId === 'candle' && se.candle) m *= 1 + se.candle;
      return Math.max(1, Math.round(D.good[goodId].price * f.priceMult(s) * m));
    },
    cartRate: (s) => (s.up.cart ? 0.2 + 0.05 * (s.up.cart - 1) : 0),
    checkoutTime: (s) => 1.4 * Math.pow(0.88, s.up.register),

    hiveMult(s, h) {
      let nurse = 0;
      for (const id of h.bees) {
        const sp = D.species[s.bees[id].sp];
        if (sp.aura && sp.aura.hive) nurse += sp.aura.hive;
      }
      return 1 + 0.15 * h.level + nurse;
    },

    beeRate(s, bee, h, night) {
      const sp = D.species[bee.sp];
      let r = (1 / sp.secs) * bee.vigor * (bee.sparkle ? 2 : 1);
      r *= f.hiveMult(s, h) * (1 + 0.08 * s.up.flowers) * (1 + (f.season(s).prod || 0));
      const t = bee.trait && D.TRAITS[bee.trait];
      if (t) {
        if (t.prod) r *= 1 + t.prod;
        if (t.night && night) r *= 1 + t.night;
        if (t.day && !night) r *= 1 + t.day;
      }
      if (sp.nightBonus && night) r *= 1 + sp.nightBonus;
      return r;
    },

    // Units per second of each good across all hives.
    goodRates(s) {
      const night = f.isNight(s);
      const out = {};
      for (const h of s.hives) {
        for (const id of h.bees) {
          const bee = s.bees[id];
          const g = D.species[bee.sp].good;
          out[g] = (out[g] || 0) + f.beeRate(s, bee, h, night);
        }
      }
      return out;
    },

    customerBoost(s) {
      let b = 0.15 * s.up.sign + (f.season(s).customers || 0);
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
    spawnInterval: (s) => Math.max(0.8, 9 / (1 + 0.2 * s.rep) / (1 + f.customerBoost(s))),

    marketUnlocked(s, sp) {
      if (sp === 'meadow') return true;
      if (sp === 'clover') return s.lifetime >= 120 || !!s.discovered.clover;
      return false;
    },
    marketPrice(s, sp) {
      const n = s.market[sp] || 0;
      return sp === 'meadow' ? Math.ceil(25 * Math.pow(1.18, n)) : Math.ceil(120 * Math.pow(1.2, n));
    },
    beeValue: (bee) => 20 * Math.pow(3, D.species[bee.sp].tier) * bee.vigor * (bee.sparkle ? 5 : 1),
    sellPrice: (bee) => Math.ceil(f.beeValue(bee) * 0.4),
    maxTier: (a, b) => Math.max(D.species[a.sp].tier, D.species[b.sp].tier),
    breedCost: (a, b) => Math.ceil(40 * Math.pow(3.4, f.maxTier(a, b))),
    breedTime: (a, b) => Math.round(20 * Math.pow(1 + f.maxTier(a, b), 1.6)),

    beeCount: (s) => Object.keys(s.bees).length,
    hiveOf(s, beeId) {
      return s.hives.findIndex((h) => h.bees.includes(beeId));
    },
    festivalRibbons: (s) => (s.runEarned >= D.FESTIVAL_AT ? Math.floor(2 * Math.sqrt(s.runEarned / D.FESTIVAL_AT)) : 0),
    bestStockedTier(s) {
      let best = -1;
      for (const sh of s.shelves) if (sh.good && sh.qty > 0) best = Math.max(best, D.good[sh.good].tier);
      return best;
    },
  };

  // ---- Runtime (not saved) --------------------------------------------------
  const rt = {
    customers: [],
    queue: [],
    fx: [],
    spawnT: 3,
    income: [], // [gameTime, amount] for the last 60s
    clock: 0,
    drip: null, // { hive, left } a golden drop waiting to be tapped
    dripT: 45,
  };

  function earn(s, amt, x, y) {
    if (amt <= 0) return;
    s.coins += amt;
    s.lifetime += amt;
    s.runEarned += amt;
    rt.income.push([rt.clock, amt]);
    if (x != null) rt.fx.push({ kind: 'text', x, y, text: '+' + util.fmtShort(amt), t: 0, life: 1.4 });
  }

  function incomePerMin() {
    const cutoff = rt.clock - 60;
    while (rt.income.length && rt.income[0][0] < cutoff) rt.income.shift();
    let sum = 0;
    for (const [, a] of rt.income) sum += a;
    const span = Math.min(60, Math.max(10, rt.clock - (rt.income[0] ? rt.income[0][0] : rt.clock)));
    return (sum / span) * 60;
  }

  function addGood(s, g, n) {
    if (n <= 0) return;
    s.unlockedGoods[g] = true;
    const cap = f.storageCap(s);
    const have = s.store[g] || 0;
    const put = Math.min(n, Math.max(0, cap - have));
    s.store[g] = have + put;
    const over = n - put;
    if (over > 0 && s.up.cart) earn(s, over * f.price(s, g) * f.cartRate(s));
  }

  function restock(s) {
    const cap = f.shelfCap(s);
    for (const sh of s.shelves) {
      if (!sh.good) continue;
      const need = cap - sh.qty;
      if (need <= 0) continue;
      const take = Math.min(need, s.store[sh.good] || 0);
      if (take > 0) {
        sh.qty += take;
        s.store[sh.good] -= take;
      }
    }
  }

  function produce(s, dt) {
    const night = f.isNight(s);
    for (const h of s.hives) {
      for (const id of h.bees) {
        const bee = s.bees[id];
        bee.prog += f.beeRate(s, bee, h, night) * dt;
        if (bee.prog >= 1) {
          const n = Math.floor(bee.prog);
          bee.prog -= n;
          addGood(s, D.species[bee.sp].good, n);
        }
      }
    }
  }

  function rollCustomerType(s) {
    return util.weighted(D.CUSTOMERS, (c) => c.weight + (c.repWeight || 0) * s.rep);
  }

  function chooseShelf(s, ctype) {
    const best = f.bestStockedTier(s);
    if (best < 0) return -1;
    const maxTier = Math.max(0, best - ctype.offset);
    const idx = [];
    s.shelves.forEach((sh, i) => {
      if (sh.good && sh.qty > 0 && D.good[sh.good].tier <= maxTier) idx.push(i);
    });
    if (!idx.length) return -1;
    const pick = util.weighted(idx, (i) => {
      const p = D.good[s.shelves[i].good].price;
      return ctype.id === 'collector' ? Math.pow(p, 1.5) : Math.sqrt(p);
    });
    return pick == null ? -1 : pick;
  }

  function unitsWanted(s, ctype) {
    let n = util.randInt(ctype.units[0], ctype.units[1]);
    for (let i = 0; i < s.up.samples; i++) if (Math.random() < 0.1) n++;
    return n;
  }

  function repGain(s) {
    s.rep = Math.min(5, s.rep + 0.02 * (1 - s.rep / 5.5));
  }
  function repLoss(s, amt = 0.04) {
    s.rep = Math.max(0, s.rep - amt);
  }

  function makeLook(ctype) {
    const hair = util.pick(D.HAIR), skin = util.pick(D.SKIN);
    const shirt = ctype.shirt || util.pick(D.SHIRTS);
    return { hair, skin, shirt, hat: ctype.hat };
  }

  function exitPath(fromY) {
    const side = Math.random() < 0.5 ? -12 : layout.W + 12;
    const p = [];
    if (fromY < layout.insideY) p.push({ x: layout.doorX, y: layout.insideY });
    p.push({ x: layout.doorX, y: layout.doorY }, { x: layout.doorX, y: layout.streetY }, { x: side, y: layout.streetY });
    return p;
  }

  function spawnCustomer(s) {
    const ctype = rollCustomerType(s);
    const fromLeft = Math.random() < 0.5;
    const c = {
      id: util.uid(),
      type: ctype,
      look: makeLook(ctype),
      x: fromLeft ? -12 : layout.W + 12,
      y: layout.streetY,
      dir: fromLeft ? 'right' : 'left',
      walk: 0,
      speed: util.rand(26, 34),
      state: 'enter',
      path: [
        { x: layout.doorX, y: layout.streetY },
        { x: layout.doorX, y: layout.doorY },
        { x: layout.doorX, y: layout.insideY },
        { x: layout.doorX, y: layout.aisleY },
      ],
      shelf: -1,
      retries: 0,
      bubble: null,
      timer: 0,
    };
    rt.customers.push(c);
  }

  function leaveUnhappy(s, c) {
    c.bubble = { kind: 'dots', t: 0 };
    c.state = 'leave';
    c.path = exitPath(c.y);
    repLoss(s);
    s.stats.disappointed++;
    bus.emit('disappointed', c);
  }

  function moveAlong(c, dt) {
    if (!c.path.length) return true;
    const tgt = c.path[0];
    const dx = tgt.x - c.x, dy = tgt.y - c.y;
    const dist = Math.hypot(dx, dy);
    const step = c.speed * dt;
    if (Math.abs(dx) > Math.abs(dy)) c.dir = dx > 0 ? 'right' : 'left';
    else if (dist > 0.01) c.dir = dy > 0 ? 'down' : 'up';
    if (dist <= step) {
      c.x = tgt.x;
      c.y = tgt.y;
      c.path.shift();
    } else {
      c.x += (dx / dist) * step;
      c.y += (dy / dist) * step;
    }
    c.walk += dt;
    return c.path.length === 0;
  }

  function goToShelf(c, idx) {
    c.shelf = idx;
    c.state = 'toShelf';
    c.path = [{ x: layout.shelfX(idx), y: layout.aisleY }];
  }

  function updateCustomer(s, c, dt) {
    if (c.bubble) {
      c.bubble.t += dt;
      if (c.bubble.kind !== 'good' && c.bubble.t > 1.6) c.bubble = null;
    }
    switch (c.state) {
      case 'enter':
        if (moveAlong(c, dt)) {
          const idx = chooseShelf(s, c.type);
          if (idx < 0) leaveUnhappy(s, c);
          else goToShelf(c, idx);
        }
        break;
      case 'toShelf':
        if (moveAlong(c, dt)) {
          c.state = 'browse';
          c.dir = 'up';
          c.timer = util.rand(0.9, 1.7);
          const sh = s.shelves[c.shelf];
          c.bubble = sh.good ? { kind: 'good', good: sh.good, t: 0 } : null;
        }
        break;
      case 'browse': {
        c.timer -= dt;
        if (c.timer > 0) break;
        c.bubble = null;
        const sh = s.shelves[c.shelf];
        const maxTier = Math.max(0, f.bestStockedTier(s) - c.type.offset);
        if (sh && sh.good && sh.qty > 0 && D.good[sh.good].tier <= maxTier) {
          const take = Math.min(unitsWanted(s, c.type), sh.qty);
          sh.qty -= take;
          c.bought = { good: sh.good, qty: take };
          c.total = f.price(s, sh.good, c.type.mult || 1) * take;
          rt.queue.push(c);
          c.state = 'toQueue';
          const slot = layout.queueSlot(rt.queue.length - 1);
          const sx = layout.shelfX(c.shelf);
          c.path = [
            { x: sx, y: layout.turnY },
            { x: layout.corridorX, y: layout.turnY },
            { x: layout.corridorX, y: slot.y },
            { x: slot.x, y: slot.y },
          ];
          c.bubble = { kind: 'heart', t: 0 };
        } else if (c.retries < 1) {
          c.retries++;
          const idx = chooseShelf(s, c.type);
          if (idx < 0) leaveUnhappy(s, c);
          else goToShelf(c, idx);
        } else leaveUnhappy(s, c);
        break;
      }
      case 'toQueue':
        if (moveAlong(c, dt)) c.state = 'queue';
        break;
      case 'queue': {
        const qi = rt.queue.indexOf(c);
        const slot = layout.queueSlot(qi);
        if (Math.abs(c.x - slot.x) > 0.5 || Math.abs(c.y - slot.y) > 0.5) {
          c.path = [slot];
          moveAlong(c, dt);
        } else {
          c.dir = qi === 0 ? 'up' : qi < 3 ? 'right' : 'down';
          if (qi === 0) {
            c.state = 'pay';
            c.timer = f.checkoutTime(s);
          }
        }
        break;
      }
      case 'pay':
        c.timer -= dt;
        if (c.timer <= 0) {
          earn(s, c.total, layout.keeper.x, layout.keeper.y - 14);
          s.stats.sold += c.bought.qty;
          s.stats.customers++;
          s.stats.best = Math.max(s.stats.best, c.total);
          repGain(s);
          rt.queue.shift();
          c.state = 'exit';
          c.path = exitPath(c.y);
          bus.emit('sale', c);
        }
        break;
      case 'exit':
      case 'leave':
        if (moveAlong(c, dt)) c.done = true;
        break;
    }
  }

  function updateCustomers(s, dt) {
    rt.spawnT -= dt;
    if (rt.spawnT <= 0) {
      rt.spawnT = f.spawnInterval(s) * util.rand(0.7, 1.3);
      if (rt.customers.length < 14) spawnCustomer(s);
    }
    for (const c of rt.customers) updateCustomer(s, c, dt);
    rt.customers = rt.customers.filter((c) => !c.done);
  }

  // Offline and background-tab customers skip the walking and buy instantly.
  function instantCustomers(s, dt, efficiency) {
    rt.offlineAcc = (rt.offlineAcc || 0) + (dt / f.spawnInterval(s)) * efficiency;
    let earned = 0;
    while (rt.offlineAcc >= 1) {
      rt.offlineAcc -= 1;
      const ctype = rollCustomerType(s);
      restock(s);
      const idx = chooseShelf(s, ctype);
      if (idx < 0) {
        s.stats.disappointed++;
        repLoss(s, 0.01);
        continue;
      }
      const sh = s.shelves[idx];
      const take = Math.min(unitsWanted(s, ctype), sh.qty);
      sh.qty -= take;
      const amt = f.price(s, sh.good, ctype.mult || 1) * take;
      s.coins += amt;
      s.lifetime += amt;
      s.runEarned += amt;
      earned += amt;
      s.stats.sold += take;
      s.stats.customers++;
      repGain(s);
    }
    return earned;
  }

  // ---- Nursery -------------------------------------------------------------
  function updateNursery(s, dt) {
    s.nursery.forEach((slot, i) => {
      if (!slot || slot.ready) return;
      slot.t += dt * (1 + (f.season(s).breed || 0));
      if (slot.t >= slot.dur) {
        slot.ready = true;
        bus.emit('eggReady', i);
        bus.emit('dirty');
      }
    });
  }

  function decideEgg(s, a, b) {
    let sp;
    const key = [a.sp, b.sp].sort().join('+');
    const recipe = D.recipeFor(a.sp, b.sp);
    if (a.sp === b.sp) sp = a.sp;
    else if (recipe) {
      const fails = s.triedPairs[key] || 0;
      // Pity timer: after 4 misses the new species is guaranteed.
      if (fails >= 4 || Math.random() < recipe.p) {
        sp = recipe.out;
        s.triedPairs[key] = 0;
      } else {
        sp = Math.random() < 0.5 ? a.sp : b.sp;
        s.triedPairs[key] = fails + 1;
      }
    } else sp = Math.random() < 0.5 ? a.sp : b.sp;

    let vigor = (a.vigor + b.vigor) / 2 + util.gauss() * 0.07 + 0.015 + (a.sp === b.sp ? 0.03 : 0);
    vigor = util.clamp(vigor, 0.5, 2.5);

    let sparkleP = 1 / 80;
    if (a.trait === 'lucky' || b.trait === 'lucky') sparkleP *= D.TRAITS.lucky.lucky;
    if (a.sparkle || b.sparkle) sparkleP *= 2;

    let trait = null;
    if (a.trait && Math.random() < 0.35) trait = a.trait;
    else if (b.trait && Math.random() < 0.35) trait = b.trait;
    else if (Math.random() < 0.25) trait = util.pick(Object.keys(D.TRAITS));

    return { sp, vigor, sparkle: Math.random() < sparkleP, trait, gen: Math.max(a.gen, b.gen) + 1 };
  }

  // ---- Orders and merchant ------------------------------------------------
  function makeOrder(s) {
    const rates = f.goodRates(s);
    const goods = D.GOODS.filter((g) => s.unlockedGoods[g.id]);
    if (!goods.length) return null;
    const g = util.weighted(goods, (x) => (rates[x.id] ? 3 + x.tier : 0.5));
    const rate = Math.max(rates[g.id] || 0, 0.04);
    const qty = util.clamp(Math.round(rate * util.rand(100, 200)), 4, 999);
    return {
      id: util.uid(),
      who: util.pick(D.REQUESTERS),
      good: g.id,
      qty,
      reward: Math.ceil(qty * f.price(s, g.id) * 2.5),
      left: util.rand(420, 720),
    };
  }

  function makeMerchantOffer(s) {
    const pool = D.SPECIES.filter((sp) => s.discovered[sp.id] && sp.id !== 'meadow').map((sp) => sp.id);
    // Occasionally the merchant carries the next undiscovered species.
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
    offer.price = Math.ceil(f.beeValue(offer) * 6);
    return offer;
  }

  let lastSeason = null;
  function updateSeason(s) {
    const se = f.season(s);
    if (lastSeason && lastSeason !== se.id) bus.emit('season', se);
    lastSeason = se.id;
  }

  function updateTown(s, dt) {
    s.nextOrderAt -= dt;
    if (s.nextOrderAt <= 0) {
      s.nextOrderAt = util.rand(75, 130);
      if (s.orders.length < 3) {
        const o = makeOrder(s);
        if (o) {
          s.orders.push(o);
          bus.emit('order', o);
          bus.emit('dirty');
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
        s.nextMerchantAt = util.rand(300, 600);
        s.merchant = { left: 90, offer: makeMerchantOffer(s) };
        bus.emit('merchant', s.merchant);
        bus.emit('dirty');
      }
    }
  }

  function updateDrip(s, dt) {
    if (rt.drip) {
      rt.drip.left -= dt;
      if (rt.drip.left <= 0) rt.drip = null;
      return;
    }
    rt.dripT -= dt;
    if (rt.dripT <= 0) {
      rt.dripT = util.rand(60, 120);
      rt.drip = { hive: util.randInt(0, s.hives.length - 1), left: 12 };
      bus.emit('drip');
    }
  }

  // Tapping the drop pays about half a minute of recent income.
  function claimDrip(s) {
    if (!rt.drip) return 0;
    const [cx, cy] = layout.hiveSlots[rt.drip.hive];
    const amt = Math.max(25, Math.round(incomePerMin() * 0.5));
    rt.drip = null;
    earn(s, amt, cx * 16 + 8, cy * 16 - 2);
    return amt;
  }

  function updateFx(dt) {
    for (const e of rt.fx) e.t += dt;
    rt.fx = rt.fx.filter((e) => e.t < e.life);
  }

  // ---- Main entry points ----------------------------------------------------
  function update(s, dt) {
    rt.clock += dt;
    s.time += dt;
    s.playTime += dt;
    produce(s, dt);
    restock(s);
    updateCustomers(s, dt);
    updateNursery(s, dt);
    updateTown(s, dt);
    updateDrip(s, dt);
    updateSeason(s);
    updateFx(dt);
  }

  // Fast-forward for time spent away. Customers buy instantly at 60% of the
  // live rate so staying in the app is still worth more.
  function catchUp(s, seconds) {
    seconds = Math.min(seconds, D.OFFLINE_CAP);
    const startCoins = s.coins;
    const startStore = Object.assign({}, s.store);
    const startSold = s.stats.sold;
    const startOrders = new Set(s.orders.map((o) => o.id));
    const startSeason = f.season(s).id;
    const step = 2;
    let left = seconds;
    rt.silent = true; // listeners skip per-event toasts; the away report covers it
    while (left > 0) {
      const dt = Math.min(step, left);
      left -= dt;
      s.time += dt;
      produce(s, dt);
      restock(s);
      instantCustomers(s, dt, 0.6);
      updateNursery(s, dt);
      updateTown(s, dt);
    }
    rt.silent = false;
    lastSeason = f.season(s).id;
    const made = {};
    for (const g of Object.keys(s.store)) {
      const d = (s.store[g] || 0) - (startStore[g] || 0);
      if (d) made[g] = d;
    }
    return {
      seconds, made,
      coins: s.coins - startCoins,
      sold: s.stats.sold - startSold,
      newOrders: s.orders.filter((o) => !startOrders.has(o.id)).length,
      eggs: s.nursery.filter((n) => n && n.ready).length,
      merchant: !!s.merchant,
      season: f.season(s).id !== startSeason ? f.season(s) : null,
    };
  }

  function resetRuntime() {
    rt.customers = [];
    rt.queue = [];
    rt.fx = [];
    rt.spawnT = 2;
    rt.income = [];
    rt.drip = null;
    rt.dripT = 45;
  }

  HC.layout = layout;
  HC.sim = {
    f, rt, update, catchUp, resetRuntime, earn, addGood, restock, decideEgg,
    makeOrder, makeMerchantOffer, incomePerMin, chooseShelf, instantCustomers, claimDrip,
  };
})();
