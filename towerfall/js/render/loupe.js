// Lupe für die genaue Platzierung (Touch und Tastatur). Größe, Zoom, Abstände und bevorzugte Lage stehen
// zentral in config/ui.js (MAGNIFIER). Sie kopiert jeden Frame den Ausschnitt des
// Spielfelds rund um den Zielpunkt aus dem fertig gezeichneten Canvas und vergrößert ihn – zeigt also
// exakt dasselbe Bild mit derselben Koordinatenumrechnung (auch bei gedrehter Karte und jeder
// Pixeldichte). Darüber liegen scharf gezeichnet: Fadenkreuz, Zellraster und der Umriss der
// Grundfläche in Grün (passt) bzw. Rot (geht nicht). Die Lupe liest nur – sie verändert weder
// Spielzustand noch Vorschau.

import { MAGNIFIER } from '../config/ui.js'

// Lage eines Kandidaten (linke obere Ecke) relativ zum Berührungspunkt (px, py)
function candidate(side, px, py, w, h, ox, oy, gap) {
  switch (side) {
    case 'top-left': return { x: px - ox - w, y: py - oy - h }
    case 'top-right': return { x: px + ox, y: py - oy - h }
    case 'bottom-left': return { x: px - ox - w, y: py + oy }
    case 'bottom-right': return { x: px + ox, y: py + oy }
    case 'left': return { x: px - gap - w, y: py - h * 0.6 }
    case 'right': return { x: px + gap, y: py - h * 0.6 }
    case 'top': return { x: px - w / 2, y: py - gap - h }
    default: return { x: px - w / 2, y: py + gap } // bottom
  }
}

// Position der Lupe im Spielfeld (CSS-Pixel). Probiert die Seiten in der bevorzugten Reihenfolge
// (Rechtshänder: links oben, links, oben, …) und nimmt die erste, die vollständig ins Spielfeld passt.
// Mit `previous` bleibt die bisherige Seite, solange sie passt – zurück auf eine bevorzugtere Seite geht
// es erst, wenn dort `hysteresis` Pixel Luft sind. Passt nichts, wird die bevorzugte Seite in das
// Spielfeld geschoben (fits = false).
export function placeMagnifier(px, py, stageW, stageH, opts = {}) {
  const o = { ...MAGNIFIER, hand: 'right', finger: true, previous: null, ...opts }
  const w = o.width, h = o.height
  const order = o.preferred[o.hand] || o.preferred.right
  // Tastatur: kein Finger im Weg, die Lupe darf näher an den Zielpunkt
  const ox = o.finger ? o.offsetX : o.keyboardOffset
  const oy = o.finger ? o.offsetY : o.keyboardOffset
  const gap = o.finger ? o.fingerRadius + 8 : o.keyboardOffset
  const pad = o.edgePadding
  const fits = (r, m = 0) => r.x >= pad + m && r.y >= pad + m && r.x + w <= stageW - pad - m && r.y + h <= stageH - pad - m
  const at = (side) => ({ ...candidate(side, px, py, w, h, ox, oy, gap), side })
  if (o.previous && order.includes(o.previous) && fits(at(o.previous))) {
    for (const side of order) {
      if (side === o.previous) break
      const r = at(side)
      if (fits(r, o.hysteresis)) return { ...r, w, h, fits: true }
    }
    return { ...at(o.previous), w, h, fits: true }
  }
  for (const side of order) {
    const r = at(side)
    if (fits(r)) return { ...r, w, h, fits: true }
  }
  const r = at(order[0])
  return {
    x: Math.max(pad, Math.min(stageW - pad - w, r.x)),
    y: Math.max(pad, Math.min(stageH - pad - h, r.y)),
    side: order[0], w, h, fits: false,
  }
}

export class Loupe {
  constructor(canvas, renderer) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this.renderer = renderer
    this.visible = false
    this.target = null      // Weltpunkt in der Mitte der Lupe
    this.anchor = null      // Bildschirmpunkt (CSS-Pixel im Spielfeld), an dem die Lupe hängt
    this.finger = false     // true: Touch (Abstand für den Finger), false: Tastatur
    this.side = null        // aktuelle Lage (für die Hysterese)
    this.overlay = true     // scharfe Hilfslinien (für Pixelvergleiche in Tests abschaltbar)
    this.last = null        // zuletzt verwendeter Quellausschnitt (für Tests)
    this.hand = 'right'
    this.scale = 1
    this.box = null
  }

  // Einstellungen: Hand (rechts/links) und Größenstufe (normal/groß)
  configure({ hand = 'right', size = 'normal' } = {}) {
    this.hand = hand === 'left' ? 'left' : 'right'
    this.scale = MAGNIFIER.sizes[size] || 1
    this.side = null
  }

  // Größe nach Einstellung, auf kleinen Spielfeldern begrenzt (MAGNIFIER.maxShare)
  get limit() {
    const rect = this.renderer.canvas.getBoundingClientRect()
    return Math.min(rect.width, rect.height) * MAGNIFIER.maxShare
  }

  get width() { return Math.round(Math.min(MAGNIFIER.width * this.scale, this.limit * (MAGNIFIER.width / Math.max(MAGNIFIER.width, MAGNIFIER.height)))) }
  get height() { return Math.round(Math.min(MAGNIFIER.height * this.scale, this.limit * (MAGNIFIER.height / Math.max(MAGNIFIER.width, MAGNIFIER.height)))) }

  // Lupe an einem Weltpunkt zeigen; `finger`: true bei Touch (Lupe hält Abstand zum Finger)
  show(worldX, worldY, { finger = false } = {}) {
    this.target = { x: worldX, y: worldY }
    if (this.finger !== !!finger) this.side = null
    this.finger = !!finger
    this.anchor = this.renderer.worldToCanvas(worldX, worldY)
    if (!this.visible) {
      this.visible = true
      this.side = null
      this.canvas.hidden = false
    }
    this.position()
  }

  hide() {
    if (!this.visible) return
    this.visible = false
    this.canvas.hidden = true
    this.target = null
    this.side = null
  }

  position() {
    const r = this.renderer
    const rect = r.canvas.getBoundingClientRect()
    const w = this.width, h = this.height
    const p = placeMagnifier(this.anchor.x, this.anchor.y, rect.width, rect.height, { width: w, height: h, hand: this.hand, finger: this.finger, previous: this.side })
    this.side = p.side
    this.box = p
    // Außenmaß inkl. Rahmen = w × h; der Bildbereich ist um den Rahmen kleiner (content-box)
    const b = MAGNIFIER.borderWidth
    const st = this.canvas.style
    st.width = `${w - 2 * b}px`
    st.height = `${h - 2 * b}px`
    st.borderWidth = `${b}px`
    st.borderRadius = w === h ? '50%' : '18px'
    st.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px)`
    const pw = Math.round((w - 2 * b) * r.dpr), ph = Math.round((h - 2 * b) * r.dpr)
    if (this.canvas.width !== pw || this.canvas.height !== ph) { this.canvas.width = pw; this.canvas.height = ph }
  }

  // nach dem Zeichnen des Spielfelds aufrufen
  draw(preview) {
    if (!this.visible || !this.target) return
    const r = this.renderer
    const { ctx } = this
    const src = r.canvas
    const dpr = r.dpr
    const lw = this.canvas.width, lh = this.canvas.height   // Gerätepixel der Lupe
    const zoom = MAGNIFIER.zoom
    // Mittelpunkt im Spielfeld (CSS-Pixel) – gleiche Umrechnung wie beim Zeichnen
    const c = r.worldToCanvas(this.target.x, this.target.y)
    this.anchor = c
    // Quellausschnitt in Gerätepixeln des Spielfelds (gleiches Seitenverhältnis → keine Verzerrung)
    const sw = lw / zoom, sh = lh / zoom
    const sx = c.x * dpr - sw / 2, sy = c.y * dpr - sh / 2
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.fillStyle = '#0d1118'
    ctx.fillRect(0, 0, lw, lh)
    // Ränder: nur den Teil kopieren, der im Canvas liegt (Rest bleibt dunkel)
    const x0 = Math.max(0, sx), y0 = Math.max(0, sy)
    const x1 = Math.min(src.width, sx + sw), y1 = Math.min(src.height, sy + sh)
    if (x1 > x0 && y1 > y0) {
      ctx.imageSmoothingEnabled = true
      ctx.drawImage(src, x0, y0, x1 - x0, y1 - y0, (x0 - sx) * zoom, (y0 - sy) * zoom, (x1 - x0) * zoom, (y1 - y0) * zoom)
    }
    this.last = { sx, sy, sw, sh, zoom, dpr, w: lw, h: lh }
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
    const mx = this.canvas.width / 2, my = this.canvas.height / 2
    ctx.strokeStyle = 'rgba(0,0,0,.7)'
    ctx.lineWidth = 3 * k
    ctx.beginPath()
    ctx.moveTo(mx - 9 * k, my); ctx.lineTo(mx + 9 * k, my)
    ctx.moveTo(mx, my - 9 * k); ctx.lineTo(mx, my + 9 * k)
    ctx.stroke()
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 1.2 * k
    ctx.stroke()
  }
}
