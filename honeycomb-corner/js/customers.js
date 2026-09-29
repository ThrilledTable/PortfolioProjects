// =============================================================================
// customers.js: SHOPPERS AND TOWNSFOLK
// -----------------------------------------------------------------------------
// Every customer is a little "state machine": at any moment they're in one
// state (walking in, browsing a shelf, waiting in line...) and switch to the
// next when something happens. The journey:
//
//   enter    walk from the street through the door to the aisle
//   toShelf  walk to the shelf they picked
//   browse   look for a moment, take items off the shelf
//   toQueue  walk to the end of the checkout line
//   queue    wait in line. They can only pay once someone is standing at the
//            register. If they wait longer than their patience allows, they
//            put the items back and storm out (reputation drops).
//   pay      the person at the register rings them up and coins are earned
//   exit / leave   walk out and disappear
//
// Nobody new arrives while the shop is closed at night.
//
// "Requesters" are townsfolk who walk up to the request board outside,
// pin a note (which becomes a request in the Town tab) and walk away.
// =============================================================================
(function () {
  const HC = window.HC;
  const { util, data: D, bus, nav } = HC;
  const L = HC.layout;
  const sim = () => HC.sim;
  const f = () => HC.sim.f;
  const rt = () => HC.sim.rt;

  // ---------------------------------------------------------------------------
  // Choosing what to buy
  // ---------------------------------------------------------------------------
  function rollCustomerType(s) {
    // More nobles and collectors show up as your reputation grows.
    return util.weighted(D.CUSTOMERS, (c) => c.weight + (c.repWeight || 0) * s.rep);
  }

  // Pick a shelf for this customer, or -1 if nothing suits them. They can
  // only afford products up to a few tiers below your best one on display,
  // and they prefer pricier items among what they can afford.
  function chooseShelf(s, ctype) {
    const best = f().bestStockedTier(s);
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

  // How many items they'll take; Tasting Samples adds a chance of one more.
  function unitsWanted(s, ctype) {
    let n = util.randInt(ctype.units[0], ctype.units[1]);
    for (let i = 0; i < s.up.samples; i++) if (Math.random() < 0.1) n++;
    return n;
  }

  // Reputation goes up a little with each happy customer (more slowly the
  // closer you are to 5 stars; String Lights and Lanterns speed it up)...
  function repGain(s, scale = 1) {
    const boost = 1 + f().decorBonus(s, 'rep');
    s.rep = Math.min(5, s.rep + 0.02 * scale * boost * (1 - s.rep / 5.5));
  }
  // ...and down with each unhappy one.
  function repLoss(s, amt = 0.04) {
    s.rep = Math.max(0, s.rep - amt);
  }

  // A random appearance for a new customer.
  function makeLook(ctype) {
    const hair = util.pick(D.HAIR), skin = util.pick(D.SKIN);
    const shirt = ctype.shirt || util.pick(D.SHIRTS);
    return { hair, skin, shirt, hat: ctype.hat };
  }

  // The route out of the shop to a random end of the street.
  function exitPath(fromY) {
    const side = Math.random() < 0.5 ? -12 : L.W + 12;
    const p = [];
    if (fromY < L.insideY) p.push({ x: L.doorX, y: L.insideY });
    p.push({ x: L.doorX, y: L.doorY }, { x: L.doorX, y: L.streetY }, { x: side, y: L.streetY });
    return p;
  }

  // ---------------------------------------------------------------------------
  // Creating people
  // ---------------------------------------------------------------------------
  function spawnCustomer(s) {
    const ctype = rollCustomerType(s);
    const fromLeft = Math.random() < 0.5;
    rt().customers.push({
      id: util.uid(),
      kind: 'customer',
      type: ctype,
      look: makeLook(ctype),
      x: fromLeft ? -12 : L.W + 12,
      y: L.streetY,
      dir: fromLeft ? 'right' : 'left',
      walk: 0,
      speed: util.rand(26, 34),
      state: 'enter',
      path: [
        { x: L.doorX, y: L.streetY },
        { x: L.doorX, y: L.doorY },
        { x: L.doorX, y: L.insideY },
        { x: L.doorX, y: L.aisleY },
      ],
      shelf: -1,
      retries: 0,
      bubble: null,
      timer: 0,
      wait: 0, // seconds spent waiting in line
      patience: util.rand(40, 70), // how long they'll wait before walking out
    });
  }

  // A townsperson who walks to the board outside and pins request `order`.
  function spawnRequester(s, order) {
    const fromLeft = Math.random() < 0.5;
    const look = makeLook(D.customer.villager);
    look.hat = util.pick([null, 'cap', 'straw', 'tophat']);
    rt().customers.push({
      id: util.uid(),
      kind: 'requester',
      order,
      look,
      x: fromLeft ? -12 : L.W + 12,
      y: L.streetY + 4,
      dir: fromLeft ? 'right' : 'left',
      walk: 0,
      speed: 30,
      state: 'toBoard',
      path: [{ x: L.board.x, y: L.streetY + 4 }],
      bubble: null,
      timer: 0,
    });
  }

  // ---------------------------------------------------------------------------
  // Leaving
  // ---------------------------------------------------------------------------
  function leaveUnhappy(s, c) {
    c.bubble = { kind: 'dots', t: 0 };
    c.state = 'leave';
    c.path = exitPath(c.y);
    repLoss(s);
    s.stats.disappointed++;
    bus.emit('disappointed', c);
  }

  // Waited too long in line: put the items back and storm out.
  function walkOut(s, c) {
    const q = rt().queue;
    q.splice(q.indexOf(c), 1);
    const sh = s.shelves[c.shelf];
    if (sh && sh.good === c.bought.good) sh.qty = Math.min(f().shelfCap(s), sh.qty + c.bought.qty);
    else sim().addToStore(s, c.bought.good, c.bought.qty);
    c.bubble = { kind: 'angry', t: 0 };
    c.state = 'leave';
    c.path = exitPath(c.y);
    repLoss(s, 0.06);
    s.stats.walkouts++;
    if (!rt().silent) bus.emit('walkout', c);
  }

  function goToShelf(c, idx) {
    c.shelf = idx;
    c.state = 'toShelf';
    c.path = [{ x: L.shelfX(idx), y: L.aisleY }];
  }

  // ---------------------------------------------------------------------------
  // One step of one person's behaviour.
  // ---------------------------------------------------------------------------
  function updateCustomer(s, c, dt) {
    // Speech bubbles fade after a moment (except the "I want this" bubble).
    if (c.bubble) {
      c.bubble.t += dt;
      if (c.bubble.kind !== 'good' && c.bubble.kind !== 'note' && c.bubble.t > 1.6) c.bubble = null;
    }
    switch (c.state) {
      // -- Requesters ----------------------------------------------------------
      case 'toBoard':
        if (nav.moveAlong(c, dt)) {
          c.state = 'pinning';
          c.dir = 'up';
          c.timer = 1.6;
          c.bubble = { kind: 'note', t: 0 };
        }
        break;
      case 'pinning':
        c.timer -= dt;
        if (c.timer <= 0) {
          c.bubble = null;
          sim().pinOrder(s, c.order);
          c.state = 'leave';
          const side = Math.random() < 0.5 ? -12 : L.W + 12;
          c.path = [{ x: side, y: c.y }];
        }
        break;

      // -- Customers ------------------------------------------------------------
      case 'enter':
        if (nav.moveAlong(c, dt)) {
          const idx = chooseShelf(s, c.type);
          if (idx < 0) leaveUnhappy(s, c);
          else goToShelf(c, idx);
        }
        break;
      case 'toShelf':
        if (nav.moveAlong(c, dt)) {
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
        const maxTier = Math.max(0, f().bestStockedTier(s) - c.type.offset);
        if (sh && sh.good && sh.qty > 0 && D.good[sh.good].tier <= maxTier) {
          // Take the items off the shelf and head for the line.
          const take = Math.min(unitsWanted(s, c.type), sh.qty);
          sh.qty -= take;
          c.bought = { good: sh.good, qty: take };
          c.total = f().price(s, sh.good, c.type.mult || 1) * take;
          rt().queue.push(c);
          c.state = 'toQueue';
          const slot = L.queueSlot(rt().queue.length - 1);
          const sx = L.shelfX(c.shelf);
          c.path = [
            { x: sx, y: L.turnY },
            { x: L.corridorX, y: L.turnY },
            { x: L.corridorX, y: slot.y },
            { x: slot.x, y: slot.y },
          ];
          c.bubble = { kind: 'heart', t: 0 };
        } else if (c.retries < 1) {
          // Someone got there first; try one other shelf.
          c.retries++;
          const idx = chooseShelf(s, c.type);
          if (idx < 0) leaveUnhappy(s, c);
          else goToShelf(c, idx);
        } else leaveUnhappy(s, c);
        break;
      }
      case 'toQueue':
        c.wait += dt;
        if (nav.moveAlong(c, dt)) c.state = 'queue';
        break;
      case 'queue': {
        const qi = rt().queue.indexOf(c);
        const slot = L.queueSlot(qi);
        // Shuffle forward when the line moves.
        if (Math.abs(c.x - slot.x) > 0.5 || Math.abs(c.y - slot.y) > 0.5) {
          c.path = [slot];
          nav.moveAlong(c, dt);
          break;
        }
        c.dir = qi === 0 ? 'up' : qi < 3 ? 'right' : 'down';
        c.wait += dt;
        // First in line and someone is at the register: start paying.
        if (qi === 0 && HC.workers && HC.workers.cashierPresent(s)) {
          c.state = 'pay';
          c.timer = f().checkoutTime(s);
          break;
        }
        // Getting impatient: show a "!" when nearly out of patience.
        if (c.wait > c.patience * 0.7 && (!c.bubble || c.bubble.kind !== 'impatient')) c.bubble = { kind: 'impatient', t: 0 };
        if (c.wait > c.patience) walkOut(s, c);
        break;
      }
      case 'pay':
        c.timer -= dt;
        if (c.timer <= 0) {
          sim().earn(s, c.total, L.desk.x, L.desk.y - 24);
          s.stats.sold += c.bought.qty;
          s.stats.customers++;
          s.stats.best = Math.max(s.stats.best, c.total);
          repGain(s);
          rt().queue.shift();
          c.state = 'exit';
          c.path = exitPath(c.y);
          c.bubble = null;
          bus.emit('sale', c);
        }
        break;
      case 'exit':
      case 'leave':
        if (nav.moveAlong(c, dt)) c.done = true;
        break;
    }
  }

  // Called every update: maybe let a new customer in, then move everyone.
  function update(s, dt) {
    const r = rt();
    r.spawnT -= dt;
    if (r.spawnT <= 0) {
      r.spawnT = f().spawnInterval(s) * util.rand(0.7, 1.3);
      const shoppers = r.customers.filter((c) => c.kind === 'customer').length;
      if (f().isOpen(s) && shoppers < 14) spawnCustomer(s);
    }
    for (const c of r.customers) updateCustomer(s, c, dt);
    r.customers = r.customers.filter((c) => !c.done);
  }

  // Fast-forward version of a whole customer visit, used while you're away:
  // pick a shelf, buy, pay, done. No walking, no waiting.
  function instantSale(s) {
    const ctype = rollCustomerType(s);
    const idx = chooseShelf(s, ctype);
    if (idx < 0) {
      s.stats.disappointed++;
      repLoss(s, 0.01);
      return 0;
    }
    const sh = s.shelves[idx];
    const take = Math.min(unitsWanted(s, ctype), sh.qty);
    sh.qty -= take;
    const amt = f().price(s, sh.good, ctype.mult || 1) * take;
    s.coins += amt;
    s.lifetime += amt;
    s.runEarned += amt;
    s.stats.sold += take;
    s.stats.customers++;
    repGain(s);
    sim().restockInstant(s);
    return amt;
  }

  HC.customers = { update, spawnRequester, instantSale, chooseShelf };
})();
