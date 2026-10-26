// Service Worker: Das ganze Spiel wird bei der Installation zwischengespeichert und danach
// zuerst aus dem Cache geladen („cache first“) – so startet es auch ganz ohne Internet.
// Bei jeder Änderung an einer Datei die Versionsnummer erhöhen, damit Geräte das Update holen.
const CACHE = 'towerfall-v6'
const DATEIEN = [
  './',
  './index.html',
  './css/style.css',
  './manifest.webmanifest',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png',
  './js/main.js',
  './js/audio.js',
  './js/pwa.js',
  './js/storage.js',
  './js/config/balance.js',
  './js/config/enemies.js',
  './js/config/maps.js',
  './js/config/terrain.js',
  './js/config/towers.js',
  './js/config/ui.js',
  './js/config/waves.js',
  './js/core/loop.js',
  './js/core/math.js',
  './js/core/rng.js',
  './js/game/construction.js',
  './js/game/economy.js',
  './js/game/enemies.js',
  './js/game/game.js',
  './js/game/grid.js',
  './js/game/obstacles.js',
  './js/game/path.js',
  './js/game/placement.js',
  './js/game/projectiles.js',
  './js/game/routes.js',
  './js/game/savegame.js',
  './js/game/telemetry.js',
  './js/game/status.js',
  './js/game/terrainmap.js',
  './js/game/towers.js',
  './js/game/waves.js',
  './js/render/effects.js',
  './js/render/loupe.js',
  './js/render/renderer.js',
  './js/render/sprites.js',
  './js/render/terrain.js',
  './js/ui/controller.js',
  './js/ui/format.js',
  './js/ui/hud.js',
  './js/ui/input.js',
  './js/ui/guard.js',
  './js/ui/keys.js',
  './js/ui/sheet.js',
  './js/ui/modal.js',
  './js/ui/panel.js',
]

self.addEventListener('install', (e) => {
  // cache: 'reload' umgeht den HTTP-Cache, damit wirklich die neue Version gespeichert wird
  e.waitUntil(caches.open(CACHE)
    .then((c) => c.addAll(DATEIEN.map((url) => new Request(url, { cache: 'reload' }))))
    .then(() => self.skipWaiting()))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('towerfall-') && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()))
})

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)
  if (e.request.method !== 'GET' || url.origin !== location.origin) return
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((hit) => {
    if (hit) return hit
    return fetch(e.request).then((r) => {
      if (r.ok && r.type === 'basic') { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)) }
      return r
    }).catch(() => (e.request.mode === 'navigate' ? caches.match('./index.html') : Response.error()))
  }))
})
