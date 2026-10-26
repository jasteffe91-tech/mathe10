// Soundeffekte, vollständig mit der Web Audio API erzeugt – keine Audiodateien, kein Netz.
// Der AudioContext entsteht erst nach der ersten Nutzeraktion (Vorgabe der Browser).

const THROTTLE = { arrow: 0.06, cannon: 0.08, frost: 0.08, zap: 0.08, sniper: 0.05, poison: 0.08, hit: 0.05, death: 0.04, coin: 0.05 }

export class Sfx {
  constructor() {
    this.enabled = true
    this.volume = 0.35
    this.ctx = null
    this.master = null
    this.noise = null
    this.lastPlayed = {}
    this.voices = 0
  }

  unlock() {
    if (this.ctx || typeof window === 'undefined') return
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return
    try {
      this.ctx = new AC()
      this.master = this.ctx.createGain()
      this.master.gain.value = this.volume
      this.master.connect(this.ctx.destination)
      // Rauschpuffer für Explosionen
      const len = this.ctx.sampleRate * 0.6
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate)
      const d = this.noise.getChannelData(0)
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
    } catch (err) {
      console.warn('Audio nicht verfügbar:', err)
      this.ctx = null
    }
  }

  setEnabled(on) { this.enabled = on }

  setVolume(v) {
    this.volume = v
    if (this.master) this.master.gain.value = v
  }

  // Sound abspielen; gleiche Sounds kurz hintereinander werden zusammengefasst
  play(name) {
    if (!this.enabled || !this.ctx || this.volume <= 0) return
    if (this.ctx.state === 'suspended') this.ctx.resume()
    const now = this.ctx.currentTime
    const gap = THROTTLE[name] ?? 0.03
    if (this.lastPlayed[name] && now - this.lastPlayed[name] < gap) return
    if (this.voices > 14) return
    this.lastPlayed[name] = now
    const fn = this[`s_${name}`]
    if (fn) fn.call(this, now)
  }

  tone(t, { type = 'sine', from = 440, to = from, dur = 0.15, gain = 0.3, attack = 0.005 }) {
    const o = this.ctx.createOscillator()
    const g = this.ctx.createGain()
    o.type = type
    o.frequency.setValueAtTime(from, t)
    o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(gain, t + attack)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.connect(g).connect(this.master)
    o.start(t)
    o.stop(t + dur + 0.02)
    this.voices++
    o.onended = () => { this.voices-- }
  }

  noiseBurst(t, { dur = 0.3, gain = 0.4, freq = 800, q = 0.8, type = 'lowpass' }) {
    const src = this.ctx.createBufferSource()
    src.buffer = this.noise
    const f = this.ctx.createBiquadFilter()
    f.type = type
    f.frequency.setValueAtTime(freq, t)
    f.frequency.exponentialRampToValueAtTime(Math.max(60, freq * 0.25), t + dur)
    f.Q.value = q
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(gain, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    src.connect(f).connect(g).connect(this.master)
    src.start(t)
    src.stop(t + dur + 0.02)
    this.voices++
    src.onended = () => { this.voices-- }
  }

  s_arrow(t) { this.noiseBurst(t, { dur: 0.06, gain: 0.12, freq: 3200, type: 'bandpass', q: 2 }) }
  s_cannon(t) { this.tone(t, { type: 'sine', from: 140, to: 50, dur: 0.25, gain: 0.35 }); this.noiseBurst(t, { dur: 0.2, gain: 0.18, freq: 900 }) }
  s_boom(t) { this.noiseBurst(t, { dur: 0.45, gain: 0.32, freq: 1200 }); this.tone(t, { from: 90, to: 40, dur: 0.35, gain: 0.25 }) }
  s_frost(t) { this.tone(t, { type: 'triangle', from: 1400, to: 2200, dur: 0.12, gain: 0.08 }) }
  s_zap(t) { this.tone(t, { type: 'sawtooth', from: 900, to: 180, dur: 0.14, gain: 0.08 }); this.noiseBurst(t, { dur: 0.1, gain: 0.08, freq: 5000, type: 'highpass' }) }
  s_sniper(t) { this.noiseBurst(t, { dur: 0.15, gain: 0.25, freq: 2500 }); this.tone(t, { type: 'square', from: 600, to: 120, dur: 0.08, gain: 0.06 }) }
  s_poison(t) { this.tone(t, { type: 'sine', from: 260, to: 520, dur: 0.12, gain: 0.12 }) }
  s_splat(t) { this.noiseBurst(t, { dur: 0.18, gain: 0.12, freq: 600 }) }
  s_death(t) { this.tone(t, { type: 'triangle', from: 520, to: 200, dur: 0.12, gain: 0.07 }) }
  s_coin(t) { this.tone(t, { type: 'square', from: 1320, to: 1320, dur: 0.06, gain: 0.04 }); this.tone(t + 0.05, { type: 'square', from: 1760, to: 1760, dur: 0.09, gain: 0.04 }) }
  s_leak(t) { this.tone(t, { type: 'sine', from: 180, to: 70, dur: 0.4, gain: 0.35 }) }
  s_build(t) { this.noiseBurst(t, { dur: 0.12, gain: 0.15, freq: 500 }); this.tone(t + 0.04, { type: 'triangle', from: 300, to: 420, dur: 0.12, gain: 0.12 }) }
  s_upgrade(t) { [523, 659, 784].forEach((f, i) => this.tone(t + i * 0.07, { type: 'triangle', from: f, dur: 0.16, gain: 0.12 })) }
  s_sell(t) { this.tone(t, { type: 'triangle', from: 660, to: 330, dur: 0.18, gain: 0.1 }) }
  s_wave(t) { this.tone(t, { type: 'sawtooth', from: 196, to: 196, dur: 0.5, gain: 0.08, attack: 0.08 }); this.tone(t + 0.25, { type: 'sawtooth', from: 262, to: 262, dur: 0.6, gain: 0.08, attack: 0.08 }) }
  s_boss(t) { this.tone(t, { type: 'sawtooth', from: 110, to: 82, dur: 1.0, gain: 0.14, attack: 0.1 }); this.tone(t, { type: 'square', from: 55, to: 41, dur: 1.0, gain: 0.08, attack: 0.1 }) }
  s_click(t) { this.tone(t, { type: 'sine', from: 880, to: 660, dur: 0.05, gain: 0.06 }) }
  s_error(t) { this.tone(t, { type: 'square', from: 220, to: 180, dur: 0.15, gain: 0.06 }) }
  s_victory(t) { [523, 659, 784, 1047].forEach((f, i) => this.tone(t + i * 0.14, { type: 'triangle', from: f, dur: 0.35, gain: 0.14 })) }
  s_defeat(t) { [392, 330, 262, 196].forEach((f, i) => this.tone(t + i * 0.18, { type: 'triangle', from: f, dur: 0.4, gain: 0.13 })) }

  // Spielereignisse mit Sounds verbinden
  attach(game) {
    const off = []
    const on = (type, fn) => off.push(game.on(type, fn))
    const shotSound = { arrow: 'arrow', cannon: 'cannon', frost: 'frost', lightning: 'zap', sniper: 'sniper', poison: 'poison', slime: 'poison' }
    on('shot', ({ tower }) => this.play(shotSound[tower.type]))
    on('chain', () => this.play('zap'))
    on('pulse', () => this.play('zap'))
    on('impact', ({ kind }) => { if (kind === 'ball') this.play('boom'); else if (kind === 'glob' || kind === 'slime') this.play('splat') })
    on('enemyDeath', ({ enemy }) => { this.play(enemy.boss ? 'boom' : 'death'); this.play('coin') })
    on('leak', () => this.play('leak'))
    on('build', () => this.play('build'))
    on('upgrade', () => this.play('upgrade'))
    on('sell', () => this.play('sell'))
    on('waveStart', ({ boss }) => this.play(boss ? 'boss' : 'wave'))
    on('victory', () => this.play('victory'))
    on('defeat', () => this.play('defeat'))
    return () => off.forEach((f) => f())
  }
}
