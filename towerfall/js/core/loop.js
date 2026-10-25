// Spielschleife mit fester Simulationsschrittweite (Akkumulator-Verfahren).
// requestAnimationFrame liefert die Bilder; die Simulation läuft immer in Schritten von 1/60 s,
// unabhängig davon, ob das Gerät 30, 60 oder 144 Bilder pro Sekunde schafft.
import { SIM } from '../config/balance.js'

export class GameLoop {
  constructor({ update, render, step = SIM.step, maxSteps = SIM.maxStepsPerFrame, maxFrame = SIM.maxFrameTime }) {
    this.update = update
    this.render = render
    this.step = step
    this.maxSteps = maxSteps
    this.maxFrame = maxFrame
    this.speed = 1
    this.paused = false
    this.running = false
    this.acc = 0
    this.last = 0
    this.raf = 0
    this.frame = this.frame.bind(this)
  }

  start() {
    if (this.running) return
    this.running = true
    this.last = performance.now()
    this.acc = 0
    this.raf = requestAnimationFrame(this.frame)
  }

  stop() {
    this.running = false
    cancelAnimationFrame(this.raf)
  }

  // Einen Frame verarbeiten; `now` in Millisekunden. Gibt die Zahl der Simulationsschritte zurück.
  tick(now) {
    // Nach Tab-Wechsel o. Ä. keine riesigen Zeitsprünge simulieren
    const real = Math.min(this.maxFrame, Math.max(0, (now - this.last) / 1000))
    this.last = now
    let steps = 0
    if (!this.paused) {
      this.acc += real * this.speed
      while (this.acc >= this.step && steps < this.maxSteps * this.speed) {
        this.update(this.step)
        this.acc -= this.step
        steps++
      }
      if (steps >= this.maxSteps * this.speed) this.acc = 0 // Gerät zu langsam: Rückstand verwerfen
    }
    this.render(this.paused ? 1 : this.acc / this.step, this.paused ? 0 : real * this.speed, real)
    return steps
  }

  frame(now) {
    if (!this.running) return
    try {
      this.tick(now)
    } catch (err) {
      console.error('Fehler in der Spielschleife:', err)
    }
    this.raf = requestAnimationFrame(this.frame)
  }
}
