// Browser-Test mit Playwright (Chromium): startet den lokalen Server, spielt im echten Browser,
// prüft Konsole, Bauen per Maus und Touch, Einstellungen nach Neustart und den Offline-Start.
// Aufruf: node tests/browser/check.mjs   (Playwright muss installiert sein: npm i -D playwright)
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { mkdir } from 'node:fs/promises'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')
const root = fileURLToPath(new URL('../..', import.meta.url))
const shots = process.env.SHOTS || fileURLToPath(new URL('../../.shots/', import.meta.url))
await mkdir(shots, { recursive: true })
const PORT = 8765
const URL_ = `http://localhost:${PORT}/`

const server = spawn(process.execPath, ['tools/serve.mjs', String(PORT)], { cwd: root, stdio: 'pipe' })
await new Promise((r) => server.stdout.once('data', r))

const results = []
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` – ${detail}` : ''}`) }

const browser = await chromium.launch()
try {
  // ---------- Desktop ----------
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 800 } })
  const page = await ctx.newPage()
  const errors = []
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(URL_)
  await page.waitForSelector('#screen-menu:not([hidden])')
  check('Startbildschirm erscheint', true)
  await page.waitForFunction(() => document.querySelector('#offline-status').textContent.includes('Offline spielbar'), null, { timeout: 15000 }).then(() => check('Service Worker aktiv („Offline spielbar“)', true)).catch(() => check('Service Worker aktiv', false))
  await page.screenshot({ path: shots + 'menu.png' })

  await page.click('#btn-play')
  await page.waitForSelector('#screen-maps:not([hidden])')
  await page.screenshot({ path: shots + 'maps.png' })
  await page.click('#btn-start')
  await page.waitForSelector('#screen-game:not([hidden])')
  // Einführung beim ersten Start
  const intro = await page.locator('.modal h2').textContent().catch(() => '')
  check('Einführung beim ersten Spiel', intro.includes('Willkommen'))
  await page.screenshot({ path: shots + 'intro.png' })
  await page.click('.modal-actions .btn.primary')

  // Karte gerendert? (Canvas nicht einfarbig)
  const varied = await page.evaluate(() => {
    const c = document.querySelector('#canvas')
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data
    const seen = new Set()
    for (let i = 0; i < d.length; i += 4 * 997) seen.add(`${d[i] >> 4},${d[i + 1] >> 4},${d[i + 2] >> 4}`)
    return seen.size
  })
  check('Karte wird gerendert', varied > 20, `${varied} Farbtöne`)

  // Bauen per Mausklick: Bauplatz anklicken, Pfeilturm wählen, nochmal wählen = bauen
  const clickWorld = async (x, y) => {
    const box = await page.locator('#canvas').boundingBox()
    const s = Math.min(box.width / 1280, box.height / 720)
    const ox = (box.width - 1280 * s) / 2, oy = (box.height - 720 * s) / 2
    await page.mouse.click(box.x + ox + x * s, box.y + oy + y * s)
  }
  const spot = await page.evaluate(() => { const s = window.__towerfall.game.spots[4]; return { x: s.x, y: s.y } })
  const gold0 = await page.evaluate(() => window.__towerfall.game.gold)
  await clickWorld(spot.x, spot.y)
  await page.click('.shop-btn[data-type="arrow"]')
  await page.waitForTimeout(200)
  await page.screenshot({ path: shots + 'build-preview.png' })
  await page.click('[data-act="build"]')
  const after = await page.evaluate(() => ({ gold: window.__towerfall.game.gold, towers: window.__towerfall.game.towers.length }))
  check('Turm per Maus gebaut', after.towers === 1 && after.gold === gold0 - 70, JSON.stringify(after))

  // Zu wenig Gold: Ablehnung mit Begründung
  await page.evaluate(() => { window.__towerfall.game.wallet.gold = 20 })
  const spot2 = await page.evaluate(() => { const s = window.__towerfall.game.spots[2]; return { x: s.x, y: s.y } })
  await clickWorld(spot2.x, spot2.y)
  await page.click('.shop-btn[data-type="sniper"]')
  await page.waitForTimeout(250)
  const reason = await page.locator('#info .reason').textContent()
  await page.click('[data-act="build"]', { force: true }) // bewusst klickbar trotz aria-disabled: zeigt die Begründung
  const toastText = await page.locator('.toast-error').last().textContent().catch(() => '')
  const towers2 = await page.evaluate(() => window.__towerfall.game.towers.length)
  check('Zu wenig Gold verhindert Bau mit Begründung', towers2 === 1 && /fehlen/.test(reason) && /fehlen/.test(toastText), reason)
  await page.evaluate(() => { window.__towerfall.game.wallet.gold = 2000 })
  await page.keyboard.press('Escape')

  // Tastatur: 2 = Kanone, Pfeiltaste wählt Bauplatz, Enter baut
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('2')
  await page.waitForTimeout(150)
  await page.keyboard.press('Enter')
  const towers3 = await page.evaluate(() => window.__towerfall.game.towers.length)
  check('Bauen per Tastatur', towers3 === 2)

  // Welle starten, Tempo, Pause
  await page.click('#btn-next')
  await page.click('#btn-speed')
  await page.click('#btn-speed')
  const speed = await page.evaluate(() => window.__towerfall.loop.speed)
  check('Spielgeschwindigkeit umschaltbar', speed === 3)
  await page.waitForTimeout(2500)
  await page.screenshot({ path: shots + 'wave.png' })
  await page.keyboard.press('Space')
  const t1 = await page.evaluate(() => window.__towerfall.game.time)
  await page.waitForTimeout(800)
  const t2 = await page.evaluate(() => window.__towerfall.game.time)
  check('Pause hält das Spiel an', t1 === t2 && t1 > 0)
  await page.keyboard.press('Space')
  await page.waitForTimeout(400)
  const t3 = await page.evaluate(() => window.__towerfall.game.time)
  check('Fortsetzen läuft weiter', t3 > t2)

  // Turm auswählen, verbessern, verkaufen
  await clickWorld(spot.x, spot.y)
  await page.waitForTimeout(200)
  await page.screenshot({ path: shots + 'tower-selected.png' })
  await page.click('[data-act="upgrade"]')
  const lvl = await page.evaluate(() => window.__towerfall.game.towers.find((t) => t.spot === 4).level)
  check('Verbessern per Klick', lvl === 1)
  const g1 = await page.evaluate(() => window.__towerfall.game.gold)
  await page.click('[data-act="sell"]')
  await page.waitForTimeout(150)
  await page.click('[data-act="sell"]') // Bestätigung
  const sold = await page.evaluate(() => ({ gold: window.__towerfall.game.gold, has: window.__towerfall.game.towers.some((t) => t.spot === 4) }))
  check('Verkauf mit Bestätigung erstattet 70 %', !sold.has && sold.gold - g1 >= Math.floor((70 + 65) * 0.7), `+${sold.gold - g1}`)

  // Einstellungen: Sound aus → Neuladen → bleibt aus
  await page.click('#btn-menu')
  await page.click('.modal-actions .btn:has-text("Einstellungen")')
  await page.uncheck('input[name="sound"]')
  await page.selectOption('select[name="reducedMotion"]', 'on')
  await page.reload()
  await page.waitForSelector('#screen-menu:not([hidden])')
  const s = await page.evaluate(() => JSON.parse(localStorage.getItem('towerfall.settings.v1')))
  check('Einstellungen bleiben nach Neustart erhalten', s.sound === false && s.reducedMotion === 'on' && s.introSeen === true)
  const cont = await page.locator('#btn-continue').isVisible()
  check('Spielstand kann fortgesetzt werden', cont)

  // Offline: Netz kappen, neu laden, Spiel starten
  await ctx.setOffline(true)
  await page.reload()
  await page.waitForSelector('#screen-menu:not([hidden])', { timeout: 8000 }).then(() => check('Start ohne Internet', true)).catch(() => check('Start ohne Internet', false))
  await page.click('#btn-continue').catch(() => {})
  await page.waitForTimeout(1500)
  const offlineOk = await page.evaluate(() => !!window.__towerfall?.game && window.__towerfall.game.towers.length >= 1)
  check('Spiel offline spielbar (Spielstand geladen)', offlineOk)
  await page.evaluate(() => window.__towerfall.game.callNextWave())
  await page.waitForTimeout(1500)
  const offlineRunning = await page.evaluate(() => window.__towerfall.game.time > 0.5)
  check('Simulation läuft offline', offlineRunning)
  await ctx.setOffline(false)
  check('Keine Fehler in der Konsole (Desktop)', errors.length === 0, errors.join(' | '))
  await ctx.close()

  // ---------- Smartphone (Touch, Hochformat) ----------
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true })
  const mp = await phone.newPage()
  const errs2 = []
  mp.on('pageerror', (e) => errs2.push(String(e)))
  mp.on('console', (m) => { if (m.type() === 'error') errs2.push(m.text()) })
  await mp.goto(URL_)
  await mp.tap('#btn-play')
  await mp.tap('#btn-start')
  await mp.tap('.modal-actions .btn.primary')
  const tapWorld = async (x, y) => {
    const box = await mp.locator('#canvas').boundingBox()
    const sc = Math.min(box.width / 1280, box.height / 720)
    const ox = (box.width - 1280 * sc) / 2, oy = (box.height - 720 * sc) / 2
    await mp.touchscreen.tap(box.x + ox + x * sc, box.y + oy + y * sc)
  }
  const sp = await mp.evaluate(() => { const s = window.__towerfall.game.spots[0]; return { x: s.x, y: s.y } })
  await tapWorld(sp.x, sp.y)
  await mp.tap('.shop-btn[data-type="frost"]')
  await mp.tap('.shop-btn[data-type="frost"]') // zweiter Tipp baut
  const mt = await mp.evaluate(() => window.__towerfall.game.towers.map((t) => t.type))
  check('Bauen per Touch', mt.length === 1 && mt[0] === 'frost', JSON.stringify(mt))
  const overflow = await mp.evaluate(() => document.documentElement.scrollWidth > innerWidth)
  check('Kein horizontales Überlaufen auf dem Smartphone', !overflow)
  const hudVisible = await mp.evaluate(() => ['#hud-lives', '#hud-gold', '#hud-wave', '#btn-next', '#btn-pause'].every((s) => { const r = document.querySelector(s).getBoundingClientRect(); return r.width > 0 && r.right <= innerWidth + 1 && r.top >= 0 }))
  check('HUD vollständig sichtbar (Hochformat)', hudVisible)
  const shopOk = await mp.evaluate(() => [...document.querySelectorAll('.shop-btn')].every((b) => { const r = b.getBoundingClientRect(); return r.width >= 40 && r.right <= innerWidth + 1 && r.left >= 0 }))
  check('Alle Türme im Baumenü sichtbar (Hochformat)', shopOk)
  await mp.tap('#btn-next')
  await mp.waitForTimeout(2000)
  await mp.screenshot({ path: shots + 'phone-portrait.png' })
  await mp.setViewportSize({ width: 844, height: 390 })
  await mp.waitForTimeout(500)
  await mp.screenshot({ path: shots + 'phone-landscape.png' })
  const landscapeOk = await mp.evaluate(() => ['#hud-lives', '#hud-gold', '#btn-next', '#shop'].every((s) => { const r = document.querySelector(s).getBoundingClientRect(); return r.width > 0 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1 }))
  check('HUD und Baumenü sichtbar (Querformat)', landscapeOk)
  const shopLand = await mp.evaluate(() => [...document.querySelectorAll('.shop-btn')].every((b) => { const r = b.getBoundingClientRect(); return r.width >= 34 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1 }))
  check('Alle Türme im Baumenü sichtbar (Querformat)', shopLand)
  check('Keine Fehler in der Konsole (Smartphone)', errs2.length === 0, errs2.join(' | '))
  await phone.close()

  // ---------- Tablet ----------
  const tab = await browser.newContext({ viewport: { width: 820, height: 1180 }, hasTouch: true })
  const tp = await tab.newPage()
  await tp.goto(URL_)
  await tp.click('#btn-play')
  await tp.click('#btn-start')
  await tp.click('.modal-actions .btn.primary')
  await tp.waitForTimeout(400)
  await tp.screenshot({ path: shots + 'tablet.png' })
  // Niederlage: Leben auf 0 → Endbildschirm, Neustart ohne Neuladen
  await tp.evaluate(() => { const g = window.__towerfall.game; g.callNextWave(); g.lives = 0 })
  await tp.waitForSelector('.modal.result', { timeout: 5000 }).catch(() => {})
  const title = await tp.locator('.modal h2').textContent().catch(() => '')
  await tp.screenshot({ path: shots + 'defeat.png' })
  check('Niederlage wird erkannt und angezeigt', /gefallen/.test(title), title)
  await tp.click('.modal-actions .btn.primary')
  const fresh = await tp.evaluate(() => ({ wave: window.__towerfall.game.wave, lives: window.__towerfall.game.lives, status: window.__towerfall.game.status }))
  check('Neustart ohne Neuladen', fresh.wave === 0 && fresh.lives === 20 && fresh.status === 'playing', JSON.stringify(fresh))
  const best = await tp.evaluate(() => JSON.parse(localStorage.getItem('towerfall.progress.v1')).maps.gruenental.games)
  check('Ergebnis lokal gespeichert', best === 1)
  await tab.close()
} finally {
  await browser.close()
  server.kill()
}
const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} Prüfungen bestanden. Screenshots: ${shots}`)
process.exit(failed.length ? 1 : 0)
