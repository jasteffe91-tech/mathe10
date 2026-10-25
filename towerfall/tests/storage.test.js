import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Storage, DEFAULT_SETTINGS, KEYS } from '../js/storage.js'

function memoryBackend() {
  const m = new Map()
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), map: m }
}

test('Einstellungen bleiben erhalten und werden mit Standardwerten ergänzt', () => {
  const backend = memoryBackend()
  const a = new Storage(backend)
  assert.deepEqual(a.loadSettings(), DEFAULT_SETTINGS)
  a.saveSettings({ ...a.loadSettings(), sound: false, volume: 0.1 })
  const b = new Storage(backend) // „Neustart“
  const s = b.loadSettings()
  assert.equal(s.sound, false)
  assert.equal(s.volume, 0.1)
  assert.equal(s.reducedMotion, 'auto')
})

test('Kaputte Daten führen nicht zum Absturz', () => {
  const backend = memoryBackend()
  backend.setItem(KEYS.settings, '{kaputt')
  backend.setItem(KEYS.progress, '"text"')
  const s = new Storage(backend)
  assert.deepEqual(s.loadSettings(), DEFAULT_SETTINGS)
  assert.equal(s.mapProgress('x').highestWave, 0)
})

test('Bestleistung, höchste Welle und Spielstand sind getrennt gespeichert', () => {
  const backend = memoryBackend()
  const s = new Storage(backend)
  s.noteWave('gruenental', 7)
  assert.equal(s.mapProgress('gruenental').highestWave, 7)
  const r1 = s.recordResult({ mapId: 'gruenental', difficulty: 'normal', won: false, wave: 8, score: 5000, lives: 0, kills: 100 })
  assert.equal(r1.newBest, true)
  const r2 = s.recordResult({ mapId: 'gruenental', difficulty: 'normal', won: true, wave: 20, score: 4000, lives: 5, kills: 300 })
  assert.equal(r2.newBest, false)
  const p = s.mapProgress('gruenental')
  assert.equal(p.bestScore, 5000)
  assert.equal(p.highestWave, 20)
  assert.equal(p.wins, 1)
  assert.equal(p.games, 2)
  s.writeSave({ v: 1, wave: 3 })
  assert.equal(s.loadSave().wave, 3)
  s.clearSave()
  assert.equal(s.loadSave(), null)
  assert.equal(s.mapProgress('gruenental').bestScore, 5000, 'Spielstand löschen lässt Bestleistung unberührt')
  s.resetAll()
  assert.equal(s.mapProgress('gruenental').bestScore, 0)
  assert.equal(backend.map.size, 0)
})

test('Service Worker speichert alle Spieldateien für den Offline-Betrieb', async () => {
  const root = fileURLToPath(new URL('..', import.meta.url))
  const sw = await readFile(join(root, 'sw.js'), 'utf8')
  const listed = new Set([...sw.matchAll(/'\.\/([^']*)'/g)].map((m) => m[1]))
  const walk = async (dir) => (await Promise.all((await readdir(dir, { withFileTypes: true })).map((d) => (d.isDirectory() ? walk(join(dir, d.name)) : [join(dir, d.name)])))).flat()
  const files = (await walk(join(root, 'js'))).map((f) => relative(root, f).split('\\').join('/'))
  files.push('index.html', 'css/style.css', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png')
  for (const f of files) assert.ok(listed.has(f), `${f} fehlt in sw.js`)
  // Keine externen Abhängigkeiten in HTML/CSS/JS
  const html = await readFile(join(root, 'index.html'), 'utf8')
  const css = await readFile(join(root, 'css/style.css'), 'utf8')
  assert.doesNotMatch(html + css, /https?:\/\//, 'keine externen URLs in HTML/CSS')
  for (const f of files.filter((x) => x.endsWith('.js'))) {
    const src = await readFile(join(root, f), 'utf8')
    assert.doesNotMatch(src, /(import|fetch)\s*\(?\s*['"]https?:/, `${f} lädt etwas aus dem Netz`)
  }
})
