// Visuelle Effekte (Partikel, Explosionsringe, Blitze, Leuchtspuren, Goldzahlen).
// Rein dekorativ – beeinflussen die Simulation nicht. Feste Obergrenzen verhindern,
// dass bei vielen Gegnern unbegrenzt Objekte entstehen.

import { muzzleHeight, screenUp, view } from './sprites.js'

const TAU = Math.PI * 2

export class Effects {
  constructor() {
    this.reduced = false
    this.particles = []
    this.rings = []
    this.bolts = []
    this.texts = []
    this.flashes = []
    this.shake = 0
  }

  get maxParticles() { return this.reduced ? 70 : 320 }

  clear() {
    this.particles.length = 0
    this.rings.length = 0
    this.bolts.length = 0
    this.texts.length = 0
    this.flashes.length = 0
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

  // kurzes Aufleuchten (Mündungsfeuer, Explosion) – Farbe mit Platzhalter A für die Deckkraft
  flash(x, y, r, color, life = 0.12) {
    if (this.flashes.length > 40) this.flashes.shift()
    this.flashes.push({ x, y, r, color, life, max: life })
  }

  // Text über dem Bodenpunkt (x, y); lift = Starthöhe in Bildschirmrichtung „oben“
  text(x, y, text, color = '#ffd257', lift = 0) {
    if (this.texts.length > 30) this.texts.shift()
    this.texts.push({ x, y, text, color, life: 0.9, max: 0.9, rise: lift })
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
    for (const list of [this.rings, this.bolts, this.texts, this.flashes]) {
      let n = 0
      for (let i = 0; i < list.length; i++) {
        list[i].life -= dt
        if (list[i].life > 0) list[n++] = list[i]
      }
      list.length = n
    }
    for (const t of this.texts) t.rise += 26 * dt // steigt auf dem Bildschirm nach oben
    this.shake = Math.max(0, this.shake - dt * 18)
  }

  draw(ctx) {
    // Lichteffekte additiv, damit sie wie Licht wirken
    ctx.globalCompositeOperation = 'lighter'
    for (const f of this.flashes) {
      const k = f.life / f.max
      const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r)
      g.addColorStop(0, f.color.replace('A', 0.9 * k))
      g.addColorStop(1, f.color.replace('A', 0))
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(f.x, f.y, f.r, 0, TAU)
      ctx.fill()
    }
    ctx.globalCompositeOperation = 'source-over'
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
      // Texte aufrecht, auch in der gedrehten Ansicht
      ctx.save()
      ctx.translate(t.x, t.y)
      if (view.rot) ctx.rotate(-view.rot)
      ctx.fillStyle = 'rgba(0,0,0,.6)'
      ctx.fillText(t.text, 1, 1 - t.rise)
      ctx.fillStyle = t.color
      ctx.fillText(t.text, 0, -t.rise)
      ctx.restore()
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
        const up = screenUp(muzzleHeight(tower.type, tower.level))
        this.bolt([{ x: beam.x1 + up.dx, y: beam.y1 + up.dy }, { x: beam.x2, y: beam.y2 }], '#ffe9a8', 0.12, 1.6)
        this.flash(beam.x1 + up.dx + Math.cos(tower.angle) * 30, beam.y1 + up.dy + Math.sin(tower.angle) * 30, 16, 'rgba(255,230,160,A)')
        this.burst(beam.x2, beam.y2, 6, { color: '#fff3c4', speed: 90, life: 0.3, size: 2.5 })
      } else if (tower.type === 'cannon') {
        const a = tower.angle, up = screenUp(muzzleHeight('cannon', tower.level))
        const mx = tower.x + up.dx + Math.cos(a) * 26, my = tower.y + up.dy + Math.sin(a) * 26
        this.flash(mx, my, 18, 'rgba(255,200,120,A)')
        this.burst(mx, my, 5, { color: 'rgba(200,200,200,.8)', speed: 40, life: 0.5, size: 5 })
      }
    })
    on('chain', ({ tower, points }) => {
      const pts = points.slice()
      const up = screenUp(muzzleHeight('lightning', tower.level))
      pts[0] = { x: tower.x + up.dx, y: tower.y + up.dy }
      this.bolt(pts, '#b98cff', 0.18, 2.4)
      for (const p of pts.slice(1)) this.flash(p.x, p.y, 16, 'rgba(200,160,255,A)')
    })
    on('impact', ({ kind, x, y, radius }) => {
      if (kind === 'boulder') {
        this.flash(x, y, radius * 1.2, 'rgba(255,220,160,A)', 0.25)
        this.ring(x, y, radius, '#d9cbb0', 0.45, 5)
        this.burst(x, y, 18, { color: '#8d8a80', speed: 150, life: 0.6, size: 4, gravity: 120 })
        this.burst(x, y, 8, { color: 'rgba(160,140,110,.6)', speed: 50, life: 0.9, size: 7 })
        this.addShake(3.5)
      } else if (kind === 'ball') {
        this.flash(x, y, radius * 1.1, 'rgba(255,190,90,A)', 0.3)
        this.ring(x, y, radius, '#ffb347', 0.35, 4)
        this.burst(x, y, 16, { color: '#ffb347', speed: 160, life: 0.4, size: 3.5 })
        this.burst(x, y, 8, { color: 'rgba(90,90,90,.7)', speed: 50, life: 0.8, size: 6 })
        this.addShake(2.5)
      } else if (kind === 'shard') {
        this.ring(x, y, radius || 18, '#bfeaff', 0.4, 3)
        this.burst(x, y, 10, { color: '#e6f8ff', speed: 110, life: 0.4, size: 2.5 })
      } else if (kind === 'slime') {
        this.ring(x, y, radius || 24, '#ff8fd0', 0.45, 3)
        this.burst(x, y, 12, { color: '#e05aa8', speed: 80, life: 0.55, size: 3, gravity: 90 })
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
      if (gold) this.text(enemy.x, enemy.y, `+${gold}`, undefined, enemy.radius + 4)
      if (enemy.boss) { this.ring(enemy.x, enemy.y, 90, '#ffd257', 0.8, 5); this.addShake(7) }
    })
    on('leak', ({ enemy }) => {
      this.burst(enemy.x, enemy.y, 12, { color: '#ff5a4f', speed: 130, life: 0.5, size: 3 })
      this.text(enemy.x, enemy.y, `−${enemy.def.damage} ♥`, '#ff7a6e', 20)
      this.addShake(enemy.boss ? 8 : 3)
    })
    // Flammenwerfer: Feuerzungen im Kegel, Lichtschein an der Düse
    on('flame', ({ tower, angle, range, cone }) => {
      const up = screenUp(muzzleHeight('flame', tower.level))
      const mx = tower.x + up.dx + Math.cos(angle) * 18, my = tower.y + up.dy + Math.sin(angle) * 18
      this.flash(mx, my, 16, 'rgba(255,160,70,A)', 0.1)
      const n = this.reduced ? 3 : 9
      const half = (cone * Math.PI) / 360
      for (let i = 0; i < n; i++) {
        const a = angle + (Math.random() * 2 - 1) * half
        const sp = range * (2.2 + Math.random() * 1.2)
        this.particle(mx, my, { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.28 + Math.random() * 0.12, size: 5 + Math.random() * 4, color: i % 3 ? '#ff9d3a' : '#ffd36b', drag: 4 })
      }
    })
    // Tesla-Spule: Blitzbögen von der Kugel zu jedem getroffenen Gegner, Ring um die Spule
    on('pulse', ({ tower, points, range }) => {
      const up = screenUp(muzzleHeight('tesla', tower.level))
      const top = { x: tower.x + up.dx, y: tower.y + up.dy }
      for (const p of points) this.bolt([top, p], '#9fe8ff', 0.2, 2)
      this.ring(tower.x, tower.y, range, 'rgba(159,232,255,.5)', 0.35, 2)
      this.flash(top.x, top.y, 22, 'rgba(170,235,255,A)', 0.2)
    })
    // Betäubung: Schock = Funken, Einfrieren = Eissplitter
    on('stun', ({ enemy, kind }) => {
      if (kind === 'freeze') {
        this.ring(enemy.x, enemy.y, enemy.radius + 12, '#e8f9ff', 0.4, 3)
        this.burst(enemy.x, enemy.y, 10, { color: '#e6f8ff', speed: 90, life: 0.45, size: 3 })
      } else {
        this.burst(enemy.x, enemy.y, 6, { color: '#cff4ff', speed: 110, life: 0.25, size: 2 })
      }
    })
    on('heal', ({ enemy, radius }) => this.ring(enemy.x, enemy.y, radius, 'rgba(110,255,200,.8)', 0.6, 2))
    on('summon', ({ enemy }) => this.ring(enemy.x, enemy.y, 50, '#c67bff', 0.5, 3))
    on('frenzy', ({ enemy }) => {
      this.ring(enemy.x, enemy.y, 26, '#ff6a3a', 0.4, 3)
      this.burst(enemy.x, enemy.y, 10, { color: '#ff8a4a', speed: 90, life: 0.4, size: 3 })
    })
    on('hex', ({ enemy, radius, kind }) => {
      const quake = kind === 'quake'
      this.ring(enemy.x, enemy.y, radius, quake ? '#e6aa5a' : '#c08cff', 0.6, 4)
      this.flash(enemy.x, enemy.y, radius * 0.6, quake ? 'rgba(230,170,90,A)' : 'rgba(180,110,255,A)', 0.3)
      if (quake) { this.burst(enemy.x, enemy.y, 16, { color: '#8a6a44', speed: 140, life: 0.6, size: 4, gravity: 120 }); this.addShake(4) }
    })
    on('build', ({ tower }) => { this.ring(tower.x, tower.y, 34, '#f1e3b8', 0.4, 3); this.burst(tower.x, tower.y, 12, { color: '#d8c9a5', speed: 80, life: 0.5, size: 3 }) })
    on('upgrade', ({ tower }) => { this.ring(tower.x, tower.y, 40, '#ffd257', 0.5, 3); this.burst(tower.x, tower.y, 16, { color: '#ffd257', speed: 100, life: 0.6, size: 3, gravity: -40 }) })
    on('move', ({ tower }) => { this.ring(tower.x, tower.y, 34, '#9fd6ee', 0.4, 3); this.burst(tower.x, tower.y, 10, { color: '#d8c9a5', speed: 70, life: 0.5, size: 3 }) })
    on('clear', ({ obstacle }) => {
      const leafy = obstacle.type === 'tree'
      this.burst(obstacle.x, obstacle.y, 22, { color: leafy ? '#5d9447' : '#a59f92', speed: 110, life: 0.7, size: 4, gravity: 80 })
      this.burst(obstacle.x, obstacle.y, 10, { color: 'rgba(170,150,120,.6)', speed: 40, life: 1, size: 7 })
    })
    on('sell', ({ tower, value }) => { this.text(tower.x, tower.y, `+${value}`, undefined, 20); this.burst(tower.x, tower.y, 10, { color: '#b9ad92', speed: 70, life: 0.5, size: 4 }) })
    return () => off.forEach((f) => f())
  }
}
