// Gegner: Bewegung entlang der Route, Statuseffekte (Frost, Gift) und Fähigkeiten (Heilen, Beschwören).
import { BALANCE } from '../config/balance.js'

export function createEnemy(def, { id, hpScale = 1, dist = 0, lane = 0, route }) {
  const hp = Math.round(def.hp * hpScale)
  return {
    id,
    type: def.id,
    def,
    boss: !!def.boss,
    hp,
    maxHp: hp,
    armor: def.armor,
    radius: def.radius,
    reward: def.reward,
    route,           // Weg, dem dieser Gegner folgt (Karten können mehrere haben)
    dist,
    lane,            // seitlicher Versatz auf dem Weg, damit Gruppen nicht in einer Linie laufen
    x: 0, y: 0, px: 0, py: 0, angle: 0,
    alive: true,
    slow: 0, slowTime: 0,
    poisonDps: 0, poisonTime: 0, poisonSource: null,
    incoming: 0,     // Schaden bereits fliegender Einzelgeschosse – verhindert unnötigen Overkill
    hitFlash: 0,
    abilityTimer: def.heal ? def.heal.every : def.summon ? def.summon.every * 0.6 : 0,
    enraged: false,
    age: 0,
  }
}

// Position aus der zurückgelegten Strecke berechnen (inkl. seitlichem Versatz)
const tmp = {}
export function placeEnemy(e) {
  e.route.sample(e.dist, tmp)
  e.angle = tmp.angle
  e.x = tmp.x - Math.sin(tmp.angle) * e.lane
  e.y = tmp.y + Math.cos(tmp.angle) * e.lane
}

export function currentSpeed(e) {
  const resist = e.def.slowResist || 0
  const slowFactor = 1 - e.slow * (1 - resist)
  return e.def.speed * slowFactor * (e.enraged ? BALANCE.enrageSpeed : 1)
}

// Schaden zufügen. Panzerung zieht einen festen Betrag ab (durch armorPierce teilweise ignoriert);
// Schaden über Zeit (dot) ignoriert Panzerung. Gibt den tatsächlich verursachten Schaden zurück.
export function damageEnemy(game, e, raw, { pierce = 0, source = null, dot = false } = {}) {
  if (!e.alive || raw <= 0) return 0
  let dmg = raw
  if (!dot) {
    const reduced = raw - e.armor * (1 - pierce)
    dmg = Math.max(reduced, raw * BALANCE.minDamageRatio)
    e.hitFlash = 0.1
  }
  const dealt = Math.min(dmg, e.hp)
  e.hp -= dmg
  if (source) source.damageDealt += dealt
  game.stats.damage += dealt
  if (e.hp <= 0) game.killEnemy(e, source)
  return dealt
}

export function applySlow(e, strength, duration) {
  if (strength >= e.slow) e.slow = strength
  e.slowTime = Math.max(e.slowTime, duration)
}

export function applyPoison(e, dps, duration, source) {
  if (dps >= e.poisonDps) { e.poisonDps = dps; e.poisonSource = source }
  e.poisonTime = Math.max(e.poisonTime, duration)
}

export function updateEnemy(e, dt, game) {
  e.px = e.x; e.py = e.y
  e.age += dt
  if (e.hitFlash > 0) e.hitFlash -= dt

  if (e.slowTime > 0) {
    e.slowTime -= dt
    if (e.slowTime <= 0) { e.slow = 0; e.slowTime = 0 }
  }
  if (e.poisonTime > 0) {
    e.poisonTime -= dt
    damageEnemy(game, e, e.poisonDps * dt, { dot: true, source: e.poisonSource })
    if (e.poisonTime <= 0) { e.poisonDps = 0; e.poisonTime = 0; e.poisonSource = null }
    if (!e.alive) return
  }

  if (e.boss && !e.enraged && e.hp < e.maxHp * BALANCE.enrageThreshold) {
    e.enraged = true
    game.emit('enrage', { enemy: e })
  }

  e.dist += currentSpeed(e) * dt
  if (e.dist >= e.route.length) {
    game.leakEnemy(e)
    return
  }
  placeEnemy(e)

  if (e.def.heal) updateHealer(e, dt, game)
  if (e.def.summon) updateSummoner(e, dt, game)
}

function updateHealer(e, dt, game) {
  e.abilityTimer -= dt
  if (e.abilityTimer > 0) return
  const h = e.def.heal
  e.abilityTimer += h.every
  const r2 = h.radius * h.radius
  let healed = 0
  for (const o of game.enemies) {
    if (!o.alive || o === e || o.hp >= o.maxHp) continue
    if ((o.x - e.x) ** 2 + (o.y - e.y) ** 2 > r2) continue
    const amount = o.maxHp * h.amount * (o.boss ? BALANCE.bossHealFactor : 1)
    o.hp = Math.min(o.maxHp, o.hp + amount)
    healed++
  }
  game.emit('heal', { enemy: e, radius: h.radius, count: healed })
}

function updateSummoner(e, dt, game) {
  e.abilityTimer -= dt
  if (e.abilityTimer > 0) return
  const s = e.def.summon
  e.abilityTimer += s.every
  for (let i = 0; i < s.count; i++) {
    game.queueSpawn(s.type, { dist: Math.max(0, e.dist - 16 - i * 14), hpScale: game.currentHpScale(), minion: true, route: e.route })
  }
  game.emit('summon', { enemy: e, count: s.count })
}
