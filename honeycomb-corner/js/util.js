// =============================================================================
// util.js: SMALL HELPER TOOLS USED EVERYWHERE
// -----------------------------------------------------------------------------
// This file loads first. It creates the shared `HC` object that every other
// file attaches itself to, and fills in:
//   HC.util - little maths/text helpers (random numbers, number formatting...)
//   HC.bus  - a "message board" that lets parts of the game tell each other
//             when something happened (e.g. "a sale happened!") without
//             needing to know about each other.
//
// How the files fit together: the game has no build step. index.html simply
// loads each .js file in order with a <script> tag. Every file is wrapped in
// `(function () { ... })();`, a pattern that keeps its private variables from
// leaking out, and shares only what it deliberately puts onto `HC`.
// =============================================================================
(function () {
  // Create HC once (or reuse it if it already exists) and put it on `window`,
  // the browser's global object, so every file can reach it.
  const HC = (window.HC = window.HC || {});

  // Letters used to shorten big numbers: 12,300 -> 12.3K, 4,500,000 -> 4.50M.
  const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc'];

  const util = {
    // Keep a number inside a range: clamp(15, 0, 10) gives 10.
    clamp: (v, a, b) => (v < a ? a : v > b ? b : v),
    // Blend between two numbers: lerp(0, 100, 0.25) gives 25.
    lerp: (a, b, t) => a + (b - a) * t,
    // A random decimal between a and b.
    rand: (a, b) => a + Math.random() * (b - a),
    // A random whole number between a and b, including both ends.
    randInt: (a, b) => Math.floor(a + Math.random() * (b - a + 1)),
    // A random item from a list.
    pick: (arr) => arr[Math.floor(Math.random() * arr.length)],
    // True with probability p: chance(0.25) is true about 1 time in 4.
    chance: (p) => Math.random() < p,

    // Pick a random item where some items are more likely than others.
    // weightFn gives each item a "weight"; an item with weight 10 is picked
    // twice as often as one with weight 5. Returns null if nothing can be picked.
    weighted(items, weightFn) {
      let total = 0;
      const ws = items.map((it) => {
        const w = Math.max(0, weightFn(it));
        total += w;
        return w;
      });
      if (total <= 0) return null;
      let r = Math.random() * total;
      for (let i = 0; i < items.length; i++) {
        r -= ws[i];
        if (r <= 0) return items[i];
      }
      return items[items.length - 1];
    },

    // A random number that is usually close to 0 and rarely far from it
    // (a "bell curve"). Used so baby bees' vigor is usually near their
    // parents' but occasionally a big jump.
    gauss() {
      let u = 0, v = 0;
      while (!u) u = Math.random();
      while (!v) v = Math.random();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    },

    // A "repeatable" random generator: given the same seed it produces the
    // same sequence every time. That keeps the grass speckles and flower
    // positions identical on every visit instead of reshuffling.
    seeded(seed) {
      let a = seed >>> 0;
      return function () {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    },

    // Turn a piece of text into a big number that's always the same for the
    // same text. Used to give each bee its own steady flight pattern.
    hash(str) {
      let h = 2166136261;
      for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      return h >>> 0;
    },

    // A short random id like "k3f9zq1ab", used to tell bees, orders etc. apart.
    uid() {
      return Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);
    },

    // Format a number for display: 1234 -> "1,234"; 12345 -> "12.3K";
    // 1500000000 -> "1.50B".
    fmt(n) {
      if (!isFinite(n)) return '∞';
      const neg = n < 0;
      n = Math.abs(n);
      let out;
      if (n < 10000) {
        out = n < 10 && n % 1 !== 0 ? n.toFixed(1) : Math.floor(n).toLocaleString('en-US');
      } else {
        let i = 0;
        while (n >= 1000 && i < SUFFIXES.length - 1) {
          n /= 1000;
          i++;
        }
        out = (n >= 100 ? n.toFixed(0) : n >= 10 ? n.toFixed(1) : n.toFixed(2)) + SUFFIXES[i];
      }
      return (neg ? '-' : '') + out;
    },

    // A shorter format for the tiny pixel font inside the game picture, which
    // only knows digits, '.', and the letters K, M, B and T.
    fmtShort(n) {
      n = Math.floor(n);
      if (n < 1000) return String(n);
      let i = 0;
      while (n >= 1000 && i < 4) {
        n /= 1000;
        i++;
      }
      return (n >= 100 ? n.toFixed(0) : n.toFixed(1)) + ' KMBT'[i];
    },

    // Seconds to friendly text: 45 -> "45s", 125 -> "2m 05s", 4000 -> "1h 06m".
    fmtTime(s) {
      s = Math.max(0, Math.ceil(s));
      if (s < 60) return s + 's';
      const m = Math.floor(s / 60), r = s % 60;
      if (m < 60) return m + 'm ' + String(r).padStart(2, '0') + 's';
      const h = Math.floor(m / 60);
      return h + 'h ' + String(m % 60).padStart(2, '0') + 'm';
    },

    // 1.25 -> "125%"
    pct: (v) => Math.round(v * 100) + '%',

    // Make text safe to put inside a web page. Without this, a bee renamed
    // "<b>" would be treated as page code instead of shown as letters.
    esc(s) {
      return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    },

    // The browser's built-in save space ("localStorage"). Some browsers block
    // it (private windows, strict settings), so every use is wrapped in
    // try/catch: if saving fails, the game keeps running instead of crashing.
    store: {
      get(k) {
        try { return window.localStorage.getItem(k); } catch (e) { return null; }
      },
      set(k, v) {
        try { window.localStorage.setItem(k, v); return true; } catch (e) { return false; }
      },
      del(k) {
        try { window.localStorage.removeItem(k); } catch (e) { /* ignore */ }
      },
    },
  };

  // ---------------------------------------------------------------------------
  // THE MESSAGE BOARD ("event bus")
  // One part of the game calls HC.bus.emit('sale', details) to announce
  // something. Any other part that earlier said HC.bus.on('sale', fn) gets its
  // function `fn` called with the details. For example, a sale makes the audio
  // play a coin sound and the UI refresh, without the shop code knowing either
  // of those exist.
  // ---------------------------------------------------------------------------
  const handlers = {};
  HC.bus = {
    on(evt, fn) {
      (handlers[evt] = handlers[evt] || []).push(fn);
    },
    emit(evt, payload) {
      (handlers[evt] || []).forEach((fn) => fn(payload));
      (handlers['*'] || []).forEach((fn) => fn(evt, payload));
    },
  };

  HC.util = util;
})();
