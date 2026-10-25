// Geschosse: fliegen zielsuchend zum Ziel. Fällt das Ziel vorher, fliegen Flächengeschosse zum
// letzten bekannten Punkt weiter; Einzelgeschosse suchen sich einen Gegner in der Nähe oder verpuffen.
import { BALANCE } from '../config/balance.js'
import { applyImpact } from './towers.js'
import { damageEnemy } from './enemies.js'
import { distToSegment } from '../core/math.js'

export function updateProjectile(p, dt, game) {
  p.px = p.x; p.py = p.y
  if (p.attack === 'pierce') { updatePiercing(p, dt, game); return }
  if (p.target) {
    if (p.target.alive) {
      p.tx = p.target.x; p.ty = p.target.y
    } else if (p.attack === 'projectile' && !p.stats.splash) {
      p.target = retarget(p, game.enemies)
      if (p.target) p.target.incoming += p.stats.damage
    } else {
      p.target = null
    }
  }
  const dx = p.tx - p.x, dy = p.ty - p.y
  const d = Math.hypot(dx, dy)
  const step = p.speed * dt
  p.traveled += step
  if (d <= step + 2) {
    p.x = p.tx; p.y = p.ty
    p.alive = false
    if (p.target || p.stats.splash || p.attack === 'shell') applyImpact(game, p)
    else game.emit('fizzle', { kind: p.kind, x: p.x, y: p.y })
    return
  }
  p.x += (dx / d) * step
  p.y += (dy / d) * step
  p.angle = Math.atan2(dy, dx)
  p.progress = p.traveled / (p.traveled + d)
}

function retarget(p, enemies) {
  let best = null, bestD = BALANCE.retargetRadius ** 2
  for (const e of enemies) {
    if (!e.alive) continue
    const d = (e.x - p.x) ** 2 + (e.y - p.y) ** 2
    if (d < bestD) { bestD = d; best = e }
  }
  return best
}

// Durchbohrendes Geschoss: prüft je Schritt die überflogene Strecke, trifft jeden Gegner nur einmal
function updatePiercing(p, dt, game) {
  const dx = p.tx - p.x, dy = p.ty - p.y
  const d = Math.hypot(dx, dy)
  const step = Math.min(d, p.speed * dt)
  const nx = p.x + (dx / (d || 1)) * step, ny = p.y + (dy / (d || 1)) * step
  const s = p.stats
  for (const e of game.enemies) {
    if (!e.alive || p.hits.has(e)) continue
    if (distToSegment(e.x, e.y, p.x, p.y, nx, ny) > e.radius + 5) continue
    p.hits.add(e)
    damageEnemy(game, e, s.damage, { pierce: s.armorPierce || 0, source: p.tower })
    game.emit('impact', { kind: p.kind, x: e.x, y: e.y, radius: 0 })
    if (p.hits.size >= s.pierceCount) { p.alive = false; break }
  }
  p.x = nx; p.y = ny
  p.angle = Math.atan2(dy, dx)
  p.traveled += step
  if (d - step < 1) p.alive = false
}
