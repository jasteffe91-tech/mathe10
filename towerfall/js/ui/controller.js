// Auswahl und Spieleraktionen auf dem Raster: Turm wählen → Vorschau → bestätigen; Türme versetzen,
// verbessern, verkaufen; Hindernisse räumen. Wird von Maus, Touch, Tastatur und den Schaltflächen
// gemeinsam genutzt – alle Wege führen über dieselbe Vorschau (updatePreview) und dieselbe Prüfung
// im Spiel (canBuild/build). Kosten entstehen erst beim Bestätigen – Abbrechen ist immer kostenlos.
// Touch: Ein Tipp oder Ziehen setzt nur die Vorschau; gebaut wird ausschließlich über „Bauen“.
// Nach jeder kostenpflichtigen Aktion sperrt eine kurze Pause weitere Aktionen, damit ein schneller
// Doppeltipp nicht doppelt baut oder den neuen Turm gleich verbessert.
import { TOWERS, TOWER_ORDER, TARGET_MODE_ORDER, footprintOf } from '../config/towers.js'

export class Controller {
  constructor({ onChange, onMessage, sfx, now = () => performance.now() }) {
    this.game = null
    this.onChange = onChange
    this.onMessage = onMessage
    this.sfx = sfx
    this.now = now
    this.lockUntil = 0
    this.inputMode = 'mouse' // zuletzt benutztes Eingabegerät: mouse | touch | keyboard
    // Bildschirmrichtung → Zellschritt (die Ansicht kann gedreht sein; setzt main.js)
    this.screenStep = (dx, dy) => ({ dc: dx, dr: dy })
    this.sel = this.emptySelection()
  }

  static LOCK_MS = 400

  get locked() { return this.now() < this.lockUntil }
  lock() { this.lockUntil = this.now() + Controller.LOCK_MS }

  emptySelection() {
    return {
      type: null,      // Turmtyp im Baumodus
      moving: null,    // Turm im Versetzmodus
      rot: 0,          // Drehung der Vorschau
      anchor: null,    // linke obere Zelle der Vorschau
      preview: null,   // Ergebnis der Platzierungsprüfung für die Vorschau
      tower: null,     // ausgewählter Turm
      obstacle: null,  // ausgewähltes Hindernis
      upgradeHover: false,
    }
  }

  get placing() { return !!(this.sel.type || this.sel.moving) }

  setGame(game) {
    this.game = game
    this.sel = this.emptySelection()
    this.changed()
  }

  changed() { this.onChange?.() }

  clear() {
    this.sel = this.emptySelection()
    this.changed()
  }

  // ---------- Bau- und Versetzmodus ----------
  chooseType(type) {
    if (!TOWERS[type]) return
    if (this.sel.type === type) {
      // gleicher Turm nochmal: Baumodus beenden (gebaut wird nur über „Bauen“, Enter oder Klick auf die Karte)
      this.cancel()
      return
    }
    const anchor = this.sel.anchor
    this.sel = { ...this.emptySelection(), type, rot: 0 }
    if (anchor) { this.sel.anchor = anchor; this.updatePreview() }
    this.sfx?.play('click')
    this.changed()
  }

  chooseIndex(i) { if (TOWER_ORDER[i]) this.chooseType(TOWER_ORDER[i]) }

  startMove() {
    const t = this.sel.tower
    if (!t) return
    this.sel = { ...this.emptySelection(), moving: t, tower: t, rot: t.rot, anchor: { c: t.c, r: t.r } }
    this.updatePreview()
    this.sfx?.play('click')
    this.changed()
  }

  cancel() {
    const t = this.sel.moving
    this.sel = this.emptySelection()
    if (t) this.sel.tower = t
    this.changed()
  }

  footprint() {
    const type = this.sel.type || this.sel.moving?.type
    return type ? footprintOf(type, this.sel.rot) : { w: 1, h: 1 }
  }

  // Vorschau an eine Weltposition (Zeiger/Finger) setzen; true, wenn sich die Zelle geändert hat
  setCursor(x, y) {
    if (!this.placing) return false
    const { w, h } = this.footprint()
    const a = this.clampAnchor(this.game.grid.anchorFor(x, y, w, h))
    if (this.sel.anchor && a.c === this.sel.anchor.c && a.r === this.sel.anchor.r) return false
    this.sel.anchor = a
    this.updatePreview()
    this.changed()
    return true
  }

  // Vorschau in Bildschirmrichtung verschieben (Pfeiltasten, Pfeilknöpfe) – auch bei gedrehter Karte
  nudgeScreen(dx, dy) {
    const { dc, dr } = this.screenStep(dx, dy)
    this.nudge(dc, dr)
  }

  // Vorschau zellweise verschieben (Weltrichtung)
  nudge(dc, dr) {
    if (!this.placing) return
    if (!this.sel.anchor) this.sel.anchor = this.defaultAnchor()
    this.sel.anchor = this.clampAnchor({ c: this.sel.anchor.c + dc, r: this.sel.anchor.r + dr })
    this.updatePreview()
    this.changed()
  }

  // Grundfläche bleibt vollständig im Raster – auch wenn Finger oder Zeiger über den Kartenrand hinausgehen
  clampAnchor({ c, r }) {
    const g = this.game.grid
    const { w, h } = this.footprint()
    return { c: Math.max(0, Math.min(g.cols - w, c)), r: Math.max(0, Math.min(g.rows - h, r)) }
  }

  // Startpunkt für die Tastatur: nächste freie Stelle zur Kartenmitte
  defaultAnchor() {
    const type = this.sel.type || this.sel.moving.type
    const near = this.game.findPlacementNear(type, 640, 360, this.sel.rot, 12)
    return near ? { c: near.c, r: near.r } : { c: 18, r: 9 }
  }

  rotate() {
    const type = this.sel.type || this.sel.moving?.type
    if (!type || !TOWERS[type].footprint.rotatable) {
      if (type) this.onMessage?.('Dieser Turm ist quadratisch – Drehen ändert nichts.', 'info')
      return
    }
    // um die Mitte drehen, damit die Vorschau nicht springt
    const before = this.footprint()
    this.sel.rot = this.sel.rot ? 0 : 1
    const after = this.footprint()
    if (this.sel.anchor) {
      this.sel.anchor = this.clampAnchor({
        c: this.sel.anchor.c + Math.round((before.w - after.w) / 2),
        r: this.sel.anchor.r + Math.round((before.h - after.h) / 2),
      })
    }
    this.updatePreview()
    this.sfx?.play('click')
    this.changed()
  }

  updatePreview() {
    const s = this.sel
    if (!this.placing || !s.anchor) { s.preview = null; return }
    const { c, r } = s.anchor
    if (s.type) {
      const res = this.game.canBuild(s.type, c, r, s.rot)
      s.preview = {
        ...res,
        type: s.type,
        level: 0,
        range: TOWERS[s.type].levels[0].range,
        ok: res.ok || res.code === 'gold',  // Position gültig?
        goldOk: res.code !== 'gold',
      }
    } else {
      const t = s.moving
      const res = this.game.canMove(t, c, r, s.rot)
      s.preview = {
        ...res,
        type: t.type,
        level: t.level,
        range: t.stats.range,
        ok: res.ok || res.code === 'gold' || res.code === 'same',
        goldOk: res.code !== 'gold',
      }
    }
  }

  // Bestätigen: erst jetzt wird gebaut bzw. versetzt und bezahlt. Nur im Bau-/Versetzmodus –
  // Enter oder ein zweiter Tipp nach dem Bauen verbessert also nie versehentlich den neuen Turm.
  // Gibt true zurück, wenn tatsächlich gebaut bzw. versetzt wurde.
  confirm({ keepPlacing = false } = {}) {
    const s = this.sel
    if (!this.placing || this.locked) return false
    if (!s.anchor) { this.nudge(0, 0); return false }
    const { c, r } = s.anchor
    // build/moveTower prüfen die Position erneut (Gold, Belegung, Wege) – die Vorschau kann veraltet sein
    if (s.type) {
      const res = this.game.build(s.type, c, r, s.rot)
      if (!res.ok) { this.fail(res.reason); return false }
      this.lock()
      if (keepPlacing) this.updatePreview()
      else this.sel = { ...this.emptySelection(), tower: res.tower }
    } else {
      const t = s.moving
      const res = this.game.moveTower(t, c, r, s.rot)
      if (!res.ok) { this.fail(res.reason); return false }
      this.lock()
      this.sel = { ...this.emptySelection(), tower: t }
      this.onMessage?.(`Turm versetzt (−${res.cost} G)`, 'info')
    }
    this.changed()
    return true
  }

  fail(reason) {
    this.sfx?.play('error')
    this.onMessage?.(reason || 'Hier geht das nicht.', 'error')
    this.updatePreview()
    this.changed()
  }

  // ---------- Tipp/Klick auf die Karte ----------
  // Maus: Klick setzt die Vorschau und bestätigt sie (Desktop-Bedienung). Touch: Tippen setzt nur die
  // Vorschau – gebaut wird ausschließlich über „Bauen“, nie beim Loslassen des Fingers.
  tap(x, y, { touch = false, shift = false } = {}) {
    if (this.placing) {
      this.setCursor(x, y)
      if (!touch) this.confirm({ keepPlacing: shift })
      return
    }
    const { c, r } = this.game.grid.cellAt(x, y)
    const tower = this.game.towerAt(c, r)
    if (tower) { this.selectTower(tower); return }
    const obstacle = this.game.obstacleAt(c, r)
    if (obstacle) {
      this.sel = { ...this.emptySelection(), obstacle }
      this.sfx?.play('click')
      this.changed()
      return
    }
    this.clear()
  }

  selectTower(tower) {
    this.sel = { ...this.emptySelection(), tower }
    this.sfx?.play('click')
    this.changed()
  }

  // ---------- Aktionen am ausgewählten Turm / Hindernis ----------
  upgrade() {
    const t = this.sel.tower
    if (!t || this.placing || this.locked) return
    const r = this.game.upgrade(t)
    if (!r.ok) {
      this.sfx?.play('error')
      this.onMessage?.(r.reason, 'error')
    } else this.lock()
    this.changed()
  }

  sell() {
    const t = this.sel.tower
    if (!t || this.placing) return
    const r = this.game.sell(t)
    if (r.ok) {
      this.sel = this.emptySelection()
      this.onMessage?.(`Turm verkauft: +${r.value} Gold`, 'info')
    }
    this.changed()
  }

  clearObstacle() {
    const o = this.sel.obstacle
    if (!o) return
    const r = this.game.clearObstacle(o)
    if (!r.ok) return this.fail(r.reason)
    this.lock()
    this.sel = this.emptySelection()
    this.onMessage?.(`${o.def.name} geräumt (−${r.cost} G)`, 'info')
    this.changed()
  }

  // Hindernis unter der Vorschau räumen, ohne den Baumodus zu verlassen
  clearPreviewObstacle() {
    const o = this.sel.preview?.obstacle
    if (!o || this.locked) return
    const r = this.game.clearObstacle(o)
    if (!r.ok) return this.fail(r.reason)
    this.lock()
    this.onMessage?.(`${o.def.name} geräumt (−${r.cost} G)`, 'info')
    this.updatePreview()
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
    if (!t || t.def.attack === 'aura') return
    const i = TARGET_MODE_ORDER.indexOf(t.targetMode)
    this.setTargetMode(TARGET_MODE_ORDER[(i + 1) % TARGET_MODE_ORDER.length])
  }

  // Pfeiltasten außerhalb des Baumodus: gebaute Türme reihum auswählen
  cycleTower(dir) {
    const list = this.game.towers
    if (!list.length) return
    const i = list.indexOf(this.sel.tower)
    this.selectTower(list[(i + dir + list.length) % list.length])
  }

  // Turm-Auswahl bereinigen, falls er inzwischen verkauft wurde
  validate() {
    if (this.sel.tower && !this.game.towers.includes(this.sel.tower)) this.clear()
    if (this.sel.obstacle && !this.game.obstacles.has(this.sel.obstacle.id)) this.clear()
  }
}
