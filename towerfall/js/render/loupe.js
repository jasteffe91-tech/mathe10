// Lupe für die genaue Platzierung (Touch und Tastatur). Sie kopiert jeden Frame den Ausschnitt des
// Spielfelds rund um den Zielpunkt aus dem fertig gezeichneten Canvas und vergrößert ihn – zeigt also
// exakt dasselbe Bild mit derselben Koordinatenumrechnung (auch bei gedrehter Karte und jeder
// Pixeldichte). Darüber liegen scharf gezeichnet: Fadenkreuz, Zellraster und der Umriss der
// Grundfläche in Grün (passt) bzw. Rot (geht nicht). Die Lupe liest nur – sie verändert weder
// Spielzustand noch Vorschau.

export const LOUPE = { size: 132, zoom: 2.2, gap: 28 }

// Lage der Lupe im Spielfeld (CSS-Pixel): bevorzugt oberhalb des Fingers, an Rändern nach unten bzw.
// zur Seite ausweichend, immer vollständig innerhalb des Spielfelds und nie über dem Finger.
export function placeLoupe(px, py, stageW, stageH, { size = LOUPE.size, gap = LOUPE.gap, finger = 0 } = {}) {
  const half = size / 2
  const clampX = (x) => Math.max(4, Math.min(stageW - size - 4, x))
  const clampY = (y) => Math.max(4, Math.min(stageH - size - 4, y))
  const lift = gap + finger
  // 1. oberhalb
  if (py - lift - size >= 4) return { x: clampX(px - half), y: py - lift - size, side: 'above' }
  // 2. unterhalb
  if (py + lift + size <= stageH - 4) return { x: clampX(px - half), y: py + lift, side: 'below' }
  // 3. seitlich (zur Seite mit mehr Platz)
  const left = px - lift - size, right = px + lift
  if (px > stageW / 2 && left >= 4) return { x: left, y: clampY(py - half), side: 'left' }
  if (right + size <= stageW - 4) return { x: right, y: clampY(py - half), side: 'right' }
  return { x: clampX(left), y: clampY(py - half), side: 'left' }
}

export class Loupe {
  constructor(canvas, renderer) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this.renderer = renderer
    this.visible = false
    this.target = null      // Weltpunkt in der Mitte der Lupe
    this.anchor = null      // Bildschirmpunkt (CSS-Pixel im Spielfeld), an dem die Lupe hängt
    this.finger = 0         // zusätzlicher Abstand für den Finger
    this.overlay = true     // scharfe Hilfslinien (für Pixelvergleiche in Tests abschaltbar)
    this.last = null        // zuletzt verwendeter Quellausschnitt (für Tests)
  }

  // Lupe an einem Weltpunkt zeigen; `finger`: Abstand, damit der Finger sie nicht verdeckt
  show(worldX, worldY, { finger = 0 } = {}) {
    this.target = { x: worldX, y: worldY }
    this.finger = finger
    this.anchor = this.renderer.worldToCanvas(worldX, worldY)
    if (!this.visible) {
      this.visible = true
      this.canvas.hidden = false
    }
    this.position()
  }

  hide() {
    if (!this.visible) return
    this.visible = false
    this.canvas.hidden = true
    this.target = null
  }

  position() {
    const r = this.renderer
    const rect = r.canvas.getBoundingClientRect()
    const size = LOUPE.size
    const p = placeLoupe(this.anchor.x, this.anchor.y, rect.width, rect.height, { size, finger: this.finger })
    this.box = { ...p, size }
    const st = this.canvas.style
    st.width = st.height = `${size}px`
    st.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px)`
    const px = Math.round(size * r.dpr)
    if (this.canvas.width !== px) { this.canvas.width = px; this.canvas.height = px }
  }

  // nach dem Zeichnen des Spielfelds aufrufen
  draw(preview) {
    if (!this.visible || !this.target) return
    const r = this.renderer
    const { ctx } = this
    const src = r.canvas
    const dpr = r.dpr
    const size = this.canvas.width                 // Gerätepixel der Lupe
    const zoom = LOUPE.zoom
    // Mittelpunkt im Spielfeld (CSS-Pixel) – gleiche Umrechnung wie beim Zeichnen
    const c = r.worldToCanvas(this.target.x, this.target.y)
    this.anchor = c
    // Quellausschnitt in Gerätepixeln des Spielfelds
    const sw = size / zoom
    const sx = c.x * dpr - sw / 2, sy = c.y * dpr - sw / 2
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.fillStyle = '#0d1118'
    ctx.fillRect(0, 0, size, size)
    // Ränder: nur den Teil kopieren, der im Canvas liegt (Rest bleibt dunkel)
    const x0 = Math.max(0, sx), y0 = Math.max(0, sy)
    const x1 = Math.min(src.width, sx + sw), y1 = Math.min(src.height, sy + sw)
    if (x1 > x0 && y1 > y0) {
      ctx.imageSmoothingEnabled = true
      ctx.drawImage(src, x0, y0, x1 - x0, y1 - y0, (x0 - sx) * zoom, (y0 - sy) * zoom, (x1 - x0) * zoom, (y1 - y0) * zoom)
    }
    this.last = { sx, sy, sw, zoom, dpr, size }
    if (this.overlay) this.drawOverlay(preview, sx, sy, zoom, dpr)
  }

  // Weltpunkt → Lupenpixel
  toLoupe(x, y, sx, sy, zoom, dpr) {
    const p = this.renderer.worldToCanvas(x, y)
    return { x: (p.x * dpr - sx) * zoom, y: (p.y * dpr - sy) * zoom }
  }

  drawOverlay(preview, sx, sy, zoom, dpr) {
    const { ctx } = this
    const r = this.renderer
    const game = r.game
    const size = this.canvas.width
    const k = dpr
    const line = (pts, color, width) => {
      ctx.strokeStyle = color
      ctx.lineWidth = width * k
      ctx.beginPath()
      pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)))
      ctx.closePath()
      ctx.stroke()
    }
    // feines Zellraster rund um den Zielpunkt
    if (game) {
      const cell = game.grid.cell
      const { c, r: row } = game.grid.cellAt(this.target.x, this.target.y)
      ctx.strokeStyle = 'rgba(255,255,255,.28)'
      ctx.lineWidth = 1 * k
      ctx.beginPath()
      for (let i = -4; i <= 5; i++) {
        const a = this.toLoupe((c + i) * cell, (row - 4) * cell, sx, sy, zoom, dpr)
        const b = this.toLoupe((c + i) * cell, (row + 5) * cell, sx, sy, zoom, dpr)
        ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y)
        const d = this.toLoupe((c - 4) * cell, (row + i) * cell, sx, sy, zoom, dpr)
        const e = this.toLoupe((c + 5) * cell, (row + i) * cell, sx, sy, zoom, dpr)
        ctx.moveTo(d.x, d.y); ctx.lineTo(e.x, e.y)
      }
      ctx.stroke()
      // Grundfläche der Vorschau
      if (preview?.cells?.length) {
        const cs = preview.cells
        const minC = Math.min(...cs.map((q) => q.c)), maxC = Math.max(...cs.map((q) => q.c)) + 1
        const minR = Math.min(...cs.map((q) => q.r)), maxR = Math.max(...cs.map((q) => q.r)) + 1
        const corners = [[minC, minR], [maxC, minR], [maxC, maxR], [minC, maxR]].map(([cc, rr]) => this.toLoupe(cc * cell, rr * cell, sx, sy, zoom, dpr))
        const ok = preview.ok && preview.goldOk
        line(corners, 'rgba(0,0,0,.6)', 4)
        line(corners, ok ? '#7dff7a' : preview.ok ? '#ffd257' : '#ff6a5e', 2)
      }
    }
    // Fadenkreuz in der Mitte (= Finger bzw. Zielpunkt)
    const m = size / 2
    ctx.strokeStyle = 'rgba(0,0,0,.7)'
    ctx.lineWidth = 3 * k
    ctx.beginPath()
    ctx.moveTo(m - 9 * k, m); ctx.lineTo(m + 9 * k, m)
    ctx.moveTo(m, m - 9 * k); ctx.lineTo(m, m + 9 * k)
    ctx.stroke()
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 1.2 * k
    ctx.stroke()
  }
}
