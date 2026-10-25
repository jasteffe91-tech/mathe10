// Bauen, Versetzen und Räumen auf dem Raster. Jede Aktion prüft zuerst vollständig (Platz, Gelände,
// Wege, Gold) und verändert den Spielzustand erst danach – ungültige Aktionen kosten nichts und
// hinterlassen keine Zwischenzustände.
import { TOWERS, footprintOf } from '../config/towers.js'
import { BALANCE } from '../config/balance.js'
import { checkPlacement } from './placement.js'
import { createTower, refreshBuffs } from './towers.js'
import { clearCost } from './obstacles.js'
import { routesPassable } from './routes.js'

const notPlaying = { ok: false, reason: 'Die Partie ist beendet.' }

export function canBuild(game, type, c, r, rot = 0) {
  const def = TOWERS[type]
  if (!def) return { ok: false, reason: 'Unbekannter Turm.' }
  if (game.status !== 'playing') return notPlaying
  const place = checkPlacement(game, type, c, r, rot)
  const cost = def.levels[0].cost
  if (!place.ok) return { ...place, cost }
  if (!game.wallet.canAfford(cost)) {
    return { ...place, ok: false, code: 'gold', cost, missing: cost - game.gold, reason: `Dir fehlen ${cost - game.gold} Gold. Besiege Gegner, um Gold zu verdienen.` }
  }
  return { ...place, cost, remaining: game.gold - cost }
}

export function build(game, type, c, r, rot = 0) {
  const check = canBuild(game, type, c, r, rot)
  if (!check.ok) return check
  game.wallet.spend(check.cost)
  const tower = createTower(type, check, game.nextId++)
  game.grid.setTower(check.cells, tower.id)
  game.towers.push(tower)
  refreshBuffs(game.towers)
  game.emit('build', { tower })
  return { ok: true, tower, cost: check.cost }
}

// Turm vom Raster nehmen (Verkauf)
export function removeTower(game, tower) {
  game.grid.setTower(tower.cells, 0)
  game.towers.splice(game.towers.indexOf(tower), 1)
  refreshBuffs(game.towers)
}

export const moveCost = (tower) => Math.max(BALANCE.moveCostMin, Math.round(tower.invested * BALANCE.moveCostRatio))

export function canMove(game, tower, c, r, rot = tower.rot) {
  if (game.status !== 'playing') return notPlaying
  if (!game.towers.includes(tower)) return { ok: false, reason: 'Kein Turm ausgewählt.' }
  // Die eigene alte Fläche zählt als frei – der Turm darf sich auch nur um eine Zelle verschieben
  const place = checkPlacement(game, tower.type, c, r, rot, tower)
  const cost = moveCost(tower)
  if (!place.ok) return { ...place, cost }
  if (c === tower.c && r === tower.r && (rot % 2) === (tower.rot % 2)) return { ...place, ok: false, code: 'same', cost, reason: 'Der Turm steht bereits hier.' }
  if (!game.wallet.canAfford(cost)) return { ...place, ok: false, code: 'gold', cost, missing: cost - game.gold, reason: `Versetzen kostet ${cost} G – dir fehlen ${cost - game.gold} Gold.` }
  return { ...place, cost }
}

// Versetzen in einem Schritt: alte Fläche freigeben und neue belegen, erst nach erfolgreicher Prüfung
export function moveTower(game, tower, c, r, rot = tower.rot) {
  const check = canMove(game, tower, c, r, rot)
  if (!check.ok) return check
  game.wallet.spend(check.cost)
  tower.invested += 0 // Versetzen erhöht den Verkaufswert nicht
  game.grid.setTower(tower.cells, 0)
  Object.assign(tower, { c: check.c, r: check.r, rot: check.rot, w: check.w, h: check.h, x: check.x, y: check.y })
  tower.cells = check.cells.map(({ c: cc, r: rr }) => ({ c: cc, r: rr }))
  game.grid.setTower(tower.cells, tower.id)
  refreshBuffs(game.towers)
  game.emit('move', { tower, cost: check.cost })
  return { ok: true, tower, cost: check.cost }
}

export function canClear(game, obstacle) {
  if (game.status !== 'playing') return notPlaying
  if (!obstacle || !game.obstacles.has(obstacle.id)) return { ok: false, reason: 'Kein Hindernis ausgewählt.' }
  if (!obstacle.def.removable) return { ok: false, code: 'fixed', reason: `${obstacle.def.name} lässt sich nicht entfernen.` }
  const cost = clearCost(obstacle, game.mode)
  if (!game.wallet.canAfford(cost)) return { ok: false, code: 'gold', cost, missing: cost - game.gold, reason: `Räumen kostet ${cost} G – dir fehlen ${cost - game.gold} Gold.` }
  // Probe: Wege müssen auch danach passierbar sein (Hindernisse liegen nie auf Wegen – reine Absicherung)
  if (!routesPassable(game)) return { ok: false, code: 'route', cost, reason: 'Diese Änderung würde eine Wegverbindung unterbrechen.' }
  return { ok: true, cost }
}

export function clearObstacle(game, obstacle) {
  const check = canClear(game, obstacle)
  if (!check.ok) return check
  game.wallet.spend(check.cost)
  game.grid.setObstacle(obstacle.cells, 0)
  if (obstacle.def.blocksSight) game.grid.sightBlockers -= obstacle.cells.length
  game.obstacles.delete(obstacle.id)
  game.clearedObstacles.push(obstacle.id)
  game.emit('clear', { obstacle, cost: check.cost })
  return { ok: true, cost: check.cost }
}

// Nächste gültige Platzierung um einen Weltpunkt (spiralförmige Suche um die Wunschzelle)
export function findPlacementNear(game, type, x, y, rot = 0, maxRing = 4, ignoreTower = null) {
  const { w, h } = footprintOf(type, rot)
  const a = game.grid.anchorFor(x, y, w, h)
  let best = null, bestD = Infinity
  for (let ring = 0; ring <= maxRing; ring++) {
    for (let dr = -ring; dr <= ring; dr++) {
      for (let dc = -ring; dc <= ring; dc++) {
        if (Math.max(Math.abs(dc), Math.abs(dr)) !== ring) continue
        const p = checkPlacement(game, type, a.c + dc, a.r + dr, rot, ignoreTower)
        if (!p.ok) continue
        const d = (p.x - x) ** 2 + (p.y - y) ** 2
        if (d < bestD) { bestD = d; best = p }
      }
    }
    if (best) return best
  }
  return null
}
