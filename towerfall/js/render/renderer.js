// Zeichnet den Spielzustand auf das Canvas. Die Spielwelt hat feste Koordinaten (1280 × 720);
// der Renderer skaliert sie passend ins Canvas (Letterbox) und berücksichtigt die Pixeldichte.
import { WORLD } from '../config/maps.js'
import { TOWERS } from '../config/towers.js'
import { lerp } from '../core/math.js'
import { renderTerrain } from './terrain.js'
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

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}
