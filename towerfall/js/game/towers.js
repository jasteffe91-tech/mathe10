// Türme: Zielwahl, Ausrichtung und Angriff. Werte kommen ausschließlich aus config/towers.js.
import { TOWERS } from '../config/towers.js'
import { approachAngle } from '../core/math.js'
import { damageEnemy, applySlow, applyPoison } from './enemies.js'

export function createTower(type, spot, id) {
  const def = TOWERS[type]
  return {
    id,
    type,
    def,
    spot: spot.index,
    x: spot.x,
    y: spot.y,
    level: 0,
    invested: def.levels[0].cost,
    targetMode: def.targetMode,
    cooldown: 0,
    angle: -Math.PI / 2,
    aim: null,        // aktuelles Ziel (nur für die Darstellung der Ausrichtung)
    fireAnim: 0,      // kurze Rückstoß-Animation nach einem Schuss
    kills: 0,
    damageDealt: 0,
    buff: null,       // Verstärkung durch ein Kriegsbanner in Reichweite
    stats: def.levels[0],
  }
}

// Wirksame Werte: Stufenwerte plus Banner-Verstärkung (Schaden, Gift und Feuerrate)
export function computeStats(t, buff) {
  const base = t.def.levels[t.level]
  if (!buff || t.def.attack === 'aura') return base
  const s = { ...base, damage: base.damage * (1 + buff.damage), rate: base.rate * (1 + buff.rate) }
  if (base.poisonDps) s.poisonDps = base.poisonDps * (1 + buff.damage)
  return s
}

// Nach jedem Bau, Verkauf oder Upgrade neu berechnen. Mehrere Banner stapeln sich nicht –
// es zählt das stärkste in Reichweite.
export function refreshBuffs(towers) {
  for (const t of towers) {
    let best = null
    if (t.def.attack !== 'aura') {
      for (const a of towers) {
        if (a === t || a.def.attack !== 'aura') continue
        const s = a.def.levels[a.level]
        if ((a.x - t.x) ** 2 + (a.y - t.y) ** 2 > s.range * s.range) continue
        if (!best || s.auraDamage > best.damage) best = { damage: s.auraDamage, rate: s.auraRate, from: a }
      }
    }
    t.buff = best
    t.stats = computeStats(t, best)
  }
}

export const towerStats = (t) => t.stats
export const nextLevelStats = (t) => t.def.levels[t.level + 1] || null
export const isMaxLevel = (t) => t.level >= t.def.levels.length - 1

const inRange = (t, e, range) => {
  const r = range + e.radius
  return (e.x - t.x) ** 2 + (e.y - t.y) ** 2 <= r * r
}

// Wertung eines Kandidaten je Zielmodus (höher = besser)
function score(t, e, mode) {
  switch (mode) {
    // Bei mehreren Wegen zählt die verbleibende Strecke bis zur Bastion
    case 'last': return e.route.length - e.dist
    case 'strong': return e.hp * 10000 + e.dist - e.route.length
    case 'close': return -((e.x - t.x) ** 2 + (e.y - t.y) ** 2)
    default: return e.dist - e.route.length
  }
}

// Zielwahl: nur lebende Gegner in Reichweite. Einzelziel-Türme überspringen Gegner, die bereits
// durch fliegende Geschosse sicher fallen; Frost/Gift bevorzugen noch nicht betroffene Gegner.
export function findTarget(t, enemies, stats) {
  const pref = t.def.targetPreference
  const singleShot = t.def.attack === 'projectile' && !stats.splash
  let best = null, bestScore = -Infinity, bestTier = -1
  for (const e of enemies) {
    if (!e.alive || !inRange(t, e, stats.range)) continue
    let tier = 1
    if (singleShot && e.incoming >= e.hp) tier = 0
    if (pref === 'unslowed' && e.slowTime > 0.3) tier = Math.min(tier, 0.5)
    if (pref === 'unpoisoned' && e.poisonTime > 0.5) tier = Math.min(tier, 0.5)
    const s = score(t, e, t.targetMode)
    if (tier > bestTier || (tier === bestTier && s > bestScore)) {
      best = e; bestScore = s; bestTier = tier
    }
  }
  return best
}

export function updateTower(t, dt, game) {
  if (t.def.attack === 'aura') return // Banner greift nicht selbst an
  const stats = t.stats
  if (t.fireAnim > 0) t.fireAnim -= dt
  t.cooldown -= dt

  // Ziel jeden Schritt neu bestimmen, damit sich der Turm sichtbar mitdreht
  const target = findTarget(t, game.enemies, stats)
  t.aim = target
  if (target) t.angle = approachAngle(t.angle, Math.atan2(target.y - t.y, target.x - t.x), dt * 9)

  if (t.cooldown > 0) return
  if (!target) { t.cooldown = 0; return }

  fire(t, target, stats, game)
  t.fireAnim = 0.12
  // Bei leerem Feld wird die Abklingzeit nicht „angespart“ – kein Feuerstoß, wenn Gegner kommen
  t.cooldown = Math.max(t.cooldown, -dt) + 1 / stats.rate
}

function fire(t, target, stats, game) {
  const def = t.def
  switch (def.attack) {
    case 'projectile':
    case 'shell':
      game.addProjectile({
        kind: def.projectile,
        attack: def.attack,
        tower: t,
        target,
        x: t.x, y: t.y, sx: t.x, sy: t.y,
        tx: target.x, ty: target.y,
        speed: def.projectileSpeed,
        arc: def.arc || 0,
        stats,
      })
      if (def.attack === 'projectile' && !stats.splash) target.incoming += stats.damage
      game.emit('shot', { tower: t, target })
      break
    case 'instant': {
      const tx = target.x, ty = target.y
      damageEnemy(game, target, stats.damage, { pierce: stats.armorPierce || 0, source: t })
      game.emit('shot', { tower: t, target, beam: { x1: t.x, y1: t.y, x2: tx, y2: ty } })
      break
    }
    case 'chain':
      fireChain(t, target, stats, game)
      break
    case 'pierce': {
      // Gerader Speer: fliegt in Zielrichtung über die Reichweite hinaus und durchbohrt alles auf dem Weg
      const a = Math.atan2(target.y - t.y, target.x - t.x)
      const len = stats.range * 1.3
      game.addProjectile({
        kind: def.projectile,
        attack: 'pierce',
        tower: t,
        target: null,
        x: t.x, y: t.y, sx: t.x, sy: t.y,
        tx: t.x + Math.cos(a) * len, ty: t.y + Math.sin(a) * len,
        speed: def.projectileSpeed,
        arc: 0,
        stats,
        hits: new Set(),
      })
      game.emit('shot', { tower: t, target })
      break
    }
  }
}

function fireChain(t, first, stats, game) {
  const hit = new Set()
  const points = [{ x: t.x, y: t.y - 18 }]
  let current = first
  let damage = stats.damage
  for (let i = 0; i < stats.chains && current; i++) {
    hit.add(current)
    points.push({ x: current.x, y: current.y })
    damageEnemy(game, current, damage, { pierce: stats.armorPierce || 0, source: t })
    damage *= stats.chainFalloff
    // nächster, noch nicht getroffener Gegner in Sprungweite
    let next = null, bestD = stats.chainRange * stats.chainRange
    for (const e of game.enemies) {
      if (!e.alive || hit.has(e)) continue
      const d = (e.x - current.x) ** 2 + (e.y - current.y) ** 2
      if (d <= bestD) { bestD = d; next = e }
    }
    current = next
  }
  game.emit('chain', { tower: t, points })
}

// Treffer eines Geschosses: Einzelziel oder Fläche mit Abfall zum Rand
export function applyImpact(game, p) {
  const s = p.stats
  const src = p.tower
  if (s.splash) {
    const r2 = s.splash * s.splash
    for (const e of game.enemies) {
      if (!e.alive) continue
      const d2 = (e.x - p.tx) ** 2 + (e.y - p.ty) ** 2
      if (d2 > (s.splash + e.radius) ** 2) continue
      const d = Math.sqrt(Math.min(d2, r2))
      const falloff = 1 - 0.5 * Math.max(0, (d - s.splash * 0.35) / (s.splash * 0.65))
      if (s.slow) applySlow(e, s.slow, s.slowDuration)
      if (s.poisonDps) applyPoison(e, s.poisonDps, s.poisonDuration, src)
      damageEnemy(game, e, s.damage * falloff, { pierce: s.armorPierce || 0, source: src })
    }
    game.emit('impact', { kind: p.kind, x: p.tx, y: p.ty, radius: s.splash })
  } else if (p.target && p.target.alive) {
    p.target.incoming = Math.max(0, p.target.incoming - s.damage)
    if (s.slow) applySlow(p.target, s.slow, s.slowDuration)
    damageEnemy(game, p.target, s.damage, { pierce: s.armorPierce || 0, source: src })
    game.emit('impact', { kind: p.kind, x: p.tx, y: p.ty, radius: 0 })
  }
}
