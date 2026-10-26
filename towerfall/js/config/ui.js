// Einstellungen der Bedienoberfläche, die sich zentral feinjustieren lassen.

// Lupe beim Platzieren (Touch und Tastatur). Alle Längen in CSS-Pixeln.
//   width/height   Größe des Lupenfensters (gleich = rund, sonst abgerundetes Rechteck)
//   zoom           Vergrößerung gegenüber der Karte auf dem Bildschirm (Inhalt = Fenster / zoom)
//   offsetX/Y      Abstand der Fensterecke zum Berührungspunkt bei schräger Lage (links oben usw.)
//   fingerRadius   Bereich um den Berührungspunkt, den die Lupe nie verdeckt (Fingerkuppe)
//   edgePadding    Mindestabstand zum Rand des Spielfelds (das Spielfeld liegt bereits innerhalb der
//                  Safe Areas, also nicht unter Notch oder Home-Indikator)
//   hysteresis     Die Lupe wechselt erst zurück auf eine bevorzugte Seite, wenn dort so viel Platz
//                  übrig ist – verhindert Hin- und Herspringen bei kleinen Fingerbewegungen
//   keyboardOffset Abstand zur Vorschau bei Tastaturbedienung (kein Finger im Weg)
//   preferred      Reihenfolge der Positionen je Hand. Rechtshänder: der Finger kommt von rechts unten,
//                  also zuerst links oberhalb, dann links, dann oberhalb; rechts/unten nur als Ausweg.
//   sizes          Größenstufen für die Einstellung „Lupengröße“ (Faktor auf width/height)
//   maxShare       Obergrenze relativ zur kürzeren Spielfeldseite, damit die Lupe auf kleinen
//                  Bildschirmen nicht zu viel Karte verdeckt
export const MAGNIFIER = {
  width: 164,          // vorher 132 (+24 %)
  height: 164,
  zoom: 2.4,           // vorher 2,2 – Zellen in der Lupe etwa 9 % größer
  borderWidth: 3,
  offsetX: 26,
  offsetY: 26,
  fingerRadius: 30,
  edgePadding: 6,
  hysteresis: 18,
  keyboardOffset: 14,
  preferred: {
    right: ['top-left', 'left', 'top', 'top-right', 'right', 'bottom-left', 'bottom', 'bottom-right'],
    left: ['top-right', 'right', 'top', 'top-left', 'left', 'bottom-right', 'bottom', 'bottom-left'],
  },
  sizes: { normal: 1, large: 1.2 },
  maxShare: 0.45,      // höchstens dieser Anteil der kürzeren Spielfeldseite (kleine Bildschirme)
}
