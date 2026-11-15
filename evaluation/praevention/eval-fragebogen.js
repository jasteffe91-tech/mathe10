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

const F = req('./fragen');
window.EVAL_STATISCH = {
  def: { meta: F.META, bereiche: F.BEREICHE, fragen: F.FRAGEN, maxText: F.MAX_TEXT, maxKlasse: F.MAX_KLASSE },
  offen: true,
  empfaenger: "",
  codeErzeugen: req('./code').codeErzeugen,
};
})();
