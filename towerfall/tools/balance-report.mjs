// Balance-Bericht: spielt alle Strategien auf den gewählten Karten/Schwierigkeiten mit festen Seeds durch
// und gibt eine Markdown-Tabelle aus. Aufruf:
//   node tools/balance-report.mjs [karten=gruenental,felsenpass] [schwierigkeit=normal] [modus=normal] [seeds=1,2]
import { runStrategy, STRATEGIES } from '../tests/helpers/strategies.js'

const [maps = 'gruenental,felsenpass,sumpfgabel', diffs = 'normal', mode = 'normal', seeds = '1,2'] = process.argv.slice(2)
const pct = (x) => `${Math.round(x * 100)} %`
const rows = []
for (const mapId of maps.split(',')) {
  for (const difficulty of diffs.split(',')) {
    for (const strategy of Object.keys(STRATEGIES)) {
      const runs = seeds.split(',').map(Number).map((seed) => runStrategy({ strategy, mapId, difficulty, mode, seed }))
      rows.push({ mapId, difficulty, strategy, runs })
    }
  }
}

console.log(`| Karte | Stufe | Strategie | Ergebnis | Leben verloren | durchgelassen | verbaut | Ø Wellendauer | stärkster Turmtyp |`)
console.log('|---|---|---|---|---|---|---|---|---|')
for (const { mapId, difficulty, strategy, runs } of rows) {
  const res = runs.map((r) => (r.status === 'won' ? 'S' : `W${r.wave}`)).join('/')
  const avg = (f) => runs.reduce((s, r) => s + f(r), 0) / runs.length
  const dmg = {}
  for (const r of runs) for (const [t, v] of Object.entries(r.damageByTower)) dmg[t] = (dmg[t] || 0) + v
  const total = Object.values(dmg).reduce((a, b) => a + b, 0) || 1
  const topType = Object.entries(dmg).sort((a, b) => b[1] - a[1])[0]
  console.log(`| ${mapId} | ${difficulty} | ${STRATEGIES[strategy].label} | ${res} | ${avg((r) => r.livesLost).toFixed(1)} | ${pct(avg((r) => r.leakRate))} | ${Math.round(avg((r) => r.invested))} G | ${avg((r) => r.avgWaveTime).toFixed(0)} s | ${topType ? `${topType[0]} ${pct(topType[1] / total)}` : '–'} |`)
}

// Durchbrüche nach Gegnertyp über alle Läufe – zeigt, welche Gegnerrolle welche Strategie bestraft
console.log('\nDurchgelassene Gegner je Typ (Summe aller Seeds):\n')
for (const { mapId, difficulty, strategy, runs } of rows) {
  const leaked = {}
  for (const r of runs) for (const [t, v] of Object.entries(r.leakedByType)) leaked[t] = (leaked[t] || 0) + v
  const list = Object.entries(leaked).sort((a, b) => b[1] - a[1]).map(([t, v]) => `${t} ${v}`).join(', ')
  console.log(`- ${mapId}/${difficulty}/${strategy}: ${list || 'keine'}`)
}
if (process.env.JSON) console.log(JSON.stringify(rows.map(({ mapId, difficulty, strategy, runs }) => ({ mapId, difficulty, strategy, runs }))))
