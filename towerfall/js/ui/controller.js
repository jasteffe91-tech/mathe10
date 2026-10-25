// Auswahl und Spieleraktionen: Bauplatz/Turm wählen, bauen, verbessern, verkaufen.
// Wird von Maus, Touch, Tastatur und den Schaltflächen gemeinsam genutzt.
import { TOWERS, TOWER_ORDER, TARGET_MODE_ORDER } from '../config/towers.js'

export class Controller {
  constructor({ onChange, onMessage, sfx }) {
    this.game = null
    this.onChange = onChange
    this.onMessage = onMessage
    this.sfx = sfx
    this.sel = { spot: null, tower: null, type: null, hoverSpot: null, upgradeHover: false }
  }

  setGame(game) {
    this.game = game
    this.clear()
  }

  changed() { this.onChange?.() }

  clear() {
    Object.assign(this.sel, { spot: null, tower: null, type: null, upgradeHover: false })
    this.changed()
  }

  spotAt(x, y, tolerance) {
    let best = null, bestD = tolerance * tolerance
    for (const s of this.game.spots) {
      const d = (s.x - x) ** 2 + (s.y - y) ** 2
      if (d <= bestD) { bestD = d; best = s }
    }
    return best
  }

  hover(x, y, tolerance) {
    const s = this.spotAt(x, y, tolerance)
    const idx = s ? s.index : null
    if (idx !== this.sel.hoverSpot) {
      this.sel.hoverSpot = idx
      return true
    }
    return false
  }

  // Tipp/Klick auf die Karte
  tap(x, y, tolerance) {
    const s = this.spotAt(x, y, tolerance)
    if (!s) { this.clear(); return }
    if (s.tower) { this.selectTower(s.tower); return }
    if (this.sel.type && (this.sel.spot === null || this.sel.spot === s.index)) {
      // Turmtyp war schon gewählt: direkt bauen
      this.sel.spot = s.index
      this.build()
      return
    }
    this.sel.spot = s.index
    this.sel.tower = null
    this.sfx?.play('click')
    this.changed()
  }

  selectTower(tower) {
    Object.assign(this.sel, { tower, spot: null, type: null })
    this.sfx?.play('click')
    this.changed()
  }

  // Turm im Baumenü gewählt
  chooseType(type) {
    if (!TOWERS[type]) return
    if (this.sel.tower) this.sel.tower = null
    if (this.sel.spot !== null && this.sel.type === type) { this.build(); return } // zweiter Tipp bestätigt
    this.sel.type = this.sel.type === type && this.sel.spot === null ? null : type
    this.sfx?.play('click')
    this.changed()
  }

  chooseIndex(i) { this.chooseType(TOWER_ORDER[i]) }

  build() {
    const { spot, type } = this.sel
    if (spot === null || !type) return
    const r = this.game.build(spot, type)
    if (!r.ok) {
      this.sfx?.play('error')
      this.onMessage?.(r.reason, 'error')
      this.changed()
      return
    }
    Object.assign(this.sel, { spot: null, type: null, tower: r.tower })
    this.changed()
  }

  upgrade() {
    const t = this.sel.tower
    if (!t) return
    const r = this.game.upgrade(t)
    if (!r.ok) {
      this.sfx?.play('error')
      this.onMessage?.(r.reason, 'error')
    }
    this.changed()
  }

  sell() {
    const t = this.sel.tower
    if (!t) return
    const r = this.game.sell(t)
    if (r.ok) {
      Object.assign(this.sel, { tower: null, spot: t.spot, type: null })
      this.onMessage?.(`Turm verkauft: +${r.value} Gold`, 'info')
    }
    this.changed()
  }

  setTargetMode(mode) {
    if (!this.sel.tower) return
    this.game.setTargetMode(this.sel.tower, mode)
    this.sfx?.play('click')
    this.changed()
  }

  cycleTargetMode() {
    const t = this.sel.tower
    if (!t) return
    const i = TARGET_MODE_ORDER.indexOf(t.targetMode)
    this.setTargetMode(TARGET_MODE_ORDER[(i + 1) % TARGET_MODE_ORDER.length])
  }

  // Pfeiltasten: Bauplätze reihum auswählen
  cycleSpot(dir) {
    const n = this.game.spots.length
    let idx = this.sel.spot ?? this.sel.tower?.spot ?? (dir > 0 ? -1 : 0)
    idx = (idx + dir + n) % n
    const s = this.game.spots[idx]
    if (s.tower) Object.assign(this.sel, { tower: s.tower, spot: null })
    else Object.assign(this.sel, { spot: idx, tower: null })
    this.changed()
  }

  confirm() {
    if (this.sel.spot !== null && this.sel.type) this.build()
    else if (this.sel.tower) this.upgrade()
  }
}
