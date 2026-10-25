// Zeichnet den Spielzustand auf das Canvas. Die Spielwelt hat feste Koordinaten (1280 × 720);
// der Renderer skaliert sie passend ins Canvas (Letterbox) und berücksichtigt die Pixeldichte.
import { WORLD } from '../config/maps.js'
import { TOWERS } from '../config/towers.js'
import { lerp } from '../core/math.js'
import { renderTerrain } from './terrain.js'
import { createRng } from '../core/rng.js'
import { drawTower, drawEnemy, drawHealthBar, drawProjectile, drawBastion } from './sprites.js'
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
    this.scale = Math.min(rect.width / WORLD.width, rect.height / WORLD.height)
    this.offsetX = (rect.width - WORLD.width * this.scale) / 2
    this.offsetY = (rect.height - WORLD.height * this.scale) / 2
    // Hintergrund nur neu zeichnen, wenn sich die Auflösung spürbar ändert
    const px = Math.min(2.5, this.scale * dpr)
    const key = `${this.game?.map.id}:${px.toFixed(2)}`
    // Unsichtbares Canvas (Größe 0) überspringen – ein leeres Bild ließe sich nicht zeichnen
    if (this.game && rect.width > 0 && rect.height > 0 && key !== this.terrainKey) {
      this.terrain = renderTerrain(this.game, px)
      this.terrainKey = key
    }
  }

  // Bildschirmkoordinaten (clientX/Y) → Weltkoordinaten
  toWorld(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect()
    return {
      x: (clientX - rect.left - this.offsetX) / this.scale,
      y: (clientY - rect.top - this.offsetY) / this.scale,
    }
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
    const s = this.scale * this.dpr
    let sx = 0, sy = 0
    if (this.effects.shake > 0) {
      sx = (Math.random() - 0.5) * this.effects.shake
      sy = (Math.random() - 0.5) * this.effects.shake
    }
    ctx.setTransform(s, 0, 0, s, (this.offsetX + sx) * this.dpr, (this.offsetY + sy) * this.dpr)
    ctx.save()
    ctx.beginPath()
    ctx.rect(0, 0, WORLD.width, WORLD.height)
    ctx.clip()

    if (this.terrain) ctx.drawImage(this.terrain, 0, 0, WORLD.width, WORLD.height)

    this.drawSpots(view, t)
    this.drawAuras(view, t)
    drawBastion(ctx, game.map.base, game.lives / game.maxLives, t, this.reduced)
    this.drawRanges(view)

    // Türme und Gegner nach y sortiert zeichnen, damit Überlappungen stimmen
    const list = this.sorted
    list.length = 0
    for (const tw of game.towers) list.push(tw)
    for (const e of game.enemies) list.push(e)
    list.sort((a, b) => a.y - b.y)
    for (const o of list) {
      if (o.def.levels) drawTower(ctx, o, o.x, o.y, t)
      else {
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

  drawSpots(view, t) {
    const { ctx, game } = this
    const placing = !!view.type
    for (const s of game.spots) {
      if (s.tower) continue
      const selected = view.spot === s.index
      const hover = view.hoverSpot === s.index
      if (!placing && !selected && !hover) continue
      const pulse = this.reduced ? 0.6 : 0.5 + Math.sin(t * 4 + s.index) * 0.25
      ctx.strokeStyle = selected ? '#ffd257' : `rgba(255,236,170,${pulse})`
      ctx.lineWidth = selected ? 3 : 2
      ctx.setLineDash(selected ? [] : [6, 5])
      ctx.beginPath()
      ctx.arc(s.x, s.y, 29, 0, Math.PI * 2)
      ctx.stroke()
      ctx.setLineDash([])
      if (placing && !selected) {
        ctx.fillStyle = 'rgba(255,236,170,.12)'
        ctx.beginPath()
        ctx.arc(s.x, s.y, 25, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    // Auswahl-Rahmen um einen Turm
    if (view.tower) {
      ctx.strokeStyle = '#ffd257'
      ctx.lineWidth = 2.5
      ctx.beginPath()
      ctx.arc(view.tower.x, view.tower.y, 30, 0, Math.PI * 2)
      ctx.stroke()
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
        ctx.arc(tw.x, tw.y, tw.def.levels[tw.level].range, 0, Math.PI * 2)
        ctx.stroke()
      }
    }
    if (view.tower) {
      const tw = view.tower
      const r = tw.def.levels[tw.level].range
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
      ctx.fillStyle = 'rgba(255,255,255,.85)'
      for (const f of a.flakes) {
        const y = (f.y + t * f.speed) % (H + 20) - 10
        const x = (f.x + Math.sin(t * f.sway + f.phase) * 12 + t * 8) % W
        ctx.fillRect(x, y, f.size, f.size)
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

  // Durchscheinende Vorschau des gewählten Turms über dem Bauplatz
  drawPreview(view) {
    const { ctx, game } = this
    if (!view.type) return
    const idx = view.spot ?? view.hoverSpot
    if (idx == null) return
    const s = game.spots[idx]
    if (!s || s.tower) return
    const def = TOWERS[view.type]
    const ok = game.gold >= def.levels[0].cost
    ctx.fillStyle = ok ? 'rgba(140,230,140,.10)' : 'rgba(240,90,80,.10)'
    ctx.strokeStyle = ok ? 'rgba(140,230,140,.85)' : 'rgba(240,90,80,.85)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(s.x, s.y, def.levels[0].range, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    ctx.globalAlpha = 0.65
    drawTower(ctx, { type: view.type, level: 0, angle: -Math.PI / 2, fireAnim: 0 }, s.x, s.y, this.time)
    ctx.globalAlpha = 1
  }

  drawBossBar() {
    const { ctx, game } = this
    let boss = null
    for (const e of game.enemies) if (e.boss && (!boss || e.hp > boss.hp)) boss = e
    if (!boss) return
    const s = this.scale * this.dpr
    ctx.setTransform(s, 0, 0, s, this.offsetX * this.dpr, this.offsetY * this.dpr)
    const w = 420, h = 14, x = (WORLD.width - w) / 2, y = 16
    const f = Math.max(0, boss.hp / boss.maxHp)
    ctx.fillStyle = 'rgba(12,10,18,.8)'
    roundRect(ctx, x - 6, y - 6, w + 12, h + 30, 8)
    ctx.fill()
    ctx.fillStyle = '#3a1d22'
    ctx.fillRect(x, y + 16, w, h)
    const g = ctx.createLinearGradient(x, 0, x + w, 0)
    g.addColorStop(0, boss.enraged ? '#ff6a3a' : '#c0392b')
    g.addColorStop(1, boss.enraged ? '#ffb347' : '#e74c3c')
    ctx.fillStyle = g
    ctx.fillRect(x, y + 16, w * f, h)
    ctx.strokeStyle = '#ffd257'
    ctx.lineWidth = 1.5
    ctx.strokeRect(x, y + 16, w, h)
    ctx.font = 'bold 13px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillStyle = '#ffe9b0'
    ctx.fillText(`${boss.def.name}${boss.enraged ? ' – wütend!' : ''}  ·  ${Math.ceil(boss.hp)} / ${boss.maxHp}`, WORLD.width / 2, y + 8)
  }
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
