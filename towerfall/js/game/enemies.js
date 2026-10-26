// Gegner: Bewegung entlang der Route, Resistenzen und Fähigkeiten (Heilen, Beschwören, Raserei,
// Lähm-Puls gegen Türme). Statuseffekte (Frost, Schleim, Gift, Brand, Schock, Einfrieren) verwaltet
// status.js in einem gemeinsamen Update.
import { BALANCE } from '../config/balance.js'
import { applyStatus, updateStatus, movementFactor, clearImpairments } from './status.js'

export function createEnemy(def, { id, hpScale = 1, dist = 0, lane = 0, route, elite = false }) {
  // Elite: mehr Leben, mehr Panzerung, doppelte Belohnung (Werte in balance.js)
  const hp = Math.round(def.hp * hpScale * (elite ? BALANCE.elite.hpMult : 1))
  return {
    id,
    type: def.id,
    def,
    boss: !!def.boss,
    hp,
    maxHp: hp,
    armor: def.armor + (elite ? BALANCE.elite.armorBonus : 0),
    radius: def.radius,
    reward: Math.round(def.reward * (elite ? BALANCE.elite.rewardMult : 1)),
    elite,
    route,           // Weg, dem dieser Gegner folgt (Karten können mehrere haben)
    dist,
    lane,            // seitlicher Versatz auf dem Weg, damit Gruppen nicht in einer Linie laufen
    x: 0, y: 0, px: 0, py: 0, angle: 0,
    alive: true,
    effects: [],     // aktive Statuseffekte (status.js)
    stunImmune: 0,   // verbleibende Immunität gegen Betäubung
    incoming: 0,     // Schaden bereits fliegender Einzelgeschosse – verhindert unnötigen Overkill
    hitFlash: 0,
    abilityTimer: def.heal ? def.heal.every : def.summon ? def.summon.every * 0.6 : 0,
    enraged: false,
    frenzy: 0,       // verbleibende Raserei (Berserker): schneller, immun gegen Verlangsamung
    frenzyTimer: def.frenzy ? def.frenzy.first : 0,
    hexTimer: def.disrupt ? def.disrupt.first : 0,
    hexCharge: 0,    // > 0: Lähm-Puls lädt sich sichtbar auf
    age: 0,
  }
}

// Schadensart-Faktor: Resistenz 0,6 → 40 % Schaden, -0,25 → 125 % (Anfälligkeit)
export const resistFactor = (e, type) => 1 - ((type && e.def.resist?.[type]) || 0)

// Position aus der zurückgelegten Strecke berechnen (inkl. seitlichem Versatz)
const tmp = {}
export function placeEnemy(e) {
  e.route.sample(e.dist, tmp)
  e.angle = tmp.angle
  e.x = tmp.x - Math.sin(tmp.angle) * e.lane
  e.y = tmp.y + Math.cos(tmp.angle) * e.lane
}

export function currentSpeed(e) {
  const frenzy = e.frenzy > 0 ? e.def.frenzy.speed : 1
  // Verlangsamungen stapeln nicht (es zählt die stärkste), sind gedeckelt; Betäubung = Stillstand
  const move = movementFactor(e)
  // Flugrouten begrenzen das Tempo (siehe BALANCE.flightTimeShare)
  const base = e.route?.maxSpeed ? Math.min(e.def.speed, e.route.maxSpeed) : e.def.speed
  return base * move * frenzy * (e.enraged ? BALANCE.enrageSpeed : 1)
}

// Schaden zufügen. Panzerung zieht einen festen Betrag ab (durch armorPierce teilweise ignoriert);
// Schaden über Zeit (dot) ignoriert Panzerung. Gibt den tatsächlich verursachten Schaden zurück.
export function damageEnemy(game, e, raw, { pierce = 0, source = null, dot = false, type = null } = {}) {
  if (!e.alive || raw <= 0) return 0
  // Schadensart: ausdrücklich angegeben (z. B. Gift über Zeit) oder vom Turm
  const dtype = type || source?.def?.damageType || null
  let dmg = raw * resistFactor(e, dtype)
  if (!dot) {
    const reduced = dmg - e.armor * (1 - pierce)
    dmg = Math.max(reduced, dmg * BALANCE.minDamageRatio)
    e.hitFlash = 0.1
  }
  const dealt = Math.min(dmg, e.hp)
  e.hp -= dmg
  if (source) {
    source.damageDealt += dealt
    game.telemetry?.addDamage(source.type, e.type, dealt)
  }
  game.stats.damage += dealt
  if (e.hp <= 0) game.killEnemy(e, source)
  return dealt
}

// Kurzformen für die häufigsten Effekte (Raserei: immun gegen Verlangsamung, siehe status.js)
export const applySlow = (e, strength, duration, source = null) => applyStatus(e, 'slow', { slow: strength, duration, source })
export const applyPoison = (e, dps, duration, source = null) => applyStatus(e, 'poison', { dps, duration, source })

export function updateEnemy(e, dt, game) {
  e.px = e.x; e.py = e.y
  e.age += dt
  if (e.hitFlash > 0) e.hitFlash -= dt

  // alle Statuseffekte in einem Durchgang (Schaden über Zeit, Ablauf, Betäubungsimmunität)
  updateStatus(game, e, dt, damageEnemy)
  if (!e.alive) return

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
  if (e.def.frenzy) updateFrenzy(e, dt, game)
  if (e.def.disrupt) updateDisrupt(e, dt, game)
}

// Berserker: in festen Abständen Raserei – schneller und immun gegen Verlangsamung
function updateFrenzy(e, dt, game) {
  const f = e.def.frenzy
  if (e.frenzy > 0) {
    e.frenzy -= dt
    if (e.frenzy <= 0) { e.frenzy = 0; e.frenzyTimer = f.every }
    return
  }
  e.frenzyTimer -= dt
  if (e.frenzyTimer > 0) return
  e.frenzy = f.duration
  clearImpairments(e)
  game.emit('frenzy', { enemy: e })
}

// Lähm-Puls (Runenhexer) bzw. Stampfen (Bosse): lädt sich sichtbar auf und betäubt dann alle
// angreifenden Türme im Umkreis (Kriegsbanner ausgenommen). Bestraft dichte Ballungen direkt am Weg.
function updateDisrupt(e, dt, game) {
  const h = e.def.disrupt
  if (e.hexCharge > 0) {
    e.hexCharge -= dt
    if (e.hexCharge > 0) return
    e.hexCharge = 0
    e.hexTimer = h.every
    let hit = 0
    for (const t of game.towers) {
      if (!inDisruptReach(e, t, h, game)) continue
      t.silenced = Math.max(t.silenced || 0, h.duration)
      hit++
    }
    game.emit('hex', { enemy: e, radius: h.radius, count: hit, kind: h.kind })
    return
  }
  if (e.hexTimer > 0) { e.hexTimer -= dt; return }
  // bereit: lädt sich erst auf, wenn ein Turm in Reichweite ist (sonst würde der Puls verpuffen)
  if (game.towers.some((t) => inDisruptReach(e, t, h, game))) {
    e.hexCharge = h.charge
    game.emit('hexCharge', { enemy: e, kind: h.kind })
  }
}

// Reichweite zur Grundfläche eines Turms (Mittelpunkt plus gut ein Drittel der Turmgröße)
function inDisruptReach(e, t, h, game) {
  if (t.def.attack === 'aura') return false
  const reach = h.radius + Math.max(t.w, t.h) * game.grid.cell * 0.35
  return (t.x - e.x) ** 2 + (t.y - e.y) ** 2 <= reach * reach
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
