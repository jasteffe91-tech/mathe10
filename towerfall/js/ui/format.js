// Formatierung von Zahlen und Turmwerten für die Oberfläche.
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
export const num = (n, digits = 0) => Number(n).toLocaleString('de-DE', { maximumFractionDigits: digits, minimumFractionDigits: digits })

// Werteliste eines Turms auf einer Stufe. `key` dient zum Vergleich mit der nächsten Stufe.
export function statList(def, s) {
  const rows = []
  if (def.attack === 'aura') {
    rows.push({ key: 'range', label: 'Reichweite', value: s.range, text: num(s.range) })
    rows.push({ key: 'auraDamage', label: 'Schaden der Türme', value: s.auraDamage, text: `+${Math.round(s.auraDamage * 100)} %` })
    rows.push({ key: 'auraRate', label: 'Feuerrate der Türme', value: s.auraRate, text: `+${Math.round(s.auraRate * 100)} %` })
    return rows
  }
  if (def.attack === 'chain') rows.push({ key: 'damage', label: 'Schaden', value: s.damage, text: `${num(s.damage)} · ${s.chains} Ziele` })
  else if (def.attack === 'pulse') rows.push({ key: 'damage', label: 'Schaden', value: s.damage, text: `${num(s.damage)} · bis ${s.maxTargets} Ziele` })
  else rows.push({ key: 'damage', label: 'Schaden', value: s.damage, text: num(s.damage) })
  rows.push({ key: 'range', label: 'Reichweite', value: s.range, text: num(s.range) })
  rows.push({ key: 'rate', label: 'Angriffe', value: s.rate, text: `${num(s.rate, 2)}/s` })
  // Schaden/s je Ziel: direkt + Schaden über Zeit (Brand bei voller Stufe)
  const dps = s.damage * s.rate + (s.poisonDps || 0) + (s.burnDps || 0) * 3 + (s.slimeDps || 0)
  const per = def.attack === 'chain' || def.attack === 'pulse' || def.attack === 'cone' ? ' je Ziel' : ''
  rows.push({ key: 'dps', label: 'Schaden/s', value: dps, text: `≈ ${num(dps, 0)}${per}` })
  if (s.cone) rows.push({ key: 'cone', label: 'Kegel', value: s.cone, text: `${num(s.cone)}° breit` })
  if (s.splash) rows.push({ key: 'splash', label: 'Fläche', value: s.splash, text: `${num(s.splash)} Radius` })
  if (s.slow) rows.push({ key: 'slow', label: 'Verlangsamung', value: s.slow, text: `${Math.round(s.slow * 100)} % · ${num(s.slowDuration, 1)} s` })
  if (s.freezeHits) rows.push({ key: 'freeze', label: 'Einfrieren', value: s.freezeDuration, text: `nach ${s.freezeHits} Treffern · ${num(s.freezeDuration, 2)} s` })
  if (s.slimeSlow) rows.push({ key: 'slime', label: 'Schleim', value: s.slimeSlow, text: `−${Math.round(s.slimeSlow * 100)} % · ${num(s.slimeDuration, 1)} s · ${num(s.slimeDps, 1)}/s` })
  if (s.burnDps) rows.push({ key: 'burn', label: 'Brand', value: s.burnDps, text: `${num(s.burnDps)}/s je Stufe · bis 3 · ${num(s.burnDuration, 1)} s` })
  if (s.stunDuration) rows.push({ key: 'stun', label: 'Schock', value: s.stunDuration, text: `${num(s.stunDuration, 2)} s Stillstand` })
  if (s.poisonDps) rows.push({ key: 'poison', label: 'Gift', value: s.poisonDps, text: `${num(s.poisonDps)}/s · ${num(s.poisonDuration, 1)} s` })
  if (s.pierceCount) rows.push({ key: 'pierceCount', label: 'Durchbohrt', value: s.pierceCount, text: `bis ${s.pierceCount} Gegner` })
  if (s.chains) rows.push({ key: 'chains', label: 'Sprünge', value: s.chains, text: `${s.chains} · ${num(s.chainRange)} weit` })
  if (s.armorPierce) rows.push({ key: 'pierce', label: 'Panzerbrechend', value: s.armorPierce, text: `${Math.round(s.armorPierce * 100)} %` })
  return rows
}

// Tabelle mit optionalem Vergleich zur nächsten Stufe
export function statTable(def, current, next = null) {
  const a = statList(def, current)
  const b = next ? statList(def, next) : null
  return `<dl class="stats">${a.map((row) => {
    const n = b?.find((r) => r.key === row.key)
    const change = n && n.value !== row.value
    return `<div><dt>${row.label}</dt><dd>${esc(row.text)}${change ? ` <span class="up">→ ${esc(n.text)}</span>` : ''}</dd></div>`
  }).join('')}</dl>`
}

export const HINTS = {
  kurve: { name: 'Kurve', text: 'Sieht mehrere Wegabschnitte – gut für Kanone, Blitz und Gift.' },
  weit: { name: 'Weitblick', text: 'Lange Sichtlinie – gut für Scharfschützen.' },
  engpass: { name: 'Letzte Linie', text: 'Direkt vor der Bastion – letzte Chance für Nachzügler.' },
  standard: { name: 'Bauplatz', text: 'Solider Platz für jeden Turm.' },
}
