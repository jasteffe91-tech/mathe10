// Spielmechanik-Tests (Node, ohne Browser): node --test tests/
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Game } from '../js/game/game.js'
import { TOWERS, TOWER_ORDER } from '../js/config/towers.js'
import { ENEMIES } from '../js/config/enemies.js'
import { WAVE_SETS } from '../js/config/waves.js'
import { BALANCE, DIFFICULTIES } from '../js/config/balance.js'
import { MAPS } from '../js/config/maps.js'
import { createEnemy, placeEnemy, damageEnemy } from '../js/game/enemies.js'
import { sellValue } from '../js/game/economy.js'

const DT = 1 / 60
const run = (game, seconds, each) => {
  for (let i = 0; i < seconds * 60 && game.status === 'playing'; i++) { game.step(DT); each?.(game) }
}

// Gegner direkt auf die Route setzen (für gezielte Tests)
function addEnemy(game, type, dist, hpScale = 1) {
  const e = createEnemy(ENEMIES[type], { id: game.nextId++, hpScale, dist })
  placeEnemy(e, game.route)
  e.px = e.x; e.py = e.y
  game.enemies.push(e)
  return e
}

// Strecke auf der Route, die einem Bauplatz am nächsten liegt
function nearestDist(game, spot) {
  let best = 0, bestD = Infinity
  const p = {}
  for (let d = 0; d < game.route.length; d += 2) {
    game.route.sample(d, p)
    const dd = (p.x - spot.x) ** 2 + (p.y - spot.y) ** 2
    if (dd < bestD) { bestD = dd; best = d }
  }
  return best
}

test('Konfiguration: mindestens 6 Türme, 5 Gegnertypen, 15–20 Wellen, Bosswellen', () => {
  assert.ok(TOWER_ORDER.length >= 6)
  for (const t of TOWER_ORDER) {
    assert.ok(TOWERS[t].levels.length >= 3, `${t} braucht mindestens zwei Verbesserungsstufen`)
    for (const l of TOWERS[t].levels) assert.ok(l.cost > 0 && l.range > 0 && l.rate > 0)
    assert.ok(TOWERS[t].description.length > 10)
  }
  const regular = Object.values(ENEMIES).filter((e) => !e.boss)
  assert.ok(regular.length >= 5)
  assert.ok(Object.values(ENEMIES).some((e) => e.boss))
  const waves = WAVE_SETS.classic
  assert.ok(waves.length >= 15 && waves.length <= 25)
  const bossWaves = waves.map((w, i) => (w.groups.some((g) => ENEMIES[g.type].boss) ? i + 1 : 0)).filter(Boolean)
  assert.deepEqual(bossWaves, [5, 10, 15, 20])
  for (const w of waves) for (const g of w.groups) assert.ok(ENEMIES[g.type], `unbekannter Gegner ${g.type}`)
})

test('Karten: Bauplätze liegen neben dem Weg, nicht darauf, und überlappen nicht', () => {
  for (const m of MAPS) {
    const g = new Game({ mapId: m.id })
    for (const s of g.spots) {
      const d = g.route.distanceTo(s.x, s.y)
      assert.ok(d >= m.pathWidth / 2 + 30, `${m.id} Platz ${s.index} zu nah am Weg (${d.toFixed(0)})`)
      assert.ok(g.route.coverage(s.x, s.y, 140) > 0, `${m.id} Platz ${s.index} erreicht den Weg nicht`)
      assert.ok(s.x > 20 && s.x < 1260 && s.y > 20 && s.y < 700, `${m.id} Platz ${s.index} am Rand`)
      for (const o of g.spots) if (o !== s) assert.ok(Math.hypot(o.x - s.x, o.y - s.y) >= 64, `${m.id} Plätze ${s.index}/${o.index} überlappen`)
      assert.ok(Math.hypot(m.base.x - s.x, m.base.y - s.y) >= 80, `${m.id} Platz ${s.index} auf der Bastion`)
    }
    assert.ok(g.spots.length >= 12)
    assert.ok(g.route.length > 1500)
  }
})

test('Route: Position und Länge sind stetig', () => {
  const g = new Game()
  const p = {}, q = {}
  for (let d = 0; d < g.route.length; d += 5) {
    g.route.sample(d, p)
    g.route.sample(d + 5, q)
    assert.ok(Math.hypot(q.x - p.x, q.y - p.y) <= 5.01)
  }
})

test('Bauen: kostet Gold, Bauplatz wird belegt, zweiter Turm auf demselben Platz verboten', () => {
  const g = new Game()
  const start = g.gold
  const r = g.build(0, 'arrow')
  assert.ok(r.ok)
  assert.equal(g.gold, start - TOWERS.arrow.levels[0].cost)
  assert.equal(g.spots[0].tower, r.tower)
  const again = g.build(0, 'cannon')
  assert.equal(again.ok, false)
  assert.match(again.reason, /schon/)
})

test('Unzureichendes Gold verhindert den Bau mit verständlicher Begründung', () => {
  const g = new Game()
  g.wallet.gold = 50
  const check = g.canBuild(1, 'sniper')
  assert.equal(check.ok, false)
  assert.equal(check.missing, TOWERS.sniper.levels[0].cost - 50)
  assert.match(check.reason, /fehlen \d+ Gold/)
  const r = g.build(1, 'sniper')
  assert.equal(r.ok, false)
  assert.equal(g.gold, 50)
  assert.equal(g.spots[1].tower, null)
})

test('Türme greifen nur Gegner in Reichweite an', () => {
  const g = new Game()
  const spot = g.spots[0]
  g.build(0, 'arrow')
  const far = addEnemy(g, 'grunt', g.route.length - 30) // am Ziel, weit weg
  far.dist = g.route.length - 30
  const fired = []
  g.on('shot', (d) => fired.push(d))
  // Gegner anhalten, damit er nicht ins Ziel läuft
  far.def = { ...far.def, speed: 0 }
  run(g, 1)
  assert.equal(fired.length, 0, 'darf nicht auf Gegner außerhalb der Reichweite schießen')
  const near = addEnemy(g, 'grunt', nearestDist(g, spot))
  near.def = { ...near.def, speed: 0 }
  run(g, 1)
  assert.ok(fired.length > 0)
  assert.ok(fired.every((f) => f.target === near))
})

test('Besiegte Gegner geben Gold und werden entfernt; niemand schießt auf Tote', () => {
  const g = new Game()
  g.build(0, 'arrow')
  const e = addEnemy(g, 'grunt', nearestDist(g, g.spots[0]))
  e.def = { ...e.def, speed: 0 }
  const goldBefore = g.gold
  let shotsAtDead = 0
  g.on('shot', ({ target }) => { if (!target.alive) shotsAtDead++ })
  run(g, 6)
  assert.equal(e.alive, false)
  assert.equal(g.enemies.includes(e), false)
  assert.equal(g.gold, goldBefore + ENEMIES.grunt.reward)
  assert.equal(g.stats.kills, 1)
  assert.equal(shotsAtDead, 0)
})

test('Gegner erreichen das Ziel und kosten Leben', () => {
  const g = new Game()
  const lives = g.lives
  addEnemy(g, 'grunt', g.route.length - 0.3)
  addEnemy(g, 'armored', g.route.length - 0.3)
  g.step(DT)
  assert.equal(g.lives, lives - ENEMIES.grunt.damage - ENEMIES.armored.damage)
  assert.equal(g.enemies.length, 0)
  assert.equal(g.stats.leaked, 2)
})

test('Verbessern: kostet Gold, erhöht Stufe und Werte; Höchststufe ist begrenzt', () => {
  const g = new Game()
  g.wallet.gold = 10000
  const t = g.build(0, 'cannon').tower
  const d1 = TOWERS.cannon.levels[0].damage
  assert.ok(g.upgrade(t).ok)
  assert.equal(t.level, 1)
  assert.ok(TOWERS.cannon.levels[1].damage > d1)
  assert.ok(g.upgrade(t).ok)
  const r = g.upgrade(t)
  assert.equal(r.ok, false)
  assert.equal(r.max, true)
  const expected = TOWERS.cannon.levels.reduce((s, l) => s + l.cost, 0)
  assert.equal(t.invested, expected)
  assert.equal(g.gold, 10000 - expected)
})

test('Verbessern ohne genug Gold scheitert', () => {
  const g = new Game()
  const t = g.build(0, 'arrow').tower
  g.wallet.gold = 1
  const r = g.upgrade(t)
  assert.equal(r.ok, false)
  assert.equal(t.level, 0)
  assert.equal(g.gold, 1)
})

test('Verkauf erstattet 70 % des investierten Goldes und gibt den Platz frei', () => {
  const g = new Game()
  g.wallet.gold = 1000
  const t = g.build(3, 'frost').tower
  g.upgrade(t)
  const invested = t.invested
  const before = g.gold
  const r = g.sell(t)
  assert.ok(r.ok)
  assert.equal(r.value, Math.floor(invested * BALANCE.sellRefund))
  assert.equal(r.value, sellValue(invested))
  assert.equal(g.gold, before + r.value)
  assert.equal(g.spots[3].tower, null)
  assert.equal(g.towers.length, 0)
})

test('Die erste Welle wartet auf den Spieler', () => {
  const g = new Game()
  run(g, 30)
  assert.equal(g.wave, 0, 'erste Welle startet nicht von selbst')
  assert.equal(g.enemies.length, 0)
  assert.ok(g.callNextWave().ok)
  assert.equal(g.wave, 1)
})

test('Wellenende, Pause und automatischer Start der nächsten Welle', () => {
  const g = new Game()
  g.wallet.gold = 100000
  for (const s of g.spots) g.build(s.index, 'arrow')
  g.callNextWave()
  let ended = 0
  g.on('waveEnd', () => ended++)
  for (let i = 0; i < 60 * 120 && !ended; i++) g.step(DT)
  assert.equal(ended, 1)
  assert.equal(g.phase, 'countdown')
  const goldBefore = g.gold
  const r = g.callNextWave()
  assert.ok(r.ok)
  assert.ok(r.bonus > 0, 'frühzeitiger Start gibt Bonus')
  assert.equal(g.gold, goldBefore + r.bonus)
  assert.equal(g.wave, 2)
  // Ohne Eingreifen startet nach der Pause die nächste Welle selbst
  for (let i = 0; i < 60 * 120 && g.wave === 2; i++) g.step(DT)
  assert.equal(g.wave, 3)
})

test('Während Gegner noch erscheinen, kann die nächste Welle nicht gerufen werden', () => {
  const g = new Game()
  g.callNextWave()
  g.step(DT)
  const r = g.callNextWave()
  assert.equal(r.ok, false)
  assert.match(r.reason, /Warte/)
})

test('Bossgegner: erscheint in Welle 5, ruft Helfer, wird wütend und zählt als Boss', () => {
  const g = new Game()
  const boss = addEnemy(g, 'ogre', 100, 1)
  let summons = 0, enraged = 0
  g.on('summon', () => summons++)
  g.on('enrage', () => enraged++)
  run(g, 8)
  assert.ok(summons >= 1)
  assert.ok(g.enemies.some((e) => e.type === 'swarm'))
  boss.hp = boss.maxHp * 0.2
  g.step(DT)
  assert.equal(enraged, 1)
  assert.equal(boss.enraged, true)
  const preview = new Game()
  preview.waves.started = 4
  assert.equal(preview.nextWavePreview().boss, true)
})

test('Panzerung reduziert Pfeilschaden, Scharfschützen durchschlagen sie', () => {
  const g = new Game()
  const a = addEnemy(g, 'armored', 10)
  const b = addEnemy(g, 'armored', 10)
  const hp = a.hp
  const src = { damageDealt: 0, kills: 0 }
  damageEnemy(g, a, 8, { source: src })
  damageEnemy(g, b, 8, { pierce: 1, source: src })
  assert.equal(a.hp, hp - (8 - ENEMIES.armored.armor))
  assert.equal(b.hp, hp - 8)
  assert.equal(src.damageDealt, 8 - ENEMIES.armored.armor + 8)
  // Mindestschaden: auch starke Panzerung lässt einen Rest durch
  const c = addEnemy(g, 'titan', 10)
  const before = c.hp
  damageEnemy(g, c, 4, {})
  assert.ok(before - c.hp >= 4 * BALANCE.minDamageRatio - 1e-9)
})

test('Frost verlangsamt, Gift schadet über Zeit', () => {
  const g = new Game()
  g.wallet.gold = 10000
  const spot = g.spots[4]
  g.build(4, 'frost')
  const e = addEnemy(g, 'armored', nearestDist(g, spot), 10)
  const baseSpeed = e.def.speed
  run(g, 2)
  assert.ok(e.slow > 0, 'Gegner ist verlangsamt')
  const before = e.dist
  g.step(DT)
  assert.ok(e.dist - before < baseSpeed * DT)

  const g2 = new Game()
  g2.build(4, 'poison')
  const p = addEnemy(g2, 'armored', nearestDist(g2, g2.spots[4]), 10)
  p.def = { ...p.def, speed: 0 }
  run(g2, 3)
  assert.ok(p.poisonTime > 0)
  const hp = p.hp
  g2.towers[0].cooldown = 999 // kein weiterer Wurf – nur noch Gift wirkt
  run(g2, 1)
  assert.ok(p.hp < hp, 'Gift verursacht Schaden über Zeit')
})

test('Blitz trifft mehrere Gegner', () => {
  const g = new Game()
  g.wallet.gold = 10000
  g.build(4, 'lightning')
  const d = nearestDist(g, g.spots[4])
  const es = [0, 12, 24].map((o) => { const e = addEnemy(g, 'grunt', d + o, 5); e.def = { ...e.def, speed: 0 }; return e })
  let points = 0
  g.on('chain', (c) => { points = Math.max(points, c.points.length - 1) })
  run(g, 1.5)
  assert.ok(points >= 3)
  assert.ok(es.every((e) => e.hp < e.maxHp))
})

test('Kanone verursacht Flächenschaden', () => {
  const g = new Game()
  g.wallet.gold = 10000
  g.build(4, 'cannon')
  const d = nearestDist(g, g.spots[4])
  const es = [0, 10, 20].map((o) => { const e = addEnemy(g, 'grunt', d + o, 5); e.def = { ...e.def, speed: 0 }; return e })
  run(g, 3)
  assert.ok(es.every((e) => e.hp < e.maxHp), 'alle Gegner der Gruppe getroffen')
})

test('Niederlage, wenn die Leben aufgebraucht sind', () => {
  const g = new Game({ difficulty: 'hard' })
  let lost = 0
  g.on('defeat', () => lost++)
  g.callNextWave()
  run(g, 600, (game) => { if (game.phase === 'countdown') game.callNextWave() })
  assert.equal(g.status, 'lost')
  assert.equal(lost, 1)
  assert.equal(g.lives, 0)
  // nach dem Ende passiert nichts mehr
  const time = g.time
  g.step(DT)
  assert.equal(g.time, time)
})

test('Sieg nach der letzten Welle', () => {
  const g = new Game()
  let won = 0
  g.on('victory', () => won++)
  // Abkürzung: Wellen 1–19 als erledigt markieren, letzte Welle durch übermächtige Verteidigung
  g.waves.started = g.totalWaves - 1
  g.waves.phase = 'countdown'
  g.waves.countdown = 0.01
  g.wallet.gold = 1e7
  for (const s of g.spots) { const t = g.build(s.index, 'sniper').tower; g.upgrade(t); g.upgrade(t) }
  run(g, 900)
  assert.equal(g.status, 'won', `Status ${g.status}, Leben ${g.lives}`)
  assert.equal(won, 1)
  assert.ok(g.stats.bossesKilled >= 1)
})

test('Simulation hängt nicht von der Bildrate ab (30 vs. 60 FPS)', async () => {
  const { GameLoop } = await import('../js/core/loop.js')
  const make = () => {
    const g = new Game({ seed: 42 })
    g.build(0, 'arrow'); g.build(2, 'cannon')
    g.callNextWave()
    return g
  }
  const simulate = (fps) => {
    const g = make()
    const loop = new GameLoop({ update: (dt) => g.step(dt), render: () => {} })
    loop.last = 0
    let now = 0
    while (now < 40000) { now += 1000 / fps; loop.tick(now) }
    return g
  }
  const a = simulate(30), b = simulate(60), c = simulate(144)
  for (const g of [b, c]) {
    assert.ok(Math.abs(g.time - a.time) < 0.05, `Zeit ${g.time} vs ${a.time}`)
    assert.equal(g.stats.kills, a.stats.kills)
    assert.equal(g.gold, a.gold)
    assert.equal(g.lives, a.lives)
  }
})

test('Pause hält die gesamte Simulation an; Tempo beschleunigt sie', async () => {
  const { GameLoop } = await import('../js/core/loop.js')
  const g = new Game()
  g.callNextWave()
  const loop = new GameLoop({ update: (dt) => g.step(dt), render: () => {} })
  loop.last = 0
  let now = 0
  const advance = (ms) => { const end = now + ms; while (now < end) { now += 16; loop.tick(now) } }
  advance(3000)
  const snap = { time: g.time, n: g.enemies.length, dist: g.enemies[0]?.dist, countdown: g.waves.spawners[0]?.timer }
  loop.paused = true
  advance(5000)
  assert.equal(g.time, snap.time)
  assert.equal(g.enemies.length, snap.n)
  assert.equal(g.enemies[0]?.dist, snap.dist)
  loop.paused = false
  loop.speed = 3
  const t0 = g.time
  advance(1000)
  assert.ok(g.time - t0 > 2.8 && g.time - t0 < 3.2, `3× Tempo: ${g.time - t0}`)
})

test('Spielstand: Speichern und Wiederherstellen zwischen den Wellen', () => {
  const g = new Game({ difficulty: 'hard', seed: 3 })
  g.wallet.gold = 1000
  const t = g.build(2, 'sniper').tower
  g.upgrade(t)
  g.setTargetMode(t, 'close')
  g.waves.started = 4
  g.lives = 7
  assert.ok(g.canSnapshot())
  const snap = JSON.parse(JSON.stringify(g.snapshot()))
  const r = Game.restore(snap)
  assert.equal(r.gold, g.gold)
  assert.equal(r.lives, 7)
  assert.equal(r.wave, 4)
  assert.equal(r.difficulty.id, 'hard')
  assert.equal(r.towers.length, 1)
  assert.equal(r.towers[0].level, 1)
  assert.equal(r.towers[0].targetMode, 'close')
  assert.equal(r.spots[2].tower, r.towers[0])
  assert.equal(r.phase, 'build')
  assert.ok(r.callNextWave().ok)
  assert.equal(r.wave, 5)
  // Während einer Welle wird nicht gespeichert
  assert.equal(r.canSnapshot(), false)
  assert.throws(() => Game.restore({ v: 99 }))
})

test('Schwierigkeitsgrade unterscheiden sich in Leben und Gegnerstärke', () => {
  const easy = new Game({ difficulty: 'easy' }), hard = new Game({ difficulty: 'hard' })
  assert.equal(easy.lives, DIFFICULTIES.easy.lives)
  assert.equal(hard.lives, DIFFICULTIES.hard.lives)
  assert.ok(easy.gold > hard.gold)
  easy.callNextWave(); hard.callNextWave()
  run(easy, 0.1); run(hard, 0.1)
  assert.ok(hard.enemies[0].maxHp > easy.enemies[0].maxHp)
})

test('Keine unbegrenzt wachsenden Listen: Geschosse und Gegner werden aufgeräumt', () => {
  const g = new Game()
  g.wallet.gold = 100000
  for (const s of g.spots) g.build(s.index, TOWER_ORDER[s.index % 6])
  g.callNextWave()
  let maxP = 0
  run(g, 300, (game) => { maxP = Math.max(maxP, game.projectiles.length); if (game.phase === 'countdown') game.callNextWave() })
  assert.ok(maxP < 200, `zu viele Geschosse gleichzeitig: ${maxP}`)
  assert.ok(g.projectiles.every((p) => p.alive))
  assert.ok(g.enemies.every((e) => e.alive))
})
