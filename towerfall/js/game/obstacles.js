// Hindernisse auf der Karte: deterministisch aus Karten-Seed und Modus erzeugt (jede Karte sieht
// in einem Modus immer gleich aus), plus kartenspezifische Extras. Hindernisse liegen nur auf
// Bauland – nie auf Wegen, Brücken, Wasser oder der Bastion.
import { OBSTACLES } from '../config/terrain.js'
import { createRng } from '../core/rng.js'

// Form je Hindernisart: Liste relativer Zellen
function shapeFor(type, rng) {
  switch (type) {
    case 'rock': return [[0, 0], [1, 0], [0, 1], [1, 1]]
    case 'wall': {
      // gerade Mauer aus 3–5 Zellen, waagerecht oder senkrecht
      const len = rng.int(3, 5), vertical = rng() < 0.5
      return Array.from({ length: len }, (_, i) => (vertical ? [0, i] : [i, 0]))
    }
    case 'cliff': {
      // zusammenhängender Felsklumpen aus 4–7 Zellen
      const cells = [[0, 0]]
      const target = rng.int(4, 7)
      while (cells.length < target) {
        const [bc, br] = rng.pick(cells)
        const [dc, dr] = rng.pick([[1, 0], [-1, 0], [0, 1], [0, -1]])
        if (!cells.some(([c, r]) => c === bc + dc && r === br + dr)) cells.push([bc + dc, br + dr])
      }
      return cells
    }
    default: return [[0, 0]]
  }
}

export function generateObstacles(grid, { map, mode, routes }) {
  const rng = createRng(map.seed * 7919 + (mode.id === 'advanced' ? 13 : 1))
  const list = []
  const counts = { ...mode.scatter, ...(mode.features && map.advanced?.scatter ? map.advanced.scatter : {}) }
  // Im Normalmodus bleiben die Bäume eher am Rand, damit die Bauflächen am Weg frei sind
  const minPathDist = mode.features ? 0 : 110
  const cellFree = (c, r) => {
    if (!grid.inBounds(c, r)) return false
    const i = grid.idx(c, r)
    if (grid.terrain[i] !== 'grass' || grid.obstacle[i]) return false
    const { x, y } = grid.cellCenter(c, r)
    if (Math.hypot(x - map.base.x, y - map.base.y) < 110) return false
    if (minPathDist && routes.some((rt) => rt.distanceTo(x, y) < minPathDist)) return false
    return true
  }
  // Große Hindernisse zuerst, damit sie noch Platz finden
  const order = ['cliff', 'wall', 'rock', 'tree', 'stones']
  let id = 1
  for (const type of order) {
    const n = counts[type] || 0
    for (let k = 0, placed = 0; k < n * 40 && placed < n; k++) {
      const c = rng.int(0, grid.cols - 1), r = rng.int(0, grid.rows - 1)
      const shape = shapeFor(type, rng)
      const cells = shape.map(([dc, dr]) => ({ c: c + dc, r: r + dr }))
      if (!cells.every(({ c: cc, r: rr }) => cellFree(cc, rr))) continue
      // Bäume gern in kleinen Gruppen: zweiter Baum direkt daneben, wenn frei
      const obstacle = makeObstacle(id++, type, cells, grid, rng)
      list.push(obstacle)
      grid.setObstacle(cells, obstacle.id)
      placed++
      if (type === 'tree' && placed < n && rng() < 0.55) {
        const [dc, dr] = rng.pick([[1, 0], [-1, 0], [0, 1], [0, -1]])
        if (cellFree(c + dc, r + dr)) {
          const o2 = makeObstacle(id++, type, [{ c: c + dc, r: r + dr }], grid, rng)
          list.push(o2)
          grid.setObstacle(o2.cells, o2.id)
          placed++
        }
      }
    }
  }
  for (const o of list) if (o.def.blocksSight) grid.sightBlockers += o.cells.length
  return list
}

function makeObstacle(id, type, cells, grid, rng) {
  const xs = cells.map((p) => grid.cellCenter(p.c, p.r))
  return {
    id,
    type,
    def: OBSTACLES[type],
    cells,
    x: xs.reduce((s, p) => s + p.x, 0) / xs.length,
    y: xs.reduce((s, p) => s + p.y, 0) / xs.length,
    seed: rng(),
  }
}

export const clearCost = (obstacle, mode) => Math.round(obstacle.def.costPerCell * obstacle.cells.length * mode.clearCostMult)
