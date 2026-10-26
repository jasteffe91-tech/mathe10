// Spielmessdaten für Balance-Analysen: Schaden je Turm- und Gegnertyp, Erscheinen und Durchbrüche je
// Gegnertyp, Dauer jeder Welle. Läuft immer mit (nur Zählen, keine Objekte pro Frame) und beeinflusst
// das Spielgeschehen nicht.
export class Telemetry {
  constructor() {
    this.damage = {}      // damage[towerType][enemyType] = verursachter Schaden
    this.spawned = {}     // je Gegnertyp
    this.killed = {}
    this.leaked = {}
    this.livesLost = {}
    this.waves = []       // { wave, start, end, leaked }
  }

  addDamage(towerType, enemyType, amount) {
    const row = this.damage[towerType] || (this.damage[towerType] = {})
    row[enemyType] = (row[enemyType] || 0) + amount
  }

  count(map, type, n = 1) { map[type] = (map[type] || 0) + n }

  waveStart(wave, time) { this.waves.push({ wave, start: time, end: null }) }

  waveEnd(time) {
    for (const w of this.waves) if (w.end === null) w.end = time
  }

  // Summen für Berichte
  damageByTower() {
    const out = {}
    for (const [t, row] of Object.entries(this.damage)) out[t] = Object.values(row).reduce((a, b) => a + b, 0)
    return out
  }

  damageByEnemy() {
    const out = {}
    for (const row of Object.values(this.damage)) for (const [e, v] of Object.entries(row)) out[e] = (out[e] || 0) + v
    return out
  }
}
