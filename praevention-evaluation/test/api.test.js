'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { createApp } = require('../src/app');
const { demoResponses } = require('../scripts/demo-data');

const PASSWORD = 'Test-Passwort-123';
let server, base, ctx, dir, cookie = '';

const valid = () => ({ q1: 'sehr_gelungen', q2: 'ja_voll', q3: 'angemessen', q4: 'sehr_hoch', q5: 'ja_anpassung', q6: 'sehr_gross', q7: 'sehr_aktiv', q8: 'sehr_gut', q9: 'sehr_gelungen', q12: 'unbedingt' });
const token = () => require('crypto').randomUUID();

async function req(method, url, body, headers = {}) {
  const res = await fetch(base + url, {
    method,
    headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const sc = res.headers.get('set-cookie');
  if (sc) cookie = sc.split(';')[0];
  return res;
}
const admin = (method, url, body) => req(method, url, body, { 'X-Requested-With': 'evaluation-admin' });

test.before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'evaltest-'));
  ctx = createApp({ dataDir: dir, env: { ADMIN_PASSWORD: PASSWORD } });
  await new Promise((r) => { server = ctx.app.listen(0, '127.0.0.1', r); });
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => { server.close(); ctx.db.close(); fs.rmSync(dir, { recursive: true, force: true }); });

test('Fragebogen-Definition und Startseite sind öffentlich abrufbar', async () => {
  const res = await req('GET', '/api/form');
  assert.strictEqual(res.status, 200);
  const d = await res.json();
  assert.strictEqual(d.questions.length, 14);
  assert.strictEqual(d.open, true);
  const page = await req('GET', '/');
  assert.strictEqual(page.status, 200);
  assert.match(page.headers.get('content-security-policy'), /default-src 'self'/);
});

test('Pflichtfragen werden geprüft, ungültige Werte abgelehnt', async () => {
  let res = await req('POST', '/api/responses', { token: token(), answers: { q1: 'sehr_gelungen' } });
  assert.strictEqual(res.status, 400);
  const body = await res.json();
  assert.ok(body.details.some((d) => d.includes('Frage 2')));
  res = await req('POST', '/api/responses', { token: token(), answers: { ...valid(), q3: 'quatsch' } });
  assert.strictEqual(res.status, 400);
  res = await req('POST', '/api/responses', { token: token(), classLabel: '<script>', answers: valid() });
  assert.strictEqual(res.status, 400);
});

test('Gültige Abgabe wird gespeichert; Doppelklick erzeugt keinen Doppeleintrag', async () => {
  const t = token();
  const payload = { token: t, classLabel: '8c', answers: { ...valid(), q10: 'Mehr Zeit einplanen.', unbekannt: 'x' } };
  const results = await Promise.all([1, 2, 3].map(() => req('POST', '/api/responses', payload)));
  const statuses = results.map((r) => r.status).sort();
  assert.deepStrictEqual(statuses, [200, 200, 201]);
  assert.strictEqual(ctx.db.countResponses(), 1);
  const stored = ctx.db.listResponses()[0];
  assert.strictEqual(stored.answers.unbekannt, undefined, 'unbekannte Felder werden verworfen');
  assert.match(stored.submittedOn, /^\d{4}-\d\d-\d\d$/, 'nur Datum, keine Uhrzeit');
});

test('Administrationsbereich ist ohne Anmeldung gesperrt', async () => {
  for (const u of ['/api/admin/results', '/api/admin/export.csv', '/api/admin/report.pdf', '/api/admin/backup.json', '/api/admin/responses']) {
    const res = await req('GET', u);
    assert.strictEqual(res.status, 401, u);
  }
  const res = await req('PUT', '/api/admin/settings', { open: false }, { 'X-Requested-With': 'evaluation-admin' });
  assert.strictEqual(res.status, 401);
});

test('Falsches Passwort wird abgelehnt, richtiges erzeugt Sitzung', async () => {
  let res = await admin('POST', '/api/admin/login', { password: 'falsch-falsch' });
  assert.strictEqual(res.status, 401);
  res = await req('POST', '/api/admin/login', { password: PASSWORD });
  assert.strictEqual(res.status, 403, 'ohne Schutz-Header abgelehnt');
  res = await admin('POST', '/api/admin/login', { password: PASSWORD });
  assert.strictEqual(res.status, 200);
  assert.match(cookie, /^eval_admin=/);
});

test('Verändernde Admin-Anfragen ohne Schutz-Header oder fremder Herkunft werden abgelehnt', async () => {
  let res = await req('PUT', '/api/admin/settings', { open: false });
  assert.strictEqual(res.status, 403);
  res = await req('PUT', '/api/admin/settings', { open: false }, { 'X-Requested-With': 'evaluation-admin', Origin: 'https://evil.example' });
  assert.strictEqual(res.status, 403);
});

test('Auswertung, CSV, PDF und Sicherung', async () => {
  ctx.db.importResponses(demoResponses());
  let res = await admin('PUT', '/api/admin/settings', { expected: 10 });
  assert.strictEqual(res.status, 200);
  res = await admin('GET', '/api/admin/results');
  const a = await res.json();
  assert.strictEqual(a.n, 8);
  assert.strictEqual(a.expected, 10);
  assert.strictEqual(a.closed.q1.options.reduce((s, o) => s + o.count, 0), 8);
  assert.ok(a.decision.label);
  assert.ok(a.texts.q10.entries.length >= 1);

  res = await admin('GET', '/api/admin/export.csv');
  const raw = Buffer.from(await res.arrayBuffer());
  assert.deepStrictEqual([...raw.subarray(0, 3)], [0xEF, 0xBB, 0xBF], 'UTF-8-BOM für Excel');
  const csv = raw.toString('utf8');
  assert.strictEqual(csv.trim().split('\r\n').length, 9);
  assert.match(csv, /Überhaupt|Sehr gelungen/);

  res = await admin('GET', '/api/admin/report.pdf');
  assert.strictEqual(res.headers.get('content-type'), 'application/pdf');
  const pdf = Buffer.from(await res.arrayBuffer());
  assert.strictEqual(pdf.subarray(0, 5).toString(), '%PDF-');
  const f = path.join(dir, 'r.pdf');
  fs.writeFileSync(f, pdf);
  try {
    const txt = execFileSync('pdftotext', [f, '-'], { encoding: 'utf8' }).replace(/\s+/g, ' ');
    for (const s of ['Fazit und Entscheidung zur zukünftigen Durchführung', 'Abschließende Bewertung und Entscheidung der Abteilungsleitung – WIDE', 'Präventionsangebot', 'Rücklaufquote', 'Zielsetzung der Evaluation']) {
      assert.ok(txt.includes(s), `PDF enthält „${s}“`);
    }
  } catch (e) {
    if (e.code !== 'ENOENT') throw e; // pdftotext nicht installiert → Textprüfung überspringen
  }

  res = await admin('GET', '/api/admin/backup.json');
  const b = await res.json();
  assert.strictEqual(b.responses.length, 8);
});

test('Evaluation schließen und wieder öffnen', async () => {
  let res = await admin('PUT', '/api/admin/settings', { open: false });
  assert.strictEqual(res.status, 200);
  res = await req('POST', '/api/responses', { token: token(), answers: valid() });
  assert.strictEqual(res.status, 423);
  res = await req('GET', '/api/form');
  assert.strictEqual((await res.json()).open, false);
  res = await admin('PUT', '/api/admin/settings', { open: true });
  res = await req('POST', '/api/responses', { token: token(), answers: valid() });
  assert.strictEqual(res.status, 201);
});

test('Einzel- und Gesamtlöschung', async () => {
  let res = await admin('GET', '/api/admin/responses');
  const list = await res.json();
  res = await admin('DELETE', `/api/admin/responses/${list[0].id}`);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(ctx.db.countResponses(), list.length - 1);
  res = await admin('POST', '/api/admin/responses/delete-all', { confirm: 'ja' });
  assert.strictEqual(res.status, 400);
  res = await admin('POST', '/api/admin/responses/delete-all', { confirm: 'LÖSCHEN' });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(ctx.db.countResponses(), 0);
});

test('Abmelden beendet die Sitzung', async () => {
  await admin('POST', '/api/admin/logout', {});
  const res = await req('GET', '/api/admin/results');
  assert.strictEqual(res.status, 401);
});
