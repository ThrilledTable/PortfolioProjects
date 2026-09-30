// =============================================================================
// main.js: STARTING THE GAME AND KEEPING IT RUNNING
// -----------------------------------------------------------------------------
// This file loads last and ties everything together:
//   1. load your save (or start a new game)
//   2. if you've been away, fast-forward the game and show what happened
//   3. start the "game loop": over and over, as fast as the screen refreshes,
//      move the simulation forward and redraw the picture
//   4. save automatically every 5 seconds, and whenever you switch away
//
// FIXED STEPS: the simulation always advances in equal slices of 1/20th of a
// second, however fast or slow the device draws. A fast phone drawing 120
// times a second and a slow laptop drawing 30 times a second play out the
// same game.
// =============================================================================
(function () {
  const HC = window.HC;

  const TICK = 1 / 20; // one simulation step = 0.05 seconds
  let acc = 0; // time waiting to be simulated
  let last = 0; // timestamp of the previous frame
  let renderClock = 0; // animation clock for the picture
  let hiddenAt = null; // when the tab was hidden

  function save() {
    if (HC.game) HC.state.save(HC.game);
  }

  // Swap in a different game (import, reset, festival).
  function replaceGame(s, fresh) {
    HC.game = s;
    HC.workers.cancelErrands();
    HC.sim.resetRuntime();
    save();
    HC.audio.syncMusic();
    HC.ui.markDirty();
    HC.ui.render();
    if (fresh) HC.ui.setTab('apiary');
  }

  // Called by the browser once per screen refresh.
  function frame(now) {
    if (!last) last = now;
    let dt = (now - last) / 1000;
    last = now;
    // A long pause (tab suspended, laptop asleep) is handled by the
    // fast-forward, not by grinding through thousands of steps.
    if (dt > 5) {
      awayCatchUp(dt, false);
      dt = 0;
    }
    dt = Math.min(dt, 0.25);
    acc += dt;
    while (acc >= TICK) {
      HC.sim.update(HC.game, TICK);
      acc -= TICK;
    }
    renderClock += dt;
    HC.render.draw(HC.game, renderClock);
    requestAnimationFrame(frame);
  }

  // Lets the game be installed on a phone's home screen and play offline,
  // when it's hosted on a normal website. Inside sandboxed previews the
  // browser refuses, which is fine.
  function registerServiceWorker() {
    if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;
    if (!document.querySelector('link[rel="manifest"]')) return;
    try {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    } catch (e) {
      /* not allowed here */
    }
  }

  // Fast-forward `seconds` and (optionally) show the "While you were away"
  // report if anything worth mentioning happened.
  function awayCatchUp(seconds, showReport) {
    if (seconds < 5) return;
    const r = HC.sim.catchUp(HC.game, seconds);
    HC.sim.resetRuntime();
    HC.ui.markDirty();
    const worthIt = r.coins > 0 || r.sold > 0 || r.fullHives.length || r.eggs || r.gems;
    if (showReport && seconds >= 60 && worthIt) HC.ui.offlineModal(r);
  }

  function start(hotData) {
    // `hotData` is only used when the published page is updated while open:
    // the running game is handed over so nothing is lost.
    let s = null, restored = false;
    if (hotData && hotData.save) {
      try {
        s = HC.state.deserialize(hotData.save);
        restored = true;
      } catch (e) {
        s = null;
      }
    }
    if (!s) s = HC.state.load();
    const isNew = !s;
    if (!s) s = HC.state.newGame();
    HC.game = s;
    HC.sim.resetRuntime(); // creates the shopkeeper and any hired staff

    HC.render.init(document.getElementById('scene'));
    HC.ui.init();
    if (HC.track) HC.track.init(); // playtest notes (skipped if that file failed to load): sessions, days, goals, gem use (track.js)

    if (!isNew && !restored) {
      const away = (Date.now() - (s.lastSeen || Date.now())) / 1000;
      awayCatchUp(away, true);
    }

    // Switching tabs or locking the phone: save, then fast-forward on return.
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        hiddenAt = Date.now();
        save();
      } else if (hiddenAt) {
        const away = (Date.now() - hiddenAt) / 1000;
        hiddenAt = null;
        last = 0;
        awayCatchUp(away, away > 120);
      }
    });
    window.addEventListener('pagehide', save);
    setInterval(save, 5000);

    if (window.claude && window.claude.hot && window.claude.hot.snapshot) {
      window.claude.hot.snapshot(() => ({ save: HC.state.serialize(HC.game) }));
    }

    registerServiceWorker();
    requestAnimationFrame(frame);
  }

  HC.main = { save, replaceGame, start };

  const hot = window.claude && window.claude.hot;
  if (hot && hot.ready) hot.ready(start);
  // In the phone app, first bring back the app's copy of the save if the
  // browser storage was wiped (see util.store.restoreNative). Elsewhere this
  // finishes instantly.
  else HC.util.store.restoreNative(HC.data.SAVE_KEY).then(() => start((hot && hot.data) || {}));
})();
