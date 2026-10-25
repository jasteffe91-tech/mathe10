// Wellenverwaltung: Phasen „build“ (vor der ersten Welle, wartet auf den Spieler),
// „countdown“ (Pause zwischen Wellen) und „active“ (Gegner kommen bzw. sind auf dem Feld).
import { BALANCE } from '../config/balance.js'

export class WaveManager {
  constructor(waves) {
    this.waves = waves
    this.total = waves.length
    this.started = 0          // Anzahl gestarteter Wellen (= aktuelle Wellennummer)
    this.phase = 'build'
    this.countdown = 0
    this.spawners = []
    this.unrewarded = []      // Wellen, deren Abschlussbonus noch aussteht
    this.spawnedThisWave = 0
    this.totalThisWave = 0
  }

  get current() { return this.started }
  get spawning() { return this.spawners.length > 0 }
  get finished() { return this.started >= this.total }

  next() { return this.waves[this.started] || null }

  canCallNext() {
    if (this.finished) return false
    return this.phase !== 'active' || !this.spawning
  }

  // Startet die nächste Welle; gibt die gestartete Wellennummer zurück
  start() {
    const wave = this.waves[this.started]
    if (!wave) return 0
    this.started++
    this.phase = 'active'
    this.countdown = 0
    if (!this.spawning) { this.spawnedThisWave = 0; this.totalThisWave = 0 }
    for (const group of wave.groups) {
      this.spawners.push({ group, spawned: 0, timer: group.delay, wave: this.started })
      this.totalThisWave += group.count
    }
    this.unrewarded.push(this.started)
    return this.started
  }

  // Ein Simulationsschritt. `spawn(type, hpFactor, waveNumber)` erzeugt einen Gegner.
  update(dt, spawn) {
    if (this.phase === 'countdown') {
      this.countdown -= dt
      if (this.countdown <= 0) return 'auto-start'
      return null
    }
    if (this.phase !== 'active') return null
    for (const s of this.spawners) {
      s.timer -= dt
      // while statt if: bei sehr kurzen Abständen mehrere Gegner im selben Schritt
      while (s.timer <= 0 && s.spawned < s.group.count) {
        spawn(s.group.type, s.group.hp, s.wave, s.spawned)
        s.spawned++
        this.spawnedThisWave++
        s.timer += Math.max(s.group.interval, 0.05)
      }
    }
    if (this.spawners.some((s) => s.spawned >= s.group.count)) {
      this.spawners = this.spawners.filter((s) => s.spawned < s.group.count)
    }
    return null
  }

  // Aufruf, wenn kein Gegner mehr lebt und nichts mehr nachkommt
  clear() {
    const rewarded = this.unrewarded
    this.unrewarded = []
    if (this.finished) {
      this.phase = 'done'
    } else {
      this.phase = 'countdown'
      this.countdown = BALANCE.wavePause
    }
    return rewarded
  }
}
