// Experiment: Parameter nur im Speicher ändern und Strategien vergleichen (verändert keine Dateien).
//   node tools/balance-experiment.mjs '<json-patch>' [karten] [strategien] [schwierigkeit]
// Pfade: towers.<id>…, enemies.<id>…, balance.…, maps.<id>.hpMult
// Beispiel: node tools/balance-experiment.mjs '{"towers.sniper.levels.0.range":260}'
import { runStrategy } from '../tests/helpers/strategies.js'
import { TOWERS } from '../js/config/towers.js'
import { ENEMIES } from '../js/config/enemies.js'
import { BALANCE } from '../js/config/balance.js'
import { MAPS } from '../js/config/maps.js'

const [patchJson = '{}', maps = 'gruenental,felsenpass,sumpfgabel', strategies = 'cluster,spread,single,control,aoe', difficulty = 'normal'] = process.argv.slice(2)
const roots = { towers: TOWERS, enemies: ENEMIES, balance: BALANCE, maps: Object.fromEntries(MAPS.map((m) => [m.id, m])) }
for (const [path, value] of Object.entries(JSON.parse(patchJson))) {
  const keys = path.split('.')
  let o = roots[keys.shift()]
  while (keys.length > 1) o = o[keys.shift()]
  o[keys[0]] = value
}
const out = []
for (const strategy of strategies.split(',')) {
  const cells = maps.split(',').map((mapId) => {
    const r = runStrategy({ strategy, mapId, difficulty })
    return r.status === 'won' ? `S−${r.livesLost}` : `W${r.wave}`
  })
  out.push(`${strategy.padEnd(8)} ${cells.join('  ')}`)
}
console.log(out.join('\n'))
