// Visuelle Effekte (Partikel, Explosionsringe, Blitze, Leuchtspuren, Goldzahlen).
// Rein dekorativ – beeinflussen die Simulation nicht. Feste Obergrenzen verhindern,
// dass bei vielen Gegnern unbegrenzt Objekte entstehen.

const TAU = Math.PI * 2

export class Effects {
  constructor() {
    this.reduced = false
    this.particles = []
    this.rings = []
    this.bolts = []
    this.texts = []
    this.shake = 0
  }

  get maxParticles() { return this.reduced ? 70 : 320 }

  clear() {
    this.particles.length = 0
    this.rings.length = 0
    this.bolts.length = 0
    this.texts.length = 0
    this.shake = 0
  }

  particle(x, y, { vx = 0, vy = 0, life = 0.5, size = 3, color = '#fff', drag = 2, gravity = 0, shrink = true } = {}) {
    if (this.particles.length >= this.maxParticles) return
    this.particles.push({ x, y, vx, vy, life, max: life, size, color, drag, gravity, shrink })
  }

  burst(x, y, count, opts) {
    const n = this.reduced ? Math.ceil(count / 3) : count
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU
      const sp = (opts.speed || 80) * (0.4 + Math.random() * 0.8)
      this.particle(x, y, { ...opts, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: (opts.life || 0.5) * (0.6 + Math.random() * 0.6) })
    }
  }

  ring(x, y, radius, color, life = 0.35, width = 3) {
    if (this.rings.length > 40) this.rings.shift()
    this.rings.push({ x, y, radius, color, life, max: life, width })
  }

  bolt(points, color, life = 0.16, width = 2.5) {
    if (this.bolts.length > 40) this.bolts.shift()
    // Zickzack einmalig berechnen, damit der Blitz während seiner Lebenszeit nicht flackert
    const jag = [points[0]]
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i]
      const segs = Math.max(2, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / 14))
      for (let s = 1; s < segs; s++) {
        const t = s / segs
        jag.push({ x: a.x + (b.x - a.x) * t + (Math.random() - 0.5) * 12, y: a.y + (b.y - a.y) * t + (Math.random() - 0.5) * 12 })
      }
      jag.push(b)
    }
    this.bolts.push({ points: jag, color, life, max: life, width })
  }

  text(x, y, text, color = '#ffd257') {
    if (this.texts.length > 30) this.texts.shift()
    this.texts.push({ x, y, text, color, life: 0.9, max: 0.9 })
  }

  addShake(amount) {
    if (!this.reduced) this.shake = Math.min(8, this.shake + amount)
  }

  update(dt) {
    if (dt <= 0) return
    const ps = this.particles
    let j = 0
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i]
      p.life -= dt
      if (p.life <= 0) continue
      const k = Math.max(0, 1 - p.drag * dt)
      p.vx *= k
      p.vy = p.vy * k + p.gravity * dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      ps[j++] = p
    }
    ps.length = j
    for (const list of [this.rings, this.bolts, this.texts]) {
      let n = 0
      for (let i = 0; i < list.length; i++) {
        list[i].life -= dt
        if (list[i].life > 0) list[n++] = list[i]
      }
      list.length = n
    }
    for (const t of this.texts) t.y -= 26 * dt
    this.shake = Math.max(0, this.shake - dt * 18)
  }

  draw(ctx) {
    for (const r of this.rings) {
      const t = 1 - r.life / r.max
      ctx.strokeStyle = r.color
      ctx.globalAlpha = 1 - t
      ctx.lineWidth = r.width * (1 - t * 0.5)
      ctx.beginPath()
      ctx.arc(r.x, r.y, Math.max(1, r.radius * (0.3 + t * 0.7)), 0, TAU)
      ctx.stroke()
    }
    ctx.globalAlpha = 1
    for (const p of this.particles) {
      const f = p.life / p.max
      ctx.globalAlpha = Math.min(1, f * 1.5)
      ctx.fillStyle = p.color
      const s = p.shrink ? p.size * (0.3 + f * 0.7) : p.size
      ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s)
    }
    ctx.globalAlpha = 1
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    for (const b of this.bolts) {
      const f = b.life / b.max
      ctx.globalAlpha = f
      ctx.strokeStyle = b.color
      ctx.lineWidth = b.width * 2.5
      ctx.globalAlpha = f * 0.3
      this.strokePoly(ctx, b.points)
      ctx.globalAlpha = f
      ctx.lineWidth = b.width
      ctx.strokeStyle = '#ffffff'
      this.strokePoly(ctx, b.points)
    }
    ctx.globalAlpha = 1
    ctx.font = 'bold 13px system-ui, sans-serif'
    ctx.textAlign = 'center'
    for (const t of this.texts) {
      ctx.globalAlpha = Math.min(1, t.life / t.max * 2)
      ctx.fillStyle = 'rgba(0,0,0,.6)'
      ctx.fillText(t.text, t.x + 1, t.y + 1)
      ctx.fillStyle = t.color
      ctx.fillText(t.text, t.x, t.y)
    }
    ctx.globalAlpha = 1
  }

  strokePoly(ctx, pts) {
    ctx.beginPath()
    ctx.moveTo(pts[0].x, pts[0].y)
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
    ctx.stroke()
  }

  // Übersetzt Spielereignisse in Effekte
  attach(game) {
    const off = []
    const on = (type, fn) => off.push(game.on(type, fn))
    on('shot', ({ tower, beam }) => {
      if (beam) {
        this.bolt([{ x: beam.x1, y: beam.y1 }, { x: beam.x2, y: beam.y2 }], '#ffe9a8', 0.12, 1.6)
        this.burst(beam.x2, beam.y2, 6, { color: '#fff3c4', speed: 90, life: 0.3, size: 2.5 })
      } else if (tower.type === 'cannon') {
        const a = tower.angle
        this.burst(tower.x + Math.cos(a) * 24, tower.y + Math.sin(a) * 24, 5, { color: 'rgba(200,200,200,.8)', speed: 40, life: 0.5, size: 5 })
      }
    })
    on('chain', ({ points }) => this.bolt(points, '#b98cff', 0.18, 2.4))
    on('impact', ({ kind, x, y, radius }) => {
      if (kind === 'ball') {
        this.ring(x, y, radius, '#ffb347', 0.35, 4)
        this.burst(x, y, 16, { color: '#ffb347', speed: 160, life: 0.4, size: 3.5 })
        this.burst(x, y, 8, { color: 'rgba(90,90,90,.7)', speed: 50, life: 0.8, size: 6 })
        this.addShake(2.5)
      } else if (kind === 'shard') {
        this.ring(x, y, radius || 18, '#bfeaff', 0.4, 3)
        this.burst(x, y, 10, { color: '#e6f8ff', speed: 110, life: 0.4, size: 2.5 })
      } else if (kind === 'glob') {
        this.ring(x, y, radius, '#8ee34f', 0.5, 3)
        this.burst(x, y, 14, { color: '#9cf05a', speed: 90, life: 0.6, size: 3, gravity: 60 })
      } else {
        this.burst(x, y, 3, { color: '#f4e2b0', speed: 60, life: 0.2, size: 2 })
      }
    })
    on('enemyDeath', ({ enemy, gold }) => {
      const c = enemy.def.color
      this.burst(enemy.x, enemy.y, enemy.boss ? 40 : 10, { color: c, speed: enemy.boss ? 200 : 110, life: enemy.boss ? 0.9 : 0.45, size: enemy.boss ? 5 : 3 })
      if (gold) this.text(enemy.x, enemy.y - enemy.radius - 4, `+${gold}`)
      if (enemy.boss) { this.ring(enemy.x, enemy.y, 90, '#ffd257', 0.8, 5); this.addShake(7) }
    })
    on('leak', ({ enemy }) => {
      this.burst(enemy.x, enemy.y, 12, { color: '#ff5a4f', speed: 130, life: 0.5, size: 3 })
      this.text(enemy.x, enemy.y - 20, `−${enemy.def.damage} ♥`, '#ff7a6e')
      this.addShake(enemy.boss ? 8 : 3)
    })
    on('heal', ({ enemy, radius }) => this.ring(enemy.x, enemy.y, radius, 'rgba(110,255,200,.8)', 0.6, 2))
    on('summon', ({ enemy }) => this.ring(enemy.x, enemy.y, 50, '#c67bff', 0.5, 3))
    on('build', ({ tower }) => { this.ring(tower.x, tower.y, 34, '#f1e3b8', 0.4, 3); this.burst(tower.x, tower.y, 12, { color: '#d8c9a5', speed: 80, life: 0.5, size: 3 }) })
    on('upgrade', ({ tower }) => { this.ring(tower.x, tower.y, 40, '#ffd257', 0.5, 3); this.burst(tower.x, tower.y, 16, { color: '#ffd257', speed: 100, life: 0.6, size: 3, gravity: -40 }) })
    on('sell', ({ tower, value }) => { this.text(tower.x, tower.y - 20, `+${value}`); this.burst(tower.x, tower.y, 10, { color: '#b9ad92', speed: 70, life: 0.5, size: 4 }) })
    return () => off.forEach((f) => f())
  }
}
