// Tastenkürzel für die Turmauswahl. Gezählt werden physische Tasten (KeyboardEvent.code), damit sie
// auf jedem Tastaturlayout an derselben Stelle liegen: 1–9, 0 und die beiden Tasten rechts daneben
// (deutsche Tastatur: ß und ´). Der Ziffernblock wählt die ersten zehn Türme.
const CODES = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0', 'Minus', 'Equal']
const NUMPAD = ['Numpad1', 'Numpad2', 'Numpad3', 'Numpad4', 'Numpad5', 'Numpad6', 'Numpad7', 'Numpad8', 'Numpad9', 'Numpad0']

const german = () => /^de\b/i.test(globalThis.navigator?.language || 'de')
const fallbackLabel = (code) => code.startsWith('Digit') ? code.slice(5) : german() ? { Minus: 'ß', Equal: '´' }[code] : { Minus: '-', Equal: '=' }[code]

export const SHOP_KEYS = CODES.map((code) => ({ code, label: fallbackLabel(code) }))

// Index des Turms zu einer Taste (−1: keine Turmtaste)
export function shopIndexForCode(code) {
  const i = CODES.indexOf(code)
  return i >= 0 ? i : NUMPAD.indexOf(code)
}

// Beschriftung an das tatsächliche Tastaturlayout anpassen, wo der Browser es verrät (Chromium).
// Gibt true zurück, wenn sich etwas geändert hat.
export async function refineKeyLabels() {
  try {
    const map = await globalThis.navigator?.keyboard?.getLayoutMap?.()
    if (!map) return false
    let changed = false
    for (const k of SHOP_KEYS) {
      const label = map.get(k.code)
      if (label && label !== k.label) { k.label = label; changed = true }
    }
    return changed
  } catch {
    return false
  }
}
