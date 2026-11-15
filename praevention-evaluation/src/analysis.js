'use strict';
const { QUESTIONS, SECTIONS, META, textFields, getQuestion } = require('./questions');

/* ------------------------------------------------------------------------- */
/* Hilfsfunktionen                                                            */
/* ------------------------------------------------------------------------- */

const pct = (count, base) => (base > 0 ? (count / base) * 100 : null);
const fmtPct = (p) => (p === null || p === undefined ? '–' : `${Math.round(p)} %`);

/* ------------------------------------------------------------------------- */
/* Geschlossene Fragen                                                        */
/* ------------------------------------------------------------------------- */

function analyzeClosed(q, responses) {
  const counts = Object.fromEntries(q.options.map((op) => [op.value, 0]));
  let answered = 0;
  for (const r of responses) {
    const v = r.answers[q.id];
    if (v && Object.prototype.hasOwnProperty.call(counts, v)) {
      counts[v]++;
      answered++;
    }
  }
  const nbValues = q.options.filter((op) => op.tone === 'nb').map((op) => op.value);
  const nbCount = nbValues.reduce((s, v) => s + counts[v], 0);
  const valid = answered - nbCount; // inhaltliche Antworten (Prozentbasis)
  const options = q.options.map((op) => ({
    value: op.value,
    label: op.label,
    tone: op.tone,
    count: counts[op.value],
    // Inhaltliche Optionen: Anteil an inhaltlichen Antworten; „nicht beurteilbar“: Anteil an allen Antworten
    pct: op.tone === 'nb' ? pct(counts[op.value], answered) : pct(counts[op.value], valid),
  }));
  const toneShare = (tone) => {
    const c = q.options.filter((op) => op.tone === tone).reduce((s, op) => s + counts[op.value], 0);
    return { count: c, pct: pct(c, valid) };
  };
  return {
    id: q.id,
    number: q.number,
    section: q.section,
    text: q.text,
    keyQuestion: !!q.keyQuestion,
    hasNb: nbValues.length > 0,
    nbLabel: nbValues.length ? q.options.find((op) => op.tone === 'nb').label : null,
    answered,
    nbCount,
    nbPct: pct(nbCount, answered),
    valid,
    missing: responses.length - answered,
    options,
    shares: { pos: toneShare('pos'), mid: toneShare('mid'), neg: toneShare('neg') },
  };
}

/** Anteil bestimmter Antwortwerte an den inhaltlichen Antworten einer Frage. */
function shareOf(stats, values) {
  const count = stats.options.filter((op) => values.includes(op.value)).reduce((s, op) => s + op.count, 0);
  return { count, valid: stats.valid, pct: pct(count, stats.valid) };
}

/* ------------------------------------------------------------------------- */
/* Freitexte: transparente Themenbündelung per festgelegtem Stichwortabgleich */
/* ------------------------------------------------------------------------- */

/**
 * Jedes Thema besteht aus Stichwort-Mustern (reguläre Ausdrücke ohne Wortanfangsgrenze;
 * diese wird automatisch ergänzt). Die Zuordnung ist rein lexikalisch: Sie erkennt, DASS ein
 * Thema angesprochen wird, nicht OB positiv oder negativ. Mehrfachzuordnungen sind möglich.
 */
const THEMES = [
  { id: 'zeit', label: 'Zeitlicher Rahmen und Dauer', patterns: ['zeit(?!punkt)', 'dauer', 'länger', 'kürzer', 'zu lang\\b', 'zu kurz', 'minute', '(doppel|schul|unterrichts)?stunden?\\b', 'pausen?\\b', 'gehetzt', 'zeitdruck', 'ausführlicher'] },
  { id: 'methoden', label: 'Methoden und Interaktivität', patterns: ['method', 'interaktiv', 'gruppenarbeit', 'übung', 'rollenspiel', 'spiele?\\b', 'spielerisch', 'mitmach', 'praktisch', 'praxis', 'abwechslung', 'abwechslungsreich', 'frontal', 'vortrag', 'präsentation', 'video', 'film', 'aktivier', 'anschaulich'] },
  { id: 'inhalte', label: 'Inhalte und Themenauswahl', patterns: ['inhalt', 'themen?\\b', 'thematisch', 'informativ', 'wissen', 'fachlich', 'sachlich', 'aktuell', 'lebensnah', 'alltag', 'lebenswelt', 'realitätsnah'] },
  { id: 'ansprache', label: 'Ansprache und Verständlichkeit', patterns: ['ansprache', 'angesprochen', 'sprache', 'zugang', 'jugendgerecht', 'verständlich', 'unverständlich', 'erklär', 'augenhöhe', 'sympathisch', 'empathisch', 'kompetent', 'authentisch', 'einfühlsam', 'wertschätzend', 'zugewandt'] },
  { id: 'beteiligung', label: 'Beteiligung und Interesse der Schülerinnen und Schüler', patterns: ['beteilig', 'mitarbeit', 'einbezogen', 'einbeziehen', 'einbindung', 'eingebunden', 'motivier', 'interesse', 'interessiert', 'aufmerksam', 'zurückhaltend', 'unruhig', 'disziplin', 'mitgemacht', 'langweilig', 'langeweile'] },
  { id: 'setting', label: 'Gruppengröße und Setting', patterns: ['gruppengröße', 'kleingruppe', 'kleinere(n)? gruppe', 'geteilt', 'teilung', 'getrennt', 'jungen\\b', 'mädchen', 'geschlecht', 'klassenverband', 'halbe klasse', 'räum', 'raum', 'sitzkreis', 'stuhlkreis'] },
  { id: 'vorbereitung', label: 'Vor- und Nachbereitung im Unterricht', patterns: ['vorbereit', 'nachbereit', 'nachbesprech', 'vorab', 'im vorfeld', 'material', 'arbeitsbl', 'anknüpf', 'vertief', 'reflexion', 'reflektier', 'nachhaltig', 'weiterarbeit', 'aufgreifen'] },
  { id: 'organisation', label: 'Organisation, Absprachen und Information', patterns: ['organisat', 'absprache', 'abgesprochen', 'ablauf', 'planung', 'geplant', 'kommunikation', 'informiert', 'rechtzeitig', 'kurzfristig', 'vertretung', 'stundenplan', 'koordin', 'ansprechpart'] },
  { id: 'jahrgang', label: 'Jahrgangsstufe und Zeitpunkt im Schuljahr', patterns: ['jahrgang', 'jg\\.? ?[5-9]\\b', 'klasse [5-9]\\b', 'stufe [5-9]\\b', 'jünger', 'älter', 'zeitpunkt', 'schuljahr', 'halbjahr', 'altersstufe', 'alter\\b', 'reife'] },
  { id: 'lehrkraft', label: 'Rolle der Lehrkräfte', patterns: ['lehrkr', 'lehrer', 'klassenleit', 'anwesen'] },
  { id: 'atmosphaere', label: 'Atmosphäre und Vertrauen', patterns: ['vertrau', 'atmosphäre', 'geschützt', 'schutzraum', 'offenheit', 'ehrlich', 'sensib', 'persönlich', 'respekt'] },
];

const BOUNDARY = '(?:^|[^a-z0-9äöüß])';
const THEME_REGEX = THEMES.map((t) => ({
  ...t,
  regex: new RegExp(`${BOUNDARY}(?:${t.patterns.join('|')})`, 'iu'),
}));

function detectThemes(text) {
  const lower = String(text).toLowerCase();
  return THEME_REGEX.filter((t) => t.regex.test(lower)).map((t) => t.id);
}

const MIN_THEME_MENTIONS = 2; // nur wiederkehrende Themen werden ausgewiesen

function analyzeText(field, responses) {
  const entries = [];
  for (const r of responses) {
    const v = r.answers[field.id];
    if (typeof v === 'string' && v.trim()) entries.push({ text: v.trim() });
  }
  // Stabile, nicht chronologische Reihenfolge (Antworten sind nach Zufalls-ID sortiert).
  entries.forEach((e, i) => { e.no = i + 1; e.themes = detectThemes(e.text); });
  const themes = THEMES.map((t) => {
    const refs = entries.filter((e) => e.themes.includes(t.id)).map((e) => e.no);
    return { id: t.id, label: t.label, count: refs.length, refs };
  })
    .filter((t) => t.count >= MIN_THEME_MENTIONS)
    .sort((a, b) => b.count - a.count);
  return { id: field.id, number: field.number, label: field.label, parent: field.parent, entries, themes };
}

/* ------------------------------------------------------------------------- */
/* Entscheidungsgrundlage                                                     */
/* ------------------------------------------------------------------------- */

const THRESHOLDS = {
  minResponses: 3,           // Mindestanzahl Rückmeldungen insgesamt
  minValidKey: 3,            // Mindestanzahl inhaltlicher Antworten bei Frage 2 und 12
  minRateInsufficient: 1 / 3, // darunter: keine belastbare Empfehlung
  rateGood: 2 / 3,           // ab hier: Rücklauf gilt als gut
  polarisation: 30,          // je ≥ 30 % positiv UND negativ → widersprüchliches Bild
};

const DECISIONS = {
  insufficient: 'Aufgrund unzureichender Daten keine belastbare Empfehlung möglich',
  none: 'Keine Fortführung empfohlen',
  revise: 'Grundlegende Überarbeitung vor erneuter Durchführung',
  continue: 'Fortführung ohne wesentliche Veränderungen',
  adjust: 'Fortführung mit gezielten Anpassungen',
};

function buildIndicators(q) {
  return {
    overallPos: shareOf(q.q1, ['sehr_gelungen', 'eher_gelungen']),
    overallNeg: shareOf(q.q1, ['eher_nicht', 'gar_nicht']),
    recommendPos: shareOf(q.q2, ['ja_voll', 'ja_anpassung']),
    recommendFull: shareOf(q.q2, ['ja_voll']),
    recommendLimited: shareOf(q.q2, ['bedingt']),
    recommendNo: shareOf(q.q2, ['nein']),
    levelOk: shareOf(q.q3, ['angemessen']),
    levelHigh: shareOf(q.q3, ['eher_hoch', 'deutlich_hoch']),
    levelLow: shareOf(q.q3, ['eher_niedrig', 'deutlich_niedrig']),
    benefitPos: shareOf(q.q4, ['sehr_hoch', 'eher_hoch']),
    grade7Yes: shareOf(q.q5, ['ja_ohne', 'ja_anpassung']),
    grade7YesUnchanged: shareOf(q.q5, ['ja_ohne']),
    grade7YesAdjusted: shareOf(q.q5, ['ja_anpassung']),
    grade7J8Better: shareOf(q.q5, ['nein_j8']),
    grade7Unsuitable: shareOf(q.q5, ['nein_ungeeignet']),
    interestPos: shareOf(q.q6, ['sehr_gross', 'eher_gross']),
    interestMixed: shareOf(q.q6, ['unterschiedlich']),
    interestNeg: shareOf(q.q6, ['eher_gering', 'sehr_gering']),
    participationPos: shareOf(q.q7, ['sehr_aktiv', 'ueberwiegend']),
    participationNeg: shareOf(q.q7, ['zurueckhaltend', 'kaum']),
    addressPos: shareOf(q.q8, ['sehr_gut', 'gut']),
    addressNeg: shareOf(q.q8, ['weniger_gut', 'gar_nicht']),
    methodPos: shareOf(q.q9, ['sehr_gelungen', 'eher_gelungen']),
    methodNeg: shareOf(q.q9, ['eher_nicht', 'nicht']),
    establishPos: shareOf(q.q12, ['unbedingt', 'ja_anpassung']),
    establishFull: shareOf(q.q12, ['unbedingt']),
    establishRevise: shareOf(q.q12, ['ueberarbeitung']),
    establishNo: shareOf(q.q12, ['nein']),
    establishReviseOrNo: shareOf(q.q12, ['ueberarbeitung', 'nein']),
  };
}

const P = (ind) => (ind.pct === null ? 0 : ind.pct);

/**
 * Regelwerk (wird in dieser Reihenfolge geprüft; die erste zutreffende Regel bestimmt die Empfehlung).
 * Alle Prozentwerte beziehen sich auf inhaltliche Antworten (ohne „nicht beurteilbar“).
 */
function decisionRules() {
  return [
    {
      code: 'insufficient', label: DECISIONS.insufficient,
      description: `Weniger als ${THRESHOLDS.minResponses} Rückmeldungen ODER weniger als ${THRESHOLDS.minValidKey} inhaltliche Antworten bei Frage 2 bzw. 12 ODER Rücklaufquote unter ${Math.round(THRESHOLDS.minRateInsufficient * 100)} % (sofern erwartete Anzahl hinterlegt).`,
      test: (ctx) => ctx.n < THRESHOLDS.minResponses
        || ctx.ind.recommendPos.valid < THRESHOLDS.minValidKey
        || ctx.ind.establishPos.valid < THRESHOLDS.minValidKey
        || (ctx.rate !== null && ctx.rate < THRESHOLDS.minRateInsufficient),
    },
    {
      code: 'none', label: DECISIONS.none,
      description: 'Mindestens 50 % lehnen eine dauerhafte Etablierung ab (Frage 12 „Nein“) ODER mindestens 50 % würden nicht weiterempfehlen (Frage 2 „Nein“) ODER mindestens 50 % bewerten das Angebot insgesamt als eher nicht/überhaupt nicht gelungen (Frage 1).',
      test: ({ ind }) => P(ind.establishNo) >= 50 || P(ind.recommendNo) >= 50 || P(ind.overallNeg) >= 50,
    },
    {
      code: 'revise', label: DECISIONS.revise,
      description: 'Mindestens 40 % sehen eine Fortführung nur nach grundlegender Überarbeitung oder gar nicht (Frage 12) ODER mindestens 40 % bewerten das Angebot insgesamt negativ (Frage 1) ODER mindestens 50 % empfehlen nur bedingt oder nicht weiter (Frage 2) ODER weniger als 40 % halten den Anspruch für genau angemessen (Frage 3).',
      test: ({ ind }) => P(ind.establishReviseOrNo) >= 40 || P(ind.overallNeg) >= 40
        || P(ind.recommendLimited) + P(ind.recommendNo) >= 50 || (ind.levelOk.valid > 0 && P(ind.levelOk) < 40),
    },
    {
      code: 'continue', label: DECISIONS.continue,
      description: 'Mindestens 60 % „Ja, unbedingt“ (Frage 12) UND mindestens 60 % „Ja, uneingeschränkt“ (Frage 2) UND mindestens 70 % „genau angemessen“ (Frage 3) UND mindestens 75 % sehr/eher gelungen (Frage 1) UND höchstens 10 % negative Gesamtbewertungen UND höchstens 10 % „Überarbeitung/Nein“ bei Frage 12 UND kein widersprüchliches Antwortbild.',
      test: ({ ind, polarised }) => P(ind.establishFull) >= 60 && P(ind.recommendFull) >= 60 && P(ind.levelOk) >= 70
        && P(ind.overallPos) >= 75 && P(ind.overallNeg) <= 10 && P(ind.establishReviseOrNo) <= 10 && !polarised,
    },
    {
      code: 'adjust', label: DECISIONS.adjust,
      description: 'Mindestens 50 % befürworten eine Etablierung (Frage 12 „unbedingt“ oder „mit kleineren Anpassungen“) UND mindestens 50 % empfehlen weiter (Frage 2, beide Ja-Stufen) UND mindestens 50 % bewerten das Angebot insgesamt als sehr/eher gelungen (Frage 1).',
      test: ({ ind }) => P(ind.establishPos) >= 50 && P(ind.recommendPos) >= 50 && P(ind.overallPos) >= 50,
    },
    {
      code: 'revise', label: DECISIONS.revise, fallback: true,
      description: 'Auffangregel: Trifft keine der vorherigen Regeln zu, ist das Bild uneinheitlich ohne klare befürwortende Mehrheit. Vorsichtshalber wird eine Überarbeitung vor erneuter Durchführung empfohlen.',
      test: () => true,
    },
  ];
}

function decide({ n, expected, q, ind, texts }) {
  const rate = expected ? n / expected : null;
  const polarisedQuestions = [];
  // Kritische Seite: Frage 1 „eher nicht/überhaupt nicht gelungen“, Frage 2 „Nein“,
  // Frage 12 „nur nach grundlegender Überarbeitung“ oder „Nein“.
  const critical = { q1: ind.overallNeg, q2: ind.recommendNo, q12: ind.establishReviseOrNo };
  for (const [qid, label] of [['q1', 'Frage 1 (Gesamteindruck)'], ['q2', 'Frage 2 (Weiterempfehlung)'], ['q12', 'Frage 12 (Etablierung)']]) {
    if (q[qid].valid >= 3 && P(q[qid].shares.pos) >= THRESHOLDS.polarisation && P(critical[qid]) >= THRESHOLDS.polarisation) {
      polarisedQuestions.push(label);
    }
  }
  const polarised = polarisedQuestions.length > 0;
  const ctx = { n, rate, ind, polarised };
  const rules = decisionRules().map((r) => ({ ...r, met: !!r.test(ctx) }));
  const applied = rules.find((r) => r.met);

  const caveats = [];
  if (expected === null) caveats.push('Die erwartete Anzahl an Klassenleitungen ist nicht hinterlegt; die Rücklaufquote und damit die Repräsentativität sind unbekannt.');
  else if (rate > 1) caveats.push('Es liegen mehr Rückmeldungen vor als Klassenleitungen erwartet wurden. Bitte die hinterlegte Anzahl prüfen.');
  else if (rate < THRESHOLDS.rateGood && rate >= THRESHOLDS.minRateInsufficient) caveats.push(`Die Rücklaufquote liegt unter ${Math.round(THRESHOLDS.rateGood * 100)} %; die Ergebnisse geben möglicherweise nicht die Sicht aller Klassenleitungen wieder.`);
  if (n > 0 && n < 5) caveats.push('Bei sehr kleinen Fallzahlen verändert bereits eine einzelne Rückmeldung die Prozentwerte erheblich.');
  if (polarised) caveats.push(`Widersprüchliche Einschätzungen: Bei ${polarisedQuestions.join(', ')} stehen sich jeweils mindestens ${THRESHOLDS.polarisation} % zustimmende und mindestens ${THRESHOLDS.polarisation} % kritische Antworten gegenüber.`);
  if (ind.recommendPos.pct !== null && ind.establishPos.pct !== null && Math.abs(ind.recommendPos.pct - ind.establishPos.pct) >= 30) {
    caveats.push(`Weiterempfehlung (${fmtPct(ind.recommendPos.pct)}) und Befürwortung einer dauerhaften Etablierung (${fmtPct(ind.establishPos.pct)}) weichen deutlich voneinander ab.`);
  }
  if (q.q12.nbCount > 0 && q.q12.answered > 0 && q.q12.nbPct >= 25) {
    caveats.push(`${fmtPct(q.q12.nbPct)} der Klassenleitungen können eine dauerhafte Etablierung derzeit nicht beurteilen.`);
  }

  let strength;
  if (applied.code === 'insufficient') strength = 'nicht belastbar';
  else if (rate !== null && rate >= THRESHOLDS.rateGood && n >= 5 && !polarised) strength = 'gut belastbar';
  else strength = 'eingeschränkt belastbar';

  // Zusätzliche Gesichtspunkte für die Abteilungsleitung (keine Regel, nur Hinweis)
  const notes = [];
  if (applied.code === 'adjust' || applied.code === 'continue') {
    if (P(ind.levelHigh) >= 25) notes.push(`${fmtPct(ind.levelHigh.pct)} empfinden den Anspruch als (eher/deutlich) zu hoch.`);
    if (P(ind.levelLow) >= 25) notes.push(`${fmtPct(ind.levelLow.pct)} empfinden den Anspruch als (eher/deutlich) zu niedrig.`);
  }
  if (applied.code === 'adjust' && (P(ind.establishPos) < 60 || P(ind.recommendPos) < 60 || P(ind.overallPos) < 60)) {
    notes.push('Die befürwortende Mehrheit ist knapp (mindestens eine der Kennzahlen liegt unter 60 %).');
  }

  return {
    code: applied.code,
    label: applied.label,
    fallback: !!applied.fallback,
    strength,
    rate,
    polarised,
    caveats,
    notes,
    rules: rules.map((r) => ({ code: r.code, label: r.label, description: r.description, met: r.met, applied: r === applied, fallback: !!r.fallback })),
  };
}

/* ------------------------------------------------------------------------- */
/* Textbausteine (ausschließlich aus Zahlen abgeleitet)                       */
/* ------------------------------------------------------------------------- */

function sentence(ind, phrase) {
  if (!ind.valid) return null;
  return `${ind.count} von ${ind.valid} (${fmtPct(ind.pct)}) ${phrase}`;
}

function grade7Assessment(ind, q5) {
  if (q5.valid < THRESHOLDS.minValidKey) {
    return { code: 'unclear', text: `Keine belastbare Aussage möglich (nur ${q5.valid} inhaltliche Antwort${q5.valid === 1 ? '' : 'en'}; ${q5.nbCount}× „${q5.nbLabel}“).` };
  }
  const yes = P(ind.grade7Yes);
  if (yes >= 50) {
    return {
      code: 'possible',
      text: `Eine Mehrheit (${fmtPct(yes)}) hält eine Durchführung bereits in Jahrgang 7 für denkbar – davon ${ind.grade7YesAdjusted.count} nur mit altersgerechten Anpassungen, ${ind.grade7YesUnchanged.count} ohne wesentliche Veränderungen.`,
    };
  }
  if (P(ind.grade7J8Better) + P(ind.grade7Unsuitable) >= 50) {
    return {
      code: 'not_recommended',
      text: `Eine Mehrheit (${fmtPct(P(ind.grade7J8Better) + P(ind.grade7Unsuitable))}) spricht sich gegen eine Durchführung in Jahrgang 7 aus (${ind.grade7J8Better.count}× „Jahrgang 8 ist besser geeignet“, ${ind.grade7Unsuitable.count}× „auch für Jahrgang 8 nicht geeignet“).`,
    };
  }
  return { code: 'mixed', text: `Kein einheitliches Bild: ${fmtPct(yes)} halten Jahrgang 7 für denkbar, ${fmtPct(P(ind.grade7J8Better))} halten Jahrgang 8 für besser geeignet.` };
}

function interestAssessment(ind, q6) {
  if (q6.valid === 0) return { code: 'unclear', text: 'Keine inhaltlichen Einschätzungen vorhanden.' };
  const p = P(ind.interestPos);
  let tenor;
  if (p >= 75) tenor = 'überwiegend als groß';
  else if (p >= 50) tenor = 'mehrheitlich als groß';
  else if (P(ind.interestNeg) >= 50) tenor = 'mehrheitlich als gering';
  else tenor = 'uneinheitlich';
  return {
    code: tenor,
    text: `Das Interesse der Schülerinnen und Schüler wird ${tenor} eingeschätzt: ${fmtPct(p)} sehr/eher groß, ${fmtPct(P(ind.interestMixed))} unterschiedlich, ${fmtPct(P(ind.interestNeg))} eher/sehr gering (Basis: ${q6.valid} inhaltliche Antworten).`,
  };
}

function buildSummary(n, rate, expected, q, ind) {
  const list = [];
  list.push(expected
    ? `Es liegen ${n} Rückmeldungen von ${expected} erwarteten Klassenleitungen vor (Rücklaufquote ${fmtPct(rate * 100)}).`
    : `Es liegen ${n} Rückmeldungen vor (erwartete Anzahl nicht hinterlegt).`);
  const add = (s) => { if (s) list.push(s); };
  add(sentence(ind.overallPos, 'Klassenleitungen bewerten das Angebot insgesamt als sehr oder eher gelungen.'));
  add(sentence(ind.recommendPos, `würden es weiterempfehlen (davon ${ind.recommendFull.count} uneingeschränkt).`));
  add(sentence(ind.levelOk, 'halten den inhaltlichen Anspruch für Jahrgang 8 für genau angemessen.'));
  add(sentence(ind.benefitPos, 'schätzen den pädagogischen Nutzen als sehr oder eher hoch ein.'));
  add(sentence(ind.interestPos, 'nehmen das Interesse der Schülerinnen und Schüler als sehr oder eher groß wahr.'));
  add(sentence(ind.participationPos, 'erleben die Beteiligung als sehr oder überwiegend aktiv.'));
  add(sentence(ind.addressPos, 'beurteilen die Ansprache durch die Mitarbeiterinnen als sehr gut oder gut.'));
  add(sentence(ind.methodPos, 'bewerten die methodische Gestaltung als sehr oder eher gelungen.'));
  add(sentence(ind.establishPos, 'befürworten eine dauerhafte Etablierung in Abteilung II (davon ' + ind.establishFull.count + ' „unbedingt“).'));
  add(sentence(ind.grade7Yes, 'können sich eine Durchführung bereits in Jahrgang 7 vorstellen.'));
  return list;
}

/** Quantitativ besonders positiv bewertete Aspekte (≥ 75 % positiv bei mindestens 3 inhaltlichen Antworten). */
function quantitativeStrengths(q) {
  const items = [
    ['q1', 'Gesamteindruck'], ['q4', 'Pädagogischer Nutzen'], ['q6', 'Interesse der Schülerinnen und Schüler'],
    ['q7', 'Aktive Beteiligung'], ['q8', 'Ansprache und Einbeziehung durch die Mitarbeiterinnen'], ['q9', 'Methodische Gestaltung'],
    ['q3', 'Altersangemessener Anspruch'],
  ];
  return items
    .filter(([id]) => q[id].valid >= 3 && P(q[id].shares.pos) >= 75)
    .map(([id, label]) => ({ question: q[id].number, label, pct: q[id].shares.pos.pct, count: q[id].shares.pos.count, valid: q[id].valid }));
}

/** Quantitativ auffällige kritische Aspekte (≥ 25 % kritisch bzw. negativ). */
function quantitativeConcerns(q, ind) {
  const out = [];
  const push = (cond, text) => { if (cond) out.push(text); };
  push(q.q3.valid >= 3 && P(ind.levelHigh) >= 25, `Anspruch: ${fmtPct(ind.levelHigh.pct)} halten das Niveau für (eher/deutlich) zu hoch (Frage 3).`);
  push(q.q3.valid >= 3 && P(ind.levelLow) >= 25, `Anspruch: ${fmtPct(ind.levelLow.pct)} halten das Niveau für (eher/deutlich) zu niedrig (Frage 3).`);
  push(q.q6.valid >= 3 && P(ind.interestNeg) >= 25, `Interesse: ${fmtPct(ind.interestNeg.pct)} schätzen das Interesse als eher/sehr gering ein (Frage 6).`);
  push(q.q7.valid >= 3 && P(ind.participationNeg) >= 25, `Beteiligung: ${fmtPct(ind.participationNeg.pct)} erleben die Schülerinnen und Schüler als zurückhaltend bzw. kaum beteiligt (Frage 7).`);
  push(q.q8.valid >= 3 && P(ind.addressNeg) >= 25, `Ansprache: ${fmtPct(ind.addressNeg.pct)} beurteilen die Ansprache als weniger gut oder überhaupt nicht gelungen (Frage 8).`);
  push(q.q9.valid >= 3 && P(ind.methodNeg) >= 25, `Methodik: ${fmtPct(ind.methodNeg.pct)} bewerten die methodische Gestaltung als eher nicht/nicht gelungen (Frage 9).`);
  push(q.q1.valid >= 3 && P(q.q1.shares.mid) >= 25, `Gesamteindruck: ${fmtPct(q.q1.shares.mid.pct)} bewerten das Angebot als „teils gelungen, teils nicht gelungen“ (Frage 1).`);
  return out;
}

/** Wiederkehrende Themen in den Verbesserungs-Freitexten (Fragen 2, 5, 10, 11), zusammengeführt. */
function improvementThemes(texts) {
  const ids = ['q10', 'q11', 'q2_text', 'q5_text'];
  const map = new Map();
  for (const id of ids) {
    for (const e of texts[id].entries) {
      for (const th of e.themes) {
        if (!map.has(th)) map.set(th, { id: th, label: THEMES.find((t) => t.id === th).label, count: 0, sources: new Set() });
        const m = map.get(th);
        m.count++;
        m.sources.add(texts[id].number);
      }
    }
  }
  return [...map.values()]
    .filter((m) => m.count >= MIN_THEME_MENTIONS)
    .sort((a, b) => b.count - a.count)
    .map((m) => ({ id: m.id, label: m.label, count: m.count, sources: [...m.sources].sort((a, b) => a - b) }));
}

/* ------------------------------------------------------------------------- */
/* Gesamtauswertung                                                           */
/* ------------------------------------------------------------------------- */

function analyze(responses, { expected = null } = {}) {
  const n = responses.length;
  const exp = Number.isInteger(expected) && expected > 0 ? expected : null;
  const rate = exp ? n / exp : null;

  const q = {};
  for (const question of QUESTIONS.filter((x) => x.type === 'single')) q[question.id] = analyzeClosed(question, responses);
  const texts = {};
  for (const f of textFields()) texts[f.id] = analyzeText(f, responses);

  const ind = buildIndicators(q);
  const decision = decide({ n, expected: exp, q, ind, texts });

  const classCounts = {};
  let withClass = 0;
  for (const r of responses) {
    if (r.classLabel) { withClass++; classCounts[r.classLabel] = (classCounts[r.classLabel] || 0) + 1; }
  }

  return {
    meta: META,
    generatedAt: new Date().toISOString(),
    n,
    expected: exp,
    rate,
    classes: { withClass, distinct: Object.keys(classCounts).sort((a, b) => a.localeCompare(b, 'de', { numeric: true })) },
    sections: SECTIONS,
    closed: q,
    texts,
    indicators: ind,
    decision,
    summary: buildSummary(n, rate, exp, q, ind),
    grade7: grade7Assessment(ind, q.q5),
    interest: interestAssessment(ind, q.q6),
    strengths: quantitativeStrengths(q),
    concerns: quantitativeConcerns(q, ind),
    improvementThemes: improvementThemes(texts),
    thresholds: THRESHOLDS,
    themeDefinitions: THEMES.map((t) => ({ id: t.id, label: t.label })),
    minThemeMentions: MIN_THEME_MENTIONS,
  };
}

module.exports = { analyze, detectThemes, THEMES, THRESHOLDS, DECISIONS, fmtPct, getQuestion };
