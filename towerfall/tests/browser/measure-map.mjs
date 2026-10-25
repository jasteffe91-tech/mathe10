// Misst, wie viel Fläche die Karte auf typischen iPhone-Viewports tatsächlich einnimmt
// (Browser-Simulation mit Playwright, kein echtes Gerät). Aufruf: node tests/browser/measure-map.mjs [url]
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { chromium } = require('playwright')
const url = process.argv[2] || 'http://localhost:8766/'
const devices = [
  { name: 'iPhone SE hoch', width: 375, height: 667, dpr: 2 },
  { name: 'iPhone 14 hoch', width: 390, height: 844, dpr: 3 },
  { name: 'iPhone 14 Pro Max hoch', width: 430, height: 932, dpr: 3 },
  { name: 'iPhone 14 quer', width: 844, height: 390, dpr: 3 },
  { name: 'iPhone SE quer', width: 667, height: 375, dpr: 2 },
]
const browser = await chromium.launch()
const rows = []
for (const d of devices) {
  const page = await browser.newPage({ viewport: { width: d.width, height: d.height }, deviceScaleFactor: d.dpr, hasTouch: true, isMobile: true })
  await page.goto(url)
  await page.evaluate(() => localStorage.setItem('towerfall.settings.v1', JSON.stringify({ introSeen: true, sound: false })))
  await page.reload()
  await page.evaluate(() => window.__towerfall.startGame({ mapId: 'gruenental', difficulty: 'normal' }))
  await page.waitForTimeout(400)
  const m = await page.evaluate(() => {
    const r = window.__towerfall.renderer?.mapRect?.() || null
    if (r) return r
    // Fallback (alte Version): Letterbox aus Canvas-Größe berechnen
    const c = document.querySelector('#canvas').getBoundingClientRect()
    const s = Math.min(c.width / 1280, c.height / 720)
    return { width: 1280 * s, height: 720 * s }
  })
  const area = Math.round(m.width * m.height)
  rows.push({ device: d.name, map: `${Math.round(m.width)}×${Math.round(m.height)}`, area, share: Math.round((area / (d.width * d.height)) * 100) })
  await page.close()
}
await browser.close()
console.table(rows)
console.log(JSON.stringify(rows))
