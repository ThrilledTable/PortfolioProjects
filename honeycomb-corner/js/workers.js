// =============================================================================
// workers.js: THE SHOPKEEPER AND THE STAFF
// -----------------------------------------------------------------------------
// Everyone who works at the shop is a "worker": the shopkeeper (you), plus
// any helpers you've hired (Rosa, Theo, Mabel, Otis).
//
// DUTIES: nobody is stuck in one job. Each worker is ASSIGNED A DUTY in the
// Shop tab, and does it on their own without any tapping:
//   Register        stand at the register so customers can pay. At night,
//                   when the shop is closed, restock the shelves instead.
//                   Two people on the Register ring up faster.
//   Stock shelves   carry goods from the storehouse to low shelves.
//   Collect honey   bring honey in from hives that are filling up.
//   Candle Machine  load wax, carry candles out.
// The shopkeeper has a duty too, but always runs YOUR errands first (when you
// tap a hive, the machine, or "Restock now"). If nobody is on the Register,
// customers wait in line until someone comes back.
//
// HOW A JOB WORKS
// A job is a to-do list of steps, done in order:
//   { go: 'HV2' }             walk to that spot on the map (see nav.js)
//   { wait: 1.5 }             stand still for 1.5 seconds (working)
//   { act: function }         do something instantly: pick up honey, put it
//                             down... An act can add more steps (e.g. "now
//                             visit these three shelves") or a wait.
// When the list is finished the worker is idle again and picks new work.
// =============================================================================
(function () {
  const HC = window.HC;
  const { data: D, bus, nav } = HC;
  const sim = () => HC.sim;
  const f = () => HC.sim.f;
  const rt = () => HC.sim.rt;

  // Which duty a worker is on. `w` is a worker (or its role: 'keeper'/'rosa'...).
  function dutyOf(s, w) {
    const role = typeof w === 'string' ? w : w.role;
    const duty = role === 'keeper' ? s.keeperDuty : s.staff[role] && s.staff[role].duty;
    // A Candle Machine duty without a machine falls back to the Register.
    if (!D.duty[duty] || (D.duty[duty].needs === 'machine' && !s.machine)) return 'register';
    return duty;
  }

  // Everyone on the Register duty, helpers first, the shopkeeper last. The
  // first one stands AT the register; anyone else stands beside it and bags.
  function registerCrew(s) {
    return rt().workers.filter((w) => dutyOf(s, w) === 'register').sort((a, b) => (a.role === 'keeper') - (b.role === 'keeper'));
  }

  // Where a worker waits when there's nothing to do.
  function homeOf(s, w) {
    const role = typeof w === 'string' ? w : w.role;
    const duty = dutyOf(s, role);
    if (duty !== 'register') return D.duty[duty].home;
    const crew = registerCrew(s);
    const i = crew.findIndex((x) => x.role === role);
    return i <= 0 ? 'DESK' : 'SIDE';
  }

  // How many workers (including the shopkeeper) are on a duty.
  function onDuty(s, duty) {
    let n = dutyOf(s, 'keeper') === duty ? 1 : 0;
    for (const id in s.staff) if (s.staff[id] && dutyOf(s, id) === duty) n++;
    return n;
  }

  // Jobs you've asked the shopkeeper to do (tapping hives, the machine...).
  // Kept outside the save: a reload simply forgets pending errands.
  const keeperJobs = [];

  // ---------------------------------------------------------------------------
  // Creating and removing workers
  // ---------------------------------------------------------------------------
  function makeWorker(s, role, atNode) {
    const p = nav.NODES[atNode];
    return {
      id: role,
      role, // 'keeper' or the helper's id ('rosa', 'theo'...)
      x: p.x, y: p.y, node: atNode,
      dir: 'down', walk: 0,
      speed: role === 'keeper' ? 38 : 34, // pixels per second
      path: [],
      job: null,
      carry: {}, // what they're holding, e.g. { wildflower: 12 }
      waitT: 0,
      thinkT: 0, // staff only look for work every half second
    };
  }

  // Make sure the list of workers matches who is hired: add newcomers (they
  // walk in from the street), remove anyone who left (dropping what they
  // carried into the storehouse).
  function sync(s) {
    const list = rt().workers;
    if (!list.find((w) => w.role === 'keeper')) list.push(makeWorker(s, 'keeper', 'DESK'));
    for (const st of D.STAFF) {
      const has = list.find((w) => w.role === st.id);
      if (s.staff[st.id] && !has) {
        const w = makeWorker(s, st.id, 'STREET');
        list.push(w);
        w.job = { label: 'Arriving for their first shift', steps: [{ go: homeOf(s, w) }], i: 0 };
      } else if (!s.staff[st.id] && has) {
        dropCarry(s, has);
        list.splice(list.indexOf(has), 1);
      }
    }
    // Anyone standing in the wrong place after a duty change walks over
    // (the update loop does this for idle workers).
  }

  function dropCarry(s, w) {
    for (const g in w.carry) sim().addToStore(s, g, w.carry[g]);
    w.carry = {};
  }
  function dropAll(s) {
    for (const w of rt().workers) dropCarry(s, w);
  }
  const carried = (w) => Object.values(w.carry).reduce((a, b) => a + b, 0);

  // ---------------------------------------------------------------------------
  // Job recipes
  // ---------------------------------------------------------------------------
  function homeJob(s, w) {
    return { label: 'Heading back', steps: [{ go: homeOf(s, w) }], i: 0 };
  }

  // Put everything being carried into the storehouse (takes a second).
  const depositStep = { act: (s, w) => {
    const had = carried(w);
    dropCarry(s, w);
    return { wait: had ? 1 : 0 };
  } };

  // Walk to hive i, scoop out as much honey as the basket holds, bring it to
  // the storehouse, go back to your spot.
  function collectJob(s, w, i) {
    w.targetHive = i;
    return {
      type: 'collect', hive: i, label: 'Collecting honey from Hive ' + (i + 1),
      steps: [
        { go: 'HV' + i },
        { act: (s2, w2) => {
          w2.targetHive = null;
          if (!s2.hives[i]) return { insert: [{ go: homeOf(s2, w2) }] };
          const got = sim().takeFromHive(s2, i, f().carryOf(s2, w2) - carried(w2));
          let n = 0;
          for (const g in got) {
            w2.carry[g] = (w2.carry[g] || 0) + got[g];
            n += got[g];
          }
          if (!n) return { insert: [{ go: homeOf(s2, w2) }] }; // nothing there after all
          if (!rt().silent) bus.emit('collected', { hive: i, n, who: w2.role });
          return { wait: 1 + 0.04 * n };
        } },
        { go: 'STORE' },
        depositStep,
        { go: homeOf(s, w) },
      ],
      i: 0,
    };
  }

  // Walk to the storehouse, fill the basket with what the emptiest shelves
  // need, visit each of those shelves, then return anything left over.
  function restockJob(s, w, threshold) {
    return {
      type: 'restock', label: 'Restocking the shelves',
      steps: [
        { go: 'STORE' },
        { act: (s2, w2) => {
          const cap = f().shelfCap(s2);
          let room = f().carryOf(s2, w2) - carried(w2);
          const visits = [];
          // Emptiest shelves first.
          const order = s2.shelves.map((sh, k) => k).filter((k) => s2.shelves[k].good)
            .sort((a, b) => s2.shelves[a].qty - s2.shelves[b].qty);
          for (const k of order) {
            const sh = s2.shelves[k];
            if (room <= 0) break;
            if (sh.qty > threshold) continue;
            const take = Math.min(cap - sh.qty, s2.store[sh.good] || 0, room);
            if (take <= 0) continue;
            s2.store[sh.good] -= take;
            w2.carry[sh.good] = (w2.carry[sh.good] || 0) + take;
            room -= take;
            visits.push({ go: 'SH' + k }, { act: placeOnShelf(k) });
          }
          if (!visits.length) return { insert: [{ go: homeOf(s2, w2) }] };
          return {
            wait: 0.8,
            insert: visits.concat([
              { act: (s3, w3) => (carried(w3) ? { insert: [{ go: 'STORE' }, depositStep, { go: homeOf(s3, w3) }] } : { insert: [{ go: homeOf(s3, w3) }] }) },
            ]),
          };
        } },
      ],
      i: 0,
    };
  }
  function placeOnShelf(k) {
    return (s, w) => {
      const sh = s.shelves[k];
      if (!sh || !sh.good || !w.carry[sh.good]) return {};
      const put = Math.min(w.carry[sh.good], f().shelfCap(s) - sh.qty);
      sh.qty += put;
      w.carry[sh.good] -= put;
      if (w.carry[sh.good] <= 0) delete w.carry[sh.good];
      return { wait: 0.5 };
    };
  }

  // Candle Machine run: fetch wax from the storehouse, load it, take the
  // finished candles, bring them back to the storehouse.
  function tendJob(s, w) {
    return {
      type: 'tend', label: 'Tending the Candle Machine',
      steps: [
        { go: 'STORE' },
        { act: (s2, w2) => {
          const m = s2.machine;
          if (!m) return { insert: [{ go: homeOf(s2, w2) }] };
          const want = Math.min(f().carryOf(s2, w2) - carried(w2), f().machineCap(s2) - m.wax, s2.store.wax || 0);
          if (want > 0) {
            s2.store.wax -= want;
            w2.carry.wax = (w2.carry.wax || 0) + want;
            return { wait: 0.8 };
          }
          return {};
        } },
        { go: 'MACH' },
        { act: (s2, w2) => {
          const m = s2.machine;
          if (!m) return {};
          if (w2.carry.wax) {
            // Only top the machine up to its limit (someone else may have
            // loaded it meanwhile); any spare wax goes back to the storehouse.
            const load = Math.min(w2.carry.wax, f().machineCap(s2) - m.wax);
            m.wax += load;
            w2.carry.wax -= load;
            if (w2.carry.wax <= 0) delete w2.carry.wax;
          }
          const take = Math.min(m.candles, f().carryOf(s2, w2) - carried(w2));
          if (take > 0) {
            m.candles -= take;
            w2.carry.candle = (w2.carry.candle || 0) + take;
          }
          return { wait: 1.5 };
        } },
        { act: (s2, w2) => (carried(w2) ? { insert: [{ go: 'STORE' }, depositStep, { go: homeOf(s2, w2) }] } : { insert: [{ go: homeOf(s2, w2) }] }) },
      ],
      i: 0,
    };
  }

  // ---------------------------------------------------------------------------
  // Deciding what to do next (only when idle)
  // ---------------------------------------------------------------------------
  // Does any stocked shelf have `threshold` items or fewer while the
  // storehouse has more of that product?
  function shelvesNeed(s, threshold) {
    return s.shelves.some((sh) => sh.good && sh.qty <= threshold && (s.store[sh.good] || 0) > 0);
  }

  function nextJobFor(s, w) {
    const r = rt();
    const cap = f().shelfCap(s);
    const night = f().isNight(s);
    // Never walk away from the register in the middle of ringing someone up.
    if (w.node === 'DESK' && !w.path.length && r.queue[0] && r.queue[0].state === 'pay') return null;
    // The shopkeeper does your errands before anything else.
    if (w.role === 'keeper' && keeperJobs.length) {
      const j = keeperJobs.shift();
      if (j.type === 'collect') return collectJob(s, w, j.hive);
      if (j.type === 'tend') return tendJob(s, w);
      if (j.type === 'restock') return restockJob(s, w, cap - 1);
    }
    const duty = dutyOf(s, w);
    if (duty === 'register') {
      // Night: the shop is shut, so top up every shelf for the morning.
      if (night && shelvesNeed(s, cap - 1) && !restocking(w)) return restockJob(s, w, cap - 1);
      // Daytime: the shopkeeper quietly refills an EMPTY shelf, but only if
      // nobody is on shelf duty and they aren't leaving a line unattended.
      const covered = registerCrew(s).length > 1 || !r.queue.length;
      if (w.role === 'keeper' && !onDuty(s, 'stock') && covered && shelvesNeed(s, 0) && !restocking(w)) return restockJob(s, w, 1);
      return null;
    }
    if (duty === 'stock') {
      const threshold = night ? cap - 1 : 3; // at night, fill shelves right up
      if (shelvesNeed(s, threshold) && !restocking(w)) return restockJob(s, w, threshold);
      return null;
    }
    if (duty === 'collect') {
      // Fullest hive first, skipping any another worker is already heading to.
      const taken = new Set(r.workers.filter((o) => o !== w && o.targetHive != null).map((o) => o.targetHive));
      let best = -1, bestFill = 0.3;
      s.hives.forEach((h, i) => {
        const fill = f().honeyIn(h) / f().honeyCap(h);
        if (!taken.has(i) && fill >= bestFill) {
          best = i;
          bestFill = fill;
        }
      });
      if (best >= 0) return collectJob(s, w, best);
      return null;
    }
    if (duty === 'candles' && s.machine) {
      const m = s.machine;
      const tending = r.workers.some((o) => o !== w && o.job && o.job.type === 'tend');
      if (!tending && (m.candles >= 4 || (m.wax <= f().machineCap(s) * 0.3 && (s.store.wax || 0) >= 3))) return tendJob(s, w);
    }
    return null;
  }
  // Is another worker already out restocking? (Two stockers would just get
  // in each other's way over the same shelves.)
  function restocking(w) {
    return rt().workers.some((o) => o !== w && o.job && o.job.type === 'restock');
  }

  // ---------------------------------------------------------------------------
  // Carrying out the current job, step by step
  // ---------------------------------------------------------------------------
  function runJob(s, w, dt) {
    const job = w.job;
    for (let guard = 0; guard < 20; guard++) {
      const step = job.steps[job.i];
      if (!step) {
        w.job = null;
        return;
      }
      if (step.go) {
        if (!w.path.length && w.node === step.go) {
          job.i++;
          continue;
        }
        if (!w.path.length) w.path = nav.route(w.node, step.go);
        // "Quick feet" training makes a helper walk faster.
        w.speed = (w.role === 'keeper' ? 38 : 34) * (1 + D.TRAINING.speed.per * f().trainLevel(s, w.role, 'speed'));
        if (nav.moveAlong(w, dt)) {
          w.node = step.go;
          job.i++;
        }
        return;
      }
      if (step.wait != null) {
        w.waitT += dt;
        if (w.waitT < step.wait) return;
        w.waitT = 0;
        job.i++;
        continue;
      }
      if (step.act) {
        const res = step.act(s, w) || {};
        job.i++;
        const extra = [];
        if (res.wait) extra.push({ wait: res.wait });
        if (res.insert) extra.push(...res.insert);
        if (extra.length) job.steps.splice(job.i, 0, ...extra);
        if (res.wait) return;
      }
    }
  }

  // Called every update.
  function update(s, dt) {
    sync(s);
    for (const w of rt().workers) {
      if (w.job) {
        runJob(s, w, dt);
        continue;
      }
      // Idle: look for work (staff check twice a second; the keeper every frame).
      w.thinkT -= dt;
      if (w.role !== 'keeper' && w.thinkT > 0) continue;
      w.thinkT = 0.5;
      w.job = nextJobFor(s, w);
      if (!w.job && w.node !== homeOf(s, w)) w.job = homeJob(s, w);
      if (!w.job) {
        // Stand facing the right way at home.
        w.dir = w.node === 'SIDE' ? 'down' : D.duty[dutyOf(s, w)].face;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Questions other files ask
  // ---------------------------------------------------------------------------
  // Is someone standing at the register ready to take payment?
  function cashierPresent(s) {
    return rt().workers.some((w) => !w.job && !w.path.length && w.node === 'DESK');
  }
  // Is a second person standing beside the register to bag? (Faster checkout.)
  function baggerPresent(s) {
    return rt().workers.some((w) => !w.job && !w.path.length && w.node === 'SIDE' && dutyOf(s, w) === 'register');
  }

  function keeper() {
    return rt().workers.find((w) => w.role === 'keeper');
  }

  // Ask the shopkeeper to collect from hive i (queued if they're busy).
  function orderCollect(s, i) {
    if (keeperJobs.some((j) => j.type === 'collect' && j.hive === i)) return { ok: false, msg: 'Already on the list.' };
    const k = keeper();
    if (k && k.job && k.job.type === 'collect' && k.job.hive === i) return { ok: false, msg: 'On the way already.' };
    if (keeperJobs.length >= 6) return { ok: false, msg: 'The shopkeeper has enough errands for now.' };
    keeperJobs.push({ type: 'collect', hive: i });
    return { ok: true };
  }
  function orderTend() {
    if (keeperJobs.some((j) => j.type === 'tend')) return { ok: false, msg: 'Already on the list.' };
    keeperJobs.push({ type: 'tend' });
    return { ok: true };
  }
  function orderRestock() {
    if (keeperJobs.some((j) => j.type === 'restock')) return { ok: false, msg: 'Already on the list.' };
    keeperJobs.push({ type: 'restock' });
    return { ok: true };
  }
  function cancelErrands() {
    keeperJobs.length = 0;
  }

  // A short sentence describing what a worker is up to (shown in the UI).
  function statusOf(s, w) {
    if (w.job) return w.job.label;
    if (w.node === 'DESK') return f().isOpen(s) ? 'At the register' : 'At the register (shop closed)';
    if (w.node === 'SIDE') return dutyOf(s, w) === 'register' ? 'Bagging beside the register' : 'Beside the register';
    return { stock: 'Waiting by the storeroom', collect: 'Watching the hives', candles: 'Minding the machine' }[dutyOf(s, w)] || 'Idle';
  }
  // The display name of a worker.
  const nameOf = (w) => (w.role === 'keeper' ? 'Shopkeeper' : D.staff[w.role].name);

  HC.workers = {
    sync, update, dropAll, cashierPresent, baggerPresent, keeper, orderCollect, orderTend, orderRestock, cancelErrands,
    statusOf, homeOf, dutyOf, onDuty, nameOf, keeperJobs,
    get list() { return rt().workers; },
  };
})();
