// Statischer Kartenhintergrund: Boden, Gewässer, Flüsse mit Brücken, Wege und Hindernisse – je nach
// Kartenthema (meadow, rock, swamp, snow, desert). Wird einmal pro Größenänderung in ein
// Offscreen-Canvas gezeichnet und danach nur noch kopiert.
import { createRng } from '../core/rng.js'
import { WORLD } from '../config/maps.js'
import { bridgeSpans } from '../game/terrainmap.js'

const TAU = Math.PI * 2

// rot: Ansichtsdrehung (Hochformat). Der Boden wird in Weltlage gezeichnet und vom Renderer mitgedreht;
// Hindernisse mit Höhe (Bäume, Felsen, Mauern) werden vorab zurückgedreht, damit sie aufrecht stehen.
// Das Bild entsteht gleich in Bildschirmlage (gedreht: 720 × 1280 Weltpixel hoch), damit es beim
// Zeichnen jedes Frames nur achsenparallel kopiert werden muss – das ist deutlich schneller.
export function renderTerrain(game, pixelScale, rot = 0) {
  const W = Math.round(WORLD.width * pixelScale), H = Math.round(WORLD.height * pixelScale)
  const canvas = rot ? makeCanvas(H, W) : makeCanvas(W, H)
  const ctx = canvas.getContext('2d')
  if (rot) ctx.setTransform(0, pixelScale, -pixelScale, 0, WORLD.height * pixelScale, 0)
  else ctx.scale(pixelScale, pixelScale)
  const map = game.map
  const theme = map.theme || 'meadow'
  const pal = map.palette
  const rng = createRng(map.seed)
  const grid = game.grid

  // Kleine, nicht blockierende Bodendetails nur auf freiem Bauland
  const free = (x, y) => {
    const { c, r } = grid.cellAt(x, y)
    if (!grid.inBounds(c, r)) return false
    const i = grid.idx(c, r)
    return (grid.terrain[i] === 'grass' || grid.terrain[i] === 'outside') && !grid.obstacle[i]
  }
  const scatter = (count, tries, fn) => {
    for (let i = 0, n = 0; i < tries && n < count; i++) {
      const x = rng() * WORLD.width, y = rng() * WORLD.height
      if (!free(x, y)) continue
      fn(x, y)
      n++
    }
  }

  drawGround(ctx, theme, pal, rng)
  for (const p of game.ponds) drawPond(ctx, p, theme, rng)
  for (const rv of game.rivers) drawRiver(ctx, rv, theme)
  drawPaths(ctx, game, theme, pal, rng)
  for (const span of bridgeSpans(game.routes, game.rivers)) drawBridge(ctx, span, game.map.pathWidth)

  if (theme === 'meadow' || theme === 'rock') {
    const flowers = theme === 'meadow' ? ['#f5e663', '#f2f2f2', '#e98ab0', '#b9a3f0'] : ['#e8e2c8', '#c9c2e8']
    scatter(theme === 'meadow' ? 170 : 60, 1500, (x, y) => circle(ctx, x, y, rng.range(1.2, 2.2), rng.pick(flowers)))
  }
  if (theme === 'swamp') scatter(40, 800, (x, y) => drawReeds(ctx, x, y, rng))
  if (theme === 'desert') scatter(30, 800, (x, y) => drawDryBush(ctx, x, y, rng))
  if (theme === 'snow') scatter(50, 800, (x, y) => drawSnowTuft(ctx, x, y, rng))

  // Hindernisse – genau das, was gezeichnet wird, blockiert auch den Bau (nach y sortiert)
  // nach Bildschirmtiefe sortiert (gedreht: Welt-x)
  const obstacles = [...game.obstacles.values()].sort(rot ? (a, b) => a.x - b.x : (a, b) => a.y - b.y)
  for (const o of obstacles) drawObstacle(ctx, o, theme, grid.cell, rot)

  for (const route of game.routes) drawSpawn(ctx, route)

  // Vignette
  const v = ctx.createRadialGradient(WORLD.width / 2, WORLD.height / 2, WORLD.height * 0.45, WORLD.width / 2, WORLD.height / 2, WORLD.width * 0.75)
  v.addColorStop(0, 'rgba(0,0,0,0)')
  v.addColorStop(1, theme === 'snow' ? 'rgba(40,60,90,.28)' : 'rgba(10,15,25,.38)')
  ctx.fillStyle = v
  ctx.fillRect(0, 0, WORLD.width, WORLD.height)
  return canvas
}

// ---------- Hindernisse ----------
export function drawObstacle(ctx, o, theme, cell, rot = 0) {
  if (o.type === 'wall' || o.type === 'cliff') {
    (o.type === 'wall' ? drawWall : drawCliff)(ctx, o, cell, theme, rot)
    return
  }
  if (rot) { ctx.save(); turnAround(ctx, o.x, o.y, -rot) }
  drawProp(ctx, o, theme, cell)
  if (rot) ctx.restore()
}

// dreht das Koordinatensystem um den Punkt (x, y)
function turnAround(ctx, x, y, a) {
  ctx.translate(x, y)
  ctx.rotate(a)
  ctx.translate(-x, -y)
}

// Mauern und Klippen zellweise aufrecht: jede Zelle um ihre eigene Mitte drehen
function eachCell(ctx, cells, cell, rot, fn) {
  for (const cr of cells) {
    if (rot) { ctx.save(); turnAround(ctx, (cr.c + 0.5) * cell, (cr.r + 0.5) * cell, -rot) }
    fn(cr)
    if (rot) ctx.restore()
  }
}

function drawProp(ctx, o, theme, cell) {
  const t = { x: o.x, y: o.y, r: cell * 0.48, seed: o.seed }
  switch (o.type) {
    case 'tree':
      if (theme === 'snow') drawPine(ctx, t, true)
      else if (theme === 'rock') (o.seed < 0.6 ? drawPine(ctx, t, false) : drawTree(ctx, t))
      else if (theme === 'swamp') (o.seed < 0.45 ? drawDeadTree(ctx, t) : drawWillow(ctx, t))
      else if (theme === 'desert') (o.seed < 0.65 ? drawCactus(ctx, t) : drawPalm(ctx, t))
      else drawTree(ctx, t)
      break
    case 'stones': {
      const rng = createRng(Math.floor(o.seed * 1e6))
      for (let i = 0; i < 3; i++) drawRock(ctx, o.x + rng.range(-8, 8), o.y + rng.range(-7, 7), rng.range(3.5, 6.5), rng, theme)
      break
    }
    case 'rock': {
      const rng = createRng(Math.floor(o.seed * 1e6))
      drawRock(ctx, o.x, o.y + 2, cell * 0.85, rng, theme)
      drawRock(ctx, o.x + cell * 0.55, o.y + cell * 0.45, cell * 0.35, rng, theme)
      break
    }
  }
}

function drawWall(ctx, o, cell, theme, rot) {
  const light = theme === 'desert' ? '#d8bc8c' : '#bdb6a6'
  const dark = theme === 'desert' ? '#8f6d45' : '#6f685c'
  const cells = [...o.cells].sort((a, b) => a.r - b.r || a.c - b.c)
  const rng = createRng(Math.floor(o.seed * 1e6))
  eachCell(ctx, cells, cell, rot, ({ c, r }) => {
    const x = c * cell + 3, y = r * cell + 6, w = cell - 6, h = cell - 12
    ctx.fillStyle = 'rgba(0,0,0,.28)'
    ctx.fillRect(x + 4, y + 6, w, h)
    ctx.fillStyle = dark
    ctx.fillRect(x, y + h - 5, w, 8) // Vorderseite
    ctx.fillStyle = light
    ctx.fillRect(x, y, w, h - 4)
    // Fugen und Zinnen, teils verfallen
    ctx.strokeStyle = 'rgba(60,50,40,.45)'
    ctx.lineWidth = 1
    for (let yy = y + 5; yy < y + h - 4; yy += 6) { ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x + w, yy); ctx.stroke() }
    ctx.fillStyle = light
    for (let i = 0; i < 3; i++) if (rng() < 0.7) ctx.fillRect(x + i * (w / 3) + 1, y - 4, w / 3 - 3, 5)
    ctx.fillStyle = 'rgba(80,110,60,.5)'
    if (rng() < 0.5) circle(ctx, x + rng.range(4, w - 4), y + h - 4, 3, 'rgba(80,120,60,.55)')
  })
}

function drawCliff(ctx, o, cell, theme, rot) {
  const top = theme === 'snow' ? '#e9eef3' : theme === 'desert' ? '#c99b66' : '#8d8a80'
  const side = theme === 'snow' ? '#7f8c99' : theme === 'desert' ? '#8a5f37' : '#55524b'
  const cells = [...o.cells].sort((a, b) => a.r - b.r || a.c - b.c)
  const rng = createRng(Math.floor(o.seed * 1e6))
  const lift = 10
  // Schatten und Seitenwände zuerst, dann die Oberflächen
  eachCell(ctx, cells, cell, rot, ({ c, r }) => {
    const x = c * cell, y = r * cell
    ctx.fillStyle = 'rgba(0,0,0,.3)'
    ctx.fillRect(x + 5, y + 6, cell, cell)
    ctx.fillStyle = side
    ctx.fillRect(x - 1, y - lift + cell * 0.5, cell + 2, cell * 0.5 + lift)
  })
  eachCell(ctx, cells, cell, rot, ({ c, r }) => {
    const x = c * cell, y = r * cell - lift
    const g = ctx.createLinearGradient(x, y, x + cell, y + cell)
    g.addColorStop(0, shadeHex(top, 0.15))
    g.addColorStop(1, shadeHex(top, -0.15))
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.moveTo(x - 1 + rng.range(0, 3), y - 1)
    ctx.lineTo(x + cell + 1 - rng.range(0, 3), y - 1 + rng.range(0, 2))
    ctx.lineTo(x + cell + 1, y + cell * 0.75)
    ctx.lineTo(x - 1, y + cell * 0.75)
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = 'rgba(0,0,0,.18)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(x + rng.range(4, cell - 4), y + 3)
    ctx.lineTo(x + rng.range(4, cell - 4), y + cell * 0.6)
    ctx.stroke()
  })
}

function shadeHex(hex, f) {
  const n = parseInt(hex.slice(1), 16)
  const ch = (v) => Math.max(0, Math.min(255, Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f)))
  return `rgb(${ch((n >> 16) & 255)},${ch((n >> 8) & 255)},${ch(n & 255)})`
}

// ---------- Flüsse und Brücken ----------
function drawRiver(ctx, rv, theme) {
  const ice = rv.frozen || theme === 'snow'
  const line = (w, style) => {
    ctx.strokeStyle = style
    ctx.lineWidth = w
    ctx.lineJoin = ctx.lineCap = 'round'
    ctx.beginPath()
    rv.points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
    ctx.stroke()
  }
  line(rv.width + 10, ice ? 'rgba(120,140,170,.45)' : 'rgba(70,60,35,.45)')
  line(rv.width, ice ? '#bfe1f2' : '#3d8fb0')
  line(rv.width * 0.55, ice ? 'rgba(255,255,255,.55)' : 'rgba(110,195,216,.6)')
  line(2, ice ? 'rgba(255,255,255,.8)' : 'rgba(255,255,255,.35)')
}

function drawBridge(ctx, span, pathWidth) {
  const p = {}
  const half = pathWidth / 2 + 4
  for (let d = span.from; d <= span.to; d += 5) {
    span.route.sample(d, p)
    const nx = -Math.sin(p.angle), ny = Math.cos(p.angle)
    ctx.strokeStyle = (d / 5) % 2 < 1 ? '#8a6136' : '#9c7040'
    ctx.lineWidth = 4.5
    ctx.beginPath()
    ctx.moveTo(p.x + nx * half, p.y + ny * half)
    ctx.lineTo(p.x - nx * half, p.y - ny * half)
    ctx.stroke()
  }
  // Geländer auf beiden Seiten
  for (const side of [1, -1]) {
    ctx.strokeStyle = '#4a321b'
    ctx.lineWidth = 3
    ctx.beginPath()
    for (let d = span.from; d <= span.to; d += 4) {
      span.route.sample(d, p)
      const x = p.x - Math.sin(p.angle) * half * side, y = p.y + Math.cos(p.angle) * half * side
      d === span.from ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
    }
    ctx.stroke()
  }
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

function circle(ctx, x, y, r, fill) {
  ctx.fillStyle = fill
  ctx.beginPath()
  ctx.arc(x, y, r, 0, TAU)
  ctx.fill()
}

// ---------- Boden ----------
function drawGround(ctx, theme, pal, rng) {
  const grad = ctx.createLinearGradient(0, 0, WORLD.width, WORLD.height)
  grad.addColorStop(0, pal.grassLight)
  grad.addColorStop(0.5, pal.grass)
  grad.addColorStop(1, pal.grassDark)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, WORLD.width, WORLD.height)
  // weiche Farbflecken
  for (let i = 0; i < 150; i++) {
    const x = rng() * WORLD.width, y = rng() * WORLD.height, r = rng.range(30, 120)
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    const c = rng() < 0.5 ? pal.grassLight : pal.grassDark
    g.addColorStop(0, hexA(c, theme === 'snow' ? 0.5 : 0.35))
    g.addColorStop(1, hexA(c, 0))
    ctx.fillStyle = g
    ctx.fillRect(x - r, y - r, r * 2, r * 2)
  }
  ctx.lineCap = 'round'
  if (theme === 'desert') {
    // Sandrippel
    ctx.lineWidth = 1.4
    for (let i = 0; i < 260; i++) {
      const x = rng() * WORLD.width, y = rng() * WORLD.height, w = rng.range(14, 40)
      ctx.strokeStyle = rng() < 0.5 ? 'rgba(160,110,50,.22)' : 'rgba(255,240,200,.35)'
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.quadraticCurveTo(x + w / 2, y - 4, x + w, y)
      ctx.stroke()
    }
  } else if (theme === 'snow') {
    // blaue Schattenmulden und Glitzer
    for (let i = 0; i < 70; i++) {
      const x = rng() * WORLD.width, y = rng() * WORLD.height
      ctx.fillStyle = 'rgba(140,170,210,.12)'
      ctx.beginPath()
      ctx.ellipse(x, y, rng.range(20, 60), rng.range(6, 16), rng.range(-0.3, 0.3), 0, TAU)
      ctx.fill()
    }
    for (let i = 0; i < 500; i++) circle(ctx, rng() * WORLD.width, rng() * WORLD.height, rng.range(0.5, 1.3), 'rgba(255,255,255,.9)')
  } else {
    // Grashalme; im Sumpf dazu Matschflecken, im Felsenpass Geröll
    const blades = theme === 'rock' ? 500 : 1000
    for (let i = 0; i < blades; i++) {
      const x = rng() * WORLD.width, y = rng() * WORLD.height
      ctx.strokeStyle = hexA(rng() < 0.5 ? pal.grassLight : pal.grassDark, rng.range(0.35, 0.75))
      ctx.lineWidth = 1.2
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x + rng.range(-2, 2), y - rng.range(3, 7))
      ctx.stroke()
    }
    if (theme === 'swamp') {
      for (let i = 0; i < 40; i++) {
        const x = rng() * WORLD.width, y = rng() * WORLD.height
        ctx.fillStyle = 'rgba(60,50,30,.25)'
        ctx.beginPath()
        ctx.ellipse(x, y, rng.range(15, 45), rng.range(8, 20), rng.range(0, 3), 0, TAU)
        ctx.fill()
      }
    }
    if (theme === 'rock') {
      for (let i = 0; i < 300; i++) circle(ctx, rng() * WORLD.width, rng() * WORLD.height, rng.range(0.8, 2.2), rng() < 0.5 ? 'rgba(90,90,80,.35)' : 'rgba(220,215,200,.3)')
    }
  }
}

// ---------- Gewässer ----------
function drawPond(ctx, p, theme, rng) {
  ctx.save()
  ctx.fillStyle = theme === 'snow' ? 'rgba(120,140,170,.35)' : 'rgba(60,50,30,.35)'
  ctx.beginPath()
  ctx.ellipse(p.x, p.y + 3, p.rx + 8, p.ry + 7, 0, 0, TAU)
  ctx.fill()
  const g = ctx.createRadialGradient(p.x - p.rx * 0.3, p.y - p.ry * 0.3, 4, p.x, p.y, p.rx)
  if (p.ice) { g.addColorStop(0, '#f4fbff'); g.addColorStop(0.7, '#bfe1f2'); g.addColorStop(1, '#8fbcd6') }
  else if (theme === 'swamp') { g.addColorStop(0, '#5f7d5a'); g.addColorStop(0.7, '#3f5a44'); g.addColorStop(1, '#2d4232') }
  else { g.addColorStop(0, '#6ec3d8'); g.addColorStop(0.7, '#3d8fb0'); g.addColorStop(1, '#2f6f8f') }
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.ellipse(p.x, p.y, p.rx, p.ry, 0, 0, TAU)
  ctx.fill()
  ctx.strokeStyle = p.ice ? 'rgba(255,255,255,.8)' : 'rgba(255,255,255,.3)'
  ctx.lineWidth = 1.5
  for (let i = 0; i < 4; i++) {
    const x = p.x + rng.range(-p.rx * 0.5, p.rx * 0.5), y = p.y + rng.range(-p.ry * 0.4, p.ry * 0.4)
    ctx.beginPath()
    if (p.ice) { ctx.moveTo(x - 10, y); ctx.lineTo(x + 6, y - 3); ctx.lineTo(x + 14, y + 2) }
    else ctx.ellipse(x, y, rng.range(8, 18), rng.range(2, 4), 0, 0, Math.PI)
    ctx.stroke()
  }
  if (theme === 'swamp') {
    // Seerosenblätter
    for (let i = 0; i < 6; i++) {
      const a = rng() * TAU, rr = rng.range(0.2, 0.75)
      const x = p.x + Math.cos(a) * p.rx * rr, y = p.y + Math.sin(a) * p.ry * rr
      ctx.fillStyle = '#5c8f3e'
      ctx.beginPath()
      ctx.arc(x, y, 5, 0.4, TAU - 0.1)
      ctx.lineTo(x, y)
      ctx.fill()
      if (rng() < 0.4) circle(ctx, x + 1, y - 1, 1.8, '#f2b6d0')
    }
  }
  if (!p.ice) {
    ctx.strokeStyle = theme === 'desert' ? '#6f8f3a' : '#3f6b2c'
    ctx.lineWidth = 2
    for (let i = 0; i < 12; i++) {
      const a = rng.range(0, TAU)
      const x = p.x + Math.cos(a) * p.rx * 0.95, y = p.y + Math.sin(a) * p.ry * 0.95
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x + rng.range(-3, 3), y - rng.range(8, 14))
      ctx.stroke()
    }
  }
  ctx.restore()
}

// ---------- Wege ----------
function drawPaths(ctx, game, theme, pal, rng) {
  const pw = game.map.pathWidth
  const stroke = (width, style) => {
    ctx.strokeStyle = style
    ctx.lineWidth = width
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    for (const r of game.routes) {
      const pts = r.points
      ctx.beginPath()
      ctx.moveTo(pts[0][0], pts[0][1])
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1])
      ctx.stroke()
    }
  }
  // Alle Wege schichtweise, damit Gabelungen nahtlos ineinander übergehen
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,.25)'
  ctx.shadowBlur = 10
  stroke(pw + 12, hexA(pal.pathEdge, 0.55))
  ctx.restore()
  stroke(pw + 4, pal.pathEdge)
  stroke(pw - 2, pal.path)
  stroke(pw * 0.45, hexA('#ffffff', theme === 'snow' ? 0.18 : 0.09))

  const p = {}
  for (const route of game.routes) {
    for (let d = 0; d < route.length; d += theme === 'rock' ? 9 : 4) {
      route.sample(d, p)
      const nx = -Math.sin(p.angle), ny = Math.cos(p.angle)
      if (theme === 'rock') {
        // Pflastersteine
        for (const off of [-pw * 0.3, 0, pw * 0.3]) {
          const o = off + rng.range(-3, 3)
          const x = p.x + nx * o, y = p.y + ny * o
          ctx.fillStyle = rng() < 0.5 ? 'rgba(120,110,95,.45)' : 'rgba(230,220,200,.3)'
          ctx.beginPath()
          ctx.ellipse(x, y, rng.range(3.5, 6), rng.range(3, 4.5), p.angle, 0, TAU)
          ctx.fill()
        }
      } else if (theme === 'swamp' && d % 16 < 4) {
        // Holzbohlen quer zum Weg
        ctx.strokeStyle = rng() < 0.5 ? 'rgba(90,65,40,.55)' : 'rgba(120,90,55,.5)'
        ctx.lineWidth = 5
        ctx.beginPath()
        ctx.moveTo(p.x + nx * (pw / 2 - 4), p.y + ny * (pw / 2 - 4))
        ctx.lineTo(p.x - nx * (pw / 2 - 4), p.y - ny * (pw / 2 - 4))
        ctx.stroke()
      } else {
        const off = rng.range(-pw / 2 + 4, pw / 2 - 4)
        const x = p.x + nx * off, y = p.y + ny * off
        circle(ctx, x, y, rng.range(0.8, 2.2), rng() < 0.5 ? hexA(pal.pathEdge, 0.25) : hexA('#ffffff', 0.14))
      }
      if (theme === 'snow' && rng() < 0.5) {
        // Schneewehen am Wegrand
        const side = rng() < 0.5 ? 1 : -1
        circle(ctx, p.x + nx * side * (pw / 2 + 2), p.y + ny * side * (pw / 2 + 2), rng.range(3, 6), 'rgba(255,255,255,.85)')
      }
    }
  }
}

// ---------- Deko ----------
function drawRock(ctx, x, y, r, rng, theme) {
  ctx.fillStyle = 'rgba(0,0,0,.22)'
  ctx.beginPath()
  ctx.ellipse(x + 3, y + 3, r * 1.1, r * 0.7, 0, 0, TAU)
  ctx.fill()
  const g = ctx.createLinearGradient(x - r, y - r, x + r, y + r)
  if (theme === 'desert') { g.addColorStop(0, '#d9a877'); g.addColorStop(1, '#8f5f38') }
  else { g.addColorStop(0, '#bdbcb4'); g.addColorStop(1, '#6a6963') }
  ctx.fillStyle = g
  ctx.beginPath()
  const n = 7
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU
    const rr = r * rng.range(0.75, 1.05)
    const px = x + Math.cos(a) * rr * 1.15, py = y + Math.sin(a) * rr * 0.8
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)
  }
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,.25)'
  ctx.beginPath()
  ctx.ellipse(x - r * 0.3, y - r * 0.3, r * 0.4, r * 0.22, -0.4, 0, TAU)
  ctx.fill()
  if (theme === 'snow') {
    ctx.fillStyle = 'rgba(255,255,255,.95)'
    ctx.beginPath()
    ctx.ellipse(x - r * 0.1, y - r * 0.35, r * 0.85, r * 0.35, 0, 0, TAU)
    ctx.fill()
  }
}

function treeShadow(ctx, x, y, r) {
  ctx.fillStyle = 'rgba(0,0,0,.26)'
  ctx.beginPath()
  ctx.ellipse(x + r * 0.45, y + r * 0.5, r * 1.05, r * 0.7, 0.2, 0, TAU)
  ctx.fill()
}

function drawTree(ctx, t) {
  const { x, y, r } = t
  treeShadow(ctx, x, y, r)
  const dark = t.seed < 0.35 ? '#2f5a2a' : t.seed < 0.7 ? '#356b2f' : '#2b5236'
  const mid = t.seed < 0.35 ? '#467d38' : t.seed < 0.7 ? '#4f8c3e' : '#3f7046'
  const light = t.seed < 0.35 ? '#78b05a' : t.seed < 0.7 ? '#86bd60' : '#6aa070'
  // Stamm unten sichtbar
  ctx.fillStyle = '#5a3e24'
  ctx.fillRect(x - 2.5, y + r * 0.2, 5, r * 0.55)
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + t.seed * 6
    circle(ctx, x + Math.cos(a) * r * 0.45, y + Math.sin(a) * r * 0.38 - r * 0.15, r * 0.6, dark)
  }
  circle(ctx, x - r * 0.08, y - r * 0.25, r * 0.7, mid)
  const g = ctx.createRadialGradient(x - r * 0.4, y - r * 0.6, 1, x - r * 0.2, y - r * 0.3, r * 0.8)
  g.addColorStop(0, light)
  g.addColorStop(1, hexA(light, 0))
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(x - r * 0.2, y - r * 0.35, r * 0.75, 0, TAU)
  ctx.fill()
}

function drawPine(ctx, t, snowy) {
  const { x, y } = t
  const r = t.r * 0.85
  treeShadow(ctx, x, y, r)
  ctx.fillStyle = '#4a3220'
  ctx.fillRect(x - 2, y + r * 0.3, 4, r * 0.5)
  const layers = 3
  for (let i = 0; i < layers; i++) {
    const w = r * (1.05 - i * 0.28), top = y - r * (0.15 + i * 0.55), bottom = y + r * (0.45 - i * 0.45)
    ctx.fillStyle = i % 2 ? '#2f5a3a' : '#264d33'
    ctx.beginPath()
    ctx.moveTo(x, top - r * 0.5)
    ctx.lineTo(x + w, bottom)
    ctx.lineTo(x - w, bottom)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,.08)'
    ctx.beginPath()
    ctx.moveTo(x, top - r * 0.5)
    ctx.lineTo(x - w, bottom)
    ctx.lineTo(x - w * 0.3, bottom)
    ctx.closePath()
    ctx.fill()
    if (snowy) {
      ctx.fillStyle = 'rgba(255,255,255,.92)'
      ctx.beginPath()
      ctx.moveTo(x, top - r * 0.5)
      ctx.lineTo(x + w * 0.55, top + r * 0.15)
      ctx.quadraticCurveTo(x, top + r * 0.32, x - w * 0.55, top + r * 0.15)
      ctx.closePath()
      ctx.fill()
    }
  }
}

function drawDeadTree(ctx, t) {
  const { x, y, r } = t
  treeShadow(ctx, x, y, r * 0.6)
  ctx.strokeStyle = '#4b3b2b'
  ctx.lineCap = 'round'
  const branch = (bx, by, a, len, w, depth) => {
    const ex = bx + Math.cos(a) * len, ey = by + Math.sin(a) * len
    ctx.lineWidth = w
    ctx.beginPath()
    ctx.moveTo(bx, by)
    ctx.lineTo(ex, ey)
    ctx.stroke()
    if (depth > 0) {
      branch(ex, ey, a - 0.5 - t.seed * 0.3, len * 0.65, w * 0.65, depth - 1)
      branch(ex, ey, a + 0.45, len * 0.6, w * 0.6, depth - 1)
    }
  }
  branch(x, y + r * 0.4, -Math.PI / 2, r * 0.9, 4, 3)
}

function drawWillow(ctx, t) {
  const { x, y, r } = t
  treeShadow(ctx, x, y, r)
  circle(ctx, x, y - r * 0.2, r * 0.85, '#3b5a35')
  ctx.strokeStyle = '#6c8f4c'
  ctx.lineWidth = 1.5
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU
    const sx = x + Math.cos(a) * r * 0.5, sy = y - r * 0.2 + Math.sin(a) * r * 0.45
    ctx.beginPath()
    ctx.moveTo(sx, sy)
    ctx.quadraticCurveTo(sx + Math.cos(a) * r * 0.4, sy, sx + Math.cos(a) * r * 0.5, sy + r * 0.55)
    ctx.stroke()
  }
  circle(ctx, x - r * 0.25, y - r * 0.45, r * 0.35, 'rgba(150,190,110,.35)')
}

function drawCactus(ctx, t) {
  const { x, y } = t
  const r = t.r * 0.7
  ctx.fillStyle = 'rgba(0,0,0,.22)'
  ctx.beginPath()
  ctx.ellipse(x + r * 0.5, y + r * 0.6, r * 0.8, r * 0.3, 0.2, 0, TAU)
  ctx.fill()
  ctx.lineCap = 'round'
  ctx.strokeStyle = '#3f7a3c'
  ctx.lineWidth = r * 0.45
  ctx.beginPath()
  ctx.moveTo(x, y + r * 0.6); ctx.lineTo(x, y - r * 0.9)
  ctx.moveTo(x, y); ctx.lineTo(x - r * 0.5, y); ctx.lineTo(x - r * 0.5, y - r * 0.5)
  ctx.moveTo(x, y - r * 0.2); ctx.lineTo(x + r * 0.45, y - r * 0.2); ctx.lineTo(x + r * 0.45, y - r * 0.65)
  ctx.stroke()
  ctx.strokeStyle = 'rgba(200,240,170,.35)'
  ctx.lineWidth = r * 0.1
  ctx.beginPath()
  ctx.moveTo(x - r * 0.08, y + r * 0.5); ctx.lineTo(x - r * 0.08, y - r * 0.8)
  ctx.stroke()
  if (t.seed < 0.3) circle(ctx, x, y - r * 0.95, r * 0.15, '#f27aa0')
}

function drawPalm(ctx, t) {
  const { x, y, r } = t
  treeShadow(ctx, x, y, r * 0.8)
  ctx.strokeStyle = '#8a6a3f'
  ctx.lineWidth = 3.5
  ctx.beginPath()
  ctx.moveTo(x, y + r * 0.4)
  ctx.quadraticCurveTo(x + r * 0.2, y - r * 0.1, x + r * 0.05, y - r * 0.5)
  ctx.stroke()
  const cx = x + r * 0.05, cy = y - r * 0.5
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU + t.seed
    ctx.strokeStyle = i % 2 ? '#3f8a3a' : '#2f6e2e'
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.quadraticCurveTo(cx + Math.cos(a) * r * 0.6, cy + Math.sin(a) * r * 0.4 - 4, cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.6 + 3)
    ctx.stroke()
  }
}

function drawReeds(ctx, x, y, rng) {
  ctx.strokeStyle = '#6b7f3c'
  ctx.lineWidth = 1.4
  for (let i = 0; i < 5; i++) {
    const ox = rng.range(-5, 5)
    ctx.beginPath()
    ctx.moveTo(x + ox, y)
    ctx.lineTo(x + ox + rng.range(-3, 3), y - rng.range(8, 15))
    ctx.stroke()
  }
  circle(ctx, x, y - 13, 2, '#6b4a2a')
}

function drawDryBush(ctx, x, y, rng) {
  ctx.strokeStyle = '#8a6a3a'
  ctx.lineWidth = 1.2
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI / 2 + rng.range(-1.2, 1.2)
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + Math.cos(a) * rng.range(5, 10), y + Math.sin(a) * rng.range(5, 10))
    ctx.stroke()
  }
}

function drawSnowTuft(ctx, x, y, rng) {
  ctx.fillStyle = 'rgba(160,185,215,.35)'
  ctx.beginPath()
  ctx.ellipse(x + 2, y + 2, rng.range(6, 12), 3, 0, 0, TAU)
  ctx.fill()
  circle(ctx, x, y, rng.range(3, 5), '#ffffff')
}

function drawSpawn(ctx, route) {
  // Punkt, an dem die Route ins Bild kommt: dunkle Höhlenöffnung
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
  ctx.arc(-20, 0, 70, 0, TAU)
  ctx.fill()
  ctx.restore()
}
