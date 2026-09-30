// =============================================================================
// builds.js: UPGRADES TAKE TIME
// -----------------------------------------------------------------------------
// Buying an upgrade no longer takes effect instantly. You pay up front, and
// a "build" starts with a timer. When the timer runs out, the upgrade is
// applied. You have one builder, so only one thing is built at a time,
// unless you buy a second builder with gems.
//
// Timers count against the game clock (s.clock), which keeps running while
// you're away, so builds finish even if the game is closed.
//
// A build in the save looks like:
//   { id, kind, key, label, end, dur }
//   kind  - what's being built: 'upgrade', 'hive', 'hiveUp', 'machine', 'machineUp'
//   key   - which one (e.g. the upgrade id 'sign', or the hive number)
//   end   - the game-clock time it finishes
// =============================================================================
(function () {
  const HC = window.HC;
  const { util, data: D, bus } = HC;
  const f = () => HC.sim.f;

  // Is this particular thing already being built? Returns the build or null.
  function find(s, kind, key) {
    return s.builds.find((b) => b.kind === kind && String(b.key) === String(key)) || null;
  }
  const freeBuilder = (s) => s.builds.length < s.builders;
  const left = (s, b) => Math.max(0, b.end - s.clock);

  // Start building. `cost` coins are paid now; returns {ok, msg}.
  function start(s, kind, key, label, cost) {
    if (find(s, kind, key)) return { ok: false, msg: label + ' is already being built.' };
    if (!freeBuilder(s)) return { ok: false, msg: 'Your builder is busy. Wait for the current build, or finish it now with gems.' };
    if (s.coins < cost) return { ok: false, msg: 'Not enough coins.' };
    s.coins -= cost;
    const dur = f().buildTime(cost);
    s.builds.push({ id: util.uid(), kind, key, label, end: s.clock + dur, dur, cost });
    bus.emit('buildStart', { label, dur });
    bus.emit('dirty');
    return { ok: true, msg: 'Building ' + label + '. Ready in ' + util.fmtTime(dur) + '.' };
  }

  // Apply a finished build's effect.
  function finish(s, b) {
    s.builds = s.builds.filter((x) => x !== b);
    if (b.kind === 'upgrade') {
      s.up[b.key]++;
      if (b.key === 'shelf') {
        s.shelves.push({ good: null, qty: 0 });
        // Fill the new shelf with your best sellable product not already out.
        const shelved = new Set(s.shelves.map((x) => x.good));
        const best = D.GOODS.filter((g) => s.unlockedGoods[g.id] && !g.raw && !shelved.has(g.id)).pop();
        if (best) s.shelves[s.shelves.length - 1].good = best.id;
      }
      if (b.key === 'nursery') s.nursery.push(null);
    } else if (b.kind === 'hive') {
      s.hives.push({ level: 0, bees: [], stock: {} });
      fillFromBox(s, s.hives[s.hives.length - 1]);
    } else if (b.kind === 'hiveUp') {
      const h = s.hives[b.key];
      if (h) {
        h.level++;
        fillFromBox(s, h);
      }
    } else if (b.kind === 'machine') {
      s.machine = { level: 0, wax: 0, candles: 0, prog: 0 };
    } else if (b.kind === 'machineUp' && s.machine) {
      s.machine.level++;
    }
    if (!HC.sim.rt.silent) bus.emit('built', b);
    bus.emit('dirty');
  }

  // New or bigger hives take spare bees from the bee box automatically.
  function fillFromBox(s, h) {
    while (s.box.length && h.bees.length < f().hiveCap(h)) h.bees.push(s.box.shift());
  }

  // Called every update: finish anything whose time is up.
  function update(s) {
    for (const b of s.builds.slice()) if (s.clock >= b.end) finish(s, b);
  }

  // Finish a build right now by paying gems.
  function skip(s, id) {
    const b = s.builds.find((x) => x.id === id);
    if (!b) return { ok: false, msg: 'That build already finished.' };
    const cost = f().gemsToSkip(left(s, b));
    if (s.gems < cost) return { ok: false, msg: 'Not enough gems. Goals, requests and festivals award more.' };
    s.gems -= cost;
    if (HC.track) HC.track.gemSkip(cost); // playtest notes (track.js)
    s.stats.skips++;
    finish(s, b);
    return { ok: true, msg: b.label + ' finished.' };
  }

  // Note: finishing early costs GEMS only. (Playtest 4: coins must not
  // shortcut builds; waiting, or spending gems, is the point.)
  HC.builds = { start, finish, update, skip, find, left, freeBuilder };
})();
