// Browser-Test der Eingabe-Robustheit (Playwright/Chromium mit Touch-Emulation – kein echtes iPhone):
// keine Textauswahl auf der Spieloberfläche, Wiederherstellung einer hängenden Auswahl, Long-Press,
// abgebrochene Gesten, Fokusverlust, Wechsel Touch ↔ Tastatur, Pfeiltasten zum Versetzen.
// Aufruf: node tests/browser/robustness.mjs
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')
const root = fileURLToPath(new URL('../..', import.meta.url))
const PORT = 8768
const URL_ = `http://localhost:${PORT}/`
const server = spawn(process.execPath, ['tools/serve.mjs', String(PORT)], { cwd: root, stdio: 'pipe' })
await new Promise((r) => server.stdout.once('data', r))

const results = []
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` – ${detail}` : ''}`) }

async function open(browser, opts) {
  const ctx = await browser.newContext(opts)
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  await page.goto(URL_)
  await page.evaluate(() => localStorage.setItem('towerfall.settings.v1', JSON.stringify({ introSeen: true, sound: false })))
  await page.reload()
  await page.evaluate(() => window.__towerfall.startGame({ mapId: 'gruenental', difficulty: 'normal' }))
  await page.waitForTimeout(300)
  await page.evaluate(() => { window.__towerfall.loop.paused = true })
  return { ctx, page, errors }
}

const selection = (page) => page.evaluate(() => getSelection().toString())

const browser = await chromium.launch()
try {
  // ---------- Smartphone: Textauswahl und Gesten ----------
  {
    const { ctx, page, errors } = await open(browser, { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true })
    const cdp = await ctx.newCDPSession(page)
    const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y]) => ({ x, y })) })
    const P = '[Smartphone]'

    const styles = await page.evaluate(() => ['#hud-gold', '.shop-btn .shop-name', '#sheet-compact', '#canvas', '#toasts'].map((s) => {
      const cs = getComputedStyle(document.querySelector(s))
      return [s, cs.userSelect || cs.webkitUserSelect, cs.webkitTouchCallout]
    }))
    check(`${P} Spieloberfläche nicht markierbar (user-select: none, auch -webkit-)`, styles.every(([, u]) => u === 'none'), JSON.stringify(styles))

    // Doppelklick (markiert sonst ein Wort) und Long-Press-Gesten auf Text, Kacheln und Karte
    const gold = await page.locator('#hud-gold').boundingBox()
    await page.mouse.dblclick(gold.x + 4, gold.y + gold.height / 2)
    const s1 = await selection(page)
    for (const sel of ['.shop-btn[data-type="cannon"] .shop-name', '#sheet-compact', '#canvas']) {
      const b = await page.locator(sel).first().boundingBox()
      await cdp.send('Input.synthesizeTapGesture', { x: b.x + Math.min(30, b.width / 2), y: b.y + Math.min(20, b.height / 2), duration: 1200, tapCount: 1, gestureSourceType: 'touch' })
    }
    const s2 = await selection(page)
    check(`${P} Doppelklick und langes Drücken markieren nichts`, s1 === '' && s2 === '', JSON.stringify([s1, s2]))

    // Wiederherstellung: eine (z. B. vom System) erzeugte Auswahl verschwindet sofort bzw. beim nächsten Tippen
    await page.evaluate(() => getSelection().selectAllChildren(document.querySelector('#screen-game')))
    await page.waitForTimeout(50)
    const s3 = await selection(page)
    check(`${P} Hängende Auswahl wird automatisch aufgehoben`, s3 === '', s3.slice(0, 40))

    // Kontextmenü (Long-Press auf Android) ist im Spiel unterdrückt, in Eingabefeldern nicht
    const ctxMenu = await page.evaluate(() => {
      const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
      document.querySelector('#hud-gold').dispatchEvent(ev)
      return ev.defaultPrevented
    })
    check(`${P} Kontextmenü auf der Spieloberfläche unterdrückt`, ctxMenu)

    // Turm wählen, langes Halten auf der Karte, dann ziehen: kein Abbruch des Baumodus, keine Auswahl
    await page.tap('.shop-btn[data-type="arrow"]')
    const c = await page.locator('#canvas').boundingBox()
    const cx = c.x + c.width * 0.5, cy = c.y + c.height * 0.45
    await touch('touchStart', [[cx, cy]])
    await page.waitForTimeout(900)
    for (let i = 1; i <= 8; i++) await touch('touchMove', [[cx - i * 6, cy - i * 4]])
    const mid = await page.evaluate(() => ({ placing: window.__towerfall.controller.placing, loupe: window.__towerfall.loupe.visible }))
    await touch('touchEnd', [])
    const s4 = await selection(page)
    const after = await page.evaluate(() => ({ placing: window.__towerfall.controller.placing, loupe: window.__towerfall.loupe.visible, towers: window.__towerfall.game.towers.length }))
    check(`${P} Langes Halten + Ziehen: Baumodus bleibt, Lupe schließt beim Loslassen, nichts markiert`, mid.placing && mid.loupe && after.placing && !after.loupe && after.towers === 0 && s4 === '', JSON.stringify({ mid, after, s4 }))

    // Abgebrochene Geste (touchcancel) und Fokusverlust mitten im Ziehen: Lupe und Zustand werden zurückgesetzt
    await touch('touchStart', [[cx, cy]])
    await touch('touchMove', [[cx + 10, cy + 10]])
    await touch('touchCancel', [])
    const cancel = await page.evaluate(() => window.__towerfall.loupe.visible)
    await touch('touchStart', [[cx, cy]])
    await touch('touchMove', [[cx + 12, cy + 8]])
    await page.evaluate(() => window.dispatchEvent(new Event('blur')))
    const blurred = await page.evaluate(() => window.__towerfall.loupe.visible)
    await touch('touchEnd', [])
    // danach funktioniert alles normal weiter
    await touch('touchStart', [[cx - 20, cy]])
    await touch('touchMove', [[cx - 21, cy + 1]])
    const again = await page.evaluate(() => window.__towerfall.loupe.visible)
    await touch('touchEnd', [])
    check(`${P} Abbruch (touchcancel) und Fokusverlust setzen Geste/Lupe zurück, danach normal bedienbar`, !cancel && !blurred && again, JSON.stringify({ cancel, blurred, again }))

    // Schnelles Tippen im Wechsel zwischen Turmleiste und Karte
    for (let i = 0; i < 12; i++) {
      await page.tap(`.shop-btn[data-type="${['arrow', 'cannon', 'frost'][i % 3]}"]`)
      await page.touchscreen.tap(cx + (i % 4) * 7, cy + (i % 3) * 9)
    }
    const fast = await page.evaluate(() => ({ sel: getSelection().toString(), towers: window.__towerfall.game.towers.length, gold: window.__towerfall.game.gold }))
    check(`${P} Schnelles Tippen Turmleiste ↔ Karte: keine Auswahl, kein ungewollter Bau`, fast.sel === '' && fast.towers === 0, JSON.stringify(fast))
    check(`${P} Keine Konsolenfehler`, errors.length === 0, errors.join(' | '))
    await ctx.close()
  }

  // ---------- Tastatur: Pfeiltasten versetzen den ausgewählten Turm ----------
  {
    const { ctx, page, errors } = await open(browser, { viewport: { width: 1280, height: 800 } })
    const P = '[Tastatur]'
    const st = () => page.evaluate(() => { const tf = window.__towerfall, s = tf.controller.sel; return { placing: tf.controller.placing, moving: !!s.moving, anchor: s.anchor && { ...s.anchor }, tower: s.tower && { c: s.tower.c, r: s.tower.r }, gold: tf.game.gold, scroll: [scrollX, scrollY, document.scrollingElement.scrollTop], loupe: tf.loupe.visible } })
    // ohne Auswahl: Pfeile tun nichts (und scrollen nicht)
    for (const k of ['ArrowDown', 'ArrowRight', 'ArrowUp']) await page.keyboard.press(k)
    let s = await st()
    check(`${P} Pfeiltasten ohne ausgewählten Turm: keine Wirkung, kein Scrollen`, !s.placing && s.scroll.every((v) => v === 0), JSON.stringify(s))
    // Turm bauen (Taste 1 = Pfeilturm) und dann mit Pfeiltasten versetzen
    const spot = await page.evaluate(() => { const g = window.__towerfall.game; const p = g.findPlacementNear('arrow', 400, 260, 0, 10); return { c: p.c, r: p.r } })
    await page.keyboard.press('1')
    await page.evaluate((sp) => { const c = window.__towerfall.controller; c.sel.anchor = sp; c.updatePreview() }, spot)
    await page.keyboard.press('Enter')
    await page.waitForTimeout(450)
    s = await st()
    const g0 = s.gold
    // freie Richtung suchen und zwei Schritte gehen
    const dir = await page.evaluate((sp) => { const g = window.__towerfall.game, t = g.towers[0]; const d = [['ArrowRight', 1, 0], ['ArrowLeft', -1, 0], ['ArrowDown', 0, 1], ['ArrowUp', 0, -1]].find(([, dx, dy]) => g.canMove(t, sp.c + 2 * dx, sp.r + 2 * dy).ok); return d }, spot)
    await page.keyboard.press(dir[0])
    const s1 = await st()
    await page.keyboard.press(dir[0])
    const s2 = await st()
    check(`${P} Pfeil bei ausgewähltem Turm: Versetzen mit Vorschau, Lupe folgt, Turm bleibt bis zur Bestätigung stehen`, s1.moving && s1.loupe && s2.anchor.c === spot.c + 2 * dir[1] && s2.anchor.r === spot.r + 2 * dir[2] && s2.tower.c === spot.c && s2.tower.r === spot.r, JSON.stringify({ s1, s2 }))
    await page.keyboard.press('Enter')
    const s3 = await st()
    check(`${P} Enter bestätigt: Turm versetzt, Gebühr genau einmal`, !s3.placing && s3.tower.c === spot.c + 2 * dir[1] && s3.tower.r === spot.r + 2 * dir[2] && s3.gold < g0, JSON.stringify(s3))
    await page.waitForTimeout(450)
    // Escape bricht kostenlos ab
    await page.keyboard.press(dir[0])
    await page.keyboard.press('Escape')
    const s4 = await st()
    check(`${P} Esc bricht das Versetzen kostenlos ab`, !s4.placing && s4.gold === s3.gold && s4.tower.c === s3.tower.c && !s4.loupe, JSON.stringify(s4))
    // Pfeiltasten in einem Eingabefeld (Lautstärkeregler in den Einstellungen) steuern das Feld, nicht das Spiel
    await page.click('#btn-menu')
    await page.click('.modal-actions .btn:has-text("Einstellungen")')
    const range = page.locator('input[name="volume"]')
    await range.focus()
    const v0 = await range.inputValue()
    await page.keyboard.press('ArrowRight')
    const v1 = await range.inputValue()
    const s5 = await st()
    check(`${P} Pfeiltasten im Eingabefeld bewegen das Feld, nicht den Turm`, v1 !== v0 && !s5.placing, `${v0} → ${v1}`)
    await page.keyboard.press('Escape')
    await page.keyboard.press('Escape')
    // Wechsel Touch → Tastatur: Fokusverlust und Rückkehr ändern nichts am Zustand
    await page.evaluate(() => { window.dispatchEvent(new Event('blur')); window.dispatchEvent(new Event('focus')) })
    await page.keyboard.press(dir[0])
    const s6 = await st()
    check(`${P} Nach Fokusverlust/-rückkehr funktionieren die Pfeiltasten weiter`, s6.moving, JSON.stringify(s6))
    // 12 Turmtasten
    const picked = []
    for (const code of ['Digit1', 'Digit9', 'Digit0', 'Minus', 'Equal']) {
      await page.keyboard.press('Escape')
      await page.evaluate((code) => document.dispatchEvent(new KeyboardEvent('keydown', { code, key: '?', bubbles: true })), code)
      picked.push(await page.evaluate(() => window.__towerfall.controller.sel.type))
    }
    check(`${P} Tasten 1–9, 0 und die zwei Tasten daneben wählen alle 12 Türme`, JSON.stringify(picked) === JSON.stringify(['arrow', 'trebuchet', 'flame', 'slime', 'tesla']), JSON.stringify(picked))
    check(`${P} Keine Konsolenfehler`, errors.length === 0, errors.join(' | '))
    await ctx.close()
  }
} finally {
  await browser.close()
  server.kill()
}
const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} Prüfungen bestanden.`)
process.exit(failed.length ? 1 : 0)
