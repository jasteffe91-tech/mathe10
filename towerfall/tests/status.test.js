// Statuseffekte (status.js) und die Türme, die sie nutzen: Brand, Schleim, Gift, Verlangsamung, Schock,
// Einfrieren – Erneuerungsregeln, Grenzen, Immunitäten, Ablauf, Tod während eines Effekts, Pause/Tempo.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Game } from '../js/game/game.js'
import { TOWERS, TOWER_ORDER } from '../js/config/towers.js'
import { ENEMIES } from '../js/config/enemies.js'
import { BALANCE } from '../js/config/balance.js'
import { applyStatus, getStatus, movementFactor, slowOf, isStunned } from '../js/game/status.js'
import { currentSpeed, updateEnemy } from '../js/game/enemies.js'
import { updateTower } from '../js/game/towers.js'
import { GameLoop } from '../js/core/loop.js'

const DT = 1 / 60

function spawn(g, type, opts = {}) {
  g.queueSpawn(type, opts)
  g.flushSpawns()
  return g.enemies[g.enemies.length - 1]
}
// Gegner auf der Stelle halten (Bewegung soll Tests nicht verfälschen)
const pin = (e, dist) => { e.def = { ...e.def, speed: 0 }; if (dist !== undefined) e.dist = dist }
function buildNear(g, type, x, y) {
  g.wallet.gold = 1e6
  const p = g.findPlacementNear(type, x, y, 0, 20)
  assert.ok(p, `kein Platz für ${type}`)
  assert.ok(g.build(type, p.c, p.r, 0).ok)
  return g.towers[g.towers.length - 1]
}
const steps = (fn, n) => { for (let i = 0; i < n; i++) fn() }

test('Brand: stapelt bis 3 Stufen, erneuert die Dauer, endet zuverlässig', () => {
  const g = new Game()
  const e = spawn(g, 'armored', { hpScale: 50 })
  pin(e)
  for (let i = 0; i < 5; i++) applyStatus(e, 'burn', { dps: 4, duration: 2 })
  const b = getStatus(e, 'burn')
  assert.equal(b.stacks, 3, 'nie mehr als 3 Stufen')
  assert.equal(b.time, 2)
  applyStatus(e, 'burn', { dps: 2, duration: 2 })
  assert.equal(getStatus(e, 'burn').dps, 4, 'schwächerer Brand senkt die Stärke nicht')
  // Schaden über die ganze Dauer = 3 × 4 × 2 (Panzerung zählt bei Brand nicht)
  const hp = e.hp
  steps(() => updateEnemy(e, DT, g), 130)
  assert.ok(Math.abs(hp - e.hp - 24) < 1e-6, `Brandschaden ${hp - e.hp}`)
  assert.equal(getStatus(e, 'burn'), null, 'nach Ablauf entfernt')
  assert.equal(e.effects.length, 0)
})

test('Tod während eines Effekts: Effekte enden, Kill wird genau einmal gezählt', () => {
  const g = new Game()
  const e = spawn(g, 'grunt')
  pin(e)
  e.hp = 3
  applyStatus(e, 'burn', { dps: 10, duration: 5 })
  applyStatus(e, 'poison', { dps: 10, duration: 5 })
  applyStatus(e, 'slime', { slow: 0.3, dps: 5, duration: 5 })
  const kills = g.stats.kills
  steps(() => { if (e.alive) updateEnemy(e, DT, g) }, 120)
  assert.equal(e.alive, false)
  assert.equal(e.effects.length, 0)
  assert.equal(g.stats.kills, kills + 1)
})

test('Schleim: neuer Treffer erneuert die Dauer, Stärken addieren sich nicht – auch nicht mit Frost', () => {
  const g = new Game()
  const e = spawn(g, 'grunt')
  applyStatus(e, 'slime', { slow: 0.3, dps: 2, duration: 6 })
  steps(() => updateEnemy(e, DT, g), 120)
  assert.ok(Math.abs(getStatus(e, 'slime').time - 4) < 0.02)
  applyStatus(e, 'slime', { slow: 0.25, dps: 2, duration: 6 })
  assert.equal(getStatus(e, 'slime').time, 6, 'Dauer beginnt neu')
  assert.equal(getStatus(e, 'slime').slow, 0.3, 'Stärke bleibt die stärkere')
  applyStatus(e, 'slow', { slow: 0.4, duration: 2 })
  assert.equal(slowOf(e), 0.4, 'es wirkt die stärkste Verlangsamung, keine Summe')
  assert.ok(Math.abs(currentSpeed(e) - ENEMIES.grunt.speed * 0.6) < 1e-9)
  // Deckel
  applyStatus(e, 'slow', { slow: 0.99, duration: 2 })
  assert.ok(movementFactor(e) >= 1 - BALANCE.maxSlow - 1e-9)
  // Bosse mit slowResist werden schwächer gebremst
  const o = spawn(g, 'ogre')
  applyStatus(o, 'slime', { slow: 0.4, duration: 6 })
  assert.ok(Math.abs(movementFactor(o) - (1 - 0.4 * (1 - ENEMIES.ogre.slowResist))) < 1e-9)
})

test('Schock: Gegner bleibt stehen, danach Immunität; Bosse nur kurz und länger immun', () => {
  const g = new Game()
  const e = spawn(g, 'grunt')
  assert.equal(applyStatus(e, 'shock', { duration: 0.5 }), true)
  assert.ok(isStunned(e))
  assert.equal(currentSpeed(e), 0)
  const d0 = e.dist
  steps(() => updateEnemy(e, DT, g), 25)
  assert.equal(e.dist, d0, 'steht während des Schocks')
  steps(() => updateEnemy(e, DT, g), 10)
  assert.ok(!isStunned(e))
  assert.ok(e.dist > d0, 'läuft danach weiter')
  assert.equal(applyStatus(e, 'shock', { duration: 0.5 }), false, 'direkt danach immun')
  assert.equal(applyStatus(e, 'freeze', { duration: 0.5 }), false, 'Immunität gilt für jede Betäubung')
  steps(() => updateEnemy(e, DT, g), Math.ceil(BALANCE.stun.immunity * 60) + 2)
  assert.equal(applyStatus(e, 'shock', { duration: 0.5 }), true, 'nach der Immunität wieder betäubbar')
  // Boss
  const t = spawn(g, 'titan')
  applyStatus(t, 'shock', { duration: 1 })
  const s = getStatus(t, 'shock')
  assert.ok(s.time < 0.35, `Titan steht nur ${s.time.toFixed(2)} s`)
  steps(() => updateEnemy(t, DT, g), 30)
  assert.ok(Math.abs(t.stunImmune - BALANCE.stun.bossImmunity) < 0.5)
})

test('Raserei: immun gegen Bremsen und Betäubung, Schaden über Zeit wirkt weiter', () => {
  const g = new Game()
  const b = spawn(g, 'berserker')
  b.frenzy = 2
  assert.equal(applyStatus(b, 'slow', { slow: 0.5, duration: 2 }), false)
  assert.equal(applyStatus(b, 'shock', { duration: 0.5 }), false)
  assert.equal(applyStatus(b, 'freeze', { duration: 0.5 }), false)
  assert.equal(applyStatus(b, 'slime', { slow: 0.3, duration: 4 }), false)
  assert.equal(applyStatus(b, 'burn', { dps: 3, duration: 2 }), true)
  assert.equal(applyStatus(b, 'poison', { dps: 3, duration: 2 }), true)
  assert.equal(movementFactor(b), 1)
})

test('Frost: Kälte sammelt sich, bei genug Treffern friert der Gegner kurz ein', () => {
  const g = new Game()
  const e = spawn(g, 'grunt', { dist: 300 })
  pin(e, 300)
  const t = buildNear(g, 'frost', e.x, e.y)
  const s = t.stats
  let frozenAt = 0
  for (let shot = 1; shot <= 20 && !frozenAt; shot++) {
    t.cooldown = 0
    updateTower(t, DT, g)
    // Geschoss fliegen lassen
    for (let i = 0; i < 120 && g.projectiles.some((p) => p.alive); i++) g.step(DT)
    if (getStatus(e, 'freeze')) frozenAt = shot
  }
  assert.ok(frozenAt > 0, 'friert irgendwann ein')
  assert.ok(frozenAt <= s.freezeHits + 1, `erst nach ${frozenAt} Treffern eingefroren (Soll ${s.freezeHits})`)
  assert.equal(getStatus(e, 'chill'), null, 'Kälte zurückgesetzt')
  assert.ok(isStunned(e))
})

test('Effekte laufen nur in der Simulation: Pause hält sie an, Tempo ändert die Spielzeit nicht', () => {
  const g = new Game()
  const e = spawn(g, 'armored', { hpScale: 50, dist: 50 })
  pin(e, 50)
  applyStatus(e, 'burn', { dps: 3, duration: 3 })
  const loop = new GameLoop({ update: (dt) => g.step(dt), render: () => {} })
  loop.last = 0
  loop.paused = true
  for (let t = 16; t <= 2000; t += 16) loop.tick(t)
  assert.equal(getStatus(e, 'burn').time, 3, 'pausiert: Effekt unverändert')
  loop.paused = false
  loop.speed = 3
  let frames = 0
  for (let t = 2016; getStatus(e, 'burn') && frames < 1000; t += 1000 / 60) { loop.tick(t); frames++ }
  // 3 s Spielzeit bei 3-fachem Tempo ≈ 60 Bilder
  assert.ok(frames >= 58 && frames <= 62, `${frames} Bilder`)
})

test('Flammenwerfer: trifft alle Gegner im Kegel, keine außerhalb von Kegel oder Reichweite', () => {
  const g = new Game()
  const a = spawn(g, 'armored', { dist: 400, hpScale: 50 }); pin(a, 400)
  const t = buildNear(g, 'flame', a.x, a.y)
  // Gegner an kontrollierten Positionen um den Turm: im Kegel nah, im Kegel weiter, hinter dem Turm, zu weit
  const dir = Math.atan2(a.y - t.y, a.x - t.x)
  const place = (e, ang, dist) => { e.x = t.x + Math.cos(ang) * dist; e.y = t.y + Math.sin(ang) * dist }
  const inCone = spawn(g, 'armored', { hpScale: 50 }); pin(inCone)
  const behind = spawn(g, 'armored', { hpScale: 50 }); pin(behind)
  const far = spawn(g, 'armored', { hpScale: 50 }); pin(far)
  const s = t.stats
  for (const e of g.enemies) e.route = { ...e.route, length: 1e9 }
  place(a, dir, s.range * 0.4)                                           // Ziel (der nächste Gegner)
  place(inCone, dir + (s.cone * Math.PI) / 360 * 0.6, s.range * 0.8)     // im Kegel, weiter weg
  place(behind, dir + Math.PI, s.range * 0.6)                            // in Reichweite, aber hinter dem Turm
  place(far, dir, s.range + 60)
  t.cooldown = 0
  t.targetMode = 'close'
  g.enemies.forEach((e) => { e.dist = 0 })
  const before = g.enemies.map((e) => e.hp)
  // Turm feuert direkt (ohne Bewegung der Gegner)
  updateTower(t, DT, g)
  const hit = g.enemies.map((e, i) => before[i] - e.hp > 0)
  assert.deepEqual(hit, [true, true, false, false], JSON.stringify(hit))
  assert.ok(getStatus(a, 'burn') && getStatus(inCone, 'burn'))
  assert.equal(getStatus(behind, 'burn'), null)
})

test('Tesla-Spule: trifft die nächsten Gegner im Umkreis, jeden nur einmal, mit Schock', () => {
  const g = new Game()
  const center = spawn(g, 'grunt', { dist: 400 }); pin(center, 400)
  const t = buildNear(g, 'tesla', center.x, center.y)
  const s = t.stats
  const extra = []
  for (let i = 0; i < s.maxTargets + 3; i++) { const e = spawn(g, 'armored', { hpScale: 50 }); pin(e); extra.push(e) }
  // im Kreis um den Turm verteilen, zwei außerhalb der Reichweite
  g.enemies.forEach((e, i) => {
    const d = i < g.enemies.length - 2 ? s.range * (0.3 + 0.05 * i) : s.range + 80
    e.x = t.x + Math.cos(i) * d; e.y = t.y + Math.sin(i) * d
  })
  const hp = g.enemies.map((e) => e.hp)
  const events = []
  g.on('pulse', ({ points }) => events.push(points.length))
  t.cooldown = 0
  updateTower(t, DT, g)
  const hits = g.enemies.filter((e, i) => e.hp < hp[i])
  assert.equal(hits.length, s.maxTargets, 'höchstens maxTargets Gegner')
  assert.deepEqual(events, [s.maxTargets])
  assert.ok(hits.every((e) => getStatus(e, 'shock')))
  const outside = g.enemies.slice(-2)
  assert.ok(outside.every((e, i) => e.hp === hp[hp.length - 2 + i]), 'außerhalb der Reichweite unberührt')
})

test('Kettenblitz trifft keinen Gegner doppelt', () => {
  const g = new Game()
  const first = spawn(g, 'armored', { dist: 400, hpScale: 50 }); pin(first, 400)
  const t = buildNear(g, 'lightning', first.x, first.y)
  g.upgrade(t); g.upgrade(t)
  // nur zwei Gegner, aber 6 Sprünge: jeder darf genau einmal getroffen werden
  const second = spawn(g, 'armored', { hpScale: 50 }); pin(second)
  second.x = first.x + 20; second.y = first.y
  const counts = new Map()
  g.on('chain', ({ points }) => { for (const p of points.slice(1)) counts.set(`${Math.round(p.x)},${Math.round(p.y)}`, (counts.get(`${Math.round(p.x)},${Math.round(p.y)}`) || 0) + 1) })
  t.cooldown = 0
  updateTower(t, DT, g)
  assert.equal(counts.size, 2)
  assert.ok([...counts.values()].every((n) => n === 1))
})

test('Schleimwerfer: Treffer verschleimt das Ziel', () => {
  const g = new Game()
  const e = spawn(g, 'grunt', { dist: 300 }); pin(e, 300)
  const t = buildNear(g, 'slime', e.x, e.y)
  t.cooldown = 0
  for (let i = 0; i < 120 && !getStatus(e, 'slime'); i++) g.step(DT)
  const s = getStatus(e, 'slime')
  assert.ok(s, 'verschleimt')
  assert.equal(s.slow, t.stats.slimeSlow)
})

test('Alle 12 Türme lassen sich bauen und voll verbessern; Gold wird genau einmal abgezogen', () => {
  assert.equal(TOWER_ORDER.length, 12)
  for (const type of TOWER_ORDER) {
    const g = new Game()
    g.wallet.gold = 5000
    const p = g.findPlacementNear(type, 640, 360, 0, 20)
    const before = g.gold
    assert.ok(g.build(type, p.c, p.r, 0).ok, type)
    assert.equal(g.gold, before - TOWERS[type].levels[0].cost, type)
    const t = g.towers[0]
    for (let l = 1; l < TOWERS[type].levels.length; l++) {
      const b = g.gold
      assert.ok(g.upgrade(t).ok)
      assert.equal(g.gold, b - TOWERS[type].levels[l].cost)
    }
    // jede Stufe hat die Pflichtwerte
    for (const l of TOWERS[type].levels) {
      assert.ok(l.cost > 0 && l.range > 0, `${type}: Kosten/Reichweite`)
      if (TOWERS[type].attack !== 'aura') assert.ok(l.damage > 0 && l.rate > 0, `${type}: Schaden/Rate`)
    }
  }
})
