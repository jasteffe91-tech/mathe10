// Seitenleiste: Baumenü, Infobereich (Turm/Bauplatz) und Vorschau der nächsten Welle.
// Der Infobereich wird nur neu aufgebaut, wenn sich etwas Strukturelles ändert (Auswahl, Stufe,
// Bezahlbarkeit); laufende Zahlen werden direkt aktualisiert. So gehen keine Klicks verloren.
import { TOWERS, TOWER_ORDER, TARGET_MODES, TARGET_MODE_ORDER, DAMAGE_TYPES } from '../config/towers.js'
import { ENEMIES, ELITE_HINT } from '../config/enemies.js'
import { BALANCE } from '../config/balance.js'
import { drawTowerIcon, drawEnemyIcon } from '../render/sprites.js'
import { esc, num, statTable, HINTS } from './format.js'
import { SHOP_KEYS } from './keys.js'
import { computeStats } from '../game/towers.js'

const SHORT = { arrow: 'Pfeil', cannon: 'Kanone', frost: 'Frost', lightning: 'Blitz', sniper: 'Schütze', poison: 'Gift', ballista: 'Speer', banner: 'Banner', trebuchet: 'Tribok', flame: 'Flamme', slime: 'Schleim', tesla: 'Tesla' }
const dpr = () => Math.min(2, window.devicePixelRatio || 1)

function iconCanvas(size, draw) {
  const c = document.createElement('canvas')
  c.width = c.height = Math.round(size * dpr())
  c.style.width = c.style.height = `${size}px`
  c.setAttribute('aria-hidden', 'true')
  draw(c)
  return c
}

// Schadensart und Einschränkungen eines Turms (z. B. Bogengeschosse treffen keine Flieger)
function damageBadge(def) {
  const d = DAMAGE_TYPES[def.damageType]
  if (!d) return ''
  const air = def.attack === 'shell' ? ' · <span class="no-air">trifft keine Flieger</span>' : ''
  return `<p class="dtype"><span style="color:${d.color}">${d.icon} ${d.name}</span>${air}</p>`
}

export class Panel {
  constructor({ shop, info, preview, compact, controller, settings }) {
    this.shopEl = shop
    this.infoEl = info
    this.previewEl = preview
    this.compactEl = compact
    this.ctl = controller
    this.settings = settings
    this.key = ''
    this.previewKey = ''
    this.compactKey = ''
    this.sellArmed = 0
    this.buildShop()
    this.infoEl.addEventListener('click', (e) => this.onInfoClick(e))
    this.compactEl?.addEventListener('click', (e) => this.onInfoClick(e))
    this.infoEl.addEventListener('pointerover', (e) => { if (e.target.closest('[data-act="upgrade"]')) this.ctl.sel.upgradeHover = true })
    this.infoEl.addEventListener('pointerout', (e) => { if (e.target.closest('[data-act="upgrade"]')) this.ctl.sel.upgradeHover = false })
  }

  buildShop() {
    this.shopEl.innerHTML = ''
    this.shopButtons = {}
    // zwei Reihen: Spaltenzahl aus der Zahl der Türme
    this.shopEl.style.setProperty('--shop-cols', Math.ceil(TOWER_ORDER.length / 2))
    TOWER_ORDER.forEach((type, i) => {
      const def = TOWERS[type]
      const key = SHOP_KEYS[i]?.label
      const b = document.createElement('button')
      b.className = 'shop-btn'
      b.dataset.type = type
      b.title = `${def.name}${key ? ` (Taste ${key})` : ''} – ${def.role} – Grundfläche ${def.footprint.w} × ${def.footprint.h}`
      b.setAttribute('aria-label', `${def.name}, ${def.levels[0].cost} Gold${key ? `, Taste ${key}` : ''}`)
      b.appendChild(iconCanvas(44, (c) => drawTowerIcon(c, type)))
      const label = document.createElement('span')
      label.className = 'shop-name'
      label.textContent = SHORT[type] || def.name
      const cost = document.createElement('span')
      cost.className = 'shop-cost'
      cost.textContent = def.levels[0].cost
      const kbd = document.createElement('kbd')
      kbd.textContent = key || ''
      const size = document.createElement('span')
      size.className = 'shop-size'
      size.textContent = `${def.footprint.w}×${def.footprint.h}`
      b.append(size)
      b.append(label, cost, kbd)
      b.addEventListener('click', () => this.ctl.chooseType(type))
      this.shopEl.appendChild(b)
      this.shopButtons[type] = b
    })
  }

  invalidate() { this.key = '' }

  update() {
    const game = this.ctl.game
    if (!game) return
    const sel = this.ctl.sel
    for (const type of TOWER_ORDER) {
      const b = this.shopButtons[type]
      const poor = game.gold < TOWERS[type].levels[0].cost
      if (b.classList.contains('poor') !== poor) b.classList.toggle('poor', poor)
      const active = sel.type === type
      if (b.classList.contains('active') !== active) {
        b.classList.toggle('active', active)
        b.setAttribute('aria-pressed', active)
        // in der waagerechten Turmleiste (Hochformat) den gewählten Turm sichtbar halten
        if (active && this.shopEl.scrollWidth > this.shopEl.clientWidth) b.scrollIntoView({ block: 'nearest', inline: 'nearest' })
      }
    }
    if (this.sellArmed && performance.now() > this.sellArmed) { this.sellArmed = 0; this.invalidate() }

    const t = sel.tower
    const pv = sel.preview
    const key = [
      sel.type, sel.moving?.id, sel.rot, pv ? `${pv.c},${pv.r},${pv.ok},${pv.goldOk},${pv.code}` : '', sel.obstacle?.id,
      t?.id, t?.level, t?.targetMode, t?.buff?.from?.id, game.towers.length, this.sellArmed ? 1 : 0,
      sel.type ? game.gold >= TOWERS[sel.type].levels[0].cost : '',
      t ? game.canUpgrade(t).ok : '', sel.obstacle ? game.canClear(sel.obstacle).ok : '', game.status,
    ].join('|')
    if (key !== this.key) {
      this.key = key
      this.renderInfo()
    }
    this.updateLive()
    this.updatePreview()
    const ckey = `${key}|${this.previewKey}`
    if (this.compactEl && ckey !== this.compactKey) {
      this.compactKey = ckey
      this.renderCompact()
    }
  }

  // Kompaktzeile des Sheets (Smartphone): das Wichtigste und genau eine Hauptaktion
  renderCompact() {
    const game = this.ctl.game
    const sel = this.ctl.sel
    const p = sel.preview
    let icon = null, title = '', sub = '', subCls = '', actions = ''
    const close = (label) => `<button class="btn icon" data-act="${sel.type || sel.moving ? 'cancel' : 'deselect'}" aria-label="${label}">✕</button>`
    const status = () => {
      if (!p) return ['Ziehe auf der Karte an die gewünschte Stelle.', '']
      if (p.code === 'same') return ['Der Turm steht bereits hier.', '']
      if (p.ok && p.goldOk) return ['✓ Gültige Position', 'ok']
      if (p.ok) return [p.reason || 'Zu wenig Gold.', 'warn']
      return [p.reason || 'Hier geht das nicht.', 'bad']
    }
    if (sel.moving) {
      const t = sel.moving
      icon = [t.type, t.level]
      title = `${TOWERS[t.type].name} versetzen`;
      [sub, subCls] = status()
      const ok = !!(p && p.ok && p.goldOk && p.code !== 'same')
      actions = `<button class="btn primary ${ok ? '' : 'disabled'}" data-act="confirm" aria-disabled="${!ok}">Versetzen <b>${game.moveCost(t)} G</b></button>${close('Versetzen abbrechen')}`
    } else if (sel.type) {
      const def = TOWERS[sel.type]
      icon = [sel.type, 0]
      title = `${def.name} · ${def.levels[0].cost} G`;
      [sub, subCls] = status()
      const ok = !!(p && p.ok && p.goldOk)
      actions = `<button class="btn primary ${ok ? '' : 'disabled'}" data-act="confirm" aria-disabled="${!ok}">Bauen</button>${close('Bauen abbrechen')}`
    } else if (sel.tower) {
      const t = sel.tower
      const def = t.def
      const up = game.canUpgrade(t)
      icon = [t.type, t.level]
      title = `${def.name} · Stufe ${t.level + 1}/${def.levels.length}`
      sub = up.max ? 'Höchste Stufe erreicht' : up.ok ? `Verbessern für ${up.cost} G` : up.reason
      subCls = up.max ? '' : up.ok ? 'ok' : 'bad'
      actions = `${up.max ? '' : `<button class="btn primary ${up.ok ? '' : 'disabled'}" data-act="upgrade" aria-disabled="${!up.ok}">⬆ <b>${up.cost} G</b></button>`}${close('Auswahl aufheben')}`
    } else if (sel.obstacle) {
      const o = sel.obstacle
      const check = game.canClear(o)
      title = o.def.name
      sub = o.def.removable ? (check.ok ? `Räumen für ${game.clearCost(o)} G` : check.reason) : 'Lässt sich nicht entfernen'
      subCls = o.def.removable && !check.ok ? 'bad' : ''
      actions = `${o.def.removable ? `<button class="btn primary ${check.ok ? '' : 'disabled'}" data-act="clear" aria-disabled="${!check.ok}">Räumen</button>` : ''}${close('Auswahl aufheben')}`
    } else {
      // nichts gewählt: Vorschau der nächsten Welle
      const w = game.nextWavePreview()
      const html = w
        ? `<div class="c-text"><span class="c-title">Nächste Welle ${w.number}${w.boss ? ' <span class="boss-tag">Boss</span>' : ''}${w.intro ? ' <span class="c-new">Neu</span>' : ''}</span><span class="c-wave"></span></div>`
        : '<div class="c-text"><span class="c-title">Keine weiteren Wellen</span><span class="c-sub">Halte durch!</span></div>'
      this.compactEl.innerHTML = html
      const list = this.compactEl.querySelector('.c-wave')
      if (w && list) {
        for (const [type, count] of Object.entries(w.counts)) {
          const span = document.createElement('span')
          span.title = ENEMIES[type].name
          span.appendChild(iconCanvas(18, (c) => drawEnemyIcon(c, type)))
          span.append(`${count}`)
          list.appendChild(span)
        }
      }
      return
    }
    this.compactEl.innerHTML = `${icon ? '<span class="c-icon"></span>' : ''}
      <div class="c-text"><span class="c-title">${esc(title)}</span><span class="c-sub ${subCls}">${esc(sub)}</span></div>
      <div class="c-actions">${actions}</div>`
    const slot = this.compactEl.querySelector('.c-icon')
    if (slot) slot.replaceWith(Object.assign(iconCanvas(36, (c) => drawTowerIcon(c, icon[0], icon[1])), { className: 'c-icon' }))
  }

  renderInfo() {
    const game = this.ctl.game
    const sel = this.ctl.sel
    let html = ''
    if (sel.moving) html = this.moveInfo(sel.moving, sel.preview)
    else if (sel.type) html = this.typeInfo(sel.type, sel.preview)
    else if (sel.tower) html = this.towerInfo(sel.tower)
    else if (sel.obstacle) html = this.obstacleInfo(sel.obstacle)
    else html = `<div class="info-empty"><p><b>Bauen:</b> Wähle oben einen Turm. Auf der Karte erscheint das Raster mit einer Vorschau – grün heißt passt, rot heißt besetzt.</p>
      <p>Jeder Turm belegt seine Grundfläche (1 × 1 bis 3 × 3 Zellen). Bäume, Steine und Ruinen lassen sich antippen und gegen Gold räumen.</p>
      <p class="muted">Tasten: 1–9, 0, ß, ´ Turm · Pfeile verschieben Vorschau bzw. ausgewählten Turm · R drehen · Enter bestätigen · Esc abbrechen · Leertaste Pause</p></div>`
    this.infoEl.innerHTML = html
    for (const slot of this.infoEl.querySelectorAll('[data-icon]')) {
      slot.replaceWith(iconCanvas(48, (c) => drawTowerIcon(c, slot.dataset.icon, Number(slot.dataset.level || 0))))
    }
  }

  head(type, level, sub) {
    const def = TOWERS[type]
    return `<div class="info-head"><span data-icon="${type}" data-level="${level}"></span>
      <div><h3>${esc(def.name)}${sub ? ` <span class="lvl">${sub}</span>` : ''}</h3><p class="role">${esc(def.role)}</p>${damageBadge(def)}</div></div>`
  }

  towerInfo(t) {
    const game = this.ctl.game
    const def = t.def
    const cur = t.stats
    const next = def.levels[t.level + 1] ? computeStats({ ...t, level: t.level + 1 }, t.buff) : null
    const up = game.canUpgrade(t)
    const value = game.sellValue(t)
    const modes = TARGET_MODE_ORDER.map((m) => `<button class="seg ${t.targetMode === m ? 'on' : ''}" data-act="target" data-mode="${m}" title="${esc(TARGET_MODES[m].hint)}" aria-pressed="${t.targetMode === m}">${TARGET_MODES[m].name}</button>`).join('')
    return `${this.head(t.type, t.level, `Stufe ${t.level + 1}/${def.levels.length}`)}
      ${statTable(def, cur, next)}
      ${def.limits ? `<p class="limits">${esc(def.limits)}</p>` : ''}
      ${t.buff ? `<p class="buff">Verstärkt durch Kriegsbanner: +${Math.round(t.buff.damage * 100)} % Schaden, +${Math.round(t.buff.rate * 100)} % Feuerrate</p>` : ''}
      ${def.attack === 'aura'
        ? `<p class="meta">Verstärkt gerade <b>${game.towers.filter((o) => o.buff?.from === t).length}</b> Türme.</p>`
        : `<p class="meta">Besiegt: <b data-live="kills">${t.kills}</b> · Schaden gesamt: <b data-live="dmg">${num(t.damageDealt)}</b></p>
      <div class="segmented" role="group" aria-label="Zielwahl (Taste T)">${modes}</div>`}
      <div class="actions">
        ${next
          ? `<button class="btn primary ${up.ok ? '' : 'disabled'}" data-act="upgrade" aria-disabled="${!up.ok}">Verbessern <b>${next.cost} G</b></button>`
          : '<button class="btn disabled" aria-disabled="true">Höchste Stufe</button>'}
        <button class="btn ${this.sellArmed ? 'danger' : ''}" data-act="sell">${this.sellArmed ? 'Wirklich?' : 'Verkaufen'} <b>+${value} G</b></button>
      </div>
      <div class="actions"><button class="btn" data-act="move" title="Taste M">Versetzen <b>${game.moveCost(t)} G</b></button></div>
      <p class="reason" data-live="reason">${next && !up.ok ? esc(up.reason) : ''}</p>
      <p class="muted small">Grundfläche ${t.w} × ${t.h} · Verkauf erstattet ${Math.round(BALANCE.sellRefund * 100)} % von ${t.invested} G (abgerundet). Tastatur: Pfeiltasten versetzen den Turm, Enter bestätigt.</p>`
  }

  // Steuerleiste der Vorschau: drehen, zellweise verschieben, bestätigen, abbrechen
  placeControls(rotatable, confirmLabel, enabled) {
    return `<div class="place-controls">
        <div class="nudge" role="group" aria-label="Vorschau verschieben">
          <button class="btn icon" data-act="nudge" data-dc="0" data-dr="-1" aria-label="nach oben">▲</button>
          <button class="btn icon" data-act="nudge" data-dc="-1" data-dr="0" aria-label="nach links">◀</button>
          <button class="btn icon" data-act="nudge" data-dc="1" data-dr="0" aria-label="nach rechts">▶</button>
          <button class="btn icon" data-act="nudge" data-dc="0" data-dr="1" aria-label="nach unten">▼</button>
        </div>
        ${rotatable ? '<button class="btn" data-act="rotate" title="Taste R">⟳ Drehen</button>' : ''}
      </div>
      <div class="actions">
        <button class="btn primary ${enabled ? '' : 'disabled'}" data-act="confirm" aria-disabled="${!enabled}">${confirmLabel}</button>
        <button class="btn" data-act="cancel">Abbrechen</button>
      </div>`
  }

  previewStatus(p, okText) {
    if (!p) return '<p class="hint-line">Zeige oder tippe auf die Karte, um den Turm zu platzieren.</p>'
    if (p.ok && p.goldOk) return `<p class="place-ok">✓ ${okText}</p>${this.hintLine(p)}`
    // Räumbares Hindernis im Weg: direkt anbieten (ein Hindernis nach dem anderen)
    const o = p.code === 'obstacle' && p.obstacle?.def.removable ? p.obstacle : null
    return `<p class="reason">${esc(p.reason || 'Hier geht das nicht.')}</p>
      ${o ? `<div class="actions"><button class="btn" data-act="clear-preview">${esc(o.def.name)} räumen <b>${this.ctl.game.clearCost(o)} G</b></button></div>` : ''}`
  }

  typeInfo(type, p) {
    const game = this.ctl.game
    const def = TOWERS[type]
    const s = def.levels[0]
    const ok = game.gold >= s.cost
    // Status und Knöpfe zuerst – auf dem Smartphone ohne Scrollen erreichbar
    return `${this.head(type, 0, `${def.footprint.w} × ${def.footprint.h} Zellen`)}
      <p class="cost-line">Preis <b>${s.cost} G</b> · danach <b data-live="remaining" class="${ok ? '' : 'neg'}">${game.gold - s.cost} G</b></p>
      ${this.previewStatus(p, 'Gültige Position – zum Bauen klicken oder bestätigen.')}
      ${this.placeControls(def.footprint.rotatable, `Bauen <b>${s.cost} G</b>`, !!(p && p.ok && p.goldOk))}
      <p class="desc">${esc(def.description)}</p>
      ${statTable(def, s)}
      ${def.limits ? `<p class="limits">${esc(def.limits)}</p>` : ''}
      <p class="muted small">${esc(def.tip)}</p>`
  }

  moveInfo(t, p) {
    const game = this.ctl.game
    const cost = game.moveCost(t)
    return `${this.head(t.type, t.level, 'versetzen')}
      <p class="desc">Neue Position wählen. Der Turm bleibt bis zur Bestätigung an seinem Platz und schießt weiter.</p>
      ${p && p.code === 'same' ? '<p class="hint-line">Der Turm steht bereits hier.</p>' : this.previewStatus(p, 'Gültige Position.')}
      ${this.placeControls(t.def.footprint.rotatable, `Versetzen <b>${cost} G</b>`, !!(p && p.ok && p.goldOk && p.code !== 'same'))}`
  }

  obstacleInfo(o) {
    const game = this.ctl.game
    const d = o.def
    const check = game.canClear(o)
    const props = [
      `Belegt ${o.cells.length} ${o.cells.length === 1 ? 'Zelle' : 'Zellen'}`,
      'nicht bebaubar',
      d.walkable ? 'für Gegner passierbar' : 'für Gegner unpassierbar',
      d.blocksSight ? 'blockiert Sicht und Geschosse' : 'Türme schießen darüber hinweg',
      `Aufwand: ${d.effort}`,
    ]
    return `<div class="info-head"><div><h3>${esc(d.name)}</h3><p class="role">Hindernis</p></div></div>
      <ul class="props">${props.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
      ${d.removable
        ? `<div class="actions"><button class="btn primary ${check.ok ? '' : 'disabled'}" data-act="clear" aria-disabled="${!check.ok}" title="Taste C">Räumen <b>${game.clearCost(o)} G</b></button></div>
           <p class="reason">${check.ok ? '' : esc(check.reason)}</p>
           <p class="muted small">Danach ist die Fläche sofort bebaubar.</p>`
        : '<p class="reason">Lässt sich nicht entfernen – plane um das Hindernis herum.</p>'}`
  }

  hintLine(p) {
    const hint = this.ctl.game.hintAt(p.x, p.y)
    const h = HINTS[hint] || HINTS.standard
    return `<p class="spot-hint"><span class="tag tag-${hint}">${h.name}</span> ${h.text}</p>`
  }

  updateLive() {
    const game = this.ctl.game
    const sel = this.ctl.sel
    const set = (name, text) => {
      const el = this.infoEl.querySelector(`[data-live="${name}"]`)
      if (el && el.textContent !== text) el.textContent = text
    }
    if (sel.tower) {
      set('kills', String(sel.tower.kills))
      set('dmg', num(sel.tower.damageDealt))
      const up = game.canUpgrade(sel.tower)
      if (!up.max) set('reason', up.ok ? '' : up.reason)
    } else if (sel.type) {
      const cost = TOWERS[sel.type].levels[0].cost
      set('remaining', `${game.gold - cost} G`)
    }
  }

  onInfoClick(e) {
    const b = e.target.closest('[data-act]')
    if (!b) return
    switch (b.dataset.act) {
      case 'confirm': this.ctl.confirm(); break
      case 'cancel': this.ctl.cancel(); break
      case 'nudge': this.ctl.nudgeScreen(Number(b.dataset.dc), Number(b.dataset.dr)); break
      case 'deselect': this.ctl.clear(); break
      case 'rotate': this.ctl.rotate(); break
      case 'move': this.ctl.startMove(); break
      case 'clear': this.ctl.clearObstacle(); break
      case 'clear-preview': this.ctl.clearPreviewObstacle(); break
      case 'upgrade': this.ctl.upgrade(); break
      case 'target': this.ctl.setTargetMode(b.dataset.mode); break
      case 'sell': this.requestSell(); break
    }
  }

  requestSell() {
    if (this.settings().confirmSell && !this.sellArmed) {
      this.sellArmed = performance.now() + 3000
      this.invalidate()
      return
    }
    this.sellArmed = 0
    this.ctl.sell()
  }

  updatePreview() {
    const game = this.ctl.game
    const p = game.nextWavePreview()
    const key = p ? `${p.number}` : 'none'
    const hint = p?.intro ? (p.intro === 'elite' ? ELITE_HINT : ENEMIES[p.intro]?.hint) : ''
    if (key === this.previewKey) return
    this.previewKey = key
    if (!p) {
      this.previewEl.innerHTML = '<p class="muted">Keine weiteren Wellen – halte durch!</p>'
      return
    }
    this.previewEl.innerHTML = `<h4>Nächste Welle ${p.number}${p.boss ? ' <span class="boss-tag">Boss</span>' : ''}</h4>
      ${p.title ? `<p class="wave-title">${esc(p.title)}</p>` : ''}${hint ? `<p class="wave-intro">${esc(hint)}</p>` : ''}<ul class="wave-list"></ul>`
    const ul = this.previewEl.querySelector('ul')
    for (const [type, count] of Object.entries(p.counts)) {
      const li = document.createElement('li')
      li.title = `${ENEMIES[type].name}: ${ENEMIES[type].description}`
      li.appendChild(iconCanvas(26, (c) => drawEnemyIcon(c, type)))
      const span = document.createElement('span')
      const elite = p.elite[type] || 0
      span.textContent = `${count}× ${ENEMIES[type].name}${elite ? ` (${elite === count ? '' : `${elite} `}Elite)` : ''}`
      li.appendChild(span)
      ul.appendChild(li)
    }
  }
}
