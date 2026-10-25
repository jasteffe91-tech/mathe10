// Prozedurale Grafiken für Türme, Gegner, Geschosse und die Bastion.
// Alles wird mit Canvas-Pfaden gezeichnet – keine Bilddateien nötig.
import { TOWERS } from '../config/towers.js'
import { ENEMIES } from '../config/enemies.js'

const TAU = Math.PI * 2

function circle(ctx, x, y, r, fill) {
  ctx.fillStyle = fill
  ctx.beginPath()
  ctx.arc(x, y, r, 0, TAU)
  ctx.fill()
}

function poly(ctx, x, y, r, n, rot = 0) {
  ctx.beginPath()
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * TAU
    const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)
  }
  ctx.closePath()
}

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16)
  const ch = (v) => Math.max(0, Math.min(255, Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f)))
  return `rgb(${ch((n >> 16) & 255)},${ch((n >> 8) & 255)},${ch(n & 255)})`
}

// ---------------- Türme ----------------
// t: { type, level, angle, fireAnim }  – kann auch ein Vorschau-Objekt sein
export function drawTower(ctx, t, x, y, time = 0) {
  const def = TOWERS[t.type]
  const lvl = t.level || 0
  const recoil = t.fireAnim > 0 ? t.fireAnim / 0.12 : 0
  ctx.save()
  ctx.translate(x, y)
  // Schatten
  ctx.fillStyle = 'rgba(0,0,0,.32)'
  ctx.beginPath()
  ctx.ellipse(3, 6, 24, 18, 0, 0, TAU)
  ctx.fill()
  switch (t.type) {
    case 'arrow': drawArrowTower(ctx, def, lvl, t.angle, recoil); break
    case 'cannon': drawCannonTower(ctx, def, lvl, t.angle, recoil); break
    case 'frost': drawFrostTower(ctx, def, lvl, time); break
    case 'lightning': drawLightningTower(ctx, def, lvl, time, recoil); break
    case 'sniper': drawSniperTower(ctx, def, lvl, t.angle, recoil); break
    case 'poison': drawPoisonTower(ctx, def, lvl, t.angle, time, recoil); break
  }
  drawLevelPips(ctx, lvl)
  ctx.restore()
}

function drawLevelPips(ctx, lvl) {
  for (let i = 0; i <= lvl; i++) {
    const px = (i - lvl / 2) * 8
    ctx.fillStyle = '#2a2116'
    poly(ctx, px, 21, 4.2, 4, Math.PI / 4)
    ctx.fill()
    ctx.fillStyle = i === 2 ? '#ffd257' : '#f1e3b8'
    poly(ctx, px, 21, 2.8, 4, Math.PI / 4)
    ctx.fill()
  }
}

function stoneBase(ctx, r, sides, color, lvl) {
  const g = ctx.createLinearGradient(-r, -r, r, r)
  g.addColorStop(0, shade(color, 0.25))
  g.addColorStop(1, shade(color, -0.35))
  ctx.fillStyle = g
  poly(ctx, 0, 0, r, sides, Math.PI / sides)
  ctx.fill()
  ctx.strokeStyle = 'rgba(20,16,10,.55)'
  ctx.lineWidth = 2
  ctx.stroke()
  if (lvl >= 1) {
    ctx.strokeStyle = lvl >= 2 ? '#ffd257' : 'rgba(241,227,184,.8)'
    ctx.lineWidth = 1.6
    poly(ctx, 0, 0, r - 3.5, sides, Math.PI / sides)
    ctx.stroke()
  }
}

function drawArrowTower(ctx, def, lvl, angle, recoil) {
  stoneBase(ctx, 20 + lvl, 8, '#8a6a43', lvl)
  circle(ctx, 0, 0, 13 + lvl, '#5e4428')
  circle(ctx, 0, 0, 10 + lvl, def.color)
  ctx.rotate(angle)
  ctx.translate(-recoil * 3, 0)
  // Armbrust: Bogen + Schaft
  ctx.strokeStyle = '#3b2a17'
  ctx.lineWidth = 3
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.arc(6, 0, 10 + lvl, -1.2, 1.2)
  ctx.stroke()
  ctx.strokeStyle = def.accent
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(6 + Math.cos(-1.2) * (10 + lvl), Math.sin(-1.2) * (10 + lvl))
  ctx.lineTo(-2 + recoil * 4, 0)
  ctx.lineTo(6 + Math.cos(1.2) * (10 + lvl), Math.sin(1.2) * (10 + lvl))
  ctx.stroke()
  ctx.fillStyle = '#4a321b'
  ctx.fillRect(-6, -2, 22, 4)
  ctx.fillStyle = '#d8d8d8'
  ctx.beginPath()
  ctx.moveTo(18, -3); ctx.lineTo(22, 0); ctx.lineTo(18, 3)
  ctx.fill()
}

function drawCannonTower(ctx, def, lvl, angle, recoil) {
  stoneBase(ctx, 21 + lvl, 6, '#7d828c', lvl)
  // Zinnen
  ctx.fillStyle = '#5c6068'
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU
    ctx.fillRect(Math.cos(a) * 15 - 3, Math.sin(a) * 15 - 3, 6, 6)
  }
  circle(ctx, 0, 0, 12 + lvl, '#4a4e56')
  ctx.rotate(angle)
  ctx.translate(-recoil * 5, 0)
  const len = 20 + lvl * 3, w = 7 + lvl
  const g = ctx.createLinearGradient(0, -w, 0, w)
  g.addColorStop(0, '#5a5f69')
  g.addColorStop(0.5, '#23262b')
  g.addColorStop(1, '#3a3e45')
  ctx.fillStyle = g
  ctx.fillRect(0, -w, len, w * 2)
  ctx.fillStyle = '#16181b'
  ctx.fillRect(len - 3, -w - 1.5, 5, w * 2 + 3)
  circle(ctx, 0, 0, 9 + lvl, '#2b2f36')
  circle(ctx, -2, -2, 3, 'rgba(255,255,255,.25)')
}

function drawFrostTower(ctx, def, lvl, time) {
  stoneBase(ctx, 20 + lvl, 6, '#5d7f99', lvl)
  circle(ctx, 0, 0, 13 + lvl, '#a6dcf2')
  // Kristall in der Mitte, leicht pulsierend
  const pulse = 1 + Math.sin(time * 3) * 0.06
  ctx.save()
  ctx.scale(pulse, pulse)
  const spikes = 4 + lvl
  for (let i = 0; i < spikes; i++) {
    const a = (i / spikes) * TAU + time * 0.4
    ctx.fillStyle = i % 2 ? '#e8f7ff' : '#7cc8ec'
    ctx.beginPath()
    ctx.moveTo(Math.cos(a - 0.35) * 5, Math.sin(a - 0.35) * 5)
    ctx.lineTo(Math.cos(a) * (15 + lvl * 2), Math.sin(a) * (15 + lvl * 2))
    ctx.lineTo(Math.cos(a + 0.35) * 5, Math.sin(a + 0.35) * 5)
    ctx.fill()
  }
  circle(ctx, 0, 0, 6, '#ffffff')
  ctx.restore()
}

function drawLightningTower(ctx, def, lvl, time, recoil) {
  stoneBase(ctx, 20 + lvl, 8, '#5f4a7c', lvl)
  // Kupferspulen
  ctx.strokeStyle = '#c47b3a'
  ctx.lineWidth = 3
  for (let i = 0; i < 2 + lvl; i++) {
    ctx.beginPath()
    ctx.arc(0, 0, 15 - i * 3.2, 0, TAU)
    ctx.stroke()
  }
  const glow = 0.55 + Math.sin(time * 6) * 0.15 + recoil * 0.3
  const g = ctx.createRadialGradient(0, 0, 1, 0, 0, 16)
  g.addColorStop(0, `rgba(255,248,200,${glow})`)
  g.addColorStop(0.4, `rgba(190,140,255,${glow * 0.8})`)
  g.addColorStop(1, 'rgba(150,90,230,0)')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(0, 0, 16, 0, TAU)
  ctx.fill()
  circle(ctx, 0, 0, 5 + lvl, def.accent)
}

function drawSniperTower(ctx, def, lvl, angle, recoil) {
  stoneBase(ctx, 19 + lvl, 4, '#556b4e', lvl)
  ctx.fillStyle = '#3c4c37'
  poly(ctx, 0, 0, 12 + lvl, 4, Math.PI / 4)
  ctx.fill()
  ctx.rotate(angle)
  ctx.translate(-recoil * 4, 0)
  ctx.fillStyle = '#1f241e'
  ctx.fillRect(-6, -2.5, 34 + lvl * 4, 5)
  ctx.fillStyle = def.accent
  ctx.fillRect(-2, -5, 10, 3)
  circle(ctx, 3, -5, 2, '#9fe3ff')
  circle(ctx, -4, 0, 7, '#2a3127')
}

function drawPoisonTower(ctx, def, lvl, angle, time, recoil) {
  stoneBase(ctx, 20 + lvl, 7, '#4d6b3a', lvl)
  // Kessel mit blubberndem Gift
  circle(ctx, 0, 0, 13 + lvl, '#2c2f2a')
  circle(ctx, 0, 0, 10 + lvl, '#6fd13f')
  for (let i = 0; i < 3; i++) {
    const a = time * 1.3 + i * 2.1
    const r = 2 + ((time * 2 + i) % 1) * 2.5
    circle(ctx, Math.cos(a) * 5, Math.sin(a) * 4, r, 'rgba(200,255,140,.65)')
  }
  // Schleuderarm
  ctx.rotate(angle)
  ctx.rotate(-recoil * 0.9)
  ctx.strokeStyle = '#5a3d22'
  ctx.lineWidth = 4
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(-4, 0)
  ctx.lineTo(18 + lvl * 2, 0)
  ctx.stroke()
  circle(ctx, 19 + lvl * 2, 0, 4.5, '#3c2a17')
  circle(ctx, 19 + lvl * 2, 0, 2.6, def.accent)
}

// ---------------- Gegner ----------------
export function drawEnemy(ctx, e, x, y, time) {
  const def = e.def || ENEMIES[e.type]
  const r = e.radius || def.radius
  const bob = Math.sin(time * 10 + (e.id || 0)) * (def.boss ? 0.6 : 1.2)
  ctx.save()
  ctx.translate(x, y)
  ctx.fillStyle = 'rgba(0,0,0,.3)'
  ctx.beginPath()
  ctx.ellipse(2, r * 0.55, r * 1.05, r * 0.55, 0, 0, TAU)
  ctx.fill()
  ctx.translate(0, bob * 0.5)
  ctx.rotate(e.angle || 0)
  switch (def.id) {
    case 'grunt': drawGrunt(ctx, def, r, time, e); break
    case 'runner': drawRunner(ctx, def, r, time, e); break
    case 'armored': drawArmored(ctx, def, r); break
    case 'swarm': drawSwarm(ctx, def, r, time, e); break
    case 'healer': drawHealer(ctx, def, r, time); break
    case 'ogre': drawOgre(ctx, def, r, time, e); break
    case 'titan': drawTitan(ctx, def, r, time, e); break
  }
  // Statuseffekte als Überlagerung
  if (e.slowTime > 0) {
    ctx.fillStyle = 'rgba(150,215,255,.38)'
    ctx.beginPath()
    ctx.arc(0, 0, r + 1, 0, TAU)
    ctx.fill()
  }
  if (e.hitFlash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${Math.min(0.75, e.hitFlash * 7)})`
    ctx.beginPath()
    ctx.arc(0, 0, r, 0, TAU)
    ctx.fill()
  }
  ctx.restore()
  if (e.poisonTime > 0) {
    const t = (time * 1.6 + (e.id || 0) * 0.37) % 1
    circle(ctx, x + Math.sin((e.id || 0) + time * 3) * r * 0.5, y - r - t * 10, 2.2 * (1 - t) + 0.6, `rgba(150,240,90,${0.8 - t * 0.6})`)
  }
}

function feet(ctx, r, time, speed, color) {
  const s = Math.sin(time * speed) * r * 0.35
  circle(ctx, s, -r * 0.55, r * 0.3, color)
  circle(ctx, -s, r * 0.55, r * 0.3, color)
}

function drawGrunt(ctx, def, r, time) {
  feet(ctx, r, time, 12, '#4a2c1c')
  circle(ctx, 0, 0, r, def.color)
  circle(ctx, -r * 0.15, 0, r * 0.75, shade(def.color, 0.15))
  // Helm
  ctx.fillStyle = '#8c8f96'
  ctx.beginPath()
  ctx.arc(r * 0.15, 0, r * 0.55, -Math.PI / 2, Math.PI / 2)
  ctx.fill()
  circle(ctx, r * 0.15, 0, r * 0.25, '#5d5f64')
  // Schwert
  ctx.fillStyle = '#cfd3d8'
  ctx.fillRect(r * 0.2, r * 0.6, r * 1.1, 2.2)
}

function drawRunner(ctx, def, r, time) {
  ctx.strokeStyle = 'rgba(255,240,180,.45)'
  ctx.lineWidth = 1.5
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath()
    ctx.moveTo(-r * 1.1, i * r * 0.45)
    ctx.lineTo(-r * 2.1, i * r * 0.45)
    ctx.stroke()
  }
  feet(ctx, r, time, 22, '#5a4410')
  ctx.fillStyle = def.color
  ctx.beginPath()
  ctx.ellipse(0, 0, r * 1.2, r * 0.8, 0, 0, TAU)
  ctx.fill()
  ctx.fillStyle = '#7a3b12'
  ctx.beginPath()
  ctx.moveTo(-r * 0.6, -r * 0.7); ctx.lineTo(r * 0.8, 0); ctx.lineTo(-r * 0.6, r * 0.7)
  ctx.fill()
  circle(ctx, r * 0.55, 0, r * 0.35, '#f3d27a')
}

function drawArmored(ctx, def, r) {
  ctx.fillStyle = '#3e434b'
  ctx.fillRect(-r, -r, r * 2, r * 2)
  const g = ctx.createLinearGradient(-r, -r, r, r)
  g.addColorStop(0, '#c3c8cf')
  g.addColorStop(1, '#6b717b')
  ctx.fillStyle = g
  ctx.fillRect(-r + 2, -r + 2, r * 2 - 4, r * 2 - 4)
  ctx.strokeStyle = '#4b5059'
  ctx.lineWidth = 1.5
  ctx.strokeRect(-r * 0.5, -r + 2, r, r * 2 - 4)
  for (const [px, py] of [[-r + 5, -r + 5], [r - 5, -r + 5], [-r + 5, r - 5], [r - 5, r - 5]]) circle(ctx, px, py, 1.8, '#2f3339')
  ctx.fillStyle = '#d1453b'
  ctx.fillRect(r * 0.15, -r * 0.2, r * 0.6, r * 0.4)
}

function drawSwarm(ctx, def, r, time, e) {
  ctx.strokeStyle = '#2d1640'
  ctx.lineWidth = 1
  const wig = Math.sin(time * 30 + (e.id || 0)) * 0.6
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath()
    ctx.moveTo(i * r * 0.5, 0)
    ctx.lineTo(i * r * 0.5 + wig, -r * 1.5)
    ctx.moveTo(i * r * 0.5, 0)
    ctx.lineTo(i * r * 0.5 - wig, r * 1.5)
    ctx.stroke()
  }
  ctx.fillStyle = def.color
  ctx.beginPath()
  ctx.ellipse(0, 0, r * 1.25, r * 0.85, 0, 0, TAU)
  ctx.fill()
  circle(ctx, r * 0.9, 0, r * 0.5, '#4b2668')
  circle(ctx, r * 1.05, -r * 0.25, 1, '#ffde6b')
  circle(ctx, r * 1.05, r * 0.25, 1, '#ffde6b')
}

function drawHealer(ctx, def, r, time) {
  const pulse = (time * 0.5) % 1
  ctx.strokeStyle = `rgba(110,255,200,${0.5 * (1 - pulse)})`
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(0, 0, r + pulse * 14, 0, TAU)
  ctx.stroke()
  circle(ctx, 0, 0, r, shade(def.color, -0.3))
  circle(ctx, 0, 0, r * 0.82, def.color)
  circle(ctx, r * 0.2, 0, r * 0.45, '#1c5f58')
  // Stab
  ctx.strokeStyle = '#7a5530'
  ctx.lineWidth = 2.2
  ctx.beginPath()
  ctx.moveTo(-r * 0.4, r * 0.8)
  ctx.lineTo(r * 1.3, r * 0.8)
  ctx.stroke()
  circle(ctx, r * 1.35, r * 0.8, 3, '#9bffd8')
}

function drawOgre(ctx, def, r, time, e) {
  feet(ctx, r, time, 6, '#3f1712')
  if (e.enraged) {
    const g = ctx.createRadialGradient(0, 0, r * 0.5, 0, 0, r * 1.6)
    g.addColorStop(0, 'rgba(255,80,40,.35)')
    g.addColorStop(1, 'rgba(255,80,40,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(0, 0, r * 1.6, 0, TAU)
    ctx.fill()
  }
  circle(ctx, 0, 0, r, shade(def.color, -0.35))
  circle(ctx, -r * 0.08, 0, r * 0.88, def.color)
  // Schulterplatten
  circle(ctx, 0, -r * 0.75, r * 0.35, '#7d7f86')
  circle(ctx, 0, r * 0.75, r * 0.35, '#7d7f86')
  // Kopf mit Hörnern und Krone
  circle(ctx, r * 0.35, 0, r * 0.42, '#7a2a24')
  ctx.fillStyle = '#efe6d2'
  for (const s of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(r * 0.35, s * r * 0.3)
    ctx.quadraticCurveTo(r * 0.9, s * r * 0.75, r * 0.95, s * r * 0.4)
    ctx.lineTo(r * 0.5, s * r * 0.15)
    ctx.fill()
  }
  ctx.fillStyle = '#ffcf4a'
  poly(ctx, r * 0.3, 0, r * 0.22, 5, time)
  ctx.fill()
  // Keule
  ctx.fillStyle = '#5a3a1e'
  ctx.fillRect(r * 0.2, r * 0.9, r * 1.1, 4)
  circle(ctx, r * 1.35, r * 0.95, 5, '#4a2e15')
}

function drawTitan(ctx, def, r, time, e) {
  const aura = 0.4 + Math.sin(time * 2) * 0.15
  const g = ctx.createRadialGradient(0, 0, r * 0.6, 0, 0, r * 1.9)
  g.addColorStop(0, `rgba(150,80,255,${aura})`)
  g.addColorStop(1, 'rgba(150,80,255,0)')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(0, 0, r * 1.9, 0, TAU)
  ctx.fill()
  feet(ctx, r, time, 5, '#1d1030')
  ctx.fillStyle = '#21122f'
  poly(ctx, 0, 0, r, 6, time * 0.2)
  ctx.fill()
  ctx.fillStyle = def.color
  poly(ctx, 0, 0, r * 0.82, 6, time * 0.2)
  ctx.fill()
  ctx.strokeStyle = '#9b6dff'
  ctx.lineWidth = 2
  poly(ctx, 0, 0, r * 0.55, 6, -time * 0.3)
  ctx.stroke()
  // Augen
  const eye = e.enraged ? '#ff5a3a' : '#e7d2ff'
  circle(ctx, r * 0.5, -r * 0.2, 3.2, eye)
  circle(ctx, r * 0.5, r * 0.2, 3.2, eye)
  // Dornenkrone
  ctx.fillStyle = '#c8b6ff'
  for (let i = 0; i < 5; i++) {
    const a = -1 + i * 0.5
    ctx.beginPath()
    ctx.moveTo(Math.cos(a) * r * 0.75, Math.sin(a) * r * 0.75)
    ctx.lineTo(Math.cos(a) * r * 1.2, Math.sin(a) * r * 1.2)
    ctx.lineTo(Math.cos(a + 0.18) * r * 0.75, Math.sin(a + 0.18) * r * 0.75)
    ctx.fill()
  }
}

// Lebensbalken über einem Gegner
export function drawHealthBar(ctx, e, x, y) {
  const r = e.radius
  const w = Math.max(18, r * 2.2), h = e.boss ? 5 : 3.5
  const bx = x - w / 2, by = y - r - (e.boss ? 14 : 9)
  const f = Math.max(0, e.hp / e.maxHp)
  ctx.fillStyle = 'rgba(10,10,14,.75)'
  ctx.fillRect(bx - 1, by - 1, w + 2, h + 2)
  ctx.fillStyle = f > 0.5 ? '#6bd16a' : f > 0.25 ? '#f2c14e' : '#ec5a4f'
  ctx.fillRect(bx, by, w * f, h)
  if (e.armor > 0) {
    ctx.fillStyle = '#c7ccd4'
    ctx.fillRect(bx - 1, by + h + 1, Math.min(w + 2, e.armor * 3), 1.5)
  }
}

// ---------------- Geschosse ----------------
export function drawProjectile(ctx, p, x, y) {
  const lift = p.arc ? Math.sin(Math.PI * (p.progress || 0)) * p.arc : 0
  if (lift) {
    ctx.fillStyle = 'rgba(0,0,0,.25)'
    ctx.beginPath()
    ctx.ellipse(x, y, 4, 2.5, 0, 0, TAU)
    ctx.fill()
  }
  const py = y - lift
  switch (p.kind) {
    case 'arrow':
      ctx.save()
      ctx.translate(x, py)
      ctx.rotate(p.angle)
      ctx.strokeStyle = '#3d2b18'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(-9, 0)
      ctx.lineTo(5, 0)
      ctx.stroke()
      ctx.fillStyle = '#e6e6e6'
      ctx.beginPath()
      ctx.moveTo(8, 0); ctx.lineTo(3, -2.5); ctx.lineTo(3, 2.5)
      ctx.fill()
      ctx.fillStyle = '#d24d3c'
      ctx.fillRect(-10, -2, 3, 4)
      ctx.restore()
      break
    case 'ball':
      circle(ctx, x, py, 5.5, '#1d1f23')
      circle(ctx, x - 1.5, py - 1.5, 1.8, 'rgba(255,255,255,.4)')
      break
    case 'shard':
      ctx.save()
      ctx.translate(x, py)
      ctx.rotate(p.angle)
      ctx.fillStyle = '#d9f3ff'
      ctx.beginPath()
      ctx.moveTo(8, 0); ctx.lineTo(-4, -3.5); ctx.lineTo(-7, 0); ctx.lineTo(-4, 3.5)
      ctx.fill()
      ctx.restore()
      break
    case 'glob':
      circle(ctx, x, py, 6, '#3e8a24')
      circle(ctx, x, py, 4.5, '#8ee34f')
      circle(ctx, x - 1.5, py - 1.5, 1.5, 'rgba(255,255,255,.6)')
      break
  }
}

// ---------------- Bastion ----------------
export function drawBastion(ctx, base, health, time, reduced) {
  const { x, y } = base
  ctx.save()
  ctx.translate(x, y)
  ctx.fillStyle = 'rgba(0,0,0,.35)'
  ctx.beginPath()
  ctx.ellipse(6, 12, 60, 44, 0, 0, TAU)
  ctx.fill()
  // Mauern
  const wall = (c1, c2) => {
    const g = ctx.createLinearGradient(-46, -46, 46, 46)
    g.addColorStop(0, c1)
    g.addColorStop(1, c2)
    return g
  }
  ctx.fillStyle = wall('#d8cdb4', '#8f8368')
  ctx.fillRect(-40, -40, 80, 80)
  ctx.strokeStyle = '#5a5140'
  ctx.lineWidth = 2.5
  ctx.strokeRect(-40, -40, 80, 80)
  // Zinnen
  ctx.fillStyle = '#b5aa90'
  for (let i = -36; i <= 30; i += 11) {
    ctx.fillRect(i, -46, 6, 6); ctx.fillRect(i, 40, 6, 6)
    ctx.fillRect(-46, i, 6, 6); ctx.fillRect(40, i, 6, 6)
  }
  // Ecktürme
  for (const [cx, cy] of [[-40, -40], [40, -40], [-40, 40], [40, 40]]) {
    circle(ctx, cx, cy, 15, '#6f6553')
    circle(ctx, cx, cy, 12.5, '#c9bea4')
    circle(ctx, cx, cy, 6, '#8a3b30')
  }
  // Bergfried mit Dach
  ctx.fillStyle = wall('#e6dcc4', '#9c9074')
  ctx.fillRect(-20, -20, 40, 40)
  ctx.fillStyle = '#9b3a2f'
  ctx.beginPath()
  ctx.moveTo(-22, -22); ctx.lineTo(22, -22); ctx.lineTo(0, 0)
  ctx.fill()
  ctx.fillStyle = '#7d2c23'
  ctx.beginPath()
  ctx.moveTo(-22, 22); ctx.lineTo(22, 22); ctx.lineTo(0, 0)
  ctx.fill()
  ctx.fillStyle = '#b8473a'
  ctx.beginPath()
  ctx.moveTo(-22, -22); ctx.lineTo(-22, 22); ctx.lineTo(0, 0)
  ctx.fill()
  ctx.fillStyle = '#6a241c'
  ctx.beginPath()
  ctx.moveTo(22, -22); ctx.lineTo(22, 22); ctx.lineTo(0, 0)
  ctx.fill()
  // Banner
  const wave = reduced ? 0 : Math.sin(time * 4) * 3
  ctx.strokeStyle = '#3a2f22'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(0, -34)
  ctx.stroke()
  ctx.fillStyle = health > 0.3 ? '#2f6db5' : '#b53a2f'
  ctx.beginPath()
  ctx.moveTo(0, -34)
  ctx.quadraticCurveTo(10, -36 + wave, 20, -32 + wave)
  ctx.lineTo(20, -22 + wave)
  ctx.quadraticCurveTo(10, -26 + wave, 0, -24)
  ctx.fill()
  // Schaden: Risse und Ruß, je weniger Leben, desto mehr
  if (health < 0.7) {
    ctx.strokeStyle = 'rgba(40,30,20,.7)'
    ctx.lineWidth = 1.5
    const cracks = health < 0.35 ? 4 : 2
    for (let i = 0; i < cracks; i++) {
      const sx = -34 + i * 19, sy = 30 - (i % 2) * 64
      ctx.beginPath()
      ctx.moveTo(sx, sy)
      ctx.lineTo(sx + 6, sy + (sy < 0 ? 9 : -9))
      ctx.lineTo(sx + 2, sy + (sy < 0 ? 16 : -16))
      ctx.stroke()
    }
  }
  ctx.restore()
}

// Kleine Icons für das Baumenü und die Wellenvorschau
export function drawTowerIcon(canvas, type, level = 0) {
  const ctx = canvas.getContext('2d')
  const s = canvas.width / 56
  ctx.setTransform(s, 0, 0, s, 0, 0)
  ctx.clearRect(0, 0, 56, 56)
  drawTower(ctx, { type, level, angle: -Math.PI / 4, fireAnim: 0 }, 28, 25, 0.6)
}

export function drawEnemyIcon(canvas, type) {
  const ctx = canvas.getContext('2d')
  const def = ENEMIES[type]
  const s = canvas.width / 40
  ctx.setTransform(s, 0, 0, s, 0, 0)
  ctx.clearRect(0, 0, 40, 40)
  const k = Math.min(1, 15 / def.radius)
  ctx.translate(20, 20)
  ctx.scale(k, k)
  drawEnemy(ctx, { def, type, radius: def.radius, angle: 0, id: 1 }, 0, 0, 0)
}
