// Spielstände: Nur zwischen den Wellen wird gespeichert – dann ist der Zustand vollständig durch Gold,
// Leben, Wellennummer, Türme (Ankerzelle, Drehung, Stufe) und geräumte Hindernisse beschrieben.
// Hindernisse entstehen deterministisch aus Karte und Modus; gespeichert werden nur die IDs der
// geräumten. Version 1 (feste Bauplätze) wird automatisch übernommen.
import { TOWERS } from '../config/towers.js'
import { createTower, refreshBuffs } from './towers.js'
import { checkPlacement } from './placement.js'
import { findPlacementNear } from './construction.js'

export function snapshot(game) {
  return {
    v: 2,
    mapId: game.map.id,
    difficulty: game.difficulty.id,
    mode: game.mode.id,
    seed: game.seed,
    gold: game.wallet.gold,
    earned: game.wallet.earned,
    spent: game.wallet.spent,
    lives: game.lives,
    wave: game.waves.current,
    stats: { ...game.stats },
    time: game.time,
    cleared: [...game.clearedObstacles],
    towers: game.towers.map((t) => ({ c: t.c, r: t.r, rot: t.rot, type: t.type, level: t.level, invested: t.invested, targetMode: t.targetMode, kills: t.kills, damageDealt: t.damageDealt })),
    savedAt: Date.now(),
  }
}

export function restore(GameClass, snap) {
  if (!snap || (snap.v !== 1 && snap.v !== 2)) throw new Error('Unbekanntes Spielstand-Format')
  const g = new GameClass({ mapId: snap.mapId, difficulty: snap.difficulty, seed: snap.seed, mode: snap.mode || 'normal' })
  if (g.map.id !== snap.mapId) throw new Error('Karte nicht gefunden')
  g.wallet.gold = snap.gold
  g.wallet.earned = snap.earned || 0
  g.wallet.spent = snap.spent || 0
  g.lives = snap.lives
  g.waves.started = Math.min(snap.wave, g.waves.total)
  g.waves.phase = 'build' // nach dem Laden wartet das Spiel, bis der Spieler die Welle startet
  Object.assign(g.stats, snap.stats)
  g.time = snap.time || 0
  for (const id of snap.cleared || []) {
    const o = g.obstacles.get(id)
    if (!o) continue
    g.grid.setObstacle(o.cells, 0)
    if (o.def.blocksSight) g.grid.sightBlockers -= o.cells.length
    g.obstacles.delete(id)
    g.clearedObstacles.push(id)
  }
  g.migratedRefund = 0
  for (const t of snap.towers) {
    if (!TOWERS[t.type]) continue
    let place = null
    if (snap.v === 2) {
      const p = checkPlacement(g, t.type, t.c, t.r, t.rot || 0)
      if (p.ok) place = p
    } else {
      // Version 1: Turm stand auf Bauplatz Nr. t.spot – nächste freie Rasterposition dort suchen
      const spot = g.map.spots?.[t.spot]
      if (spot) place = findPlacementNear(g, t.type, spot.x, spot.y, 0, 4)
    }
    if (!place) {
      // passt nicht mehr: Gold vollständig erstatten statt den Turm zu verlieren
      g.wallet.gold += t.invested
      g.migratedRefund += t.invested
      continue
    }
    const tower = createTower(t.type, place, g.nextId++)
    tower.level = Math.min(t.level, tower.def.levels.length - 1)
    tower.invested = t.invested
    tower.targetMode = t.targetMode || tower.targetMode
    tower.kills = t.kills || 0
    tower.damageDealt = t.damageDealt || 0
    g.grid.setTower(tower.cells, tower.id)
    g.towers.push(tower)
  }
  refreshBuffs(g.towers)
  return g
}
