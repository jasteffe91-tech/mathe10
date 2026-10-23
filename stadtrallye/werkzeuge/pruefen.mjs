// Datenpflege für Stadtfuchs: prüft Stadtdateien und ergänzt fehlende Koordinaten.
//
//   node stadtrallye/werkzeuge/pruefen.mjs                 alle Städte prüfen und Koordinaten ergänzen
//   node stadtrallye/werkzeuge/pruefen.mjs koeln berlin    nur diese Städte
//   node stadtrallye/werkzeuge/pruefen.mjs --fakten        zusätzlich Schätzwerte gegen den Wikipedia-Text prüfen
//   node stadtrallye/werkzeuge/pruefen.mjs --nur-pruefen   nichts schreiben (z. B. für CI)
//
// Koordinaten: Hat ein Ort "suche", wird OpenStreetMap (Nominatim) gefragt – das ist genauer
// für Lokale und Firmen, deren Wikipedia-Koordinate oft die Firmenzentrale ist.
// Sonst kommt die Koordinate aus dem Wikipedia-Artikel ("wiki").

import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..', 'daten')
const UA = 'Stadtfuchs-Datenpflege/1.0 (https://github.com/jasteffe91-tech/mathe10)'
const args = process.argv.slice(2)
const FAKTEN = args.includes('--fakten')
const NUR_PRUEFEN = args.includes('--nur-pruefen')
const auswahl = args.filter((a) => !a.startsWith('--'))

const THEMEN = new Set(['highlights', 'historie', 'besonderheiten', 'kulinarik', 'kneipen', 'spass', 'kinder', 'natur'])
const TYPEN = new Set(['quiz', 'schaetzen', 'foto', 'mission', 'suchen', 'bewegen'])
const TIPPARTEN = new Set(JSON.parse(readFileSync(join(WURZEL, 'grundlagen.json'), 'utf8')).tippArten.map((t) => t.id))
const warte = (ms) => new Promise((r) => setTimeout(r, ms))

async function holeJson(url) {
  for (let versuch = 0; versuch < 4; versuch++) {
    const r = await fetch(url, { headers: { 'User-Agent': UA } })
    if (r.ok) return r.json()
    await warte(1500 * (versuch + 1))
  }
  throw new Error('Abruf fehlgeschlagen: ' + url)
}

async function wikiKoordinaten(titel) {
  const ergebnis = new Map()
  for (let i = 0; i < titel.length; i += 40) {
    const teil = titel.slice(i, i + 40)
    const url = 'https://de.wikipedia.org/w/api.php?action=query&prop=coordinates&colimit=max&coprimary=primary&redirects=1&format=json&titles=' + encodeURIComponent(teil.join('|'))
    const j = await holeJson(url)
    const umleitung = new Map()
    for (const n of j.query.normalized || []) umleitung.set(n.from, n.to)
    for (const n of j.query.redirects || []) umleitung.set(n.from, n.to)
    const seiten = new Map(Object.values(j.query.pages).map((p) => [p.title, p]))
    for (const t of teil) {
      let ziel = t
      for (let k = 0; k < 3 && umleitung.has(ziel); k++) ziel = umleitung.get(ziel)
      const p = seiten.get(ziel)
      ergebnis.set(t, { existiert: !!p && !('missing' in p), titel: ziel, lage: p?.coordinates ? [p.coordinates[0].lat, p.coordinates[0].lon] : null })
    }
  }
  return ergebnis
}

async function nominatim(suche) {
  await warte(1100) // Nutzungsrichtlinie: höchstens 1 Anfrage pro Sekunde
  const j = await holeJson('https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=de&q=' + encodeURIComponent(suche))
  return j[0] ? [Number(j[0].lat), Number(j[0].lon)] : null
}

async function wikiVorschlag(text) {
  const j = await holeJson('https://de.wikipedia.org/w/api.php?action=query&list=search&srlimit=3&format=json&srsearch=' + encodeURIComponent(text))
  return (j.query?.search || []).map((t) => `"${t.title}"`).join(', ') || '–'
}

async function wikiText(titel) {
  const j = await holeJson('https://de.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&redirects=1&format=json&titles=' + encodeURIComponent(titel))
  return Object.values(j.query.pages)[0]?.extract || ''
}

function abstandM(a, b) {
  const r = Math.PI / 180, R = 6371000
  const dLat = (b[0] - a[0]) * r, dLng = (b[1] - a[1]) * r
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

// Kompakte, gut lesbare JSON-Ausgabe: kleine Objekte und Aufgaben in einer Zeile.
function formatiere(wert, einzug = '', schluessel = '') {
  const kurz = JSON.stringify(wert, null, 1).replace(/\n\s*/g, ' ').replace(/\[ /g, '[').replace(/ \]/g, ']')
  const istBlatt = (v) => v === null || typeof v !== 'object'
  if (istBlatt(wert)) return JSON.stringify(wert)
  if (Array.isArray(wert) && wert.every(istBlatt) && kurz.length < 140) return kurz
  if (!Array.isArray(wert) && (schluessel === 'aufgabe' || kurz.length < 100)) return kurz
  const innen = einzug + '  '
  if (Array.isArray(wert)) {
    const kind = schluessel === 'aufgaben' ? 'aufgabe' : ''
    return '[\n' + wert.map((v) => innen + formatiere(v, innen, kind)).join(',\n') + '\n' + einzug + ']'
  }
  return '{\n' + Object.entries(wert).filter(([, v]) => v !== undefined).map(([k, v]) => innen + JSON.stringify(k) + ': ' + formatiere(v, innen, k)).join(',\n') + '\n' + einzug + '}'
}

function pruefeStruktur(stadt, fehler) {
  const ids = new Set()
  for (const o of stadt.orte) {
    const wo = `${stadt.id}/${o.id}`
    if (ids.has(o.id)) fehler.push(`${wo}: doppelte id`)
    ids.add(o.id)
    if (!o.name || !o.info) fehler.push(`${wo}: name oder info fehlt`)
    if (!o.wiki && !o.suche && !o.lage) fehler.push(`${wo}: weder wiki, suche noch lage`)
    if (!o.themen?.length) fehler.push(`${wo}: keine themen`)
    for (const t of o.themen || []) if (!THEMEN.has(t)) fehler.push(`${wo}: unbekanntes Thema ${t}`)
    for (const a of o.aufgaben || []) {
      if (!TYPEN.has(a.typ)) fehler.push(`${wo}: unbekannter Aufgabentyp ${a.typ}`)
      if (a.typ === 'quiz') {
        if (!a.frage || !a.richtig || !Array.isArray(a.falsch) || a.falsch.length < 2) fehler.push(`${wo}: Quiz unvollständig`)
        if (!['kind', 'erw'].includes(a.niveau)) fehler.push(`${wo}: Quiz ohne niveau kind/erw`)
        if (a.falsch?.includes(a.richtig)) fehler.push(`${wo}: richtige Antwort steht auch bei falsch`)
      }
      if (a.typ === 'schaetzen' && (typeof a.wert !== 'number' || !a.frage)) fehler.push(`${wo}: Schätzfrage unvollständig`)
      if (['foto', 'mission', 'suchen', 'bewegen'].includes(a.typ) && !a.text) fehler.push(`${wo}: ${a.typ} ohne text`)
    }
    if (o.themen?.includes('kneipen') && !(o.aufgaben || []).some((a) => a.typ === 'quiz')) fehler.push(`${wo}: Kneipe ohne Quiz`)
  }
  for (const w of stadt.loesungsworte || []) if (!/^[A-Z]+$/.test(w)) fehler.push(`${stadt.id}: Lösungswort ${w} nur A–Z (Ä als AE)`)
  // Tipps für Einkehr & Extras: keine Station, aber Lage, Art und ein Satz Info
  const tippIds = new Set()
  for (const t of stadt.tipps || []) {
    const wo = `${stadt.id}/tipp:${t.id}`
    if (tippIds.has(t.id)) fehler.push(`${wo}: doppelte id`)
    tippIds.add(t.id)
    if (!t.name || !t.info) fehler.push(`${wo}: name oder info fehlt`)
    if (!TIPPARTEN.has(t.art)) fehler.push(`${wo}: unbekannte Art ${t.art}`)
    if (!t.wiki && !t.suche && !t.lage) fehler.push(`${wo}: weder wiki, suche noch lage`)
    if (t.ab !== undefined && typeof t.ab !== 'number') fehler.push(`${wo}: ab muss eine Zahl sein`)
    if (t.bis !== undefined && (typeof t.bis !== 'number' || t.bis < (t.ab || 0))) fehler.push(`${wo}: bis muss eine Zahl ≥ ab sein`)
    if (t.preis !== undefined && ![1, 2, 3].includes(t.preis)) fehler.push(`${wo}: preis 1–3`)
    if (t.art === 'bar' && !(t.ab >= 16)) fehler.push(`${wo}: Bar ohne Altersangabe (ab 16/18)`)
  }
}

async function bearbeiteStadt(datei) {
  const pfad = join(WURZEL, 'staedte', datei)
  const stadt = JSON.parse(readFileSync(pfad, 'utf8'))
  const fehler = [], hinweise = []
  pruefeStruktur(stadt, fehler)

  const ziele = [stadt.start, ...stadt.orte, ...(stadt.tipps || []).map((t) => Object.assign(t, { _tipp: true }))]
  const wikiTitel = [...new Set(ziele.filter((o) => o.wiki).map((o) => o.wiki))]
  const wiki = await wikiKoordinaten(wikiTitel)
  for (const o of ziele) {
    const w = o.wiki && wiki.get(o.wiki)
    const name = `${stadt.id}/${o._tipp ? 'tipp:' : ''}${o.id || 'start'}`
    if (o.wiki && !w.existiert) fehler.push(`${name}: Wikipedia-Artikel "${o.wiki}" existiert nicht – Vorschlag: ${await wikiVorschlag(o.wiki + ' ' + stadt.name)}`)
    if (o.lage) continue
    let lage = null, quelle = ''
    if (o.suche) { lage = await nominatim(o.suche); quelle = 'OSM' }
    if (!lage && w?.lage) { lage = w.lage; quelle = 'Wikipedia' }
    if (!lage && o.name) { lage = await nominatim(`${o.name}, ${stadt.name}`); quelle = 'OSM (Name)' }
    if (!lage) { fehler.push(`${name}: keine Koordinate gefunden`); continue }
    o.lage = lage.map((x) => Math.round(x * 1e5) / 1e5)
    hinweise.push(`${name}: Koordinate aus ${quelle}`)
  }

  // Ausreißer: Orte, die weit vom Median aller Orte liegen (Regionen umfassen ihre Teilorte)
  const teile = (stadt.teile || []).map((t) => JSON.parse(readFileSync(join(WURZEL, 'staedte', t + '.json'), 'utf8')))
  stadt._alle = [...stadt.orte, ...teile.flatMap((t) => t.orte)]
  stadt._tipps = [...(stadt.tipps || []), ...teile.flatMap((t) => t.tipps || [])]
  const mit = stadt._alle.filter((o) => o.lage)
  const median = (i) => mit.map((o) => o.lage[i]).sort((a, b) => a - b)[Math.floor(mit.length / 2)]
  const mitte = [median(0), median(1)]
  for (const o of [...mit, ...stadt._tipps.filter((t) => t.lage)]) {
    const d = abstandM(mitte, o.lage)
    if (d > (stadt.region ? 40000 : 12000)) fehler.push(`${stadt.id}/${o._tipp ? 'tipp:' : ''}${o.id}: liegt ${(d / 1000).toFixed(1)} km vom Zentrum – Koordinate prüfen`)
  }
  stadt.zentrum = mitte.map((x) => Math.round(x * 1e5) / 1e5)

  if (FAKTEN) {
    for (const o of stadt.orte.filter((o) => o.wiki)) {
      const schaetz = (o.aufgaben || []).filter((a) => a.typ === 'schaetzen')
      if (!schaetz.length) continue
      const text = (await wikiText(o.wiki)).replace(/\./g, '').replace(/ /g, ' ')
      for (const a of schaetz) {
        const zahl = String(a.wert)
        if (!text.includes(zahl) && !text.includes(zahl.replace('.', ','))) hinweise.push(`FAKT? ${stadt.id}/${o.id}: ${a.wert} ${a.einheit} nicht im Artikel "${o.wiki}" gefunden`)
      }
    }
  }

  for (const t of stadt.tipps || []) delete t._tipp
  if (!NUR_PRUEFEN) { const { _alle, _tipps, ...ohne } = stadt; writeFileSync(pfad, formatiere(ohne) + '\n') }
  return { stadt, fehler, hinweise }
}

const dateien = readdirSync(join(WURZEL, 'staedte')).filter((d) => d.endsWith('.json')).filter((d) => !auswahl.length || auswahl.includes(d.replace('.json', '')))
let fehlerGesamt = 0
const index = []
for (const d of dateien) {
  const { stadt, fehler, hinweise } = await bearbeiteStadt(d)
  console.log(`\n== ${stadt.name}: ${stadt.orte.length} Orte, ${stadt.orte.reduce((s, o) => s + (o.aufgaben || []).length, 0)} Aufgaben, ${(stadt.tipps || []).length} Tipps`)
  hinweise.forEach((h) => console.log('  · ' + h))
  fehler.forEach((f) => console.log('  ✗ ' + f))
  fehlerGesamt += fehler.length
  index.push(stadt)
}

// Städteverzeichnis neu schreiben, wenn alle Städte bearbeitet wurden
if (!auswahl.length && !NUR_PRUEFEN) {
  const verzeichnis = index.sort((a, b) => a.name.localeCompare(b.name, 'de')).map((s) => ({
    id: s.id, name: s.name, land: s.land, kurz: s.kurz, orte: s._alle.length, tipps: s._tipps.length || undefined, zentrum: s.zentrum, entwurf: s.entwurf || undefined, region: s.region || undefined,
    themen: [...THEMEN].filter((t) => s._alle.filter((o) => o.themen.includes(t)).length >= 3)
  }))
  writeFileSync(join(WURZEL, 'staedte.json'), formatiere(verzeichnis) + '\n')
  console.log(`\nstaedte.json mit ${verzeichnis.length} Städten geschrieben.`)
}
console.log(fehlerGesamt ? `\n${fehlerGesamt} Fehler.` : '\nAlles in Ordnung.')
process.exit(fehlerGesamt ? 1 : 0)
