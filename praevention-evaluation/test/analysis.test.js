'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { analyze, detectThemes } = require('../src/analysis');
const { toCsv } = require('../src/csv');
const { verifyPassword, hashPassword } = require('../src/auth');

const base = { q1: 'sehr_gelungen', q2: 'ja_voll', q3: 'angemessen', q4: 'sehr_hoch', q5: 'ja_anpassung', q6: 'sehr_gross', q7: 'sehr_aktiv', q8: 'sehr_gut', q9: 'sehr_gelungen', q12: 'unbedingt' };
const mk = (list) => list.map((answers, i) => ({ id: String(i), submittedOn: '2026-11-15', classLabel: null, answers: { ...base, ...answers } }));
const many = (n, a = {}) => Array.from({ length: n }, () => ({ ...a }));

test('Prozentbasis ohne „nicht beurteilbar“', () => {
  const a = analyze(mk([{ q4: 'sehr_hoch' }, { q4: 'mittel' }, { q4: 'nb' }, { q4: 'nb' }]));
  const q4 = a.closed.q4;
  assert.strictEqual(q4.answered, 4);
  assert.strictEqual(q4.valid, 2);
  assert.strictEqual(q4.nbCount, 2);
  assert.strictEqual(q4.options.find((o) => o.value === 'sehr_hoch').pct, 50);
  assert.strictEqual(q4.nbPct, 50);
});

test('Zu wenige Daten → keine belastbare Empfehlung', () => {
  assert.strictEqual(analyze(mk(many(2))).decision.code, 'insufficient');
  assert.strictEqual(analyze(mk(many(4)), { expected: 20 }).decision.code, 'insufficient', 'Rücklauf 20 % < 33 %');
  assert.strictEqual(analyze(mk(many(5, { q12: 'nb', q2: 'ja_voll' })), { expected: 6 }).decision.code, 'insufficient', 'F12 nur „nicht beurteilbar“');
});

test('Eindeutig positiv → Fortführung ohne wesentliche Veränderungen', () => {
  const a = analyze(mk(many(8)), { expected: 9 });
  assert.strictEqual(a.decision.code, 'continue');
  assert.strictEqual(a.decision.strength, 'gut belastbar');
});

test('Positiv mit Anpassungswünschen → gezielte Anpassungen', () => {
  const a = analyze(mk([...many(4, { q2: 'ja_anpassung', q12: 'ja_anpassung' }), ...many(2), ...many(1, { q2: 'bedingt', q12: 'ueberarbeitung', q1: 'teils' })]), { expected: 8 });
  assert.strictEqual(a.decision.code, 'adjust');
});

test('Mehrheit ablehnend → keine Fortführung', () => {
  const a = analyze(mk([...many(4, { q12: 'nein', q2: 'nein', q1: 'eher_nicht' }), ...many(2)]), { expected: 6 });
  assert.strictEqual(a.decision.code, 'none');
});

test('Gespaltenes Bild wird erkannt und verhindert „ohne Veränderungen“', () => {
  const a = analyze(mk([...many(4), ...many(3, { q1: 'gar_nicht', q12: 'ueberarbeitung', q2: 'nein' })]), { expected: 7 });
  assert.ok(a.decision.polarised);
  assert.notStrictEqual(a.decision.code, 'continue');
  assert.strictEqual(a.decision.code, 'revise');
});

test('Hoher Durchschnitt allein genügt nicht: Anspruch unangemessen → Überarbeitung', () => {
  const a = analyze(mk(many(6, { q3: 'eher_hoch' })), { expected: 6 });
  assert.strictEqual(a.decision.code, 'revise');
});

test('Ohne erwartete Anzahl: Hinweis auf unbekannte Rücklaufquote und eingeschränkte Belastbarkeit', () => {
  const a = analyze(mk(many(8)));
  assert.strictEqual(a.decision.strength, 'eingeschränkt belastbar');
  assert.ok(a.decision.caveats.some((c) => c.includes('unbekannt')));
});

test('Themenerkennung per Stichwort', () => {
  assert.deepStrictEqual(detectThemes('Die Doppelstunde war zu kurz.').includes('zeit'), true);
  assert.ok(!detectThemes('Es war langweilig.').includes('zeit'), '„langweilig“ ist kein Zeitthema');
  assert.ok(detectThemes('Es war langweilig.').includes('beteiligung'));
  assert.ok(detectThemes('Mehr Rollenspiele bitte').includes('methoden'));
  assert.ok(!detectThemes('zum Beispiel').includes('methoden'));
});

test('Freitexte vollständig und Themen nur bei Wiederholung', () => {
  const a = analyze(mk([{ q10: 'Mehr Zeit.' }, { q10: 'Längere Dauer wäre gut' }, { q10: 'Mehr Methoden' }]));
  assert.strictEqual(a.texts.q10.entries.length, 3);
  assert.deepStrictEqual(a.texts.q10.themes.map((t) => t.id), ['zeit']);
});

test('CSV schützt vor Formel-Injektion', () => {
  const csv = toCsv(mk([{ q10: '=HYPERLINK("x")' }]));
  assert.ok(csv.includes(`"'=HYPERLINK(""x"")"`));
});

test('Passwort-Hashing', () => {
  const h = hashPassword('ein-sicheres-passwort');
  assert.ok(verifyPassword('ein-sicheres-passwort', h));
  assert.ok(!verifyPassword('falsch', h));
  assert.ok(!verifyPassword('x', 'kaputt'));
});
