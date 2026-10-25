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
// Leichte 3/4-Ansicht: Jeder Turm steht auf einem Sockel mit sichtbarer Seitenwand; der Kopf sitzt
// auf der Oberseite. (x, y) ist der Fußpunkt – dort liegt auch der Mittelpunkt der Reichweite.
// t: { type, level, angle, fireAnim } – kann auch ein Vorschau-Objekt sein
export function drawTower(ctx, t, x, y, time = 0) {
  const def = TOWERS[t.type]
  const lvl = t.level || 0
  const recoil = t.fireAnim > 0 ? t.fireAnim / 0.12 : 0
  const k = def.spriteScale || 1
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(k, k)
  // Schatten nach rechts unten (Licht von links oben)
  ctx.fillStyle = 'rgba(0,0,0,.3)'
  ctx.beginPath()
  ctx.ellipse(6, 8, 25, 17, 0.2, 0, TAU)
  ctx.fill()
  switch (t.type) {
    case 'arrow': drawArrowTower(ctx, def, lvl, t.angle, recoil); break
    case 'cannon': drawCannonTower(ctx, def, lvl, t.angle, recoil); break
    case 'frost': drawFrostTower(ctx, def, lvl, time); break
    case 'lightning': drawLightningTower(ctx, def, lvl, time, recoil); break
    case 'sniper': drawSniperTower(ctx, def, lvl, t.angle, recoil); break
    case 'poison': drawPoisonTower(ctx, def, lvl, t.angle, time, recoil); break
    case 'ballista': drawBallistaTower(ctx, def, lvl, t.angle, recoil, t.rot || 0); break
    case 'banner': drawBannerTower(ctx, def, lvl, time); break
    case 'trebuchet': drawTrebuchetTower(ctx, def, lvl, t.angle, recoil, time); break
  }
  ctx.restore()
  if (t.noPips) return
  ctx.save()
  // Stufenanzeige knapp unter der Grundfläche (Höhe in Zellen à 32 px, ggf. gedreht)
  const cellsHigh = t.rot % 2 && def.footprint.rotatable ? def.footprint.w : def.footprint.h
  ctx.translate(x, y + cellsHigh * 16 - 21)
  drawLevelPips(ctx, lvl)
  ctx.restore()
}

function drawLevelPips(ctx, lvl) {
  for (let i = 0; i <= lvl; i++) {
    const px = (i - lvl / 2) * 8
    ctx.fillStyle = '#2a2116'
    poly(ctx, px, 23, 4.2, 4, Math.PI / 4)
    ctx.fill()
    ctx.fillStyle = i === 2 ? '#ffd257' : '#f1e3b8'
    poly(ctx, px, 23, 2.8, 4, Math.PI / 4)
    ctx.fill()
  }
}

// Sockel als Prisma: Seitenwand (dunkler, mit Fugen) und Deckfläche. Gibt die Höhe zurück;
// danach steht der Ursprung auf der Mitte der Deckfläche.
function pillar(ctx, { r, sides, h, top, side, lvl, joints = true, rot = Math.PI / sides }) {
  const sq = 0.82 // Deckfläche leicht gestaucht → Draufsicht schräg von oben
  const pts = []
  for (let i = 0; i < sides; i++) {
    const a = rot + (i / sides) * TAU
    pts.push([Math.cos(a) * r, Math.sin(a) * r * sq])
  }
  const minX = Math.min(...pts.map((p) => p[0])), maxX = Math.max(...pts.map((p) => p[0]))
  // Seitenwand: Unterkante + Rechteck + Oberkante
  const sg = ctx.createLinearGradient(minX, 0, maxX, 0)
  sg.addColorStop(0, shade(side, 0.18))
  sg.addColorStop(0.55, side)
  sg.addColorStop(1, shade(side, -0.35))
  ctx.fillStyle = sg
  ctx.beginPath()
  pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)))
  ctx.closePath()
  ctx.fill()
  ctx.beginPath()
  pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py - h) : ctx.moveTo(px, py - h)))
  ctx.closePath()
  ctx.fill()
  ctx.fillRect(minX, -h, maxX - minX, h)
  if (joints) {
    ctx.strokeStyle = 'rgba(0,0,0,.22)'
    ctx.lineWidth = 1
    for (let yy = -h + 5; yy < 0; yy += 5) {
      ctx.beginPath()
      ctx.moveTo(minX + 1, yy + r * sq * 0.6)
      ctx.lineTo(maxX - 1, yy + r * sq * 0.6)
      ctx.stroke()
    }
  }
  ctx.translate(0, -h)
  const tg = ctx.createLinearGradient(-r, -r, r, r)
  tg.addColorStop(0, shade(top, 0.3))
  tg.addColorStop(1, shade(top, -0.2))
  ctx.fillStyle = tg
  ctx.beginPath()
  pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)))
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = lvl >= 2 ? '#ffd257' : lvl >= 1 ? 'rgba(241,227,184,.85)' : 'rgba(20,16,10,.5)'
  ctx.lineWidth = lvl >= 1 ? 1.8 : 1.4
  ctx.stroke()
  return h
}

function glow(ctx, x, y, r, color, alpha) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r)
  g.addColorStop(0, color.replace('A', alpha))
  g.addColorStop(1, color.replace('A', 0))
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(x, y, r, 0, TAU)
  ctx.fill()
}

function drawArrowTower(ctx, def, lvl, angle, recoil) {
  pillar(ctx, { r: 19 + lvl, sides: 8, h: 10 + lvl * 3, top: '#9b7a4c', side: '#6d5032', lvl })
  // Holzplattform mit Brüstung
  circle(ctx, 0, 0, 13 + lvl, '#5e4428')
  circle(ctx, 0, 0, 10.5 + lvl, def.color)
  ctx.rotate(angle)
  ctx.translate(-recoil * 3, 0)
  const bow = 10 + lvl
  ctx.strokeStyle = '#3b2a17'
  ctx.lineWidth = 3.2
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.arc(5, 0, bow, -1.25, 1.25)
  ctx.stroke()
  ctx.strokeStyle = def.accent
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(5 + Math.cos(-1.25) * bow, Math.sin(-1.25) * bow)
  ctx.lineTo(-3 + recoil * 4, 0)
  ctx.lineTo(5 + Math.cos(1.25) * bow, Math.sin(1.25) * bow)
  ctx.stroke()
  ctx.fillStyle = '#4a321b'
  ctx.fillRect(-7, -2, 23, 4)
  ctx.fillStyle = '#e8e8e8'
  ctx.beginPath()
  ctx.moveTo(19, -3.2); ctx.lineTo(24, 0); ctx.lineTo(19, 3.2)
  ctx.fill()
}

function drawCannonTower(ctx, def, lvl, angle, recoil) {
  pillar(ctx, { r: 21 + lvl, sides: 6, h: 11 + lvl * 3, top: '#8b909a', side: '#5d626b', lvl })
  ctx.fillStyle = '#4c5058'
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU
    ctx.fillRect(Math.cos(a) * 15.5 - 3, Math.sin(a) * 13 - 3, 6, 6)
  }
  circle(ctx, 0, 0, 12 + lvl, '#43474e')
  ctx.rotate(angle)
  ctx.translate(-recoil * 5, 0)
  const len = 21 + lvl * 3, w = 6.5 + lvl
  const g = ctx.createLinearGradient(0, -w, 0, w)
  g.addColorStop(0, '#6a707b')
  g.addColorStop(0.45, '#2a2e34')
  g.addColorStop(1, '#3a3e45')
  ctx.fillStyle = g
  ctx.fillRect(0, -w, len, w * 2)
  ctx.fillStyle = '#15171a'
  ctx.fillRect(len - 3, -w - 1.5, 5, w * 2 + 3)
  ctx.fillStyle = 'rgba(255,255,255,.18)'
  ctx.fillRect(2, -w + 1, len - 6, 2)
  circle(ctx, 0, 0, 9 + lvl, '#2b2f36')
  circle(ctx, -2.5, -2.5, 3, 'rgba(255,255,255,.28)')
}

function drawFrostTower(ctx, def, lvl, time) {
  pillar(ctx, { r: 19 + lvl, sides: 6, h: 9 + lvl * 3, top: '#9fd6ee', side: '#4f7d99', lvl, joints: false })
  glow(ctx, 0, -8, 26 + lvl * 3, 'rgba(160,225,255,A)', 0.35 + Math.sin(time * 3) * 0.08)
  // Eiskristall, der nach oben ragt
  const hgt = 26 + lvl * 6
  const g = ctx.createLinearGradient(-8, 0, 8, -hgt)
  g.addColorStop(0, '#5fb6e2')
  g.addColorStop(0.5, '#cdeffd')
  g.addColorStop(1, '#ffffff')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.moveTo(-8, 2); ctx.lineTo(-5, -hgt * 0.6); ctx.lineTo(0, -hgt); ctx.lineTo(5, -hgt * 0.6); ctx.lineTo(8, 2)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,.7)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, -hgt); ctx.lineTo(0, 0)
  ctx.stroke()
  // kleine Nebenkristalle
  for (const s of [-1, 1]) {
    ctx.fillStyle = s < 0 ? '#9fdcf6' : '#7cc8ec'
    ctx.beginPath()
    ctx.moveTo(s * 6, 1); ctx.lineTo(s * 14, -hgt * 0.45); ctx.lineTo(s * 11, 2)
    ctx.fill()
  }
  const sp = (time * 0.8) % 1
  circle(ctx, Math.sin(time * 2) * 6, -hgt * (0.3 + sp * 0.7), 1.6 * (1 - sp) + 0.4, '#ffffff')
}

function drawLightningTower(ctx, def, lvl, time, recoil) {
  pillar(ctx, { r: 19 + lvl, sides: 8, h: 10 + lvl * 3, top: '#6d5590', side: '#45355e', lvl })
  // gestapelte Kupferspulen
  const coils = 3 + lvl
  for (let i = 0; i < coils; i++) {
    const yy = -i * 4.5
    ctx.strokeStyle = i % 2 ? '#d98b45' : '#b86e2f'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.ellipse(0, yy, 12 - i * 1.2, (12 - i * 1.2) * 0.45, 0, 0, TAU)
    ctx.stroke()
  }
  const top = -coils * 4.5 - 4
  ctx.strokeStyle = '#3a2d4d'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(0, 0); ctx.lineTo(0, top)
  ctx.stroke()
  const a = 0.55 + Math.sin(time * 7) * 0.15 + recoil * 0.4
  glow(ctx, 0, top, 22, 'rgba(200,160,255,A)', a)
  circle(ctx, 0, top, 6 + lvl, def.accent)
  circle(ctx, -1.5, top - 1.5, 2.2, '#ffffff')
  // kleine Funken
  if (Math.sin(time * 13) > 0.6) {
    ctx.strokeStyle = 'rgba(255,240,180,.9)'
    ctx.lineWidth = 1.2
    const fa = time * 20
    ctx.beginPath()
    ctx.moveTo(0, top)
    ctx.lineTo(Math.cos(fa) * 9, top + Math.sin(fa) * 6)
    ctx.lineTo(Math.cos(fa) * 14, top + Math.sin(fa) * 9 + 3)
    ctx.stroke()
  }
}

function drawSniperTower(ctx, def, lvl, angle, recoil) {
  pillar(ctx, { r: 15 + lvl, sides: 4, h: 22 + lvl * 4, top: '#6b8262', side: '#3f5139', lvl, rot: Math.PI / 4 })
  // Brüstung
  ctx.strokeStyle = '#2f3d2a'
  ctx.lineWidth = 3
  poly(ctx, 0, 0, 12 + lvl, 4, Math.PI / 4)
  ctx.stroke()
  ctx.rotate(angle)
  ctx.translate(-recoil * 4, 0)
  ctx.fillStyle = '#1b201a'
  ctx.fillRect(-6, -2.2, 36 + lvl * 4, 4.4)
  ctx.fillStyle = '#0f120e'
  ctx.fillRect(30 + lvl * 4, -3, 4, 6)
  ctx.fillStyle = def.accent
  ctx.fillRect(-2, -5.5, 11, 3.2)
  circle(ctx, 9, -4, 1.8, '#9fe3ff')
  circle(ctx, -4, 0, 7, '#2a3127')
  circle(ctx, -6, -2, 2.2, 'rgba(255,255,255,.2)')
}

function drawPoisonTower(ctx, def, lvl, angle, time, recoil) {
  pillar(ctx, { r: 20 + lvl, sides: 7, h: 9 + lvl * 3, top: '#5f7d48', side: '#3d5230', lvl })
  // Moos auf dem Sockel
  for (let i = 0; i < 5; i++) circle(ctx, Math.cos(i * 1.3) * 15, Math.sin(i * 1.3) * 11, 2.5, 'rgba(120,170,70,.6)')
  // Kessel
  circle(ctx, 0, 1.5, 13 + lvl, '#1e211d')
  circle(ctx, 0, 0, 12.5 + lvl, '#2f332d')
  const g = ctx.createRadialGradient(-3, -3, 1, 0, 0, 11 + lvl)
  g.addColorStop(0, '#c4ff7a')
  g.addColorStop(1, '#4fae2a')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(0, 0, 10 + lvl, 0, TAU)
  ctx.fill()
  for (let i = 0; i < 3; i++) {
    const a = time * 1.3 + i * 2.1
    const r = 1.5 + ((time * 2 + i * 0.33) % 1) * 2.5
    circle(ctx, Math.cos(a) * 5, Math.sin(a) * 4, r, 'rgba(225,255,170,.7)')
  }
  glow(ctx, 0, -6, 18, 'rgba(150,255,90,A)', 0.18)
  // Schleuderarm
  ctx.rotate(angle)
  ctx.rotate(-recoil * 0.9)
  ctx.strokeStyle = '#5a3d22'
  ctx.lineWidth = 4
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(-4, 0)
  ctx.lineTo(19 + lvl * 2, 0)
  ctx.stroke()
  circle(ctx, 20 + lvl * 2, 0, 4.5, '#3c2a17')
  circle(ctx, 20 + lvl * 2, 0, 2.6, def.accent)
}

// Quaderförmiger Sockel (für rechteckige Grundflächen)
function box(ctx, hw, hh, h, top, side, lvl) {
  const sq = 0.82
  const sg = ctx.createLinearGradient(-hw, 0, hw, 0)
  sg.addColorStop(0, shade(side, 0.15))
  sg.addColorStop(1, shade(side, -0.3))
  ctx.fillStyle = sg
  ctx.fillRect(-hw, -h - hh * sq, hw * 2, hh * sq * 2 + h)
  ctx.translate(0, -h)
  const tg = ctx.createLinearGradient(-hw, -hh, hw, hh)
  tg.addColorStop(0, shade(top, 0.25))
  tg.addColorStop(1, shade(top, -0.15))
  ctx.fillStyle = tg
  ctx.fillRect(-hw, -hh * sq, hw * 2, hh * sq * 2)
  ctx.strokeStyle = lvl >= 2 ? '#ffd257' : lvl >= 1 ? 'rgba(241,227,184,.85)' : 'rgba(20,16,10,.5)'
  ctx.lineWidth = 1.5
  ctx.strokeRect(-hw, -hh * sq, hw * 2, hh * sq * 2)
}

function drawBallistaTower(ctx, def, lvl, angle, recoil, rot = 0) {
  // Grundfläche 2 × 1 Zellen (gedreht 1 × 2): Plattform entsprechend lang
  const long = 29, short = 13
  box(ctx, rot % 2 ? short : long, rot % 2 ? long : short, 8 + lvl * 2, '#a07b52', '#6b4c2e', lvl)
  // Holzbohlen auf der Plattform
  ctx.strokeStyle = 'rgba(60,40,20,.45)'
  ctx.lineWidth = 1
  for (let i = -24; i <= 24; i += 6) {
    ctx.beginPath()
    if (rot % 2) { ctx.moveTo(-11, i); ctx.lineTo(11, i) } else { ctx.moveTo(i, -10); ctx.lineTo(i, 10) }
    ctx.stroke()
  }
  ctx.rotate(angle)
  ctx.translate(-recoil * 4, 0)
  const arm = 15 + lvl * 2
  // Schaft
  ctx.fillStyle = '#4a321b'
  ctx.fillRect(-10, -3, 30, 6)
  // Bogenarme
  ctx.strokeStyle = '#3a2614'
  ctx.lineWidth = 4
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(10, 0)
  ctx.quadraticCurveTo(6, -arm * 0.6, 2, -arm)
  ctx.moveTo(10, 0)
  ctx.quadraticCurveTo(6, arm * 0.6, 2, arm)
  ctx.stroke()
  // Sehne
  ctx.strokeStyle = def.accent
  ctx.lineWidth = 1.2
  ctx.beginPath()
  ctx.moveTo(2, -arm)
  ctx.lineTo(-6 + recoil * 8, 0)
  ctx.lineTo(2, arm)
  ctx.stroke()
  // eingelegter Speer
  if (recoil < 0.5) {
    ctx.fillStyle = '#7a5a36'
    ctx.fillRect(-6, -1.4, 30, 2.8)
    ctx.fillStyle = '#d9dde3'
    ctx.beginPath()
    ctx.moveTo(24, -3.5); ctx.lineTo(31, 0); ctx.lineTo(24, 3.5)
    ctx.fill()
  }
  circle(ctx, 0, 0, 4, '#2a1c0e')
}

function drawBannerTower(ctx, def, lvl, time) {
  pillar(ctx, { r: 17 + lvl, sides: 8, h: 8 + lvl * 2, top: '#b9ae96', side: '#7d735f', lvl })
  const pole = 38 + lvl * 6
  ctx.strokeStyle = '#3a2f22'
  ctx.lineWidth = 3
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(0, 0); ctx.lineTo(0, -pole)
  ctx.stroke()
  circle(ctx, 0, -pole - 2, 3, '#ffd257')
  // wehendes Banner
  const w = 22 + lvl * 3, hgt = 16 + lvl * 3
  ctx.fillStyle = def.color
  ctx.beginPath()
  ctx.moveTo(0, -pole + 2)
  for (let i = 0; i <= 8; i++) {
    const xx = (i / 8) * w
    ctx.lineTo(xx, -pole + 2 + Math.sin(time * 4 + i * 0.7) * 2.2 * (i / 8))
  }
  for (let i = 8; i >= 0; i--) {
    const xx = (i / 8) * w
    ctx.lineTo(xx, -pole + 2 + hgt + Math.sin(time * 4 + i * 0.7) * 2.2 * (i / 8) - (i === 8 ? 4 : 0))
  }
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = def.accent
  ctx.lineWidth = 1.2
  ctx.stroke()
  // Emblem
  const ex = w * 0.45, ey = -pole + 2 + hgt / 2 + Math.sin(time * 4 + 3) * 1
  ctx.fillStyle = def.accent
  poly(ctx, ex, ey, 4.5 + lvl * 0.5, 4, 0)
  ctx.fill()
}

function drawTrebuchetTower(ctx, def, lvl, angle, recoil, time) {
  // 3 × 3 Zellen: breites Steinfundament, darauf ein drehbares Holzgerüst mit Wurfarm
  pillar(ctx, { r: 60, sides: 4, h: 10 + lvl * 2, top: '#9a9286', side: '#5f584d', lvl, rot: Math.PI / 4 })
  ctx.fillStyle = 'rgba(0,0,0,.18)'
  for (let i = -30; i <= 30; i += 15) ctx.fillRect(i - 1, -36, 2, 72 * 0.82)
  ctx.rotate(angle)
  // Drehkranz
  circle(ctx, 0, 0, 24, '#5a3d22')
  circle(ctx, 0, 0, 20, '#7a5532')
  // A-Gestell (zwei Seitenwände)
  ctx.fillStyle = '#6b4a2a'
  for (const s of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(-26, s * 16); ctx.lineTo(26, s * 16); ctx.lineTo(4, s * 12); ctx.lineTo(-4, s * 12)
    ctx.closePath()
    ctx.fill()
    ctx.fillRect(-26, s * 16 - (s > 0 ? 0 : 4), 52, 4)
  }
  // Wurfarm: schwingt nach dem Schuss nach vorn
  const swing = recoil > 0 ? recoil : 0
  const armA = Math.PI - 0.5 + swing * 1.4
  const len = 44 + lvl * 4
  ctx.save()
  ctx.rotate(armA)
  ctx.fillStyle = '#4a321b'
  ctx.fillRect(-12, -3.5, len, 7)
  // Gegengewicht
  ctx.fillStyle = '#3d3a36'
  ctx.fillRect(-24, -10, 14, 20)
  ctx.fillStyle = 'rgba(255,255,255,.15)'
  ctx.fillRect(-23, -9, 12, 4)
  // Schlinge mit Stein
  if (swing < 0.3) {
    ctx.strokeStyle = '#2a1c0e'
    ctx.lineWidth = 1.2
    ctx.beginPath()
    ctx.moveTo(len - 12, 0); ctx.lineTo(len - 2, 8)
    ctx.stroke()
    circle(ctx, len - 2, 10, 6 + lvl, '#8d8a80')
    circle(ctx, len - 4, 8, 2, 'rgba(255,255,255,.35)')
  }
  ctx.restore()
  circle(ctx, 0, 0, 5, '#2a1c0e')
}

// ---------------- Gegner ----------------
export function drawEnemy(ctx, e, x, y, time) {
  const def = e.def || ENEMIES[e.type]
  const r = e.radius || def.radius
  const bob = Math.sin(time * 10 + (e.id || 0)) * (def.boss ? 0.6 : 1.2)
  // Flieger schweben: Schatten weiter unten und kleiner, Körper angehoben
  const lift = def.flying ? 10 + Math.sin(time * 4 + (e.id || 0)) * 1.5 : 0
  ctx.save()
  ctx.translate(x, y)
  // Lähm-Puls lädt sich auf: Ring zeigt den betroffenen Umkreis und füllt sich bis zur Auslösung
  if (e.hexCharge > 0 && def.disrupt) drawDisruptCharge(ctx, def.disrupt, 1 - e.hexCharge / def.disrupt.charge, time)
  ctx.fillStyle = def.flying ? 'rgba(0,0,0,.2)' : 'rgba(0,0,0,.3)'
  ctx.beginPath()
  ctx.ellipse(def.flying ? 6 : 2, def.flying ? r * 0.9 : r * 0.55, r * (def.flying ? 0.8 : 1.05), r * (def.flying ? 0.4 : 0.55), 0, 0, TAU)
  ctx.fill()
  ctx.translate(0, bob * 0.5 - lift)
  if (e.frenzy > 0) drawFrenzyAura(ctx, r, time)
  ctx.rotate(e.angle || 0)
  switch (def.id) {
    case 'grunt': drawGrunt(ctx, def, r, time, e); break
    case 'runner': drawRunner(ctx, def, r, time, e); break
    case 'armored': drawArmored(ctx, def, r); break
    case 'swarm': drawSwarm(ctx, def, r, time, e); break
    case 'healer': drawHealer(ctx, def, r, time); break
    case 'ogre': drawOgre(ctx, def, r, time, e); break
    case 'titan': drawTitan(ctx, def, r, time, e); break
    case 'wraith': drawWraith(ctx, def, r, time, e); break
    case 'harpy': drawHarpy(ctx, def, r, time, e); break
    case 'berserker': drawBerserker(ctx, def, r, time, e); break
    case 'hexer': drawHexer(ctx, def, r, time, e); break
  }
  // dunkle Kontur für bessere Lesbarkeit auf jedem Untergrund; Elite-Gegner mit goldenem Doppelrand
  ctx.strokeStyle = 'rgba(15,12,10,.55)'
  ctx.lineWidth = def.boss ? 2 : 1.3
  ctx.beginPath()
  ctx.arc(0, 0, r + 0.5, 0, TAU)
  ctx.stroke()
  if (e.elite) {
    ctx.strokeStyle = '#ffd257'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(0, 0, r + 2.5, 0, TAU)
    ctx.stroke()
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
    circle(ctx, x + Math.sin((e.id || 0) + time * 3) * r * 0.5, y - lift - r - t * 10, 2.2 * (1 - t) + 0.6, `rgba(150,240,90,${0.8 - t * 0.6})`)
  }
  // Elite: kleine Krone über dem Gegner
  if (e.elite) {
    ctx.save()
    ctx.translate(x, y - lift - r - 5)
    ctx.fillStyle = '#ffd257'
    ctx.strokeStyle = 'rgba(40,25,0,.8)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(-5, 2); ctx.lineTo(-5, -3); ctx.lineTo(-2.5, -0.5); ctx.lineTo(0, -4); ctx.lineTo(2.5, -0.5); ctx.lineTo(5, -3); ctx.lineTo(5, 2)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    ctx.restore()
  }
}

// Höhe, um die ein Gegner über dem Boden schwebt (für Lebensbalken)
export const enemyLift = (e) => (e.def.flying ? 10 : 0)

// Raserei (Berserker): flackernde rote Flammenaura
function drawFrenzyAura(ctx, r, time) {
  const g = ctx.createRadialGradient(0, 0, r * 0.6, 0, 0, r * 1.9)
  g.addColorStop(0, 'rgba(255,70,30,.55)')
  g.addColorStop(1, 'rgba(255,70,30,0)')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(0, 0, r * 1.9, 0, TAU)
  ctx.fill()
  ctx.fillStyle = 'rgba(255,150,60,.8)'
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + time * 3
    const fl = r * (1.25 + Math.sin(time * 14 + i * 2) * 0.2)
    ctx.beginPath()
    ctx.moveTo(Math.cos(a - 0.2) * r, Math.sin(a - 0.2) * r)
    ctx.lineTo(Math.cos(a) * fl, Math.sin(a) * fl)
    ctx.lineTo(Math.cos(a + 0.2) * r, Math.sin(a + 0.2) * r)
    ctx.fill()
  }
}

// Aufladen des Lähm-Pulses: gestrichelter Umkreis, der sich von innen füllt (violett = Hexer, braun = Stampfen)
function drawDisruptCharge(ctx, d, k, time) {
  const hex = d.kind === 'hex'
  const col = hex ? '180,110,255' : '230,170,90'
  ctx.save()
  ctx.fillStyle = `rgba(${col},${0.08 + k * 0.16})`
  ctx.beginPath()
  ctx.arc(0, 0, d.radius * k, 0, TAU)
  ctx.fill()
  ctx.strokeStyle = `rgba(${col},${0.5 + k * 0.4})`
  ctx.lineWidth = 2
  ctx.setLineDash([8, 6])
  ctx.lineDashOffset = -time * 30
  ctx.beginPath()
  ctx.arc(0, 0, d.radius, 0, TAU)
  ctx.stroke()
  ctx.restore()
}

// Gelähmter Turm: abgedunkelt mit kreisenden Runen über dem Kopf
export function drawSilenced(ctx, t, x, y, time) {
  const h = muzzleHeight(t.type, t.level) + 10
  ctx.save()
  ctx.translate(x, y - h)
  ctx.globalAlpha = Math.min(1, t.silenced * 3)
  ctx.fillStyle = 'rgba(40,20,70,.6)'
  ctx.beginPath()
  ctx.ellipse(0, 0, 18, 7, 0, 0, TAU)
  ctx.fill()
  ctx.strokeStyle = 'rgba(200,160,255,.9)'
  ctx.lineWidth = 1.5
  ctx.stroke()
  for (let i = 0; i < 3; i++) {
    const a = time * 4 + (i / 3) * TAU
    ctx.fillStyle = '#e6d0ff'
    poly(ctx, Math.cos(a) * 15, Math.sin(a) * 6, 4, 4, a)
    ctx.fill()
  }
  ctx.restore()
  // violetter Schimmer am Fuß: Turm feuert nicht
  ctx.fillStyle = `rgba(150,90,255,${0.18 + Math.sin(time * 8) * 0.06})`
  ctx.beginPath()
  ctx.ellipse(x, y, 22, 14, 0, 0, TAU)
  ctx.fill()
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

// Geist: halb durchsichtiger, flackernder Körper mit Schleppe – zeigt die Resistenz gegen physischen Schaden
function drawWraith(ctx, def, r, time, e) {
  const fl = 0.55 + Math.sin(time * 6 + (e.id || 0)) * 0.12
  ctx.globalAlpha = fl
  ctx.fillStyle = shade(def.color, -0.2)
  ctx.beginPath()
  ctx.moveTo(r * 0.2, -r)
  for (let i = 0; i <= 4; i++) {
    const yy = -r + (i / 4) * r * 2
    const wav = Math.sin(time * 8 + i * 1.7) * r * 0.25
    ctx.lineTo(-r * 1.9 + wav, yy)
  }
  ctx.lineTo(r * 0.2, r)
  ctx.closePath()
  ctx.fill()
  circle(ctx, 0, 0, r, def.color)
  circle(ctx, r * 0.1, 0, r * 0.7, 'rgba(235,250,255,.7)')
  ctx.globalAlpha = 1
  circle(ctx, r * 0.45, -r * 0.3, 2.2, '#1e3f66')
  circle(ctx, r * 0.45, r * 0.3, 2.2, '#1e3f66')
}

// Harpyie: Flügel schlagen, Krallen und Schnabel in Flugrichtung
function drawHarpy(ctx, def, r, time, e) {
  const flap = Math.sin(time * 14 + (e.id || 0)) * 0.5
  ctx.fillStyle = shade(def.color, -0.25)
  for (const s of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(r * 0.2, s * r * 0.3)
    ctx.quadraticCurveTo(-r * 0.2, s * r * (1.8 + flap), -r * 1.3, s * r * (1.6 + flap))
    ctx.lineTo(-r * 0.7, s * r * 0.9)
    ctx.lineTo(-r * 0.5, s * r * 0.3)
    ctx.closePath()
    ctx.fill()
  }
  ctx.fillStyle = def.color
  ctx.beginPath()
  ctx.ellipse(0, 0, r * 1.05, r * 0.7, 0, 0, TAU)
  ctx.fill()
  circle(ctx, r * 0.7, 0, r * 0.42, '#c9b98f')
  ctx.fillStyle = '#e8b94a'
  ctx.beginPath()
  ctx.moveTo(r * 1.05, -r * 0.15); ctx.lineTo(r * 1.45, 0); ctx.lineTo(r * 1.05, r * 0.15)
  ctx.fill()
  circle(ctx, r * 0.8, -r * 0.16, 1.4, '#2a1630')
  circle(ctx, r * 0.8, r * 0.16, 1.4, '#2a1630')
}

// Berserker: breite Schultern, zwei Äxte
function drawBerserker(ctx, def, r, time, e) {
  feet(ctx, r, time, e.frenzy > 0 ? 20 : 12, '#4a1a10')
  ctx.fillStyle = shade(def.color, -0.35)
  ctx.beginPath()
  ctx.ellipse(0, 0, r * 0.9, r * 1.1, 0, 0, TAU)
  ctx.fill()
  circle(ctx, -r * 0.05, 0, r * 0.8, def.color)
  // Fellkragen und Kopf
  circle(ctx, r * 0.1, 0, r * 0.5, '#6b4a2a')
  circle(ctx, r * 0.3, 0, r * 0.36, '#e0a77a')
  ctx.fillStyle = '#efe6d2'
  for (const s of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(r * 0.25, s * r * 0.3)
    ctx.lineTo(r * 0.45, s * r * 0.7)
    ctx.lineTo(r * 0.45, s * r * 0.3)
    ctx.fill()
  }
  // Äxte
  for (const s of [-1, 1]) {
    ctx.fillStyle = '#5a3a1e'
    ctx.fillRect(r * 0.1, s * r * 0.95 - 1.2, r * 1.0, 2.4)
    ctx.fillStyle = '#cfd3d8'
    ctx.beginPath()
    ctx.moveTo(r * 1.0, s * r * 0.95)
    ctx.quadraticCurveTo(r * 1.45, s * r * 0.55, r * 1.3, s * r * 0.95)
    ctx.quadraticCurveTo(r * 1.45, s * r * 1.35, r * 1.0, s * r * 0.95)
    ctx.fill()
  }
}

// Runenhexer: Kapuzenrobe, Runenstab mit leuchtendem Kristall
function drawHexer(ctx, def, r, time, e) {
  feet(ctx, r, time, 10, '#2a1640')
  ctx.fillStyle = shade(def.color, -0.4)
  poly(ctx, 0, 0, r * 1.05, 3, Math.PI)
  ctx.fill()
  circle(ctx, 0, 0, r * 0.8, def.color)
  circle(ctx, r * 0.15, 0, r * 0.5, '#2a1640')
  // Rune auf dem Rücken
  ctx.strokeStyle = '#d9b8ff'
  ctx.lineWidth = 1.4
  ctx.beginPath()
  ctx.moveTo(-r * 0.55, -r * 0.3); ctx.lineTo(-r * 0.25, 0); ctx.lineTo(-r * 0.55, r * 0.3)
  ctx.moveTo(-r * 0.25, -r * 0.35); ctx.lineTo(-r * 0.25, r * 0.35)
  ctx.stroke()
  // Stab
  ctx.strokeStyle = '#5a3a1e'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(-r * 0.3, r * 0.85)
  ctx.lineTo(r * 1.25, r * 0.85)
  ctx.stroke()
  const glow = e.hexCharge > 0 ? 1 : 0.55 + Math.sin(time * 5) * 0.2
  circle(ctx, r * 1.35, r * 0.85, 4.5, `rgba(190,130,255,${glow * 0.5})`)
  circle(ctx, r * 1.35, r * 0.85, 2.6, '#f0ddff')
}

// Lebensbalken über einem Gegner
export function drawHealthBar(ctx, e, x, y) {
  const r = e.radius
  const w = Math.max(18, r * 2.2), h = e.boss ? 5 : 3.5
  const bx = x - w / 2, by = y - r - (e.boss ? 14 : 9) - enemyLift(e) - (e.elite ? 8 : 0)
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

// Höhe des Turmkopfs über dem Boden – dort starten Geschosse und Strahlen
export function muzzleHeight(type, level = 0) {
  return baseMuzzle(type, level) * (TOWERS[type].spriteScale || 1)
}

function baseMuzzle(type, level) {
  switch (type) {
    case 'sniper': return 22 + level * 4
    case 'lightning': return 10 + level * 3 + (3 + level) * 4.5 + 4
    case 'frost': return 20 + level * 6
    case 'cannon': return 11 + level * 3
    case 'banner': return 0
    case 'trebuchet': return 34
    default: return 10 + level * 3
  }
}

// ---------------- Geschosse ----------------
export function drawProjectile(ctx, p, x, y) {
  // Start auf Kopfhöhe des Turms, auf den ersten ~150 px zum Boden absinkend
  const h0 = p.tower ? muzzleHeight(p.tower.type, p.tower.level) * Math.max(0, 1 - (p.traveled || 0) / 150) : 0
  const lift = (p.arc ? Math.sin(Math.PI * (p.progress || 0)) * p.arc : 0) + h0
  if (lift) {
    ctx.fillStyle = 'rgba(0,0,0,.25)'
    ctx.beginPath()
    ctx.ellipse(x, y, 4, 2.5, 0, 0, TAU)
    ctx.fill()
  }
  const py = y - lift
  // Flugspur
  if (p.kind === 'arrow' || p.kind === 'bolt' || p.kind === 'shard') {
    const len = p.kind === 'bolt' ? 34 : 20
    const g = ctx.createLinearGradient(x, py, x - Math.cos(p.angle) * len, py - Math.sin(p.angle) * len)
    g.addColorStop(0, p.kind === 'shard' ? 'rgba(200,240,255,.55)' : 'rgba(255,250,230,.45)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.strokeStyle = g
    ctx.lineWidth = p.kind === 'bolt' ? 3 : 2
    ctx.beginPath()
    ctx.moveTo(x, py)
    ctx.lineTo(x - Math.cos(p.angle) * len, py - Math.sin(p.angle) * len)
    ctx.stroke()
  }
  switch (p.kind) {
    case 'bolt':
      ctx.save()
      ctx.translate(x, py)
      ctx.rotate(p.angle)
      ctx.fillStyle = '#7a5a36'
      ctx.fillRect(-18, -1.6, 26, 3.2)
      ctx.fillStyle = '#d9dde3'
      ctx.beginPath()
      ctx.moveTo(8, -4); ctx.lineTo(16, 0); ctx.lineTo(8, 4)
      ctx.fill()
      ctx.fillStyle = '#c0392b'
      ctx.fillRect(-19, -3.5, 4, 7)
      ctx.restore()
      break
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
    case 'boulder':
      circle(ctx, x, py, 8.5, '#6f6a60')
      circle(ctx, x - 2, py - 2, 3, 'rgba(255,255,255,.35)')
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
  // Mauerseiten (Tiefe nach unten), dann die Mauerkrone
  ctx.fillStyle = '#6f6553'
  ctx.fillRect(-40, -28, 80, 80)
  ctx.strokeStyle = 'rgba(0,0,0,.25)'
  ctx.lineWidth = 1
  for (let yy = 44; yy < 52; yy += 4) { ctx.beginPath(); ctx.moveTo(-40, yy); ctx.lineTo(40, yy); ctx.stroke() }
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
    circle(ctx, cx, cy + 10, 15, '#554c3e')
    ctx.fillStyle = '#5f5647'
    ctx.fillRect(cx - 15, cy, 30, 10)
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
  // Türme sind in der 3/4-Ansicht höher als breit: etwas verkleinert und nach unten versetzt
  // Türme unterschiedlicher Größe einheitlich ins Icon einpassen
  const k = TOWERS[type].spriteScale || 1
  const fit = type === 'trebuchet' ? 0.36 : 0.72 / k
  ctx.translate(28, type === 'trebuchet' ? 34 : 41)
  ctx.scale(fit, fit)
  drawTower(ctx, { type, level, angle: -Math.PI / 4, fireAnim: 0, noPips: true }, 0, 0, 0.6)
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
