// Balance-Tests mit Strategie-Bots (echte Spielregeln, feste Seeds). Sie sichern die festgelegten
// Balancekriterien ab (siehe BALANCE.md):
//  K1  Keine Strategie gewinnt auf „Normal“ alle Karten ohne Lebensverlust.
//  K2  Die Ballung aller Türme an einer Stelle ist nicht automatisch die beste Strategie.
//  K3  Auf jeder Karte gewinnt auf „Normal“ mindestens eine Strategie, die nicht nur ballt.
//  K4  Kein Turmtyp macht in einer gemischten Verteidigung mehr als 45 % des Schadens.
//  K5  Auf „Entspannt“ gewinnt eine gemischte Verteidigung jede Karte.
//  K6  Ohne Türme bzw. nur mit Pfeiltürmen ist das Spiel nicht zu gewinnen.
//  K8  Die Elementtürme (Flamme, Schleim, Tesla) tragen eine gemischte Verteidigung, machen aber die
//      anderen Türme nicht überflüssig: nur mit ihnen gewinnt man auf Normal keine Karte.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { runBot } from './helpers/bot.js'
import { runStrategy } from './helpers/strategies.js'
import { MAPS } from '../js/config/maps.js'

const maps = MAPS.map((m) => m.id)
const flawless = (r) => r.status === 'won' && r.livesLost === 0

test('K6: Ohne Türme ist das Spiel nach wenigen Wellen verloren', () => {
  const r = runBot({ plan: 'nothing' })
  assert.equal(r.status, 'lost')
  assert.ok(r.wave <= 3)
})

test('K6: Nur Pfeiltürme scheitern auf Normal vor dem Ende', () => {
  const r = runBot({ plan: 'arrowsOnly' })
  assert.equal(r.status, 'lost')
  assert.ok(r.wave < 20, `Welle ${r.wave}`)
})

test('K1 + K3: Keine Strategie ist überall fehlerfrei, jede Karte ist auf Normal schaffbar', () => {
  const results = {}
  for (const strategy of ['cluster', 'control', 'single']) {
    results[strategy] = maps.map((mapId) => runStrategy({ strategy, mapId }))
  }
  for (const [strategy, rs] of Object.entries(results)) {
    assert.ok(!rs.every(flawless), `${strategy} gewinnt überall ohne Lebensverlust`)
  }
  maps.forEach((mapId, i) => {
    const winners = ['control', 'single'].filter((s) => results[s][i].status === 'won')
    assert.ok(winners.length >= 1, `${mapId}: keine Nicht-Ballungs-Strategie gewinnt`)
  })
})

test('K2: Die Ballung an einer Stelle scheitert auf mehreren Karten (Flieger umgehen sie)', () => {
  const rs = maps.map((mapId) => runStrategy({ strategy: 'cluster', mapId }))
  const failed = rs.filter((r) => r.status !== 'won').length
  assert.ok(failed >= 2, `Ballung scheitert nur auf ${failed} Karten`)
  // Ursache: durchgelassene Harpyien
  const harpyLeaks = rs.reduce((s, r) => s + (r.leakedByType.harpy || 0), 0)
  assert.ok(harpyLeaks > 0)
})

test('K4: In einer gemischten Verteidigung dominiert kein Turmtyp', () => {
  for (const mapId of ['gruenental', 'sumpfgabel']) {
    const r = runStrategy({ strategy: 'control', mapId })
    const total = Object.values(r.damageByTower).reduce((a, b) => a + b, 0)
    for (const [type, dmg] of Object.entries(r.damageByTower)) {
      assert.ok(dmg / total < 0.45, `${mapId}: ${type} macht ${Math.round((dmg / total) * 100)} % des Schadens`)
    }
  }
})

test('K5: Gemischte Verteidigung gewinnt jede Karte auf Entspannt', () => {
  for (const mapId of maps) {
    const r = runStrategy({ strategy: 'control', mapId, difficulty: 'easy' })
    assert.equal(r.status, 'won', `${mapId}: verloren in Welle ${r.wave}`)
  }
})

test('Simulationen sind reproduzierbar (gleicher Seed → gleiches Ergebnis)', () => {
  const a = runStrategy({ strategy: 'control', mapId: 'felsenpass', seed: 7 })
  const b = runStrategy({ strategy: 'control', mapId: 'felsenpass', seed: 7 })
  assert.deepEqual(a, b)
})

test('K8: Elementtürme tragen eine gemischte Verteidigung, allein reichen sie nicht', () => {
  const mixed = maps.map((mapId) => runStrategy({ strategy: 'elements', mapId }))
  assert.ok(mixed.some((r) => r.status === 'won'), 'gemischt mit Elementtürmen gewinnt mindestens eine Karte')
  assert.ok(!mixed.every(flawless), 'aber nicht überall fehlerfrei')
  for (const mapId of maps) {
    const r = runStrategy({ strategy: 'newOnly', mapId })
    assert.equal(r.status, 'lost', `${mapId}: nur Elementtürme gewinnen`)
  }
})
