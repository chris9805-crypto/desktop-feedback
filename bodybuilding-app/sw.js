/**
 * Service worker: makes the app work with no signal.
 *
 * Gyms have famously bad reception, and an app that will not open mid-session
 * because the basement has no bars is useless. Everything is cached on first
 * visit and served from cache thereafter; your training data never leaves the
 * device anyway, so there is nothing to sync.
 *
 * Strategy is cache-first with a background refresh: instant loads, and a new
 * version lands quietly on the visit after it ships.
 */

const VERSION = 'ironblock-v1';

const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './js/app.js',
  './js/store.js',
  './js/util/id.js',
  './js/data/exercises.js',
  './js/data/programs.js',
  './js/data/muscles.js',
  './js/data/glossary.js',
  './js/engine/onerm.js',
  './js/engine/progression.js',
  './js/engine/volume.js',
  './js/engine/mesocycle.js',
  './js/engine/equipment.js',
  './js/ui/dom.js',
  './js/ui/charts.js',
  './js/ui/sheet.js',
  './js/ui/term.js',
  './js/ui/explain.js',
  './js/ui/install.js',
  './js/ui/views/dashboard.js',
  './js/ui/views/programs.js',
  './js/ui/views/train.js',
  './js/ui/views/history.js',
  './js/ui/views/exercises.js',
  './js/ui/views/settings.js',
  './js/ui/views/learn.js',
  './js/ui/views/onboarding.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION)
      // Individually, so one 404 cannot stop the whole install and leave the
      // app with no offline copy at all.
      .then((cache) => Promise.all(SHELL.map((url) => cache.add(url).catch(() => null))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(VERSION).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      // Cached copy immediately when there is one; the refresh happens behind it.
      return cached || network;
    }),
  );
});
