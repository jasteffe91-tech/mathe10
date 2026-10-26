// Browser-Test der Präzisionsplatzierung (Playwright/Chromium, Geräte-Simulation – kein echtes iPhone):
// Ziehen mit dem Finger, Lupe (Pixelvergleich mit dem Spielfeld), Ränder, schnelles Ziehen, Drehen des
// Geräts, Tastatur mit Lupe, kein Bau beim Loslassen, genau ein Bau über „Bauen“, Bottom Sheet.
// Aufruf: node tests/browser/placement.mjs   (Playwright muss installiert sein)
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { mkdir } from 'node:fs/promises'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')
const root = fileURLToPath(new URL('../..', import.meta.url))
const shots = process.env.SHOTS || fileURLToPath(new URL('../../.shots/', import.meta.url))
await mkdir(shots, { recursive: true })
const PORT = 8767
const URL_ = `http://localhost:${PORT}/`
const server = spawn(process.execPath, ['tools/serve.mjs', String(PORT)], { cwd: root, stdio: 'pipe' })
await new Promise((r) => server.stdout.once('data', r))

const results = []
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` – ${detail}` : ''}`) }

const DEVICES = [
  { name: 'iPhone SE hoch', width: 375, height: 667, dpr: 2 },
  { name: 'iPhone 14 hoch', width: 390, height: 844, dpr: 3 },
  { name: 'Android hoch (DPR 2,625)', width: 412, height: 915, dpr: 2.625 },
  { name: 'iPhone 14 quer', width: 844, height: 390, dpr: 3 },
]

const browser = await chromium.launch()
try {
  for (const d of DEVICES) {
    const ctx = await browser.newContext({ viewport: { width: d.width, height: d.height }, deviceScaleFactor: d.dpr, hasTouch: true, isMobile: true })
    const page = await ctx.newPage()
    const errors = []
    page.on('pageerror', (e) => errors.push(String(e)))
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
    await page.goto(URL_)
    await page.evaluate(() => localStorage.setItem('towerfall.settings.v1', JSON.stringify({ introSeen: true, sound: false })))
    await page.reload()
    await page.evaluate(() => window.__towerfall.startGame({ mapId: 'gruenental', difficulty: 'normal' }))
    await page.waitForTimeout(300)
    const cdp = await ctx.newCDPSession(page)
    const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y]) => ({ x, y })) })
    // Welt → Bildschirm (Viewport) mit der Umrechnung des Renderers
    const screenOf = (x, y) => page.evaluate(([x, y]) => { const r = window.__towerfall.renderer; const c = r.canvas.getBoundingClientRect(); const p = r.worldToCanvas(x, y); return [c.left + p.x, c.top + p.y] }, [x, y])
    const state = () => page.evaluate(() => {
      const tf = window.__towerfall, s = tf.controller.sel
      return { gold: tf.game.gold, towers: tf.game.towers.length, anchor: s.anchor, preview: s.preview && { ok: s.preview.ok, goldOk: s.preview.goldOk, c: s.preview.c, r: s.preview.r }, loupe: tf.loupe.visible, target: tf.loupe.target, placing: tf.controller.placing, time: tf.game.time }
    })
    const P = `[${d.name}]`
    await page.evaluate(() => { window.__towerfall.loop.paused = true }) // Simulation steht – nur die Darstellung läuft
    const time0 = (await state()).time

    // 1. Turm wählen, mit dem Finger ziehen (schnell, große Sprünge), Vorschau und Lupe folgen
    await page.tap('.shop-btn[data-type="cannon"]')
    const spot = await page.evaluate(() => { const p = window.__towerfall.game.findPlacementNear('cannon', 520, 420, 0, 10); return { x: p.x, y: p.y, c: p.c, r: p.r } })
    const startW = { x: 200, y: 200 }
    const s0 = await screenOf(startW.x, startW.y)
    const s1 = await screenOf(spot.x, spot.y)
    const g0 = (await state()).gold
    await touch('touchStart', [s0])
    for (let i = 1; i <= 3; i++) await touch('touchMove', [[s0[0] + (s1[0] - s0[0]) * i / 3, s0[1] + (s1[1] - s0[1]) * i / 3]])
    await page.waitForTimeout(120)
    let st = await state()
    check(`${P} Vorschau folgt dem Finger (auch bei schnellem Ziehen)`, st.preview?.c === spot.c && st.preview?.r === spot.r, JSON.stringify(st.preview))
    check(`${P} Lupe sichtbar, Mitte = Punkt unter dem Finger`, st.loupe && Math.abs(st.target.x - spot.x) < 0.75 && Math.abs(st.target.y - spot.y) < 0.75, JSON.stringify(st.target))
    // Pixelvergleich: Lupe zeigt den vergrößerten Ausschnitt des Spielfelds (ohne Hilfslinien)
    const cmp = await page.evaluate(() => new Promise((res) => {
      const tf = window.__towerfall
      tf.loupe.overlay = false
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const main = tf.renderer.canvas.getContext('2d'), lc = document.querySelector('#loupe'), lctx = lc.getContext('2d')
        const { sx, sy, zoom } = tf.loupe.last
        let diff = 0, n = 0
        for (let dy = -18; dy <= 18; dy += 6) for (let dx = -18; dx <= 18; dx += 6) {
          const lx = Math.round(lc.width / 2 + dx * zoom), ly = Math.round(lc.height / 2 + dy * zoom)
          const mx = Math.floor(sx + lx / zoom), my = Math.floor(sy + ly / zoom)
          const a = lctx.getImageData(lx, ly, 1, 1).data, b = main.getImageData(mx, my, 1, 1).data
          diff += (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2])) / 3
          n++
        }
        tf.loupe.overlay = true
        res({ mean: diff / n, n })
      }))
    }))
    check(`${P} Lupe zeigt exakt den Spielfeldausschnitt (Pixelvergleich)`, cmp.mean < 10, `mittlere Abweichung ${cmp.mean.toFixed(1)} bei ${cmp.n} Punkten`)
    await page.screenshot({ path: `${shots}loupe-${d.width}x${d.height}.png` })
    // 2. Loslassen baut nicht
    await touch('touchEnd', [])
    await page.waitForTimeout(80)
    st = await state()
    check(`${P} Loslassen baut nicht, Lupe schließt`, st.towers === 0 && st.gold === g0 && !st.loupe && st.placing, JSON.stringify({ towers: st.towers, gold: st.gold, loupe: st.loupe }))

    // 3. Ränder: an alle vier Kartenränder und darüber hinaus ziehen
    let edgesOk = true, loupeInside = true, detail = ''
    for (const [x, y] of [[4, 360], [1276, 360], [640, 4], [640, 716], [-40, 360], [1320, 360], [640, -40], [640, 760]]) {
      const [px, py] = await screenOf(x, y)
      const stage = await page.evaluate(() => { const r = document.querySelector('#stage').getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom] })
      // Fingermitte mindestens 4 px innerhalb des Spielfelds (ein Finger ist kein Punkt)
      const fx = Math.max(stage[0] + 4, Math.min(stage[2] - 4, px)), fy = Math.max(stage[1] + 4, Math.min(stage[3] - 4, py))
      await touch('touchStart', [[fx, fy]])
      await touch('touchMove', [[fx + 0.5, fy + 0.5]])
      await page.waitForTimeout(50)
      const e = await page.evaluate(() => {
        const tf = window.__towerfall, a = tf.controller.sel.anchor || { c: -99, r: -99 }, g = tf.game.grid, fp = tf.controller.footprint()
        const l = document.querySelector('#loupe').getBoundingClientRect(), s = document.querySelector('#stage').getBoundingClientRect()
        return { inGrid: a.c >= 0 && a.r >= 0 && a.c + fp.w <= g.cols && a.r + fp.h <= g.rows, loupe: [l.left, l.top, l.right, l.bottom], stage: [s.left, s.top, s.right, s.bottom], visible: tf.loupe.visible }
      })
      await touch('touchEnd', [])
      const inside = e.visible && e.loupe[0] >= e.stage[0] - 0.5 && e.loupe[1] >= e.stage[1] - 0.5 && e.loupe[2] <= e.stage[2] + 0.5 && e.loupe[3] <= e.stage[3] + 0.5
      const coversFinger = fx > e.loupe[0] && fx < e.loupe[2] && fy > e.loupe[1] && fy < e.loupe[3]
      if (!e.inGrid) { edgesOk = false; detail += ` Raster(${x},${y})` }
      if (!inside || coversFinger) { loupeInside = false; detail += ` Lupe(${x},${y}: ${JSON.stringify({ f: [Math.round(fx), Math.round(fy)], l: e.loupe.map(Math.round), s: e.stage.map(Math.round), v: e.visible })})` }
    }
    check(`${P} Vorschau bleibt an allen vier Rändern im Raster`, edgesOk, detail)
    check(`${P} Lupe passt sich den Rändern an (im Spielfeld, nicht unter dem Finger)`, loupeInside, detail)
    st = await state()
    check(`${P} Ziehen an den Rändern hat nichts gebaut`, st.towers === 0 && st.gold === g0)

    // 4. Zurück an die gültige Stelle, „Bauen“ – zweimal schnell getippt
    await touch('touchStart', [s1])
    await touch('touchMove', [[s1[0] + 0.5, s1[1] + 0.5]])
    await touch('touchEnd', [])
    await page.tap('#sheet-compact [data-act="confirm"]')
    await page.tap('#sheet-compact [data-act]').catch(() => {})
    await page.waitForTimeout(80)
    st = await state()
    const built = await page.evaluate(() => window.__towerfall.game.towers.map((t) => ({ type: t.type, c: t.c, r: t.r, level: t.level })))
    check(`${P} „Bauen“ baut genau einen Turm an der Vorschau-Position, ein Abzug`, built.length === 1 && built[0].c === spot.c && built[0].r === spot.r && built[0].level === 0 && st.gold === g0 - 120, JSON.stringify({ built, gold: st.gold }))

    // 5. Gerät drehen während des Bauens: Vorschau bleibt in Weltkoordinaten, Umrechnung passt sich an
    await page.waitForTimeout(450)
    await page.tap('.shop-btn[data-type="arrow"]')
    const sp2 = await page.evaluate(() => { const p = window.__towerfall.game.findPlacementNear('arrow', 900, 300, 0, 10); return { x: p.x, y: p.y, c: p.c, r: p.r } })
    const a2 = await screenOf(sp2.x, sp2.y)
    await touch('touchStart', [a2])
    await touch('touchMove', [[a2[0] + 0.5, a2[1]]])
    await touch('touchEnd', [])
    const rotBefore = await page.evaluate(() => window.__towerfall.renderer.rot)
    await page.setViewportSize({ width: d.height, height: d.width })
    await page.waitForTimeout(400)
    st = await state()
    const rotAfter = await page.evaluate(() => window.__towerfall.renderer.rot)
    const b2 = await screenOf(sp2.x, sp2.y)
    await touch('touchStart', [b2])
    await touch('touchMove', [[b2[0] + 0.5, b2[1] + 0.5]])
    await page.waitForTimeout(50)
    const st2 = await state()
    await touch('touchEnd', [])
    check(`${P} Drehen des Geräts: Vorschau bleibt, Ziehen trifft danach dieselbe Zelle`, rotBefore !== rotAfter && st.preview?.c === sp2.c && st.preview?.r === sp2.r && st2.preview?.c === sp2.c && st2.preview?.r === sp2.r && st2.towers === 1, JSON.stringify({ rotBefore, rotAfter, p: st.preview, p2: st2.preview }))
    await page.setViewportSize({ width: d.width, height: d.height })
    await page.waitForTimeout(300)

    // 6. Abbrechen kostet nichts
    const g5 = (await state()).gold
    await page.tap('#sheet-compact [data-act="cancel"]')
    st = await state()
    check(`${P} Abbrechen kostet nichts`, !st.placing && st.gold === g5 && st.towers === 1)
    check(`${P} Lupe und Bauen verändern die Simulation nicht (pausiert: Spielzeit unverändert)`, st.time === time0, `${time0} → ${st.time}`)

    // 7. Bottom Sheet: Griff ziehen rastet ein, Kartentipp öffnet es nicht
    const grip = await page.locator('#sheet-grip').boundingBox()
    const gx = grip.x + grip.width / 2, gy = grip.y + grip.height / 2
    await touch('touchStart', [[gx, gy]])
    for (let i = 1; i <= 6; i++) await touch('touchMove', [[gx, gy - i * 60]])
    await touch('touchEnd', [])
    await page.waitForTimeout(300)
    const snapUp = await page.evaluate(() => window.__towerfall.sheet.snap)
    const grip2 = await page.locator('#sheet-grip').boundingBox()
    const hx = grip2.x + grip2.width / 2, hy = grip2.y + grip2.height / 2
    await touch('touchStart', [[hx, hy]])
    for (let i = 1; i <= 8; i++) await touch('touchMove', [[hx, hy + i * 70]])
    await touch('touchEnd', [])
    await page.waitForTimeout(300)
    const snapDown = await page.evaluate(() => window.__towerfall.sheet.snap)
    const mid = await screenOf(640, 360)
    await page.touchscreen.tap(mid[0], mid[1])
    const snapAfterMap = await page.evaluate(() => window.__towerfall.sheet.snap)
    check(`${P} Sheet: nach oben ziehen öffnet, nach unten schließt, Kartentipp ändert nichts`, snapUp !== 'compact' && snapDown === 'compact' && snapAfterMap === 'compact', `${snapUp} → ${snapDown} → ${snapAfterMap}`)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight)
    check(`${P} Kein Überlaufen der Seite`, !overflow)
    check(`${P} Keine Konsolenfehler`, errors.length === 0, errors.join(' | '))
    await ctx.close()
  }

  // ---------- Tastatur: Pfeile bewegen die Vorschau, Lupe folgt, Enter baut, Esc bricht ab ----------
  for (const vp of [{ width: 1280, height: 800, name: 'Desktop' }, { width: 700, height: 1000, name: 'Hochformat-Fenster (gedreht)' }]) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } })
    const page = await ctx.newPage()
    await page.goto(URL_)
    await page.evaluate(() => localStorage.setItem('towerfall.settings.v1', JSON.stringify({ introSeen: true, sound: false })))
    await page.reload()
    await page.evaluate(() => window.__towerfall.startGame({ mapId: 'gruenental', difficulty: 'normal' }))
    await page.waitForTimeout(300)
    const P = `[Tastatur ${vp.name}]`
    await page.keyboard.press('1')
    await page.keyboard.press('ArrowUp')
    const s1 = await page.evaluate(() => { const tf = window.__towerfall; return { a: { ...tf.controller.sel.anchor }, loupe: tf.loupe.visible, t: tf.loupe.target, p: { x: tf.controller.sel.preview.x, y: tf.controller.sel.preview.y } } })
    await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(60)
    const s2 = await page.evaluate(() => { const tf = window.__towerfall; return { a: { ...tf.controller.sel.anchor }, t: tf.loupe.target, p: { x: tf.controller.sel.preview.x, y: tf.controller.sel.preview.y } } })
    // Bildschirmrichtung: „rechts“ bewegt die Vorschau auf dem Bildschirm nach rechts
    const moved = await page.evaluate(([a, b]) => { const r = window.__towerfall.renderer; const p = r.worldToCanvas(a.x, a.y), q = r.worldToCanvas(b.x, b.y); return { dx: q.x - p.x, dy: q.y - p.y } }, [s1.p, s2.p])
    check(`${P} Pfeiltaste bewegt die Vorschau in Bildschirmrichtung, Lupe folgt`, s1.loupe && moved.dx > 5 && Math.abs(moved.dy) < 1 && Math.abs(s2.t.x - s2.p.x) < 0.01 && Math.abs(s2.t.y - s2.p.y) < 0.01, JSON.stringify(moved))
    let n = 0
    while (n++ < 30 && !(await page.evaluate(() => window.__towerfall.controller.sel.preview?.ok))) await page.keyboard.press('ArrowRight')
    const g0 = await page.evaluate(() => window.__towerfall.game.gold)
    await page.keyboard.press('Enter')
    await page.keyboard.press('Enter') // zweites Enter: weder zweiter Bau noch Verbessern
    const r = await page.evaluate(() => ({ towers: window.__towerfall.game.towers.map((t) => t.level), gold: window.__towerfall.game.gold, loupe: window.__towerfall.loupe.visible }))
    check(`${P} Enter baut genau einmal, zweites Enter tut nichts`, r.towers.length === 1 && r.towers[0] === 0 && r.gold === g0 - 70 && !r.loupe, JSON.stringify(r))
    await page.keyboard.press('2')
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Escape')
    const r2 = await page.evaluate(() => ({ placing: window.__towerfall.controller.placing, gold: window.__towerfall.game.gold, loupe: window.__towerfall.loupe.visible }))
    check(`${P} Escape bricht kostenlos ab, Lupe schließt`, !r2.placing && r2.gold === r.gold && !r2.loupe)
    await ctx.close()
  }
} finally {
  await browser.close()
  server.kill()
}
const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} Prüfungen bestanden.`)
process.exit(failed.length ? 1 : 0)
