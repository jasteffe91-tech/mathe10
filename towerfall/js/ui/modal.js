// Einfache Dialoge (Pause, Einstellungen, Sieg/Niederlage …) mit Fokusführung und Esc zum Schließen.
const root = () => document.getElementById('modal-root')
let current = null

export function openModal({ title, body = '', actions = [], dismissible = true, className = '', onClose = null }) {
  closeModal(true)
  const wrap = document.createElement('div')
  wrap.className = 'modal-backdrop'
  wrap.innerHTML = `<div class="modal ${className}" role="dialog" aria-modal="true" aria-labelledby="modal-title">
    <h2 id="modal-title">${title}</h2>
    <div class="modal-body">${body}</div>
    <div class="modal-actions"></div>
  </div>`
  const bar = wrap.querySelector('.modal-actions')
  for (const a of actions) {
    const b = document.createElement('button')
    b.className = `btn ${a.primary ? 'primary' : ''} ${a.danger ? 'danger' : ''}`
    b.textContent = a.label
    b.addEventListener('click', () => {
      const keep = a.onClick?.(wrap)
      if (keep !== true) closeModal()
    })
    bar.appendChild(b)
  }
  if (dismissible) {
    wrap.addEventListener('click', (e) => { if (e.target === wrap) closeModal() })
  }
  root().appendChild(wrap)
  current = { el: wrap, dismissible, onClose, previous: document.activeElement }
  const focusable = wrap.querySelector('.modal-actions .primary') || wrap.querySelector('button, input, select')
  focusable?.focus({ preventScroll: true })
  return wrap
}

export function closeModal(silent = false) {
  if (!current) return
  const { el, onClose, previous } = current
  current = null
  el.remove()
  if (!silent) onClose?.()
  if (previous && previous.focus && document.contains(previous)) previous.focus({ preventScroll: true })
}

export const modalOpen = () => !!current

export function handleModalKey(e) {
  if (!current) return false
  if (e.key === 'Escape' && current.dismissible) { closeModal(); return true }
  return true // Modal offen: Spieltasten ignorieren
}
