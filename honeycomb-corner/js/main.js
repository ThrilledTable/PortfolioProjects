// Boot, main loop, autosave and away-time catch-up.
(function () {
  const HC = window.HC;

  const TICK = 1 / 20; // fixed simulation step
  let acc = 0, last = 0, renderClock = 0, hiddenAt = null;

  function save() {
    if (HC.game) HC.state.save(HC.game);
  }

  function replaceGame(s, fresh) {
    HC.game = s;
    HC.sim.resetRuntime();
    save();
    HC.audio.syncMusic();
    HC.ui.markDirty();
    HC.ui.render();
    if (fresh) HC.ui.setTab('apiary');
  }

  function frame(now) {
    if (!last) last = now;
    let dt = (now - last) / 1000;
    last = now;
    // A long stall (tab suspended, debugger) is handled by catch-up, not by
    // stepping the live sim thousands of times.
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

  // Installable/offline support when served from a normal web host. Inside
  // sandboxed embeds registration is refused, which is fine.
  function registerServiceWorker() {
    if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;
    if (!document.querySelector('link[rel="manifest"]')) return;
    try {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    } catch (e) {
      /* not allowed here */
    }
  }

  function awayCatchUp(seconds, showReport) {
    if (seconds < 5) return;
    const r = HC.sim.catchUp(HC.game, seconds);
    HC.sim.resetRuntime();
    HC.ui.markDirty();
    if (showReport && seconds >= 60 && (r.coins > 0 || r.sold > 0)) HC.ui.offlineModal(r);
  }

  function start(hotData) {
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

    HC.render.init(document.getElementById('scene'));
    HC.ui.init();

    if (!isNew && !restored) {
      const away = (Date.now() - (s.lastSeen || Date.now())) / 1000;
      awayCatchUp(away, true);
    }

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

    // Keep state across live updates of the published page.
    if (window.claude && window.claude.hot && window.claude.hot.snapshot) {
      window.claude.hot.snapshot(() => ({ save: HC.state.serialize(HC.game) }));
    }

    registerServiceWorker();

    requestAnimationFrame(frame);
  }

  HC.main = { save, replaceGame, start };

  const hot = window.claude && window.claude.hot;
  if (hot && hot.ready) hot.ready(start);
  else start((hot && hot.data) || {});
})();
