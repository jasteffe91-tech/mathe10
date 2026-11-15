/* Automatisch erzeugt von werkzeuge/pages-bauen.js – nicht von Hand ändern. Quelle: lib/ */
(function () {
'use strict';
const M = {}; const C = {};
function req(n) {
  if (n === 'path') return { join: (...a) => a.join('/') };
  if (n === 'pdfkit') return window.PDFDocument;
  const k = n.replace(/^.*\//, '').replace(/\.js$/, '');
  if (C[k]) return C[k].exports;
  if (!M[k]) throw new Error('Modul fehlt: ' + n);
  const m = { exports: {} }; C[k] = m; M[k](m, m.exports, req, ''); return m.exports;
}
M["fragen"] = function (module, exports, require, __dirname) {
'use strict';
// Fragebogen – einzige Quelle für Fragen, Antwortoptionen und Bereiche.
// Wird vom Server (Prüfung, Auswertung, PDF) und vom Browser (über /api/fragen) genutzt.
//
// Optionen: { k: Schlüssel, t: Text, neutral?: true }
//   neutral = „Nicht beurteilbar“ / „Kann ich nicht beurteilen“ → zählt nicht zu den gültigen Antworten.
// Für die Entscheidungsregeln werden Optionen zusätzlich in Gruppen eingeteilt (gruppen).

const META = {
  titel: 'Evaluation des Präventionsangebots – Jugendhilfe der Stadt Voerde',
  berichtTitel: 'Auswertung der Evaluation – Präventionsangebot der Jugendhilfe der Stadt Voerde',
  schule: 'Comenius-Gesamtschule Voerde',
  abteilung: 'Abteilung II (Jahrgänge 7 und 8)',
  abteilungKurz: 'Abteilung II',
  zielgruppe: 'Klassenleitungen des 8. Jahrgangs',
  verantwortlich: 'WIDE (BL Abt. II)',
};

const BEREICHE = [
  { id: 'A', titel: 'Gesamteindruck' },
  { id: 'B', titel: 'Altersangemessenheit und pädagogischer Nutzen' },
  { id: 'C', titel: 'Interesse und Beteiligung der Schülerinnen und Schüler' },
  { id: 'D', titel: 'Qualität der Durchführung' },
  { id: 'E', titel: 'Schulische Organisation und zukünftige Durchführung' },
];

const NB = { k: 'nb', t: 'Nicht beurteilbar', neutral: true };

const FRAGEN = [
  {
    id: 'q1', nr: 1, bereich: 'A', typ: 'wahl', pflicht: true,
    text: 'Wie bewertest du das Präventionsangebot insgesamt?',
    optionen: [
      { k: 'sehr', t: 'Sehr gelungen' },
      { k: 'eher', t: 'Eher gelungen' },
      { k: 'teils', t: 'Teils gelungen, teils nicht gelungen' },
      { k: 'eher_nicht', t: 'Eher nicht gelungen' },
      { k: 'nicht', t: 'Überhaupt nicht gelungen' },
    ],
    gruppen: { positiv: ['sehr', 'eher'], negativ: ['eher_nicht', 'nicht'] },
  },
  {
    id: 'q2', nr: 2, bereich: 'A', typ: 'wahl', pflicht: true, entscheidend: true,
    text: 'Würdest du das Präventionsangebot anderen Klassenleitungen weiterempfehlen?',
    optionen: [
      { k: 'ja', t: 'Ja, uneingeschränkt' },
      { k: 'ja_anp', t: 'Ja, mit kleineren Anpassungen' },
      { k: 'bedingt', t: 'Nur bedingt' },
      { k: 'nein', t: 'Nein' },
    ],
    gruppen: { positiv: ['ja', 'ja_anp'], negativ: ['bedingt', 'nein'] },
  },
  {
    id: 'q2_text', nr: '2a', bereich: 'A', typ: 'text', zeilen: 3, gehoertZu: 'q2',
    text: 'Bitte begründe deine Einschätzung.',
  },
  {
    id: 'q3', nr: 3, bereich: 'B', typ: 'wahl', pflicht: true, entscheidend: true,
    text: 'War der inhaltliche Anspruch des Präventionsangebots für Schülerinnen und Schüler des 8. Jahrgangs angemessen?',
    optionen: [
      { k: 'd_niedrig', t: 'Deutlich zu niedrig' },
      { k: 'e_niedrig', t: 'Eher zu niedrig' },
      { k: 'angemessen', t: 'Genau angemessen' },
      { k: 'e_hoch', t: 'Eher zu hoch' },
      { k: 'd_hoch', t: 'Deutlich zu hoch' },
    ],
    gruppen: { positiv: ['angemessen'], negativ: ['d_niedrig', 'd_hoch'] },
  },
  {
    id: 'q4', nr: 4, bereich: 'B', typ: 'wahl', pflicht: true,
    text: 'Wie schätzt du den pädagogischen Nutzen des Präventionsangebots für deine Klasse ein?',
    optionen: [
      { k: 'sehr_hoch', t: 'Sehr hoch' },
      { k: 'eher_hoch', t: 'Eher hoch' },
      { k: 'mittel', t: 'Mittel' },
      { k: 'eher_gering', t: 'Eher gering' },
      { k: 'sehr_gering', t: 'Sehr gering' },
      NB,
    ],
    gruppen: { positiv: ['sehr_hoch', 'eher_hoch'], negativ: ['eher_gering', 'sehr_gering'] },
  },
  {
    id: 'q5', nr: 5, bereich: 'B', typ: 'wahl', pflicht: true, entscheidend: true,
    text: 'Könntest du dir vorstellen, das Präventionsangebot bereits im 7. Jahrgang durchzuführen?',
    optionen: [
      { k: 'ja', t: 'Ja, ohne wesentliche Veränderungen' },
      { k: 'ja_anp', t: 'Ja, mit altersgerechten Anpassungen' },
      { k: 'nein_8', t: 'Nein, Jahrgang 8 ist besser geeignet' },
      { k: 'nein_ung', t: 'Nein, auch für Jahrgang 8 nicht geeignet' },
      { k: 'nb', t: 'Kann ich nicht beurteilen', neutral: true },
    ],
    gruppen: { positiv: ['ja', 'ja_anp'], negativ: ['nein_8', 'nein_ung'] },
  },
  {
    id: 'q5_text', nr: '5a', bereich: 'B', typ: 'text', zeilen: 3, gehoertZu: 'q5',
    text: 'Welche Anpassungen wären gegebenenfalls erforderlich?',
  },
  {
    id: 'q6', nr: 6, bereich: 'C', typ: 'wahl', pflicht: true,
    text: 'Wie groß war nach deiner Beobachtung das Interesse der Schülerinnen und Schüler am Präventionsangebot?',
    optionen: [
      { k: 'sehr', t: 'Sehr groß' },
      { k: 'eher', t: 'Eher groß' },
      { k: 'untersch', t: 'Unterschiedlich' },
      { k: 'eher_gering', t: 'Eher gering' },
      { k: 'sehr_gering', t: 'Sehr gering' },
      NB,
    ],
    gruppen: { positiv: ['sehr', 'eher'], negativ: ['eher_gering', 'sehr_gering'] },
  },
  {
    id: 'q7', nr: 7, bereich: 'C', typ: 'wahl', pflicht: true,
    text: 'Wie hast du die aktive Beteiligung der Schülerinnen und Schüler wahrgenommen?',
    optionen: [
      { k: 'sehr', t: 'Sehr aktiv' },
      { k: 'ueberw', t: 'Überwiegend aktiv' },
      { k: 'untersch', t: 'Unterschiedlich' },
      { k: 'zurueck', t: 'Eher zurückhaltend' },
      { k: 'kaum', t: 'Kaum beteiligt' },
      NB,
    ],
    gruppen: { positiv: ['sehr', 'ueberw'], negativ: ['zurueck', 'kaum'] },
  },
  {
    id: 'q8', nr: 8, bereich: 'C', typ: 'wahl', pflicht: true,
    text: 'Wie gut gelang es den Mitarbeiterinnen, die Schülerinnen und Schüler anzusprechen und in die Veranstaltung einzubeziehen?',
    optionen: [
      { k: 'sehr_gut', t: 'Sehr gut' },
      { k: 'gut', t: 'Gut' },
      { k: 'teilw', t: 'Teilweise' },
      { k: 'weniger', t: 'Weniger gut' },
      { k: 'nicht', t: 'Überhaupt nicht' },
      NB,
    ],
    gruppen: { positiv: ['sehr_gut', 'gut'], negativ: ['weniger', 'nicht'] },
  },
  {
    id: 'q9', nr: 9, bereich: 'D', typ: 'wahl', pflicht: true,
    text: 'Wie bewertest du die methodische Gestaltung des Präventionsangebots?',
    optionen: [
      { k: 'sehr', t: 'Sehr gelungen' },
      { k: 'eher', t: 'Eher gelungen' },
      { k: 'teilw', t: 'Teilweise gelungen' },
      { k: 'eher_nicht', t: 'Eher nicht gelungen' },
      { k: 'nicht', t: 'Nicht gelungen' },
      NB,
    ],
    gruppen: { positiv: ['sehr', 'eher'], negativ: ['eher_nicht', 'nicht'] },
  },
  {
    id: 'q10', nr: 10, bereich: 'D', typ: 'text', zeilen: 5,
    text: 'Welche Verbesserungsvorschläge hast du für die Mitarbeiterinnen der Jugendhilfe der Stadt Voerde?',
    hilfe: 'Denke beispielsweise an die Inhalte, Methoden, Ansprache der Schülerinnen und Schüler, Verständlichkeit, zeitliche Gestaltung oder Beteiligungsmöglichkeiten.',
  },
  {
    id: 'q11', nr: 11, bereich: 'E', typ: 'text', zeilen: 5,
    text: 'Welche Hinweise oder Verbesserungsvorschläge hast du für die Abteilungsleitung hinsichtlich der zukünftigen Organisation des Präventionsangebots?',
    hilfe: 'Beispielsweise Zeitpunkt im Schuljahr, Jahrgangsstufe, Dauer, organisatorischer Ablauf, Vorbereitung oder Nachbereitung im Unterricht.',
  },
  {
    id: 'q12', nr: 12, bereich: 'E', typ: 'wahl', pflicht: true, entscheidend: true,
    text: 'Sollte das Präventionsangebot aus deiner Sicht langfristig als fester Bestandteil des Präventionskonzepts der Abteilung II etabliert werden?',
    optionen: [
      { k: 'ja', t: 'Ja, unbedingt' },
      { k: 'ja_anp', t: 'Ja, mit kleineren Anpassungen' },
      { k: 'ueberarb', t: 'Nur nach grundlegender Überarbeitung' },
      { k: 'nein', t: 'Nein' },
      { k: 'nb', t: 'Kann ich derzeit nicht beurteilen', neutral: true },
    ],
    gruppen: { positiv: ['ja', 'ja_anp'], negativ: ['ueberarb', 'nein'] },
  },
  {
    id: 'q13', nr: 13, bereich: 'E', typ: 'text', zeilen: 4,
    text: 'Was war aus deiner Sicht besonders gelungen?',
  },
  {
    id: 'q14', nr: 14, bereich: 'E', typ: 'text', zeilen: 4,
    text: 'Gibt es weitere Anmerkungen?',
  },
];

const MAX_TEXT = 3000;
const MAX_KLASSE = 12;

module.exports = { META, BEREICHE, FRAGEN, MAX_TEXT, MAX_KLASSE };

};
M["pruefen"] = function (module, exports, require, __dirname) {
'use strict';
// Prüft und bereinigt eine Abgabe gegen den Fragebogen. Gemeinsam genutzt von Server und GitHub-Pages-Version.
const { FRAGEN, MAX_TEXT, MAX_KLASSE } = require('./fragen');

function textBereinigen(s, max) {
  if (typeof s !== 'string') return '';
  // Steuerzeichen entfernen (Zeilenumbrüche/Tabs bleiben), auf Länge begrenzen
  return s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').replace(/\r\n?/g, '\n').trim().slice(0, max);
}

/** → { antwort } oder { fehler } */
function antwortPruefen(eingabe) {
  if (!eingabe || typeof eingabe !== 'object') return { fehler: 'Keine Antworten übermittelt.' };
  const aus = {};
  const fehlend = [];
  for (const f of FRAGEN) {
    const w = eingabe[f.id];
    if (f.typ === 'wahl') {
      if (w == null || w === '') { if (f.pflicht) fehlend.push(f.nr); continue; }
      if (!f.optionen.some((o) => o.k === w)) return { fehler: `Ungültige Antwort bei Frage ${f.nr}.` };
      aus[f.id] = w;
    } else {
      const t = textBereinigen(w, MAX_TEXT);
      if (t) aus[f.id] = t;
    }
  }
  if (fehlend.length) return { fehler: `Bitte beantworte noch die Pflichtfrage(n) ${fehlend.join(', ')}.` };
  const klasse = textBereinigen(eingabe.klasse, MAX_KLASSE).replace(/\s+/g, ' ');
  if (klasse) aus.klasse = klasse;
  return { antwort: aus };
}

module.exports = { antwortPruefen, textBereinigen };

};
M["code"] = function (module, exports, require, __dirname) {
'use strict';
// Antwort-Code für die GitHub-Pages-Version (ohne Server):
//   PRAEV1.<Daten>.<Prüfziffer>
//   Daten = JSON {k: Abgabekennung, a: Antworten} → UTF-8 → komprimiert (deflate-raw) → base64url
//   Prüfziffer = erste 8 Hex-Zeichen von SHA-256 der Daten → erkennt Tippfehler/unvollständiges Kopieren.
// Läuft im Browser und in Node.js ≥ 18 (CompressionStream + WebCrypto).
const { antwortPruefen } = require('./pruefen');

const PREFIX = 'PRAEV1';
const MUSTER = /PRAEV1\.[A-Za-z0-9_-]+\.[0-9a-f]{8}/g;

const b64url = (bytes) => {
  let s = ''; for (let i = 0; i < bytes.length; i += 8192) s += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const vonB64url = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));

async function strom(bytes, Art, format) {
  const st = new Blob([bytes]).stream().pipeThrough(new Art(format));
  return new Uint8Array(await new Response(st).arrayBuffer());
}
async function pruefziffer(text) {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
  return Array.from(h.subarray(0, 4), (x) => x.toString(16).padStart(2, '0')).join('');
}

async function codeErzeugen(kennung, antworten) {
  const { fehler, antwort } = antwortPruefen(antworten);
  if (fehler) throw new Error(fehler);
  const json = JSON.stringify({ k: String(kennung).slice(0, 64), a: antwort });
  const daten = b64url(await strom(new TextEncoder().encode(json), CompressionStream, 'deflate-raw'));
  return `${PREFIX}.${daten}.${await pruefziffer(daten)}`;
}

/** Liest einen Code → { kennung, antwort } oder wirft einen Fehler mit verständlicher Meldung. */
async function codeLesen(code) {
  const teile = String(code).trim().split('.');
  if (teile.length !== 3 || teile[0] !== PREFIX) throw new Error('Kein gültiger Antwort-Code.');
  if (await pruefziffer(teile[1]) !== teile[2]) throw new Error('Prüfziffer stimmt nicht – Code unvollständig kopiert?');
  let obj;
  try { obj = JSON.parse(new TextDecoder().decode(await strom(vonB64url(teile[1]), DecompressionStream, 'deflate-raw'))); }
  catch { throw new Error('Code kann nicht entschlüsselt werden.'); }
  const { fehler, antwort } = antwortPruefen(obj.a);
  if (fehler) throw new Error(fehler);
  if (typeof obj.k !== 'string' || obj.k.length < 8) throw new Error('Code ohne Kennung.');
  return { kennung: obj.k, antwort };
}

/** Findet alle Codes in beliebigem Text (z. B. mehrere eingefügte E-Mails). Leerzeichen/Umbrüche im Code werden toleriert. */
function codesFinden(text) {
  const kompakt = String(text).replace(/(PRAEV1\.[A-Za-z0-9_\-\s]+\.[0-9a-f\s]{8,})/g, (m) => m.replace(/\s+/g, ''));
  return [...new Set(kompakt.match(MUSTER) || [])];
}

module.exports = { codeErzeugen, codeLesen, codesFinden, PREFIX };

};
M["auswertung"] = function (module, exports, require, __dirname) {
'use strict';
// Automatische Auswertung: Häufigkeiten, Themenbündelung (Stichwortsuche) und Entscheidungsregeln.
// Grundsatz: Es werden nur Zahlen berechnet und Zitate wörtlich wiedergegeben.
// Automatisch erzeugte Sätze sind ausschließlich Zusammenfassungen dieser Zahlen.

const { FRAGEN, BEREICHE } = require('./fragen');

const pct = (a, b) => (b > 0 ? (100 * a) / b : null);
const rund = (x) => (x == null ? null : Math.round(x));
const fmtPct = (x) => (x == null ? '–' : `${rund(x)}\u00A0%`); // geschütztes Leerzeichen: kein Umbruch vor %

// ---------------------------------------------------------------- Häufigkeiten
function auszaehlen(frage, antworten) {
  const zahl = Object.fromEntries(frage.optionen.map((o) => [o.k, 0]));
  let ohne = 0;
  for (const a of antworten) {
    const w = a[frage.id];
    if (w in zahl) zahl[w] += 1; else ohne += 1;
  }
  const neutral = frage.optionen.filter((o) => o.neutral).reduce((s, o) => s + zahl[o.k], 0);
  const beantwortet = antworten.length - ohne;
  const gueltig = beantwortet - neutral; // gültig = inhaltliche Einschätzung (ohne „nicht beurteilbar“)
  const optionen = frage.optionen.map((o) => ({
    k: o.k, t: o.t, neutral: !!o.neutral, anzahl: zahl[o.k],
    // Prozent inhaltlicher Antworten: Basis = gültige Antworten; „nicht beurteilbar“: Basis = alle Antworten
    prozent: o.neutral ? pct(zahl[o.k], beantwortet) : pct(zahl[o.k], gueltig),
  }));
  const anteil = (keys) => pct(keys.reduce((s, k) => s + (zahl[k] || 0), 0), gueltig);
  const anzahlVon = (keys) => keys.reduce((s, k) => s + (zahl[k] || 0), 0);
  return {
    id: frage.id, nr: frage.nr, text: frage.text, bereich: frage.bereich, entscheidend: !!frage.entscheidend,
    beantwortet, gueltig, neutral, neutralProzent: pct(neutral, beantwortet), ohneAngabe: ohne,
    optionen, zahl, anteil, anzahlVon,
    positiv: frage.gruppen ? anteil(frage.gruppen.positiv) : null,
    negativ: frage.gruppen ? anteil(frage.gruppen.negativ) : null,
  };
}

// ---------------------------------------------------------------- Themenbündelung
// Transparente Stichwortliste. Eine Rückmeldung kann mehreren Themen zugeordnet werden.
// Die Zuordnung sagt nur, DASS ein Thema angesprochen wird – nicht, ob positiv oder negativ.
const THEMEN = [
  { id: 'zeit', titel: 'Zeitlicher Umfang / Dauer', muster: /(\bzeit\b|zeitlich|\bdauer|zu lang\b|zu kurz\b|\blänger|\bkürzer|minuten|\bpausen?\b|doppelstunde|zeitrahmen|\bknapp)/i },
  { id: 'zeitpunkt', titel: 'Zeitpunkt im Schuljahr', muster: /(zeitpunkt|halbjahr|schuljahr|termin|vor den ferien|nach den ferien|frühjahr|herbst|winter|sommer|anfang des|ende des)/i },
  { id: 'jahrgang', titel: 'Jahrgangsstufe / Alter', muster: /(jahrgang|\bjg\.?\s?\d|klasse\s?[78]\b|\b[78]\.\s?(klasse|jahrgang|schuljahr)|\balter\b|\balters(gerecht|gemäß|angemessen)|\breife|\bjünger|\bälter)/i },
  { id: 'methoden', titel: 'Methoden und Abwechslung', muster: /(method|gruppenarbeit|rollenspiel|übung|\bspiel|interaktiv|frontal|vortrag|abwechslung|\bfilm|video|plakat|station|praktisch|anschaulich)/i },
  { id: 'inhalte', titel: 'Inhalte und Themenauswahl', muster: /(inhalt|thema|themen|information|beispiel|praxisnah|alltag|lebenswelt|realitätsnah|tiefe|oberflächlich|anspruch)/i },
  { id: 'ansprache', titel: 'Ansprache und Atmosphäre', muster: /(\bansprache|angesprochen|zugang|augenhöhe|\bsprache|vertrau|atmosphäre|empath|sympath|locker|wertschätz|einfühlsam|respekt)/i },
  { id: 'beteiligung', titel: 'Beteiligung und Verhalten der Schülerinnen und Schüler', muster: /(beteilig|mitmach|mitgemacht|einbezieh|einbezog|zurückhaltend|unruh|störung|disziplin|aufmerksam|konzentr|motiv|interesse)/i },
  { id: 'gruppe', titel: 'Gruppengröße und Setting', muster: /(gruppengröße|kleingruppe|kleinere gruppen|geteilt|teilung|mädchen|jungen|geschlecht|klassenverband|\braum\b|\bräume|sitzkreis|halbe klasse)/i },
  { id: 'vorbereitung', titel: 'Vor- und Nachbereitung im Unterricht', muster: /(vorbereit|nachbereit|nachbesprech|reflexion|reflektier|im unterricht|anschließend|nachhaltig|weiterarbeit|aufgreifen|material)/i },
  { id: 'organisation', titel: 'Absprachen und Organisation', muster: /(absprache|vorab|kommunikation|ablauf|organisation|organisatorisch|planung|ansprechpartner|informiert|info\b|vertretung|stundenplan|anwesenheit|klassenleitung)/i },
];

const TEXTFRAGEN = FRAGEN.filter((f) => f.typ === 'text');

function texteSammeln(antworten, frageId) {
  return antworten.map((a) => (a[frageId] || '').trim()).filter(Boolean)
    .sort((x, y) => x.localeCompare(y, 'de')); // alphabetisch: keine Zuordnung zu Abgabereihenfolge
}

function themenBuendeln(texte) {
  // texte: [{ frage, text }]
  return THEMEN.map((th) => {
    const treffer = texte.filter((x) => th.muster.test(x.text));
    return { id: th.id, titel: th.titel, anzahl: treffer.length, treffer };
  }).filter((t) => t.anzahl > 0).sort((a, b) => b.anzahl - a.anzahl);
}

// ---------------------------------------------------------------- Entscheidungsregeln
const SCHWELLEN = {
  minAntworten: 3,
  minRuecklauf: 50,
  ruecklaufVorbehalt: 75,
  mehrheit: 50,
  starkeZustimmung: 75,
  polarisierung: 25,
  widerspruch: 25,
  neutralHoch: 30,
  ueberarbeitungMax: 20,
};

const REGELN_TEXT = [
  `R1 Datenbasis: Eine Empfehlung wird nur ausgesprochen, wenn mindestens ${SCHWELLEN.minAntworten} Evaluationen vorliegen, mindestens ${SCHWELLEN.minAntworten} davon bei Frage 12 eine inhaltliche Einschätzung enthalten und – falls die erwartete Anzahl hinterlegt ist – die Rücklaufquote mindestens ${SCHWELLEN.minRuecklauf} % beträgt. Sonst: „Aufgrund unzureichender Daten keine belastbare Empfehlung möglich“.`,
  `R2 Keine Fortführung: mindestens ${SCHWELLEN.mehrheit} % der gültigen Antworten zu Frage 12 lauten „Nein“ UND mindestens ${SCHWELLEN.mehrheit} % zu Frage 2 lauten „Nur bedingt“ oder „Nein“.`,
  `R3 Grundlegende Überarbeitung: weniger als ${SCHWELLEN.mehrheit} % befürworten in Frage 12 eine Etablierung („Ja, unbedingt“ oder „Ja, mit kleineren Anpassungen“) ODER mindestens ${SCHWELLEN.mehrheit} % bewerten das Angebot in Frage 1 als eher nicht oder überhaupt nicht gelungen.`,
  `R4 Fortführung ohne wesentliche Veränderungen: nur wenn ALLE Bedingungen erfüllt sind – Frage 12 „Ja, unbedingt“ ≥ ${SCHWELLEN.mehrheit} %, Frage 2 „Ja, uneingeschränkt“ ≥ ${SCHWELLEN.mehrheit} %, Frage 3 „Genau angemessen“ ≥ ${SCHWELLEN.starkeZustimmung} %, Frage 1 sehr/eher gelungen ≥ ${SCHWELLEN.starkeZustimmung} %, Frage 12 „Nur nach grundlegender Überarbeitung“/„Nein“ ≤ ${SCHWELLEN.ueberarbeitungMax} % – und kein inhaltlicher Vorbehalt (Polarisierung, Widerspruch, Anspruch nicht mehrheitlich angemessen) vorliegt.`,
  `R5 Fortführung mit gezielten Anpassungen: alle übrigen Fälle (d. h. eine Mehrheit befürwortet die Etablierung, aber nicht alle Bedingungen von R4 sind erfüllt).`,
  `Vorbehalte (werden immer ausgewiesen): Rücklaufquote unbekannt oder unter ${SCHWELLEN.ruecklaufVorbehalt} %; weniger als 5 Evaluationen; Polarisierung (bei Frage 1 oder 12 jeweils mindestens ${SCHWELLEN.polarisierung} % positive UND negative Einschätzungen); Widerspruch zwischen Weiterempfehlung (Frage 2) und Etablierung (Frage 12) von mindestens ${SCHWELLEN.widerspruch} Prozentpunkten; mehr als ${SCHWELLEN.neutralHoch} % „nicht beurteilbar“ bei einer Frage; Anspruch (Frage 3) von weniger als ${SCHWELLEN.mehrheit} % als genau angemessen eingeschätzt.`,
  'Prozentangaben beziehen sich immer auf gültige Antworten, also ohne „Nicht beurteilbar“/„Kann ich nicht beurteilen“. Es wird kein Durchschnittswert über Antwortskalen gebildet.',
];

const EMPFEHLUNGEN = {
  ohne: 'Fortführung ohne wesentliche Veränderungen',
  anpassungen: 'Fortführung mit gezielten Anpassungen',
  ueberarbeitung: 'Grundlegende Überarbeitung vor erneuter Durchführung',
  keine: 'Keine Fortführung empfohlen',
  unzureichend: 'Aufgrund unzureichender Daten keine belastbare Empfehlung möglich',
};

function entscheiden(q, n, erwartet) {
  const S = SCHWELLEN;
  const quote = erwartet ? pct(n, erwartet) : null;
  const vorbehalte = [];
  const inhaltlicheVorbehalte = [];

  if (quote == null) vorbehalte.push('Die erwartete Anzahl der Klassenleitungen ist nicht hinterlegt; die Rücklaufquote ist daher unbekannt.');
  else if (quote < S.ruecklaufVorbehalt) vorbehalte.push(`Die Rücklaufquote liegt bei ${fmtPct(quote)}. Die Ergebnisse geben möglicherweise nicht die Sicht aller Klassenleitungen wieder.`);
  if (n > 0 && n < 5) vorbehalte.push(`Es liegen nur ${n} Evaluation(en) vor. Einzelne Einschätzungen wirken sich stark auf die Prozentwerte aus.`);

  for (const id of ['q1', 'q12']) {
    const f = q[id];
    if (f.gueltig > 0 && f.positiv >= S.polarisierung && f.negativ >= S.polarisierung) {
      const m = `Polarisierung bei Frage ${f.nr}: ${fmtPct(f.positiv)} positive und ${fmtPct(f.negativ)} kritische Einschätzungen.`;
      vorbehalte.push(m); inhaltlicheVorbehalte.push(m);
    }
  }
  if (q.q2.gueltig > 0 && q.q12.gueltig > 0 && Math.abs(q.q2.positiv - q.q12.positiv) >= S.widerspruch) {
    const m = `Widerspruch: Weiterempfehlung (Frage 2) ${fmtPct(q.q2.positiv)}, Befürwortung einer Etablierung (Frage 12) ${fmtPct(q.q12.positiv)}.`;
    vorbehalte.push(m); inhaltlicheVorbehalte.push(m);
  }
  if (q.q3.gueltig > 0 && q.q3.positiv < S.mehrheit) {
    const m = `Nur ${fmtPct(q.q3.positiv)} schätzen den inhaltlichen Anspruch für Jahrgang 8 als genau angemessen ein (zu niedrig: ${fmtPct(q.q3.anteil(['d_niedrig', 'e_niedrig']))}, zu hoch: ${fmtPct(q.q3.anteil(['e_hoch', 'd_hoch']))}).`;
    vorbehalte.push(m); inhaltlicheVorbehalte.push(m);
  }
  for (const f of Object.values(q)) {
    if (f.beantwortet > 0 && f.neutralProzent > S.neutralHoch) {
      vorbehalte.push(`Bei Frage ${f.nr} haben ${fmtPct(f.neutralProzent)} „nicht beurteilbar“ gewählt.`);
    }
  }

  const geprueft = [];
  let empfehlung;
  let regel;
  const datenOk = n >= S.minAntworten && q.q12.gueltig >= S.minAntworten && (quote == null || quote >= S.minRuecklauf);
  geprueft.push({ regel: 'R1', erfuellt: !datenOk, text: `Datenbasis: ${n} Evaluation(en), ${q.q12.gueltig} gültige Antwort(en) zu Frage 12, Rücklaufquote ${quote == null ? 'unbekannt' : fmtPct(quote)}.` });

  if (!datenOk) {
    empfehlung = 'unzureichend'; regel = 'R1';
  } else {
    const nein12 = q.q12.anteil(['nein']);
    const krit2 = q.q2.anteil(['bedingt', 'nein']);
    const r2 = nein12 >= S.mehrheit && krit2 >= S.mehrheit;
    geprueft.push({ regel: 'R2', erfuellt: r2, text: `Frage 12 „Nein“: ${fmtPct(nein12)}; Frage 2 „Nur bedingt“/„Nein“: ${fmtPct(krit2)}.` });
    const r3 = q.q12.positiv < S.mehrheit || (q.q1.negativ >= S.mehrheit);
    geprueft.push({ regel: 'R3', erfuellt: !r2 && r3, text: `Frage 12 Befürwortung: ${fmtPct(q.q12.positiv)}; Frage 1 eher/überhaupt nicht gelungen: ${fmtPct(q.q1.negativ)}.` });
    const r4Bed = [
      [`Frage 12 „Ja, unbedingt“ ${fmtPct(q.q12.anteil(['ja']))}`, q.q12.anteil(['ja']) >= S.mehrheit],
      [`Frage 2 „Ja, uneingeschränkt“ ${fmtPct(q.q2.anteil(['ja']))}`, q.q2.anteil(['ja']) >= S.mehrheit],
      [`Frage 3 „Genau angemessen“ ${fmtPct(q.q3.positiv)}`, q.q3.positiv >= S.starkeZustimmung],
      [`Frage 1 sehr/eher gelungen ${fmtPct(q.q1.positiv)}`, q.q1.positiv >= S.starkeZustimmung],
      [`Frage 12 Überarbeitung/Nein ${fmtPct(q.q12.negativ)}`, q.q12.negativ <= S.ueberarbeitungMax],
      [`inhaltliche Vorbehalte: ${inhaltlicheVorbehalte.length}`, inhaltlicheVorbehalte.length === 0],
    ];
    const r4 = !r2 && !r3 && r4Bed.every((b) => b[1]);
    geprueft.push({ regel: 'R4', erfuellt: r4, text: r4Bed.map((b) => `${b[0]} ${b[1] ? '✓' : '✗'}`).join('; ') + '.' });
    if (r2) { empfehlung = 'keine'; regel = 'R2'; }
    else if (r3) { empfehlung = 'ueberarbeitung'; regel = 'R3'; }
    else if (r4) { empfehlung = 'ohne'; regel = 'R4'; }
    else { empfehlung = 'anpassungen'; regel = 'R5'; }
    geprueft.push({ regel: 'R5', erfuellt: regel === 'R5', text: 'Gilt, wenn keine der Regeln R2 bis R4 zutrifft.' });
  }
  return { empfehlung, titel: EMPFEHLUNGEN[empfehlung], regel, quote, vorbehalte, geprueft };
}

function jahrgang7Einschaetzung(f) {
  if (f.gueltig < SCHWELLEN.minAntworten) return `Keine belastbare Aussage möglich (nur ${f.gueltig} inhaltliche Einschätzung(en); ${f.neutral}× „Kann ich nicht beurteilen“).`;
  const ohne = f.anteil(['ja']); const anp = f.anteil(['ja_anp']); const ja = ohne + anp;
  const n8 = f.anteil(['nein_8']); const nU = f.anteil(['nein_ung']);
  let satz;
  if (ohne >= SCHWELLEN.mehrheit) satz = 'Eine Mehrheit hält eine Durchführung in Jahrgang 7 ohne wesentliche Veränderungen für vorstellbar.';
  else if (ja >= SCHWELLEN.mehrheit) satz = 'Eine Mehrheit hält eine Durchführung in Jahrgang 7 für vorstellbar – überwiegend jedoch nur mit altersgerechten Anpassungen.';
  else if (n8 >= SCHWELLEN.mehrheit) satz = 'Eine Mehrheit hält Jahrgang 8 für besser geeignet.';
  else satz = 'Es zeigt sich kein mehrheitliches Bild.';
  return `${satz} (Ja ohne Veränderungen: ${fmtPct(ohne)}, ja mit Anpassungen: ${fmtPct(anp)}, Jg. 8 besser geeignet: ${fmtPct(n8)}, auch für Jg. 8 nicht geeignet: ${fmtPct(nU)}; Basis: ${f.gueltig} gültige Antworten, ${f.neutral}× „Kann ich nicht beurteilen“.)`;
}

function interesseEinschaetzung(f) {
  if (f.gueltig === 0) return 'Keine inhaltliche Einschätzung vorhanden.';
  return `Sehr oder eher groß: ${fmtPct(f.positiv)}, unterschiedlich: ${fmtPct(f.anteil(['untersch']))}, eher oder sehr gering: ${fmtPct(f.negativ)} (Basis: ${f.gueltig} gültige Antworten${f.neutral ? `, ${f.neutral}× „Nicht beurteilbar“` : ''}).`;
}

// ---------------------------------------------------------------- Gesamtauswertung
function auswerten(antworten, einstellungen = {}) {
  const n = antworten.length;
  const erwartet = einstellungen.erwartet || null;
  const q = {};
  for (const f of FRAGEN.filter((x) => x.typ === 'wahl')) q[f.id] = auszaehlen(f, antworten);

  const texte = {};
  for (const f of TEXTFRAGEN) texte[f.id] = { id: f.id, nr: f.nr, text: f.text, eintraege: texteSammeln(antworten, f.id) };

  const alleTexte = TEXTFRAGEN.flatMap((f) => texte[f.id].eintraege.map((t) => ({ frage: f.nr, text: t })));
  const themenGesamt = themenBuendeln(alleTexte);
  const themenJugendhilfe = themenBuendeln(texte.q10.eintraege.map((t) => ({ frage: 10, text: t })));
  const themenOrga = themenBuendeln(texte.q11.eintraege.map((t) => ({ frage: 11, text: t })));
  const themenVerbesserung = themenBuendeln([...texte.q10.eintraege.map((t) => ({ frage: 10, text: t })), ...texte.q11.eintraege.map((t) => ({ frage: 11, text: t }))]);
  const themenStaerken = themenBuendeln(texte.q13.eintraege.map((t) => ({ frage: 13, text: t })));

  const klassen = [...new Set(antworten.map((a) => (a.klasse || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'de'));
  const entscheidung = entscheiden(q, n, erwartet);

  // Kernaussagen – reine Zahlenaussagen
  const kern = [];
  if (n > 0) {
    const z = (f, keys) => `${f.anzahlVon(keys)} von ${f.gueltig}`;
    kern.push(`Gesamteindruck: ${z(q.q1, ['sehr', 'eher'])} Klassenleitungen (${fmtPct(q.q1.positiv)}) bewerten das Angebot als sehr oder eher gelungen; ${fmtPct(q.q1.negativ)} als eher nicht oder überhaupt nicht gelungen.`);
    kern.push(`Weiterempfehlung: ${fmtPct(q.q2.positiv)} würden das Angebot weiterempfehlen (uneingeschränkt: ${fmtPct(q.q2.anteil(['ja']))}, mit kleineren Anpassungen: ${fmtPct(q.q2.anteil(['ja_anp']))}).`);
    kern.push(`Anspruch: ${fmtPct(q.q3.positiv)} halten den inhaltlichen Anspruch für Jahrgang 8 für genau angemessen.`);
    kern.push(`Pädagogischer Nutzen: ${fmtPct(q.q4.positiv)} schätzen ihn als sehr oder eher hoch ein.`);
    kern.push(`Interesse der Schülerinnen und Schüler: ${interesseEinschaetzung(q.q6)}`);
    kern.push(`Ansprache durch die Mitarbeiterinnen: ${fmtPct(q.q8.positiv)} sehr gut oder gut.`);
    kern.push(`Etablierung in Abteilung II: ${fmtPct(q.q12.positiv)} befürworten eine dauerhafte Etablierung (unbedingt: ${fmtPct(q.q12.anteil(['ja']))}, mit kleineren Anpassungen: ${fmtPct(q.q12.anteil(['ja_anp']))}).`);
    kern.push(`Jahrgang 7: ${jahrgang7Einschaetzung(q.q5)}`);
  }

  return {
    n, erwartet, quote: entscheidung.quote, klassen, q, texte,
    themen: { gesamt: themenGesamt, jugendhilfe: themenJugendhilfe, organisation: themenOrga, verbesserung: themenVerbesserung, staerken: themenStaerken },
    kern, entscheidung,
    jahrgang7: jahrgang7Einschaetzung(q.q5),
    interesse: interesseEinschaetzung(q.q6),
    regeln: REGELN_TEXT,
    themenListe: THEMEN.map((t) => ({ titel: t.titel, muster: t.muster.source })),
  };
}

/** Für JSON-Ausgabe an den Browser (Funktionen entfernen). */
function fuerJson(erg) {
  const q = {};
  for (const [id, f] of Object.entries(erg.q)) {
    const { anteil, anzahlVon, zahl, ...rest } = f; q[id] = rest;
  }
  return { ...erg, q, bereiche: BEREICHE };
}

module.exports = { auswerten, fuerJson, SCHWELLEN, REGELN_TEXT, EMPFEHLUNGEN, THEMEN, fmtPct, rund };

};
M["csv"] = function (module, exports, require, __dirname) {
'use strict';
// CSV-Export der Rohdaten (Semikolon, UTF-8 mit BOM → öffnet in Excel mit korrekten Umlauten).
// Die freiwillige Klassenangabe wird bewusst NICHT exportiert, damit Einzelantworten
// nicht einer Klassenleitung zugeordnet werden können. Reihenfolge der Zeilen ist zufällig.
const { FRAGEN } = require('./fragen');

function zelle(v) {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // Schutz vor Formel-Ausführung in Tabellenprogrammen
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function csvErstellen(antworten) {
  const kopf = ['Nr.', ...FRAGEN.map((f) => `Frage ${f.nr}: ${f.text}`)];
  const zeilen = antworten.map((a, i) => [i + 1, ...FRAGEN.map((f) => {
    const w = a[f.id];
    if (f.typ === 'wahl') return w ? (f.optionen.find((o) => o.k === w) || {}).t : '';
    return w || '';
  })]);
  return '﻿' + [kopf, ...zeilen].map((z) => z.map(zelle).join(';')).join('\r\n') + '\r\n';
}

module.exports = { csvErstellen };

};
M["bericht"] = function (module, exports, require, __dirname) {
'use strict';
// PDF-Gesamtbericht (DIN A4) mit pdfkit. Schrift: Source Sans 3 (OFL) eingebettet → Umlaute und Sonderzeichen.
// Diagramme werden als Vektorgrafik gezeichnet. Vor jedem Block wird der Platz geprüft (sauberer Seitenumbruch).

const path = require('path');
const PDFDocument = require('pdfkit'); // im Browser: pdfkit.standalone.js
const { META, BEREICHE } = require('./fragen');
const { fmtPct } = require('./auswertung');

const SCHRIFT = path.join(__dirname, '..', 'schriften');
const F = { normal: 'SourceSans3_400Regular.ttf', halbfett: 'SourceSans3_600SemiBold.ttf', fett: 'SourceSans3_700Bold.ttf', kursiv: 'SourceSans3_400Regular_Italic.ttf' };
const FARBE = { text: '#253027', leise: '#56635a', salbei: '#6f8f72', salbeiDunkel: '#4c6b50', salbeiHell: '#dfe9dc', flaeche: '#eef3ec', sand: '#f5efe3', sandRand: '#d9b56a', blau: '#e3edf3', grau: '#b7c2bb', rand: '#d5ddd2' };

function datumDeutsch(d = new Date()) {
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Berlin' });
}

function berichtErstellen(erg, optionen = {}) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margins: { top: 64, bottom: 70, left: 62, right: 62 }, bufferPages: true,
      info: { Title: META.berichtTitel, Author: META.verantwortlich, Subject: `${META.schule} – ${META.abteilungKurz}`, Creator: 'Evaluationswerkzeug' } });
    const teile = [];
    doc.on('data', (c) => teile.push(c));
    doc.on('end', () => resolve(optionen.alsBlob ? new Blob(teile, { type: 'application/pdf' }) : Buffer.concat(teile)));
    doc.on('error', reject);

    for (const [k, v] of Object.entries(F)) doc.registerFont(k, optionen.schriften ? optionen.schriften[k] : path.join(SCHRIFT, v));

    // Zeichen ohne Glyphe in der Schrift (z. B. Emojis) entfernen, damit keine Kästchen erscheinen
    doc.font('normal');
    const fk = doc._font.font;
    const sauber = (s) => Array.from(String(s ?? '')).map((ch) => (ch === '\n' || ch === '\u00A0' || fk.hasGlyphForCodePoint(ch.codePointAt(0)) ? ch : '')).join('');

    const L = doc.page.margins.left;
    const B = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const unten = () => doc.page.height - doc.page.margins.bottom;
    const platz = (h) => { if (doc.y + h > unten()) doc.addPage(); };
    const datum = optionen.datum || datumDeutsch();

    const text = (s, o = {}) => {
      doc.font(o.font || 'normal').fontSize(o.size || 10.5).fillColor(o.farbe || FARBE.text);
      doc.text(sauber(s), o.x ?? L, o.y, { width: o.breite || B, lineGap: o.lineGap ?? 2, align: o.align || 'left', continued: o.continued || false, paragraphGap: o.absatz ?? 0 });
    };
    const hoehe = (s, o = {}) => { doc.font(o.font || 'normal').fontSize(o.size || 10.5); return doc.heightOfString(sauber(s), { width: o.breite || B, lineGap: o.lineGap ?? 2 }); };

    let abschnittNr = 1; // 1 = Deckblatt; Zählung wie in der Gliederung des Auftrags
    const abschnitt = (titel, neueSeite = false) => {
      abschnittNr += 1;
      if (neueSeite) doc.addPage(); else { doc.moveDown(0.8); platz(90); }
      const y = doc.y;
      doc.rect(L, y + 3, 4, 20).fill(FARBE.salbei);
      text(`${abschnittNr}. ${titel}`, { font: 'fett', size: 16, x: L + 14, y, breite: B - 14, farbe: FARBE.text });
      doc.moveDown(0.5); doc.x = L;
    };
    const unter = (titel) => { doc.moveDown(0.5); platz(50); text(titel, { font: 'halbfett', size: 12.5, farbe: FARBE.salbeiDunkel }); doc.moveDown(0.25); };
    const absatz = (s, o = {}) => { platz(hoehe(s, o) + 4); text(s, o); doc.moveDown(0.4); };
    const punkte = (liste, o = {}) => {
      for (const p of liste) {
        const h = hoehe(p, { ...o, breite: B - 16 });
        platz(h + 4);
        const y = doc.y;
        doc.circle(L + 4, y + 7, 2).fill(o.punktFarbe || FARBE.salbei);
        text(p, { ...o, x: L + 16, y, breite: B - 16 });
        doc.moveDown(0.25);
      }
    };
    const box = (inhalt, o = {}) => {
      // inhalt: Funktion, die mit (x, breite) zeichnet; vorher Höhe messen
      const pad = o.pad ?? 12;
      const h = o.hoehe(B - 2 * pad) + 2 * pad;
      platz(h + 6);
      const y = doc.y;
      doc.roundedRect(L, y, B, h, 8).fill(o.hg || FARBE.flaeche);
      if (o.randLinks) doc.rect(L, y, 4, h).fill(o.randLinks);
      doc.y = y + pad;
      inhalt(L + pad + (o.randLinks ? 4 : 0), B - 2 * pad - (o.randLinks ? 4 : 0));
      doc.y = y + h + 6; doc.x = L;
    };
    const zitat = (s) => {
      const t = `„${s}“`;
      box((x, br) => text(t, { x, breite: br, size: 10, font: 'kursiv' }), { hoehe: (br) => hoehe(t, { breite: br - 4, size: 10, font: 'kursiv' }), pad: 8, hg: FARBE.flaeche });
    };
    const automatik = (s) => box((x, br) => {
      text('Automatisch erstellte Zuordnung – keine Aussage der Lehrkräfte', { x, breite: br, size: 8.5, font: 'halbfett', farbe: FARBE.leise });
      text(s, { x, breite: br, size: 9.5 });
    }, { hoehe: (br) => hoehe('A', { size: 8.5 }) + hoehe(s, { breite: br - 4, size: 9.5 }) + 2, pad: 9, hg: FARBE.blau });

    // ------------------------------------------------ Diagramm
    function diagramm(f) {
      const zeilenH = 18;
      const labelB = 175;
      const zahlB = 70;
      const spurB = B - labelB - zahlB - 16;
      const titel = `${f.nr}. ${f.text}`;
      const kopfH = hoehe(titel, { font: 'halbfett', size: 11 });
      const ges = kopfH + 10 + f.optionen.length * zeilenH + 34 + (f.entscheidend ? 12 : 0);
      platz(ges);
      const yStart = doc.y;
      if (f.entscheidend) {
        doc.font('fett').fontSize(8);
        const marke = 'ENTSCHEIDUNGSRELEVANT';
        const mb = doc.widthOfString(marke) + 14;
        doc.roundedRect(L, doc.y, mb, 13, 6).fill(FARBE.sand);
        text(marke, { x: L + 7, y: yStart + 2.5, size: 8, font: 'fett', farbe: '#7a5a1e' });
        doc.y = yStart + 17;
      }
      text(titel, { font: 'halbfett', size: 11 });
      doc.moveDown(0.3);
      let y = doc.y;
      for (const o of f.optionen) {
        doc.font('normal').fontSize(9.5).fillColor(o.neutral ? FARBE.leise : FARBE.text);
        doc.text(sauber(o.t), L, y + 3, { width: labelB - 6, lineBreak: false, ellipsis: true });
        const sx = L + labelB;
        doc.roundedRect(sx, y + 2, spurB, zeilenH - 5, 3).fill(FARBE.flaeche);
        const w = o.prozent ? Math.max((spurB * o.prozent) / 100, 2) : 0;
        if (w > 0) doc.roundedRect(sx, y + 2, w, zeilenH - 5, 3).fill(o.neutral ? FARBE.grau : FARBE.salbei);
        doc.font('normal').fontSize(9.5).fillColor(FARBE.leise)
          .text(`${o.anzahl}  ·  ${fmtPct(o.prozent)}`, sx + spurB + 8, y + 3, { width: zahlB + 8, align: 'right', lineBreak: false });
        y += zeilenH;
      }
      doc.y = y + 2; doc.x = L;
      const neutralTxt = f.optionen.some((o) => o.neutral) ? ` · „nicht beurteilbar“: ${f.neutral} (${fmtPct(f.neutralProzent)} aller Antworten, gesondert ausgewiesen)` : '';
      text(`Gültige Antworten: ${f.gueltig}${neutralTxt}${f.ohneAngabe ? ` · ohne Angabe: ${f.ohneAngabe}` : ''}`, { size: 8.5, farbe: FARBE.leise });
      doc.moveDown(1.1);
    }

    // ================================================ 1 Deckblatt
    doc.rect(0, 0, doc.page.width, 250).fill(FARBE.salbeiHell);
    doc.rect(0, 250, doc.page.width, 5).fill(FARBE.salbei);
    text(META.schule.toUpperCase(), { y: 92, size: 10.5, font: 'halbfett', farbe: FARBE.salbeiDunkel });
    text(META.berichtTitel, { y: 118, size: 25, font: 'fett', lineGap: 3 });
    doc.y = 310;
    const zeile = (k, v) => {
      const y = doc.y;
      text(k, { y, size: 10.5, farbe: FARBE.leise, breite: 140 });
      text(v, { x: L + 150, y, size: 12, font: 'halbfett', breite: B - 150 });
      doc.moveDown(0.7);
    };
    zeile('Schule', META.schule);
    zeile('Abteilung', META.abteilung);
    zeile('Befragte', META.zielgruppe);
    zeile('Verantwortlich', META.verantwortlich);
    zeile('Auswertungsdatum', datum);
    zeile('Eingegangene Bögen', `${erg.n}${erg.erwartet ? ` von ${erg.erwartet} erwarteten (Rücklaufquote ${fmtPct(erg.quote)})` : ''}`);
    doc.y = unten() - 70;
    text('Vertraulich – nur für den Dienstgebrauch der Abteilungsleitung. Die Befragung erfolgte anonym; der Bericht enthält keine personenbezogenen Daten von Schülerinnen und Schülern.', { size: 9, farbe: FARBE.leise });

    // ================================================ 2 Zielsetzung
    abschnitt('Zielsetzung der Evaluation', true);
    absatz('Das Präventionsangebot wurde von Mitarbeiterinnen der Jugendhilfe der Stadt Voerde in den Klassen des 8. Jahrgangs durchgeführt. Die Klassenleitungen wurden anschließend anonym und ohne Registrierung online befragt. Die Evaluation soll der Abteilungsleitung eine fundierte Entscheidungsgrundlage liefern. Leitfragen:');
    punkte([
      'War das Präventionsangebot insgesamt erfolgreich?',
      'War es für Schülerinnen und Schüler des 8. Jahrgangs pädagogisch sinnvoll und altersangemessen?',
      'Wie wurden das Interesse und die Beteiligung der Schülerinnen und Schüler eingeschätzt?',
      'Sollte das Angebot langfristig in Abteilung II fortgeführt werden?',
      'Ist eine Durchführung bereits im 7. Jahrgang sinnvoll?',
      'Welche Verbesserungsmöglichkeiten ergeben sich für die durchführenden Mitarbeiterinnen und die schulische Organisation?',
    ]);
    unter('Hinweise zum Lesen des Berichts');
    punkte([
      'Prozentwerte beziehen sich auf die gültigen Antworten einer Frage. „Nicht beurteilbar“ bzw. „Kann ich nicht beurteilen“ wird gesondert ausgewiesen und nicht mitgerechnet.',
      'Freitextantworten werden vollständig und wörtlich wiedergegeben (alphabetisch sortiert, ohne Zuordnung zu Klassen).',
      'Blau hinterlegte Kästen enthalten automatisch erstellte Zuordnungen oder Zusammenfassungen. Sie sind keine Aussagen der Lehrkräfte.',
      'Die Fragen 2, 3, 5 und 12 sind für die Entscheidung über die zukünftige Durchführung besonders maßgeblich und entsprechend markiert.',
    ], { size: 10 });

    // ================================================ 3 Teilnahme
    abschnitt('Teilnahme und Rücklaufquote');
    absatz(erg.erwartet
      ? `Es sind ${erg.n} von ${erg.erwartet} erwarteten Evaluationen eingegangen. Das entspricht einer Rücklaufquote von ${fmtPct(erg.quote)}.`
      : `Es sind ${erg.n} Evaluationen eingegangen. Die erwartete Anzahl der Klassenleitungen wurde nicht hinterlegt, daher kann keine Rücklaufquote angegeben werden.`);
    if (erg.klassen.length) absatz(`Freiwillig angegebene Klassen: ${erg.klassen.join(', ')}. (Die Angabe ist nicht mit einzelnen Antworten verknüpft.)`, { size: 10, farbe: FARBE.leise });

    // ================================================ 4 Zusammenfassung
    abschnitt('Zusammenfassung der wichtigsten Ergebnisse');
    if (!erg.n) absatz('Es liegen noch keine Evaluationen vor.');
    else {
      automatik('Die folgenden Sätze wurden automatisch aus den Häufigkeiten gebildet. Sie geben ausschließlich Zahlen wieder und enthalten keine zusätzliche Bewertung.');
      punkte(erg.kern, { size: 10.5 });
    }

    // ================================================ 5 Quantitativ
    abschnitt('Quantitative Auswertung der geschlossenen Fragen', true);
    for (const b of BEREICHE) {
      const fr = Object.values(erg.q).filter((f) => f.bereich === b.id);
      if (!fr.length) continue;
      unter(`Bereich ${b.id}: ${b.titel}`);
      doc.moveDown(0.2);
      fr.forEach(diagramm);
    }

    // ================================================ 6 Qualitativ
    const textBlock = (id) => {
      const t = erg.texte[id];
      unter(`${t.nr}. ${t.text}`);
      text(`${t.eintraege.length} Rückmeldung(en)`, { size: 9, farbe: FARBE.leise }); doc.moveDown(0.3);
      if (!t.eintraege.length) absatz('Keine Rückmeldungen.', { farbe: FARBE.leise, size: 10 });
      t.eintraege.forEach(zitat);
    };
    const themen = (liste, ueberschrift) => {
      if (!liste.length) return;
      const zeilen = liste.map((t) => `${t.titel}: ${t.anzahl} Nennung(en)`);
      const s = `${ueberschrift}\n` + zeilen.map((z) => `•  ${z}`).join('\n') + '\nDie Zuordnung erfolgt über feste Stichwörter und sagt nur aus, dass ein Thema angesprochen wurde – nicht, ob positiv oder kritisch.';
      automatik(s);
    };
    abschnitt('Qualitative Auswertung der Freitextantworten', true);
    absatz('Die Freitexte werden vollständig und wörtlich wiedergegeben. Die Antworten zu den Fragen 10, 11 und 13 folgen in den Abschnitten 7 bis 9.', { size: 10, farbe: FARBE.leise });
    themen(erg.themen.gesamt, 'Wiederkehrende Themen über alle Freitextfelder:');
    textBlock('q2_text');
    textBlock('q5_text');
    textBlock('q14');

    // ================================================ 7–9
    abschnitt('Stärken des Präventionsangebots');
    themen(erg.themen.staerken, 'Angesprochene Themen in Frage 13:');
    textBlock('q13');
    abschnitt('Genannte Verbesserungsmöglichkeiten für die Jugendhilfe der Stadt Voerde');
    themen(erg.themen.jugendhilfe, 'Angesprochene Themen in Frage 10:');
    textBlock('q10');
    abschnitt('Organisatorische Hinweise für die Abteilungsleitung');
    themen(erg.themen.organisation, 'Angesprochene Themen in Frage 11:');
    textBlock('q11');

    // ================================================ 10 Entscheidungsgrundlage
    const e = erg.entscheidung;
    abschnitt('Entscheidungsgrundlage zur langfristigen Fortführung', true);
    absatz('Die vorläufige Einschätzung wird nicht aus einem Durchschnittswert gebildet, sondern aus festen, hier offen gelegten Regeln. Sie berücksichtigt Rücklaufquote, Verteilung der Antworten und mögliche Widersprüche. Die Regeln werden der Reihe nach geprüft; die erste zutreffende Regel bestimmt das Ergebnis.', { size: 10 });
    unter('Entscheidungsregeln');
    punkte(erg.regeln, { size: 9.5 });
    unter('Prüfung mit den vorliegenden Daten');
    for (const g of e.geprueft) {
      const s = `${g.regel} – ${g.erfuellt ? 'trifft zu' : 'trifft nicht zu'}: ${g.text}`;
      punkte([s], { size: 9.5, punktFarbe: g.erfuellt ? FARBE.salbeiDunkel : FARBE.grau });
    }
    if (e.vorbehalte.length) { unter('Vorbehalte'); punkte(e.vorbehalte, { size: 9.5, punktFarbe: FARBE.sandRand }); }

    // ================================================ Fazit-Seite
    doc.addPage();
    doc.rect(0, 0, doc.page.width, 8).fill(FARBE.salbei);
    doc.y = doc.page.margins.top - 10;
    text('Fazit und Entscheidung zur zukünftigen Durchführung', { font: 'fett', size: 19 });
    doc.moveDown(0.5);
    const q = erg.q;
    const kv = [
      ['Weiterempfehlung (Frage 2)', `${fmtPct(q.q2.positiv)} empfehlen das Angebot weiter (uneingeschränkt ${fmtPct(q.q2.anteil(['ja']))}, mit kleineren Anpassungen ${fmtPct(q.q2.anteil(['ja_anp']))}; n = ${q.q2.gueltig})`],
      ['Anspruch angemessen (Frage 3)', `${fmtPct(q.q3.positiv)} „genau angemessen“ (zu niedrig ${fmtPct(q.q3.anteil(['d_niedrig', 'e_niedrig']))}, zu hoch ${fmtPct(q.q3.anteil(['e_hoch', 'd_hoch']))}; n = ${q.q3.gueltig})`],
      ['Interesse der Schülerinnen und Schüler (Frage 6)', erg.interesse],
      ['Dauerhafte Etablierung (Frage 12)', `${fmtPct(q.q12.positiv)} befürworten (unbedingt ${fmtPct(q.q12.anteil(['ja']))}, mit kleineren Anpassungen ${fmtPct(q.q12.anteil(['ja_anp']))}, nur nach Überarbeitung ${fmtPct(q.q12.anteil(['ueberarb']))}, nein ${fmtPct(q.q12.anteil(['nein']))}; n = ${q.q12.gueltig}, ${q.q12.neutral}× „Kann ich derzeit nicht beurteilen“)`],
      ['Eignung für Jahrgang 7 (Frage 5)', erg.jahrgang7],
    ];
    const bedarfe = erg.themen.verbesserung.slice(0, 6).map((t) => `${t.titel} (${t.anzahl}×)`);
    kv.push(['Wesentliche Verbesserungsbedarfe', bedarfe.length ? `Am häufigsten angesprochene Themen in den Verbesserungsvorschlägen (Fragen 10 und 11, automatische Stichwortzuordnung): ${bedarfe.join('; ')}. Wortlaut siehe Abschnitte 8 und 9.` : 'In den Freitexten wurden keine wiederkehrenden Verbesserungsthemen erkannt. Wortlaut siehe Abschnitte 8 und 9.']);
    for (const [k, v] of kv) {
      const h = hoehe(k, { font: 'halbfett', size: 10 }) + hoehe(v, { size: 10, breite: B - 20 }) + 12;
      platz(h);
      const y = doc.y;
      doc.rect(L, y, B, h).fill(FARBE.flaeche);
      text(k, { x: L + 10, y: y + 5, font: 'halbfett', size: 10, farbe: FARBE.salbeiDunkel, breite: B - 20 });
      text(v, { x: L + 10, size: 10, breite: B - 20 });
      doc.y = y + h + 3; doc.x = L;
    }
    doc.moveDown(0.6);
    const empfText = `Vorläufige datenbasierte Gesamteinschätzung (Regel ${e.regel}):`;
    const hinweis = 'Diese Einschätzung ist eine automatisch und regelbasiert ermittelte Orientierung. Die endgültige Entscheidung bleibt ausdrücklich bei der Abteilungsleitung.';
    const vorb = e.vorbehalte.length ? `Zu beachten: ${e.vorbehalte.join(' ')}` : '';
    box((x, br) => {
      text(empfText, { x, breite: br, size: 9.5, font: 'halbfett', farbe: FARBE.salbeiDunkel });
      text(e.titel, { x, breite: br, size: 15, font: 'fett' });
      if (vorb) { doc.moveDown(0.2); text(vorb, { x, breite: br, size: 9 }); }
      doc.moveDown(0.2); text(hinweis, { x, breite: br, size: 9, font: 'kursiv', farbe: FARBE.leise });
    }, { hoehe: (br) => hoehe(empfText, { breite: br, size: 9.5, font: 'halbfett' }) + hoehe(e.titel, { breite: br, size: 15, font: 'fett' }) + (vorb ? hoehe(vorb, { breite: br, size: 9 }) + 4 : 0) + hoehe(hinweis, { breite: br, size: 9, font: 'kursiv' }) + 6,
      hg: FARBE.salbeiHell, randLinks: FARBE.salbei, pad: 14 });

    // Feld für die Abteilungsleitung – mindestens 220 pt Schreibfläche, sonst neue Seite
    doc.moveDown(0.4);
    if (doc.y + 290 > unten()) doc.addPage();
    text('Abschließende Bewertung und Entscheidung der Abteilungsleitung – WIDE', { font: 'fett', size: 12.5 });
    doc.moveDown(0.3);
    const y0 = doc.y;
    const feldH = Math.max(unten() - y0 - 52, 220);
    doc.roundedRect(L, y0, B, feldH, 6).lineWidth(1).strokeColor(FARBE.rand).stroke();
    for (let ly = y0 + 28; ly < y0 + feldH - 10; ly += 24) doc.moveTo(L + 12, ly).lineTo(L + B - 12, ly).lineWidth(0.4).strokeColor(FARBE.rand).stroke();
    doc.y = y0 + feldH + 22;
    const yU = doc.y;
    doc.moveTo(L, yU).lineTo(L + 170, yU).lineWidth(0.7).strokeColor(FARBE.leise).stroke();
    doc.moveTo(L + B - 230, yU).lineTo(L + B, yU).stroke();
    text('Datum', { x: L, y: yU + 4, size: 9, farbe: FARBE.leise, breite: 170 });
    text('Unterschrift WIDE (BL Abt. II)', { x: L + B - 230, y: yU + 4, size: 9, farbe: FARBE.leise, breite: 230 });

    // ------------------------------------------------ Fußzeilen
    const bereich = doc.bufferedPageRange();
    for (let i = 0; i < bereich.count; i++) {
      doc.switchToPage(i);
      if (optionen.beispiel) {
        const altB = doc.page.margins.bottom; doc.page.margins.bottom = 0;
        doc.font('fett').fontSize(9).fillColor('#a4442f').text('BEISPIELDATEN – keine echten Rückmeldungen', L, 24, { width: B, align: 'right', lineBreak: false });
        doc.page.margins.bottom = altB;
      }
      if (i === 0) continue;
      const alt = doc.page.margins.bottom; doc.page.margins.bottom = 0;
      doc.font('normal').fontSize(8.5).fillColor(FARBE.leise);
      doc.text(`${META.schule} · ${META.abteilungKurz} · Evaluation Präventionsangebot · ${datum}`, L, doc.page.height - 42, { width: B - 80, lineBreak: false });
      doc.text(`Seite ${i + 1} von ${bereich.count}`, L + B - 80, doc.page.height - 42, { width: 80, align: 'right', lineBreak: false });
      doc.page.margins.bottom = alt;
    }
    doc.end();
  });
}

module.exports = { berichtErstellen, SCHRIFT_DATEIEN: F };

};

let pdfLaden = null;
window.EVAL = {
  offen: true,
  code: req('./code'), auswertung: req('./auswertung'), csv: req('./csv'),
  ladeBericht() {
    pdfLaden ||= new Promise((ok, fehler) => {
      if (window.PDFDocument) return ok();
      // pdfkit liegt gzip-komprimiert vor (2,6 MB → 0,6 MB) und wird hier entpackt
      fetch('pdfkit-standalone.bin').then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); })
        .then(async (buf) => {
          let bytes = new Uint8Array(buf);
          if (bytes[0] === 0x1f && bytes[1] === 0x8b) bytes = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
          const url = URL.createObjectURL(new Blob([bytes], { type: 'text/javascript' }));
          const s = document.createElement('script'); s.src = url;
          s.onload = () => { URL.revokeObjectURL(url); ok(); };
          s.onerror = () => fehler(new Error('PDF-Bibliothek konnte nicht gestartet werden.'));
          document.head.append(s);
        })
        .catch((e) => fehler(new Error('PDF-Bibliothek konnte nicht geladen werden (' + e.message + ').')));
    });
    return pdfLaden.then(() => req('./bericht'));
  },
};
})();
