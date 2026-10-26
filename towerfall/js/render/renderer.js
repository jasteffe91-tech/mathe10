// Zeichnet den Spielzustand auf das Canvas. Die Spielwelt hat feste Koordinaten (1280 × 720);
// der Renderer skaliert sie passend ins Canvas (Letterbox) und berücksichtigt die Pixeldichte.
// In hohen, schmalen Spielflächen (Smartphone hochkant) dreht er die Karte um 90°, damit sie die
// Fläche besser ausnutzt. Alle Umrechnungen Bildschirm ↔ Welt laufen über dieselbe Transformation
// (viewMatrix); Eingaben, Lupe und Zeichnen sehen also immer dieselbe Lage.
import { WORLD } from '../config/maps.js'
import { TOWERS } from '../config/towers.js'
import { lerp } from '../core/math.js'
import { renderTerrain } from './terrain.js'
import { createRng } from '../core/rng.js'
import { drawTower, drawEnemy, drawHealthBar, drawProjectile, drawBastion, drawSilenced, view as spriteView } from './sprites.js'
import { Effects } from './effects.js'

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this.effects = new Effects()
    this.game = null
    this.terrain = null
    this.terrainKey = ''
    this.scale = 1
    this.offsetX = 0
    this.offsetY = 0
    this.rot = 0            // 0 oder 1 (Viertelumdrehung im Uhrzeigersinn)
    this.rotateMode = 'auto' // 'auto' | 'off'
    this.dpr = 1
    this.time = 0
    this.reduced = false
    this.detach = null
    this.sorted = []
  }

  setGame(game) {
    if (this.detach) this.detach()
    this.game = game
    this.effects.clear()
    this.detach = this.effects.attach(game)
    this.terrain = null
    this.terrainKey = ''
    this.ambient = makeAmbient(game.map.theme || 'meadow', game.map.seed)
    this.resize()
  }

  setReducedMotion(on) {
    this.reduced = on
    this.effects.reduced = on
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect()
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5)
    const w = Math.max(1, Math.round(rect.width * dpr))
    const h = Math.max(1, Math.round(rect.height * dpr))
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w
      this.canvas.height = h
    }
    this.dpr = dpr
    const flat = Math.min(rect.width / WORLD.width, rect.height / WORLD.height)
    const turned = Math.min(rect.width / WORLD.height, rect.height / WORLD.width)
    // drehen nur, wenn es deutlich mehr Fläche bringt (sonst springt die Ansicht unnötig)
    this.rot = this.rotateMode !== 'off' && turned > flat * 1.15 ? 1 : 0
    this.scale = this.rot ? turned : flat
    const vw = this.rot ? WORLD.height : WORLD.width, vh = this.rot ? WORLD.width : WORLD.height
    this.offsetX = (rect.width - vw * this.scale) / 2
    this.offsetY = (rect.height - vh * this.scale) / 2
    this.visible = rect.width > 0 && rect.height > 0
    this.ensureTerrain()
  }

  setRotateMode(mode) {
    if (this.rotateMode === mode) return
    this.rotateMode = mode
    this.resize()
  }

  // Abbildung Welt → CSS-Pixel im Canvas: [a, b, c, d, e, f] wie bei ctx.setTransform
  //   x' = a·x + c·y + e,  y' = b·x + d·y + f
  // Gedreht (90° im Uhrzeigersinn): Welt-x zeigt nach unten, Welt-y nach links.
  viewMatrix(shakeX = 0, shakeY = 0) {
    const s = this.scale
    if (this.rot) return [0, s, -s, 0, this.offsetX + WORLD.height * s + shakeX, this.offsetY + shakeY]
    return [s, 0, 0, s, this.offsetX + shakeX, this.offsetY + shakeY]
  }

  // Weltkoordinaten → CSS-Pixel relativ zum Canvas
  worldToCanvas(x, y) {
    const [a, b, c, d, e, f] = this.viewMatrix()
    return { x: a * x + c * y + e, y: b * x + d * y + f }
  }

  // CSS-Pixel relativ zum Canvas → Weltkoordinaten
  canvasToWorld(px, py) {
    const s = this.scale
    if (this.rot) return { x: (py - this.offsetY) / s, y: (this.offsetX + WORLD.height * s - px) / s }
    return { x: (px - this.offsetX) / s, y: (py - this.offsetY) / s }
  }

  // Richtung auf dem Bildschirm (Pfeiltasten, Pfeilknöpfe) → Zellschritt in der Welt
  screenStepToWorld(dx, dy) { return this.rot ? { dc: dy, dr: -dx } : { dc: dx, dr: dy } }

  // Sichtbare Kartenfläche in CSS-Pixeln (Viewport-Koordinaten)
  mapRect() {
    const r = this.canvas.getBoundingClientRect()
    const vw = (this.rot ? WORLD.height : WORLD.width) * this.scale, vh = (this.rot ? WORLD.width : WORLD.height) * this.scale
    return { x: r.left + this.offsetX, y: r.top + this.offsetY, width: vw, height: vh, rotated: !!this.rot }
  }

  // Hintergrund nur neu zeichnen, wenn sich Auflösung oder Hindernisse ändern (z. B. nach dem Räumen)
  ensureTerrain() {
    const game = this.game
    if (!game || !this.visible) return // unsichtbares Canvas: ein leeres Bild ließe sich nicht zeichnen
    const px = Math.min(2.5, this.scale * this.dpr)
    const key = `${game.map.id}:${game.mode.id}:${px.toFixed(2)}:${game.obstacles.size}:${this.rot}`
    if (key !== this.terrainKey) {
      this.terrain = renderTerrain(game, px, this.rot ? Math.PI / 2 : 0)
      this.terrainKey = key
    }
  }

  // Bildschirmkoordinaten (clientX/Y) → Weltkoordinaten
  toWorld(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect()
    return this.canvasToWorld(clientX - rect.left, clientY - rect.top)
  }

  // Wie viele Weltpixel entsprechen einem CSS-Pixel? (für Fingertipp-Toleranzen)
  get worldPerCssPx() { return 1 / this.scale }

  render(alpha, view, visualDt) {
    const { ctx, game } = this
    if (!game) return
    this.time += visualDt
    this.effects.update(visualDt)
    const t = this.time

    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.fillStyle = '#0d1118'
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)
    let sx = 0, sy = 0
    if (this.effects.shake > 0) {
      sx = (Math.random() - 0.5) * this.effects.shake
      sy = (Math.random() - 0.5) * this.effects.shake
    }
    const d = this.dpr
    ctx.setTransform(...this.viewMatrix(sx, sy).map((v) => v * d))
    spriteView.rot = this.rot ? Math.PI / 2 : 0
    ctx.save()
    ctx.beginPath()
    ctx.rect(0, 0, WORLD.width, WORLD.height)
    ctx.clip()

    this.ensureTerrain()
    if (this.terrain) {
      if (this.rot) {
        // Hintergrund liegt schon gedreht vor: achsenparallel kopieren
        ctx.save()
        const k = this.scale * d
        ctx.setTransform(k, 0, 0, k, (this.offsetX + sx) * d, (this.offsetY + sy) * d)
        ctx.drawImage(this.terrain, 0, 0, WORLD.height, WORLD.width)
        ctx.restore()
      } else ctx.drawImage(this.terrain, 0, 0, WORLD.width, WORLD.height)
    }

    this.drawBuildOverlay(view)
    this.drawFlightLines(t)
    this.drawFoundations(view)
    this.drawAuras(view, t)
    drawBastion(ctx, game.map.base, game.lives / game.maxLives, t, this.reduced)
    this.drawRanges(view)

    // Türme und Gegner nach y sortiert zeichnen, damit Überlappungen stimmen
    const list = this.sorted
    list.length = 0
    for (const tw of game.towers) list.push(tw)
    for (const e of game.enemies) list.push(e)
    // Tiefe = Bildschirm-y (in der gedrehten Ansicht entspricht das Welt-x)
    if (this.rot) list.sort((a, b) => a.x - b.x)
    else list.sort((a, b) => a.y - b.y)
    for (const o of list) {
      if (o.def.levels) {
        drawTower(ctx, o, o.x, o.y, t)
        if (o.silenced > 0) drawSilenced(ctx, o, o.x, o.y, t)
      } else {
        const x = lerp(o.px, o.x, alpha), y = lerp(o.py, o.y, alpha)
        drawEnemy(ctx, o, x, y, t)
      }
    }
    for (const e of game.enemies) {
      if (e.hp < e.maxHp || e.boss) drawHealthBar(ctx, e, lerp(e.px, e.x, alpha), lerp(e.py, e.y, alpha))
    }
    for (const p of game.projectiles) drawProjectile(ctx, p, lerp(p.px, p.x, alpha), lerp(p.py, p.y, alpha))

    this.effects.draw(ctx)
    this.drawAmbient(t)
    this.drawPreview(view)
    ctx.restore()
    this.drawBossBar()
  }

  // Raster im Bau- oder Versetzmodus: freie Bauzellen mit feinen Linien, Zonen außerhalb abgedunkelt.
  // Als Bild zwischengespeichert und nur bei Änderungen am Raster (grid.version) neu erzeugt.
  drawBuildOverlay(view) {
    const { ctx, game } = this
    const grid = game.grid
    if (view.placing) {
      if (!this.overlay || this.overlayVersion !== grid.version || this.overlayRot !== this.rot) {
        this.overlay = makeOverlay(game, this.rot)
        this.overlayVersion = grid.version
        this.overlayRot = this.rot
      }
      if (this.rot) {
        // wie der Hintergrund schon in Bildschirmlage erzeugt: achsenparallel kopieren
        ctx.save()
        const k = this.scale * this.dpr
        ctx.setTransform(k, 0, 0, k, this.offsetX * this.dpr, this.offsetY * this.dpr)
        ctx.drawImage(this.overlay, 0, 0, WORLD.height, WORLD.width)
        ctx.restore()
      } else ctx.drawImage(this.overlay, 0, 0, WORLD.width, WORLD.height)
    }
    // ausgewähltes Hindernis hervorheben
    if (view.obstacle) {
      ctx.strokeStyle = view.obstacle.def.removable ? '#ffd257' : '#ec5a4f'
      ctx.lineWidth = 2
      ctx.setLineDash([5, 4])
      for (const { c, r } of view.obstacle.cells) ctx.strokeRect(c * grid.cell + 1, r * grid.cell + 1, grid.cell - 2, grid.cell - 2)
      ctx.setLineDash([])
    }
  }

  // Fluglinien der Harpyien: gestrichelt, sobald Flieger angekündigt oder unterwegs sind
  drawFlightLines(t) {
    const { ctx, game } = this
    if (!game.flightRoutes?.length) return
    const air = game.enemies.some((e) => e.def.flying) || game.nextWavePreview()?.counts.harpy
    if (!air) return
    ctx.save()
    ctx.strokeStyle = 'rgba(200,180,255,.45)'
    ctx.lineWidth = 2
    ctx.setLineDash([10, 10])
    ctx.lineDashOffset = -t * 20
    for (const f of game.flightRoutes) {
      const [a, b] = f.points
      ctx.beginPath()
      ctx.moveTo(a[0], a[1])
      ctx.lineTo(b[0], b[1])
      ctx.stroke()
    }
    ctx.restore()
  }

  // Fundament unter jedem Turm zeigt seine belegte Grundfläche; Auswahl hervorgehoben
  drawFoundations(view) {
    const { ctx, game } = this
    const cell = game.grid.cell
    for (const tw of game.towers) {
      const sel = tw === view.tower
      const moving = tw === view.moving
      ctx.fillStyle = moving ? 'rgba(106,180,234,.18)' : 'rgba(30,24,16,.22)'
      roundRect(ctx, tw.c * cell + 2, tw.r * cell + 2, tw.w * cell - 4, tw.h * cell - 4, 6)
      ctx.fill()
      if (sel || moving) {
        ctx.strokeStyle = moving ? '#6ab4ea' : '#ffd257'
        ctx.lineWidth = 2
        ctx.stroke()
      }
    }
  }

  drawRanges(view) {
    const { ctx, game } = this
    const circle = (x, y, r, color, fill) => {
      ctx.fillStyle = fill
      ctx.strokeStyle = color
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
    }
    if (view.showAllRanges) {
      for (const tw of game.towers) {
        ctx.strokeStyle = 'rgba(255,255,255,.18)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.arc(tw.x, tw.y, tw.stats.range, 0, Math.PI * 2)
        ctx.stroke()
      }
    }
    if (view.tower && view.tower !== view.moving) {
      const tw = view.tower
      const r = tw.stats.range
      circle(tw.x, tw.y, r, 'rgba(255,236,170,.75)', 'rgba(255,236,170,.08)')
      const next = tw.def.levels[tw.level + 1]
      if (next && next.range > r && view.upgradeHover) {
        ctx.setLineDash([6, 6])
        ctx.strokeStyle = 'rgba(140,230,140,.8)'
        ctx.beginPath()
        ctx.arc(tw.x, tw.y, next.range, 0, Math.PI * 2)
        ctx.stroke()
        ctx.setLineDash([])
      }
      // Schussrichtung andeuten
      if (tw.aim && tw.aim.alive) {
        ctx.strokeStyle = 'rgba(255,236,170,.35)'
        ctx.setLineDash([3, 6])
        ctx.beginPath()
        ctx.moveTo(tw.x, tw.y)
        ctx.lineTo(tw.aim.x, tw.aim.y)
        ctx.stroke()
        ctx.setLineDash([])
      }
    }
  }

  // Kriegsbanner: dezenter Bodenring; bei Auswahl Linien zu den verstärkten Türmen
  drawAuras(view, t) {
    const { ctx, game } = this
    for (const tw of game.towers) {
      if (tw.def.attack !== 'aura') continue
      const r = tw.def.levels[tw.level].range
      const pulse = this.reduced ? 0.5 : 0.5 + Math.sin(t * 2 + tw.id) * 0.2
      ctx.strokeStyle = `rgba(242,193,78,${0.18 * pulse + 0.06})`
      ctx.lineWidth = 2
      ctx.setLineDash([4, 8])
      ctx.beginPath()
      ctx.arc(tw.x, tw.y, r, 0, Math.PI * 2)
      ctx.stroke()
      ctx.setLineDash([])
    }
    const sel = view.tower
    if (!sel) return
    ctx.lineWidth = 2
    for (const tw of game.towers) {
      const from = tw.buff?.from
      if (!from || (from !== sel && tw !== sel)) continue
      ctx.strokeStyle = 'rgba(255,207,138,.7)'
      ctx.setLineDash([5, 5])
      ctx.beginPath()
      ctx.moveTo(from.x, from.y)
      ctx.lineTo(tw.x, tw.y)
      ctx.stroke()
      ctx.setLineDash([])
    }
  }

  // Atmosphäre: Wolkenschatten, Schneefall, Nebel und Glühwürmchen (bei reduzierter Bewegung aus)
  drawAmbient(t) {
    if (this.reduced || !this.ambient) return
    const { ctx } = this
    const W = WORLD.width, H = WORLD.height
    const a = this.ambient
    for (const c of a.clouds) {
      const x = ((c.x + t * c.speed) % (W + 700)) - 350
      const g = ctx.createRadialGradient(x, c.y, 0, x, c.y, c.r)
      g.addColorStop(0, `rgba(${c.color},${c.alpha})`)
      g.addColorStop(1, `rgba(${c.color},0)`)
      ctx.fillStyle = g
      ctx.save()
      ctx.translate(x, c.y)
      ctx.scale(1.8, 1)
      ctx.translate(-x, -c.y)
      ctx.beginPath()
      ctx.arc(x, c.y, c.r, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }
    if (a.flakes.length) {
      // Schnee fällt auf dem Bildschirm nach unten – in der gedrehten Ansicht also entlang Welt-x
      ctx.fillStyle = 'rgba(255,255,255,.85)'
      for (const f of a.flakes) {
        const fall = (f.y + t * f.speed) % (H + 20) - 10
        const drift = (f.x + Math.sin(t * f.sway + f.phase) * 12 + t * 8) % W
        if (this.rot) ctx.fillRect(fall * (W / H), H - drift * (H / W), f.size, f.size)
        else ctx.fillRect(drift, fall, f.size, f.size)
      }
    }
    if (a.flies.length) {
      ctx.globalCompositeOperation = 'lighter'
      for (const f of a.flies) {
        const x = f.x + Math.sin(t * f.sx + f.phase) * 30
        const y = f.y + Math.cos(t * f.sy + f.phase) * 20
        const k = 0.35 + 0.35 * Math.sin(t * 3 + f.phase)
        const g = ctx.createRadialGradient(x, y, 0, x, y, 7)
        g.addColorStop(0, `rgba(220,255,140,${k})`)
        g.addColorStop(1, 'rgba(220,255,140,0)')
        ctx.fillStyle = g
        ctx.fillRect(x - 7, y - 7, 14, 14)
      }
      ctx.globalCompositeOperation = 'source-over'
    }
  }

  // Platzierungsvorschau: belegte Zellen grün (gültig) bzw. rot (ungültig), halbtransparenter Turm,
  // Reichweite und – je nach Turm – Mindestreichweite oder die Türme, die ein Banner verstärken würde
  drawPreview(view) {
    const { ctx, game } = this
    const p = view.preview
    if (!p) return
    const cell = game.grid.cell
    const def = TOWERS[p.type]
    const badSet = new Set(p.bad.map((b) => `${b.c},${b.r}`))
    for (const c of p.cells) {
      const bad = badSet.has(`${c.c},${c.r}`)
      ctx.fillStyle = bad ? 'rgba(236,90,79,.45)' : p.goldOk ? 'rgba(107,209,106,.38)' : 'rgba(242,193,78,.4)'
      ctx.strokeStyle = bad ? '#ec5a4f' : p.goldOk ? '#6bd16a' : '#f2c14e'
      ctx.lineWidth = 1.5
      ctx.fillRect(c.c * cell + 1, c.r * cell + 1, cell - 2, cell - 2)
      ctx.strokeRect(c.c * cell + 1, c.r * cell + 1, cell - 2, cell - 2)
    }
    const range = p.range
    const ok = p.ok && p.goldOk
    ctx.fillStyle = ok ? 'rgba(140,230,140,.08)' : 'rgba(240,90,80,.07)'
    ctx.strokeStyle = ok ? 'rgba(140,230,140,.85)' : 'rgba(240,90,80,.75)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(p.x, p.y, range, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    const minRange = def.levels[p.level || 0].minRange
    if (minRange) {
      ctx.setLineDash([4, 5])
      ctx.strokeStyle = 'rgba(240,90,80,.75)'
      ctx.beginPath()
      ctx.arc(p.x, p.y, minRange, 0, Math.PI * 2)
      ctx.stroke()
      ctx.setLineDash([])
    }
    if (def.attack === 'aura') {
      ctx.strokeStyle = 'rgba(255,207,138,.75)'
      ctx.setLineDash([5, 5])
      for (const tw of game.towers) {
        if (tw === view.moving || tw.def.attack === 'aura') continue
        if ((tw.x - p.x) ** 2 + (tw.y - p.y) ** 2 > range * range) continue
        ctx.beginPath()
        ctx.moveTo(p.x, p.y)
        ctx.lineTo(tw.x, tw.y)
        ctx.stroke()
      }
      ctx.setLineDash([])
    }
    ctx.globalAlpha = p.ok ? 0.75 : 0.45
    drawTower(ctx, { type: p.type, level: p.level || 0, angle: -Math.PI / 4, fireAnim: 0, rot: p.rot, noPips: true }, p.x, p.y, this.time)
    ctx.globalAlpha = 1
  }

  // Bossleiste in Bildschirmpixeln über dem oberen Kartenrand (gut lesbar, auch auf dem Smartphone)
  drawBossBar() {
    const { ctx, game } = this
    let boss = null
    for (const e of game.enemies) if (e.boss && (!boss || e.hp > boss.hp)) boss = e
    if (!boss) return
    const d = this.dpr
    ctx.setTransform(d, 0, 0, d, 0, 0)
    const mapW = (this.rot ? WORLD.height : WORLD.width) * this.scale
    const w = Math.min(420, mapW - 24), h = 9, x = this.offsetX + (mapW - w) / 2, y = this.offsetY + 8
    const f = Math.max(0, boss.hp / boss.maxHp)
    ctx.fillStyle = 'rgba(12,10,18,.8)'
    roundRect(ctx, x - 6, y - 4, w + 12, h + 26, 8)
    ctx.fill()
    ctx.fillStyle = '#3a1d22'
    ctx.fillRect(x, y + 15, w, h)
    const g = ctx.createLinearGradient(x, 0, x + w, 0)
    g.addColorStop(0, boss.enraged ? '#ff6a3a' : '#c0392b')
    g.addColorStop(1, boss.enraged ? '#ffb347' : '#e74c3c')
    ctx.fillStyle = g
    ctx.fillRect(x, y + 15, w * f, h)
    ctx.strokeStyle = '#ffd257'
    ctx.lineWidth = 1
    ctx.strokeRect(x, y + 15, w, h)
    ctx.font = 'bold 12px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillStyle = '#ffe9b0'
    ctx.fillText(`${boss.def.name}${boss.enraged ? ' – wütend!' : ''}  ·  ${Math.ceil(boss.hp)} / ${boss.maxHp}`, x + w / 2, y + 10, w)
  }
}

// Raster-Overlay als Bild: freie Bauzellen umrandet, Zellen außerhalb der Bauzone abgedunkelt,
// räumbare Hindernisse gestrichelt markiert
function makeOverlay(game, rot = 0) {
  const { grid } = game
  const w = rot ? WORLD.height : WORLD.width, h = rot ? WORLD.width : WORLD.height
  const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h })
  const ctx = c.getContext('2d')
  if (rot) ctx.setTransform(0, 1, -1, 0, WORLD.height, 0)
  const cell = grid.cell
  for (let r = 0; r < grid.rows; r++) {
    for (let col = 0; col < grid.cols; col++) {
      const i = grid.idx(col, r)
      const kind = grid.terrain[i]
      const x = col * cell, y = r * cell
      if (kind === 'outside') {
        ctx.fillStyle = 'rgba(10,12,20,.35)'
        ctx.fillRect(x, y, cell, cell)
      } else if (kind === 'grass' && !grid.tower[i]) {
        if (grid.obstacle[i]) {
          const o = game.obstacles.get(grid.obstacle[i])
          ctx.strokeStyle = o?.def.removable ? 'rgba(242,193,78,.45)' : 'rgba(236,90,79,.4)'
          ctx.setLineDash([3, 3])
          ctx.strokeRect(x + 2.5, y + 2.5, cell - 5, cell - 5)
          ctx.setLineDash([])
        } else {
          ctx.fillStyle = 'rgba(255,255,255,.05)'
          ctx.fillRect(x + 1, y + 1, cell - 2, cell - 2)
          ctx.strokeStyle = 'rgba(255,255,255,.22)'
          ctx.lineWidth = 1
          ctx.strokeRect(x + 0.5, y + 0.5, cell - 1, cell - 1)
        }
      }
    }
  }
  return c
}

// Vorberechnete Atmosphäre-Teilchen je Thema (keine Objekte pro Frame)
function makeAmbient(theme, seed) {
  const rng = createRng(seed * 31 + 7)
  const clouds = [], flakes = [], flies = []
  const cloudColor = theme === 'swamp' ? '235,240,235' : '0,0,0'
  const cloudAlpha = theme === 'swamp' ? 0.1 : theme === 'snow' ? 0.04 : 0.07
  const n = theme === 'swamp' ? 4 : 3
  for (let i = 0; i < n; i++) clouds.push({ x: rng() * 1900, y: rng() * 720, r: rng.range(110, 190), speed: rng.range(6, 14), color: cloudColor, alpha: cloudAlpha })
  if (theme === 'snow') for (let i = 0; i < 90; i++) flakes.push({ x: rng() * 1280, y: rng() * 740, speed: rng.range(18, 45), sway: rng.range(0.5, 1.5), phase: rng() * 6, size: rng.range(1.5, 3.2) })
  if (theme === 'swamp') for (let i = 0; i < 26; i++) flies.push({ x: rng() * 1280, y: rng() * 720, sx: rng.range(0.2, 0.6), sy: rng.range(0.2, 0.6), phase: rng() * 6 })
  return { clouds, flakes, flies }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}
