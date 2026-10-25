// Balance-Tests mit einem einfachen Bot. Sie sichern ab, dass das Spiel fair, aber nicht trivial ist:
// – ohne Türme verliert man sofort,
// – nur Pfeiltürme reichen nicht (Panzerung/Bosse erzwingen Kombinationen),
// – eine gemischte Verteidigung schafft „Normal“ auf der ersten Karte.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { runBot } from './helpers/bot.js'

test('Ohne Türme ist das Spiel nach wenigen Wellen verloren', () => {
  const r = runBot({ plan: 'nothing' })
  assert.equal(r.status, 'lost')
  assert.ok(r.wave <= 3)
})

test('Nur Pfeiltürme scheitern auf Normal vor dem Ende', () => {
  const r = runBot({ plan: 'arrowsOnly' })
  assert.equal(r.status, 'lost')
  assert.ok(r.wave < 20, `Welle ${r.wave}`)
})

test('Gemischte Verteidigung gewinnt Grünental auf Normal', () => {
  const r = runBot({ plan: 'mixed' })
  assert.equal(r.status, 'won', `verloren in Welle ${r.wave}`)
  assert.ok(r.lives > 0)
})

test('Gemischte Verteidigung gewinnt auf Entspannt mit vollen Leben', () => {
  const r = runBot({ plan: 'mixed', difficulty: 'easy' })
  assert.equal(r.status, 'won')
})

test('Frühes Rufen der Wellen ist möglich und bleibt spielbar', () => {
  const r = runBot({ plan: 'mixed', difficulty: 'easy', callEarly: true })
  assert.equal(r.status, 'won', `verloren in Welle ${r.wave}`)
})

test('Alle Karten sind auf Entspannt mit gemischter Verteidigung schaffbar', async () => {
  const { MAPS } = await import('../js/config/maps.js')
  for (const m of MAPS) {
    const r = runBot({ mapId: m.id, difficulty: 'easy', plan: 'modern' })
    assert.equal(r.status, 'won', `${m.id}: verloren in Welle ${r.wave}`)
  }
})
