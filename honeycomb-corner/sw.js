// =============================================================================
// sw.js: OFFLINE HELPER ("service worker")
// -----------------------------------------------------------------------------
// When the game is hosted on a normal website and added to a phone's home
// screen, the browser runs this small helper in the background. It keeps a
// copy of every game file (the "cache"), so the game still opens with no
// internet connection.
//
// Strategy: answer from the saved copy straight away if there is one, and
// quietly fetch a fresh copy for next time.
//
// IMPORTANT when changing the game: bump the version in CACHE below (v12 → v13)
// so phones throw away their old copies and download the new files. Also
// add any new .js file to the SHELL list.
// =============================================================================
const CACHE = 'honeycomb-corner-v12';
const SHELL = [
  './', './index.html', './manifest.webmanifest', './css/style.css',
  './js/util.js', './js/data.js', './js/state.js', './js/nav.js', './js/sim.js', './js/builds.js', './js/customers.js',
  './js/workers.js', './js/actions.js', './js/goals.js',
  './js/sprites.js', './js/render.js', './js/audio.js', './js/ui.js', './js/track.js', './js/main.js',
  './icons/icon-192.png', './icons/icon-512.png',
];

// First install: download and save every file in SHELL.
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

// A new version took over: delete copies saved by older versions.
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

// Every time the game asks for a file: reply with the saved copy if we have
// one, and refresh it in the background. Only our own files and the fonts
// are saved.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then((hit) => {
      const net = fetch(e.request)
        .then((res) => {
          if (res && res.ok && (new URL(e.request.url).origin === location.origin || e.request.url.includes('fonts.g'))) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy));
          }
          return res;
        })
        .catch(() => hit);
      return hit || net;
    })
  );
});
