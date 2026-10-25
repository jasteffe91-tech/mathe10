// Kleine Geometrie-Helfer, die von Spiel und Darstellung gemeinsam genutzt werden.
export const clamp = (v, min, max) => (v < min ? min : v > max ? max : v)
export const lerp = (a, b, t) => a + (b - a) * t
export const dist2 = (ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay; return dx * dx + dy * dy }
export const dist = (ax, ay, bx, by) => Math.sqrt(dist2(ax, ay, bx, by))

// Kürzester Abstand eines Punktes zu einer Strecke a–b
export function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay
  const len2 = dx * dx + dy * dy
  const t = len2 ? clamp(((px - ax) * dx + (py - ay) * dy) / len2, 0, 1) : 0
  return dist(px, py, ax + dx * t, ay + dy * t)
}

// Winkel ohne Sprung zwischen -π und π annähern (für sanft drehende Türme)
export function approachAngle(current, target, maxStep) {
  let d = target - current
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  if (Math.abs(d) <= maxStep) return target
  return current + Math.sign(d) * maxStep
}
