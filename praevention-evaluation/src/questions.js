'use strict';
/**
 * Fragebogen-Definition (einzige Quelle für Formular, Validierung, Auswertung und PDF).
 *
 * tone: Einordnung für Farbgebung und Kennzahlen
 *   pos = zustimmend/positiv, mid = mittel/teils, neg = ablehnend/negativ, nb = nicht beurteilbar
 * Antworten mit tone "nb" werden bei Prozentwerten gesondert behandelt
 * (Prozentbasis = gültige Antworten ohne „nicht beurteilbar“).
 */

const META = {
  title: 'Evaluation des Präventionsangebots – Jugendhilfe der Stadt Voerde',
  reportTitle: 'Auswertung der Evaluation – Präventionsangebot der Jugendhilfe der Stadt Voerde',
  school: 'Comenius-Gesamtschule Voerde',
  department: 'Abteilung II (Jahrgänge 7 und 8)',
  departmentShort: 'Abteilung II',
  audience: 'Klassenleitungen des 8. Jahrgangs',
  responsible: 'WIDE (BL Abt. II)',
  provider: 'Jugendhilfe der Stadt Voerde',
};

const SECTIONS = [
  { id: 'A', title: 'Gesamteindruck' },
  { id: 'B', title: 'Altersangemessenheit und pädagogischer Nutzen' },
  { id: 'C', title: 'Interesse und Beteiligung der Schülerinnen und Schüler' },
  { id: 'D', title: 'Qualität der Durchführung' },
  { id: 'E', title: 'Schulische Organisation und zukünftige Durchführung' },
];

const o = (value, label, tone) => ({ value, label, tone });

const QUESTIONS = [
  {
    id: 'q1', number: 1, section: 'A', type: 'single', required: true,
    text: 'Wie bewertest du das Präventionsangebot insgesamt?',
    options: [
      o('sehr_gelungen', 'Sehr gelungen', 'pos'),
      o('eher_gelungen', 'Eher gelungen', 'pos'),
      o('teils', 'Teils gelungen, teils nicht gelungen', 'mid'),
      o('eher_nicht', 'Eher nicht gelungen', 'neg'),
      o('gar_nicht', 'Überhaupt nicht gelungen', 'neg'),
    ],
  },
  {
    id: 'q2', number: 2, section: 'A', type: 'single', required: true, keyQuestion: true,
    text: 'Würdest du das Präventionsangebot anderen Klassenleitungen weiterempfehlen?',
    options: [
      o('ja_voll', 'Ja, uneingeschränkt', 'pos'),
      o('ja_anpassung', 'Ja, mit kleineren Anpassungen', 'pos'),
      o('bedingt', 'Nur bedingt', 'mid'),
      o('nein', 'Nein', 'neg'),
    ],
    followUp: { id: 'q2_text', label: 'Bitte begründe deine Einschätzung.', optional: true },
  },
  {
    id: 'q3', number: 3, section: 'B', type: 'single', required: true, keyQuestion: true,
    text: 'War der inhaltliche Anspruch des Präventionsangebots für Schülerinnen und Schüler des 8. Jahrgangs angemessen?',
    options: [
      o('deutlich_niedrig', 'Deutlich zu niedrig', 'neg'),
      o('eher_niedrig', 'Eher zu niedrig', 'mid'),
      o('angemessen', 'Genau angemessen', 'pos'),
      o('eher_hoch', 'Eher zu hoch', 'mid'),
      o('deutlich_hoch', 'Deutlich zu hoch', 'neg'),
    ],
  },
  {
    id: 'q4', number: 4, section: 'B', type: 'single', required: true,
    text: 'Wie schätzt du den pädagogischen Nutzen des Präventionsangebots für deine Klasse ein?',
    options: [
      o('sehr_hoch', 'Sehr hoch', 'pos'),
      o('eher_hoch', 'Eher hoch', 'pos'),
      o('mittel', 'Mittel', 'mid'),
      o('eher_gering', 'Eher gering', 'neg'),
      o('sehr_gering', 'Sehr gering', 'neg'),
      o('nb', 'Nicht beurteilbar', 'nb'),
    ],
  },
  {
    id: 'q5', number: 5, section: 'B', type: 'single', required: true, keyQuestion: true,
    text: 'Könntest du dir vorstellen, das Präventionsangebot bereits im 7. Jahrgang durchzuführen?',
    options: [
      o('ja_ohne', 'Ja, ohne wesentliche Veränderungen', 'pos'),
      o('ja_anpassung', 'Ja, mit altersgerechten Anpassungen', 'pos'),
      o('nein_j8', 'Nein, Jahrgang 8 ist besser geeignet', 'mid'),
      o('nein_ungeeignet', 'Nein, auch für Jahrgang 8 nicht geeignet', 'neg'),
      o('nb', 'Kann ich nicht beurteilen', 'nb'),
    ],
    followUp: { id: 'q5_text', label: 'Welche Anpassungen wären gegebenenfalls erforderlich?', optional: true },
  },
  {
    id: 'q6', number: 6, section: 'C', type: 'single', required: true,
    text: 'Wie groß war nach deiner Beobachtung das Interesse der Schülerinnen und Schüler am Präventionsangebot?',
    options: [
      o('sehr_gross', 'Sehr groß', 'pos'),
      o('eher_gross', 'Eher groß', 'pos'),
      o('unterschiedlich', 'Unterschiedlich', 'mid'),
      o('eher_gering', 'Eher gering', 'neg'),
      o('sehr_gering', 'Sehr gering', 'neg'),
      o('nb', 'Nicht beurteilbar', 'nb'),
    ],
  },
  {
    id: 'q7', number: 7, section: 'C', type: 'single', required: true,
    text: 'Wie hast du die aktive Beteiligung der Schülerinnen und Schüler wahrgenommen?',
    options: [
      o('sehr_aktiv', 'Sehr aktiv', 'pos'),
      o('ueberwiegend', 'Überwiegend aktiv', 'pos'),
      o('unterschiedlich', 'Unterschiedlich', 'mid'),
      o('zurueckhaltend', 'Eher zurückhaltend', 'neg'),
      o('kaum', 'Kaum beteiligt', 'neg'),
      o('nb', 'Nicht beurteilbar', 'nb'),
    ],
  },
  {
    id: 'q8', number: 8, section: 'C', type: 'single', required: true,
    text: 'Wie gut gelang es den Mitarbeiterinnen, die Schülerinnen und Schüler anzusprechen und in die Veranstaltung einzubeziehen?',
    options: [
      o('sehr_gut', 'Sehr gut', 'pos'),
      o('gut', 'Gut', 'pos'),
      o('teilweise', 'Teilweise', 'mid'),
      o('weniger_gut', 'Weniger gut', 'neg'),
      o('gar_nicht', 'Überhaupt nicht', 'neg'),
      o('nb', 'Nicht beurteilbar', 'nb'),
    ],
  },
  {
    id: 'q9', number: 9, section: 'D', type: 'single', required: true,
    text: 'Wie bewertest du die methodische Gestaltung des Präventionsangebots?',
    options: [
      o('sehr_gelungen', 'Sehr gelungen', 'pos'),
      o('eher_gelungen', 'Eher gelungen', 'pos'),
      o('teilweise', 'Teilweise gelungen', 'mid'),
      o('eher_nicht', 'Eher nicht gelungen', 'neg'),
      o('nicht', 'Nicht gelungen', 'neg'),
      o('nb', 'Nicht beurteilbar', 'nb'),
    ],
  },
  {
    id: 'q10', number: 10, section: 'D', type: 'text', required: false,
    text: 'Welche Verbesserungsvorschläge hast du für die Mitarbeiterinnen der Jugendhilfe der Stadt Voerde?',
    help: 'Denke beispielsweise an die Inhalte, Methoden, Ansprache der Schülerinnen und Schüler, Verständlichkeit, zeitliche Gestaltung oder Beteiligungsmöglichkeiten.',
  },
  {
    id: 'q11', number: 11, section: 'E', type: 'text', required: false,
    text: 'Welche Hinweise oder Verbesserungsvorschläge hast du für die Abteilungsleitung hinsichtlich der zukünftigen Organisation des Präventionsangebots?',
    help: 'Beispielsweise Zeitpunkt im Schuljahr, Jahrgangsstufe, Dauer, organisatorischer Ablauf, Vorbereitung oder Nachbereitung im Unterricht.',
  },
  {
    id: 'q12', number: 12, section: 'E', type: 'single', required: true, keyQuestion: true,
    text: 'Sollte das Präventionsangebot aus deiner Sicht langfristig als fester Bestandteil des Präventionskonzepts der Abteilung II etabliert werden?',
    options: [
      o('unbedingt', 'Ja, unbedingt', 'pos'),
      o('ja_anpassung', 'Ja, mit kleineren Anpassungen', 'pos'),
      o('ueberarbeitung', 'Nur nach grundlegender Überarbeitung', 'mid'),
      o('nein', 'Nein', 'neg'),
      o('nb', 'Kann ich derzeit nicht beurteilen', 'nb'),
    ],
  },
  {
    id: 'q13', number: 13, section: 'E', type: 'text', required: false,
    text: 'Was war aus deiner Sicht besonders gelungen?',
  },
  {
    id: 'q14', number: 14, section: 'E', type: 'text', required: false,
    text: 'Gibt es weitere Anmerkungen?',
  },
];

const TEXT_MAX = 2000;
const CLASS_MAX = 12;

/** Alle Freitextfelder (eigene Fragen + Zusatzfelder) in Berichtsreihenfolge. */
function textFields() {
  const list = [];
  for (const q of QUESTIONS) {
    if (q.type === 'text') list.push({ id: q.id, number: q.number, label: q.text, parent: null });
    if (q.followUp) list.push({ id: q.followUp.id, number: q.number, label: q.followUp.label, parent: q.id });
  }
  return list;
}

function getQuestion(id) {
  return QUESTIONS.find((q) => q.id === id);
}

/** Öffentliche, serialisierbare Form der Definition für das Frontend. */
function publicDefinition() {
  return { meta: META, sections: SECTIONS, questions: QUESTIONS, limits: { text: TEXT_MAX, classLabel: CLASS_MAX } };
}

module.exports = { META, SECTIONS, QUESTIONS, TEXT_MAX, CLASS_MAX, textFields, getQuestion, publicDefinition };
