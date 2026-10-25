// Erzeugt die PNG-Icons aus icon.svg (einmalig nötig, Ergebnis liegt im Repository).
// Benötigt Playwright mit Chromium: node tools/icons.mjs
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')
const dir = fileURLToPath(new URL('..', import.meta.url))
const svg = await readFile(dir + 'icon.svg', 'utf8')

const browser = await chromium.launch()
const page = await browser.newPage()
async function render(size, file, maskable = false) {
  await page.setViewportSize({ width: size, height: size })
  // Maskierbares Icon: randloser Hintergrund, Motiv in der sicheren Zone (80 %)
  const inner = maskable
    ? `<div style="width:100%;height:100%;background:#151c29;display:grid;place-items:center"><div style="width:80%;height:80%">${svg}</div></div>`
    : svg
  await page.setContent(`<html><body style="margin:0;background:transparent">${inner}<style>svg{width:100%;height:100%;display:block}</style></body></html>`)
  const buf = await page.screenshot({ omitBackground: !maskable })
  await writeFile(dir + file, buf)
}
await render(192, 'icon-192.png')
await render(512, 'icon-512.png')
await render(512, 'icon-maskable-512.png', true)
await render(180, 'apple-touch-icon.png', true)
await browser.close()
console.log('Icons erzeugt.')
