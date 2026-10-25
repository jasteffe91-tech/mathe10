// Lokale Speicherung (localStorage). Nichts verlässt das Gerät.
// Getrennt gespeichert: Einstellungen, Fortschritt/Bestleistungen und der laufende Spielstand.
export const KEYS = {
  settings: 'towerfall.settings.v1',
  progress: 'towerfall.progress.v1',
  save: 'towerfall.save.v1',
}

export const DEFAULT_SETTINGS = {
  sound: true,
  volume: 0.35,
  reducedMotion: 'auto', // auto | on | off
  defaultSpeed: 1,
  showAllRanges: false,
  rotateMap: 'auto',     // Karte im Hochformat um 90° drehen (auto | off)
  confirmSell: true,
  autoPause: true,       // pausiert, wenn der Tab in den Hintergrund geht
  introSeen: false,
}

// Fällt auf einen Speicher im Arbeitsspeicher zurück, wenn localStorage gesperrt ist (z. B. privater Modus)
export function safeBackend() {
  try {
    const ls = globalThis.localStorage
    const k = '__towerfall_test__'
    ls.setItem(k, '1')
    ls.removeItem(k)
    return ls
  } catch {
    const mem = new Map()
    return {
      getItem: (k) => (mem.has(k) ? mem.get(k) : null),
      setItem: (k, v) => mem.set(k, String(v)),
      removeItem: (k) => mem.delete(k),
      volatile: true,
    }
  }
}

export class Storage {
  constructor(backend = safeBackend()) {
    this.backend = backend
  }

  get persistent() { return !this.backend.volatile }

  read(key, fallback) {
    try {
      const raw = this.backend.getItem(key)
      return raw ? JSON.parse(raw) : fallback
    } catch {
      return fallback
    }
  }

  write(key, value) {
    try {
      this.backend.setItem(key, JSON.stringify(value))
      return true
    } catch (err) {
      console.warn('Speichern fehlgeschlagen:', err)
      return false
    }
  }

  loadSettings() {
    const s = this.read(KEYS.settings, {})
    return { ...DEFAULT_SETTINGS, ...(s && typeof s === 'object' ? s : {}) }
  }

  saveSettings(settings) { return this.write(KEYS.settings, settings) }

  loadProgress() {
    const p = this.read(KEYS.progress, null)
    return p && typeof p === 'object' && p.maps ? p : { maps: {}, totals: { games: 0, wins: 0, kills: 0 } }
  }

  mapProgress(mapId) {
    return this.loadProgress().maps[mapId] || { highestWave: 0, bestScore: 0, wins: 0, games: 0, bestLives: 0, bestByDifficulty: {} }
  }

  // Erreichte Welle sofort merken (auch wenn die Partie noch läuft)
  noteWave(mapId, wave) {
    const p = this.loadProgress()
    const m = p.maps[mapId] || (p.maps[mapId] = this.mapProgress(mapId))
    if (wave > m.highestWave) {
      m.highestWave = wave
      this.write(KEYS.progress, p)
    }
  }

  // Ergebnis einer beendeten Partie eintragen; meldet, ob es eine neue Bestleistung ist
  recordResult({ mapId, difficulty, won, wave, score, lives, kills }) {
    const p = this.loadProgress()
    const m = p.maps[mapId] || (p.maps[mapId] = this.mapProgress(mapId))
    m.games++
    p.totals.games++
    p.totals.kills += kills
    if (won) { m.wins++; p.totals.wins++; m.bestLives = Math.max(m.bestLives, lives) }
    m.highestWave = Math.max(m.highestWave, wave)
    const newBest = score > m.bestScore
    if (newBest) m.bestScore = score
    m.bestByDifficulty ||= {}
    const prev = m.bestByDifficulty[difficulty] || { score: 0, won: false }
    m.bestByDifficulty[difficulty] = { score: Math.max(prev.score, score), won: prev.won || won }
    this.write(KEYS.progress, p)
    return { newBest, progress: m }
  }

  loadSave() { return this.read(KEYS.save, null) }
  writeSave(snapshot) { return this.write(KEYS.save, snapshot) }
  clearSave() { try { this.backend.removeItem(KEYS.save) } catch { /* egal */ } }

  resetAll() {
    for (const k of Object.values(KEYS)) {
      try { this.backend.removeItem(k) } catch { /* egal */ }
    }
  }
}
