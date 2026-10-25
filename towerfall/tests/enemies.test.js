// Gegnerrollen und Konter: Schadensarten/Resistenzen, Raserei, Lähm-Puls, Elite, Flieger,
// schrittweise Einführung neuer Fähigkeiten.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Game } from '../js/game/game.js'
import { ENEMIES, ENEMY_ORDER, ELITE_HINT } from '../js/config/enemies.js'
import { TOWERS } from '../js/config/towers.js'
import { BALANCE } from '../js/config/balance.js'
import { WAVE_SETS } from '../js/config/waves.js'
import { damageEnemy, applySlow, currentSpeed, resistFactor, updateEnemy } from '../js/game/enemies.js'
import { findTarget, updateTower } from '../js/game/towers.js'

// Gegner direkt aufs Feld setzen (ohne Welle)
function spawn(g, type, opts = {}) {
  g.queueSpawn(type, opts)
  g.flushSpawns()
  return g.enemies[g.enemies.length - 1]
}

// Turm mit möglichst kleinem Abstand zu (x, y) bauen
function buildNear(g, type, x, y) {
  g.wallet.gold = 100000
  const p = g.findPlacementNear(type, x, y, 0, 20)
  assert.ok(p, `kein Platz für ${type}`)
  const r = g.build(type, p.c, p.r, 0)
  assert.ok(r.ok, r.reason)
  return g.towers[g.towers.length - 1]
}

test('Schadensarten: Geist hält physischem Schaden stand und ist anfällig für Magie', () => {
  const g = new Game()
  const w = spawn(g, 'wraith')
  assert.equal(resistFactor(w, 'physical'), 0.4)
  assert.equal(resistFactor(w, 'magic'), 1.25)
  assert.equal(resistFactor(w, 'explosive'), 1)
  assert.equal(resistFactor(w, null), 1)
  const hp = w.hp
  damageEnemy(g, w, 20, { type: 'physical' })
  assert.equal(hp - w.hp, 8)
  damageEnemy(g, w, 20, { type: 'magic' })
  assert.equal(hp - w.hp, 8 + 25)
  // Schadensart kommt sonst vom Turm
  const arrow = buildNear(g, 'arrow', w.x, w.y)
  const before = w.hp
  damageEnemy(g, w, 10, { source: arrow })
  assert.equal(before - w.hp, 4)
})

test('Panzerung wirkt nach der Resistenz; Gift über Zeit ignoriert Panzerung', () => {
  const g = new Game()
  const a = spawn(g, 'armored')
  const hp = a.hp
  damageEnemy(g, a, 20, { type: 'physical' })
  assert.equal(hp - a.hp, 20 - a.armor)
  const h2 = a.hp
  damageEnemy(g, a, 3, { type: 'poison', dot: true })
  assert.equal(h2 - a.hp, 3)
})

test('Berserker: Raserei macht schneller und immun gegen Verlangsamung, danach wieder normal', () => {
  const g = new Game()
  const b = spawn(g, 'berserker')
  const f = ENEMIES.berserker.frenzy
  assert.ok(applySlow(b, 0.5, 2))
  const slowed = currentSpeed(b)
  assert.ok(slowed < ENEMIES.berserker.speed)
  // bis zur ersten Raserei laufen lassen
  let t = 0
  while (b.frenzy <= 0 && t < 10) { updateEnemy(b, 1 / 60, g); t += 1 / 60 }
  assert.ok(Math.abs(t - f.first) < 0.05, `Raserei nach ${t.toFixed(2)} s`)
  assert.equal(b.slow, 0, 'Raserei löst bestehende Verlangsamung')
  assert.equal(applySlow(b, 0.5, 2), false, 'während der Raserei immun')
  assert.equal(b.slow, 0)
  assert.ok(Math.abs(currentSpeed(b) - ENEMIES.berserker.speed * f.speed) < 1e-9)
  for (let i = 0; i < f.duration * 60 + 2; i++) updateEnemy(b, 1 / 60, g)
  assert.equal(b.frenzy, 0)
  assert.ok(applySlow(b, 0.5, 2), 'nach der Raserei wieder verlangsambar')
})

test('Runenhexer: lädt nur in der Nähe von Türmen auf und lähmt dann alle Türme im Umkreis', () => {
  const g = new Game()
  const h = spawn(g, 'hexer', { dist: 300 })
  const d = ENEMIES.hexer.disrupt
  // ohne Turm in der Nähe: kein Aufladen, auch nach langer Zeit
  for (let i = 0; i < 60 * 8; i++) { h.dist = 300; updateEnemy(h, 1 / 60, g) }
  assert.equal(h.hexCharge, 0)
  assert.ok(h.hexTimer <= 0, 'bereit')
  // Turm dicht daneben, einer weit weg, ein Banner dicht daneben
  const near = buildNear(g, 'arrow', h.x, h.y)
  const banner = buildNear(g, 'banner', h.x, h.y)
  const far = buildNear(g, 'arrow', h.x > 640 ? 60 : 1220, h.y > 352 ? 60 : 640)
  assert.ok(Math.hypot(far.x - h.x, far.y - h.y) > d.radius + 64)
  const events = []
  g.on('hexCharge', () => events.push('charge'))
  g.on('hex', ({ count }) => events.push(`hex:${count}`))
  h.dist = 300; updateEnemy(h, 1 / 60, g)
  assert.ok(h.hexCharge > 0, 'lädt auf, sobald ein Turm in Reichweite ist')
  // während des Aufladens: noch keine Lähmung (Spieler sieht den Ring)
  assert.equal(near.silenced, 0)
  for (let i = 0; i < d.charge * 60 + 2; i++) { h.dist = 300; updateEnemy(h, 1 / 60, g) }
  assert.deepEqual(events, ['charge', 'hex:1'])
  assert.ok(Math.abs(near.silenced - d.duration) < 1e-9)
  assert.equal(far.silenced, 0, 'entfernte Türme bleiben unberührt')
  assert.equal(banner.silenced || 0, 0, 'Kriegsbanner wird nicht gelähmt')
  assert.ok(h.hexTimer > d.every - 0.1, 'danach Pause')
})

test('Gelähmter Turm feuert nicht und ist nach Ablauf wieder aktiv', () => {
  const g = new Game()
  const e = spawn(g, 'grunt', { dist: 300 })
  const t = buildNear(g, 'arrow', e.x, e.y)
  t.silenced = 1
  t.cooldown = 0
  for (let i = 0; i < 59; i++) updateTower(t, 1 / 60, g)
  assert.equal(g.projectiles.length, 0)
  for (let i = 0; i < 3; i++) updateTower(t, 1 / 60, g)
  assert.equal(t.silenced, 0)
  assert.ok(g.projectiles.length > 0, 'schießt wieder')
})

test('Elite: mehr Leben, mehr Panzerung, doppelte Belohnung', () => {
  const g = new Game()
  const n = spawn(g, 'armored', { hpScale: 1 })
  const e = spawn(g, 'armored', { hpScale: 1, elite: true })
  assert.equal(e.elite, true)
  assert.equal(e.maxHp, Math.round(n.maxHp * BALANCE.elite.hpMult))
  assert.equal(e.armor, n.armor + BALANCE.elite.armorBonus)
  assert.equal(e.reward, n.reward * BALANCE.elite.rewardMult)
  // Elite-Gruppen in den Wellen werden auch als Elite erzeugt
  const g2 = new Game()
  const waveIdx = WAVE_SETS.classic.findIndex((w) => w.groups.some((gr) => gr.elite))
  assert.equal(waveIdx + 1, 13)
  g2.waves.started = waveIdx
  g2.callNextWave()
  for (let i = 0; i < 60 * 30 && !g2.enemies.some((x) => x.elite); i++) g2.step(1 / 60)
  assert.ok(g2.enemies.some((x) => x.elite && x.type === 'armored'))
})

test('Harpyie fliegt geradlinig zur Bastion, in begrenztem Tempo', () => {
  const g = new Game({ mapId: 'felsenpass' })
  const h = spawn(g, 'harpy')
  assert.ok(h.route.flight)
  assert.equal(h.route.points.length, 2)
  const [, end] = h.route.points
  assert.deepEqual(end, [g.map.base.x, g.map.base.y])
  // Flugzeit = flightTimeShare × Laufzeit eines Referenzgegners auf dem Weg
  const ground = g.routes[0]
  const flightTime = h.route.length / currentSpeed(h)
  const expected = (BALANCE.flightTimeShare * ground.length) / BALANCE.flightReferenceSpeed
  assert.ok(currentSpeed(h) <= ENEMIES.harpy.speed)
  assert.ok(Math.abs(flightTime - Math.max(expected, h.route.length / ENEMIES.harpy.speed)) < 0.01)
})

test('Bogengeschosse (Kanone, Tribok, Gift) treffen keine Flieger, Pfeile schon', () => {
  const g = new Game()
  const h = spawn(g, 'harpy', { dist: 150 })
  for (const type of ['cannon', 'poison', 'trebuchet', 'arrow', 'frost', 'lightning']) {
    const t = buildNear(g, type, h.x + 60, h.y + 60)
    const stats = { ...t.stats, range: 2000, minRange: 0 }
    const target = findTarget(t, g.enemies, stats)
    if (TOWERS[type].attack === 'shell') assert.equal(target, null, `${type} darf nicht zielen`)
    else assert.equal(target, h, `${type} muss zielen`)
  }
})

test('Neue Fähigkeiten kommen schrittweise, jede mit Erklärung', () => {
  const waves = WAVE_SETS.classic
  const firstWave = {}
  waves.forEach((w, i) => { for (const gr of w.groups) if (!(gr.type in firstWave)) firstWave[gr.type] = i + 1 })
  // Einführungswelle = erstes Auftreten, und nie zwei neue Fähigkeiten in derselben Welle
  const intros = waves.map((w, i) => [w.intro, i + 1]).filter(([x]) => x)
  for (const [type, wave] of intros) {
    if (type === 'elite') assert.ok(ELITE_HINT.length > 20)
    else {
      assert.equal(firstWave[type], wave, `${type} taucht vor seiner Einführung auf`)
      assert.ok(ENEMIES[type].hint?.startsWith('Neu:'), `${type} ohne Hinweis`)
    }
  }
  assert.deepEqual(intros.map(([, w]) => w), [6, 7, 8, 11, 13])
  // alle Gegner mit Fähigkeit haben eine Erklärung und kommen in der Gegnerübersicht vor
  for (const [id, def] of Object.entries(ENEMIES)) {
    assert.ok(ENEMY_ORDER.includes(id))
    assert.ok(def.description.length > 20)
  }
  // die ersten fünf Wellen kommen ohne neue Fähigkeiten aus (Lernphase)
  for (const w of waves.slice(0, 5)) for (const gr of w.groups) {
    const d = ENEMIES[gr.type]
    assert.ok(!d.flying && !d.resist && !d.frenzy && (!d.disrupt || d.boss) && !gr.elite)
  }
})
