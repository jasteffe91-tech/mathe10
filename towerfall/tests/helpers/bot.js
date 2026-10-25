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

function bestSpot(game, type) {
  const range = TOWERS[type].levels[0].range
  if (TOWERS[type].attack === 'aura') {
    let best = null, n = -1
    for (const s of game.spots) {
      if (s.tower) continue
      const c = game.towers.filter((t) => (t.x - s.x) ** 2 + (t.y - s.y) ** 2 <= range * range).length
      if (c > n) { n = c; best = s }
    }
    return best
  }
  let best = null, bestCov = -1
  for (const s of game.spots) {
    if (s.tower) continue
    const cov = game.coverage(s.x, s.y, range, 12)
    if (cov > bestCov) { bestCov = cov; best = s }
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

export function runBot({ mapId = 'gruenental', difficulty = 'normal', plan = 'mixed', seed = 1, callEarly = false, maxSeconds = 3600 } = {}) {
  const game = new Game({ mapId, difficulty, seed })
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
        const spot = bestSpot(game, action)
        if (!spot) { steps.shift(); continue }
        if (!game.build(spot.index, action).ok) return
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
