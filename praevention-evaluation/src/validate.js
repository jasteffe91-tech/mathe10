'use strict';
const { QUESTIONS, TEXT_MAX, CLASS_MAX, textFields } = require('./questions');

const TOKEN_RE = /^[A-Za-z0-9-]{16,64}$/;
const CLASS_RE = /^[A-Za-z0-9ÄÖÜäöüß .\-/]+$/;

function cleanText(v) {
  return String(v)
    .replace(/\r\n?/g, '\n')
    // Steuerzeichen außer Zeilenumbruch und Tabulator entfernen
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim();
}

/**
 * Prüft eine Abgabe. Unbekannte Felder werden verworfen (Datensparsamkeit).
 * @returns {{ok: true, value: object} | {ok: false, errors: string[]}}
 */
function validateSubmission(body) {
  const errors = [];
  if (!body || typeof body !== 'object') return { ok: false, errors: ['Ungültige Anfrage.'] };

  const token = typeof body.token === 'string' ? body.token : '';
  if (!TOKEN_RE.test(token)) errors.push('Ungültiges Abgabe-Token.');

  let classLabel = null;
  if (body.classLabel !== undefined && body.classLabel !== null && String(body.classLabel).trim() !== '') {
    classLabel = cleanText(body.classLabel).replace(/\s+/g, ' ');
    if (classLabel.length > CLASS_MAX || !CLASS_RE.test(classLabel)) {
      errors.push(`Die Klassenbezeichnung darf höchstens ${CLASS_MAX} Zeichen (Buchstaben, Ziffern) enthalten.`);
    }
  }

  const input = body.answers && typeof body.answers === 'object' ? body.answers : {};
  const answers = {};
  for (const q of QUESTIONS.filter((x) => x.type === 'single')) {
    const v = input[q.id];
    if (v === undefined || v === null || v === '') {
      if (q.required) errors.push(`Frage ${q.number} ist eine Pflichtfrage.`);
      continue;
    }
    if (!q.options.some((op) => op.value === v)) {
      errors.push(`Ungültige Antwort bei Frage ${q.number}.`);
      continue;
    }
    answers[q.id] = v;
  }
  for (const f of textFields()) {
    const v = input[f.id];
    if (v === undefined || v === null) continue;
    if (typeof v !== 'string') { errors.push(`Ungültige Eingabe bei Frage ${f.number}.`); continue; }
    const t = cleanText(v);
    if (t.length > TEXT_MAX) { errors.push(`Der Text bei Frage ${f.number} ist länger als ${TEXT_MAX} Zeichen.`); continue; }
    if (t) answers[f.id] = t;
  }

  if (errors.length) return { ok: false, errors };
  return { ok: true, value: { token, classLabel, answers } };
}

module.exports = { validateSubmission, cleanText };
