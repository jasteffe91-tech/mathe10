// Misst in echten Partien (Strategie-Bots) den Schaden pro investiertem Gold je Turmtyp sowie den Anteil
// am Gesamtschaden. Aufruf: node tools/tower-efficiency.mjs [karten] [strategien]
import { runStrategy } from '../tests/helpers/strategies.js'
import { Game } from '../js/game/game.js'

const [maps = 'gruenental,felsenpass,sumpfgabel', strategies = 'cluster,control,spread'] = process.argv.slice(2)
const agg = {}
for (const mapId of maps.split(',')) {
  for (const strategy of strategies.split(',')) {
    let game
    const orig = Game.prototype.step
    Game.prototype.step = function (dt) { game = this; return orig.call(this, dt) }
    runStrategy({ strategy, mapId })
    Game.prototype.step = orig
    // Schaden aus der Telemetrie, Investition aus den am Ende stehenden Türmen
    const dmg = game.telemetry.damageByTower()
    const inv = {}
    for (const t of game.towers) inv[t.type] = (inv[t.type] || 0) + t.invested
    for (const type of new Set([...Object.keys(dmg), ...Object.keys(inv)])) {
      const a = agg[type] || (agg[type] = { dmg: 0, inv: 0 })
      a.dmg += dmg[type] || 0
      a.inv += inv[type] || 0
    }
  }
}
const total = Object.values(agg).reduce((s, a) => s + a.dmg, 0)
console.log('| Turm | Schaden je Gold | Anteil am Schaden | investiert |')
console.log('|---|---|---|---|')
for (const [type, a] of Object.entries(agg).sort((x, y) => y[1].dmg / Math.max(1, y[1].inv) - x[1].dmg / Math.max(1, x[1].inv))) {
  console.log(`| ${type} | ${(a.dmg / Math.max(1, a.inv)).toFixed(1)} | ${Math.round((a.dmg / total) * 100)} % | ${a.inv} G |`)
}
