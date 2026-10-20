// Service Worker: App-Hülle offline verfügbar machen.
// Hörproben (Deezer) und Plakate (Wikipedia) werden nicht zwischengespeichert.
const CACHE = 'kinoreise-v3'

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './filme.js', './filme-mehr.js', './pruefung.js', './manifest.webmanifest', './icon.svg'])).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()))
})

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)
  if (e.request.method !== 'GET' || url.origin !== location.origin) return
  // Erst Netz (für Updates), sonst Cache
  e.respondWith(fetch(e.request).then((r) => {
    if (r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)) }
    return r
  }).catch(() => caches.match(e.request).then((hit) => hit || caches.match('./'))))
})
