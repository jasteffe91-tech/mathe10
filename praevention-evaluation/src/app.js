'use strict';
const path = require('path');
const express = require('express');
const { openDatabase } = require('./db');
const { createAuth } = require('./auth');
const { publicDefinition } = require('./questions');
const { validateSubmission } = require('./validate');
const { analyze } = require('./analysis');
const { toCsv } = require('./csv');
const { buildReport } = require('./report');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');

/** Einfache Mengenbegrenzung für Abgaben (nur im Arbeitsspeicher, nichts wird protokolliert). */
function submitLimiter({ max = 40, windowMs = 10 * 60 * 1000 } = {}) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip;
    const e = hits.get(key);
    if (!e || now - e.start > windowMs) hits.set(key, { start: now, count: 1 });
    else if (++e.count > max) return res.status(429).json({ error: 'Zu viele Anfragen. Bitte später erneut versuchen.' });
    if (hits.size > 5000) hits.clear();
    next();
  };
}

function createApp({ dataDir, env = process.env } = {}) {
  const db = openDatabase(dataDir);
  const auth = createAuth({ db, dataDir, env });
  const app = express();

  app.disable('x-powered-by');
  app.set('strict routing', true);
  if (env.TRUST_PROXY) app.set('trust proxy', env.TRUST_PROXY === 'true' ? 1 : env.TRUST_PROXY);

  // Sicherheits-Header; keine externen Quellen, kein Tracking.
  app.use((req, res, next) => {
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'");
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=()');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    if (req.secure) res.setHeader('Strict-Transport-Security', 'max-age=31536000');
    next();
  });

  app.use(express.json({ limit: '64kb' }));

  const isOpen = () => db.getSetting('open', true) !== false;
  const getExpected = () => db.getSetting('expected', null);

  /* ---------------------------- Öffentlicher Teil ---------------------------- */

  app.get('/api/form', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({ ...publicDefinition(), open: isOpen() });
  });

  app.post('/api/responses', submitLimiter(), (req, res) => {
    if (!isOpen()) return res.status(423).json({ error: 'Die Evaluation ist derzeit geschlossen. Es können keine Antworten mehr abgegeben werden.' });
    const result = validateSubmission(req.body);
    if (!result.ok) return res.status(400).json({ error: 'Bitte prüfe deine Angaben.', details: result.errors });
    const saved = db.saveResponse(result.value);
    // Wiederholte Abgabe mit demselben Token (z. B. Doppelklick, Netzwerk-Wiederholung) → gleiche Bestätigung, keine Doppelspeicherung.
    res.status(saved.duplicate ? 200 : 201).json({ ok: true, duplicate: saved.duplicate });
  });

  app.get('/healthz', (req, res) => res.json({ ok: true }));

  /* ---------------------------- Administration ---------------------------- */

  app.get('/api/admin/session', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({ authenticated: auth.isAuthenticated(req), configured: auth.configured });
  });

  app.post('/api/admin/login', async (req, res) => {
    if (req.get('X-Requested-With') !== 'evaluation-admin') return res.status(403).json({ error: 'Anfrage abgelehnt.' });
    const result = await auth.login(req, res, req.body && req.body.password);
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    res.json({ ok: true });
  });

  app.post('/api/admin/logout', (req, res) => {
    auth.logout(req, res);
    res.json({ ok: true });
  });

  const admin = express.Router();
  admin.use(auth.requireAdmin);

  const currentAnalysis = () => analyze(db.listResponses(), { expected: getExpected() });

  admin.get('/results', (req, res) => {
    res.json({ ...currentAnalysis(), open: isOpen(), definition: publicDefinition() });
  });

  admin.get('/responses', (req, res) => {
    // Kurzliste zur Verwaltung (z. B. Löschen von Testabgaben)
    // Ohne Klassenangabe, damit Klasse und Antwort hier nicht verknüpft werden.
    res.json(db.listResponses().map((r, i) => ({ id: r.id, no: i + 1, submittedOn: r.submittedOn, q1: r.answers.q1 || null })));
  });

  admin.delete('/responses/:id', (req, res) => {
    if (!/^[0-9a-f-]{36}$/.test(req.params.id)) return res.status(400).json({ error: 'Ungültige ID.' });
    if (!db.deleteResponse(req.params.id)) return res.status(404).json({ error: 'Antwort nicht gefunden.' });
    res.json({ ok: true });
  });

  admin.post('/responses/delete-all', (req, res) => {
    if (!req.body || req.body.confirm !== 'LÖSCHEN') return res.status(400).json({ error: 'Zur Bestätigung bitte LÖSCHEN eingeben.' });
    const deleted = db.deleteAllResponses();
    res.json({ ok: true, deleted });
  });

  admin.put('/settings', (req, res) => {
    const body = req.body || {};
    if ('open' in body) {
      if (typeof body.open !== 'boolean') return res.status(400).json({ error: 'Ungültiger Status.' });
      db.setSetting('open', body.open);
    }
    if ('expected' in body) {
      const e = body.expected;
      if (e === null || e === '') db.setSetting('expected', null);
      else if (Number.isInteger(e) && e > 0 && e <= 500) db.setSetting('expected', e);
      else return res.status(400).json({ error: 'Die erwartete Anzahl muss eine ganze Zahl zwischen 1 und 500 sein.' });
    }
    res.json({ ok: true, open: isOpen(), expected: getExpected() });
  });

  const stamp = () => new Date().toISOString().slice(0, 10);

  admin.get('/export.csv', (req, res) => {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="evaluation-rohdaten-${stamp()}.csv"`);
    res.send(toCsv(db.listResponses()));
  });

  admin.get('/backup.json', (req, res) => {
    res.setHeader('Content-Disposition', `attachment; filename="evaluation-sicherung-${stamp()}.json"`);
    res.json({
      format: 'praevention-evaluation-backup',
      version: 1,
      createdOn: stamp(),
      settings: { open: isOpen(), expected: getExpected() },
      responses: db.listResponses(),
    });
  });

  admin.get('/report.pdf', async (req, res, next) => {
    try {
      const pdf = await buildReport(currentAnalysis());
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="evaluationsbericht-praevention-${stamp()}.pdf"`);
      res.send(pdf);
    } catch (err) {
      next(err);
    }
  });

  app.use('/api/admin', admin);
  app.use('/api', (req, res) => res.status(404).json({ error: 'Nicht gefunden.' }));

  /* ---------------------------- Statische Seiten ---------------------------- */

  app.get('/admin', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.sendFile(path.join(PUBLIC_DIR, 'admin.html'));
  });
  app.get('/admin/', (req, res) => res.redirect(301, '../admin'));
  app.use(express.static(PUBLIC_DIR, { index: 'index.html', maxAge: '1h' }));

  app.use((req, res) => res.status(404).type('text/plain; charset=utf-8').send('Seite nicht gefunden.'));

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err && err.type === 'entity.too.large') return res.status(413).json({ error: 'Die Eingabe ist zu umfangreich.' });
    if (err && err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Ungültige Anfrage.' });
    console.error(err);
    res.status(500).json({ error: 'Interner Fehler.' });
  });

  return { app, db, auth };
}

module.exports = { createApp };
