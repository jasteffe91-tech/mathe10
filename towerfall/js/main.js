// Towerfall – Die letzte Bastion. Einstiegspunkt: verbindet Bildschirme, Spiel, Darstellung,
// Eingaben, Audio, Speicherung und PWA.
import { MAPS, getMap } from './config/maps.js'
import { DIFFICULTIES, SIM } from './config/balance.js'
import { TOWERS, TOWER_ORDER } from './config/towers.js'
import { ENEMIES, ENEMY_ORDER } from './config/enemies.js'
import { Game } from './game/game.js'
import { GameLoop } from './core/loop.js'
import { Renderer } from './render/renderer.js'
import { drawTowerIcon, drawEnemyIcon } from './render/sprites.js'
import { Controller } from './ui/controller.js'
import { Panel } from './ui/panel.js'
import { Hud } from './ui/hud.js'
import { openModal, closeModal, modalOpen } from './ui/modal.js'
import { setupPointer, setupKeyboard } from './ui/input.js'
import { esc, num } from './ui/format.js'
import { Storage } from './storage.js'
import { Sfx } from './audio.js'
import { setupPwa } from './pwa.js'

const $ = (sel) => document.querySelector(sel)
const storage = new Storage()
let settings = storage.loadSettings()
const sfx = new Sfx()
const state = { screen: 'menu', game: null, detachers: [], mapId: MAPS[0].id, difficulty: 'normal', pausedByUser: false }

// ---------- Bildschirme ----------
function showScreen(name) {
  state.screen = name
  for (const s of document.querySelectorAll('.screen')) s.hidden = s.id !== `screen-${name}`
  if (name === 'game') requestAnimationFrame(() => renderer.resize())
  if (name === 'menu') refreshMenu()
  if (name === 'maps') renderMaps()
}

// ---------- Einstellungen ----------
const motionQuery = matchMedia('(prefers-reduced-motion: reduce)')
const reducedMotion = () => settings.reducedMotion === 'on' || (settings.reducedMotion === 'auto' && motionQuery.matches)

function applySettings() {
  sfx.setEnabled(settings.sound)
  sfx.setVolume(settings.volume)
  renderer.setReducedMotion(reducedMotion())
  document.documentElement.classList.toggle('reduced-motion', reducedMotion())
  storage.saveSettings(settings)
}
motionQuery.addEventListener?.('change', applySettings)

// ---------- Darstellung & Schleife ----------
const canvas = $('#canvas')
const renderer = new Renderer(canvas)
const toastArea = $('#toasts')

function toast(text, kind = 'info') {
  const el = document.createElement('div')
  el.className = `toast toast-${kind}`
  el.textContent = text
  el.setAttribute('role', kind === 'error' ? 'alert' : 'status')
  toastArea.appendChild(el)
  while (toastArea.children.length > 3) toastArea.firstChild.remove()
  setTimeout(() => el.classList.add('out'), 2200)
  setTimeout(() => el.remove(), 2700)
}

const controller = new Controller({
  onChange: () => panel?.invalidate(),
  onMessage: toast,
  sfx,
})
const panel = new Panel({ shop: $('#shop'), info: $('#info'), preview: $('#wave-preview'), controller, settings: () => settings })
const hud = new Hud({
  lives: $('#hud-lives'), livesBox: $('#hud-lives-box'), gold: $('#hud-gold'), wave: $('#hud-wave'),
  enemies: $('#hud-enemies'), progress: $('#hud-progress'), next: $('#btn-next'), nextCls: $('#btn-next'),
  speed: $('#btn-speed'), pause: $('#btn-pause'),
})

let uiTimer = 0
const loop = new GameLoop({
  update: (dt) => state.game?.step(dt),
  render: (alpha, visualDt, realDt) => {
    if (!state.game || state.screen !== 'game') return
    const sel = controller.sel
    renderer.render(alpha, {
      spot: sel.spot, tower: sel.tower, type: sel.type, hoverSpot: sel.hoverSpot,
      upgradeHover: sel.upgradeHover, showAllRanges: settings.showAllRanges,
    }, visualDt)
    // Oberfläche ~10× pro Sekunde aktualisieren reicht und spart DOM-Arbeit
    uiTimer -= realDt
    if (uiTimer <= 0) {
      uiTimer = 0.1
      hud.update(state.game, loop)
      panel.update()
    }
  },
})

function setPaused(paused, byUser = true) {
  loop.paused = paused
  if (byUser) state.pausedByUser = paused
  $('#pause-banner').hidden = !paused || modalOpen()
  hud.update(state.game, loop)
}

// ---------- Spiel starten ----------
function startGame({ mapId, difficulty, snapshot = null }) {
  for (const d of state.detachers) d()
  state.detachers = []
  closeModal(true)
  let game
  try {
    game = snapshot ? Game.restore(snapshot) : new Game({ mapId, difficulty, seed: (Math.random() * 1e9) | 0 })
  } catch (err) {
    console.error(err)
    storage.clearSave()
    toast('Der gespeicherte Spielstand war nicht lesbar und wurde verworfen.', 'error')
    game = new Game({ mapId, difficulty })
  }
  state.game = game
  state.mapId = game.map.id
  state.difficulty = game.difficulty.id
  controller.setGame(game)
  hud.reset()
  panel.invalidate()
  panel.previewKey = ''
  renderer.setGame(game)
  state.detachers.push(sfx.attach(game))
  state.detachers.push(...wireGame(game))
  loop.speed = SIM.speeds.includes(settings.defaultSpeed) ? settings.defaultSpeed : 1
  showScreen('game')
  setPaused(false)
  loop.start()
  if (snapshot) toast(`Spielstand geladen: Welle ${game.wave + 1} wartet auf dich.`)
  if (!settings.introSeen) showIntro(true)
  autosave()
}

function wireGame(game) {
  const off = []
  const on = (t, fn) => off.push(game.on(t, fn))
  on('waveStart', ({ wave, boss, title }) => {
    storage.noteWave(game.map.id, wave)
    toast(boss ? `Welle ${wave}: ${title || 'Bosswelle!'}` : `Welle ${wave} kommt!`, boss ? 'boss' : 'info')
  })
  on('waveEnd', ({ wave, bonus }) => {
    if (game.status === 'playing') toast(`Welle ${wave} überstanden${bonus ? ` · +${bonus} Gold` : ''}`, 'good')
    autosave()
  })
  on('enrage', ({ enemy }) => toast(`${enemy.def.name} wird wütend!`, 'boss'))
  for (const t of ['build', 'upgrade', 'sell', 'targetMode']) on(t, () => { autosave(); panel.invalidate() })
  // kurze Verzögerung, damit die letzte Explosion noch zu sehen ist
  on('victory', () => setTimeout(() => { if (state.game === game) endGame(true) }, 900))
  on('defeat', () => setTimeout(() => { if (state.game === game) endGame(false) }, 900))
  return off
}

// Zwischen den Wellen speichern; während einer Welle bleibt der letzte Stand davor erhalten
function autosave() {
  const g = state.game
  if (g && g.canSnapshot()) storage.writeSave(g.snapshot())
}

function endGame(won) {
  const g = state.game
  if (!g) return
  storage.clearSave()
  const result = storage.recordResult({
    mapId: g.map.id, difficulty: g.difficulty.id, won, wave: g.wave,
    score: g.stats.score, lives: g.lives, kills: g.stats.kills,
  })
  loop.paused = true
  const s = g.stats
  const unlocked = MAPS.filter((m) => m.unlock && m.unlock.map === g.map.id && g.wave >= m.unlock.wave && !wasUnlockedBefore(m))
  openModal({
    title: won ? 'Sieg! Die Bastion steht.' : 'Die Bastion ist gefallen',
    className: won ? 'result win' : 'result lose',
    dismissible: false,
    body: `<p class="result-lead">${won
      ? `Du hast alle ${g.totalWaves} Wellen auf <b>${esc(g.map.name)}</b> (${g.difficulty.name}) abgewehrt.`
      : `Welle ${g.wave} von ${g.totalWaves} auf <b>${esc(g.map.name)}</b>. ${g.wave >= g.totalWaves ? 'So knapp!' : 'Versuch eine andere Turm-Kombination.'}`}</p>
      <dl class="result-stats">
        <div><dt>Punkte</dt><dd>${num(s.score)}${result.newBest ? ' <span class="badge">Neue Bestleistung!</span>' : ''}</dd></div>
        <div><dt>Wellen überstanden</dt><dd>${s.wavesCleared}</dd></div>
        <div><dt>Gegner besiegt</dt><dd>${s.kills}</dd></div>
        <div><dt>Bosse besiegt</dt><dd>${s.bossesKilled}</dd></div>
        <div><dt>Leben übrig</dt><dd>${g.lives} / ${g.maxLives}</dd></div>
        <div><dt>Gold verdient</dt><dd>${g.wallet.earned}</dd></div>
      </dl>
      ${unlocked.length ? `<p class="unlock">Neue Karte freigeschaltet: <b>${unlocked.map((m) => esc(m.name)).join(', ')}</b></p>` : ''}
      ${!won ? '<p class="muted small">Tipp: Frost vor Kanonen, Scharfschützen gegen Bosse, Gift gegen Eisenwachen.</p>' : ''}`,
    actions: [
      { label: 'Nochmal', primary: true, onClick: () => startGame({ mapId: g.map.id, difficulty: g.difficulty.id }) },
      { label: 'Kartenwahl', onClick: () => { stopGame(); showScreen('maps') } },
      { label: 'Hauptmenü', onClick: () => { stopGame(); showScreen('menu') } },
    ],
  })
  for (const m of unlocked) state.unlockedSeen.add(m.id)
}

state.unlockedSeen = new Set(MAPS.filter((m) => isUnlocked(m)).map((m) => m.id))
function wasUnlockedBefore(m) { return state.unlockedSeen.has(m.id) }

function stopGame() {
  loop.stop()
  for (const d of state.detachers) d()
  state.detachers = []
  state.game = null
  closeModal(true)
}

function isUnlocked(map) {
  if (!map.unlock) return true
  return storage.mapProgress(map.unlock.map).highestWave >= map.unlock.wave
}

// ---------- Aktionen ----------
const actions = {
  togglePause() {
    if (!state.game || state.game.status !== 'playing') return
    setPaused(!loop.paused)
  },
  nextWave() {
    const g = state.game
    if (!g) return
    sfx.unlock()
    const r = g.callNextWave()
    if (!r.ok) { toast(r.reason, 'error'); sfx.play('error'); return }
    if (r.bonus) toast(`Früher gestartet: +${r.bonus} Gold`, 'good')
    if (loop.paused) setPaused(false)
  },
  cycleSpeed() {
    const i = SIM.speeds.indexOf(loop.speed)
    loop.speed = SIM.speeds[(i + 1) % SIM.speeds.length]
    hud.update(state.game, loop)
  },
  sell() { if (controller.sel.tower) panel.requestSell() },
  openMenu() { openPauseMenu() },
}

$('#btn-next').addEventListener('click', actions.nextWave)
$('#btn-speed').addEventListener('click', actions.cycleSpeed)
$('#btn-pause').addEventListener('click', actions.togglePause)
$('#btn-menu').addEventListener('click', () => openPauseMenu())
$('#pause-banner').addEventListener('click', () => setPaused(false))
// Mausklicks auf Spielknöpfe sollen den Fokus nicht verschieben – sonst würde die Leertaste
// danach den zuletzt geklickten Knopf erneut auslösen statt zu pausieren
$('#screen-game').addEventListener('mousedown', (e) => { if (e.target.closest('button')) e.preventDefault() })
setupPointer(canvas, renderer, controller)
setupKeyboard({ isActive: () => state.screen === 'game' && !!state.game, controller, actions })
// Audio darf erst nach einer Nutzeraktion starten
addEventListener('pointerdown', () => sfx.unlock(), { capture: true })
addEventListener('keydown', () => sfx.unlock(), { capture: true })
addEventListener('resize', () => renderer.resize())
new ResizeObserver(() => renderer.resize()).observe($('#stage'))

document.addEventListener('visibilitychange', () => {
  if (document.hidden && state.game && state.screen === 'game' && settings.autoPause && state.game.status === 'playing') {
    setPaused(true)
  }
})

function openPauseMenu() {
  if (!state.game) return
  const wasPaused = loop.paused
  setPaused(true, false)
  $('#pause-banner').hidden = true
  const g = state.game
  openModal({
    title: 'Pause',
    body: `<p><b>${esc(g.map.name)}</b> · ${g.difficulty.name} · Welle ${g.wave}/${g.totalWaves}</p>
      <p class="muted small">${g.canSnapshot() ? 'Dein Spielstand ist gespeichert.' : 'Gespeichert ist der Stand vor dieser Welle. Beim Fortsetzen startet die Welle neu.'}</p>`,
    actions: [
      { label: 'Weiterspielen', primary: true, onClick: () => setPaused(wasPaused && state.pausedByUser) },
      { label: 'Anleitung', onClick: () => { showHowTo(() => openPauseMenu()); return true } },
      { label: 'Einstellungen', onClick: () => { showSettings(() => openPauseMenu()); return true } },
      { label: 'Neu starten', onClick: () => { confirmBox('Partie neu starten?', 'Der aktuelle Fortschritt dieser Partie geht verloren.', () => { storage.clearSave(); startGame({ mapId: g.map.id, difficulty: g.difficulty.id }) }, () => openPauseMenu()); return true } },
      { label: 'Hauptmenü', onClick: () => { autosave(); stopGame(); showScreen('menu') } },
    ],
    onClose: () => setPaused(wasPaused && state.pausedByUser),
  })
}

function confirmBox(title, text, yes, no) {
  openModal({
    title,
    body: `<p>${esc(text)}</p>`,
    actions: [
      { label: 'Ja', danger: true, onClick: () => { closeModal(true); yes(); return true } },
      { label: 'Abbrechen', primary: true, onClick: () => { closeModal(true); no?.(); return true } },
    ],
    onClose: () => no?.(),
  })
}

// ---------- Menüs ----------
function refreshMenu() {
  const save = storage.loadSave()
  const btn = $('#btn-continue')
  if (save && save.v === 1 && MAPS.some((m) => m.id === save.mapId)) {
    btn.hidden = false
    btn.querySelector('small').textContent = `${getMap(save.mapId).name} · ${DIFFICULTIES[save.difficulty]?.name || ''} · Welle ${save.wave + 1}`
  } else btn.hidden = true
  $('#storage-warning').hidden = storage.persistent
}

function renderMaps() {
  const list = $('#map-list')
  list.innerHTML = ''
  for (const m of MAPS) {
    const p = storage.mapProgress(m.id)
    const unlocked = isUnlocked(m)
    const card = document.createElement('button')
    card.className = `map-card ${unlocked ? '' : 'locked'} ${state.mapId === m.id ? 'selected' : ''}`
    card.setAttribute('aria-pressed', state.mapId === m.id)
    card.innerHTML = `<canvas class="map-thumb" width="320" height="180" aria-hidden="true"></canvas>
      <div class="map-text"><h3>${esc(m.name)} <span class="tag">${esc(m.difficultyHint)}</span></h3>
      <p>${esc(m.subtitle)}</p>
      <p class="muted small">${unlocked
        ? `Beste Welle: ${p.highestWave}/20 · Bestleistung: ${num(p.bestScore)} · Siege: ${p.wins}`
        : `Gesperrt – erreiche Welle ${m.unlock.wave} auf ${esc(getMap(m.unlock.map).name)}`}</p></div>`
    drawThumb(card.querySelector('canvas'), m)
    card.addEventListener('click', () => {
      if (!unlocked) { toast(`Erreiche zuerst Welle ${m.unlock.wave} auf ${getMap(m.unlock.map).name}.`, 'error'); return }
      state.mapId = m.id
      renderMaps()
    })
    list.appendChild(card)
  }
  const dl = $('#difficulty')
  dl.innerHTML = Object.values(DIFFICULTIES).map((d) => `<label class="diff ${state.difficulty === d.id ? 'on' : ''}">
    <input type="radio" name="difficulty" value="${d.id}" ${state.difficulty === d.id ? 'checked' : ''}>
    <b>${d.name}</b><span>${d.lives} Leben · ${esc(d.description)}</span></label>`).join('')
  dl.querySelectorAll('input').forEach((i) => i.addEventListener('change', () => { state.difficulty = i.value; renderMaps() }))
}

// Kleine Kartenvorschau: Route und Bauplätze
function drawThumb(c, map) {
  const g = new Game({ mapId: map.id })
  const ctx = c.getContext('2d')
  const s = c.width / 1280
  ctx.fillStyle = map.palette.grass
  ctx.fillRect(0, 0, c.width, c.height)
  ctx.scale(s, s)
  ctx.strokeStyle = map.palette.pathEdge
  ctx.lineWidth = map.pathWidth + 8
  ctx.lineJoin = ctx.lineCap = 'round'
  const line = (r) => { ctx.beginPath(); r.points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke() }
  g.routes.forEach(line)
  ctx.strokeStyle = map.palette.path
  ctx.lineWidth = map.pathWidth
  g.routes.forEach(line)
  ctx.fillStyle = '#d8cdb4'
  for (const sp of g.spots) { ctx.beginPath(); ctx.arc(sp.x, sp.y, 20, 0, Math.PI * 2); ctx.fill() }
  ctx.fillStyle = '#b8473a'
  ctx.fillRect(map.base.x - 40, map.base.y - 40, 80, 80)
}

$('#btn-play').addEventListener('click', () => showScreen('maps'))
$('#btn-continue').addEventListener('click', () => {
  const save = storage.loadSave()
  if (save) startGame({ snapshot: save })
})
$('#btn-start').addEventListener('click', () => {
  const save = storage.loadSave()
  const go = () => { storage.clearSave(); startGame({ mapId: state.mapId, difficulty: state.difficulty }) }
  if (save) confirmBox('Neue Partie beginnen?', `Dein gespeicherter Spielstand (${getMap(save.mapId).name}, Welle ${save.wave + 1}) wird dabei überschrieben.`, go)
  else go()
})
$('#btn-maps-back').addEventListener('click', () => showScreen('menu'))
$('#btn-howto').addEventListener('click', () => showHowTo())
$('#btn-settings').addEventListener('click', () => showSettings())
$('#btn-stats').addEventListener('click', () => showStats())

// ---------- Anleitung ----------
const INTRO = `<ol class="intro-steps">
  <li><b>Ziel:</b> Gegner laufen den Weg entlang zur Bastion. Jeder, der ankommt, kostet Leben. Überstehe alle 20 Wellen.</li>
  <li><b>Bauen:</b> Tippe auf eine runde Steinplatte am Weg und wähle einen Turm. Gold bekommst du für besiegte Gegner.</li>
  <li><b>Verbessern:</b> Tippe auf einen Turm, um ihn zu verbessern, seine Zielwahl zu ändern oder ihn zu verkaufen.</li>
  <li><b>Kombinieren:</b> Frost vor Kanonen hält Gruppen im Explosionsradius. Scharfschützen gegen Bosse, Gift gegen Gepanzerte, Blitz gegen Schwärme.</li>
  <li><b>Tempo:</b> Starte die erste Welle, wenn du bereit bist. Wer die nächste Welle früher ruft, bekommt Bonusgold.</li>
</ol>`

function showIntro(first) {
  const wasPaused = loop.paused
  setPaused(true, false)
  $('#pause-banner').hidden = true
  openModal({
    title: 'Willkommen, Kommandant!',
    body: INTRO + '<p class="muted small">Tasten: 1–8 Turm wählen · Leertaste Pause · N nächste Welle · F Tempo · U verbessern · V verkaufen · T Zielwahl · Pfeiltasten Bauplätze</p>',
    actions: [{ label: 'Los geht’s', primary: true }],
    onClose: () => {
      if (first) { settings.introSeen = true; applySettings() }
      setPaused(wasPaused && state.pausedByUser)
    },
  })
}

function showHowTo(back) {
  const towers = TOWER_ORDER.map((t) => `<li><span data-ticon="${t}"></span><div><b>${TOWERS[t].name}</b> · ${TOWERS[t].levels[0].cost} G<br><span class="muted">${esc(TOWERS[t].description)}</span></div></li>`).join('')
  const enemies = ENEMY_ORDER.map((t) => `<li><span data-eicon="${t}"></span><div><b>${ENEMIES[t].name}</b>${ENEMIES[t].boss ? ' <span class="boss-tag">Boss</span>' : ''}<br><span class="muted">${esc(ENEMIES[t].description)}</span></div></li>`).join('')
  const el = openModal({
    title: 'Anleitung',
    className: 'wide',
    body: `${INTRO}<h3>Türme</h3><ul class="codex">${towers}</ul><h3>Gegner</h3><ul class="codex">${enemies}</ul>
      <h3>Steuerung</h3><p>Maus oder Finger: Bauplatz antippen, Turm wählen, nochmal antippen zum Bauen. Rechtsklick hebt die Auswahl auf.<br>
      Tastatur: 1–8 Turm · Pfeiltasten Bauplatz · Enter bauen/verbessern · U verbessern · V verkaufen · T Zielwahl · Leertaste Pause · N nächste Welle · F Tempo · Esc Menü</p>
      <h3>Offline spielen &amp; installieren</h3>
      <p>Das Spiel speichert sich beim ersten Öffnen komplett auf deinem Gerät. Danach läuft es ohne Internet. Installieren: im Browsermenü „App installieren“ bzw. „Zum Home-Bildschirm“ (Safari: Teilen → Zum Home-Bildschirm).</p>`,
    actions: [{ label: back ? 'Zurück' : 'Schließen', primary: true, onClick: () => { if (back) { back(); return true } } }],
    onClose: () => back?.(),
  })
  el.querySelectorAll('[data-ticon]').forEach((s) => s.replaceWith(makeIcon(44, (c) => drawTowerIcon(c, s.dataset.ticon))))
  el.querySelectorAll('[data-eicon]').forEach((s) => s.replaceWith(makeIcon(36, (c) => drawEnemyIcon(c, s.dataset.eicon))))
}

function makeIcon(size, draw) {
  const c = document.createElement('canvas')
  const d = Math.min(2, devicePixelRatio || 1)
  c.width = c.height = size * d
  c.style.width = c.style.height = `${size}px`
  draw(c)
  return c
}

// ---------- Einstellungen ----------
function showSettings(back) {
  const el = openModal({
    title: 'Einstellungen',
    body: `<form class="settings" onsubmit="return false">
      <label class="row"><span>Sound</span><input type="checkbox" name="sound" ${settings.sound ? 'checked' : ''}></label>
      <label class="row"><span>Lautstärke</span><input type="range" name="volume" min="0" max="1" step="0.05" value="${settings.volume}"></label>
      <label class="row"><span>Reduzierte Bewegung</span><select name="reducedMotion">
        <option value="auto" ${settings.reducedMotion === 'auto' ? 'selected' : ''}>Wie im System${motionQuery.matches ? ' (an)' : ' (aus)'}</option>
        <option value="on" ${settings.reducedMotion === 'on' ? 'selected' : ''}>An</option>
        <option value="off" ${settings.reducedMotion === 'off' ? 'selected' : ''}>Aus</option></select></label>
      <label class="row"><span>Starttempo</span><select name="defaultSpeed">${SIM.speeds.map((s) => `<option value="${s}" ${settings.defaultSpeed === s ? 'selected' : ''}>${s}×</option>`).join('')}</select></label>
      <label class="row"><span>Reichweite aller Türme zeigen</span><input type="checkbox" name="showAllRanges" ${settings.showAllRanges ? 'checked' : ''}></label>
      <label class="row"><span>Verkauf bestätigen</span><input type="checkbox" name="confirmSell" ${settings.confirmSell ? 'checked' : ''}></label>
      <label class="row"><span>Pause, wenn das Fenster verdeckt ist</span><input type="checkbox" name="autoPause" ${settings.autoPause ? 'checked' : ''}></label>
      <p class="muted small">Alles wird nur lokal in diesem Browser gespeichert.${storage.persistent ? '' : ' <b>Achtung:</b> Der Browser erlaubt gerade kein dauerhaftes Speichern (privater Modus?).'}</p>
      <button type="button" class="btn danger" data-reset>Statistiken &amp; Einstellungen zurücksetzen</button>
    </form>`,
    actions: [{ label: back ? 'Zurück' : 'Fertig', primary: true, onClick: () => { if (back) { back(); return true } } }],
    onClose: () => back?.(),
  })
  const form = el.querySelector('form')
  form.addEventListener('input', () => {
    settings.sound = form.sound.checked
    settings.volume = Number(form.volume.value)
    settings.reducedMotion = form.reducedMotion.value
    settings.defaultSpeed = Number(form.defaultSpeed.value)
    settings.showAllRanges = form.showAllRanges.checked
    settings.confirmSell = form.confirmSell.checked
    settings.autoPause = form.autoPause.checked
    applySettings()
    sfx.unlock()
    if (settings.sound) sfx.play('click')
  })
  form.querySelector('[data-reset]').addEventListener('click', () => {
    confirmBox('Wirklich alles zurücksetzen?', 'Bestleistungen, freigeschaltete Karten, Einstellungen und der gespeicherte Spielstand werden gelöscht.', () => {
      storage.resetAll()
      settings = storage.loadSettings()
      state.unlockedSeen = new Set(MAPS.filter((m) => !m.unlock).map((m) => m.id))
      applySettings()
      toast('Alles zurückgesetzt.')
      if (state.screen === 'menu') refreshMenu()
      showSettings(back)
    }, () => showSettings(back))
  })
}

function showStats() {
  const p = storage.loadProgress()
  const rows = MAPS.map((m) => {
    const s = storage.mapProgress(m.id)
    const diffs = Object.values(DIFFICULTIES).map((d) => {
      const b = s.bestByDifficulty?.[d.id]
      return `${d.name}: ${b ? `${num(b.score)}${b.won ? ' ✓' : ''}` : '–'}`
    }).join(' · ')
    return `<div class="stat-card"><h3>${esc(m.name)}</h3>
      <dl class="result-stats"><div><dt>Höchste Welle</dt><dd>${s.highestWave}/20</dd></div>
      <div><dt>Bestleistung</dt><dd>${num(s.bestScore)}</dd></div>
      <div><dt>Siege / Partien</dt><dd>${s.wins} / ${s.games}</dd></div></dl>
      <p class="muted small">${diffs}</p></div>`
  }).join('')
  openModal({
    title: 'Statistik',
    body: `${rows}<p class="muted">Insgesamt: ${p.totals.games} Partien · ${p.totals.wins} Siege · ${num(p.totals.kills)} besiegte Gegner</p>`,
    actions: [{ label: 'Schließen', primary: true }],
  })
}

// ---------- PWA ----------
const pwa = setupPwa({
  onStatus: (s) => {
    const el = $('#offline-status')
    const parts = []
    if (s.sw === 'bereit') parts.push('✓ Offline spielbar')
    else if (s.sw === 'wird eingerichtet') parts.push('Wird für offline vorbereitet …')
    else if (s.sw === 'fehlgeschlagen') parts.push('Offline-Modus nicht verfügbar')
    else parts.push(`Offline-Modus: ${s.sw}`)
    if (!s.online) parts.push('gerade ohne Internet')
    if (s.installed) parts.push('als App installiert')
    el.textContent = parts.join(' · ')
    el.classList.toggle('ok', s.sw === 'bereit')
  },
  onInstallable: (yes) => { $('#btn-install').hidden = !yes },
  onUpdate: () => toast('Neue Version geladen – sie ist beim nächsten Start aktiv.'),
})
$('#btn-install').addEventListener('click', () => pwa.install())

// ---------- Start ----------
applySettings()
showScreen('menu')
// Für automatisierte Tests im Browser
window.__towerfall = { get game() { return state.game }, loop, controller, storage, startGame }
