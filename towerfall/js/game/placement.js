// Platzierungsprüfung für Türme. Reine Prüfung ohne Seiteneffekte: Gold und Spielzustand werden hier
// nie verändert. Liefert neben ok/Begründung auch die belegten und die ungültigen Zellen, damit die
// Vorschau jede Zelle passend einfärben kann.
import { TERRAIN } from '../config/terrain.js'
import { footprintOf } from '../config/towers.js'
import { clearCost } from './obstacles.js'
import { routesPassable } from './routes.js'

export function checkPlacement(game, type, c, r, rot = 0, ignoreTower = null) {
  const { grid } = game
  const { w, h } = footprintOf(type, rot)
  const cells = grid.footprintCells(c, r, w, h)
  const bad = []
  let reason = null, code = null, obstacle = null
  const fail = (cell, why, kind) => {
    bad.push(cell)
    if (!reason) { reason = why; code = kind }
  }
  for (const cell of cells) {
    if (!cell.inside) { fail(cell, 'Der Turm muss vollständig auf der Karte stehen.', 'bounds'); continue }
    const i = grid.idx(cell.c, cell.r)
    const terrain = TERRAIN[grid.terrain[i]]
    if (!terrain.buildable) { fail(cell, terrain.reason, 'terrain'); continue }
    const oid = grid.obstacle[i]
    if (oid) {
      const o = game.obstacles.get(oid)
      if (!obstacle) obstacle = o
      fail(cell, o.def.removable
        ? `${o.def.name} im Weg – für ${clearCost(o, game.mode)} G räumbar.`
        : `${o.def.name} im Weg – nicht entfernbar.`, 'obstacle')
      continue
    }
    const tid = grid.tower[i]
    if (tid && tid !== ignoreTower?.id) fail(cell, 'Hier steht schon ein Turm.', 'tower')
  }
  // Schutz: Die Grundfläche darf keine Route unterbrechen (mit den aktuellen Regeln nie der Fall,
  // weil Wegzellen ohnehin nicht bebaubar sind – die Prüfung bleibt für künftige Kartenarten)
  if (!bad.length) {
    const blocked = new Set(cells.map((p) => grid.idx(p.c, p.r)))
    if (!routesPassable(game, blocked)) {
      bad.push(...cells)
      reason = 'Der Turm würde den Weg der Gegner blockieren.'
      code = 'route'
    }
  }
  const center = grid.footprintCenter(c, r, w, h)
  return { ok: bad.length === 0, reason, code, cells, bad, obstacle, c, r, rot, w, h, x: center.x, y: center.y }
}
