// Kandidaten für neue Stationen finden – aus offenen, frei nutzbaren Daten.
//
//   node stadtrallye/werkzeuge/kandidaten.mjs dorsten          Umkreis 6 km um das Stadtzentrum
//   node stadtrallye/werkzeuge/kandidaten.mjs koeln 3          eigener Radius in km
//   node stadtrallye/werkzeuge/kandidaten.mjs koeln 3 --md     Ausgabe als Markdown-Tabelle
//
// Quellen:
//   Wikidata (CC0)          – Orte mit Koordinate im Umkreis; „Bekanntheit“ = Anzahl der Wikipedia-
//                             Sprachversionen. Eine gute, neutrale Annäherung an „Top-Sehenswürdigkeit“.
//   Wikivoyage (CC BY-SA)   – Einträge (vCards) aus den Abschnitten Sehenswürdigkeiten, Aktivitäten,
//                             Küche, Nachtleben. Nur Name, Art und Lage übernehmen, Texte selbst schreiben.
// Bereits vorhandene Stationen und Tipps (gleicher Wikipedia-Titel, gleicher Name oder < 60 m entfernt) werden markiert.

import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..', 'daten')
const UA = 'Stadtfuchs-Datenpflege/1.0 (https://github.com/jasteffe91-tech/mathe10)'
const [stadtId, radiusArg] = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const MARKDOWN = process.argv.includes('--md')
if (!stadtId) { console.log('Aufruf: node kandidaten.mjs <stadt-id> [radius-km] [--md]'); process.exit(1) }
const stadt = JSON.parse(readFileSync(join(WURZEL, 'staedte', stadtId + '.json'), 'utf8'))
const radius = Number(radiusArg) || 6
const warte = (ms) => new Promise((r) => setTimeout(r, ms))

async function holeJson(url, accept = 'application/json') {
  for (let versuch = 0; versuch < 3; versuch++) {
    const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: accept } })
    if (r.ok) return r.json()
    await warte(3000 * (versuch + 1)) // Wikimedia drosselt bei vielen Anfragen
  }
  throw new Error('Abruf fehlgeschlagen: ' + url.slice(0, 120))
}

function abstandM(a, b) {
  const r = Math.PI / 180
  const h = Math.sin((b[0] - a[0]) * r / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin((b[1] - a[1]) * r / 2) ** 2
  return 2 * 6371000 * Math.asin(Math.sqrt(h))
}

// Ortschaften, Ortsteile, Bahnhöfe, Haltestellen, Fahrgeschäfte, Firmen, Wahlkreise, Schulen und Straßen ausblenden
// (nur direkte Klassen – Unterklassen-Abfragen sind für den öffentlichen Wikidata-Dienst zu langsam)
const AUSSCHLUSS = ['Q486972', 'Q262166', 'Q253019', 'Q1402592', 'Q3957', 'Q532', 'Q55488', 'Q55678', 'Q1793804', 'Q18543139', 'Q1144661', 'Q204832', 'Q2389789',
  'Q4830453', 'Q6881511', 'Q891723', 'Q192611', 'Q3914', 'Q9842', 'Q159334', 'Q79007', 'Q34442', 'Q15079663', 'Q10864048', 'Q17343829', 'Q15284', 'Q21672098']

async function wikidata() {
  const [lat, lon] = stadt.zentrum
  const minus = `FILTER NOT EXISTS { ?item wdt:P31 ?aus . VALUES ?aus { ${AUSSCHLUSS.map((q) => 'wd:' + q).join(' ')} } }`
  const q = `SELECT ?item ?itemLabel ?typLabel ?links ?coord ?artikel WHERE {
  SERVICE wikibase:around { ?item wdt:P625 ?coord . bd:serviceParam wikibase:center "Point(${lon} ${lat})"^^geo:wktLiteral . bd:serviceParam wikibase:radius "${radius}" . }
  ?item wikibase:sitelinks ?links . FILTER(?links >= 1)
  OPTIONAL { ?item wdt:P31 ?typ . }
  OPTIONAL { ?artikel schema:about ?item ; schema:isPartOf <https://de.wikipedia.org/> . }
  ${minus}
  SERVICE wikibase:label { bd:serviceParam wikibase:language "de,en". }
} ORDER BY DESC(?links) LIMIT 400`
  const j = await holeJson('https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(q), 'application/sparql-results+json')
  const nachItem = new Map()
  for (const b of j.results.bindings) {
    const id = b.item.value.split('/').pop()
    const m = b.coord.value.match(/Point\(([-\d.]+) ([-\d.]+)\)/)
    const e = nachItem.get(id) || { quelle: 'Wikidata', id, name: b.itemLabel.value, typen: new Set(), bekanntheit: Number(b.links.value), lage: m ? [Number(m[2]), Number(m[1])] : null, wiki: b.artikel ? decodeURIComponent(b.artikel.value.split('/wiki/')[1]).replace(/_/g, ' ') : '' }
    if (b.typLabel) e.typen.add(b.typLabel.value)
    nachItem.set(id, e)
  }
  const unpassend = /Gymnasium|Schule|Verein|Wahlkreis|Bank|Stiftung|Wohnviertel|Wohnsiedlung|Gemeinde|Stadt in|Achterbahn|Fahrgeschäft|Wildwasserbahn|Rapid River|Themenfahrt|FFH-Gebiet|Unternehmen|Kraftwerk/
  return [...nachItem.values()].filter((e) => e.lage && !/^Q\d+$/.test(e.name) && ![...e.typen].some((t) => unpassend.test(t)))
}

async function wikivoyage() {
  const titel = (stadt.wikivoyage || stadt.name).replace(/ /g, '_')
  let j
  try { j = await holeJson(`https://de.wikivoyage.org/w/api.php?action=parse&page=${encodeURIComponent(titel)}&prop=wikitext&format=json&formatversion=2`) } catch { return [] }
  if (!j.parse) return []
  const text = j.parse.wikitext
  const erg = []
  let abschnitt = ''
  for (const zeile of text.split('\n')) {
    const h = zeile.match(/^==+\s*([^=]+?)\s*==+/)
    if (h) { abschnitt = h[1]; continue }
  }
  // vCards mit Abschnitt zuordnen
  const teile = text.split(/^(==+[^=\n]+==+)\s*$/m)
  for (let i = 0; i < teile.length; i++) {
    const h = teile[i].match(/^==+\s*([^=]+?)\s*==+$/)
    if (h) { abschnitt = h[1]; continue }
    for (const karte of teile[i].matchAll(/\{\{vCard([\s\S]*?)\n?\}\}/g)) {
      const feld = (n) => (karte[1].match(new RegExp(`\\|\\s*${n}\\s*=\\s*([^|\\n]*)`)) || [])[1]?.trim() || ''
      const lat = Number(feld('lat')), lon = Number(feld('long'))
      erg.push({ quelle: 'Wikivoyage', name: feld('name').replace(/\[\[|\]\]/g, ''), typen: new Set([feld('type') || abschnitt]), abschnitt, lage: lat && lon ? [lat, lon] : null, wiki: '', bekanntheit: 0 })
    }
  }
  return erg.filter((e) => e.name)
}

const vorhanden = (k) => [...stadt.orte, ...(stadt.tipps || [])].find((o) => (k.wiki && o.wiki === k.wiki) || (k.lage && o.lage && abstandM(k.lage, o.lage) < 60) || o.name.toLowerCase() === k.name.toLowerCase())

const [wd, wv] = await Promise.all([wikidata().catch((e) => { console.error('Wikidata:', e.message); return [] }), wikivoyage()])
const alle = [...wd, ...wv].map((k) => ({ ...k, abstand: k.lage ? abstandM(stadt.zentrum, k.lage) : null, schon: vorhanden(k) }))
alle.sort((a, b) => (a.quelle === b.quelle ? b.bekanntheit - a.bekanntheit : a.quelle.localeCompare(b.quelle)))

const zeile = (k) => [k.quelle, k.bekanntheit || '', k.name, [...k.typen].slice(0, 2).join(', '), k.abstand == null ? '?' : (k.abstand / 1000).toFixed(1) + ' km', k.schon ? `✓ ${k.schon.id}` : 'NEU']
if (MARKDOWN) {
  console.log(`| Quelle | Bekanntheit | Name | Art | Abstand | Status |\n|---|---|---|---|---|---|`)
  for (const k of alle) console.log('| ' + zeile(k).join(' | ') + ' |')
} else {
  console.log(`${stadt.name}: ${wd.length} Wikidata-Orte, ${wv.length} Wikivoyage-Einträge im Umkreis von ${radius} km`)
  for (const k of alle) console.log(zeile(k).join('  ·  '))
}
const neu = alle.filter((k) => !k.schon)
console.log(`\n${neu.length} neue Kandidaten, ${alle.length - neu.length} schon als Station vorhanden.`)
