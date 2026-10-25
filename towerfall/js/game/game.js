// Spielzustand und Simulationsschritt. Kennt weder DOM noch Canvas – dadurch lässt sich das
// komplette Spiel in Node testen. Die Darstellung hört über `on(...)` auf Ereignisse.
import { TOWERS } from '../config/towers.js'
import { ENEMIES } from '../config/enemies.js'
import { WAVE_SETS } from '../config/waves.js'
import { BALANCE, DIFFICULTIES, hpScaleForWave } from '../config/balance.js'
import { getMap, WORLD } from '../config/maps.js'
import { MODES } from '../config/terrain.js'
import { createRng } from '../core/rng.js'
import { Route, smoothRoute } from './path.js'
import { createEnemy, placeEnemy, updateEnemy } from './enemies.js'
import { updateTower, towerStats, nextLevelStats, isMaxLevel, refreshBuffs } from './towers.js'
import { Grid } from './grid.js'
import { buildTerrain } from './terrainmap.js'
import { generateObstacles, clearCost } from './obstacles.js'
import { computeRouteCells } from './routes.js'
import * as construction from './construction.js'
import * as savegame from './savegame.js'
import { checkPlacement } from './placement.js'
import { updateProjectile } from './projectiles.js'
import { WaveManager } from './waves.js'
import { Wallet, sellValue, waveBonus, earlyCallBonus } from './economy.js'

export class Game {
  constructor({ mapId, difficulty = 'normal', seed = 1, mode = 'normal' } = {}) {
    this.map = getMap(mapId)
    this.difficulty = DIFFICULTIES[difficulty] || DIFFICULTIES.normal
    this.mode = MODES[mode] || MODES.normal
    this.seed = seed
    this.rng = createRng(seed)
    // Eine Karte hat einen Weg (`path`) oder mehrere (`paths`), die sich vor der Bastion treffen
    this.routes = (this.map.paths || [this.map.path]).map((p) => new Route(smoothRoute(p)))
    this.route = this.routes[0]
    this.spawnCounter = 0
    // Raster: Gelände aus der Karte ableiten, dann Hindernisse verteilen
    const adv = this.mode.features ? this.map.advanced || {} : {}
    this.ponds = [...(this.map.ponds || []), ...(adv.ponds || [])]
    this.rivers = adv.rivers || []
    this.grid = new Grid(WORLD.width, WORLD.height)
    buildTerrain(this.grid, { map: this.map, routes: this.routes, mode: this.mode, ponds: this.ponds, rivers: this.rivers })
    this.routeCells = computeRouteCells(this.grid, this.routes)
    this.obstacles = new Map(generateObstacles(this.grid, { map: this.map, mode: this.mode, routes: this.routes }).map((o) => [o.id, o]))
    this.clearedObstacles = []
    this.wallet = new Wallet(BALANCE.startGold + this.difficulty.startGoldBonus + this.mode.startGoldBonus)
    this.maxLives = this.difficulty.lives
    this.lives = this.maxLives
    this.waves = new WaveManager(WAVE_SETS[this.map.waves])
    this.enemies = []
    this.projectiles = []
    this.towers = []
    this.pendingSpawns = []
    this.status = 'playing' // playing | won | lost
    this.time = 0
    this.nextId = 1
    this.stats = { kills: 0, leaked: 0, damage: 0, score: 0, bossesKilled: 0, wavesCleared: 0 }
    this.listeners = new Map()
  }

  // ---------- Ereignisse ----------
  on(type, fn) {
    if (!this.listeners.has(type)) this.listeners.set(type, [])
    this.listeners.get(type).push(fn)
    return () => { const l = this.listeners.get(type); l.splice(l.indexOf(fn), 1) }
  }

  emit(type, data = {}) {
    const l = this.listeners.get(type)
    if (l) for (const fn of l) fn(data)
    const any = this.listeners.get('*')
    if (any) for (const fn of any) fn(type, data)
  }

  get gold() { return this.wallet.gold }
  get wave() { return this.waves.current }
  get totalWaves() { return this.waves.total }
  get phase() { return this.waves.phase }

  currentHpScale() {
    return hpScaleForWave(Math.max(1, this.waves.current), this.difficulty) * (this.map.hpMult || 1)
  }

  // ---------- Simulation ----------
  step(dt) {
    if (this.status !== 'playing') return
    this.time += dt

    const signal = this.waves.update(dt, (type, hpFactor, waveNo) => {
      const scale = hpScaleForWave(waveNo, this.difficulty, ENEMIES[type].boss) * (this.map.hpMult || 1) * hpFactor
      this.queueSpawn(type, { hpScale: scale })
    })
    if (signal === 'auto-start') this.startWave()
    this.flushSpawns()

    // Reihenfolge: erst bewegen, dann zielen, dann treffen. Tote oder angekommene Gegner werden
    // sofort als !alive markiert, damit kein Turm im selben Schritt noch auf sie zielt.
    for (const e of this.enemies) if (e.alive) updateEnemy(e, dt, this)
    this.flushSpawns()
    for (const t of this.towers) updateTower(t, dt, this)
    for (const p of this.projectiles) if (p.alive) updateProjectile(p, dt, this)

    compact(this.enemies)
    compact(this.projectiles)

    if (this.lives <= 0) { this.finish('lost'); return }
    if (this.waves.phase === 'active' && !this.waves.spawning && this.enemies.length === 0 && this.pendingSpawns.length === 0) {
      this.onFieldCleared()
    }
  }

  // Ohne vorgegebenen Weg verteilen sich neue Gegner abwechselnd auf alle Wege
  queueSpawn(type, { hpScale = 1, dist = 0, minion = false, route = null } = {}) {
    if (!route) route = this.routes[this.spawnCounter++ % this.routes.length]
    this.pendingSpawns.push({ type, hpScale, dist, minion, route })
  }

  // Abstand zum nächsten Weg und Wegabdeckung eines Kreises (alle Wege zusammen)
  distanceToPath(x, y) { return Math.min(...this.routes.map((r) => r.distanceTo(x, y))) }
  coverage(x, y, r, stepLen = 8) { return this.routes.reduce((sum, rt) => sum + rt.coverage(x, y, r, stepLen), 0) }

  flushSpawns() {
    if (!this.pendingSpawns.length) return
    for (const s of this.pendingSpawns) {
      const def = ENEMIES[s.type]
      const lane = (this.rng() * 2 - 1) * def.lane
      const e = createEnemy(def, { id: this.nextId++, hpScale: s.hpScale, dist: s.dist, lane, route: s.route })
      if (s.minion) e.reward = Math.ceil(e.reward / 2)
      placeEnemy(e)
      e.px = e.x; e.py = e.y
      this.enemies.push(e)
      if (e.boss) this.emit('bossSpawn', { enemy: e })
    }
    this.pendingSpawns.length = 0
  }

  addProjectile(p) {
    p.id = this.nextId++
    p.alive = true
    p.traveled = 0
    p.progress = 0
    p.px = p.x; p.py = p.y
    p.angle = Math.atan2(p.ty - p.y, p.tx - p.x)
    this.projectiles.push(p)
  }

  killEnemy(e, source) {
    if (!e.alive) return
    e.alive = false
    const gold = this.wallet.earn(e.reward)
    this.stats.kills++
    if (e.boss) this.stats.bossesKilled++
    this.stats.score += e.reward * BALANCE.score.killFactor
    if (source) source.kills++
    this.emit('enemyDeath', { enemy: e, gold })
  }

  leakEnemy(e) {
    if (!e.alive) return
    e.alive = false
    this.lives = Math.max(0, this.lives - e.def.damage)
    this.stats.leaked++
    this.emit('leak', { enemy: e, lives: this.lives })
  }

  onFieldCleared() {
    const cleared = this.waves.clear()
    let bonus = 0
    for (const n of cleared) {
      bonus += waveBonus(n)
      this.stats.score += BALANCE.score.waveFactor
      this.stats.wavesCleared++
    }
    if (bonus) this.wallet.earn(bonus)
    this.emit('waveEnd', { wave: this.waves.current, bonus })
    if (this.waves.phase === 'done') this.finish('won')
  }

  finish(result) {
    if (this.status !== 'playing') return
    this.status = result
    if (result === 'won') this.stats.score += this.lives * BALANCE.score.lifeFactor
    this.stats.score = Math.round(this.stats.score * this.difficulty.scoreMult * this.mode.scoreMult)
    this.emit(result === 'won' ? 'victory' : 'defeat', { stats: this.stats })
  }

  // ---------- Wellen ----------
  startWave() {
    const n = this.waves.start()
    if (!n) return 0
    const wave = this.waves.waves[n - 1]
    this.emit('waveStart', { wave: n, boss: wave.groups.some((g) => ENEMIES[g.type].boss), title: wave.title || '' })
    return n
  }

  // Spieler ruft die nächste Welle früher: Bonus für die übersprungene Pause
  callNextWave() {
    if (this.status !== 'playing') return { ok: false, reason: 'Die Partie ist beendet.' }
    if (!this.waves.canCallNext()) {
      return { ok: false, reason: this.waves.finished ? 'Das war die letzte Welle.' : 'Warte, bis alle Gegner dieser Welle unterwegs sind.' }
    }
    let bonus = 0
    if (this.waves.phase === 'countdown') bonus = earlyCallBonus(this.waves.countdown)
    else if (this.waves.phase === 'active') bonus = BALANCE.overlapCallBonus
    if (bonus) this.wallet.earn(bonus)
    const wave = this.startWave()
    return { ok: true, wave, bonus }
  }

  // ---------- Bauen auf dem Raster (Logik in construction.js) ----------
  canPlace(type, c, r, rot = 0, ignoreTower = null) { return checkPlacement(this, type, c, r, rot, ignoreTower) }
  canBuild(type, c, r, rot = 0) { return construction.canBuild(this, type, c, r, rot) }
  build(type, c, r, rot = 0) { return construction.build(this, type, c, r, rot) }
  findPlacementNear(type, x, y, rot = 0, maxRing = 4) { return construction.findPlacementNear(this, type, x, y, rot, maxRing) }
  moveCost(tower) { return construction.moveCost(tower) }
  canMove(tower, c, r, rot) { return construction.canMove(this, tower, c, r, rot) }
  moveTower(tower, c, r, rot) { return construction.moveTower(this, tower, c, r, rot) }
  clearCost(obstacle) { return clearCost(obstacle, this.mode) }
  canClear(obstacle) { return construction.canClear(this, obstacle) }
  clearObstacle(obstacle) { return construction.clearObstacle(this, obstacle) }

  towerAt(c, r) {
    if (!this.grid.inBounds(c, r)) return null
    const id = this.grid.tower[this.grid.idx(c, r)]
    return id ? this.towers.find((t) => t.id === id) || null : null
  }

  obstacleAt(c, r) {
    if (!this.grid.inBounds(c, r)) return null
    const id = this.grid.obstacle[this.grid.idx(c, r)]
    return id ? this.obstacles.get(id) || null : null
  }

  // Sichtlinie Turm → Gegner (nur relevant, wenn Klippen/Mauern auf der Karte stehen)
  canSee(tower, enemy) {
    return this.grid.lineOfSight(tower.x, tower.y, enemy.x, enemy.y, (id) => {
      const o = this.obstacles.get(id)
      return !!o && o.def.blocksSight
    })
  }

  // Taktischer Hinweis zu einer Position, aus der Geometrie der Wege berechnet
  hintAt(x, y) {
    if (Math.hypot(this.map.base.x - x, this.map.base.y - y) < 240) return 'engpass'
    if (this.coverage(x, y, 140) >= 290) return 'kurve'
    if (this.coverage(x, y, 320) >= 1000) return 'weit'
    return 'standard'
  }

  canUpgrade(tower) {
    if (!tower || !this.towers.includes(tower)) return { ok: false, reason: 'Kein Turm ausgewählt.' }
    if (isMaxLevel(tower)) return { ok: false, max: true, reason: 'Höchste Stufe erreicht.' }
    const cost = nextLevelStats(tower).cost
    if (!this.wallet.canAfford(cost)) {
      return { ok: false, cost, missing: cost - this.gold, reason: `Dir fehlen ${cost - this.gold} Gold für die Verbesserung.` }
    }
    return { ok: true, cost, remaining: this.gold - cost }
  }

  upgrade(tower) {
    const check = this.canUpgrade(tower)
    if (!check.ok) return check
    this.wallet.spend(check.cost)
    tower.level++
    tower.invested += check.cost
    refreshBuffs(this.towers)
    this.emit('upgrade', { tower })
    return { ok: true, tower, cost: check.cost }
  }

  sellValue(tower) { return sellValue(tower.invested) }

  sell(tower) {
    if (!tower || !this.towers.includes(tower)) return { ok: false, reason: 'Kein Turm ausgewählt.' }
    const value = this.sellValue(tower)
    this.wallet.refund(value)
    construction.removeTower(this, tower)
    this.emit('sell', { tower, value })
    return { ok: true, value }
  }

  setTargetMode(tower, mode) {
    tower.targetMode = mode
    this.emit('targetMode', { tower })
  }

  // ---------- Vorschau ----------
  nextWavePreview() {
    const wave = this.waves.next()
    if (!wave) return null
    const counts = {}
    for (const g of wave.groups) counts[g.type] = (counts[g.type] || 0) + g.count
    return { number: this.waves.current + 1, title: wave.title || '', counts, boss: wave.groups.some((g) => ENEMIES[g.type].boss) }
  }

  // ---------- Speichern ----------
  // Nur zwischen den Wellen speicherbar – dann ist der Zustand vollständig durch Gold, Leben,
  // Wellennummer und Türme beschrieben und lässt sich zuverlässig wiederherstellen.
  canSnapshot() { return this.status === 'playing' && this.waves.phase !== 'active' }

  snapshot() { return savegame.snapshot(this) }

  static restore(snap) { return savegame.restore(Game, snap) }
}

// Entfernt nicht mehr aktive Objekte, ohne ein neues Array anzulegen
function compact(list) {
  let j = 0
  for (let i = 0; i < list.length; i++) if (list[i].alive) list[j++] = list[i]
  list.length = j
}

export { towerStats, nextLevelStats, isMaxLevel }
