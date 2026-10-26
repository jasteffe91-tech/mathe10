// Reproduzierbare Verteidigungsstrategien für Balance-Simulationen. Die Bots spielen nach den echten
// Spielregeln (Game-API: Platzierungsprüfung, Gold, Reichweiten, Angriffszyklen, Resistenzen) – es gibt
// kein vereinfachtes Schadensmodell. Gleicher Seed → gleiches Ergebnis.
import { Game } from '../../js/game/game.js'
import { TOWERS } from '../../js/config/towers.js'

// Bauaufträge je Strategie: Turmtyp oder 'up' (billigste Verbesserung)
const PLANS = {
  mixed: ['arrow', 'arrow', 'cannon', 'frost', 'up', 'ballista', 'sniper', 'up', 'banner', 'lightning', 'poison', 'up', 'up', 'ballista', 'sniper', 'up', 'up', 'cannon', 'banner', 'up', 'up', 'frost', 'trebuchet', 'up', 'up', 'sniper', 'up', 'up', 'up', 'up'],
  aoe: ['cannon', 'frost', 'up', 'lightning', 'poison', 'up', 'cannon', 'up', 'banner', 'lightning', 'up', 'poison', 'up', 'frost', 'cannon', 'up', 'up', 'lightning', 'up', 'up', 'up', 'poison', 'up', 'up'],
  single: ['arrow', 'arrow', 'sniper', 'up', 'ballista', 'up', 'arrow', 'sniper', 'up', 'banner', 'ballista', 'up', 'trebuchet', 'up', 'sniper', 'up', 'up', 'ballista', 'up', 'up', 'trebuchet', 'up', 'up', 'up'],
  // gemischt mit den Elementtürmen (Flamme, Schleim, Tesla) statt einiger klassischer Türme
  elements: ['arrow', 'flame', 'slime', 'up', 'sniper', 'up', 'tesla', 'flame', 'up', 'ballista', 'lightning', 'up', 'up', 'slime', 'sniper', 'up', 'up', 'flame', 'banner', 'up', 'up', 'tesla', 'poison', 'up', 'up', 'sniper', 'up', 'up', 'up', 'up'],
  // nur die drei neuen Türme – darf nicht alles andere überflüssig machen
  newOnly: ['flame', 'flame', 'slime', 'up', 'tesla', 'up', 'flame', 'up', 'slime', 'up', 'tesla', 'up', 'flame', 'up', 'up', 'flame', 'up', 'up', 'tesla', 'up', 'up', 'flame', 'up', 'up'],
}

export const STRATEGIES = {
  cluster: { plan: 'mixed', placement: 'cluster', label: 'Ballung an einer Stelle' },
  spread: { plan: 'mixed', placement: 'spread', label: 'Verteilt auf drei Brennpunkte' },
  aoe: { plan: 'aoe', placement: 'best', label: 'Schwerpunkt Flächenschaden' },
  single: { plan: 'single', placement: 'best', label: 'Einzelziel & Panzerbrechung' },
  control: { plan: 'mixed', placement: 'best', label: 'Gemischt mit Kontrolle' },
  economy: { plan: 'mixed', placement: 'best', budget: 1400, callEarly: true, label: 'Sparsam (max. 1400 G verbaut)' },
  elements: { plan: 'elements', placement: 'best', label: 'Gemischt mit Flamme, Schleim, Tesla' },
  newOnly: { plan: 'newOnly', placement: 'best', label: 'Nur Flamme, Schleim, Tesla' },
}

// Wegpunkte einmal abtasten; Abdeckung = Anzahl Wegpunkte in Reichweite. Mit `air` zählen auch die
// Fluglinien der Harpyien mit (ein aufmerksamer Spieler deckt sie ab; die Ballung tut es absichtlich nicht).
function samples(game, air = true) {
  const key = air ? '_samplesAir' : '_samples'
  if (game[key]) return game[key]
  const pts = []
  const p = {}
  for (const rt of [...game.routes, ...(air ? game.flightRoutes || [] : [])]) for (let d = 0; d < rt.length; d += 16) { rt.sample(d, p); pts.push(p.x, p.y) }
  return (game[key] = pts)
}

// Fluglinien zählen erst, wenn Harpyien angekündigt sind oder schon auftauchten (wie ein Spieler,
// der auf die Wellenvorschau reagiert)
const airKnown = (game) => !!(game.telemetry?.spawned.harpy || game.nextWavePreview()?.counts.harpy)

function coverage(game, x, y, range, minRange = 0, air = airKnown(game)) {
  const pts = samples(game, air)
  let n = 0
  for (let i = 0; i < pts.length; i += 2) {
    const d2 = (pts[i] - x) ** 2 + (pts[i + 1] - y) ** 2
    if (d2 <= range * range && d2 >= minRange * minRange) n++
  }
  return n
}

// Mehrere Brennpunkte mit hoher Wegabdeckung, mindestens `minDist` voneinander entfernt
function hotspots(game, n, minDist) {
  const key = airKnown(game) ? '_hotsAir' : '_hots'
  if (game[key]) return game[key]
  const scored = candidates(game, 'arrow').map((p) => ({ x: p.x, y: p.y, cov: coverage(game, p.x, p.y, 150) })).sort((a, b) => b.cov - a.cov)
  const out = []
  for (const p of scored) {
    if (out.every((q) => Math.hypot(q.x - p.x, q.y - p.y) >= minDist)) out.push(p)
    if (out.length >= n) break
  }
  return (game[key] = out)
}

function candidates(game, type) {
  const def = TOWERS[type]
  const out = []
  for (const rot of def.footprint.rotatable ? [0, 1] : [0]) {
    for (let r = 0; r < game.grid.rows; r++) for (let c = 0; c < game.grid.cols; c++) {
      const p = game.canPlace(type, c, r, rot)
      if (p.ok) out.push(p)
    }
  }
  return out
}

// Stelle mit der höchsten Wegabdeckung auf der ganzen Karte (für die Ballungs-Strategie)
function hotspot(game) {
  if (game._hot) return game._hot
  let best = null, bestCov = -1
  for (const p of candidates(game, 'arrow')) {
    const cov = coverage(game, p.x, p.y, 150, 0, false)
    if (cov > bestCov) { bestCov = cov; best = p }
  }
  return (game._hot = best)
}

export function choosePlacement(game, type, placement) {
  const def = TOWERS[type]
  const lvl = def.levels[0]
  if (placement === 'cluster') {
    const h = hotspot(game)
    for (const rot of def.footprint.rotatable ? [0, 1] : [0]) {
      const p = game.findPlacementNear(type, h.x, h.y, rot, 14)
      if (p) return p
    }
    return null
  }
  if (placement === 'spread') {
    // Verteilen: mehrere getrennte Brennpunkte reihum besetzen (Banner zum vollsten Brennpunkt)
    const spots = hotspots(game, 3, 260)
    const i = (game._spreadIdx = ((game._spreadIdx ?? -1) + 1))
    const h = def.attack === 'aura'
      ? spots.map((q) => ({ q, n: game.towers.filter((t) => Math.hypot(t.x - q.x, t.y - q.y) < 150).length })).sort((a, b) => b.n - a.n)[0].q
      : spots[i % spots.length]
    for (const rot of def.footprint.rotatable ? [0, 1] : [0]) {
      const p = game.findPlacementNear(type, h.x, h.y, rot, 14)
      if (p) return p
    }
    return null
  }
  const list = candidates(game, type)
  let best = null, bestScore = -Infinity
  for (const p of list) {
    const score = def.attack === 'aura'
      ? game.towers.filter((t) => (t.x - p.x) ** 2 + (t.y - p.y) ** 2 <= lvl.range * lvl.range).length
      : coverage(game, p.x, p.y, lvl.range, lvl.minRange || 0)
    if (score > bestScore) { bestScore = score; best = p }
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

const invested = (game) => game.towers.reduce((s, t) => s + t.invested, 0)

export function runStrategy({ strategy = 'control', mapId = 'gruenental', difficulty = 'normal', mode = 'normal', seed = 1, maxSeconds = 3600 } = {}) {
  const st = STRATEGIES[strategy]
  const game = new Game({ mapId, difficulty, mode, seed })
  const steps = PLANS[st.plan].slice()
  const budget = st.budget ?? Infinity
  const act = () => {
    for (let guard = 0; guard < 20; guard++) {
      const action = steps.length ? steps[0] : 'up'
      if (action === 'up') {
        const t = cheapestUpgrade(game)
        if (!t) { if (steps.length) { steps.shift(); continue } return }
        const c = game.canUpgrade(t)
        if (!c.ok || invested(game) + c.cost > budget) return
        game.upgrade(t)
      } else {
        const cost = TOWERS[action].levels[0].cost
        if (game.gold < cost || invested(game) + cost > budget) return
        const p = choosePlacement(game, action, st.placement)
        if (!p) { steps.shift(); continue }
        if (!game.build(action, p.c, p.r, p.rot).ok) return
      }
      if (steps.length) steps.shift()
    }
  }
  act()
  game.callNextWave()
  let ticks = 0
  while (game.status === 'playing' && ticks < maxSeconds * 60) {
    game.step(1 / 60)
    ticks++
    if (ticks % 30 === 0) act()
    if (st.callEarly && game.phase === 'countdown' && game.waves.countdown < 9) game.callNextWave()
  }
  return summarize(game, strategy)
}

export function summarize(game, strategy) {
  // ältere Spielstände des Codes (Vergleichsläufe) haben keine Telemetrie
  const tm = game.telemetry || { spawned: {}, leaked: {}, livesLost: {}, waves: [], damageByTower: () => ({}), damageByEnemy: () => ({}) }
  const spawned = Object.values(tm.spawned).reduce((a, b) => a + b, 0)
  const leaked = Object.values(tm.leaked).reduce((a, b) => a + b, 0)
  const waveTimes = tm.waves.filter((w) => w.end !== null).map((w) => w.end - w.start)
  // Turm mit dem meisten Schaden (Typ und Position)
  const top = [...game.towers].sort((a, b) => b.damageDealt - a.damageDealt)[0]
  return {
    strategy,
    map: game.map.id,
    difficulty: game.difficulty.id,
    mode: game.mode.id,
    status: game.status,
    wave: game.wave,
    lives: game.lives,
    livesLost: game.maxLives - game.lives,
    spawned,
    leaked,
    leakRate: spawned ? leaked / spawned : 0,
    invested: invested(game),
    towers: game.towers.length,
    avgWaveTime: waveTimes.length ? waveTimes.reduce((a, b) => a + b, 0) / waveTimes.length : 0,
    damageByTower: tm.damageByTower(),
    damageByEnemy: tm.damageByEnemy(),
    leakedByType: { ...tm.leaked },
    livesLostByType: { ...tm.livesLost },
    topTower: top ? { type: top.type, x: Math.round(top.x), y: Math.round(top.y), share: top.damageDealt / Math.max(1, game.stats.damage) } : null,
  }
}
