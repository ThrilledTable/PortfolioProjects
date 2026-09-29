// Shared helpers. Every module hangs off the global HC namespace so the game
// runs from plain <script> tags with no build step.
(function () {
  const HC = (window.HC = window.HC || {});

  const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc'];

  const util = {
    clamp: (v, a, b) => (v < a ? a : v > b ? b : v),
    lerp: (a, b, t) => a + (b - a) * t,
    rand: (a, b) => a + Math.random() * (b - a),
    randInt: (a, b) => Math.floor(a + Math.random() * (b - a + 1)),
    pick: (arr) => arr[Math.floor(Math.random() * arr.length)],
    chance: (p) => Math.random() < p,

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

    gauss() {
      let u = 0, v = 0;
      while (!u) u = Math.random();
      while (!v) v = Math.random();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    },

    // Deterministic PRNG so garden layout is identical every load.
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

    hash(str) {
      let h = 2166136261;
      for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      return h >>> 0;
    },

    uid() {
      return Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);
    },

    // 1234 -> "1,234"; 12345 -> "12.3K"; 1.5e9 -> "1.50B"
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

    // Short form used by the in-canvas bitmap font (only digits, K/M/B/T and '.').
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

    fmtTime(s) {
      s = Math.max(0, Math.ceil(s));
      if (s < 60) return s + 's';
      const m = Math.floor(s / 60), r = s % 60;
      if (m < 60) return m + 'm ' + String(r).padStart(2, '0') + 's';
      const h = Math.floor(m / 60);
      return h + 'h ' + String(m % 60).padStart(2, '0') + 'm';
    },

    pct: (v) => Math.round(v * 100) + '%',

    esc(s) {
      return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    },

    // Storage can be missing or throw (private mode, sandboxed previews).
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

  // Tiny pub/sub used by the sim to notify the UI, audio and renderer.
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
