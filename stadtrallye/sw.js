// Service Worker: App und Stadtdaten offline verfügbar machen.
// Kartenkacheln (OpenStreetMap) werden bewusst nicht zwischengespeichert.
const CACHE = 'stadtfuchs-v4'
const STAEDTE = ['berlin', 'bremen', 'dorsten', 'duesseldorf', 'frankfurt', 'haltern', 'hamburg', 'koeln', 'lippe_hohe_mark', 'muenchen', 'schermbeck', 'stuttgart', 'voerde']
const DATEIEN = ['./', './app.js', './manifest.webmanifest', './icon.svg', './daten/grundlagen.json', './daten/staedte.json', ...STAEDTE.map((s) => `./daten/staedte/${s}.json`)]

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(DATEIEN)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()))
})

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)
  if (e.request.method !== 'GET' || url.origin !== location.origin) return
  // Erst Netz (für aktuelle Daten), sonst Cache
  e.respondWith(fetch(e.request).then((r) => {
    if (r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)) }
    return r
  }).catch(() => caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || caches.match('./'))))
})
