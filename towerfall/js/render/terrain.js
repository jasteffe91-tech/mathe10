// Statischer Kartenhintergrund: Gras, Teiche, Weg, Steine, Bäume, Blumen und Bauplatz-Fundamente.
// Wird einmal pro Größenänderung in ein Offscreen-Canvas gezeichnet und danach nur noch kopiert.
import { createRng } from '../core/rng.js'
import { WORLD } from '../config/maps.js'

export function renderTerrain(game, pixelScale) {
  const canvas = makeCanvas(Math.round(WORLD.width * pixelScale), Math.round(WORLD.height * pixelScale))
  const ctx = canvas.getContext('2d')
  ctx.scale(pixelScale, pixelScale)
  const map = game.map
  const pal = map.palette
  const rng = createRng(map.seed)
  const route = game.route
  const pw = map.pathWidth

  // Freie Fläche prüfen: nicht auf dem Weg, nicht auf Bauplätzen, nicht auf der Bastion
  const free = (x, y, margin) => {
    if (route.distanceTo(x, y) < pw / 2 + margin) return false
    for (const s of game.spots) if ((s.x - x) ** 2 + (s.y - y) ** 2 < (34 + margin) ** 2) return false
    if ((map.base.x - x) ** 2 + (map.base.y - y) ** 2 < (70 + margin) ** 2) return false
    for (const p of map.ponds || []) if (((x - p.x) / (p.rx + margin)) ** 2 + ((y - p.y) / (p.ry + margin)) ** 2 < 1) return false
    return true
  }

  // Gras: Verlauf + weiche Farbflecken + Halme
  const grad = ctx.createLinearGradient(0, 0, WORLD.width, WORLD.height)
  grad.addColorStop(0, pal.grassLight)
  grad.addColorStop(0.5, pal.grass)
  grad.addColorStop(1, pal.grassDark)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, WORLD.width, WORLD.height)
  for (let i = 0; i < 140; i++) {
    const x = rng() * WORLD.width, y = rng() * WORLD.height, r = rng.range(30, 110)
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    const c = rng() < 0.5 ? pal.grassLight : pal.grassDark
    g.addColorStop(0, hexA(c, 0.35))
    g.addColorStop(1, hexA(c, 0))
    ctx.fillStyle = g
    ctx.fillRect(x - r, y - r, r * 2, r * 2)
  }
  ctx.lineCap = 'round'
  for (let i = 0; i < 900; i++) {
    const x = rng() * WORLD.width, y = rng() * WORLD.height
    ctx.strokeStyle = hexA(rng() < 0.5 ? pal.grassLight : pal.grassDark, rng.range(0.35, 0.7))
    ctx.lineWidth = 1.2
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + rng.range(-2, 2), y - rng.range(3, 6))
    ctx.stroke()
  }

  // Teiche
  for (const p of map.ponds || []) drawPond(ctx, p, rng)

  // Weg: dunkler Rand, Erdfläche, hellere Mitte, Steinchen
  const pts = route.points
  const strokePath = (width, style) => {
    ctx.strokeStyle = style
    ctx.lineWidth = width
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(pts[0][0], pts[0][1])
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1])
    ctx.stroke()
  }
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,.25)'
  ctx.shadowBlur = 10
  strokePath(pw + 12, hexA(pal.pathEdge, 0.55))
  ctx.restore()
  strokePath(pw + 4, pal.pathEdge)
  strokePath(pw - 2, pal.path)
  strokePath(pw * 0.45, hexA('#ffffff', 0.09))
  const p = {}
  for (let d = 0; d < route.length; d += 4) {
    route.sample(d, p)
    const off = rng.range(-pw / 2 + 4, pw / 2 - 4)
    const x = p.x - Math.sin(p.angle) * off, y = p.y + Math.cos(p.angle) * off
    ctx.fillStyle = rng() < 0.5 ? hexA(pal.pathEdge, 0.25) : hexA('#ffffff', 0.12)
    ctx.beginPath()
    ctx.arc(x, y, rng.range(0.8, 2.2), 0, Math.PI * 2)
    ctx.fill()
  }

  // Steine
  for (let i = 0, placed = 0; i < 400 && placed < 26; i++) {
    const x = rng() * WORLD.width, y = rng() * WORLD.height
    if (!free(x, y, 8)) continue
    drawRock(ctx, x, y, rng.range(5, 13), rng)
    placed++
  }
  // Blumen
  const flowers = ['#f5e663', '#f2f2f2', '#e98ab0', '#b9a3f0']
  for (let i = 0, placed = 0; i < 1200 && placed < 160; i++) {
    const x = rng() * WORLD.width, y = rng() * WORLD.height
    if (!free(x, y, 4)) continue
    ctx.fillStyle = rng.pick(flowers)
    ctx.beginPath()
    ctx.arc(x, y, rng.range(1.2, 2.2), 0, Math.PI * 2)
    ctx.fill()
    placed++
  }
  // Büsche und Bäume (nach y sortiert, damit hintere zuerst gezeichnet werden)
  const trees = []
  for (let i = 0; i < 900 && trees.length < 46; i++) {
    const x = rng() * WORLD.width, y = rng() * WORLD.height
    const r = rng.range(12, 26)
    if (!free(x, y, r + 8)) continue
    if (trees.some((t) => (t.x - x) ** 2 + (t.y - y) ** 2 < (t.r + r) ** 2)) continue
    trees.push({ x, y, r, seed: rng() })
  }
  trees.sort((a, b) => a.y - b.y)
  for (const t of trees) drawTree(ctx, t, pal)

  // Spawn-Bereich: dunkle Felsöffnung am Wegbeginn
  drawSpawn(ctx, route, pal)

  // Bauplätze
  for (const s of game.spots) drawSpot(ctx, s.x, s.y)

  // Vignette
  const v = ctx.createRadialGradient(WORLD.width / 2, WORLD.height / 2, WORLD.height * 0.45, WORLD.width / 2, WORLD.height / 2, WORLD.width * 0.75)
  v.addColorStop(0, 'rgba(0,0,0,0)')
  v.addColorStop(1, 'rgba(10,15,25,.38)')
  ctx.fillStyle = v
  ctx.fillRect(0, 0, WORLD.width, WORLD.height)
  return canvas
}

function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h)
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

export function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
}

function drawPond(ctx, p, rng) {
  ctx.save()
  ctx.fillStyle = 'rgba(60,50,30,.35)'
  ctx.beginPath()
  ctx.ellipse(p.x, p.y + 3, p.rx + 8, p.ry + 7, 0, 0, Math.PI * 2)
  ctx.fill()
  const g = ctx.createRadialGradient(p.x - p.rx * 0.3, p.y - p.ry * 0.3, 4, p.x, p.y, p.rx)
  g.addColorStop(0, '#6ec3d8')
  g.addColorStop(0.7, '#3d8fb0')
  g.addColorStop(1, '#2f6f8f')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.ellipse(p.x, p.y, p.rx, p.ry, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,.35)'
  ctx.lineWidth = 1.5
  for (let i = 0; i < 4; i++) {
    const x = p.x + rng.range(-p.rx * 0.5, p.rx * 0.5), y = p.y + rng.range(-p.ry * 0.4, p.ry * 0.4)
    ctx.beginPath()
    ctx.ellipse(x, y, rng.range(8, 18), rng.range(2, 4), 0, 0, Math.PI)
    ctx.stroke()
  }
  // Schilf
  ctx.strokeStyle = '#3f6b2c'
  ctx.lineWidth = 2
  for (let i = 0; i < 10; i++) {
    const a = rng.range(0, Math.PI * 2)
    const x = p.x + Math.cos(a) * p.rx * 0.95, y = p.y + Math.sin(a) * p.ry * 0.95
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + rng.range(-3, 3), y - rng.range(8, 14))
    ctx.stroke()
  }
  ctx.restore()
}

function drawRock(ctx, x, y, r, rng) {
  ctx.fillStyle = 'rgba(0,0,0,.22)'
  ctx.beginPath()
  ctx.ellipse(x + 2, y + 3, r * 1.1, r * 0.7, 0, 0, Math.PI * 2)
  ctx.fill()
  const g = ctx.createLinearGradient(x - r, y - r, x + r, y + r)
  g.addColorStop(0, '#b9b8b0')
  g.addColorStop(1, '#6f6e68')
  ctx.fillStyle = g
  ctx.beginPath()
  const n = 7
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    const rr = r * rng.range(0.75, 1.05)
    const px = x + Math.cos(a) * rr * 1.15, py = y + Math.sin(a) * rr * 0.8
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)
  }
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,.25)'
  ctx.beginPath()
  ctx.ellipse(x - r * 0.3, y - r * 0.3, r * 0.4, r * 0.22, -0.4, 0, Math.PI * 2)
  ctx.fill()
}

function drawTree(ctx, t, pal) {
  const { x, y, r } = t
  ctx.fillStyle = 'rgba(0,0,0,.28)'
  ctx.beginPath()
  ctx.ellipse(x + r * 0.35, y + r * 0.45, r * 1.05, r * 0.75, 0, 0, Math.PI * 2)
  ctx.fill()
  const dark = t.seed < 0.35 ? '#2f5a2a' : t.seed < 0.7 ? '#356b2f' : '#2b5236'
  const light = t.seed < 0.35 ? '#5d9447' : t.seed < 0.7 ? '#6aa64d' : '#4f8a58'
  const blobs = 5
  for (let i = 0; i < blobs; i++) {
    const a = (i / blobs) * Math.PI * 2 + t.seed * 6
    const bx = x + Math.cos(a) * r * 0.45, by = y + Math.sin(a) * r * 0.4
    ctx.fillStyle = dark
    ctx.beginPath()
    ctx.arc(bx, by, r * 0.62, 0, Math.PI * 2)
    ctx.fill()
  }
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, 1, x, y, r)
  g.addColorStop(0, light)
  g.addColorStop(1, hexA(light, 0))
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(x, y, r * 0.95, 0, Math.PI * 2)
  ctx.fill()
}

function drawSpawn(ctx, route, pal) {
  // Punkt, an dem die Route ins Bild kommt
  const p = {}
  let d = 0
  for (; d < route.length; d += 4) {
    route.sample(d, p)
    if (p.x > 4 && p.y > 4 && p.x < WORLD.width - 4 && p.y < WORLD.height - 4) break
  }
  route.sample(d + 10, p)
  ctx.save()
  ctx.translate(p.x, p.y)
  ctx.rotate(p.angle)
  const g = ctx.createRadialGradient(-20, 0, 4, -20, 0, 70)
  g.addColorStop(0, 'rgba(20,10,30,.85)')
  g.addColorStop(1, 'rgba(20,10,30,0)')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(-20, 0, 70, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawSpot(ctx, x, y) {
  ctx.fillStyle = 'rgba(0,0,0,.3)'
  ctx.beginPath()
  ctx.ellipse(x + 2, y + 4, 27, 22, 0, 0, Math.PI * 2)
  ctx.fill()
  const g = ctx.createLinearGradient(x - 24, y - 24, x + 24, y + 24)
  g.addColorStop(0, '#b3ab98')
  g.addColorStop(1, '#7a7363')
  ctx.fillStyle = g
  ctx.beginPath()
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8
    const px = x + Math.cos(a) * 25, py = y + Math.sin(a) * 25
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)
  }
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = 'rgba(60,52,40,.7)'
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.strokeStyle = 'rgba(255,255,255,.18)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(x - 25, y)
  ctx.lineTo(x + 25, y)
  ctx.moveTo(x, y - 25)
  ctx.lineTo(x, y + 25)
  ctx.stroke()
  ctx.fillStyle = 'rgba(40,34,26,.35)'
  ctx.beginPath()
  ctx.arc(x, y, 10, 0, Math.PI * 2)
  ctx.fill()
}
