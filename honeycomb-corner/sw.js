// Offline support for the installable (PWA) version: cache the app shell,
// serve it cache-first, and refresh the cache in the background.
const CACHE = 'honeycomb-corner-v2';
const SHELL = [
  './', './index.html', './manifest.webmanifest', './css/style.css',
  './js/util.js', './js/data.js', './js/state.js', './js/nav.js', './js/sim.js', './js/builds.js', './js/customers.js',
  './js/workers.js', './js/actions.js', './js/goals.js',
  './js/sprites.js', './js/render.js', './js/audio.js', './js/ui.js', './js/main.js',
  './icons/icon-192.png', './icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

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
