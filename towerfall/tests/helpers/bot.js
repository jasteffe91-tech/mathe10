// Ein einfacher Spieler-Bot für Balance-Tests: baut nach einer festen Reihenfolge an den
// Bauplätzen mit der meisten Wegabdeckung und verbessert danach. Nutzt nur die öffentliche Game-API.
import { Game } from '../../js/game/game.js'
import { TOWERS } from '../../js/config/towers.js'

export const PLANS = {
  mixed: ['arrow', 'arrow', 'cannon', 'frost', 'up', 'sniper', 'arrow', 'up', 'lightning', 'poison', 'up', 'cannon', 'up', 'sniper', 'up', 'frost', 'lightning', 'up', 'up', 'poison', 'up', 'up', 'up', 'sniper', 'cannon', 'up', 'up', 'up', 'up', 'up', 'up', 'up', 'up', 'up', 'up', 'up', 'up', 'up', 'up', 'up', 'up'],
  // nutzt auch Speerschleuder und Kriegsbanner
  modern: ['arrow', 'arrow', 'cannon', 'frost', 'up', 'ballista', 'sniper', 'up', 'banner', 'lightning', 'poison', 'up', 'up', 'ballista', 'sniper', 'up', 'up', 'cannon', 'banner', 'up', 'up', 'frost', 'up', 'up', 'up', 'sniper', 'up', 'up', 'up', 'up', 'up', 'up', 'up', 'up', 'up', 'up', 'up', 'up', 'up'],
  arrowsOnly: Array.from({ length: 60 }, (_, i) => (i % 2 ? 'up' : 'arrow')),
  nothing: [],
}

// Wegpunkte einmal abtasten, dann je Kandidat nur zählen (schnell genug für alle Rasterpositionen)
function samples(game) {
  if (game._botSamples) return game._botSamples
  const pts = []
  const p = {}
  for (const rt of game.routes) for (let d = 0; d < rt.length; d += 16) { rt.sample(d, p); pts.push(p.x, p.y) }
  return (game._botSamples = pts)
}

function coverageAt(game, x, y, range, minRange = 0) {
  const pts = samples(game)
  let n = 0
  for (let i = 0; i < pts.length; i += 2) {
    const d2 = (pts[i] - x) ** 2 + (pts[i + 1] - y) ** 2
    if (d2 <= range * range && d2 >= minRange * minRange) n++
  }
  return n
}

// Beste gültige Rasterposition für einen Turmtyp
export function bestPlacement(game, type) {
  const def = TOWERS[type]
  const lvl = def.levels[0]
  let best = null, bestScore = -1
  const rots = def.footprint.rotatable ? [0, 1] : [0]
  for (const rot of rots) {
    for (let r = 0; r < game.grid.rows; r++) {
      for (let c = 0; c < game.grid.cols; c++) {
        const p = game.canPlace(type, c, r, rot)
        if (!p.ok) continue
        const score = def.attack === 'aura'
          ? game.towers.filter((t) => (t.x - p.x) ** 2 + (t.y - p.y) ** 2 <= lvl.range * lvl.range).length
          : coverageAt(game, p.x, p.y, lvl.range, lvl.minRange || 0)
        if (score > bestScore) { bestScore = score; best = p }
      }
    }
  }
  return best
}

function cheapestUpgrade(game) {
  let best = null, cost = Infinity
  for (const t of game.towers) {
    const c = game.canUpgrade(t)
    if (!c.max && c.cost !== undefined && c.cost < cost) { cost = c.cost; best = t }
  }
  return best
}

export function runBot({ mapId = 'gruenental', difficulty = 'normal', plan = 'mixed', seed = 1, callEarly = false, maxSeconds = 3600, mode = 'normal' } = {}) {
  const game = new Game({ mapId, difficulty, seed, mode })
  const steps = PLANS[plan].slice()
  const dt = 1 / 60
  let ticks = 0
  const tryActions = () => {
    while (steps.length) {
      const action = steps[0]
      if (action === 'up') {
        const t = cheapestUpgrade(game)
        if (!t) { steps.shift(); continue }
        if (!game.upgrade(t).ok) return
      } else {
        const cost = TOWERS[action].levels[0].cost
        if (game.gold < cost) return
        const place = bestPlacement(game, action)
        if (!place) { steps.shift(); continue }
        if (!game.build(action, place.c, place.r, place.rot).ok) return
      }
      steps.shift()
    }
    // Plan abgearbeitet: weiter verbessern
    const t = cheapestUpgrade(game)
    if (t) game.upgrade(t)
  }
  tryActions()
  game.callNextWave()
  while (game.status === 'playing' && ticks < maxSeconds * 60) {
    game.step(dt)
    ticks++
    if (ticks % 30 === 0) tryActions()
    if (callEarly && game.phase === 'countdown' && game.waves.countdown < 10) game.callNextWave()
  }
  return { game, status: game.status, wave: game.wave, lives: game.lives, seconds: Math.round(game.time) }
}
