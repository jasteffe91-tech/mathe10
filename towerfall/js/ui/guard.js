// Schutz gegen hängenbleibende Browser-Zustände während des Spiels.
//
// Ursache der „blauen Markierungen“: Die Spieloberfläche war Text. Auf iPhone/iPad (Safari, auch als
// installierte App) wirkt `user-select: none` nur mit dem Präfix `-webkit-`, und das Long-Press-Menü
// (`-webkit-touch-callout`) war nicht abgeschaltet. Ein längerer Fingerdruck – beim genauen Platzieren
// ganz normal – startete die native Textauswahl; jede weitere Fingerbewegung vergrößerte sie über
// Kopfleiste, Turmleiste und Infobereich. Kein Spielcode hob die Auswahl wieder auf, und in der
// installierten App gibt es keine Browserleiste, über die man sie loswird.
//
// Behebung: CSS verhindert die Auswahl an der Quelle (style.css, #app). Dieses Modul blockiert
// zusätzlich das Starten einer Auswahl, das Kontextmenü und natives Ziehen außerhalb von Eingabefeldern
// und hebt eine dennoch entstandene Auswahl beim nächsten Tippen bzw. sofort wieder auf. Eingabefelder
// bleiben voll bedienbar.

const EDITABLE = 'input, textarea, select, [contenteditable=""], [contenteditable="true"]'
export const isEditable = (el) => !!(el && el.closest && el.closest(EDITABLE))

// Auswahl aufheben, sofern sie nicht in einem Eingabefeld liegt. Gibt true zurück, wenn aufgehoben wurde.
export function clearStraySelection(doc = document) {
  const sel = doc.getSelection?.()
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return false
  const node = sel.anchorNode?.nodeType === 1 ? sel.anchorNode : sel.anchorNode?.parentElement
  if (isEditable(node) || isEditable(doc.activeElement)) return false
  sel.removeAllRanges()
  return true
}

// root: Element, in dem keine Auswahl entstehen soll (#app). onReset: Gesten zurücksetzen
// (Ziehen, Lupe, Sheet), wenn das Fenster den Fokus verliert oder in den Hintergrund geht.
export function setupInputGuard(root, { onReset = () => {} } = {}) {
  const block = (e) => { if (!isEditable(e.target)) e.preventDefault() }
  root.addEventListener('selectstart', block)
  root.addEventListener('dragstart', block)
  // Long-Press-Menü (Android) bzw. Rechtsklick-Menü: im Spiel nie gebraucht, außer in Eingabefeldern
  root.addEventListener('contextmenu', block)
  // Wiederherstellung: Jede neue Berührung hebt eine eventuell hängende Auswahl auf …
  root.addEventListener('pointerdown', (e) => { if (!isEditable(e.target)) clearStraySelection() }, true)
  // … und eine Auswahl, die trotzdem entsteht (z. B. per Tastatur „Alles auswählen“), verschwindet sofort
  document.addEventListener('selectionchange', () => {
    const sel = document.getSelection?.()
    if (sel && !sel.isCollapsed && root.contains(sel.anchorNode)) clearStraySelection()
  })
  // Gesten, deren Ende verloren geht (Fokuswechsel, App im Hintergrund), sauber beenden
  addEventListener('blur', onReset)
  document.addEventListener('visibilitychange', () => { if (document.hidden) onReset() })
}
