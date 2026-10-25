// Maus-, Touch- und Tastatureingaben. Pointer Events decken Maus, Stift und Finger gemeinsam ab.
// Ein Tipp zählt nur, wenn sich der Finger kaum bewegt hat (kein versehentliches Bauen beim Scrollen).
import { handleModalKey } from './modal.js'

export function setupPointer(canvas, renderer, controller) {
  let down = null
  // Toleranz in Weltpixeln: mindestens der Bauplatz, auf kleinen Bildschirmen etwas mehr für Finger
  const tolerance = (type) => Math.max(type === 'touch' ? 36 : 30, (type === 'touch' ? 22 : 14) * renderer.worldPerCssPx)

  canvas.addEventListener('pointerdown', (e) => {
    down = { x: e.clientX, y: e.clientY, id: e.pointerId, type: e.pointerType }
  })
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return
    const w = renderer.toWorld(e.clientX, e.clientY)
    if (controller.game && controller.hover(w.x, w.y, tolerance('mouse'))) {
      canvas.style.cursor = controller.sel.hoverSpot !== null ? 'pointer' : 'default'
    }
  })
  canvas.addEventListener('pointerleave', () => { controller.sel.hoverSpot = null })
  canvas.addEventListener('pointerup', (e) => {
    if (!down || down.id !== e.pointerId) return
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y)
    const type = down.type
    down = null
    if (moved > 12 || !controller.game) return
    const w = renderer.toWorld(e.clientX, e.clientY)
    controller.tap(w.x, w.y, tolerance(type))
  })
  canvas.addEventListener('pointercancel', () => { down = null })
  canvas.addEventListener('contextmenu', (e) => { e.preventDefault(); controller.clear() })
}

export function setupKeyboard({ isActive, controller, actions }) {
  document.addEventListener('keydown', (e) => {
    if (handleModalKey(e)) return
    if (!isActive()) return
    if (e.target.closest('input, select, textarea')) return
    if (e.ctrlKey || e.metaKey || e.altKey) return
    const k = e.key
    // Leertaste/Enter auf einer per Tab fokussierten Schaltfläche lösen diese aus, nicht das Spiel
    if ((k === ' ' || k === 'Enter') && e.target.closest('button, a')) return
    let handled = true
    if (k >= '1' && k <= '6') controller.chooseIndex(Number(k) - 1)
    else if (k === ' ' || k === 'p' || k === 'P') actions.togglePause()
    else if (k === 'n' || k === 'N') actions.nextWave()
    else if (k === 'f' || k === 'F' || k === '+') actions.cycleSpeed()
    else if (k === 'u' || k === 'U') controller.upgrade()
    else if (k === 'v' || k === 'V' || k === 'Delete' || k === 'Backspace') actions.sell()
    else if (k === 't' || k === 'T') controller.cycleTargetMode()
    else if (k === 'ArrowRight' || k === 'ArrowDown') controller.cycleSpot(1)
    else if (k === 'ArrowLeft' || k === 'ArrowUp') controller.cycleSpot(-1)
    else if (k === 'Enter') controller.confirm()
    else if (k === 'Escape') {
      if (controller.sel.spot !== null || controller.sel.tower || controller.sel.type) controller.clear()
      else actions.openMenu()
    } else handled = false
    if (handled) e.preventDefault()
  })
}
