'use strict';
const { QUESTIONS, textFields } = require('./questions');

/** Schutz vor Formel-Injektion in Tabellenkalkulationen (=, +, -, @, Tab, CR am Zellanfang). */
function cell(v) {
  if (v === null || v === undefined) return '';
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[";\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** CSV im für deutsches Excel geeigneten Format (UTF-8 mit BOM, Semikolon als Trennzeichen). */
function toCsv(responses) {
  const closed = QUESTIONS.filter((q) => q.type === 'single');
  const texts = textFields();
  const header = ['Nr', 'Abgabedatum', 'Klasse (freiwillig)'];
  for (const q of closed) header.push(`F${q.number} ${q.text}`);
  for (const f of texts) header.push(`F${f.number} ${f.parent ? 'Ergänzung: ' : ''}${f.label}`);

  const rows = [header];
  responses.forEach((r, i) => {
    const row = [i + 1, r.submittedOn, r.classLabel || ''];
    for (const q of closed) {
      const op = q.options.find((x) => x.value === r.answers[q.id]);
      row.push(op ? op.label : '');
    }
    for (const f of texts) row.push(r.answers[f.id] || '');
    rows.push(row);
  });
  return '﻿' + rows.map((row) => row.map(cell).join(';')).join('\r\n') + '\r\n';
}

module.exports = { toCsv, cell };
