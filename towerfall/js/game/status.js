// Statuseffekte auf Gegnern – ein gemeinsames System für alle Türme.
//
// Jeder Gegner trägt eine kleine Liste `effects` mit höchstens einem Eintrag je Effekttyp:
//   { type, source, time, duration, slow, dps, stacks, stun }
// Alle Effekte laufen in genau einem Update je Simulationsschritt (updateStatus, aufgerufen von
// updateEnemy) – keine eigenen Timer, keine Event-Listener. Damit gelten Pause und Spieltempo
// automatisch, und Schaden über Zeit kann nicht doppelt angewendet werden. Stirbt ein Gegner, wird er
// samt Liste aus dem Spiel entfernt; abgelaufene Effekte werden sofort aus der Liste gelöscht.
//
// Erneuern/Stapeln (`stack`):
//   strongest – der stärkere Wert (Verlangsamung bzw. Schaden/s) gilt, die Dauer ist das Maximum aus
//               Restdauer und neuer Dauer (Frost, Gift)
//   refresh   – stärkerer Wert gilt, die Dauer beginnt neu (Schleim)
//   intensity – jede Anwendung erhöht die Stufe um 1 bis `maxStacks`, die Dauer beginnt neu, Schaden/s
//               je Stufe = stärkster bisheriger Wert (Brand)
//   stun      – Gegner bleibt stehen; danach ist er eine Zeit lang immun gegen jede Betäubung
//               (Schock, Einfrieren), Bosse stehen nur einen Bruchteil der Zeit und sind länger immun
//   build     – Zähler, der bei `threshold` einen anderen Effekt auslöst (Kälte → Einfrieren)
//
// Grenzen: Verlangsamungen addieren sich nie (es zählt die stärkste aktive) und sind auf
// BALANCE.maxSlow gedeckelt; `slowResist` der Gegner verringert Verlangsamung und Betäubung;
// Raserei (Berserker) macht immun gegen alles, was bremst oder festhält.
import { BALANCE } from '../config/balance.js'

export const STATUS = {
  slow: { name: 'Verlangsamt', stack: 'strongest', impairs: true, color: '#96d7ff' },
  slime: { name: 'Verschleimt', stack: 'refresh', impairs: true, damageType: 'acid', color: '#e05aa8' },
  poison: { name: 'Vergiftet', stack: 'strongest', damageType: 'poison', color: '#8ee34f' },
  burn: { name: 'Brennt', stack: 'intensity', maxStacks: 3, damageType: 'fire', color: '#ff8a3a' },
  shock: { name: 'Geschockt', stack: 'stun', impairs: true, color: '#9fe8ff' },
  freeze: { name: 'Eingefroren', stack: 'stun', impairs: true, color: '#d8f4ff' },
  chill: { name: 'Unterkühlt', stack: 'build', impairs: true, color: '#bfeaff' },
}

export const getStatus = (e, type) => {
  for (const f of e.effects) if (f.type === type) return f
  return null
}
export const statusTime = (e, type) => getStatus(e, type)?.time || 0
export const isStunned = (e) => e.effects.some((f) => f.stun)

// stärkste wirksame Verlangsamung (0 … maxSlow), ohne Gegnerresistenz
export function slowOf(e) {
  let s = 0
  for (const f of e.effects) if (f.slow > s) s = f.slow
  return Math.min(s, BALANCE.maxSlow)
}

// Bewegungsfaktor aus allen Effekten (0 = steht, 1 = volle Geschwindigkeit)
export function movementFactor(e) {
  if (e.frenzy > 0) return 1
  if (isStunned(e)) return 0
  return 1 - slowOf(e) * (1 - (e.def.slowResist || 0))
}

// Effekt anwenden. Gibt true zurück, wenn er wirkt (false: immun, z. B. in Raserei oder nach einer
// Betäubung). Kälte (`build`) löst bei `threshold` Stufen den Effekt `then` aus (Einfrieren).
export function applyStatus(e, type, { duration = 0, slow = 0, dps = 0, source = null, threshold = 0, then = null } = {}) {
  const def = STATUS[type]
  if (!def || !e.alive) return false
  if (def.impairs && e.frenzy > 0) return false
  let f = getStatus(e, type)
  switch (def.stack) {
    case 'stun': {
      if (e.stunImmune > 0 || f) return false
      const boss = e.boss
      const k = (boss ? BALANCE.stun.bossFactor : 1) * (1 - (e.def.slowResist || 0) * 0.5)
      e.effects.push({ type, source, time: duration * k, duration: duration * k, slow: 0, dps: 0, stacks: 1, stun: true })
      return true
    }
    case 'build': {
      if (e.stunImmune > 0) return false
      if (!f) { f = { type, source, time: duration, duration, slow: 0, dps: 0, stacks: 0, stun: false }; e.effects.push(f) }
      f.stacks++
      f.time = f.duration = duration
      if (threshold && f.stacks >= threshold) {
        removeStatus(e, type)
        if (then) applyStatus(e, then.type, { ...then, source })
      }
      return true
    }
    case 'intensity': {
      if (!f) { f = { type, source, time: 0, duration: 0, slow: 0, dps: 0, stacks: 0, stun: false }; e.effects.push(f) }
      f.stacks = Math.min(def.maxStacks, f.stacks + 1)
      f.dps = Math.max(f.dps, dps)
      f.time = f.duration = duration
      f.source = source
      return true
    }
    case 'refresh': {
      if (!f) { f = { type, source, time: 0, duration: 0, slow: 0, dps: 0, stacks: 1, stun: false }; e.effects.push(f) }
      f.slow = Math.max(f.slow, slow)
      if (dps >= f.dps) { f.dps = dps; f.source = source }
      f.time = f.duration = duration
      return true
    }
    default: { // strongest
      if (!f) { f = { type, source, time: 0, duration: 0, slow: 0, dps: 0, stacks: 1, stun: false }; e.effects.push(f) }
      const value = slow || dps
      const current = f.slow || f.dps
      if (value >= current) { f.slow = slow; f.dps = dps; f.source = source }
      f.time = Math.max(f.time, duration)
      f.duration = Math.max(f.duration, duration)
      return true
    }
  }
}

export function removeStatus(e, type) {
  const i = e.effects.findIndex((f) => f.type === type)
  if (i >= 0) e.effects.splice(i, 1)
}

// Beginn der Raserei: Verlangsamung, Kälte und Betäubungen fallen ab. Schleim bleibt kleben (sein
// Säureschaden läuft weiter), bremst aber erst wieder, wenn die Raserei vorbei ist (movementFactor).
export function clearImpairments(e) {
  e.effects = e.effects.filter((f) => f.type === 'slime' || !STATUS[f.type].impairs)
}

// Ein Simulationsschritt aller Effekte eines Gegners. `damage` = damageEnemy-Funktion (Schaden über
// Zeit ignoriert Panzerung, berücksichtigt aber die Resistenz gegen die Schadensart).
export function updateStatus(game, e, dt, damage) {
  if (e.stunImmune > 0) e.stunImmune = Math.max(0, e.stunImmune - dt)
  if (!e.effects.length) return
  let n = 0
  for (let i = 0; i < e.effects.length; i++) {
    const f = e.effects[i]
    const step = Math.min(dt, f.time)
    if (f.dps > 0 && step > 0) {
      damage(game, e, f.dps * f.stacks * step, { dot: true, source: f.source, type: STATUS[f.type].damageType })
      if (!e.alive) { e.effects.length = 0; return }
    }
    f.time -= dt
    if (f.time > 0) { e.effects[n++] = f; continue }
    // abgelaufen: nach einer Betäubung kurz immun
    if (f.stun) e.stunImmune = e.boss ? BALANCE.stun.bossImmunity : BALANCE.stun.immunity
  }
  e.effects.length = n
}
