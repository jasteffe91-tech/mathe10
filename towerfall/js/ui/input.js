// Maus-, Touch- und Tastatureingaben. Pointer Events decken Maus, Stift und Finger gemeinsam ab.
// Maus: Die Vorschau folgt dem Zeiger, ein Klick baut (Desktop-Bedienung).
// Finger/Stift: Im Baumodus folgt die Vorschau dem Finger, die Lupe zeigt den Bereich unter dem Finger
//   vergrößert. Loslassen baut nie – gebaut wird nur mit „Bauen“. Ein kurzer Tipp ohne Baumodus wählt
//   Türme bzw. Hindernisse aus.
// Tastatur: Pfeiltasten verschieben die Vorschau (in Bildschirmrichtung), die Lupe folgt; Enter baut.
import { handleModalKey } from './modal.js'

const FINGER_GAP = 34 // Abstand der Lupe zum Berührungspunkt (CSS-Pixel), damit der Finger sie nicht verdeckt

export function setupPointer(canvas, renderer, controller, loupe = null) {
  let down = null

  const showLoupeAt = (w) => loupe?.show(w.x, w.y, { finger: FINGER_GAP })

  canvas.addEventListener('pointerdown', (e) => {
    down = { x: e.clientX, y: e.clientY, id: e.pointerId, type: e.pointerType, dragged: false }
    if (e.pointerType === 'mouse') { controller.inputMode = 'mouse'; loupe?.hide(); return }
    controller.inputMode = 'touch'
    if (!controller.game || !controller.placing) return
    canvas.setPointerCapture?.(e.pointerId)
    // Vorschau sofort unter den Finger setzen und die Lupe zeigen – gebaut wird dabei nichts
    const w = renderer.toWorld(e.clientX, e.clientY)
    controller.setCursor(w.x, w.y)
    showLoupeAt(w)
  })
  canvas.addEventListener('pointermove', (e) => {
    if (!controller.game) return
    if (e.pointerType === 'mouse') {
      const w = renderer.toWorld(e.clientX, e.clientY)
      if (controller.placing) controller.setCursor(w.x, w.y)
      else {
        const { c, r } = controller.game.grid.cellAt(w.x, w.y)
        canvas.style.cursor = controller.game.towerAt(c, r) || controller.game.obstacleAt(c, r) ? 'pointer' : 'default'
      }
      return
    }
    // Finger/Stift: Vorschau ziehen (auch sehr schnelle Bewegungen: alle Zwischenpunkte des Frames)
    if (!down || down.id !== e.pointerId || !controller.placing) return
    if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) down.dragged = true
    const events = e.getCoalescedEvents?.() || []
    const last = events.length ? events[events.length - 1] : e
    const w = renderer.toWorld(last.clientX, last.clientY)
    controller.setCursor(w.x, w.y)
    showLoupeAt(w)
  })
  const release = (e) => {
    if (!down || down.id !== e.pointerId) return
    const { type, dragged } = down
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y)
    down = null
    if (type !== 'mouse') loupe?.hide()
    if (!controller.game || dragged || moved > 12) return
    const w = renderer.toWorld(e.clientX, e.clientY)
    // Touch im Baumodus: setzt nur die Vorschau (siehe Controller.tap) – Loslassen baut nie
    controller.tap(w.x, w.y, { touch: type !== 'mouse', shift: e.shiftKey })
  }
  canvas.addEventListener('pointerup', release)
  canvas.addEventListener('pointercancel', () => { down = null; loupe?.hide() })
  // Browser „korrigieren“ Fingertipps zu nahe gelegenen klickbaren Elementen (Touch Adjustment).
  // Ein Klick-Handler macht das Spielfeld selbst klickbar – ein Tipp knapp am Kartenrand landet so
  // auf der Karte statt auf einem Knopf der Kopfleiste oder des Infobereichs (z. B. „Bauen“).
  canvas.addEventListener('click', () => {})
  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault()
    controller.placing ? controller.cancel() : controller.clear()
  })
}

export function setupKeyboard({ isActive, controller, actions, loupe = null }) {
  document.addEventListener('keydown', (e) => {
    if (handleModalKey(e)) return
    if (!isActive()) return
    if (e.target.closest('input, select, textarea')) return
    if (e.ctrlKey || e.metaKey || e.altKey) return
    const k = e.key
    // Leertaste/Enter auf einer per Tab fokussierten Schaltfläche lösen diese aus, nicht das Spiel
    if ((k === ' ' || k === 'Enter') && e.target.closest('button, a')) return
    const placing = controller.placing
    const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }
    let handled = true
    if (k >= '1' && k <= '9') controller.chooseIndex(Number(k) - 1)
    else if (arrows[k]) {
      if (placing) {
        controller.inputMode = 'keyboard'
        controller.nudgeScreen(...arrows[k])
        const p = controller.sel.preview
        if (p && loupe) loupe.show(p.x, p.y)
      } else controller.cycleTower(arrows[k][0] + arrows[k][1] > 0 ? 1 : -1)
    } else if (k === 'r' || k === 'R') controller.rotate()
    else if (k === 'Enter') controller.confirm({ keepPlacing: e.shiftKey })
    else if (k === ' ' || k === 'p' || k === 'P') actions.togglePause()
    else if (k === 'n' || k === 'N') actions.nextWave()
    else if (k === 'f' || k === 'F' || k === '+') actions.cycleSpeed()
    else if (k === 'u' || k === 'U') controller.upgrade()
    else if (k === 'm' || k === 'M') controller.startMove()
    else if (k === 'c' || k === 'C') controller.clearObstacle()
    else if (k === 'v' || k === 'V' || k === 'Delete' || k === 'Backspace') actions.sell()
    else if (k === 't' || k === 'T') controller.cycleTargetMode()
    else if (k === 'Escape') {
      if (placing) controller.cancel()
      else if (controller.sel.tower || controller.sel.obstacle) controller.clear()
      else actions.openMenu()
    } else handled = false
    if (handled) e.preventDefault()
  })
}
