// Obere Leiste: Leben, Gold, Welle, Gegnerfortschritt und die Steuerknöpfe.
// DOM wird nur angefasst, wenn sich ein angezeigter Wert tatsächlich ändert.
import { earlyCallBonus } from '../game/economy.js'
import { BALANCE } from '../config/balance.js'

export class Hud {
  constructor(els) {
    this.els = els
    this.cache = {}
  }

  set(name, prop, value) {
    const k = `${name}.${prop}`
    if (this.cache[k] === value) return
    this.cache[k] = value
    const el = this.els[name]
    if (prop === 'text') el.textContent = value
    else if (prop === 'width') el.style.width = value
    else if (prop === 'class') el.className = value
    else el.setAttribute(prop, value)
  }

  reset() { this.cache = {} }

  update(game, loop) {
    this.set('lives', 'text', String(game.lives))
    this.set('livesBox', 'class', `stat lives ${game.lives <= game.maxLives * 0.3 ? 'low' : ''}`)
    this.set('gold', 'text', String(game.gold))
    this.set('wave', 'text', `${game.wave}/${game.totalWaves}`)

    const w = game.waves
    const alive = game.enemies.length
    const total = w.totalThisWave
    let label = 'Bereit'
    let progress = 0
    if (w.phase === 'active') {
      const remaining = alive + (total - w.spawnedThisWave)
      label = `${remaining} Gegner`
      progress = total ? 1 - remaining / total : 0
    } else if (w.phase === 'countdown') {
      label = `Pause ${Math.ceil(w.countdown)} s`
      progress = 1 - w.countdown / BALANCE.wavePause
    } else if (w.phase === 'done') {
      label = 'Geschafft'
      progress = 1
    }
    this.set('enemies', 'text', label)
    const pct = `${Math.round(Math.max(0, Math.min(1, progress)) * 100)}%`
    this.set('progress', 'width', pct)
    if (this.els.line) this.set('line', 'width', pct)

    // Langtext für breite Bildschirme, Kurztext für die kompakte Kopfleiste auf dem Smartphone
    let next = 'Welle starten', short = '▶'
    let disabled = false
    if (w.phase === 'build') { next = `Welle ${w.current + 1} starten`; short = `▶ Start` }
    else if (w.phase === 'countdown') {
      const bonus = earlyCallBonus(w.countdown)
      next = `Welle ${w.current + 1} jetzt${bonus ? ` +${bonus} G` : ''}`
      short = bonus ? `▶ +${bonus}` : `▶ ${w.current + 1}`
    } else if (w.phase === 'active') {
      if (w.canCallNext()) { next = `Welle ${w.current + 1} vorziehen +${BALANCE.overlapCallBonus} G`; short = `▶▶ +${BALANCE.overlapCallBonus}` }
      else { next = `Welle ${w.current} läuft`; short = 'läuft'; disabled = true }
    } else { next = 'Letzte Welle'; short = '–'; disabled = true }
    this.set('next', 'text', next)
    if (this.els.nextShort) this.set('nextShort', 'text', short)
    if (this.els.nextBtn) this.set('nextBtn', 'aria-label', next)
    this.set(this.els.nextBtn ? 'nextBtn' : 'next', 'aria-disabled', String(disabled))
    this.set('nextCls', 'class', `btn primary next-btn ${disabled ? 'disabled' : ''} ${w.phase === 'build' ? 'pulse' : ''}`)

    this.set('speed', 'text', `${loop.speed}×`)
    this.set('speed', 'aria-label', `Spielgeschwindigkeit ${loop.speed}-fach (Taste F)`)
    this.set('pause', 'text', loop.paused ? '▶' : '❚❚')
    this.set('pause', 'aria-label', loop.paused ? 'Fortsetzen (Leertaste)' : 'Pause (Leertaste)')
  }
}
