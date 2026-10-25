// Seitenleiste: Baumenü, Infobereich (Turm/Bauplatz) und Vorschau der nächsten Welle.
// Der Infobereich wird nur neu aufgebaut, wenn sich etwas Strukturelles ändert (Auswahl, Stufe,
// Bezahlbarkeit); laufende Zahlen werden direkt aktualisiert. So gehen keine Klicks verloren.
import { TOWERS, TOWER_ORDER, TARGET_MODES, TARGET_MODE_ORDER } from '../config/towers.js'
import { ENEMIES } from '../config/enemies.js'
import { drawTowerIcon, drawEnemyIcon } from '../render/sprites.js'
import { esc, num, statTable, HINTS } from './format.js'

const dpr = () => Math.min(2, window.devicePixelRatio || 1)

function iconCanvas(size, draw) {
  const c = document.createElement('canvas')
  c.width = c.height = Math.round(size * dpr())
  c.style.width = c.style.height = `${size}px`
  c.setAttribute('aria-hidden', 'true')
  draw(c)
  return c
}

export class Panel {
  constructor({ shop, info, preview, controller, settings }) {
    this.shopEl = shop
    this.infoEl = info
    this.previewEl = preview
    this.ctl = controller
    this.settings = settings
    this.key = ''
    this.previewKey = ''
    this.sellArmed = 0
    this.buildShop()
    this.infoEl.addEventListener('click', (e) => this.onInfoClick(e))
    this.infoEl.addEventListener('pointerover', (e) => { if (e.target.closest('[data-act="upgrade"]')) this.ctl.sel.upgradeHover = true })
    this.infoEl.addEventListener('pointerout', (e) => { if (e.target.closest('[data-act="upgrade"]')) this.ctl.sel.upgradeHover = false })
  }

  buildShop() {
    this.shopEl.innerHTML = ''
    this.shopButtons = {}
    TOWER_ORDER.forEach((type, i) => {
      const def = TOWERS[type]
      const b = document.createElement('button')
      b.className = 'shop-btn'
      b.dataset.type = type
      b.title = `${def.name} (Taste ${i + 1}) – ${def.role}`
      b.setAttribute('aria-label', `${def.name}, ${def.levels[0].cost} Gold, Taste ${i + 1}`)
      b.appendChild(iconCanvas(44, (c) => drawTowerIcon(c, type)))
      const label = document.createElement('span')
      label.className = 'shop-name'
      label.textContent = def.name.replace('turm', '').replace('Scharfschützen', 'Scharfschütze')
      const cost = document.createElement('span')
      cost.className = 'shop-cost'
      cost.textContent = def.levels[0].cost
      const key = document.createElement('kbd')
      key.textContent = i + 1
      b.append(label, cost, key)
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
      }
    }
    if (this.sellArmed && performance.now() > this.sellArmed) { this.sellArmed = 0; this.invalidate() }

    const t = sel.tower
    const key = [
      sel.spot, sel.type, t?.id, t?.level, t?.targetMode, this.sellArmed ? 1 : 0,
      sel.type ? game.gold >= TOWERS[sel.type].levels[0].cost : '',
      t ? game.canUpgrade(t).ok : '', game.status,
    ].join('|')
    if (key !== this.key) {
      this.key = key
      this.renderInfo()
    }
    this.updateLive()
    this.updatePreview()
  }

  renderInfo() {
    const game = this.ctl.game
    const sel = this.ctl.sel
    let html = ''
    if (sel.tower) html = this.towerInfo(sel.tower)
    else if (sel.type) html = this.typeInfo(sel.type, sel.spot)
    else if (sel.spot !== null) html = this.spotInfo(game.spots[sel.spot])
    else html = `<div class="info-empty"><p><b>Bauplätze</b> sind die runden Steinplatten am Weg.</p>
      <p>Tippe auf einen Bauplatz und wähle einen Turm – oder wähle zuerst einen Turm und tippe dann auf einen Platz.</p>
      <p class="muted">Tasten: 1–6 Turm · Leertaste Pause · N nächste Welle · F Tempo</p></div>`
    this.infoEl.innerHTML = html
    for (const slot of this.infoEl.querySelectorAll('[data-icon]')) {
      slot.replaceWith(iconCanvas(48, (c) => drawTowerIcon(c, slot.dataset.icon, Number(slot.dataset.level || 0))))
    }
  }

  head(type, level, sub) {
    const def = TOWERS[type]
    return `<div class="info-head"><span data-icon="${type}" data-level="${level}"></span>
      <div><h3>${esc(def.name)}${sub ? ` <span class="lvl">${sub}</span>` : ''}</h3><p class="role">${esc(def.role)}</p></div></div>`
  }

  towerInfo(t) {
    const game = this.ctl.game
    const def = t.def
    const cur = def.levels[t.level]
    const next = def.levels[t.level + 1] || null
    const up = game.canUpgrade(t)
    const value = game.sellValue(t)
    const modes = TARGET_MODE_ORDER.map((m) => `<button class="seg ${t.targetMode === m ? 'on' : ''}" data-act="target" data-mode="${m}" title="${esc(TARGET_MODES[m].hint)}" aria-pressed="${t.targetMode === m}">${TARGET_MODES[m].name}</button>`).join('')
    return `${this.head(t.type, t.level, `Stufe ${t.level + 1}/${def.levels.length}`)}
      ${statTable(def, cur, next)}
      <p class="meta">Besiegt: <b data-live="kills">${t.kills}</b> · Schaden gesamt: <b data-live="dmg">${num(t.damageDealt)}</b></p>
      <div class="segmented" role="group" aria-label="Zielwahl (Taste T)">${modes}</div>
      <div class="actions">
        ${next
          ? `<button class="btn primary ${up.ok ? '' : 'disabled'}" data-act="upgrade" aria-disabled="${!up.ok}">Verbessern <b>${next.cost} G</b></button>`
          : '<button class="btn disabled" aria-disabled="true">Höchste Stufe</button>'}
        <button class="btn ${this.sellArmed ? 'danger' : ''}" data-act="sell">${this.sellArmed ? 'Wirklich?' : 'Verkaufen'} <b>+${value} G</b></button>
      </div>
      <p class="reason" data-live="reason">${next && !up.ok ? esc(up.reason) : ''}</p>
      <p class="muted small">Verkauf erstattet ${Math.round((value / t.invested) * 100)} % von ${t.invested} G investiertem Gold.</p>`
  }

  typeInfo(type, spotIndex) {
    const game = this.ctl.game
    const def = TOWERS[type]
    const s = def.levels[0]
    const spot = spotIndex !== null ? game.spots[spotIndex] : null
    const check = spot ? game.canBuild(spot.index, type) : null
    const ok = game.gold >= s.cost
    return `${this.head(type, 0, '')}
      <p class="desc">${esc(def.description)}</p>
      ${statTable(def, s)}
      <p class="cost-line">Preis <b>${s.cost} G</b> · danach <b data-live="remaining" class="${ok ? '' : 'neg'}">${game.gold - s.cost} G</b></p>
      ${spot
        ? `<div class="actions"><button class="btn primary ${check.ok ? '' : 'disabled'}" data-act="build" aria-disabled="${!check.ok}">Bauen <b>${s.cost} G</b></button>
           <button class="btn" data-act="cancel">Abbrechen</button></div>`
        : '<p class="hint-line">Tippe auf einen leuchtenden Bauplatz, um den Turm zu bauen.</p>'}
      <p class="reason" data-live="reason">${ok ? '' : `Dir fehlen ${s.cost - game.gold} Gold. Besiege Gegner, um Gold zu verdienen.`}</p>
      <p class="muted small">${esc(def.tip)}</p>
      ${spot ? this.hintLine(spot) : ''}`
  }

  spotInfo(spot) {
    return `<div class="info-empty"><h3>Freier Bauplatz</h3>${this.hintLine(spot)}
      <p>Wähle im Baumenü einen Turm. Ein zweiter Tipp auf denselben Turm baut ihn.</p></div>`
  }

  hintLine(spot) {
    const h = HINTS[spot.hint] || HINTS.standard
    return `<p class="spot-hint"><span class="tag tag-${spot.hint}">${h.name}</span> ${h.text}</p>`
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
      set('reason', game.gold >= cost ? '' : `Dir fehlen ${cost - game.gold} Gold. Besiege Gegner, um Gold zu verdienen.`)
    }
  }

  onInfoClick(e) {
    const b = e.target.closest('[data-act]')
    if (!b) return
    switch (b.dataset.act) {
      case 'build': this.ctl.build(); break
      case 'cancel': this.ctl.clear(); break
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
    if (key === this.previewKey) return
    this.previewKey = key
    if (!p) {
      this.previewEl.innerHTML = '<p class="muted">Keine weiteren Wellen – halte durch!</p>'
      return
    }
    this.previewEl.innerHTML = `<h4>Nächste Welle ${p.number}${p.boss ? ' <span class="boss-tag">Boss</span>' : ''}</h4>
      ${p.title ? `<p class="wave-title">${esc(p.title)}</p>` : ''}<ul class="wave-list"></ul>`
    const ul = this.previewEl.querySelector('ul')
    for (const [type, count] of Object.entries(p.counts)) {
      const li = document.createElement('li')
      li.title = `${ENEMIES[type].name}: ${ENEMIES[type].description}`
      li.appendChild(iconCanvas(26, (c) => drawEnemyIcon(c, type)))
      const span = document.createElement('span')
      span.textContent = `${count}× ${ENEMIES[type].name}`
      li.appendChild(span)
      ul.appendChild(li)
    }
  }
}
