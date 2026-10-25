// Passierbarkeit der Gegnerrouten auf dem Raster.
// Gegner folgen festen Routen; diese Datei ermittelt einmalig, welche Zellen jede Route berührt, und
// prüft nach jeder Kartenänderung, ob alle diese Zellen noch begehbar sind. Neu berechnet wird nur,
// wenn sich die Karte ändert – nie pro Frame.
import { TERRAIN } from '../config/terrain.js'

export function computeRouteCells(grid, routes) {
  return routes.map((rt) => {
    const seen = new Set()
    const p = {}
    for (let d = 0; d <= rt.length; d += grid.cell / 3) {
      rt.sample(d, p)
      const { c, r } = grid.cellAt(p.x, p.y)
      if (grid.inBounds(c, r)) seen.add(grid.idx(c, r))
    }
    return [...seen]
  })
}

// Ist jede Route durchgehend begehbar? `extraBlocked`: Zellen, die probeweise als belegt gelten
// (z. B. die Grundfläche eines geplanten Turms).
export function routesPassable(game, extraBlocked = null) {
  const { grid } = game
  for (const cells of game.routeCells) {
    for (const i of cells) {
      if (!TERRAIN[grid.terrain[i]].walkable) return false
      if (grid.tower[i]) return false
      const o = grid.obstacle[i]
      if (o && !game.obstacles.get(o)?.def.walkable) return false
      if (extraBlocked && extraBlocked.has(i)) return false
    }
  }
  return true
}
