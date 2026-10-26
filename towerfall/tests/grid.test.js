// Raster-Bausystem: Belegung, Platzierungsregeln, Versetzen, Hindernisse, Räumen, Wege, Sichtlinie.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Game } from '../js/game/game.js'
import { TOWERS, TOWER_ORDER, footprintOf } from '../js/config/towers.js'
import { CELL, OBSTACLES } from '../js/config/terrain.js'
import { MAPS } from '../js/config/maps.js'
import { routesPassable } from '../js/game/routes.js'
import { createRng } from '../js/core/rng.js'

// erste gültige Position für einen Typ (zeilenweise gesucht)
function firstValid(g, type, rot = 0, from = { c: 0, r: 0 }) {
  for (let r = from.r; r < g.grid.rows; r++) for (let c = r === from.r ? from.c : 0; c < g.grid.cols; c++) {
    const p = g.canPlace(type, c, r, rot)
    if (p.ok) return p
  }
  return null
}

const towerCells = (g) => g.grid.tower.reduce((n, v) => n + (v ? 1 : 0), 0)

test('Raster passt zur Welt und rechnet Welt ↔ Zelle korrekt um', () => {
  const g = new Game()
  assert.equal(g.grid.cols, 1280 / CELL)
  assert.equal(g.grid.rows, Math.floor(720 / CELL))
  assert.deepEqual(g.grid.cellAt(CELL * 3 + 5, CELL * 7 + 31), { c: 3, r: 7 })
  assert.deepEqual(g.grid.cellCenter(3, 7), { x: CELL * 3.5, y: CELL * 7.5 })
  // Anker so, dass die Grundfläche um den Zeiger zentriert ist
  assert.deepEqual(g.grid.anchorFor(CELL * 10, CELL * 10, 2, 2), { c: 9, r: 9 })
  assert.deepEqual(g.grid.anchorFor(CELL * 10.5, CELL * 10.5, 1, 1), { c: 10, r: 10 })
})

test('Kleine und große Türme belegen die richtige Zahl an Zellen', () => {
  const g = new Game()
  g.wallet.gold = 1e6
  for (const type of TOWER_ORDER) {
    const before = towerCells(g)
    const p = firstValid(g, type)
    const r = g.build(type, p.c, p.r)
    assert.ok(r.ok, type)
    const { w, h } = footprintOf(type)
    assert.equal(r.tower.cells.length, w * h, type)
    assert.equal(towerCells(g) - before, w * h, `${type}: ${w}×${h}`)
    for (const { c, r: row } of r.tower.cells) assert.equal(g.towerAt(c, row), r.tower)
    // Mittelpunkt liegt in der Mitte der Grundfläche
    assert.equal(r.tower.x, (r.tower.c + w / 2) * CELL)
    assert.equal(r.tower.y, (r.tower.r + h / 2) * CELL)
  }
  assert.equal(footprintOf('arrow').w * footprintOf('arrow').h, 1)
  assert.equal(footprintOf('cannon').w * footprintOf('cannon').h, 4)
  assert.equal(footprintOf('trebuchet').w * footprintOf('trebuchet').h, 9)
})

test('Drehbare Türme: Drehung tauscht Breite und Höhe der belegten Fläche', () => {
  const g = new Game()
  g.wallet.gold = 1e6
  assert.deepEqual(footprintOf('ballista', 0), { w: 2, h: 1 })
  assert.deepEqual(footprintOf('ballista', 1), { w: 1, h: 2 })
  assert.deepEqual(footprintOf('cannon', 1), { w: 2, h: 2 }, 'nicht drehbare Türme bleiben unverändert')
  const p = firstValid(g, 'ballista', 1)
  const t = g.build('ballista', p.c, p.r, 1).tower
  assert.deepEqual(t.cells.map((x) => [x.c - t.c, x.r - t.r]), [[0, 0], [0, 1]])
})

test('Überlappung, Weg, Wasser, Bastion und Kartenrand werden verhindert – ohne Goldabzug', () => {
  const g = new Game()
  g.wallet.gold = 1e6
  const p = firstValid(g, 'cannon')
  const cannon = g.build('cannon', p.c, p.r).tower
  const gold = g.gold
  const cellsBefore = towerCells(g)
  // jede überlappende Position eines 1×1-Turms auf der Kanone
  for (const { c, r } of cannon.cells) {
    const res = g.build('arrow', c, r)
    assert.equal(res.ok, false)
    assert.equal(res.code, 'tower')
  }
  // 2×2 halb überlappend
  const half = g.build('cannon', p.c + 1, p.r)
  assert.equal(half.ok, false)
  assert.ok(half.bad.length >= 1 && half.bad.length < 4, 'nur die belegten Zellen sind als ungültig markiert')
  // Weg
  const pathIdx = g.grid.terrain.indexOf('path')
  const pc = pathIdx % g.grid.cols, pr = Math.floor(pathIdx / g.grid.cols)
  assert.equal(g.build('arrow', pc, pr).code, 'terrain')
  // Bastion
  const baseIdx = g.grid.terrain.indexOf('base')
  assert.equal(g.build('arrow', baseIdx % g.grid.cols, Math.floor(baseIdx / g.grid.cols)).code, 'terrain')
  // Wasser (Teich)
  const waterIdx = g.grid.terrain.indexOf('water')
  assert.equal(g.build('arrow', waterIdx % g.grid.cols, Math.floor(waterIdx / g.grid.cols)).code, 'terrain')
  // außerhalb der Karte, auch nur teilweise
  assert.equal(g.build('arrow', -1, 3).code, 'bounds')
  assert.equal(g.build('trebuchet', g.grid.cols - 2, 3).code, 'bounds')
  assert.equal(g.gold, gold, 'kein Gold für ungültige Platzierungen abgezogen')
  assert.equal(towerCells(g), cellsBefore, 'Raster unverändert')
  assert.equal(g.towers.length, 1)
})

test('Türme lassen sich an vielen verschiedenen Stellen bauen', () => {
  for (const m of MAPS) {
    const g = new Game({ mapId: m.id })
    let valid = 0
    for (let r = 0; r < g.grid.rows; r++) for (let c = 0; c < g.grid.cols; c++) if (g.canPlace('arrow', c, r).ok) valid++
    assert.ok(valid > 250, `${m.id}: nur ${valid} Bauzellen`)
    // auch große Türme finden Platz nahe am Weg
    let bigNearPath = 0
    for (let r = 0; r < g.grid.rows; r++) for (let c = 0; c < g.grid.cols; c++) {
      const p = g.canPlace('trebuchet', c, r)
      if (p.ok && g.distanceToPath(p.x, p.y) < 160) bigNearPath++
    }
    assert.ok(bigNearPath > 5, `${m.id}: kaum Platz für 3×3-Türme`)
  }
})

test('Bei zu wenig Gold: Position gültig, aber Bau abgelehnt und nichts verändert', () => {
  const g = new Game()
  g.wallet.gold = 10
  const p = firstValid(g, 'cannon')
  const res = g.build('cannon', p.c, p.r)
  assert.equal(res.ok, false)
  assert.equal(res.code, 'gold')
  assert.equal(g.gold, 10)
  assert.equal(towerCells(g), 0)
})

test('Versetzen: gültig kostet eine kleine Gebühr, ungültig ändert nichts', () => {
  const g = new Game()
  g.wallet.gold = 1e6
  const p = firstValid(g, 'cannon')
  const t = g.build('cannon', p.c, p.r).tower
  const other = g.build('arrow', firstValid(g, 'arrow').c, firstValid(g, 'arrow').r).tower
  const gold = g.gold
  // auf den anderen Turm: ungültig
  const bad = g.moveTower(t, other.c, other.r)
  assert.equal(bad.ok, false)
  assert.equal(g.gold, gold)
  assert.equal(g.towerAt(p.c, p.r), t, 'Turm steht unverändert an der alten Stelle')
  // um eine Zelle verschieben (überlappt die eigene alte Fläche – erlaubt)
  const shift = g.canMove(t, p.c + 1, p.r)
  if (shift.ok) {
    assert.ok(g.moveTower(t, p.c + 1, p.r).ok)
    assert.equal(g.towerAt(p.c, p.r), null, 'alte Zelle frei')
    assert.equal(g.towerAt(p.c + 2, p.r), t)
    assert.equal(towerCells(g), 5)
  }
  // weit weg versetzen
  const far = g.findPlacementNear('cannon', 1000, 300, 0, 8)
  const fee = g.moveCost(t)
  const before = g.gold
  assert.ok(g.moveTower(t, far.c, far.r).ok)
  assert.equal(g.gold, before - fee)
  assert.equal(t.c, far.c)
  assert.equal(towerCells(g), 5)
})

test('Hindernisse blockieren den Bau; Räumen kostet Gold und gibt die Fläche frei', () => {
  const g = new Game({ mode: 'advanced' })
  const tree = [...g.obstacles.values()].find((o) => o.type === 'tree')
  assert.ok(tree)
  const { c, r } = tree.cells[0]
  const blocked = g.canPlace('arrow', c, r)
  assert.equal(blocked.ok, false)
  assert.equal(blocked.code, 'obstacle')
  assert.match(blocked.reason, /Baum.*räumbar/)
  // zu wenig Gold: nichts passiert
  g.wallet.gold = 1
  assert.equal(g.clearObstacle(tree).ok, false)
  assert.ok(g.obstacleAt(c, r))
  assert.equal(g.gold, 1)
  // genug Gold
  g.wallet.gold = 500
  const cost = g.clearCost(tree)
  assert.equal(cost, OBSTACLES.tree.costPerCell * tree.cells.length)
  assert.ok(g.clearObstacle(tree).ok)
  assert.equal(g.gold, 500 - cost)
  assert.equal(g.obstacleAt(c, r), null)
  assert.ok(g.canPlace('arrow', c, r).ok, 'Fläche ist sofort bebaubar')
  // zweites Räumen desselben Hindernisses ist nicht möglich
  assert.equal(g.clearObstacle(tree).ok, false)
  assert.equal(g.gold, 500 - cost)
})

test('Größere Hindernisse kosten mehr; Klippen sind nicht entfernbar', () => {
  const g = new Game({ mode: 'advanced' })
  g.wallet.gold = 1e6
  const byType = (t) => [...g.obstacles.values()].find((o) => o.type === t)
  const stones = byType('stones'), tree = byType('tree'), rock = byType('rock'), cliff = byType('cliff')
  assert.ok(g.clearCost(stones) < g.clearCost(tree))
  assert.ok(g.clearCost(tree) < g.clearCost(rock))
  assert.equal(rock.cells.length, 4)
  const gold = g.gold
  const res = g.clearObstacle(cliff)
  assert.equal(res.ok, false)
  assert.equal(res.code, 'fixed')
  assert.equal(g.gold, gold)
  assert.ok(g.obstacles.has(cliff.id))
})

test('Hindernisse liegen nie auf Wegen; Wege bleiben bei allen Aktionen passierbar', () => {
  for (const m of MAPS) {
    for (const mode of ['normal', 'advanced']) {
      const g = new Game({ mapId: m.id, mode })
      assert.ok(routesPassable(g), `${m.id}/${mode} am Start`)
      for (const o of g.obstacles.values()) {
        for (const { c, r } of o.cells) assert.equal(g.grid.terrain[g.grid.idx(c, r)], 'grass', `${m.id}: Hindernis auf ${g.grid.terrain[g.grid.idx(c, r)]}`)
      }
      // Zufällige Bau- und Räumaktionen: der Weg bleibt immer frei
      const rng = createRng(m.seed)
      g.wallet.gold = 1e7
      for (let i = 0; i < 300; i++) {
        const type = rng.pick(TOWER_ORDER)
        g.build(type, rng.int(0, g.grid.cols - 1), rng.int(0, g.grid.rows - 1), rng.int(0, 1))
        if (i % 10 === 0) { const o = rng.pick([...g.obstacles.values()]); if (o) g.clearObstacle(o) }
      }
      assert.ok(routesPassable(g), `${m.id}/${mode} nach vielen Aktionen`)
      for (const cells of g.routeCells) for (const i of cells) assert.equal(g.grid.tower[i], 0)
    }
  }
})

test('Fortgeschrittener Modus: mehr Hindernisse, Bauzone, Flüsse mit Brücken', () => {
  const n = new Game({ mapId: 'gruenental', mode: 'normal' })
  const a = new Game({ mapId: 'gruenental', mode: 'advanced' })
  assert.ok(a.obstacles.size > n.obstacles.size * 2)
  assert.equal(n.grid.terrain.filter((t) => t === 'outside').length, 0)
  assert.ok(a.grid.terrain.filter((t) => t === 'outside').length > 0)
  assert.ok(a.grid.terrain.includes('bridge'), 'Fluss kreuzt den Weg nur über Brücken')
  assert.ok(routesPassable(a))
  // gleiche Karte, gleicher Modus → gleiche Hindernisse (lernbar, reproduzierbar)
  const a2 = new Game({ mapId: 'gruenental', mode: 'advanced', seed: 999 })
  assert.deepEqual([...a.obstacles.values()].map((o) => o.cells), [...a2.obstacles.values()].map((o) => o.cells))
})

test('Klippen und Mauern blockieren die Sicht von Türmen', () => {
  const g = new Game({ mode: 'advanced' })
  const wall = [...g.obstacles.values()].find((o) => o.def.blocksSight)
  assert.ok(wall)
  const { x, y } = wall
  // Sicht über das Hindernis hinweg ist versperrt, daneben frei
  const tower = { x: x - 100, y }
  assert.equal(g.canSee(tower, { x: x + 100, y }), false)
  const free = { x: x - 100, y: y - 200 }
  const target = { x: x + 100, y: y - 200 }
  const crosses = g.grid.lineOfSight(free.x, free.y, target.x, target.y, (id) => g.obstacles.get(id)?.def.blocksSight)
  assert.equal(g.canSee(free, target), crosses)
  // Normalmodus ohne Sichtblocker: keine Prüfung nötig
  assert.equal(new Game().grid.sightBlockers, 0)
})

test('Tribok: Mindestreichweite und Extraschaden gegen große Gegner', async () => {
  const { findTarget } = await import('../js/game/towers.js')
  const g = new Game()
  g.wallet.gold = 1e6
  const p = g.findPlacementNear('trebuchet', 640, 420, 0, 6)
  const t = g.build('trebuchet', p.c, p.r).tower
  const s = t.stats
  const close = { alive: true, x: t.x + s.minRange - 20, y: t.y, radius: 10, hp: 10, dist: 0, route: g.route, incoming: 0, def: {} }
  const ok = { alive: true, x: t.x + s.minRange + 40, y: t.y, radius: 10, hp: 10, dist: 0, route: g.route, incoming: 0, def: {} }
  assert.equal(findTarget(t, [close], s), null, 'zu nah')
  assert.equal(findTarget(t, [close, ok], s), ok)
  assert.ok(TOWERS.trebuchet.levels.every((l) => l.largeBonus > 0))
})

test('Verlangsamung stapelt nicht und ist gedeckelt', async () => {
  const { applySlow, currentSpeed, createEnemy } = await import('../js/game/enemies.js')
  const { ENEMIES } = await import('../js/config/enemies.js')
  const { BALANCE } = await import('../js/config/balance.js')
  const g = new Game()
  const e = createEnemy(ENEMIES.grunt, { id: 1, route: g.route })
  const { getStatus } = await import('../js/game/status.js')
  applySlow(e, 0.4, 2)
  applySlow(e, 0.6, 1)
  applySlow(e, 0.3, 3)
  assert.equal(getStatus(e, 'slow').slow, 0.6, 'stärkster Effekt zählt, keine Addition')
  assert.equal(getStatus(e, 'slow').time, 3)
  getStatus(e, 'slow').slow = 0.99
  assert.ok(Math.abs(currentSpeed(e) - ENEMIES.grunt.speed * (1 - BALANCE.maxSlow)) < 1e-9, 'Verlangsamung allein hält nie ganz an')
})

test('Spielstand v2 speichert Rasterpositionen, Drehung und geräumte Hindernisse; v1 wird übernommen', () => {
  const g = new Game({ mode: 'advanced', mapId: 'felsenpass' })
  g.wallet.gold = 1e6
  const b = g.findPlacementNear('ballista', 500, 300, 1, 8)
  g.build('ballista', b.c, b.r, 1)
  const tr = g.findPlacementNear('trebuchet', 900, 300, 0, 8)
  g.build('trebuchet', tr.c, tr.r)
  const o = [...g.obstacles.values()].find((x) => x.def.removable)
  g.clearObstacle(o)
  const snap = JSON.parse(JSON.stringify(g.snapshot()))
  assert.equal(snap.v, 2)
  const r = Game.restore(snap)
  assert.equal(r.mode.id, 'advanced')
  assert.equal(r.towers.length, 2)
  assert.equal(r.towers[0].rot, 1)
  assert.equal(r.obstacles.has(o.id), false)
  assert.equal(r.gold, g.gold)
  assert.equal(towerCells(r), towerCells(g))
  // Version 1 (feste Bauplätze) → Türme landen auf freien Rasterzellen nahe dem alten Platz
  const v1 = { v: 1, mapId: 'gruenental', difficulty: 'normal', seed: 1, gold: 100, lives: 20, wave: 3, stats: {}, towers: [{ spot: 0, type: 'arrow', level: 1, invested: 135 }, { spot: 4, type: 'cannon', level: 0, invested: 120 }] }
  const m = Game.restore(v1)
  assert.equal(m.towers.length, 2)
  for (const [i, t] of m.towers.entries()) {
    const s = m.map.spots[v1.towers[i].spot]
    assert.ok(Math.hypot(t.x - s.x, t.y - s.y) < 6 * CELL)
  }
  assert.equal(m.towers[0].level, 1)
})

test('Leistung: 60 Türme und 200 Gegner bleiben schnell genug', () => {
  const g = new Game({ mode: 'advanced' })
  g.wallet.gold = 1e7
  const rng = createRng(5)
  let tries = 0
  while (g.towers.length < 60 && tries++ < 5000) {
    const type = rng.pick(['arrow', 'frost', 'poison', 'sniper', 'cannon', 'lightning'])
    g.build(type, rng.int(0, g.grid.cols - 1), rng.int(0, g.grid.rows - 1))
  }
  assert.equal(g.towers.length, 60)
  g.callNextWave()
  for (let i = 0; i < 200; i++) g.queueSpawn('armored', { hpScale: 50, dist: i * 12 })
  g.flushSpawns()
  const t0 = performance.now()
  for (let i = 0; i < 120; i++) g.step(1 / 60)
  const ms = (performance.now() - t0) / 120
  assert.ok(ms < 8, `${ms.toFixed(2)} ms je Simulationsschritt`)
})
