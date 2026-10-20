// Stadtfuchs – Stadtrallyes für jeden Anlass.
// Alles läuft im Browser: Stadtdaten kommen aus daten/*.json, Spielstand liegt im localStorage,
// Fotos in IndexedDB. Eine Rallye ist durch (Stadt, Anlass, Thema, Format, Orte, Zufallszahl)
// vollständig bestimmt – deshalb lässt sie sich als Link an andere Teams weitergeben.
'use strict'

const SPEICHER = 'stadtfuchs.rallye.v1'
const app = document.getElementById('app')
const S = { grund: null, staedte: [], stadtCache: {}, plan: null, rallye: null, karte: null, ort: null, gpsWatch: null }

// ---------- Hilfsfunktionen ----------
const $ = (sel, el = document) => el.querySelector(sel)
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
// Tausenderpunkt erst ab 10.000, damit Jahreszahlen wie 1575 nicht als „1.575“ erscheinen
const zahlDe = (n, stellen = 0) => Number(n).toLocaleString('de-DE', { maximumFractionDigits: stellen, useGrouping: Math.abs(n) >= 10000 })

function zufall(seed) { // mulberry32 – gleiche Zahl, gleiche Rallye
  let a = seed >>> 0
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}
const mische = (liste, rnd) => { const a = [...liste]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] } return a }
const waehle = (liste, rnd) => liste[Math.floor(rnd() * liste.length)]

function abstand(a, b) {
  const r = Math.PI / 180
  const h = Math.sin((b[0] - a[0]) * r / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin((b[1] - a[1]) * r / 2) ** 2
  return 2 * 6371000 * Math.asin(Math.sqrt(h))
}
function richtung(a, b) {
  const r = Math.PI / 180
  const y = Math.sin((b[1] - a[1]) * r) * Math.cos(b[0] * r)
  const x = Math.cos(a[0] * r) * Math.sin(b[0] * r) - Math.sin(a[0] * r) * Math.cos(b[0] * r) * Math.cos((b[1] - a[1]) * r)
  return (Math.atan2(y, x) / r + 360) % 360
}
const himmel = (grad) => ['Norden', 'Nordosten', 'Osten', 'Südosten', 'Süden', 'Südwesten', 'Westen', 'Nordwesten'][Math.round(grad / 45) % 8]
const meter = (m) => m < 1000 ? `${Math.round(m / 10) * 10} m` : `${zahlDe(m / 1000, 1)} km`
const dauer = (min) => { min = Math.round(min / 5) * 5; const h = Math.floor(min / 60), m = min % 60; return h ? `${h} Std.${m ? ' ' + m + ' Min.' : ''}` : `${m} Min.` }

function toast(text) {
  document.querySelectorAll('.toast').forEach((t) => t.remove())
  const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = text
  document.body.append(t); setTimeout(() => t.remove(), 2600)
}
function lies(schluessel) { try { return JSON.parse(localStorage.getItem(schluessel)) } catch { return null } }
function schreibe(schluessel, wert) { try { localStorage.setItem(schluessel, JSON.stringify(wert)) } catch { /* privater Modus */ } }
function speichern() { if (S.rallye) schreibe(SPEICHER, S.rallye) }

const anlass = (id) => S.grund.anlaesse.find((a) => a.id === id)
const thema = (id) => S.grund.themen.find((t) => t.id === id)
const format = (id) => S.grund.formate.find((f) => f.id === id)

const FUCHS = `<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="30" fill="var(--fuchs)"/><path d="M14 18 L24 30 L32 27 L40 30 L50 18 L48 36 L32 50 L16 36 Z" fill="#fff"/><path d="M16 36 L32 50 L48 36 L40 40 L32 44 L24 40 Z" fill="var(--tinte)" opacity=".18"/><circle cx="25.5" cy="35" r="2.6" fill="var(--tinte)"/><circle cx="38.5" cy="35" r="2.6" fill="var(--tinte)"/><path d="M29.5 43 h5 l-2.5 3 z" fill="var(--tinte)"/></svg>`
const PFEIL = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 L19 20 L12 16 L5 20 Z" fill="var(--fuchs)"/></svg>`
const TYPNAMEN = { quiz: 'Quizfrage', schaetzen: 'Schätzfrage', foto: 'Foto-Aufgabe', mission: 'Mission', suchen: 'Such-Aufgabe', bewegen: 'Bewegung' }

// ---------- Daten laden ----------
async function ladeJson(pfad) { const r = await fetch(pfad); if (!r.ok) throw new Error(pfad); return r.json() }
async function ladeStadt(id) {
  if (!S.stadtCache[id]) S.stadtCache[id] = await ladeJson(`daten/staedte/${id}.json`)
  return S.stadtCache[id]
}

// ---------- Routenplanung ----------
const erwachsen = (an) => an.niveau === 'erw'
function ortErlaubt(o, an, fo) {
  if (o.ab18 && !erwachsen(an)) return false
  if (!erwachsen(an) && o.themen[0] === 'kneipen') return false
  if (o.respekt && (an.id.startsWith('jga') || an.id === 'freunde' || an.niveau === 'kita')) return false
  if (fo.id === 'loesungswort' && !(o.aufgaben || []).some((a) => a.typ === 'quiz')) return false
  return true
}

function planeRoute(stadt, p, startLage) {
  const an = anlass(p.anlass), fo = format(p.format)
  const maxEtappe = an.maxEtappe * (p.rad ? 4 : 1)
  const n = an.stationen[p.laenge]
  const rnd = zufall(p.seed)
  const erlaubt = stadt.orte.filter((o) => ortErlaubt(o, an, fo))
  const passend = erlaubt.filter((o) => o.themen.includes(p.thema) || (p.thema === 'highlights' && o.prio >= 2))
  const kandidaten = passend.length >= n ? passend : [...passend, ...erlaubt.filter((o) => !passend.includes(o))]
  const gewicht = (o) => (passend.includes(o) ? 1 : 2.4) / (1 + 0.18 * (o.prio || 1))
  const versuche = []
  for (const erster of kandidaten) {
    const route = [erster]
    while (route.length < Math.min(n, kandidaten.length)) {
      const letzter = route[route.length - 1]
      let best = null, bestWert = Infinity
      for (const o of kandidaten) {
        if (route.includes(o)) continue
        const w = abstand(letzter.lage, o.lage) * gewicht(o) * (0.8 + 0.4 * rnd())
        if (w < bestWert) { bestWert = w; best = o }
      }
      route.push(best)
    }
    verbessere(route, startLage)
    let kosten = startLage ? abstand(startLage, route[0].lage) * 0.7 : 0
    for (let i = 1; i < route.length; i++) {
      const d = abstand(route[i - 1].lage, route[i].lage)
      kosten += d + Math.max(0, d - maxEtappe) * 3
    }
    kosten += route.filter((o) => !passend.includes(o)).length * 600
    kosten -= route.reduce((s, o) => s + (o.prio || 1), 0) * 60
    versuche.push({ route, kosten: kosten * (0.9 + 0.2 * rnd()) })
  }
  versuche.sort((a, b) => a.kosten - b.kosten)
  const auswahl = versuche[Math.floor(rnd() * Math.min(3, versuche.length))]
  return { orte: auswahl.route, zusatz: auswahl.route.filter((o) => !passend.includes(o)).map((o) => o.id) }
}

// 2-opt: Kreuzungen in der Route auflösen (offener Weg, optional mit festem Startpunkt)
function verbessere(route, startLage) {
  const punkt = (i) => (i < 0 ? startLage : route[i].lage)
  const d = (i, j) => (i < 0 && !startLage ? 0 : abstand(punkt(i), punkt(j)))
  let besser = true, runden = 0
  while (besser && runden++ < 30) {
    besser = false
    for (let i = 0; i < route.length - 1; i++) {
      for (let k = i + 1; k < route.length; k++) {
        const vorher = d(i - 1, i) + (k + 1 < route.length ? d(k, k + 1) : 0)
        const nachher = d(i - 1, k) + (k + 1 < route.length ? d(i, k + 1) : 0)
        if (nachher + 1 < vorher) { route.splice(i, k - i + 1, ...route.slice(i, k + 1).reverse()); besser = true }
      }
    }
  }
}

// ---------- Rallye zusammenbauen (deterministisch) ----------
function baueRallye(stadt, cfg) {
  const an = anlass(cfg.a), fo = format(cfg.f)
  const rnd = zufall(cfg.z * 7 + 13)
  const pools = an.pools
  const punkte = S.grund.punkte
  const stufe = an.frechheit ? Math.min(4, Math.max(1, cfg.st || 2)) : 1
  const naehe = (t) => Math.abs((t.stufe || 1) - stufe)
  const allgemein = mische(S.grund.aufgaben.filter((t) => t.pools.some((p) => pools.includes(p)) && (t.stufe || 1) <= stufe), rnd)
    .sort((a, b) => naehe(a) - naehe(b))
  const benutzt = new Set()
  const nimmAllgemein = (typen) => {
    const frei = allgemein.filter((t) => typen.includes(t.typ) && !benutzt.has(t.id))
    const t = frei[0] || allgemein.find((t) => typen.includes(t.typ))
    if (!t) return null
    benutzt.add(t.id)
    return { typ: t.typ, text: t.text, allgemein: true }
  }
  const kindlich = an.niveau === 'kita' || an.niveau === 'kind'
  const nimmQuiz = (o) => {
    const quiz = (o.aufgaben || []).filter((a) => a.typ === 'quiz')
    const bevorzugt = quiz.filter((q) => q.niveau === (kindlich ? 'kind' : 'erw'))
    return waehle(bevorzugt.length ? bevorzugt : quiz, rnd)
  }

  const orte = cfg.o.map((id) => stadt.orte.find((o) => o.id === id)).filter(Boolean)
  let wort = ''
  if (fo.id === 'loesungswort') {
    const n = orte.length
    const woerter = [...(stadt.loesungsworte || []), ...S.grund.loesungsworte]
    const genau = woerter.filter((w) => w.length === n)
    const kuerzer = woerter.filter((w) => w.length < n).sort((a, b) => b.length - a.length)
    wort = genau.length ? waehle(genau, rnd) : (kuerzer[0] || woerter[0])
  }

  const stationen = orte.map((o, pos) => {
    const aufgaben = []
    const eigene = (typen) => (o.aufgaben || []).filter((a) => typen.includes(a.typ))
    if (fo.id === 'loesungswort') {
      const q = nimmQuiz(o)
      aufgaben.push(quizAufbereiten(q, pos < wort.length ? wort[pos] : null, rnd))
    } else if (fo.id === 'foto') {
      if (o.respekt) { const q = nimmQuiz(o); if (q) aufgaben.push(quizAufbereiten(q, null, rnd)) }
      else {
        const f = rnd() < 0.65 && eigene(['foto']).length ? { ...waehle(eigene(['foto']), rnd) } : nimmAllgemein(['foto'])
        if (f) aufgaben.push(f)
      }
    } else if (fo.id === 'punkte') {
      const wissen = eigene(['quiz', 'schaetzen'])
      const schaetz = eigene(['schaetzen'])
      const w = !kindlich && schaetz.length && rnd() < 0.4 ? waehle(schaetz, rnd) : nimmQuiz(o) || waehle(wissen, rnd)
      if (w) aufgaben.push(w.typ === 'quiz' ? quizAufbereiten(w, null, rnd) : { ...w })
      if (!o.respekt) {
        const aktiv = eigene(['foto', 'mission', 'suchen', 'bewegen'])
        const lieberAllgemein = an.ab18 || an.niveau === 'kita' || !aktiv.length
        const a = lieberAllgemein && rnd() < (an.frechheit ? 0.85 : 0.7) ? nimmAllgemein(['foto', 'mission', 'suchen', 'bewegen']) : (aktiv.length ? { ...waehle(aktiv, rnd) } : null)
        if (a) aufgaben.push(a)
      }
    }
    aufgaben.forEach((a) => { a.punkte = punkte[a.typ] || 5 })
    return {
      id: o.id, pos, name: o.name, lage: o.lage, info: o.info, fakt: o.fakt || '', hinweis: o.hinweis || '', kosten: o.kosten || '',
      respekt: !!o.respekt, wiki: o.wiki || '', zusatz: (cfg.zusatz || []).includes(o.id), aufgaben
    }
  })

  // Versetzter Start für mehrere Teams: Reihenfolge rotieren, Lösungswort-Positionen bleiben
  const teams = Math.max(1, cfg.teams || 1), nr = Math.min(teams, Math.max(1, cfg.nr || 1))
  const verschiebung = Math.floor(((nr - 1) * stationen.length) / teams)
  const reihenfolge = [...stationen.slice(verschiebung), ...stationen.slice(0, verschiebung)]

  return {
    v: 1, cfg, stadtId: stadt.id, stadtName: stadt.name, wort, team: cfg.team || '', stationen: reihenfolge,
    index: 0, angekommen: {}, antworten: {}, notizen: {}, start: null, ende: null, geloest: false, gps: !!cfg.gps, rad: !!cfg.rad
  }
}

function quizAufbereiten(q, buchstabe, rnd) {
  if (!q) return null
  const texte = mische([q.richtig, ...q.falsch.slice(0, 3)], rnd)
  const richtigIndex = texte.indexOf(q.richtig)
  let buchstaben = null
  if (buchstabe) {
    const pool = mische('ABCDEFGHIKLMNOPRSTUWZ'.split('').filter((b) => b !== buchstabe), rnd)
    buchstaben = texte.map((_, i) => (i === richtigIndex ? buchstabe : pool[i]))
  }
  return { typ: 'quiz', frage: q.frage, optionen: texte, richtigIndex, buchstaben, niveau: q.niveau }
}

// ---------- Fotos (IndexedDB) ----------
let dbVersprechen = null
function db() {
  if (!dbVersprechen) dbVersprechen = new Promise((ok, fehler) => {
    const r = indexedDB.open('stadtfuchs', 1)
    r.onupgradeneeded = () => r.result.createObjectStore('fotos')
    r.onsuccess = () => ok(r.result); r.onerror = () => fehler(r.error)
  })
  return dbVersprechen
}
async function fotoSpeichern(schluessel, blob) {
  const d = await db()
  await new Promise((ok, fehler) => { const t = d.transaction('fotos', 'readwrite'); t.objectStore('fotos').put(blob, schluessel); t.oncomplete = ok; t.onerror = () => fehler(t.error) })
}
async function fotosLaden(praefix) {
  try {
    const d = await db()
    return await new Promise((ok) => {
      const erg = [], t = d.transaction('fotos').objectStore('fotos').openCursor()
      t.onsuccess = () => { const c = t.result; if (!c) return ok(erg); if (String(c.key).startsWith(praefix)) erg.push({ key: c.key, blob: c.value }); c.continue() }
      t.onerror = () => ok(erg)
    })
  } catch { return [] }
}
async function fotosLoeschen(praefix) {
  for (const f of await fotosLaden(praefix)) {
    const d = await db(); d.transaction('fotos', 'readwrite').objectStore('fotos').delete(f.key)
  }
}
function verkleinern(datei, max = 1600) {
  return new Promise((ok, fehler) => {
    const img = new Image()
    img.onload = () => {
      const f = Math.min(1, max / Math.max(img.width, img.height))
      const c = document.createElement('canvas'); c.width = Math.round(img.width * f); c.height = Math.round(img.height * f)
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
      URL.revokeObjectURL(img.src)
      c.toBlob((b) => (b ? ok(b) : fehler(new Error('Foto konnte nicht verarbeitet werden'))), 'image/jpeg', 0.85)
    }
    img.onerror = () => fehler(new Error('Foto konnte nicht gelesen werden'))
    img.src = URL.createObjectURL(datei)
  })
}

// ---------- Karte ----------
function zeigeKarte(el, punkte, optionen = {}) {
  if (S.karte) { S.karte.remove(); S.karte = null }
  if (!window.L || !el) { if (el) el.innerHTML = '<p class="leise klein" style="padding:12px">Karte nicht verfügbar (offline?). Die Route steht in der Liste.</p>'; return }
  const karte = L.map(el, { zoomControl: true, attributionControl: true, scrollWheelZoom: false })
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(karte)
  const linie = punkte.map((p) => p.lage)
  if (optionen.start) linie.unshift(optionen.start)
  L.polyline(linie, { color: getComputedStyle(document.documentElement).getPropertyValue('--fuchs').trim() || '#e05a14', weight: 4, dashArray: '2 8', lineCap: 'round' }).addTo(karte)
  punkte.forEach((p, i) => {
    const icon = L.divIcon({ className: '', html: `<div class="pin ${p.fertig ? 'fertig' : ''}">${i + 1}</div>`, iconSize: [28, 28], iconAnchor: [14, 14] })
    L.marker(p.lage, { icon, title: p.name }).addTo(karte).bindPopup(esc(p.name))
  })
  if (optionen.start) L.circleMarker(optionen.start, { radius: 6, color: '#fff', weight: 2, fillColor: '#2a6c99', fillOpacity: 1 }).addTo(karte).bindPopup('Start')
  karte.fitBounds(L.latLngBounds(linie), { padding: [28, 28], maxZoom: 16 })
  S.karte = karte
  S.ichMarker = null
  setTimeout(() => { if (S.karte === karte) karte.invalidateSize() }, 50)
}
function zeigeMichAufKarte() {
  if (!S.karte || !S.ort || !window.L) return
  const lage = [S.ort.lat, S.ort.lng]
  if (!S.ichMarker) S.ichMarker = L.marker(lage, { icon: L.divIcon({ className: '', html: '<div class="pin ich"></div>', iconSize: [18, 18], iconAnchor: [9, 9] }), title: 'Ihr seid hier' }).addTo(S.karte)
  else S.ichMarker.setLatLng(lage)
}

// ---------- GPS ----------
function gpsStarten() {
  if (S.gpsWatch !== null || !navigator.geolocation) return
  S.gpsWatch = navigator.geolocation.watchPosition((p) => {
    S.ort = { lat: p.coords.latitude, lng: p.coords.longitude, genau: p.coords.accuracy }
    zeigeMichAufKarte(); wegweiserAktualisieren()
  }, () => { S.ort = null; S.gpsFehler = true; wegweiserAktualisieren() }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 })
}
function gpsStoppen() { if (S.gpsWatch !== null) navigator.geolocation.clearWatch(S.gpsWatch); S.gpsWatch = null }
function einmalOrt() {
  return new Promise((ok) => {
    if (!navigator.geolocation) return ok(null)
    navigator.geolocation.getCurrentPosition((p) => ok([p.coords.latitude, p.coords.longitude]), () => ok(null), { enableHighAccuracy: true, timeout: 12000 })
  })
}

// ---------- Teilen: Rallye als Link ----------
function codiere(cfg) {
  const roh = JSON.stringify({ s: cfg.s, a: cfg.a, t: cfg.t, f: cfg.f, l: cfg.l, o: cfg.o, z: cfg.z, teams: cfg.teams, gps: cfg.gps ? 1 : 0, zusatz: cfg.zusatz, st: cfg.st, rad: cfg.rad })
  return btoa(unescape(encodeURIComponent(roh))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
function decodiere(text) {
  try { return JSON.parse(decodeURIComponent(escape(atob(text.replace(/-/g, '+').replace(/_/g, '/'))))) } catch { return null }
}
const teilLink = (cfg) => `${location.origin}${location.pathname}#r=${codiere(cfg)}`
async function ladeQr() {
  if (window.qrcode) return true
  return new Promise((ok) => {
    const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js'
    s.onload = () => ok(true); s.onerror = () => ok(false); document.head.append(s)
  })
}
async function kopieren(text) {
  try { await navigator.clipboard.writeText(text); toast('Link kopiert') } catch { window.prompt('Link kopieren:', text) }
}

// ---------- Navigation ----------
function gehe(hash) { if (location.hash === hash) zeichne(); else location.hash = hash }
window.addEventListener('hashchange', zeichne)

async function zeichne() {
  if (S.karte) { S.karte.remove(); S.karte = null }
  window.scrollTo(0, 0)
  const h = location.hash.slice(1)
  try {
    if (h.startsWith('r=')) return await zeigeEinladung(h.slice(2))
    if (h.startsWith('plan-')) return await zeigePlaner(h.slice(5))
    if (h.startsWith('pruefen-')) return await zeigePruefen(h.slice(8))
    if (h === 'spiel' && S.rallye) return zeigeSpiel()
    if (h === 'ende' && S.rallye) return zeigeEnde()
    if (h === 'ueber') return zeigeUeber()
    gpsStoppen()
    zeigeStart()
  } catch (e) {
    console.error(e)
    app.innerHTML = `${kopf()}<div class="karte stapel"><h2>Das hat nicht geklappt</h2><p>Die Daten konnten nicht geladen werden. Prüft die Internetverbindung und ladet die Seite neu.</p><button class="knopf haupt" onclick="location.reload()">Neu laden</button></div>`
  }
}

function kopf(rechts = '') {
  return `<header class="kopf"><a class="marke" href="#">${FUCHS}<b>${esc(S.grund?.marke || 'Stadtfuchs')}</b></a><div class="rechts">${rechts}</div></header>`
}

// ---------- Startseite ----------
function zeigeStart() {
  const r = S.rallye
  const offen = r && !r.ende
  app.innerHTML = `${kopf('<a class="knopf still klein" href="#ueber">Über</a>')}
  <section class="held">
    <span class="unterzeile">Stadtrallyes &amp; Schnitzeljagden</span>
    <h1>Eure Stadt als Spielfeld.</h1>
    <p>Junggesellenabschied, Wandertag, Kindergeburtstag oder einfach ein Tag in einer neuen Stadt: Wählt Anlass, Thema und Spielart – der Stadtfuchs plant die Route mit Quiz, Lösungswort, Foto-Aufgaben und Missionen.</p>
  </section>
  <div class="stapel">
    ${offen ? `<div class="karte weiter"><span class="etikett">Laufende Rallye</span><h2>${esc(r.stadtName)}${r.team ? ' · ' + esc(r.team) : ''}</h2>
      <p class="leise">Station ${Math.min(r.index + 1, r.stationen.length)} von ${r.stationen.length} · ${esc(format(r.cfg.f).name)}</p>
      <div class="zeile"><a class="knopf haupt" href="#spiel">Weiterspielen</a><button class="knopf" id="verwerfen">Beenden &amp; verwerfen</button></div></div>` : ''}
    ${r && r.ende ? `<div class="karte weiter"><span class="etikett">Zuletzt gespielt</span><h2>${esc(r.stadtName)}</h2><div class="zeile"><a class="knopf" href="#ende">Ergebnis &amp; Fotos ansehen</a></div></div>` : ''}
    <div class="schritt"><header><h2>Wählt eure Stadt</h2></header>
      <div class="staedte">${S.staedte.map((s) => `<button class="stadt" data-stadt="${s.id}"><b>${esc(s.name)}</b><span class="leise klein">${esc(s.kurz)}</span><span class="zahl">${s.orte} Stationen · ${esc(s.land)}</span>${s.entwurf ? '<span class="marke-entwurf">Testphase – bitte vor Ort prüfen</span>' : ''}</button>`).join('')}</div>
    </div>
    <div class="schritt"><header><h2>So läuft's</h2></header>
      <div class="ablauf">
        <div><b>Rallye planen</b><span class="leise klein">Anlass, Thema, Spielart und Länge wählen. Die Route wird automatisch zusammengestellt.</span></div>
        <div><b>Losziehen</b><span class="leise klein">Karte und Richtungspfeil führen euch von Station zu Station.</span></div>
        <div><b>Aufgaben lösen</b><span class="leise klein">Quizfragen, Schätzen, Fotos, Missionen – je nach Spielart.</span></div>
        <div><b>Feiern</b><span class="leise klein">Lösungswort, Punkte, Foto-Collage und Urkunde zum Abschluss.</span></div>
      </div>
    </div>
  </div>
  ${fuss()}`
  app.querySelectorAll('[data-stadt]').forEach((b) => b.onclick = () => gehe('#plan-' + b.dataset.stadt))
  const v = $('#verwerfen'); if (v) v.onclick = verwerfen
}
function fuss() {
  return `<footer class="fuss leise klein"><p>Inhalte nach bestem Wissen recherchiert (u. a. Wikipedia, OpenStreetMap). Öffnungszeiten, Preise und Zugänge ändern sich – bitte vorab prüfen. Fotos bleiben auf eurem Gerät.</p><p><a href="#ueber">Über Stadtfuchs, Datenquellen &amp; Hinweise</a></p></footer>`
}
async function verwerfen() {
  const btn = $('#verwerfen')
  if (btn.dataset.sicher !== '1') { btn.dataset.sicher = '1'; btn.textContent = 'Wirklich verwerfen?'; return }
  if (S.rallye) await fotosLoeschen(S.rallye.cfg.z + ':')
  S.rallye = null; try { localStorage.removeItem(SPEICHER) } catch {}
  zeichne()
}

// ---------- Planer ----------
async function zeigePlaner(stadtId) {
  const stadt = await ladeStadt(stadtId)
  const vorher = lies('stadtfuchs.plan') || {}
  if (!S.plan || S.plan.stadt !== stadtId) {
    S.plan = { stadt: stadtId, anlass: vorher.anlass || 'entdecker', thema: vorher.thema || 'highlights', format: vorher.format || 'loesungswort', laenge: vorher.laenge || 'mittel',
      start: 'zentrum', startLage: null, team: vorher.team || '', teams: 1, gps: false, stufe: vorher.stufe || 2, rad: false, seed: Math.floor(Math.random() * 1e9) }
  }
  pruefePlan(stadt)
  zeichnePlaner(stadt)
}

function pruefePlan(stadt) {
  const p = S.plan, an = anlass(p.anlass)
  if (!an.themen.includes(p.thema)) p.thema = an.themen[0]
  if (thema(p.thema).ab18 && !erwachsen(an)) p.thema = an.themen[0]
  if (!an.formate.includes(p.format)) p.format = an.formate[0]
}

function zeichnePlaner(stadt) {
  const p = S.plan, an = anlass(p.anlass)
  const zaehle = (tid) => stadt.orte.filter((o) => (o.themen.includes(tid) || (tid === 'highlights' && o.prio >= 2)) && ortErlaubt(o, an, format(p.format))).length
  const themenListe = an.themen.map(thema).filter((t) => !t.ab18 || erwachsen(an))
  app.innerHTML = `${kopf('<a class="knopf still klein" href="#">Städte</a>')}
  <section class="held"><span class="unterzeile">${esc(stadt.land)}</span><h1>Rallye durch ${esc(stadt.name)}</h1><p class="leise">${esc(stadt.kurz)}</p>
    <div class="zeile"><a class="knopf klein" href="#pruefen-${stadt.id}">Alle ${stadt.orte.length} Stationen ansehen &amp; prüfen</a></div></section>
  <div class="stapel">
    <section class="schritt"><header><span class="nr">1</span><h2>Wer ist dabei?</h2></header>
      <div class="chips">${S.grund.anlaesse.map((a) => `<button class="chip" data-anlass="${a.id}" aria-pressed="${a.id === p.anlass}"><span class="ic">${a.icon}</span><b>${esc(a.name)}</b><small>${esc(a.kurz)}</small></button>`).join('')}</div>
      ${an.frechheit ? `<div class="karte stapel"><h3>Wie frech darf's werden?</h3>
        <div class="chips">${S.grund.frechheit.map((f) => `<button class="chip" data-stufe="${f.stufe}" aria-pressed="${f.stufe === p.stufe}"><span class="ic">${f.icon}</span><b>${esc(f.name)}</b><small>${esc(f.kurz)}</small></button>`).join('')}</div>
        <p class="leise klein">Peinlich darf es für den Ehrengast werden – nie für Unbeteiligte. Fremde machen nur mit, wenn sie wollen, und wer eine Aufgabe nicht machen möchte, lässt sie aus.</p></div>` : ''}
    </section>
    <section class="schritt"><header><span class="nr">2</span><h2>Worum soll es gehen?</h2></header>
      <div class="chips">${themenListe.map((t) => { const n = zaehle(t.id); return `<button class="chip" data-thema="${t.id}" aria-pressed="${t.id === p.thema}" ${n < 2 ? 'disabled' : ''}><span class="ic">${t.icon}</span><b>${esc(t.name)}</b><small>${esc(t.kurz)} <span class="anzahl">· ${n} Orte</span></small></button>` }).join('')}</div>
    </section>
    <section class="schritt"><header><span class="nr">3</span><h2>Wie wollt ihr spielen?</h2></header>
      <div class="chips">${an.formate.map(format).map((f) => `<button class="chip" data-format="${f.id}" aria-pressed="${f.id === p.format}"><span class="ic">${f.icon}</span><b>${esc(f.id === 'punkte' && an.sterne ? 'Sterne-Rallye' : f.name)}</b><small>${esc(f.kurz)}</small></button>`).join('')}</div>
    </section>
    <section class="schritt"><header><span class="nr">4</span><h2>Wie lang?</h2></header>
      <div class="segment">${S.grund.laengen.map((l) => `<button data-laenge="${l.id}" aria-pressed="${l.id === p.laenge}"><b>${l.name}</b><small>${an.stationen[l.id]} Stationen</small></button>`).join('')}</div>
      <div class="segment" style="grid-template-columns:1fr 1fr">
        <button data-rad="0" aria-pressed="${!p.rad}"><b>Zu Fuß</b><small>Kurze Wege</small></button>
        <button data-rad="1" aria-pressed="${!!p.rad}"><b>Mit dem Fahrrad</b><small>Auch weiter entfernte Orte</small></button>
      </div>
    </section>
    <section class="schritt"><header><span class="nr">5</span><h2>Startpunkt &amp; Team</h2></header>
      <div class="karte stapel">
        <div class="segment" style="grid-template-columns:1fr 1fr">
          <button data-start="zentrum" aria-pressed="${p.start === 'zentrum'}"><b>${esc(stadt.start.name)}</b><small>Klassischer Start</small></button>
          <button data-start="ich" aria-pressed="${p.start === 'ich'}"><b>Mein Standort</b><small>Route beginnt in eurer Nähe</small></button>
        </div>
        <div class="feld"><label for="team">Teamname</label><input id="team" maxlength="40" placeholder="z. B. Die Domspatzen" value="${esc(p.team)}"></div>
        <details class="mehr"><summary>Mehrere Teams &amp; Optionen</summary>
          <div class="stapel" style="margin-top:12px">
            <div class="feld"><label for="teams">Wie viele Teams spielen dieselbe Rallye?</label>
              <select id="teams">${[1, 2, 3, 4, 5, 6].map((n) => `<option value="${n}" ${n === p.teams ? 'selected' : ''}>${n === 1 ? '1 Team' : n + ' Teams – versetzter Start'}</option>`).join('')}</select>
              <span class="leise klein">Bei mehreren Teams startet jedes an einer anderen Station, damit sich keine Schlangen bilden. Teilt dazu nach dem Erstellen den Link oder QR-Code.</span></div>
            <label class="schalter"><input type="checkbox" id="gps" ${p.gps ? 'checked' : ''}><span><b>Ankunft per GPS prüfen</b><br><span class="leise klein">Aufgaben erscheinen erst, wenn das Handy wirklich an der Station ist. Gut für Schulklassen.</span></span></label>
          </div>
        </details>
      </div>
    </section>
    <section class="schritt" id="vorschau" aria-live="polite"></section>
  </div>${fuss()}`

  app.querySelectorAll('[data-anlass]').forEach((b) => b.onclick = () => { p.anlass = b.dataset.anlass; pruefePlan(stadt); zeichnePlaner(stadt) })
  app.querySelectorAll('[data-thema]').forEach((b) => b.onclick = () => { p.thema = b.dataset.thema; zeichnePlaner(stadt) })
  app.querySelectorAll('[data-stufe]').forEach((b) => b.onclick = () => { p.stufe = Number(b.dataset.stufe); zeichnePlaner(stadt) })
  app.querySelectorAll('[data-format]').forEach((b) => b.onclick = () => { p.format = b.dataset.format; zeichnePlaner(stadt) })
  app.querySelectorAll('[data-laenge]').forEach((b) => b.onclick = () => { p.laenge = b.dataset.laenge; zeichnePlaner(stadt) })
  app.querySelectorAll('[data-rad]').forEach((b) => b.onclick = () => { p.rad = b.dataset.rad === '1'; zeichnePlaner(stadt) })
  app.querySelectorAll('[data-start]').forEach((b) => b.onclick = async () => {
    if (b.dataset.start === 'ich') {
      toast('Standort wird ermittelt …')
      const lage = await einmalOrt()
      if (!lage) { toast('Standort nicht verfügbar – wir starten im Zentrum'); p.start = 'zentrum' }
      else if (abstand(lage, stadt.zentrum) > 15000) { toast(`Ihr seid nicht in ${stadt.name} – wir starten im Zentrum`); p.start = 'zentrum' }
      else { p.start = 'ich'; p.startLage = lage }
    } else p.start = 'zentrum'
    zeichnePlaner(stadt)
  })
  $('#team').oninput = (e) => { p.team = e.target.value }
  $('#teams').onchange = (e) => { p.teams = Number(e.target.value) }
  $('#gps').onchange = (e) => { p.gps = e.target.checked }
  schreibe('stadtfuchs.plan', { anlass: p.anlass, thema: p.thema, format: p.format, laenge: p.laenge, team: p.team, stufe: p.stufe })
  zeichneVorschau(stadt)
}

function zeichneVorschau(stadt) {
  const p = S.plan, an = anlass(p.anlass), fo = format(p.format)
  const startLage = p.start === 'ich' && p.startLage ? p.startLage : stadt.start.lage
  const { orte, zusatz } = planeRoute(stadt, p, startLage)
  const cfg = { s: stadt.id, a: p.anlass, t: p.thema, f: p.format, l: p.laenge, o: orte.map((o) => o.id), z: p.seed, teams: p.teams, gps: p.gps, zusatz, st: an.frechheit ? p.stufe : undefined, rad: p.rad ? 1 : undefined }
  const probe = baueRallye(stadt, cfg)
  const etappen = orte.map((o, i) => (i ? abstand(orte[i - 1].lage, o.lage) : abstand(startLage, o.lage)))
  const weg = etappen.reduce((s, d) => s + d, 0)
  const verweil = p.thema === 'kneipen' ? 30 : 12
  const minuten = (weg * 1.25) / ((p.rad ? 13 : an.tempo) * 1000) * 60 + orte.length * verweil
  const kostenpflichtig = orte.filter((o) => o.kosten).length
  const box = $('#vorschau')
  box.innerHTML = `<header><span class="nr">6</span><h2>Eure Route</h2></header>
    <div class="kartenbox" id="karte" role="img" aria-label="Karte der Route"></div>
    <div class="kennzahlen">
      <div><span class="etikett">Stationen</span><b>${orte.length}</b></div>
      <div><span class="etikett">${p.rad ? 'Radweg' : 'Fußweg'}</span><b>${meter(weg * 1.25)}</b></div>
      <div><span class="etikett">Dauer</span><b>${dauer(minuten)}</b></div>
    </div>
    ${probe.wort ? `<p class="hinweis">Lösungswort mit ${probe.wort.length} Buchstaben${probe.wort.length < orte.length ? ` – ${orte.length - probe.wort.length} Bonusfrage(n) ohne Buchstaben` : ''}.</p>` : ''}
    ${!p.rad && weg * 1.25 > 6000 ? '<p class="hinweis">Lange Strecke: Mit dem Fahrrad macht diese Rallye mehr Spaß – oben auf „Mit dem Fahrrad“ umstellen.</p>' : ''}
    ${zusatz.length ? `<p class="hinweis">Für dieses Thema gibt es nicht genug Orte in der Nähe – ${zusatz.length} passende Station(en) aus anderen Themen wurden ergänzt.</p>` : ''}
    ${p.thema === 'kneipen' ? '<p class="hinweis">Trinkt verantwortungsvoll: Jede Getränke-Mission gilt auch alkoholfrei. Zwischendurch Wasser hilft beim Lösungswort.</p>' : ''}
    ${kostenpflichtig ? `<p class="hinweis">${kostenpflichtig} Station(en) kosten Eintritt oder sind nur zu bestimmten Zeiten offen – die Aufgaben lassen sich aber auch von außen lösen.</p>` : ''}
    <ol class="route">${orte.map((o, i) => `<li><span class="stempel">${i + 1}</span><div class="min-w0"><b>${esc(o.name)}</b>${zusatz.includes(o.id) ? ' <span class="marke-oepnv" style="color:var(--leise)">Ergänzt</span>' : ''}
      <div class="etappe">${i === 0 ? 'ab Start' : 'Etappe'} ${meter(etappen[i] * 1.25)}${!p.rad && etappen[i] > an.maxEtappe * 1.4 ? '<span class="marke-oepnv">Bus/Bahn-Tipp</span>' : ''}${o.kosten ? ` · ${esc(o.kosten)}` : ''}</div></div></li>`).join('')}</ol>
    <div class="stapel">
      <button class="knopf haupt breit" id="los">Rallye starten</button>
      <div class="zeile"><button class="knopf" id="wuerfeln">Andere Route</button><button class="knopf" id="teilen">${p.teams > 1 ? 'Link für alle Teams' : 'Link teilen'}</button><button class="knopf" id="laufzettel">Laufzettel drucken</button><button class="knopf" id="loesung">Lösungsblatt</button></div>
      <div id="teilbox" hidden></div>
    </div>`
  zeigeKarte($('#karte'), orte, { start: startLage })
  $('#wuerfeln').onclick = () => { p.seed = Math.floor(Math.random() * 1e9); zeichneVorschau(stadt); $('#vorschau').scrollIntoView({ behavior: 'smooth' }) }
  $('#los').onclick = async () => {
    if (S.rallye && !S.rallye.ende) await fotosLoeschen(S.rallye.cfg.z + ':')
    S.rallye = baueRallye(stadt, { ...cfg, team: p.team.trim(), nr: 1 })
    S.rallye.start = Date.now(); speichern(); gehe('#spiel')
  }
  $('#teilen').onclick = () => zeigeTeilen(cfg)
  $('#laufzettel').onclick = () => drucke(laufzettel(probe, stadt))
  $('#loesung').onclick = () => drucke(loesungsblatt(probe, stadt))
}

async function zeigeTeilen(cfg) {
  const box = $('#teilbox'); box.hidden = false
  const link = teilLink(cfg)
  box.innerHTML = `<div class="karte stapel"><h3>Rallye teilen</h3><p class="leise klein">Jedes Team öffnet den Link auf dem eigenen Handy und bekommt dieselben Stationen und Fragen${cfg.teams > 1 ? ' – mit versetztem Start' : ''}. Am Ende vergleicht ihr Punkte und Lösungswörter.</p>
    <div class="qr" id="qr"></div><div class="feld"><input id="teillink" readonly value="${esc(link)}"></div>
    <div class="zeile"><button class="knopf haupt" id="kopie">Link kopieren</button>${navigator.share ? '<button class="knopf" id="nativ">Teilen …</button>' : ''}</div></div>`
  $('#kopie').onclick = () => kopieren(link)
  const n = $('#nativ'); if (n) n.onclick = () => navigator.share({ title: 'Stadtfuchs-Rallye', text: 'Macht mit bei unserer Stadtrallye!', url: link }).catch(() => {})
  if (await ladeQr()) { const q = qrcode(0, 'M'); q.addData(link); q.make(); $('#qr').innerHTML = q.createSvgTag({ cellSize: 4, margin: 2, scalable: true }) }
  else $('#qr').remove()
}

// Geteilter Link: Team wählt Namen und Nummer, dann geht's los
async function zeigeEinladung(code) {
  const cfg = decodiere(code)
  if (!cfg || !S.staedte.some((s) => s.id === cfg.s)) { app.innerHTML = `${kopf()}<div class="karte stapel"><h2>Link ungültig</h2><p>Dieser Rallye-Link ist unvollständig. Bittet die Person, die ihn geschickt hat, ihn noch einmal zu kopieren.</p><a class="knopf" href="#">Zur Startseite</a></div>`; return }
  const stadt = await ladeStadt(cfg.s)
  app.innerHTML = `${kopf()}
  <section class="held"><span class="unterzeile">Einladung</span><h1>Rallye durch ${esc(stadt.name)}</h1>
    <p>${anlass(cfg.a).icon} ${esc(anlass(cfg.a).name)}${cfg.st ? ' (' + esc(S.grund.frechheit.find((f) => f.stufe === cfg.st)?.name || '') + ')' : ''} · ${esc(thema(cfg.t).name)} · ${esc(format(cfg.f).name)} · ${cfg.o.length} Stationen</p></section>
  <div class="karte stapel">
    <div class="feld"><label for="team">Euer Teamname</label><input id="team" maxlength="40" placeholder="z. B. Team Rot"></div>
    ${cfg.teams > 1 ? `<div class="feld"><label for="nr">Eure Team-Nummer</label><select id="nr">${Array.from({ length: cfg.teams }, (_, i) => `<option value="${i + 1}">Team ${i + 1}</option>`).join('')}</select><span class="leise klein">Jede Nummer startet an einer anderen Station. Sprecht euch ab, wer welche Nummer nimmt.</span></div>` : ''}
    <button class="knopf haupt breit" id="los">Rallye starten</button>
  </div>${fuss()}`
  $('#los').onclick = async () => {
    if (S.rallye && !S.rallye.ende) await fotosLoeschen(S.rallye.cfg.z + ':')
    const nr = cfg.teams > 1 ? Number($('#nr').value) : 1
    S.rallye = baueRallye(stadt, { ...cfg, team: $('#team').value.trim(), nr })
    S.rallye.start = Date.now(); speichern()
    history.replaceState(null, '', location.pathname + '#spiel'); zeichne()
  }
}

// ---------- Spiel ----------
function zeigeSpiel() {
  const r = S.rallye
  if (r.index >= r.stationen.length) return gehe('#ende')
  const st = r.stationen[r.index]
  const an = anlass(r.cfg.a), fo = format(r.cfg.f)
  const da = !!r.angekommen[r.index]
  const stand = punktestand(r)
  app.innerHTML = `
  <div class="leiste">
    <div class="oben">${kopf().replace('class="kopf"', 'class="kopf" style="padding:0"')}<span class="punkte">${fo.id === 'gefuehrt' ? '' : an.sterne ? `★ ${stand.sterne}` : fo.id === 'loesungswort' ? `${Object.values(r.antworten).filter((a) => a.buchstabe).length}/${r.wort.length} Buchst.` : `${stand.punkte} Pkt.`}</span></div>
    <div class="stempelreihe" aria-label="Fortschritt">${r.stationen.map((s, i) => `<button data-spring="${i}" aria-label="Station ${i + 1}: ${esc(s.name)}"><span class="stempel ${i === r.index ? 'jetzt' : stationFertig(r, i) ? 'fertig' : ''}">${i + 1}</span></button>`).join('')}</div>
  </div>
  <div class="stapel">
    <div class="station-kopf"><span class="stempel jetzt">${r.index + 1}</span><div><span class="etikett">Station ${r.index + 1} von ${r.stationen.length}</span><h1 style="font-size:1.7rem">${esc(st.name)}</h1></div></div>
    ${da ? '' : `
    <div class="wegweiser" id="wegweiser"><div class="pfeil" id="pfeil">${PFEIL}</div><div><b id="entf">–</b><p class="leise klein" id="wohin">Standort wird gesucht … Erlaubt den Zugriff auf euren Standort, dann zeigt der Pfeil die Richtung.</p></div></div>
    <div class="kartenbox klein" id="karte"></div>
    <div class="zeile"><a class="knopf" id="navi" target="_blank" rel="noopener" href="${navLink(st.lage, r.rad)}">Route in Karten-App</a>
      <button class="knopf haupt" id="angekommen">${r.gps ? 'Station erreicht?' : 'Wir sind da!'}</button></div>
    ${r.gps ? '<p class="leise klein" id="gpshinweis">GPS-Prüfung ist an: Die Aufgaben erscheinen, sobald ihr in der Nähe der Station seid.</p>' : ''}`}
    ${da ? stationsInhalt(r, st, an, fo) : ''}
    <div class="zeile" style="justify-content:space-between;margin-top:8px">
      <button class="knopf still klein" id="zurueck" ${r.index === 0 ? 'disabled' : ''}>← Vorige Station</button>
      <button class="knopf still klein" id="abbruch">Rallye beenden</button>
    </div>
  </div>`

  app.querySelectorAll('[data-spring]').forEach((b) => b.onclick = () => { r.index = Number(b.dataset.spring); speichern(); zeichne() })
  $('#zurueck').onclick = () => { r.index = Math.max(0, r.index - 1); speichern(); zeichne() }
  $('#abbruch').onclick = (e) => {
    if (e.target.dataset.sicher !== '1') { e.target.dataset.sicher = '1'; e.target.textContent = 'Wirklich jetzt beenden?'; return }
    r.ende = Date.now(); speichern(); gehe('#ende')
  }
  if (!da) {
    zeigeKarte($('#karte'), r.stationen.map((s, i) => ({ ...s, fertig: stationFertig(r, i) })).slice(r.index, r.index + 1), { start: r.index > 0 ? r.stationen[r.index - 1].lage : null })
    gpsStarten(); wegweiserAktualisieren()
    $('#angekommen').onclick = () => {
      if (r.gps && !nahGenug(st)) {
        if (!navigator.geolocation || S.gpsFehler) { toast('Kein GPS – Ankunft manuell bestätigt'); }
        else return toast(S.ort ? `Noch ${meter(abstand([S.ort.lat, S.ort.lng], st.lage))} bis zur Station` : 'Noch kein Standort – kurz warten')
      }
      r.angekommen[r.index] = Date.now(); speichern(); zeichne()
    }
  } else {
    gpsStoppen()
    bindeAufgaben(r, st, an, fo)
  }
}
const navLink = (lage, rad) => /iPhone|iPad|Macintosh/.test(navigator.userAgent) && 'ontouchend' in document
  ? `https://maps.apple.com/?daddr=${lage[0]},${lage[1]}&dirflg=${rad ? 'c' : 'w'}`
  : `https://www.google.com/maps/dir/?api=1&destination=${lage[0]},${lage[1]}&travelmode=${rad ? 'bicycling' : 'walking'}`
function nahGenug(st) {
  if (!S.ort) return false
  return abstand([S.ort.lat, S.ort.lng], st.lage) <= 80 + Math.min(S.ort.genau || 0, 120)
}
function wegweiserAktualisieren() {
  const r = S.rallye; if (!r || location.hash !== '#spiel') return
  const st = r.stationen[r.index], entf = $('#entf'), wohin = $('#wohin'), pfeil = $('#pfeil svg')
  if (!entf || !st) return
  if (!S.ort) return
  const ich = [S.ort.lat, S.ort.lng], d = abstand(ich, st.lage), grad = richtung(ich, st.lage)
  entf.textContent = meter(d)
  wohin.textContent = d < 60 ? 'Ihr seid da! Schaut euch um.' : `Richtung ${himmel(grad)} (${Math.round(grad)}°) · ca. ${Math.max(1, Math.round(d * 1.25 / (r.rad ? 220 : 75)))} Min. ${r.rad ? 'mit dem Rad' : 'zu Fuß'}`
  if (pfeil) pfeil.style.transform = `rotate(${grad}deg)`
  if (r.gps && nahGenug(st)) { const b = $('#angekommen'); if (b) { b.textContent = 'Wir sind da!'; } }
}

function stationFertig(r, i) {
  const st = r.stationen[i]
  if (!r.angekommen[i]) return false
  return st.aufgaben.every((_, j) => r.antworten[`${i}:${j}`])
}

function stationsInhalt(r, st, an, fo) {
  const i = r.index
  return `
  <div class="stapel">
    ${st.respekt ? '<p class="hinweis"><b>Gedenkort.</b> Bitte verhaltet euch hier ruhig und respektvoll – keine Spiele oder Selfies.</p>' : ''}
    ${st.hinweis || st.kosten ? `<p class="hinweis">${esc([st.kosten, st.hinweis].filter(Boolean).join(' · '))}</p>` : ''}
    ${'speechSynthesis' in window ? `<div class="zeile"><button class="knopf klein" id="vorlesen">${an.vorlesen ? 'Station vorlesen' : 'Vorlesen'}</button></div>` : ''}
    ${infoZuerst(fo) ? infoBlock(st) : ''}
    ${st.aufgaben.map((a, j) => aufgabeHtml(r, a, i, j, an, fo)).join('')}
    ${infoZuerst(fo) ? '' : wissenBeantwortet(r, i) ? infoBlock(st) : '<p class="hinweis">Erst raten, dann lesen: Die Geschichte zu dieser Station erscheint, sobald ihr die Frage beantwortet habt.</p>'}
    <button class="knopf haupt breit" id="naechste">${i + 1 < r.stationen.length ? 'Weiter zur nächsten Station' : 'Zum Ziel'}</button>
  </div>`
}

const infoZuerst = (fo) => fo.id === 'gefuehrt' || fo.id === 'foto'
const wissenBeantwortet = (r, i) => r.stationen[i].aufgaben.every((a, j) => !['quiz', 'schaetzen'].includes(a.typ) || r.antworten[`${i}:${j}`])
function infoBlock(st) {
  return `<div class="stapel"><span class="etikett">Über diesen Ort</span><p class="infotext">${esc(st.info)}</p>
    ${st.fakt ? `<div class="fakt"><span class="etikett">Wusstet ihr?</span><p>${esc(st.fakt)}</p></div>` : ''}
    ${st.wiki ? `<div class="zeile"><a class="knopf klein still" target="_blank" rel="noopener" href="https://de.wikipedia.org/wiki/${encodeURIComponent(st.wiki.replace(/ /g, '_'))}">Mehr auf Wikipedia</a></div>` : ''}</div>`
}

function aufgabeHtml(r, a, i, j, an, fo) {
  const key = `${i}:${j}`, ant = r.antworten[key]
  const kopfzeile = `<div class="typ"><span class="etikett">${TYPNAMEN[a.typ]}</span>${fo.id === 'loesungswort' ? (a.buchstaben ? '<span class="etikett">Buchstabe</span>' : '<span class="etikett">Bonusfrage</span>') : `<span class="etikett">${an.sterne ? '★' : a.punkte + ' Pkt.'}</span>`}</div>`
  if (a.typ === 'quiz') {
    const zeigeLoesung = ant && fo.id !== 'loesungswort'
    return `<div class="aufgabe ${ant ? 'erledigt' : ''}">${kopfzeile}<h3>${esc(a.frage)}</h3>
      <div class="optionen">${a.optionen.map((o, k) => {
        let klasse = ''
        if (zeigeLoesung) klasse = k === a.richtigIndex ? 'richtig' : (ant.wahl === k ? 'falsch' : '')
        return `<button class="option ${klasse}" data-quiz="${key}" data-k="${k}" aria-pressed="${ant?.wahl === k}" ${ant ? 'disabled' : ''}><span class="bst">${String.fromCharCode(65 + k)}</span><span>${esc(o)}</span></button>`
      }).join('')}</div>
      ${ant ? (fo.id === 'loesungswort'
        ? `<p class="ergebnis">${a.buchstaben ? `Euer Buchstabe: <span class="zahl" style="font-size:1.3rem;color:var(--fuchs-tief)">${a.buchstaben[ant.wahl]}</span>` : 'Bonusfrage beantwortet.'}</p>`
        : `<p class="ergebnis ${ant.richtig ? 'gut' : 'schlecht'}">${ant.richtig ? 'Richtig!' : 'Leider nicht – die richtige Antwort ist markiert.'}</p>`) : ''}
    </div>`
  }
  if (a.typ === 'schaetzen') {
    return `<div class="aufgabe ${ant ? 'erledigt' : ''}">${kopfzeile}<h3>${esc(a.frage)}</h3>
      ${ant ? `<p>Euer Tipp: <b class="zahl">${zahlDe(ant.wert, 2)} ${esc(a.einheit)}</b> · Richtig: <b class="zahl">${zahlDe(a.wert, 2)} ${esc(a.einheit)}</b></p><p class="ergebnis ${ant.punkte >= 5 ? 'gut' : 'schlecht'}">${ant.punkte} von 10 Punkten</p>`
        : `<div class="zeile"><input class="zahl" id="s${i}_${j}" type="number" inputmode="decimal" step="any" placeholder="Euer Tipp" aria-label="Euer Tipp" style="flex:1;min-width:0;padding:11px 12px;border-radius:10px;border:1px solid var(--linie);background:var(--flaeche);min-height:46px"><span>${esc(a.einheit || 'Jahr')}</span></div><button class="knopf haupt breit" data-schaetz="${key}">Tipp abgeben</button>`}
    </div>`
  }
  if (a.typ === 'foto') {
    return `<div class="aufgabe ${ant ? 'erledigt' : ''}">${kopfzeile}<h3>${esc(a.text)}</h3>
      <div class="fotovorschau" id="fv${i}_${j}"></div>
      <div class="zeile"><label class="knopf ${ant ? '' : 'haupt'} dateiknopf">${ant ? 'Weiteres Foto' : 'Foto aufnehmen'}<input type="file" accept="image/*" capture="environment" data-foto="${key}"></label>
      ${ant ? '<span class="ergebnis gut">Foto gespeichert ✓</span>' : `<button class="knopf still klein" data-erledigt="${key}" data-wert="0">Ohne Foto weiter</button>`}</div>
    </div>`
  }
  // mission, suchen, bewegen
  const notiz = r.notizen[key] || ''
  return `<div class="aufgabe ${ant ? 'erledigt' : ''}">${kopfzeile}<h3>${esc(a.text)}</h3>
    ${a.typ === 'mission' ? `<div class="feld"><label for="n${i}_${j}" class="leise klein">Notiz (optional – z. B. Tipp, Antwort, Name)</label><textarea id="n${i}_${j}" rows="2" data-notiz="${key}">${esc(notiz)}</textarea></div>` : ''}
    ${ant ? `<p class="ergebnis ${ant.punkte ? 'gut' : 'schlecht'}">${ant.punkte ? 'Geschafft!' : 'Ausgelassen'}</p>`
      : `<div class="zeile"><button class="knopf haupt" data-erledigt="${key}" data-wert="1">Geschafft</button><button class="knopf still" data-erledigt="${key}" data-wert="0">Auslassen</button></div>`}
  </div>`
}

function bindeAufgaben(r, st, an, fo) {
  const i = r.index
  const neu = () => { speichern(); const y = window.scrollY; zeigeSpiel(); window.scrollTo(0, y) }
  app.querySelectorAll('[data-quiz]').forEach((b) => b.onclick = () => {
    const [si, j] = b.dataset.quiz.split(':').map(Number), a = r.stationen[si].aufgaben[j], k = Number(b.dataset.k)
    const richtig = k === a.richtigIndex
    r.antworten[b.dataset.quiz] = { wahl: k, richtig, punkte: richtig ? a.punkte : 0, buchstabe: a.buchstaben ? a.buchstaben[k] : null }
    neu()
  })
  app.querySelectorAll('[data-schaetz]').forEach((b) => b.onclick = () => {
    const [si, j] = b.dataset.schaetz.split(':').map(Number), a = r.stationen[si].aufgaben[j]
    const feld = $(`#s${si}_${j}`), wert = Number(String(feld.value).replace(',', '.'))
    if (!feld.value || !Number.isFinite(wert)) return toast('Bitte eine Zahl eingeben')
    r.antworten[b.dataset.schaetz] = { wert, punkte: schaetzPunkte(a, wert) }
    neu()
  })
  app.querySelectorAll('[data-erledigt]').forEach((b) => b.onclick = () => {
    const [si, j] = b.dataset.erledigt.split(':').map(Number), a = r.stationen[si].aufgaben[j]
    r.antworten[b.dataset.erledigt] = { punkte: b.dataset.wert === '1' ? a.punkte : 0 }
    neu()
  })
  app.querySelectorAll('[data-notiz]').forEach((t) => t.oninput = () => { r.notizen[t.dataset.notiz] = t.value; speichern() })
  app.querySelectorAll('[data-foto]').forEach((inp) => inp.onchange = async () => {
    const datei = inp.files?.[0]; if (!datei) return
    const key = inp.dataset.foto
    try {
      const blob = await verkleinern(datei)
      await fotoSpeichern(`${r.cfg.z}:${key}:${Date.now()}`, blob)
      const [si, j] = key.split(':').map(Number)
      r.antworten[key] = { punkte: r.stationen[si].aufgaben[j].punkte, foto: true }
      neu()
    } catch (e) { toast(e.message || 'Foto konnte nicht gespeichert werden') }
  })
  // gespeicherte Fotos anzeigen
  st.aufgaben.forEach(async (a, j) => {
    if (a.typ !== 'foto') return
    const box = $(`#fv${i}_${j}`); if (!box) return
    const fotos = await fotosLaden(`${r.cfg.z}:${i}:${j}:`)
    box.innerHTML = fotos.map((f) => `<img alt="Foto zu Station ${i + 1}" src="${URL.createObjectURL(f.blob)}">`).join('')
  })
  const v = $('#vorlesen')
  if (v) v.onclick = () => {
    if (speechSynthesis.speaking) { speechSynthesis.cancel(); v.textContent = 'Vorlesen'; return }
    const offen = !!$('.infotext')
    const teile = [st.name, offen ? st.info : '', offen && st.fakt ? 'Wusstet ihr? ' + st.fakt : '', ...st.aufgaben.map((a) => a.typ === 'quiz' ? `${a.frage} ${a.optionen.map((o, k) => `${String.fromCharCode(65 + k)}: ${o}.`).join(' ')}` : a.frage || a.text)]
    const u = new SpeechSynthesisUtterance(teile.filter(Boolean).join('. ')); u.lang = 'de-DE'; u.rate = an.niveau === 'kita' ? 0.9 : 1
    u.onend = () => { v.textContent = 'Vorlesen' }
    speechSynthesis.speak(u); v.textContent = 'Stopp'
  }
  $('#naechste').onclick = () => {
    if ('speechSynthesis' in window) speechSynthesis.cancel()
    r.index++
    if (r.index >= r.stationen.length) { r.ende = r.ende || Date.now(); speichern(); return gehe('#ende') }
    speichern(); zeichne()
  }
}

function schaetzPunkte(a, wert) {
  const ziel = a.wert
  if (!a.einheit && ziel > 1000 && ziel < 2100) return Math.max(0, Math.round(10 - Math.abs(wert - ziel) / 4)) // Jahreszahlen
  const fehler = Math.abs(wert - ziel) / Math.max(Math.abs(ziel), 1)
  return Math.max(0, Math.round(10 * (1 - fehler / 0.5)))
}

function punktestand(r) {
  let punkte = 0, max = 0, sterne = 0, richtig = 0, quiz = 0
  r.stationen.forEach((st, i) => st.aufgaben.forEach((a, j) => {
    const ant = r.antworten[`${i}:${j}`]
    max += a.punkte
    if (a.typ === 'quiz') { quiz++; if (ant?.richtig) richtig++ }
    if (ant) { punkte += ant.punkte || 0; if (ant.punkte) sterne++ }
  }))
  return { punkte, max, sterne, richtig, quiz }
}

// ---------- Ende ----------
async function zeigeEnde() {
  gpsStoppen()
  const r = S.rallye, fo = format(r.cfg.f), an = anlass(r.cfg.a)
  if (!r.ende) { r.ende = Date.now(); speichern() }
  const stand = punktestand(r)
  const minuten = r.start ? (r.ende - r.start) / 60000 : 0
  const buchstaben = r.wort ? r.wort.split('').map((_, pos) => {
    const idx = r.stationen.findIndex((s) => s.pos === pos)
    return r.antworten[`${idx}:0`]?.buchstabe || ''
  }) : []
  const notizen = Object.entries(r.notizen).filter(([, t]) => t.trim())
  app.innerHTML = `${kopf()}
  <section class="held"><span class="unterzeile">Ziel erreicht · ${esc(r.stadtName)}</span><h1>${r.team ? esc(r.team) + ', ihr' : 'Ihr'} habt es geschafft!</h1></section>
  <div class="stapel">
    <div class="kennzahlen">
      <div><span class="etikett">${fo.id === 'loesungswort' ? 'Richtig' : an.sterne ? 'Sterne' : 'Punkte'}</span><b>${fo.id === 'loesungswort' ? `${stand.richtig}/${stand.quiz}` : an.sterne ? '★ ' + stand.sterne : `${stand.punkte}/${stand.max}`}</b></div>
      <div><span class="etikett">Stationen</span><b>${Object.keys(r.angekommen).length}/${r.stationen.length}</b></div>
      <div><span class="etikett">Zeit</span><b>${minuten ? dauer(minuten) : '–'}</b></div>
    </div>
    ${fo.id === 'loesungswort' ? `<div class="karte stapel"><h2>Das Lösungswort</h2>
      <p class="leise">Eure gesammelten Buchstaben in der richtigen Reihenfolge:</p>
      <div class="wort">${buchstaben.map((b) => `<span class="${b ? 'voll' : ''}">${b || '?'}</span>`).join('')}</div>
      ${r.geloest ? `<p class="ergebnis gut">Gelöst: ${esc(r.wort)}!</p>` : `<div class="zeile"><input id="wort" autocomplete="off" autocapitalize="characters" placeholder="Lösungswort eingeben" style="flex:1;min-width:0;padding:11px 12px;border-radius:10px;border:1px solid var(--linie);background:var(--flaeche);min-height:46px;text-transform:uppercase"><button class="knopf haupt" id="pruefe">Prüfen</button></div>
      <p class="leise klein" id="worthinweis">Ä, Ö, Ü werden als AE, OE, UE geschrieben.</p>`}
    </div>` : ''}
    <div class="karte stapel"><h2>Eure Fotos</h2><div class="fotovorschau" id="galerie"><p class="leise klein">Fotos werden geladen …</p></div><div class="zeile" id="fotoknoepfe"></div></div>
    ${notizen.length ? `<div class="karte stapel"><h2>Eure Notizen</h2>${notizen.map(([k, t]) => { const [i, j] = k.split(':').map(Number); return `<div><span class="etikett">${esc(r.stationen[i].name)}</span><p>${esc(r.stationen[i].aufgaben[j].text)}</p><p><b>${esc(t)}</b></p></div>` }).join('')}</div>` : ''}
    ${fo.id !== 'gefuehrt' && fo.id !== 'loesungswort' ? `<details class="karte mehr"><summary>Auflösung aller Fragen</summary><div class="stapel" style="margin-top:12px">${aufloesungHtml(r)}</div></details>` : ''}
    ${fo.id === 'loesungswort' && r.geloest ? `<details class="karte mehr"><summary>Auflösung aller Fragen</summary><div class="stapel" style="margin-top:12px">${aufloesungHtml(r)}</div></details>` : ''}
    <div class="zeile"><button class="knopf haupt" id="urkunde">Urkunde drucken</button><button class="knopf" id="ergebnisTeilen">Ergebnis teilen</button><a class="knopf" href="#spiel" id="zurueckSpiel">Stationen ansehen</a><a class="knopf" href="#">Neue Rallye</a></div>
  </div>${fuss()}`

  const pr = $('#pruefe')
  if (pr) pr.onclick = () => {
    const eingabe = $('#wort').value.trim().toUpperCase().replace(/Ä/g, 'AE').replace(/Ö/g, 'OE').replace(/Ü/g, 'UE').replace(/ß/g, 'SS').replace(/[^A-Z]/g, '')
    if (eingabe === r.wort) { r.geloest = true; speichern(); toast('Richtig – Lösungswort geknackt!'); zeigeEnde() }
    else {
      const falsche = buchstaben.filter((b, k) => b && b !== r.wort[k]).length
      $('#worthinweis').innerHTML = `Das ist es noch nicht. ${falsche ? `${falsche === 1 ? 'Ein Buchstabe stammt' : falsche + ' Buchstaben stammen'} aus einer falschen Antwort. Welches Wort könnte gemeint sein?` : 'Schaut euch die Buchstaben noch einmal genau an.'}`
    }
  }
  $('#zurueckSpiel').onclick = (e) => { e.preventDefault(); r.index = 0; speichern(); gehe('#spiel') }
  $('#urkunde').onclick = () => drucke(urkunde(r, stand))
  $('#ergebnisTeilen').onclick = () => {
    const text = `${r.team || 'Wir'} – Stadtfuchs-Rallye ${r.stadtName}: ${an.sterne ? stand.sterne + ' Sterne' : stand.punkte + ' von ' + stand.max + ' Punkten'}${r.geloest ? ', Lösungswort: ' + r.wort : ''}${minuten ? ', Zeit: ' + dauer(minuten) : ''}.`
    if (navigator.share) navigator.share({ title: 'Stadtfuchs', text }).catch(() => {}); else kopieren(text)
  }
  const fotos = await fotosLaden(r.cfg.z + ':')
  const gal = $('#galerie'); if (!gal) return
  if (!fotos.length) { gal.innerHTML = '<p class="leise klein">Keine Fotos gemacht.</p>'; return }
  gal.innerHTML = fotos.map((f) => `<img alt="" src="${URL.createObjectURL(f.blob)}">`).join('')
  $('#fotoknoepfe').innerHTML = '<button class="knopf haupt" id="collage">Collage erstellen</button>'
  $('#collage').onclick = () => collage(fotos, r)
}

function aufloesungHtml(r) {
  return r.stationen.map((st, i) => st.aufgaben.filter((a) => a.typ === 'quiz' || a.typ === 'schaetzen').map((a) => `<div><span class="etikett">${esc(st.name)}</span><p>${esc(a.frage)}</p><p><b>${esc(a.typ === 'quiz' ? a.optionen[a.richtigIndex] : zahlDe(a.wert, 2) + ' ' + a.einheit)}</b></p></div>`).join('')).join('')
}

async function collage(fotos, r) {
  const bilder = await Promise.all(fotos.slice(0, 16).map((f) => new Promise((ok) => { const img = new Image(); img.onload = () => ok(img); img.onerror = () => ok(null); img.src = URL.createObjectURL(f.blob) })))
  const liste = bilder.filter(Boolean)
  const spalten = liste.length <= 4 ? 2 : liste.length <= 9 ? 3 : 4
  const zeilen = Math.ceil(liste.length / spalten)
  const breite = 1080, rand = 24, kopfH = 150, zelle = (breite - rand * (spalten + 1)) / spalten
  const c = document.createElement('canvas'); c.width = breite; c.height = kopfH + zeilen * (zelle + rand) + rand + 50
  const g = c.getContext('2d')
  g.fillStyle = '#edf1ea'; g.fillRect(0, 0, c.width, c.height)
  g.fillStyle = '#e05a14'; g.fillRect(0, 0, c.width, 12)
  g.fillStyle = '#17232a'; g.font = '800 54px Archivo, Arial, sans-serif'; g.fillText(`Stadtrallye ${r.stadtName}`, rand, 84)
  g.fillStyle = '#56676d'; g.font = '30px "Atkinson Hyperlegible", Arial, sans-serif'
  g.fillText(`${r.team || 'Unser Team'} · ${new Date(r.start || Date.now()).toLocaleDateString('de-DE')}`, rand, 128)
  liste.forEach((img, k) => {
    const x = rand + (k % spalten) * (zelle + rand), y = kopfH + Math.floor(k / spalten) * (zelle + rand)
    const s = Math.min(img.width, img.height)
    g.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, x, y, zelle, zelle)
  })
  g.fillStyle = '#56676d'; g.font = '24px "Atkinson Hyperlegible", Arial, sans-serif'; g.fillText('Erstellt mit Stadtfuchs', rand, c.height - 22)
  c.toBlob(async (blob) => {
    const datei = new File([blob], `stadtfuchs-${r.stadtId}.jpg`, { type: 'image/jpeg' })
    if (navigator.canShare && navigator.canShare({ files: [datei] })) { navigator.share({ files: [datei], title: 'Unsere Stadtrallye' }).catch(() => {}); return }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = datei.name; a.click()
    toast('Collage gespeichert')
  }, 'image/jpeg', 0.9)
}

// ---------- Druck: Laufzettel, Lösungsblatt, Urkunde ----------
function drucke(html) { $('#druck').innerHTML = html; setTimeout(() => window.print(), 50) }
function laufzettel(r, stadt) {
  const fo = format(r.cfg.f)
  return `<div class="d-seite"><h1>Stadtrallye ${esc(stadt.name)}</h1><p>${esc(anlass(r.cfg.a).name)} · ${esc(thema(r.cfg.t).name)} · ${esc(fo.name)}</p><p>Team: ____________________________ &nbsp; Start: ________ &nbsp; Ziel: ________</p>
    ${r.stationen.map((st, i) => `<div class="d-station"><h3>${i + 1}. ${esc(st.name)}</h3>
      ${fo.id === 'gefuehrt' ? `<p>${esc(st.info)}</p>` : ''}
      ${st.aufgaben.map((a) => a.typ === 'quiz'
        ? `<p><b>${esc(a.frage)}</b></p><p>${a.optionen.map((o, k) => `☐ ${a.buchstaben ? `[${a.buchstaben[k]}] ` : ''}${esc(o)}`).join(' &nbsp; ')}</p>`
        : a.typ === 'schaetzen' ? `<p><b>${esc(a.frage)}</b> Euer Tipp: ________ ${esc(a.einheit)}</p>`
        : `<p><b>${TYPNAMEN[a.typ]}:</b> ${esc(a.text)}</p>${a.typ === 'mission' ? '<div class="d-linie"></div>' : ''}`).join('')}
    </div>`).join('')}
    ${r.wort ? `<p><b>Lösungswort:</b> Tragt die Buchstaben eurer Antworten in Stationsreihenfolge ein.</p><div class="d-wort">${r.wort.split('').map(() => '<span></span>').join('')}</div>` : ''}
    <p style="margin-top:10px;font-size:9pt">Erstellt mit Stadtfuchs · Angaben ohne Gewähr, Öffnungszeiten bitte vorab prüfen.</p></div>`
}
function loesungsblatt(r, stadt) {
  return `<div class="d-seite"><h1>Lösungsblatt – ${esc(stadt.name)}</h1><p>Nur für die Spielleitung.</p>
    ${r.wort ? `<h2>Lösungswort: ${esc(r.wort)}</h2>` : ''}
    ${r.stationen.map((st, i) => `<div class="d-station"><h3>${i + 1}. ${esc(st.name)}</h3>${st.aufgaben.map((a) => a.typ === 'quiz'
      ? `<p>${esc(a.frage)} → <b>${esc(a.optionen[a.richtigIndex])}</b>${a.buchstaben ? ` (Buchstabe ${a.buchstaben[a.richtigIndex]})` : ''}</p>`
      : a.typ === 'schaetzen' ? `<p>${esc(a.frage)} → <b>${zahlDe(a.wert, 2)} ${esc(a.einheit)}</b></p>` : `<p>${TYPNAMEN[a.typ]}: ${esc(a.text)}</p>`).join('')}</div>`).join('')}</div>`
}
function urkunde(r, stand) {
  const an = anlass(r.cfg.a)
  return `<div class="urkunde"><p style="letter-spacing:.2em">URKUNDE</p><h1>${esc(r.team || 'Unser Team')}</h1>
    <p style="font-size:16pt">hat die Stadtrallye durch <b>${esc(r.stadtName)}</b> erfolgreich gemeistert</p>
    <p style="font-size:14pt">${an.sterne ? `und dabei ${stand.sterne} Sterne gesammelt` : `mit ${stand.punkte} von ${stand.max} Punkten`}${r.geloest ? ` – Lösungswort „${esc(r.wort)}“ geknackt` : ''}.</p>
    <p>${new Date(r.ende || Date.now()).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
    <p style="margin-top:30px">Ernannt zum offiziellen Stadtfuchs</p></div>`
}

// ---------- Prüfmodus: Stationen vor Ort abhaken ----------
const PRUEF = 'stadtfuchs.pruefung.v1'
async function zeigePruefen(stadtId) {
  const stadt = await ladeStadt(stadtId)
  const alle = lies(PRUEF) || {}
  const st = alle[stadtId] || (alle[stadtId] = { orte: {}, vorschlag: '' })
  const sichern = () => schreibe(PRUEF, alle)
  const zaehler = () => { const w = Object.values(st.orte); return { passt: w.filter((x) => x.status === 'passt').length, falsch: w.filter((x) => x.status === 'falsch').length } }
  const loesung = (a) => a.typ === 'quiz' ? `${esc(a.frage)} → <b>${esc(a.richtig)}</b> <span class="leise">(falsch: ${a.falsch.map(esc).join(', ')})</span>`
    : a.typ === 'schaetzen' ? `${esc(a.frage)} → <b>${zahlDe(a.wert, 2)} ${esc(a.einheit)}</b>` : `${TYPNAMEN[a.typ]}: ${esc(a.text)}`
  const z = zaehler()
  app.innerHTML = `${kopf(`<a class="knopf still klein" href="#plan-${stadt.id}">Zur Rallye</a>`)}
  <section class="held"><span class="unterzeile">Prüfmodus</span><h1>${esc(stadt.name)}: alle Stationen</h1>
    <p>Geht die Stationen durch und markiert, was passt und was nicht. Eure Notizen bleiben auf diesem Gerät, bis ihr den Prüfbericht kopiert und weitergebt.</p>
    <p class="zahl leise" id="pruefstand">${z.passt} passt · ${z.falsch} korrigieren · ${stadt.orte.length - z.passt - z.falsch} offen</p></section>
  <div class="stapel">
    ${stadt.orte.map((o, i) => { const e = st.orte[o.id] || {}; return `<article class="karte stapel" id="p-${o.id}">
      <div class="station-kopf"><span class="stempel ${e.status === 'passt' ? 'fertig' : ''}">${i + 1}</span><div><span class="etikett">${o.themen.map((t) => esc(thema(t).name)).join(' · ')}${o.ab18 ? ' · ab 18' : ''}</span><h2>${esc(o.name)}</h2></div></div>
      <p>${esc(o.info)}</p>${o.fakt ? `<p class="leise"><b>Fakt:</b> ${esc(o.fakt)}</p>` : ''}${o.hinweis || o.kosten ? `<p class="hinweis">${esc([o.kosten, o.hinweis].filter(Boolean).join(' · '))}</p>` : ''}
      <ul class="klein" style="margin:0;padding-left:18px;display:grid;gap:4px">${(o.aufgaben || []).map((a) => `<li>${loesung(a)}</li>`).join('')}</ul>
      <div class="zeile"><a class="knopf klein still" target="_blank" rel="noopener" href="https://www.openstreetmap.org/?mlat=${o.lage[0]}&mlon=${o.lage[1]}#map=18/${o.lage[0]}/${o.lage[1]}">Ort auf der Karte</a></div>
      <div class="zeile"><button class="knopf klein ${e.status === 'passt' ? 'haupt' : ''}" data-pstatus="passt" data-ort="${o.id}">Passt</button><button class="knopf klein ${e.status === 'falsch' ? 'haupt' : ''}" data-pstatus="falsch" data-ort="${o.id}">Stimmt nicht</button></div>
      <div class="feld"><label for="pn-${o.id}" class="leise klein">Was stimmt nicht / Ergänzung (z. B. geschlossen, falscher Ort, bessere Frage)</label><textarea id="pn-${o.id}" rows="2" data-pnotiz="${o.id}">${esc(e.notiz || '')}</textarea></div>
    </article>` }).join('')}
    <div class="karte stapel"><h2>Fehlt etwas?</h2><div class="feld"><label for="vorschlag">Orte, Kneipen, Spielplätze oder Geheimtipps, die in die Rallye gehören</label><textarea id="vorschlag" rows="4">${esc(st.vorschlag || '')}</textarea></div></div>
    <div class="karte stapel"><h2>Prüfbericht</h2><p class="leise klein">Kopiert den Bericht und schickt ihn weiter – damit lassen sich die Stationen korrigieren.</p>
      <button class="knopf haupt" id="bericht">Prüfbericht kopieren</button></div>
  </div>${fuss()}`
  app.querySelectorAll('[data-pstatus]').forEach((b) => b.onclick = () => {
    const e = st.orte[b.dataset.ort] || (st.orte[b.dataset.ort] = {})
    e.status = e.status === b.dataset.pstatus ? '' : b.dataset.pstatus; sichern()
    const y = window.scrollY; zeigePruefen(stadtId).then(() => window.scrollTo(0, y))
  })
  app.querySelectorAll('[data-pnotiz]').forEach((t) => t.oninput = () => { (st.orte[t.dataset.pnotiz] || (st.orte[t.dataset.pnotiz] = {})).notiz = t.value; sichern() })
  $('#vorschlag').oninput = (e) => { st.vorschlag = e.target.value; sichern() }
  $('#bericht').onclick = () => {
    const zeilen = [`Prüfbericht ${stadt.name} (${new Date().toLocaleDateString('de-DE')})`, '']
    stadt.orte.forEach((o) => { const e = st.orte[o.id]; if (e && (e.status || e.notiz)) zeilen.push(`- ${o.name} [${o.id}]: ${e.status === 'passt' ? 'passt' : e.status === 'falsch' ? 'STIMMT NICHT' : 'Notiz'}${e.notiz ? ' – ' + e.notiz.trim() : ''}`) })
    if (st.vorschlag?.trim()) zeilen.push('', 'Vorschläge:', st.vorschlag.trim())
    const z = zaehler(); zeilen.push('', `${z.passt} passt, ${z.falsch} korrigieren, ${stadt.orte.length - z.passt - z.falsch} offen`)
    kopieren(zeilen.join('\n'))
  }
}

// ---------- Über ----------
function zeigeUeber() {
  app.innerHTML = `${kopf('<a class="knopf still klein" href="#">Start</a>')}
  <section class="held"><h1>Über Stadtfuchs</h1></section>
  <div class="stapel">
    <div class="karte stapel"><h2>Spielarten</h2>${S.grund.formate.map((f) => `<p><b>${f.icon} ${esc(f.name)}:</b> ${esc(f.kurz)}</p>`).join('')}</div>
    <div class="karte stapel"><h2>Datenquellen</h2><p>Die Stationen wurden aus allgemein bekannten Sehenswürdigkeiten zusammengestellt und mit Wikipedia abgeglichen. Koordinaten stammen aus Wikipedia und OpenStreetMap (© OpenStreetMap-Mitwirkende, ODbL). Kartenkacheln: OpenStreetMap.</p>
      <p>Stand der Daten: ${S.grund.stand || 'Oktober 2026'}. Lokale ändern Öffnungszeiten, Museen ihre Preise – bitte vor der Rallye prüfen.</p></div>
    <div class="karte stapel"><h2>Fotos &amp; Datenschutz</h2><p>Fotos und Spielstände bleiben ausschließlich auf eurem Gerät. Es gibt kein Konto und keine Übertragung an einen Server. Bitte fotografiert fremde Menschen nur mit deren Einverständnis.</p></div>
    <div class="karte stapel"><h2>Verantwortung</h2><p>Kneipentouren und JGA-Rallyes sind für Erwachsene. Jede Getränke-Mission gilt auch alkoholfrei. Achtet im Straßenverkehr aufeinander – keine Aufgabe ist es wert, über eine rote Ampel zu laufen.</p></div>
  </div>${fuss()}`
}

// ---------- Start ----------
async function init() {
  try {
    ;[S.grund, S.staedte] = await Promise.all([ladeJson('daten/grundlagen.json'), ladeJson('daten/staedte.json')])
  } catch {
    app.innerHTML = '<div class="karte stapel" style="margin-top:24px"><h2>Keine Verbindung</h2><p>Die Stadtdaten konnten nicht geladen werden. Prüft die Internetverbindung und ladet neu.</p><button class="knopf haupt" onclick="location.reload()">Neu laden</button></div>'
    return
  }
  S.rallye = lies(SPEICHER)
  if (S.rallye && S.rallye.v !== 1) S.rallye = null
  zeichne()
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {})
}
init()
