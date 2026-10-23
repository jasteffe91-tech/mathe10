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
const verkehr = (id) => S.grund.verkehr.find((v) => v.id === id) || S.grund.verkehr[0]
const navArt = (id) => S.grund.navigation.find((n) => n.id === id) || S.grund.navigation[0]
const tippArt = (id) => S.grund.tippArten.find((t) => t.id === id) || { id, name: id, icon: '📍', gruppe: 'essen' }
// Alter der Gruppe: bei Klassen aus der Klassenstufe, sonst Richtwert des Anlasses
const gruppenAlter = (an, klasse) => (an.klassen ? Number(klasse || an.klasseStandard) + 5 : an.alter || 18)

// Richtwerte je Klassenstufe bzw. Altersgruppe (Faustwerte aus grundlagen.json, im Planer änderbar)
function richtwert(p) {
  const an = anlass(p.anlass), rw = S.grund.richtwerte
  const schluessel = an.klassen ? String(p.klasse || an.klasseStandard) : an.richtwert
  return { schluessel, fussKm: rw.fussKm[schluessel] ?? rw.fussKm.erw, radKm: rw.radKm[schluessel] ?? null, tempo: rw.tempo[schluessel] ?? an.tempo }
}
const grenzen = (p) => { const rw = richtwert(p); return { fuss: p.maxFussKm || rw.fussKm, rad: p.maxRadKm || rw.radKm } }
// Bei „Gemischt“ wird jede Etappe einzeln entschieden: kurz zu Fuß, lang mit Bus & Bahn
const etappenModus = (vid, dM, an) => (vid === 'mix' ? (dM <= Math.max(an.maxEtappe, 1500) ? 'fuss' : 'oepnv') : vid)
function etappeMinuten(modus, dM, tempoFuss) {
  const v = verkehr(modus), kmh = modus === 'fuss' ? tempoFuss : v.tempo
  return (dM * (v.umweg || 1.25)) / (kmh * 1000) * 60 + (v.wechsel || 0)
}
// Etappen einer Route mit Verkehrsmittel, Strecke (inkl. Umweg) und Zeit; Orte ohne Lage werden übersprungen
function etappenDaten(orte, startLage, p) {
  const an = anlass(p.anlass), tempo = richtwert(p).tempo
  let vorher = startLage
  return orte.map((o) => {
    if (!o.lage || !vorher) { if (o.lage) vorher = o.lage; return { d: 0, modus: p.verkehr === 'mix' ? 'fuss' : p.verkehr, min: 0, strecke: 0, unbekannt: !o.lage } }
    const d = abstand(vorher, o.lage), modus = etappenModus(p.verkehr, d, an)
    vorher = o.lage
    return { d, modus, strecke: d * (verkehr(modus).umweg || 1.25), min: etappeMinuten(modus, d, tempo) }
  })
}

// ---------- Einkehr & Extras ----------
// Kürzester Abstand eines Punkts zu einer Wegstrecke a–b in Metern (für kurze Strecken genau genug)
function abstandZurStrecke(p, a, b) {
  const kx = Math.cos(p[0] * Math.PI / 180) * 111320, ky = 110540
  const ax = (a[1] - p[1]) * kx, ay = (a[0] - p[0]) * ky, dx = (b[1] - a[1]) * kx, dy = (b[0] - a[0]) * ky
  const l = dx * dx + dy * dy, t = l ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / l)) : 0
  return Math.hypot(ax + t * dx, ay + t * dy)
}
// Tipps nahe der Route, passend zu Anlass und Alter: höchstens 2 je Art, 6 zum Essen/Trinken, 3 Aktionen
function tippsFuerRoute(stadt, anlassId, klasse, stationen) {
  const an = anlass(anlassId), alter = gruppenAlter(an, klasse), arten = an.tipps || []
  const gruppe = an.klassen || an.id === 'team'
  const mitLage = stationen.map((s, i) => ({ s, i })).filter((x) => x.s.lage)
  const kandidaten = []
  for (const t of stadt.tipps || []) {
    if (!t.lage || !arten.includes(t.art) || (t.ab || 0) > alter || (t.bis && alter > t.bis)) continue
    let best = Infinity, nahe = 0, weg = false
    mitLage.forEach(({ s, i }, k) => {
      const d = abstand(t.lage, s.lage)
      if (d < best) { best = d; nahe = i; weg = false }
      const vor = mitLage[k - 1]?.s
      if (vor && (s.modus === 'fuss' || s.modus === 'rad')) { const w = abstandZurStrecke(t.lage, vor.lage, s.lage); if (w < best - 30) { best = w; nahe = i; weg = true } }
    })
    if (best > (stationen.some((s) => s.modus === 'rad') ? 1200 : 500)) continue
    kandidaten.push({ id: t.id, name: t.name, art: t.art, icon: t.icon, was: t.was, info: t.info, hinweis: t.hinweis, preis: t.preis, gruppe: t.gruppe, ort: t.ort,
      lage: t.lage, d: Math.round(best), nahe, weg, wert: best + arten.indexOf(t.art) * 120 - (gruppe && t.gruppe ? 250 : 0) })
  }
  kandidaten.sort((a, b) => a.wert - b.wert)
  const jeArt = {}, essen = [], aktion = []
  for (const k of kandidaten) {
    const ziel = tippArt(k.art).gruppe === 'aktion' ? aktion : essen
    if ((jeArt[k.art] || 0) >= 2 || ziel.length >= (ziel === aktion ? 3 : 6)) continue
    jeArt[k.art] = (jeArt[k.art] || 0) + 1
    delete k.wert; ziel.push(k)
  }
  return [...essen, ...aktion]
}
const preisZeichen = (n) => (n ? `<span style="white-space:nowrap">${'€'.repeat(n)}</span>` : '')
function tippHtml(t, wo = true) {
  const art = tippArt(t.art)
  const lage = wo ? `${t.weg ? 'Auf dem Weg zu' : 'Nahe'} Station ${t.nahe + 1} · ${meter(t.d)}` : t.d != null ? `${meter(t.d)} von der Station` : ''
  return `<li class="tipp"><span class="tipp-icon" aria-hidden="true">${t.icon || art.icon}</span><div class="min-w0"><b>${esc(t.name)}</b>
    <span class="leise klein">${esc(t.was || art.name)}${t.preis ? ' · ' + preisZeichen(t.preis) : ''}${t.gruppe ? ' · gut für Gruppen' : ''}${t.ort ? ' · ' + esc(t.ort) : ''}</span>
    <div class="klein">${esc(t.info)}</div>
    <div class="leise klein">${[lage, t.hinweis && esc(t.hinweis)].filter(Boolean).join(' · ')} · <a target="_blank" rel="noopener" href="${gmapsPunkt(t)}">Karte</a></div></div></li>`
}

const FUCHS = `<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="30" fill="var(--fuchs)"/><path d="M14 18 L24 30 L32 27 L40 30 L50 18 L48 36 L32 50 L16 36 Z" fill="#fff"/><path d="M16 36 L32 50 L48 36 L40 40 L32 44 L24 40 Z" fill="var(--tinte)" opacity=".18"/><circle cx="25.5" cy="35" r="2.6" fill="var(--tinte)"/><circle cx="38.5" cy="35" r="2.6" fill="var(--tinte)"/><path d="M29.5 43 h5 l-2.5 3 z" fill="var(--tinte)"/></svg>`
const PFEIL = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 L19 20 L12 16 L5 20 Z" fill="var(--fuchs)"/></svg>`
const TYPNAMEN = { quiz: 'Quizfrage', schaetzen: 'Schätzfrage', foto: 'Foto-Aufgabe', mission: 'Mission', suchen: 'Such-Aufgabe', bewegen: 'Bewegung' }

// ---------- Daten laden ----------
async function ladeJson(pfad) { const r = await fetch(pfad); if (!r.ok) throw new Error(pfad); return r.json() }
async function ladeStadt(id) {
  if (!S.stadtCache[id]) {
    const stadt = await ladeJson(`daten/staedte/${id}.json`)
    stadt.tipps = stadt.tipps || []
    // Eine Region bündelt ihre eigenen Ausflugsziele mit allen Stationen und Tipps ihrer Teilorte
    for (const teilId of stadt.teile || []) {
      const teil = await ladeStadt(teilId)
      stadt.orte.push(...teil.orte.map((o) => ({ ...o, id: `${teil.id}.${o.id}`, ort: teil.name })))
      stadt.tipps.push(...teil.tipps.map((t) => ({ ...t, id: `${teil.id}.${t.id}`, ort: teil.name })))
    }
    S.stadtCache[id] = stadt
  }
  return S.stadtCache[id]
}
// Selbst angelegte Station aus dem Baukasten (kommt mit dem Rallye-Link mit)
function eigenerOrt(e, i) {
  const aufgaben = []
  if (e.q && e.r && (e.f || []).filter(Boolean).length) aufgaben.push({ typ: 'quiz', niveau: 'erw', frage: e.q, richtig: e.r, falsch: e.f.filter(Boolean) })
  if (e.t) aufgaben.push({ typ: 'mission', text: e.t })
  return { id: 'eigen:' + i, name: e.n, ort: e.a || '', lage: e.l || null, info: e.i || '', themen: [], prio: 1, aufgaben, eigen: true }
}
function ortZuId(stadt, id, eigene) {
  if (id.startsWith('eigen:')) { const i = Number(id.slice(6)); return eigene?.[i] ? eigenerOrt(eigene[i], i) : null }
  return stadt.orte.find((o) => o.id === id) || null
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

function planeRoute(stadt, p, startLage, anzahl) {
  const an = anlass(p.anlass), fo = format(p.format), vk = verkehr(p.verkehr)
  const maxEtappe = p.verkehr === 'fuss' ? an.maxEtappe : Math.max(vk.maxEtappe || 0, an.maxEtappe)
  const g = grenzen(p), kraftGrenze = (p.verkehr === 'rad' ? g.rad : p.verkehr === 'fuss' || p.verkehr === 'mix' ? g.fuss : null)
  const motorisiert = p.verkehr === 'oepnv' || p.verkehr === 'auto'
  const rnd = zufall(p.seed)
  // In einer Region lohnen Rad, Bus & Bahn oder Auto nur für die großen Ziele: eigene Ausflugsziele plus Top-Stationen der Orte
  const regionWeit = stadt.region && p.verkehr !== 'fuss'
  const n = anzahl || an.stationen[p.laenge]
  const filtern = (minPrio) => stadt.orte.filter((o) => o.lage && ortErlaubt(o, an, fo) && (!regionWeit || !o.ort || (o.prio || 1) >= minPrio))
  let erlaubt = filtern(3)
  if (erlaubt.length < n) erlaubt = filtern(2)
  if (erlaubt.length < n) erlaubt = filtern(1)
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
        if (regionWeit && o.ort && route.filter((x) => x.ort === o.ort).length >= Math.max(2, Math.ceil(n / 3))) continue
        const w = (motorisiert ? Math.sqrt(abstand(letzter.lage, o.lage)) * 40 : abstand(letzter.lage, o.lage)) * gewicht(o) * (0.8 + 0.4 * rnd())
        if (w < bestWert) { bestWert = w; best = o }
      }
      if (!best) break
      route.push(best)
    }
    verbessere(route, startLage)
    let kosten = startLage ? abstand(startLage, route[0].lage) * 0.7 : 0
    let kraft = 0
    for (let i = 1; i < route.length; i++) {
      const d = abstand(route[i - 1].lage, route[i].lage)
      kosten += (motorisiert ? d * 0.25 + 900 : d) + Math.max(0, d - maxEtappe) * 3
      if (etappenModus(p.verkehr, d, an) === (p.verkehr === 'rad' ? 'rad' : 'fuss')) kraft += d * 1.25
    }
    if (kraftGrenze) kosten += Math.max(0, kraft - kraftGrenze * 1000) * 6
    kosten += route.filter((o) => !passend.includes(o)).length * 600
    kosten -= route.reduce((s, o) => s + (o.prio || 1), 0) * (regionWeit ? 1500 : 60)
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

  const orte = cfg.o.map((id) => ortZuId(stadt, id, cfg.e)).filter(Boolean)
  let wort = ''
  const mitQuiz = orte.filter((o) => (o.aufgaben || []).some((a) => a.typ === 'quiz'))
  if (fo.id === 'loesungswort') {
    const n = mitQuiz.length
    const woerter = [...(stadt.loesungsworte || []), ...S.grund.loesungsworte]
    const genau = woerter.filter((w) => w.length === n)
    const kuerzer = woerter.filter((w) => w.length < n).sort((a, b) => b.length - a.length)
    wort = genau.length ? waehle(genau, rnd) : (kuerzer[0] || woerter[0])
  }

  const vid = cfg.v || (cfg.rad ? 'rad' : 'fuss')
  const stationen = orte.map((o, pos) => {
    const aufgaben = []
    const eigene = (typen) => (o.aufgaben || []).filter((a) => typen.includes(a.typ))
    const bpos = mitQuiz.indexOf(o) // Position im Lösungswort, -1 = kein Buchstabe
    if (fo.id === 'loesungswort') {
      const q = nimmQuiz(o)
      if (q) aufgaben.push(quizAufbereiten(q, bpos >= 0 && bpos < wort.length ? wort[bpos] : null, rnd))
      else { const m = eigene(['mission', 'foto', 'suchen']); if (m.length) aufgaben.push({ ...m[0] }) }
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
    const vorher = pos > 0 ? orte[pos - 1].lage : null
    return {
      id: o.id, pos, bpos, name: o.name, ort: o.ort || '', lage: o.lage || null, info: o.info, fakt: o.fakt || '', hinweis: o.hinweis || '', kosten: o.kosten || '',
      respekt: !!o.respekt, wiki: o.wiki || '', zusatz: (cfg.zusatz || []).includes(o.id), aufgaben,
      modus: vorher && o.lage ? etappenModus(vid, abstand(vorher, o.lage), an) : (vid === 'mix' ? 'fuss' : vid)
    }
  })

  // Versetzter Start für mehrere Teams: Reihenfolge rotieren, Lösungswort-Positionen bleiben
  const teams = Math.max(1, cfg.teams || 1), nr = Math.min(teams, Math.max(1, cfg.nr || 1))
  const verschiebung = Math.floor(((nr - 1) * stationen.length) / teams)
  const reihenfolge = [...stationen.slice(verschiebung), ...stationen.slice(0, verschiebung)]

  return {
    v: 1, cfg, stadtId: stadt.id, stadtName: stadt.name, wort, team: cfg.team || '', stationen: reihenfolge,
    index: 0, angekommen: {}, antworten: {}, notizen: {}, start: null, ende: null, geloest: false, gps: !!cfg.gps, verkehr: vid, nav: cfg.n || 'karte',
    tipps: tippsFuerRoute(stadt, cfg.a, cfg.k, reihenfolge)
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
  punkte = punkte.filter((p) => p.lage)
  const linie = punkte.map((p) => p.lage)
  if (optionen.start) linie.unshift(optionen.start)
  if (!linie.length) { el.innerHTML = '<p class="leise klein" style="padding:12px">Keine Kartenpunkte – die Stationen werden selbst gesucht.</p>'; return }
  L.polyline(linie, { color: getComputedStyle(document.documentElement).getPropertyValue('--fuchs').trim() || '#e05a14', weight: 4, dashArray: '2 8', lineCap: 'round' }).addTo(karte)
  punkte.forEach((p, i) => {
    const icon = L.divIcon({ className: '', html: `<div class="pin ${p.fertig ? 'fertig' : ''}">${p.nr ?? i + 1}</div>`, iconSize: [28, 28], iconAnchor: [14, 14] })
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
  const roh = JSON.stringify({ s: cfg.s, a: cfg.a, t: cfg.t, f: cfg.f, l: cfg.l, o: cfg.o, z: cfg.z, teams: cfg.teams, gps: cfg.gps ? 1 : 0, zusatz: cfg.zusatz, st: cfg.st, v: cfg.v, n: cfg.n, e: cfg.e })
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
async function kopieren(text, meldung = 'Link kopiert') {
  try { await navigator.clipboard.writeText(text); toast(meldung) } catch { window.prompt('Zum Kopieren markieren:', text) }
}
function ladeHerunter(text, name, typ) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: typ })); a.download = name
  document.body.append(a); a.click(); a.remove(); toast('Datei wird gespeichert')
}

// ---------- Kartenpunkte für Google Maps, Listen und GPX ----------
const gmapsPunkt = (o) => `https://www.google.com/maps/search/?api=1&query=${o.lage[0]},${o.lage[1]}`
// Google Maps nimmt höchstens 9 Zwischenziele; Bus & Bahn erlaubt gar keine – dann eine Route je Etappe
function gmapsTeile(orte, startLage, p) {
  const punkte = [startLage, ...orte.filter((o) => o.lage).map((o) => o.lage)].filter(Boolean)
  if (punkte.length < 2) return []
  const modus = { fuss: 'walking', rad: 'bicycling', auto: 'driving', oepnv: 'transit', mix: 'transit' }[p.verkehr] || 'walking'
  const url = (teil) => `https://www.google.com/maps/dir/?api=1&origin=${teil[0].join(',')}&destination=${teil[teil.length - 1].join(',')}${teil.length > 2 ? '&waypoints=' + teil.slice(1, -1).map((x) => x.join(',')).join('%7C') : ''}&travelmode=${modus}`
  const teile = []
  const schritt = modus === 'transit' ? 1 : 9
  for (let i = 0; i < punkte.length - 1; i += schritt) teile.push(url(punkte.slice(i, i + schritt + 1)))
  return teile
}
function punkteText(orte, stadt) {
  return [`Stadtrallye ${stadt.name} – Stationen`, '', ...orte.map((o, i) => `${i + 1}. ${o.name}${o.ort ? ' (' + o.ort + ')' : ''}${o.lage ? ': ' + gmapsPunkt(o) : ' – Ort selbst suchen'}`)].join('\n')
}
function gpxText(orte, stadt) {
  const x = (t) => esc(t)
  const mit = orte.filter((o) => o.lage)
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Stadtfuchs" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>${x('Stadtrallye ' + stadt.name)}</name></metadata>
${mit.map((o, i) => `  <wpt lat="${o.lage[0]}" lon="${o.lage[1]}"><name>${x(`${i + 1}. ${o.name}`)}</name>${o.ort ? `<desc>${x(o.ort)}</desc>` : ''}</wpt>`).join('\n')}
  <rte><name>${x('Stadtrallye ' + stadt.name)}</name>
${mit.map((o, i) => `    <rtept lat="${o.lage[0]}" lon="${o.lage[1]}"><name>${x(`${i + 1}. ${o.name}`)}</name></rtept>`).join('\n')}
  </rte>
</gpx>
`
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
      ${S.staedte.length > 12 ? '<div class="feld"><label for="stadtsuche">Stadt oder Bundesland suchen</label><input id="stadtsuche" type="search" placeholder="z. B. Leipzig oder Bayern" autocomplete="off"></div>' : ''}
      <div class="staedte">${S.staedte.map((s) => `<button class="stadt" data-stadt="${s.id}" data-suche="${esc(`${s.name} ${s.land}`.toLowerCase())}"><b>${esc(s.name)}</b><span class="leise klein">${esc(s.kurz)}</span><span class="zahl">${s.orte} Stationen${s.tipps ? ` · ${s.tipps} Tipps` : ''} · ${esc(s.land)}</span>${s.region ? '<span class="marke-entwurf">Region – für Rad, Bus &amp; Bahn oder Auto</span>' : s.entwurf ? '<span class="marke-entwurf">Testphase – bitte vor Ort prüfen</span>' : ''}</button>`).join('')}</div>
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
  const suche = $('#stadtsuche')
  if (suche) suche.oninput = () => {
    const q = suche.value.trim().toLowerCase()
    app.querySelectorAll('[data-stadt]').forEach((b) => { b.hidden = !!q && !b.dataset.suche.includes(q) })
  }
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
const BAUKASTEN = (id) => 'stadtfuchs.baukasten.' + id
async function zeigePlaner(stadtId) {
  const stadt = await ladeStadt(stadtId)
  const vorher = lies('stadtfuchs.plan') || {}
  if (!S.plan || S.plan.stadt !== stadtId) {
    const bk = lies(BAUKASTEN(stadtId)) || {}
    S.plan = { stadt: stadtId, anlass: vorher.anlass || 'entdecker', thema: vorher.thema || 'highlights', format: vorher.format || 'loesungswort', laenge: vorher.laenge || 'mittel',
      start: 'zentrum', startLage: null, team: vorher.team || '', teams: 1, gps: false, stufe: vorher.stufe || 2, seed: Math.floor(Math.random() * 1e9),
      verkehr: stadt.verkehr || vorher.verkehr || 'fuss', nav: vorher.nav || 'karte', klasse: vorher.klasse || null, maxFussKm: null, maxRadKm: null,
      auswahl: bk.manuell?.length ? 'selbst' : 'auto', manuell: (bk.manuell || []).filter((id) => id.startsWith('eigen:') || stadt.orte.some((o) => o.id === id)), eigene: bk.eigene || [] }
  }
  pruefePlan(stadt)
  zeichnePlaner(stadt)
}

function pruefePlan(stadt) {
  const p = S.plan, an = anlass(p.anlass)
  if (!an.themen.includes(p.thema)) p.thema = an.themen[0]
  if (thema(p.thema).ab18 && !erwachsen(an)) p.thema = an.themen[0]
  if (!an.formate.includes(p.format)) p.format = an.formate[0]
  if (an.klassen && !an.klassen.includes(p.klasse)) p.klasse = an.klasseStandard
  if (!an.klassen) p.klasse = null
}
const sichereBaukasten = () => schreibe(BAUKASTEN(S.plan.stadt), { manuell: S.plan.manuell, eigene: S.plan.eigene })

function zeichnePlaner(stadt) {
  const p = S.plan, an = anlass(p.anlass), rw = richtwert(p), g = grenzen(p)
  const zaehle = (tid) => stadt.orte.filter((o) => (o.themen.includes(tid) || (tid === 'highlights' && o.prio >= 2)) && ortErlaubt(o, an, format(p.format))).length
  const themenListe = an.themen.map(thema).filter((t) => !t.ab18 || erwachsen(an))
  const radOhneRichtwert = p.verkehr === 'rad' && !rw.radKm
  app.innerHTML = `${kopf('<a class="knopf still klein" href="#">Städte</a>')}
  <section class="held"><span class="unterzeile">${esc(stadt.land)}</span><h1>${stadt.region ? esc(stadt.name) : 'Rallye durch ' + esc(stadt.name)}</h1><p class="leise">${esc(stadt.kurz)}</p>
    <div class="zeile"><a class="knopf klein" href="#pruefen-${stadt.id}">Alle ${stadt.orte.length} Stationen ansehen &amp; prüfen</a></div></section>
  <div class="stapel">
    <section class="schritt"><header><span class="nr">1</span><h2>Wer ist dabei?</h2></header>
      <div class="chips">${S.grund.anlaesse.map((a) => `<button class="chip" data-anlass="${a.id}" aria-pressed="${a.id === p.anlass}"><span class="ic">${a.icon}</span><b>${esc(a.name)}</b><small>${esc(a.kurz)}</small></button>`).join('')}</div>
      ${an.klassen ? `<div class="feld"><label for="klasse">Klassenstufe</label><select id="klasse">${an.klassen.map((k) => `<option value="${k}" ${k === p.klasse ? 'selected' : ''}>Klasse ${k}</option>`).join('')}</select></div>` : ''}
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
    <section class="schritt"><header><span class="nr">4</span><h2>Wie lang und wie unterwegs?</h2></header>
      <div class="segment">${S.grund.laengen.map((l) => `<button data-laenge="${l.id}" aria-pressed="${l.id === p.laenge}"><b>${l.name}</b><small>${an.stationen[l.id]} Stationen</small></button>`).join('')}</div>
      <div class="chips">${S.grund.verkehr.map((v) => `<button class="chip" data-verkehr="${v.id}" aria-pressed="${v.id === p.verkehr}"><span class="ic">${v.icon}</span><b>${esc(v.name)}</b><small>${esc(v.kurz)}</small></button>`).join('')}</div>
      <div class="karte stapel">
        <h3>Wie viel schafft die Gruppe?</h3>
        <div class="zeile">
          ${p.verkehr !== 'oepnv' && p.verkehr !== 'auto' && p.verkehr !== 'rad' ? `<div class="feld" style="flex:1;min-width:140px"><label for="maxfuss">Höchstens zu Fuß (km)</label><input id="maxfuss" type="number" inputmode="decimal" min="0.5" step="0.5" value="${g.fuss}"></div>` : ''}
          ${p.verkehr === 'rad' ? `<div class="feld" style="flex:1;min-width:140px"><label for="maxrad">Höchstens mit dem Rad (km)</label><input id="maxrad" type="number" inputmode="decimal" min="1" step="1" value="${g.rad || ''}" placeholder="kein Richtwert"></div>` : ''}
        </div>
        <p class="leise klein">${p.verkehr === 'oepnv' || p.verkehr === 'auto' ? 'Mit Bus & Bahn oder Auto gibt es keine Kraft-Grenze – achtet auf Fahrpläne, Parkplätze und Eintrittszeiten.' : `Richtwert für ${an.klassen ? 'Klasse ' + p.klasse : esc(an.name)}: ${p.verkehr === 'rad' ? (rw.radKm ? rw.radKm + ' km mit dem Rad' : 'keiner') : rw.fussKm + ' km zu Fuß'}. ${esc(S.grund.richtwerte.hinweis)}`}</p>
        ${radOhneRichtwert ? '<p class="hinweis">Radtouren im Straßenverkehr sind für diese Altersgruppe nicht empfohlen – die Radfahrausbildung findet meist in Klasse 4 statt.</p>' : ''}
      </div>
    </section>
    <section class="schritt"><header><span class="nr">5</span><h2>Wie findet ihr die Stationen?</h2></header>
      <div class="chips">${S.grund.navigation.map((n) => `<button class="chip" data-nav="${n.id}" aria-pressed="${n.id === p.nav}"><span class="ic">${n.icon}</span><b>${esc(n.name)}</b><small>${esc(n.kurz)}</small></button>`).join('')}</div>
    </section>
    <section class="schritt"><header><span class="nr">6</span><h2>Welche Stationen?</h2></header>
      <div class="segment" style="grid-template-columns:1fr 1fr">
        <button data-auswahl="auto" aria-pressed="${p.auswahl === 'auto'}"><b>Automatisch planen</b><small>Passend zu Thema und Strecke</small></button>
        <button data-auswahl="selbst" aria-pressed="${p.auswahl === 'selbst'}"><b>Selbst zusammenstellen</b><small>Auswählen, sortieren, eigene anlegen</small></button>
      </div>
      ${p.auswahl === 'selbst' ? baukastenHtml(stadt) : ''}
    </section>
    <section class="schritt"><header><span class="nr">7</span><h2>Startpunkt &amp; Team</h2></header>
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

  const neu = () => { pruefePlan(stadt); const y = window.scrollY; zeichnePlaner(stadt); window.scrollTo(0, y) }
  app.querySelectorAll('[data-anlass]').forEach((b) => b.onclick = () => { p.anlass = b.dataset.anlass; p.maxFussKm = p.maxRadKm = null; neu() })
  app.querySelectorAll('[data-thema]').forEach((b) => b.onclick = () => { p.thema = b.dataset.thema; neu() })
  app.querySelectorAll('[data-stufe]').forEach((b) => b.onclick = () => { p.stufe = Number(b.dataset.stufe); neu() })
  app.querySelectorAll('[data-format]').forEach((b) => b.onclick = () => { p.format = b.dataset.format; neu() })
  app.querySelectorAll('[data-laenge]').forEach((b) => b.onclick = () => { p.laenge = b.dataset.laenge; neu() })
  app.querySelectorAll('[data-verkehr]').forEach((b) => b.onclick = () => { p.verkehr = b.dataset.verkehr; neu() })
  app.querySelectorAll('[data-nav]').forEach((b) => b.onclick = () => { p.nav = b.dataset.nav; neu() })
  app.querySelectorAll('[data-auswahl]').forEach((b) => b.onclick = () => { p.auswahl = b.dataset.auswahl; neu() })
  const kl = $('#klasse'); if (kl) kl.onchange = (e) => { p.klasse = Number(e.target.value); p.maxFussKm = p.maxRadKm = null; neu() }
  const mf = $('#maxfuss'); if (mf) mf.onchange = (e) => { p.maxFussKm = Number(String(e.target.value).replace(',', '.')) || null; zeichneVorschau(stadt) }
  const mr = $('#maxrad'); if (mr) mr.onchange = (e) => { p.maxRadKm = Number(String(e.target.value).replace(',', '.')) || null; zeichneVorschau(stadt) }
  app.querySelectorAll('[data-start]').forEach((b) => b.onclick = async () => {
    if (b.dataset.start === 'ich') {
      toast('Standort wird ermittelt …')
      const lage = await einmalOrt()
      if (!lage) { toast('Standort nicht verfügbar – wir starten am Startpunkt'); p.start = 'zentrum' }
      else if (abstand(lage, stadt.zentrum) > (stadt.region ? 40000 : 15000)) { toast(`Ihr seid nicht in ${stadt.name} – wir starten am Startpunkt`); p.start = 'zentrum' }
      else { p.start = 'ich'; p.startLage = lage }
    } else p.start = 'zentrum'
    neu()
  })
  $('#team').oninput = (e) => { p.team = e.target.value }
  $('#teams').onchange = (e) => { p.teams = Number(e.target.value) }
  $('#gps').onchange = (e) => { p.gps = e.target.checked }
  if (p.auswahl === 'selbst') bindeBaukasten(stadt)
  schreibe('stadtfuchs.plan', { anlass: p.anlass, thema: p.thema, format: p.format, laenge: p.laenge, team: p.team, stufe: p.stufe, verkehr: p.verkehr, nav: p.nav, klasse: p.klasse })
  zeichneVorschau(stadt)
}

// ---------- Baukasten: Stationen selbst zusammenstellen ----------
function baukastenHtml(stadt) {
  const p = S.plan
  const gewaehlt = p.manuell.map((id) => ortZuId(stadt, id, p.eigene)).filter(Boolean)
  return `<div class="karte stapel" id="baukasten">
    <h3>Eure Stationen (${gewaehlt.length})</h3>
    ${gewaehlt.length ? `<ol class="route">${gewaehlt.map((o, i) => `<li><span class="stempel">${i + 1}</span><div class="min-w0 zeile" style="justify-content:space-between">
      <span class="min-w0"><b>${esc(o.name)}</b>${o.ort ? ` <span class="leise klein">· ${esc(o.ort)}</span>` : ''}${o.eigen ? ' <span class="marke-oepnv">eigene</span>' : ''}${!o.lage ? ' <span class="marke-oepnv" style="color:var(--leise)">ohne Kartenpunkt</span>' : ''}</span>
      <span class="zeile" style="gap:4px"><button class="knopf klein still" data-hoch="${i}" aria-label="Nach oben" ${i === 0 ? 'disabled' : ''}>↑</button><button class="knopf klein still" data-runter="${i}" aria-label="Nach unten" ${i === gewaehlt.length - 1 ? 'disabled' : ''}>↓</button><button class="knopf klein still" data-weg="${i}" aria-label="Entfernen">✕</button></span></div></li>`).join('')}</ol>
    <div class="zeile"><button class="knopf klein" id="optimieren">Reihenfolge optimieren</button><button class="knopf klein still" id="leeren">Alle entfernen</button></div>` : '<p class="leise">Noch keine Stationen. Fügt unten Stationen aus der Liste hinzu oder legt eigene an.</p>'}
    <details class="mehr" ${gewaehlt.length < 2 ? 'open' : ''}><summary>Stationen aus der Liste hinzufügen</summary>
      <div class="stapel" style="margin-top:10px">
        <div class="feld"><label for="bksuche">Suchen</label><input id="bksuche" placeholder="Name, Ort oder Thema"></div>
        <div id="bkliste" class="auswahlliste"></div>
      </div>
    </details>
    <details class="mehr"><summary>Eigene Station anlegen</summary>
      <div class="stapel" style="margin-top:10px">
        <div class="feld"><label for="e_n">Name der Station *</label><input id="e_n" maxlength="80" placeholder="z. B. Kiosk am Marktplatz"></div>
        <div class="feld"><label for="e_a">Adresse oder Ortsangabe</label><input id="e_a" maxlength="120" placeholder="z. B. Lippestraße 1, ${esc(stadt.name)}"></div>
        <div class="zeile"><button class="knopf klein" id="e_suchen">Adresse auf der Karte suchen</button><button class="knopf klein" id="e_hier">Meinen Standort nehmen</button><span class="leise klein" id="e_lage">Ohne Kartenpunkt</span></div>
        <div class="feld"><label for="e_i">Info zur Station</label><textarea id="e_i" rows="2" maxlength="400"></textarea></div>
        <div class="feld"><label for="e_q">Quizfrage</label><input id="e_q" maxlength="160"></div>
        <div class="zeile"><div class="feld" style="flex:1;min-width:140px"><label for="e_r">Richtige Antwort</label><input id="e_r" maxlength="80"></div>
          <div class="feld" style="flex:1;min-width:140px"><label for="e_f1">Falsche Antwort</label><input id="e_f1" maxlength="80"></div>
          <div class="feld" style="flex:1;min-width:140px"><label for="e_f2">Falsche Antwort</label><input id="e_f2" maxlength="80"></div></div>
        <div class="feld"><label for="e_t">Aufgabe oder Mission (optional)</label><input id="e_t" maxlength="200" placeholder="z. B. Macht ein Gruppenfoto vor dem Eingang"></div>
        <button class="knopf haupt" id="e_neu">Station hinzufügen</button>
      </div>
    </details>
  </div>`
}

function bindeBaukasten(stadt) {
  const p = S.plan, an = anlass(p.anlass)
  const neu = () => { sichereBaukasten(); const y = window.scrollY; zeichnePlaner(stadt); window.scrollTo(0, y) }
  app.querySelectorAll('[data-hoch]').forEach((b) => b.onclick = () => { const i = +b.dataset.hoch; [p.manuell[i - 1], p.manuell[i]] = [p.manuell[i], p.manuell[i - 1]]; neu() })
  app.querySelectorAll('[data-runter]').forEach((b) => b.onclick = () => { const i = +b.dataset.runter; [p.manuell[i + 1], p.manuell[i]] = [p.manuell[i], p.manuell[i + 1]]; neu() })
  app.querySelectorAll('[data-weg]').forEach((b) => b.onclick = () => { p.manuell.splice(+b.dataset.weg, 1); neu() })
  const opt = $('#optimieren'); if (opt) opt.onclick = () => {
    const orte = p.manuell.map((id) => ortZuId(stadt, id, p.eigene))
    const mit = orte.filter((o) => o?.lage), ohne = orte.filter((o) => o && !o.lage)
    verbessere(mit, p.start === 'ich' && p.startLage ? p.startLage : stadt.start.lage)
    p.manuell = [...mit, ...ohne].map((o) => o.id); neu(); toast('Reihenfolge optimiert')
  }
  const leer = $('#leeren'); if (leer) leer.onclick = () => { p.manuell = []; neu() }
  const liste = () => {
    const q = ($('#bksuche')?.value || '').toLowerCase()
    const treffer = stadt.orte.filter((o) => !(o.ab18 && !erwachsen(an)) && !p.manuell.includes(o.id))
      .filter((o) => !q || `${o.name} ${o.ort || ''} ${o.themen.map((t) => thema(t).name).join(' ')}`.toLowerCase().includes(q))
      .sort((a, b) => (b.prio || 1) - (a.prio || 1) || a.name.localeCompare(b.name, 'de'))
    $('#bkliste').innerHTML = treffer.map((o) => `<div class="zeile" style="justify-content:space-between;padding-block:6px;border-bottom:1px dashed var(--linie)">
      <span class="min-w0"><b>${esc(o.name)}</b><br><span class="leise klein">${esc([o.ort, o.themen.map((t) => thema(t).name).join(', ')].filter(Boolean).join(' · '))}</span></span>
      <button class="knopf klein" data-dazu="${esc(o.id)}" aria-label="${esc(o.name)} hinzufügen">+ Dazu</button></div>`).join('') || '<p class="leise klein">Keine Treffer.</p>'
    app.querySelectorAll('[data-dazu]').forEach((b) => b.onclick = () => { p.manuell.push(b.dataset.dazu); neu() })
  }
  if ($('#bkliste')) { liste(); $('#bksuche').oninput = liste }
  // Eigene Station
  let lage = null
  const zeigeLage = () => { $('#e_lage').textContent = lage ? `Kartenpunkt: ${lage[0].toFixed(5)}, ${lage[1].toFixed(5)}` : 'Ohne Kartenpunkt' }
  $('#e_suchen').onclick = async () => {
    const text = $('#e_a').value.trim() || $('#e_n').value.trim()
    if (!text) return toast('Bitte zuerst Name oder Adresse eingeben')
    try {
      const r = await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=de&q=' + encodeURIComponent(`${text}, ${stadt.region ? '' : stadt.name}`))
      const j = await r.json()
      if (!j[0]) return toast('Nichts gefunden – Adresse genauer angeben')
      lage = [Math.round(+j[0].lat * 1e5) / 1e5, Math.round(+j[0].lon * 1e5) / 1e5]; zeigeLage(); toast('Kartenpunkt gefunden')
    } catch { toast('Suche nicht erreichbar – ihr könnt die Station auch ohne Kartenpunkt anlegen') }
  }
  $('#e_hier').onclick = async () => { toast('Standort wird ermittelt …'); const l = await einmalOrt(); if (!l) return toast('Standort nicht verfügbar'); lage = l.map((x) => Math.round(x * 1e5) / 1e5); zeigeLage() }
  $('#e_neu').onclick = () => {
    const wert = (id) => $('#' + id).value.trim()
    if (!wert('e_n')) return toast('Bitte einen Namen eingeben')
    if (wert('e_q') && (!wert('e_r') || !wert('e_f1'))) return toast('Zur Quizfrage gehören eine richtige und mindestens eine falsche Antwort')
    p.eigene.push({ n: wert('e_n'), a: wert('e_a'), i: wert('e_i'), q: wert('e_q'), r: wert('e_r'), f: [wert('e_f1'), wert('e_f2')].filter(Boolean), t: wert('e_t'), l: lage })
    p.manuell.push('eigen:' + (p.eigene.length - 1)); neu(); toast('Station hinzugefügt')
  }
}

// ---------- Vorschau der Route ----------
function zeichneVorschau(stadt) {
  const p = S.plan, an = anlass(p.anlass), fo = format(p.format), vk = verkehr(p.verkehr), g = grenzen(p)
  const startLage = p.start === 'ich' && p.startLage ? p.startLage : stadt.start.lage
  const box = $('#vorschau')
  let orte, zusatz = [], gekuerzt = 0
  if (p.auswahl === 'selbst') {
    orte = p.manuell.map((id) => ortZuId(stadt, id, p.eigene)).filter(Boolean)
    if (orte.length < 1) { box.innerHTML = '<header><span class="nr">8</span><h2>Eure Route</h2></header><p class="hinweis">Wählt oben in Schritt 6 mindestens eine Station aus.</p>'; return }
  } else {
    // Passt die Route nicht zur Kraft-Grenze, werden Stationen weggelassen (mindestens drei bleiben)
    const kraftModus = p.verkehr === 'rad' ? 'rad' : 'fuss', limit = p.verkehr === 'rad' ? g.rad : (p.verkehr === 'fuss' || p.verkehr === 'mix') ? g.fuss : null
    let n = an.stationen[p.laenge]
    for (;;) {
      ({ orte, zusatz } = planeRoute(stadt, p, startLage, n))
      const kraft = etappenDaten(orte, startLage, p).filter((e) => e.modus === kraftModus).reduce((s, e) => s + e.strecke, 0)
      if (!limit || kraft <= limit * 1000 || n <= 3) break
      n--; gekuerzt++
    }
  }
  const cfg = { s: stadt.id, a: p.anlass, t: p.thema, f: p.format, l: p.laenge, o: orte.map((o) => o.id), z: p.seed, teams: p.teams, gps: p.gps, zusatz,
    st: an.frechheit ? p.stufe : undefined, v: p.verkehr, n: p.nav, e: orte.some((o) => o.eigen) ? p.eigene : undefined, k: an.klassen ? p.klasse : undefined }
  const probe = baueRallye(stadt, cfg)
  const et = etappenDaten(orte, startLage, p)
  const summe = (m) => et.filter((e) => !m || e.modus === m).reduce((s, e) => s + e.strecke, 0)
  const verweil = p.thema === 'kneipen' ? 30 : an.niveau === 'kita' ? 10 : 12
  const minuten = et.reduce((s, e) => s + e.min, 0) + orte.length * verweil
  const fussKm = summe('fuss') / 1000, radKm = summe('rad') / 1000
  const zuViel = (p.verkehr === 'rad' && g.rad && radKm > g.rad) ? `Die Radstrecke (${zahlDe(radKm, 1)} km) liegt über eurem Richtwert von ${g.rad} km.`
    : (fussKm > g.fuss && p.verkehr !== 'rad') ? `Die Strecke zu Fuß (${zahlDe(fussKm, 1)} km) liegt über eurem Richtwert von ${g.fuss} km.` : ''
  const kostenpflichtig = orte.filter((o) => o.kosten).length
  const ohneLage = orte.filter((o) => !o.lage).length
  const modusIcon = (m) => verkehr(m).icon
  box.innerHTML = `<header><span class="nr">8</span><h2>Eure Route</h2></header>
    <div class="kartenbox" id="karte" role="img" aria-label="Karte der Route"></div>
    <div class="kennzahlen">
      <div><span class="etikett">Stationen</span><b>${orte.length}</b></div>
      <div><span class="etikett">${vk.icon} Strecke</span><b>${meter(summe())}</b></div>
      <div><span class="etikett">Dauer</span><b>${dauer(minuten)}</b></div>
    </div>
    ${p.verkehr === 'mix' || p.verkehr === 'oepnv' ? `<p class="hinweis">Davon zu Fuß ca. ${zahlDe(fussKm, 1)} km${summe('oepnv') ? `, mit Bus & Bahn ca. ${zahlDe(summe('oepnv') / 1000, 1)} km` : ''}. Zeiten für Bus & Bahn sind grobe Schätzungen – Fahrplan vorher prüfen.</p>` : ''}
    ${zuViel ? `<p class="hinweis"><b>Achtung:</b> ${zuViel} Wählt weniger Stationen, ein anderes Verkehrsmittel oder passt den Richtwert in Schritt 4 an.</p>` : ''}
    ${gekuerzt ? `<p class="hinweis">Damit die Strecke zu eurem Richtwert passt, wurde die Route auf ${orte.length} Stationen gekürzt.</p>` : ''}
    ${probe.wort ? `<p class="hinweis">Lösungswort mit ${probe.wort.length} Buchstaben${probe.wort.length < orte.length ? ` – ${orte.length - probe.wort.length} Station(en) ohne Buchstaben` : ''}.</p>` : ''}
    ${zusatz.length ? `<p class="hinweis">Für dieses Thema gibt es nicht genug Orte in der Nähe – ${zusatz.length} passende Station(en) aus anderen Themen wurden ergänzt.</p>` : ''}
    ${ohneLage ? `<p class="hinweis">${ohneLage} Station(en) ohne Kartenpunkt: Dort sucht die Gruppe den Ort selbst, Entfernungen werden nicht mitgerechnet.</p>` : ''}
    ${p.thema === 'kneipen' ? '<p class="hinweis">Trinkt verantwortungsvoll: Jede Getränke-Mission gilt auch alkoholfrei. Zwischendurch Wasser hilft beim Lösungswort.</p>' : ''}
    ${kostenpflichtig ? `<p class="hinweis">${kostenpflichtig} Station(en) kosten Eintritt oder sind nur zu bestimmten Zeiten offen – die Aufgaben lassen sich aber auch von außen lösen.</p>` : ''}
    <ol class="route">${orte.map((o, i) => `<li><span class="stempel">${i + 1}</span><div class="min-w0"><b>${esc(o.name)}</b>${o.ort ? ` <span class="leise klein">· ${esc(o.ort)}</span>` : ''}${zusatz.includes(o.id) ? ' <span class="marke-oepnv" style="color:var(--leise)">Ergänzt</span>' : ''}
      <div class="etappe">${et[i].unbekannt ? 'Weg selbst finden' : `${modusIcon(et[i].modus)} ${i === 0 ? 'ab Start' : 'Etappe'} ${meter(et[i].strecke)} · ca. ${dauer(et[i].min)}${et[i].modus === 'oepnv' ? ' (Fahrplan prüfen)' : ''}`}${o.kosten ? ` · ${esc(o.kosten)}` : ''}</div></div></li>`).join('')}</ol>
    ${probe.tipps.length ? `<div class="stapel"><h3>Pausen &amp; Extras unterwegs</h3><p class="leise klein">Passend zum Anlass: Essen, Trinken und Aktionen nahe eurer Route. Öffnungszeiten und Preise bitte vorab prüfen, Aktionen vorher buchen.</p>
      <ul class="tipps">${probe.tipps.map((t) => tippHtml(t)).join('')}</ul></div>` : ''}
    <div class="stapel">
      <button class="knopf haupt breit" id="los">Rallye starten</button>
      <div class="zeile"><button class="knopf" id="wuerfeln" ${p.auswahl === 'selbst' ? 'hidden' : ''}>Andere Route</button><button class="knopf" id="teilen">${p.teams > 1 ? 'Link für alle Teams' : 'Link teilen'}</button><button class="knopf" id="laufzettel">Laufzettel drucken</button><button class="knopf" id="loesung">Lösungsblatt</button></div>
      <details class="karte mehr"><summary>Kartenpunkte für Google Maps &amp; Co.</summary>
        <div class="stapel" style="margin-top:12px">
          <p class="leise klein">Für Lehrkräfte und Gruppen, die lieber mit der eigenen Karten-App navigieren oder die Punkte auf einer eigenen Seite verteilen.</p>
          <div class="zeile">${gmapsTeile(orte, startLage, p).map((url, k, alle) => `<a class="knopf" target="_blank" rel="noopener" href="${esc(url)}">Route in Google Maps${alle.length > 1 ? ` (Teil ${k + 1})` : ''}</a>`).join('')}
            <button class="knopf" id="punkteliste">Punkteliste kopieren</button><button class="knopf" id="gpx">GPX-Datei laden</button></div>
        </div>
      </details>
      <div id="teilbox" hidden></div>
    </div>`
  zeigeKarte($('#karte'), orte.map((o, i) => ({ ...o, nr: i + 1 })), { start: startLage })
  $('#wuerfeln').onclick = () => { p.seed = Math.floor(Math.random() * 1e9); zeichneVorschau(stadt); $('#vorschau').scrollIntoView({ behavior: 'smooth' }) }
  $('#los').onclick = async () => {
    if (S.rallye && !S.rallye.ende) await fotosLoeschen(S.rallye.cfg.z + ':')
    S.rallye = baueRallye(stadt, { ...cfg, team: p.team.trim(), nr: 1 })
    S.rallye.start = Date.now(); speichern(); gehe('#spiel')
  }
  $('#teilen').onclick = () => zeigeTeilen(cfg)
  $('#laufzettel').onclick = () => drucke(laufzettel(probe, stadt))
  $('#loesung').onclick = () => drucke(loesungsblatt(probe, stadt))
  $('#punkteliste').onclick = () => kopieren(punkteText(orte, stadt), 'Punkteliste kopiert')
  $('#gpx').onclick = () => ladeHerunter(gpxText(orte, stadt), `stadtfuchs-${stadt.id}.gpx`, 'application/gpx+xml')
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
    <p>${anlass(cfg.a).icon} ${esc(anlass(cfg.a).name)}${cfg.st ? ' (' + esc(S.grund.frechheit.find((f) => f.stufe === cfg.st)?.name || '') + ')' : ''} · ${esc(thema(cfg.t).name)} · ${esc(format(cfg.f).name)} · ${cfg.o.length} Stationen · ${verkehr(cfg.v || 'fuss').icon} ${esc(verkehr(cfg.v || 'fuss').name)} · ${esc(navArt(cfg.n).name)}</p></section>
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
    ${da ? '' : unterwegsHtml(r, st)}
    ${da ? stationsInhalt(r, st, an, fo) : ''}
    ${tippsHier(r, st)}
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
    if ($('#karte')) zeigeKarte($('#karte'), [{ ...st, nr: r.index + 1 }], { start: r.index > 0 ? r.stationen[r.index - 1].lage : null })
    if ($('#wegweiser') || r.gps) { gpsStarten(); wegweiserAktualisieren() }
    const kk = $('#koordkopie'); if (kk) kk.onclick = () => kopieren(`${st.lage[0]}, ${st.lage[1]}`, 'Koordinaten kopiert')
    $('#angekommen').onclick = () => {
      if (r.gps && st.lage && !nahGenug(st)) {
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
// Tipps, die dieser Station am nächsten liegen (oder auf dem Weg dorthin)
function tippsHier(r, st) {
  const hier = (r.tipps || []).filter((t) => t.nahe === r.index)
  if (!hier.length) return ''
  return `<details class="karte mehr"><summary>☕ Pause oder Extra? ${hier.length} ${hier.length > 1 ? 'Tipps' : 'Tipp'} in der Nähe</summary>
    <ul class="tipps" style="margin-top:12px">${hier.map((t) => tippHtml({ ...t, d: st.lage ? Math.round(abstand(t.lage, st.lage)) : null }, false)).join('')}</ul></details>`
}
// Google-Maps-Link öffnet auf allen Geräten (App oder Browser) mit passendem Verkehrsmittel
const navLink = (lage, modus) => `https://www.google.com/maps/dir/?api=1&destination=${lage[0]},${lage[1]}&travelmode=${{ fuss: 'walking', rad: 'bicycling', oepnv: 'transit', auto: 'driving' }[modus] || 'walking'}`
function unterwegsHtml(r, st) {
  const art = st.lage ? (r.nav || 'karte') : 'frei', vk = verkehr(st.modus || r.verkehr || 'fuss')
  const knopf = `<button class="knopf haupt" id="angekommen">${r.gps && st.lage ? 'Station erreicht?' : 'Wir sind da!'}</button>`
  const gps = r.gps && st.lage ? '<p class="leise klein" id="gpshinweis">GPS-Prüfung ist an: Die Aufgaben erscheinen, sobald ihr in der Nähe der Station seid.</p>' : ''
  const wie = `<p class="etikett">${vk.icon} Unterwegs: ${esc(vk.name)}${st.modus === 'oepnv' ? ' – Verbindung in der Karten- oder Fahrplan-App suchen' : ''}</p>`
  if (art === 'karte') return `${wie}
    <div class="wegweiser" id="wegweiser"><div class="pfeil" id="pfeil">${PFEIL}</div><div><b id="entf">–</b><p class="leise klein" id="wohin">Standort wird gesucht … Erlaubt den Zugriff auf euren Standort, dann zeigt der Pfeil die Richtung.</p></div></div>
    <div class="kartenbox klein" id="karte"></div>
    <div class="zeile"><a class="knopf" id="navi" target="_blank" rel="noopener" href="${navLink(st.lage, st.modus)}">Route in Karten-App</a>${knopf}</div>${gps}`
  if (art === 'punkte') return `${wie}
    <div class="karte stapel"><span class="etikett">Nächstes Ziel</span><h2>${esc(st.name)}</h2>${st.ort ? `<p class="leise">${esc(st.ort)}</p>` : ''}
      <p class="zahl leise">${st.lage[0]}, ${st.lage[1]}</p>
      <div class="zeile"><a class="knopf" target="_blank" rel="noopener" href="${navLink(st.lage, st.modus)}">In Google Maps öffnen</a><button class="knopf" id="koordkopie">Koordinaten kopieren</button></div></div>
    <div class="zeile">${knopf}</div>${gps}`
  return `${wie}
    <div class="karte stapel"><span class="etikett">Findet diesen Ort</span><h2>${esc(st.name)}</h2><p>${esc(st.ort || r.stadtName)}</p>
      <p class="leise klein">Sucht den Weg selbst heraus – mit Stadtplan, Karten-App oder indem ihr Leute fragt.</p></div>
    <div class="zeile">${knopf}</div>${gps}`
}
function nahGenug(st) {
  if (!S.ort || !st.lage) return false
  return abstand([S.ort.lat, S.ort.lng], st.lage) <= 80 + Math.min(S.ort.genau || 0, 120)
}
function wegweiserAktualisieren() {
  const r = S.rallye; if (!r || location.hash !== '#spiel') return
  const st = r.stationen[r.index], entf = $('#entf'), wohin = $('#wohin'), pfeil = $('#pfeil svg')
  if (r.gps && st?.lage && nahGenug(st)) { const b = $('#angekommen'); if (b) b.textContent = 'Wir sind da!' }
  if (!entf || !st || !st.lage) return
  if (!S.ort) return
  const ich = [S.ort.lat, S.ort.lng], d = abstand(ich, st.lage), grad = richtung(ich, st.lage)
  entf.textContent = meter(d)
  const mProMin = { fuss: 75, rad: 220 }[st.modus]
  wohin.textContent = d < 60 ? 'Ihr seid da! Schaut euch um.' : `Richtung ${himmel(grad)} (${Math.round(grad)}°)${mProMin ? ` · ca. ${Math.max(1, Math.round(d * 1.25 / mProMin))} Min. ${st.modus === 'rad' ? 'mit dem Rad' : 'zu Fuß'}` : ''}`
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
  const buchstaben = r.wort ? r.wort.split('').map((_, k) => {
    const idx = r.stationen.findIndex((s) => (s.bpos ?? s.pos) === k)
    return idx >= 0 ? r.antworten[`${idx}:0`]?.buchstabe || '' : ''
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
  const nav = r.nav || 'karte'
  const wo = (st) => !st.lage || nav === 'frei' ? `<p><i>Findet den Ort selbst: ${esc(st.name)}, ${esc(st.ort || stadt.name)}</i></p>`
    : `<p><i>${verkehr(st.modus || 'fuss').icon} ${esc(verkehr(st.modus || 'fuss').name)} · Kartenpunkt: ${st.lage[0]}, ${st.lage[1]}${st.ort ? ' · ' + esc(st.ort) : ''}</i></p>`
  return `<div class="d-seite"><h1>Stadtrallye ${esc(stadt.name)}</h1><p>${esc(anlass(r.cfg.a).name)} · ${esc(thema(r.cfg.t).name)} · ${esc(fo.name)} · ${esc(verkehr(r.verkehr || 'fuss').name)} · ${esc(navArt(nav).name)}</p><p>Team: ____________________________ &nbsp; Start: ________ &nbsp; Ziel: ________</p>
    ${r.stationen.map((st, i) => `<div class="d-station"><h3>${i + 1}. ${esc(st.name)}</h3>${wo(st)}
      ${fo.id === 'gefuehrt' ? `<p>${esc(st.info)}</p>` : ''}
      ${st.aufgaben.map((a) => a.typ === 'quiz'
        ? `<p><b>${esc(a.frage)}</b></p><p>${a.optionen.map((o, k) => `☐ ${a.buchstaben ? `[${a.buchstaben[k]}] ` : ''}${esc(o)}`).join(' &nbsp; ')}</p>`
        : a.typ === 'schaetzen' ? `<p><b>${esc(a.frage)}</b> Euer Tipp: ________ ${esc(a.einheit)}</p>`
        : `<p><b>${TYPNAMEN[a.typ]}:</b> ${esc(a.text)}</p>${a.typ === 'mission' ? '<div class="d-linie"></div>' : ''}`).join('')}
    </div>`).join('')}
    ${r.tipps?.length ? `<div class="d-station"><h3>Pausen &amp; Extras unterwegs</h3>${r.tipps.map((t) => `<p>${t.icon || tippArt(t.art).icon} <b>${esc(t.name)}</b> (${esc(t.was || tippArt(t.art).name)}) – ${t.weg ? 'auf dem Weg zu' : 'nahe'} Station ${t.nahe + 1}${t.hinweis ? ' · ' + esc(t.hinweis) : ''}</p>`).join('')}</div>` : ''}
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
  const tipps = stadt.tipps || []
  const gesamt = stadt.orte.length + tipps.length
  const zaehler = () => { const w = Object.values(st.orte); return { passt: w.filter((x) => x.status === 'passt').length, falsch: w.filter((x) => x.status === 'falsch').length } }
  const loesung = (a) => a.typ === 'quiz' ? `${esc(a.frage)} → <b>${esc(a.richtig)}</b> <span class="leise">(falsch: ${a.falsch.map(esc).join(', ')})</span>`
    : a.typ === 'schaetzen' ? `${esc(a.frage)} → <b>${zahlDe(a.wert, 2)} ${esc(a.einheit)}</b>` : `${TYPNAMEN[a.typ]}: ${esc(a.text)}`
  // Gemeinsame Bausteine für Stationen und Tipps: Karte, Passt/Stimmt nicht, Notiz
  const bewertung = (key, lage) => { const e = st.orte[key] || {}; return `
      <div class="zeile"><a class="knopf klein still" target="_blank" rel="noopener" href="https://www.openstreetmap.org/?mlat=${lage[0]}&mlon=${lage[1]}#map=18/${lage[0]}/${lage[1]}">Ort auf der Karte</a></div>
      <div class="zeile"><button class="knopf klein ${e.status === 'passt' ? 'haupt' : ''}" data-pstatus="passt" data-ort="${key}">Passt</button><button class="knopf klein ${e.status === 'falsch' ? 'haupt' : ''}" data-pstatus="falsch" data-ort="${key}">Stimmt nicht</button></div>
      <div class="feld"><label for="pn-${key}" class="leise klein">Was stimmt nicht / Ergänzung (z. B. geschlossen, falscher Ort, bessere Frage)</label><textarea id="pn-${key}" rows="2" data-pnotiz="${key}">${esc(e.notiz || '')}</textarea></div>` }
  const z = zaehler()
  app.innerHTML = `${kopf(`<a class="knopf still klein" href="#plan-${stadt.id}">Zur Rallye</a>`)}
  <section class="held"><span class="unterzeile">Prüfmodus</span><h1>${esc(stadt.name)}: alle Stationen</h1>
    <p>Geht die Stationen${tipps.length ? ' und Tipps' : ''} durch und markiert, was passt und was nicht. Eure Notizen bleiben auf diesem Gerät, bis ihr den Prüfbericht kopiert und weitergebt.</p>
    <p class="zahl leise" id="pruefstand">${z.passt} passt · ${z.falsch} korrigieren · ${gesamt - z.passt - z.falsch} offen</p></section>
  <div class="stapel">
    ${stadt.orte.map((o, i) => { const e = st.orte[o.id] || {}; return `<article class="karte stapel" id="p-${o.id}">
      <div class="station-kopf"><span class="stempel ${e.status === 'passt' ? 'fertig' : ''}">${i + 1}</span><div><span class="etikett">${o.ort ? esc(o.ort) + ' · ' : ''}${o.themen.map((t) => esc(thema(t).name)).join(' · ')}${o.ab18 ? ' · ab 18' : ''}</span><h2>${esc(o.name)}</h2></div></div>
      <p>${esc(o.info)}</p>${o.fakt ? `<p class="leise"><b>Fakt:</b> ${esc(o.fakt)}</p>` : ''}${o.hinweis || o.kosten ? `<p class="hinweis">${esc([o.kosten, o.hinweis].filter(Boolean).join(' · '))}</p>` : ''}
      <ul class="klein" style="margin:0;padding-left:18px;display:grid;gap:4px">${(o.aufgaben || []).map((a) => `<li>${loesung(a)}</li>`).join('')}</ul>
      ${o.lageUngefaehr ? '<p class="hinweis"><b>Lage nur ungefähr bekannt</b> – bitte vor Ort den genauen Punkt notieren.</p>' : ''}
      <p class="leise klein">Quelle: ${esc(o.quelle || (o.wiki ? 'Wikipedia: ' + o.wiki : 'Wikipedia/OpenStreetMap'))}</p>
      ${bewertung(o.id, o.lage)}
    </article>` }).join('')}
    ${tipps.length ? `<h2 style="margin-top:12px">Einkehr &amp; Extras (${tipps.length})</h2>
      <p class="leise klein">Keine Stationen, sondern Tipps für Pausen und Aktionen, die neben passenden Routen angezeigt werden.</p>` : ''}
    ${tipps.map((t) => { const key = 'tipp:' + t.id, e = st.orte[key] || {}, art = tippArt(t.art); return `<article class="karte stapel" id="p-${key}">
      <div class="station-kopf"><span class="stempel ${e.status === 'passt' ? 'fertig' : ''}">${t.icon || art.icon}</span><div><span class="etikett">${t.ort ? esc(t.ort) + ' · ' : ''}${esc(t.was || art.name)}${t.preis ? ' · ' + preisZeichen(t.preis) : ''}${t.ab ? ` · ab ${t.ab} Jahren` : ''}${t.bis ? ` · für Kinder bis ${t.bis}` : ''}${t.gruppe ? ' · gut für Gruppen' : ''}</span><h2>${esc(t.name)}</h2></div></div>
      <p>${esc(t.info)}</p>${t.hinweis ? `<p class="hinweis">${esc(t.hinweis)}</p>` : ''}
      <p class="leise klein">Quelle: ${esc(t.quelle || 'OpenStreetMap')}</p>
      ${bewertung(key, t.lage)}
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
    const zeile = (name, key) => { const e = st.orte[key]; if (e && (e.status || e.notiz)) zeilen.push(`- ${name} [${key}]: ${e.status === 'passt' ? 'passt' : e.status === 'falsch' ? 'STIMMT NICHT' : 'Notiz'}${e.notiz ? ' – ' + e.notiz.trim() : ''}`) }
    stadt.orte.forEach((o) => zeile(o.name, o.id))
    tipps.forEach((t) => zeile('Tipp: ' + t.name, 'tipp:' + t.id))
    if (st.vorschlag?.trim()) zeilen.push('', 'Vorschläge:', st.vorschlag.trim())
    const z = zaehler(); zeilen.push('', `${z.passt} passt, ${z.falsch} korrigieren, ${gesamt - z.passt - z.falsch} offen`)
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
