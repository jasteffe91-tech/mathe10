'use strict';
/** Fiktive Beispieldaten ausschließlich für Tests und Vorschau (keine echten Rückmeldungen). */
const crypto = require('crypto');

const DEMO = [
  { classLabel: '8a', answers: { q1: 'sehr_gelungen', q2: 'ja_voll', q2_text: 'Die Mitarbeiterinnen waren sehr zugewandt und haben die Klasse auf Augenhöhe angesprochen.', q3: 'angemessen', q4: 'sehr_hoch', q5: 'ja_anpassung', q5_text: 'Für Jahrgang 7 müssten die Beispiele jünger und alltagsnäher sein, außerdem mehr Pausen.', q6: 'sehr_gross', q7: 'ueberwiegend', q8: 'sehr_gut', q9: 'sehr_gelungen', q10: 'Etwas mehr Zeit für die Gruppenarbeit einplanen, die Diskussion war am Ende zu kurz.', q11: 'Ein Termin im ersten Halbjahr wäre besser, da im zweiten Halbjahr viele Klassenarbeiten anstehen.', q12: 'unbedingt', q13: 'Die vertrauensvolle Atmosphäre und die Rollenspiele.' } },
  { classLabel: '8b', answers: { q1: 'eher_gelungen', q2: 'ja_anpassung', q2_text: 'Inhaltlich gut, aber die Methoden waren teilweise sehr frontal.', q3: 'angemessen', q4: 'eher_hoch', q5: 'nein_j8', q6: 'eher_gross', q7: 'unterschiedlich', q8: 'gut', q9: 'teilweise', q10: 'Mehr interaktive Methoden und weniger Vortrag. Die Präsentation war lang.', q11: 'Die Klassenleitungen sollten vorab Material zur Vorbereitung erhalten, damit wir das Thema im Unterricht aufgreifen können.', q12: 'ja_anpassung', q13: 'Offene Fragerunde, die Schülerinnen und Schüler haben sich getraut, persönliche Fragen zu stellen.' } },
  { classLabel: null, answers: { q1: 'sehr_gelungen', q2: 'ja_voll', q3: 'angemessen', q4: 'sehr_hoch', q5: 'ja_anpassung', q5_text: 'Sprache vereinfachen.', q6: 'sehr_gross', q7: 'sehr_aktiv', q8: 'sehr_gut', q9: 'eher_gelungen', q11: 'Bitte rechtzeitig über den Ablauf informieren; die Vertretung war kurzfristig geregelt.', q12: 'unbedingt', q14: 'Vielen Dank an das Team – gerne wieder!' } },
  { classLabel: '8d', answers: { q1: 'teils', q2: 'bedingt', q2_text: 'Für meine Klasse war der Anspruch zu hoch, viele konnten den Inhalten nicht folgen.', q3: 'eher_hoch', q4: 'mittel', q5: 'nein_j8', q6: 'unterschiedlich', q7: 'zurueckhaltend', q8: 'teilweise', q9: 'teilweise', q10: 'Gruppengröße verkleinern, vielleicht Jungen und Mädchen getrennt. Erklärungen verständlicher gestalten.', q11: 'Eine Doppelstunde reicht nicht, besser zwei Termine mit Nachbereitung im Unterricht.', q12: 'ja_anpassung' } },
  { classLabel: null, answers: { q1: 'eher_gelungen', q2: 'ja_anpassung', q3: 'angemessen', q4: 'eher_hoch', q5: 'nb', q6: 'eher_gross', q7: 'ueberwiegend', q8: 'gut', q9: 'eher_gelungen', q10: 'Mehr Zeit für Fragen der Schülerinnen und Schüler.', q12: 'ja_anpassung', q13: 'Die Mitarbeiterinnen waren kompetent und sympathisch.', q14: 'Die Raumfrage sollte vorher geklärt werden.' } },
  { classLabel: '8f', answers: { q1: 'sehr_gelungen', q2: 'ja_voll', q3: 'eher_niedrig', q4: 'eher_hoch', q5: 'ja_ohne', q6: 'sehr_gross', q7: 'sehr_aktiv', q8: 'sehr_gut', q9: 'sehr_gelungen', q12: 'unbedingt', q13: 'Abwechslungsreiche Methoden, lebensnahe Beispiele, Übungen zum Mitmachen.' } },
  { classLabel: null, answers: { q1: 'eher_gelungen', q2: 'ja_anpassung', q3: 'angemessen', q4: 'nb', q5: 'ja_anpassung', q5_text: 'Inhalte altersgerecht reduzieren, mehr spielerische Elemente.', q6: 'nb', q7: 'nb', q8: 'nb', q9: 'nb', q10: 'Da ich nicht durchgehend anwesend war, kann ich die Methoden nur teilweise beurteilen.', q11: 'Klassenleitung sollte während der gesamten Veranstaltung anwesend sein können – bitte bei der Stundenplanung berücksichtigen.', q12: 'nb' } },
];

function demoResponses() {
  return DEMO.map((d) => ({ submissionToken: crypto.randomUUID(), classLabel: d.classLabel, answers: d.answers }));
}

module.exports = { demoResponses, DEMO };
