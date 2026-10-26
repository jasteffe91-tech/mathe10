// Infobereich als „Bottom Sheet“ auf Smartphones: drei Rastpositionen (kompakt, halb, voll).
// Aufziehen per Wischen am Griff oder an der Kompaktzeile, Tippen auf den Griff wechselt kompakt ↔ halb
// (die Kompaktzeile reagiert nur auf Wischen, nicht auf Tippen).
// Kartentipps öffnen das Sheet nie – es ändert sich nur durch Gesten am Sheet selbst.
// Das Sheet liegt beim Aufziehen über der Karte; die Spielfläche behält ihre Größe.
// Auf dem Desktop ist es ein normaler Bereich in der Seitenleiste (keine Rastpositionen).

export const SNAPS = ['compact', 'half', 'full']
export const MOBILE_QUERY = '(max-aspect-ratio: 1/1), (max-height: 520px)'

// Nächste Rastposition zu einer Höhe; mit Wischgeschwindigkeit (px/ms, positiv = nach oben) eine
// Stufe weiter in Wischrichtung
export function nearestSnap(heights, h, velocity = 0) {
  let best = 'compact', bestD = Infinity
  for (const s of SNAPS) {
    const d = Math.abs(heights[s] - h)
    if (d < bestD) { bestD = d; best = s }
  }
  if (Math.abs(velocity) > 0.5) {
    const order = SNAPS.filter((s) => (velocity > 0 ? heights[s] > h : heights[s] < h))
    if (order.length) best = order.sort((a, b) => Math.abs(heights[a] - h) - Math.abs(heights[b] - h))[0]
  }
  return best
}

export class Sheet {
  constructor({ root, stage, onChange }) {
    this.root = root
    this.panel = root.querySelector('.sheet-panel')
    this.grip = root.querySelector('.sheet-grip')
    this.compactEl = root.querySelector('.sheet-compact')
    this.stage = stage
    this.onChange = onChange
    this.snap = 'compact'
    this.mq = window.matchMedia(MOBILE_QUERY)
    this.drag = null
    this.grip.addEventListener('click', () => { if (!this.suppressClick) this.toggle() })
    for (const el of [this.grip, this.compactEl]) el.addEventListener('pointerdown', (e) => this.onDown(e))
    window.addEventListener('pointermove', (e) => this.onMove(e))
    window.addEventListener('pointerup', (e) => this.onUp(e))
    window.addEventListener('pointercancel', () => this.endDrag(null))
    this.mq.addEventListener?.('change', () => this.layout())
    this.layout()
  }

  // laufendes Ziehen abbrechen (Fokusverlust, App im Hintergrund) – das Sheet rastet wieder ein
  cancelDrag() { if (this.drag) this.endDrag(null) }

  get mobile() { return this.mq.matches }

  heights() {
    const compact = this.root.clientHeight
    const portrait = innerHeight >= innerWidth
    if (portrait) {
      const stageH = this.stage.clientHeight
      return { compact, half: Math.round(compact + stageH * 0.5), full: Math.round(compact + stageH - 6) }
    }
    return { compact, half: Math.round(innerHeight * 0.6), full: innerHeight }
  }

  // Rastposition anwenden (auch nach Größenänderungen aufrufen)
  layout() {
    if (!this.mobile) {
      this.panel.style.height = ''
      this.root.dataset.snap = 'compact'
      return
    }
    const h = this.heights()[this.snap]
    this.panel.style.height = this.snap === 'compact' ? '' : `${h}px`
    this.root.dataset.snap = this.snap
    const open = this.snap !== 'compact'
    this.grip.setAttribute('aria-expanded', String(open))
    this.grip.setAttribute('aria-label', open ? 'Infobereich verkleinern' : 'Infobereich vergrößern')
  }

  set(snap) {
    if (!SNAPS.includes(snap)) return
    const changed = snap !== this.snap
    this.snap = snap
    this.layout()
    if (changed) this.onChange?.(snap)
  }

  toggle() { this.set(this.snap === 'compact' ? 'half' : 'compact') }

  onDown(e) {
    if (!this.mobile || e.button > 0) return
    // Knöpfe in der Kompaktzeile bleiben normale Knöpfe
    if (e.target.closest('.sheet-compact button')) return
    this.drag = { id: e.pointerId, y0: e.clientY, h0: this.panel.getBoundingClientRect().height, t0: performance.now(), lastY: e.clientY, lastT: performance.now(), v: 0, moved: false, fromGrip: !!e.target.closest('.sheet-grip') }
  }

  onMove(e) {
    const d = this.drag
    if (!d || e.pointerId !== d.id) return
    const dy = e.clientY - d.y0
    if (!d.moved && Math.abs(dy) < 6) return
    if (!d.moved) { d.moved = true; this.root.classList.add('dragging') }
    const now = performance.now()
    if (now > d.lastT) d.v = (d.lastY - e.clientY) / (now - d.lastT) // positiv = nach oben
    d.lastY = e.clientY
    d.lastT = now
    const hs = this.heights()
    const h = Math.max(hs.compact, Math.min(hs.full, d.h0 - dy))
    this.panel.style.height = `${h}px`
    e.preventDefault()
  }

  onUp(e) {
    const d = this.drag
    if (!d || e.pointerId !== d.id) return
    this.endDrag(e)
  }

  endDrag(e) {
    const d = this.drag
    this.drag = null
    this.root.classList.remove('dragging')
    if (!d || !e) { this.layout(); return }
    // Ein Tipp ohne Ziehen ändert nichts: Der Griff schaltet per click um, die Kompaktzeile nur per Wischen
    // (ein Fingertipp knapp unter der Karte soll das Sheet nicht versehentlich öffnen)
    if (!d.moved) return
    // nach einem Zug kein zusätzliches Umschalten durch das folgende click-Ereignis
    this.suppressClick = true
    setTimeout(() => { this.suppressClick = false }, 0)
    const h = this.panel.getBoundingClientRect().height
    this.set(nearestSnap(this.heights(), h, d.v))
    this.layout()
  }
}
