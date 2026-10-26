// Präzisionsplatzierung: Controller (Touch, Maus, Tastatur teilen Zustand und Prüfung), Schutz vor
// Doppelbau, Abbrechen, Ansichtsdrehung (Bildschirm ↔ Welt) und Lage der Lupe an den Rändern.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Game } from '../js/game/game.js'
import { Controller } from '../js/ui/controller.js'
import { TOWERS } from '../js/config/towers.js'
import { WORLD } from '../js/config/maps.js'
import { placeLoupe, LOUPE } from '../js/render/loupe.js'
import { nearestSnap } from '../js/ui/sheet.js'

// Controller mit steuerbarer Uhr (für die Doppeltipp-Sperre)
function setup({ gold = 1000, mapId = 'gruenental' } = {}) {
  const game = new Game({ mapId })
  game.wallet.gold = gold
  const clock = { t: 1000 }
  const messages = []
  const ctl = new Controller({ now: () => clock.t, onMessage: (m, k) => messages.push([m, k]) })
  ctl.setGame(game)
  return { game, ctl, clock, messages }
}

// gültiger Platz für einen Typ nahe einem Punkt (Weltmitte der Grundfläche)
const spotFor = (game, type, x = 640, y = 360) => game.findPlacementNear(type, x, y, 0, 12)
// Punkt auf dem Weg
function pathPoint(game) {
  const p = {}
  game.routes[0].sample(game.routes[0].length * 0.4, p)
  return p
}

test('Touch: Tippen und erneutes Tippen setzen nur die Vorschau – es wird nie gebaut', () => {
  const { game, ctl } = setup()
  const s = spotFor(game, 'arrow')
  ctl.chooseType('arrow')
  ctl.tap(s.x, s.y, { touch: true })
  ctl.tap(s.x, s.y, { touch: true })
  ctl.tap(s.x + 1, s.y + 1, { touch: true })
  assert.equal(game.towers.length, 0)
  assert.equal(game.gold, 1000)
  assert.equal(ctl.sel.preview.c, s.c)
  assert.equal(ctl.sel.preview.r, s.r)
  assert.ok(ctl.sel.preview.ok)
})

test('Ziehen (setCursor) baut nie, auch über viele Zellen und schnelle Bewegungen', () => {
  const { game, ctl } = setup()
  ctl.chooseType('cannon')
  for (let x = 0; x <= WORLD.width; x += 37) for (let y = 0; y <= WORLD.height; y += 53) ctl.setCursor(x, y)
  assert.equal(game.towers.length, 0)
  assert.equal(game.gold, 1000)
  assert.ok(ctl.placing)
})

test('„Bauen“ baut genau einen Turm und zieht genau einmal Gold ab – auch bei Doppeltipp', () => {
  const { game, ctl, clock } = setup()
  const s = spotFor(game, 'arrow')
  ctl.chooseType('arrow')
  ctl.setCursor(s.x, s.y)
  assert.equal(ctl.confirm(), true)
  // zweiter Tipp 50 ms später: „Bauen“ ist weg, an seiner Stelle sitzt „Verbessern“ – beides gesperrt
  clock.t += 50
  assert.equal(ctl.confirm(), false)
  ctl.upgrade()
  assert.equal(game.towers.length, 1)
  assert.equal(game.towers[0].level, 0, 'nicht versehentlich verbessert')
  assert.equal(game.gold, 1000 - TOWERS.arrow.levels[0].cost)
  // nach Ablauf der Sperre geht Verbessern wieder
  clock.t += Controller.LOCK_MS
  ctl.upgrade()
  assert.equal(game.towers[0].level, 1)
})

test('Enter/confirm außerhalb des Baumodus tut nichts (kein verstecktes Verbessern)', () => {
  const { game, ctl, clock } = setup()
  const s = spotFor(game, 'arrow')
  ctl.chooseType('arrow')
  ctl.setCursor(s.x, s.y)
  ctl.confirm()
  clock.t += 5000
  const gold = game.gold
  assert.equal(ctl.confirm(), false)
  assert.equal(game.towers[0].level, 0)
  assert.equal(game.gold, gold)
})

test('Gleichen Turm erneut wählen beendet den Baumodus statt zu bauen', () => {
  const { game, ctl } = setup()
  const s = spotFor(game, 'arrow')
  ctl.chooseType('arrow')
  ctl.setCursor(s.x, s.y)
  ctl.chooseType('arrow')
  assert.equal(ctl.placing, false)
  assert.equal(game.towers.length, 0)
})

test('Abbrechen kostet nichts und hinterlässt keinen Turm', () => {
  const { game, ctl } = setup()
  const s = spotFor(game, 'trebuchet')
  ctl.chooseType('trebuchet')
  ctl.setCursor(s.x, s.y)
  ctl.nudge(1, 0)
  ctl.rotate()
  ctl.cancel()
  assert.equal(game.gold, 1000)
  assert.equal(game.towers.length, 0)
  assert.equal(ctl.placing, false)
  assert.equal(ctl.sel.preview, null)
})

test('Ungültige Position und zu wenig Gold: kein Bau, kein Abzug, Begründung', () => {
  const { game, ctl, messages } = setup({ gold: 1000 })
  const p = pathPoint(game)
  ctl.chooseType('arrow')
  ctl.setCursor(p.x, p.y)
  assert.equal(ctl.sel.preview.ok, false)
  assert.equal(ctl.confirm(), false)
  assert.equal(game.gold, 1000)
  assert.match(messages.at(-1)[0], /Weg/)
  const s = spotFor(game, 'sniper')
  game.wallet.gold = 10
  ctl.chooseType('sniper')
  ctl.setCursor(s.x, s.y)
  assert.equal(ctl.sel.preview.ok, true)
  assert.equal(ctl.sel.preview.goldOk, false)
  assert.equal(ctl.confirm(), false)
  assert.equal(game.gold, 10)
  assert.equal(game.towers.length, 0)
})

test('Beim Bestätigen wird neu geprüft – eine veraltete Vorschau baut nicht', () => {
  const { game, ctl } = setup()
  const s = spotFor(game, 'arrow')
  ctl.chooseType('arrow')
  ctl.setCursor(s.x, s.y)
  assert.ok(ctl.sel.preview.ok && ctl.sel.preview.goldOk)
  // zwischen Vorschau und Bestätigung wird das Gold knapp (z. B. durch Verbessern an anderer Stelle)
  game.wallet.gold = 5
  assert.equal(ctl.confirm(), false)
  assert.equal(game.towers.length, 0)
  assert.equal(game.gold, 5)
})

test('Vorschau und Bau nutzen dieselbe Prüfung (an jeder Zelle der Karte)', () => {
  const { game, ctl, clock } = setup({ gold: 1e6, mapId: 'sumpfgabel' })
  for (const type of ['arrow', 'cannon', 'trebuchet', 'ballista']) {
    ctl.chooseType(type)
    for (let r = 0; r < game.grid.rows; r += 3) for (let c = 0; c < game.grid.cols; c += 4) {
      ctl.sel.anchor = { c, r }
      ctl.updatePreview()
      const expect = game.canBuild(type, c, r, ctl.sel.rot)
      assert.equal(ctl.sel.preview.ok && ctl.sel.preview.goldOk, expect.ok, `${type} ${c},${r}`)
    }
    // genau an der geprüften Stelle bauen
    const s = spotFor(game, type, 300 + game.towers.length * 120, 200)
    ctl.setCursor(s.x, s.y)
    clock.t += 1000
    const before = game.towers.length
    assert.equal(ctl.confirm(), true)
    assert.equal(game.towers.length, before + 1)
    const t = game.towers.at(-1)
    assert.equal(t.c, s.c)
    assert.equal(t.r, s.r)
  }
})

test('Touch und Tastatur führen zur selben Vorschau (gemeinsamer Zustand)', () => {
  const a = setup(), b = setup()
  const s = spotFor(a.game, 'cannon')
  // Touch: Finger auf die Mitte der Grundfläche
  a.ctl.chooseType('cannon')
  a.ctl.setCursor(s.x, s.y)
  // Tastatur: von der Startposition aus mit Pfeiltasten dorthin
  b.ctl.chooseType('cannon')
  b.ctl.nudge(0, 0)
  const start = b.ctl.sel.anchor
  for (let i = 0; i < Math.abs(s.c - start.c); i++) b.ctl.nudge(Math.sign(s.c - start.c), 0)
  for (let i = 0; i < Math.abs(s.r - start.r); i++) b.ctl.nudge(0, Math.sign(s.r - start.r))
  assert.deepEqual(b.ctl.sel.anchor, a.ctl.sel.anchor)
  assert.deepEqual({ ...b.ctl.sel.preview, cells: null }, { ...a.ctl.sel.preview, cells: null })
})

test('Tastatur in Bildschirmrichtung: gedrehte Ansicht übersetzt Pfeile richtig', () => {
  const { ctl } = setup()
  // gedrehte Ansicht (wie Renderer.screenStepToWorld bei rot = 1)
  ctl.screenStep = (dx, dy) => ({ dc: dy, dr: -dx })
  ctl.chooseType('arrow')
  ctl.nudge(0, 0)
  const a0 = { ...ctl.sel.anchor }
  ctl.nudgeScreen(0, -1) // nach oben = Welt-x kleiner
  assert.deepEqual(ctl.sel.anchor, { c: a0.c - 1, r: a0.r })
  ctl.nudgeScreen(1, 0) // nach rechts = Welt-y kleiner
  assert.deepEqual(ctl.sel.anchor, { c: a0.c - 1, r: a0.r - 1 })
})

test('Vorschau bleibt an allen vier Kartenrändern innerhalb des Rasters', () => {
  const { game, ctl } = setup()
  for (const type of ['arrow', 'cannon', 'trebuchet']) {
    ctl.chooseType(type)
    const { w, h } = ctl.footprint()
    for (const [x, y] of [[-50, 360], [WORLD.width + 50, 360], [640, -50], [640, WORLD.height + 50], [0, 0], [WORLD.width, WORLD.height]]) {
      ctl.setCursor(x, y)
      const a = ctl.sel.anchor
      assert.ok(a.c >= 0 && a.r >= 0 && a.c + w <= game.grid.cols && a.r + h <= game.grid.rows, `${type} bei ${x},${y}: ${a.c},${a.r}`)
    }
    for (let i = 0; i < 60; i++) ctl.nudge(1, 1)
    const a = ctl.sel.anchor
    assert.equal(a.c, game.grid.cols - w)
    assert.equal(a.r, game.grid.rows - h)
    ctl.cancel()
  }
})

// ---------- Ansicht: Bildschirm ↔ Welt ----------
async function makeRenderer(width, height, dpr = 3) {
  globalThis.window = { devicePixelRatio: dpr }
  const { Renderer } = await import('../js/render/renderer.js')
  const canvas = { width: 0, height: 0, getContext: () => ({}), getBoundingClientRect: () => ({ left: 10, top: 20, width, height }) }
  const r = new Renderer(canvas)
  r.resize()
  return r
}

test('Ansicht: Hochformat dreht die Karte, Querformat nicht; Umrechnung hin und zurück stimmt', async () => {
  for (const [w, h, rotated] of [[390, 650, true], [844, 390, false], [1000, 700, false], [300, 300, false]]) {
    const r = await makeRenderer(w, h)
    assert.equal(!!r.rot, rotated, `${w}×${h}`)
    for (const [x, y] of [[0, 0], [1280, 720], [640, 360], [17.5, 703.2], [1279, 1]]) {
      const p = r.worldToCanvas(x, y)
      assert.ok(p.x >= -0.01 && p.x <= w + 0.01 && p.y >= -0.01 && p.y <= h + 0.01, `${x},${y} → ${p.x},${p.y}`)
      const q = r.canvasToWorld(p.x, p.y)
      assert.ok(Math.abs(q.x - x) < 1e-9 && Math.abs(q.y - y) < 1e-9)
      // toWorld berücksichtigt die Lage des Canvas im Fenster
      const t = r.toWorld(p.x + 10, p.y + 20)
      assert.ok(Math.abs(t.x - x) < 1e-9 && Math.abs(t.y - y) < 1e-9)
    }
    // Kartenfläche füllt mindestens eine Seite ganz aus
    const m = r.mapRect()
    assert.ok(Math.abs(m.width - w) < 0.01 || Math.abs(m.height - h) < 0.01)
    // ctx-Matrix entspricht worldToCanvas
    const [a, b, c, d, e, f] = r.viewMatrix()
    const p = r.worldToCanvas(100, 200)
    assert.ok(Math.abs(a * 100 + c * 200 + e - p.x) < 1e-9 && Math.abs(b * 100 + d * 200 + f - p.y) < 1e-9)
  }
})

test('Ansicht: Pfeilschritte bewegen die Vorschau in die gedrückte Bildschirmrichtung', async () => {
  for (const [w, h] of [[390, 650], [844, 390]]) {
    const r = await makeRenderer(w, h)
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const { dc, dr } = r.screenStepToWorld(dx, dy)
      const a = r.worldToCanvas(640, 360), b = r.worldToCanvas(640 + dc * 32, 360 + dr * 32)
      const mx = Math.sign(Math.round(b.x - a.x)), my = Math.sign(Math.round(b.y - a.y))
      assert.deepEqual([mx, my], [dx, dy], `${w}×${h} Schritt ${dx},${dy}`)
    }
  }
})

test('Ansicht: „Karte nie drehen“ wird beachtet', async () => {
  const r = await makeRenderer(390, 650)
  assert.equal(r.rot, 1)
  r.setRotateMode('off')
  assert.equal(r.rot, 0)
  r.setRotateMode('auto')
  assert.equal(r.rot, 1)
})

// ---------- Lupe ----------
test('Lupe liegt immer im Spielfeld und nie über dem Finger – an allen Rändern', () => {
  const W = 390, H = 650, size = LOUPE.size, finger = 34
  for (let px = 0; px <= W; px += 13) for (let py = 0; py <= H; py += 13) {
    const p = placeLoupe(px, py, W, H, { size, finger })
    assert.ok(p.x >= 0 && p.y >= 0 && p.x + size <= W && p.y + size <= H, `${px},${py}`)
    // Finger (Kreis mit Radius 20 um den Berührungspunkt) überlappt die Lupe nicht, sofern Platz ist
    const cx = Math.max(p.x, Math.min(px, p.x + size)), cy = Math.max(p.y, Math.min(py, p.y + size))
    const free = Math.hypot(cx - px, cy - py)
    assert.ok(free >= 20, `Lupe verdeckt den Finger bei ${px},${py} (${p.side})`)
  }
  assert.equal(placeLoupe(200, 400, W, H, { finger }).side, 'above')
  assert.equal(placeLoupe(200, 30, W, H, { finger }).side, 'below')
})

test('Sheet: Rastposition nach Höhe und Wischrichtung', () => {
  const hs = { compact: 66, half: 380, full: 700 }
  assert.equal(nearestSnap(hs, 70), 'compact')
  assert.equal(nearestSnap(hs, 300), 'half')
  assert.equal(nearestSnap(hs, 650), 'full')
  // schneller Wisch nach oben aus der Mitte: nächste Stufe darüber
  assert.equal(nearestSnap(hs, 400, 1.2), 'full')
  assert.equal(nearestSnap(hs, 360, -1.2), 'compact')
})
