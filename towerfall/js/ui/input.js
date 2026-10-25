// Maus-, Touch- und Tastatureingaben. Pointer Events decken Maus, Stift und Finger gemeinsam ab.
// Im Baumodus folgt die Vorschau der Maus bzw. dem Finger (Ziehen); ein Tipp zählt nur, wenn sich
// der Finger kaum bewegt hat.
import { handleModalKey } from './modal.js'

export function setupPointer(canvas, renderer, controller) {
  let down = null

  canvas.addEventListener('pointerdown', (e) => {
    down = { x: e.clientX, y: e.clientY, id: e.pointerId, type: e.pointerType, dragged: false }
    if (e.pointerType !== 'mouse' && controller.placing) canvas.setPointerCapture?.(e.pointerId)
  })
  canvas.addEventListener('pointermove', (e) => {
    if (!controller.game) return
    const w = renderer.toWorld(e.clientX, e.clientY)
    if (e.pointerType === 'mouse') {
      if (controller.placing) controller.setCursor(w.x, w.y)
      else {
        const { c, r } = controller.game.grid.cellAt(w.x, w.y)
        canvas.style.cursor = controller.game.towerAt(c, r) || controller.game.obstacleAt(c, r) ? 'pointer' : 'default'
      }
      return
    }
    // Finger/Stift: Vorschau ziehen
    if (down && down.id === e.pointerId && controller.placing && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8) {
      down.dragged = true
      controller.setCursor(w.x, w.y)
    }
  })
  canvas.addEventListener('pointerup', (e) => {
    if (!down || down.id !== e.pointerId) return
    const { type, dragged } = down
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y)
    down = null
    if (!controller.game || dragged || moved > 12) return
    const w = renderer.toWorld(e.clientX, e.clientY)
    controller.tap(w.x, w.y, { touch: type !== 'mouse', shift: e.shiftKey })
  })
  canvas.addEventListener('pointercancel', () => { down = null })
  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault()
    controller.placing ? controller.cancel() : controller.clear()
  })
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
    const placing = controller.placing
    const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }
    let handled = true
    if (k >= '1' && k <= '9') controller.chooseIndex(Number(k) - 1)
    else if (arrows[k]) {
      if (placing) controller.nudge(...arrows[k])
      else controller.cycleTower(arrows[k][0] + arrows[k][1] > 0 ? 1 : -1)
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
