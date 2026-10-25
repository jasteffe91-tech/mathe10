// Kleiner, deterministischer Zufallsgenerator (mulberry32).
// Gleicher Startwert → gleiche Zahlenfolge; wichtig für reproduzierbare Tests und Kartendeko.
export function createRng(seed = 1) {
  let a = seed >>> 0
  const next = () => {
    a = (a + 0x6D2B79F5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  next.range = (min, max) => min + next() * (max - min)
  next.int = (min, max) => Math.floor(min + next() * (max - min + 1))
  next.pick = (list) => list[Math.floor(next() * list.length)]
  return next
}
