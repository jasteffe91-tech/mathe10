// Leitet die Geländeart jeder Rasterzelle aus der Karte ab – ohne dass Karten neu gezeichnet werden
// müssen: Wege (als Korridor um die Routen), Teiche, Flüsse (mit automatischen Brücken, wo eine Route
// sie kreuzt), die Bastion und – je nach Modus – die Bauzone.
import { distToSegment } from '../core/math.js'

// Abstand eines Punktes zu einer Polylinie
function distToPolyline(x, y, pts) {
  let best = Infinity
  for (let i = 1; i < pts.length; i++) {
    const d = distToSegment(x, y, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1])
    if (d < best) best = d
  }
  return best
}

export function buildTerrain(grid, { map, routes, mode, ponds, rivers }) {
  const cell = grid.cell
  // Eine Zelle gilt als Weg, sobald der Weg einen nennenswerten Teil von ihr bedeckt
  const pathReach = map.pathWidth / 2 + cell * 0.55
  const base = map.base
  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      const { x, y } = grid.cellCenter(c, r)
      const i = grid.idx(c, r)
      let dPath = Infinity
      for (const rt of routes) dPath = Math.min(dPath, rt.distanceTo(x, y))
      const inWater = ponds.some((p) => ((x - p.x) / (p.rx + cell * 0.35)) ** 2 + ((y - p.y) / (p.ry + cell * 0.35)) ** 2 < 1) ||
        rivers.some((rv) => distToPolyline(x, y, rv.points) < rv.width / 2 + cell * 0.3)
      let kind = 'grass'
      // Bastion inkl. Ecktürme und sichtbarer Mauertiefe nach unten
      if (Math.abs(x - base.x) < 66 && y - base.y > -66 && y - base.y < 76) kind = 'base'
      else if (dPath < pathReach) kind = inWater ? 'bridge' : 'path'
      else if (inWater) kind = 'water'
      else if (dPath > mode.maxBuildDistance) kind = 'outside'
      grid.terrain[i] = kind
    }
  }
  grid.version++
}

// Stellen, an denen eine Route einen Fluss kreuzt (für die Darstellung der Brücken)
export function bridgeSpans(routes, rivers, step = 4) {
  const spans = []
  const p = {}
  for (const rt of routes) {
    for (const rv of rivers) {
      let start = null
      for (let d = 0; d <= rt.length; d += step) {
        rt.sample(d, p)
        const wet = distToPolyline(p.x, p.y, rv.points) < rv.width / 2 + 6
        if (wet && start === null) start = d
        if (!wet && start !== null) { spans.push({ route: rt, from: start - 6, to: d + 6 }); start = null }
      }
    }
  }
  return spans
}
