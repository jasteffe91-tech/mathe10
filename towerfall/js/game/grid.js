// Logisches Raster über der Spielwelt: Umrechnung Welt ↔ Zelle und drei Belegungsebenen
// (Gelände, Hindernis, Turm). Kennt keine Spielregeln – die stehen in placement.js.
import { CELL } from '../config/terrain.js'

export class Grid {
  constructor(width, height, cell = CELL) {
    this.cell = cell
    this.cols = Math.floor(width / cell)
    this.rows = Math.floor(height / cell)
    const n = this.cols * this.rows
    this.terrain = new Array(n).fill('grass') // Geländeart je Zelle (Schlüssel aus TERRAIN)
    this.obstacle = new Int32Array(n)         // Hindernis-ID oder 0
    this.tower = new Int32Array(n)            // Turm-ID oder 0
    this.version = 0                          // steigt bei jeder Änderung (für Zwischenspeicher der Darstellung)
    this.sightBlockers = 0                    // Anzahl sichtblockierender Zellen – 0 spart Sichtprüfungen
  }

  inBounds(c, r) { return c >= 0 && r >= 0 && c < this.cols && r < this.rows }
  idx(c, r) { return r * this.cols + c }
  cellAt(x, y) { return { c: Math.floor(x / this.cell), r: Math.floor(y / this.cell) } }
  cellCenter(c, r) { return { x: (c + 0.5) * this.cell, y: (r + 0.5) * this.cell } }

  // Linke obere Zelle einer w × h-Grundfläche, deren Mitte möglichst nah an (x, y) liegt
  anchorFor(x, y, w, h) {
    return { c: Math.round(x / this.cell - w / 2), r: Math.round(y / this.cell - h / 2) }
  }

  // Weltmittelpunkt einer Grundfläche
  footprintCenter(c, r, w, h) {
    return { x: (c + w / 2) * this.cell, y: (r + h / 2) * this.cell }
  }

  // Alle Zellen einer Grundfläche (auch solche außerhalb des Rasters, markiert mit inside: false)
  footprintCells(c, r, w, h) {
    const cells = []
    for (let dr = 0; dr < h; dr++) {
      for (let dc = 0; dc < w; dc++) {
        const cc = c + dc, rr = r + dr
        cells.push({ c: cc, r: rr, inside: this.inBounds(cc, rr) })
      }
    }
    return cells
  }

  setTower(cells, id) {
    for (const { c, r } of cells) this.tower[this.idx(c, r)] = id
    this.version++
  }

  setObstacle(cells, id) {
    for (const { c, r } of cells) this.obstacle[this.idx(c, r)] = id
    this.version++
  }

  // Sichtlinie zwischen zwei Weltpunkten: Abtasten in halben Zellschritten.
  // `blocks(obstacleId)` entscheidet, ob ein Hindernis die Sicht versperrt.
  lineOfSight(x1, y1, x2, y2, blocks) {
    if (!this.sightBlockers) return true
    const d = Math.hypot(x2 - x1, y2 - y1)
    const steps = Math.ceil(d / (this.cell / 2))
    for (let i = 1; i < steps; i++) {
      const t = i / steps
      const c = Math.floor((x1 + (x2 - x1) * t) / this.cell)
      const r = Math.floor((y1 + (y2 - y1) * t) / this.cell)
      if (!this.inBounds(c, r)) continue
      const o = this.obstacle[this.idx(c, r)]
      if (o && blocks(o)) return false
    }
    return true
  }
}
