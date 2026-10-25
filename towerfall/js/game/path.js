// Gegnerroute: Aus wenigen Kontrollpunkten wird per Catmull-Rom-Spline eine geschwungene
// Linie, die als Polylinie mit kumulierten Längen gespeichert wird. Gegner speichern nur
// ihre zurückgelegte Strecke (`dist`); Position und Blickrichtung werden daraus berechnet.
import { distToSegment } from '../core/math.js'

function catmull(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t
  const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3)
  return [f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]
}

export function smoothRoute(points, samples = 16) {
  const p = [points[0], ...points, points[points.length - 1]]
  const out = []
  for (let i = 1; i < p.length - 2; i++) {
    for (let s = 0; s < samples; s++) out.push(catmull(p[i - 1], p[i], p[i + 1], p[i + 2], s / samples))
  }
  out.push(points[points.length - 1])
  return out
}

export class Route {
  constructor(points) {
    this.points = points
    this.cum = [0]
    for (let i = 1; i < points.length; i++) {
      const [ax, ay] = points[i - 1], [bx, by] = points[i]
      this.cum.push(this.cum[i - 1] + Math.hypot(bx - ax, by - ay))
    }
    this.length = this.cum[this.cum.length - 1]
  }

  // Position auf der Route nach `d` Pixeln; schreibt x, y, angle in `out`
  sample(d, out = {}) {
    const { points, cum } = this
    if (d <= 0) d = 0
    if (d >= this.length) d = this.length
    let lo = 0, hi = cum.length - 1
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1
      if (cum[mid] <= d) lo = mid
      else hi = mid
    }
    const [ax, ay] = points[lo], [bx, by] = points[hi]
    const seg = cum[hi] - cum[lo] || 1
    const t = (d - cum[lo]) / seg
    out.x = ax + (bx - ax) * t
    out.y = ay + (by - ay) * t
    out.angle = Math.atan2(by - ay, bx - ax)
    return out
  }

  distanceTo(x, y) {
    let best = Infinity
    for (let i = 1; i < this.points.length; i++) {
      const [ax, ay] = this.points[i - 1], [bx, by] = this.points[i]
      const d = distToSegment(x, y, ax, ay, bx, by)
      if (d < best) best = d
    }
    return best
  }

  // Wie viel Strecke liegt innerhalb eines Kreises? (für Bauplatz-Hinweise und Tests)
  coverage(x, y, r, stepLen = 8) {
    let inside = 0
    const p = {}
    for (let d = 0; d < this.length; d += stepLen) {
      this.sample(d, p)
      if ((p.x - x) ** 2 + (p.y - y) ** 2 <= r * r) inside += stepLen
    }
    return inside
  }
}
