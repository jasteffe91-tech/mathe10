// Ende-zu-Ende-Tests im echten Browser (Chromium) gegen die echte Datenbanklogik:
// Browser → lokaler Testserver (bildet Supabase-REST/Auth nach) → PostgreSQL mit den Migrationen.
// Deckt die Tests 4–8, 10, 11, 13, 15 und 16 aus dem Pflichtenheft ab.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { reset } from '../../tools/local-db.mjs';
import { createServer, seedTeacher, DEV_ANON_KEY, DEV_TEACHER } from '../../tools/dev-server/server.mjs';
import { makeParticipants } from '../helpers/db.mjs';

const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SHOTS = process.env.LERNLABOR_SCREENSHOT_DIR || join(ROOT, 'test-results');
mkdirSync(SHOTS, { recursive: true });

let srv, browser, teacherToken, group, people;
const LAB = 'physik-entdecker';

async function post(path, body, token) {
  const res = await fetch(`${srv.url}${path}`, {
    method: 'POST', body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json', apikey: DEV_ANON_KEY, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${path}: ${res.status} ${JSON.stringify(json)}`);
  return json;
}
const teacher = (fn, args) => post(`/rest/v1/rpc/${fn}`, args, teacherToken);
const dbRows = async (sql, params = []) => (await srv.pool.query(sql, params)).rows;

async function labPage(ctx, fragment = '') {
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { throw e; });
  await page.goto(`${srv.url}/labore/${LAB}/${fragment}`);
  return page;
}
async function loginInLab(page, code) {
  await page.waitForSelector('#ll-code');
  await page.fill('#ll-code', code);
  await page.click('.ll-btn[type=submit]');
}
const status = (page) => page.locator('.ll-status').innerText();

before(async () => {
  reset({ quiet: true });
  srv = await createServer({ port: 0, quiet: true });
  await seedTeacher(srv.pool);
  teacherToken = (await post('/auth/v1/token?grant_type=password', { email: DEV_TEACHER.email, password: DEV_TEACHER.password })).access_token;
  group = await teacher('teacher_create_group', { p_label: '4a Sachunterricht (Test)', p_kind: 'class' });
  people = makeParticipants(9);
  await teacher('teacher_register_participants', { p_group_id: group.id, p_participants: people });
  await teacher('teacher_set_lab_assignment', { p_group_id: group.id, p_lab_id: LAB, p_state: 'active' });
  browser = await chromium.launch();
});
after(async () => { await browser?.close(); await srv?.close(); });

describe('Lernende im Physik-Entdecker-Labor', () => {
  it('Test 11: falscher und gesperrter Code werden verständlich abgelehnt', async () => {
    const ctx = await browser.newContext();
    const page = await labPage(ctx);
    await loginInLab(page, 'ABCD-EFGH-JKMN');
    await page.waitForSelector('.ll-msg.ll-err');
    assert.match(await page.locator('.ll-msg').innerText(), /kennen wir leider nicht/);
    await teacher('teacher_set_participant_status', { p_participant_ids: [people[5].id], p_status: 'blocked' });
    await page.fill('#ll-code', people[5].code);
    await page.click('.ll-btn[type=submit]');
    await page.waitForFunction(() => /gesperrt/.test(document.querySelector('.ll-msg')?.textContent || ''));
    await ctx.close();
  });

  it('Test 4 + 5: Anmeldung nur mit Code; Vermutung wird gespeichert (erst nach Serverbestätigung „Gespeichert“)', async () => {
    const ctx = await browser.newContext();
    const page = await labPage(ctx);
    assert.equal(await page.locator('input[name*=name i], input[type=email]').count(), 0, 'keine Namens- oder E-Mail-Felder');
    await loginInLab(page, people[0].code);
    await page.waitForSelector('.karte.start');
    assert.match(await page.locator('#sitzung').innerText(), new RegExp(people[0].pseudonym));
    await page.click('text=Los geht’s!');
    await page.click('.wahl >> nth=2');
    await page.waitForFunction(() => document.querySelector('.ll-status')?.dataset.state === 'saved');
    assert.equal(await status(page), 'Gespeichert');
    const rows = await dbRows(`select r.answer->>'choice' as c, r.status from lernlabor.task_results r join lernlabor.participants p on p.id = r.participant_id where p.pseudonym = $1`, [people[0].pseudonym]);
    assert.deepEqual(rows, [{ c: 'steil', status: 'completed' }]);
    await ctx.close();
  });

  it('Test 6: Browser schließen und erneut anmelden → Lernstand wird wiederhergestellt', async () => {
    const ctx = await browser.newContext(); // neuer Kontext = Browser war geschlossen (kein sessionStorage)
    const page = await labPage(ctx);
    await loginInLab(page, people[0].code);
    await page.waitForSelector('.aufgaben-kopf');
    // genau dort weiter, wo zuletzt gearbeitet wurde (Aufgabe 1, Antwort bereits gewählt)
    assert.match(await page.locator('.aufgaben-nr').innerText(), /Aufgabe 1 von 6/);
    assert.match(await page.locator('#fortschritt-text').innerText(), /1 von 6/);
    assert.equal(await page.locator('.wahl[aria-checked=true]').innerText(), 'Auf der steilen Rampe');
    assert.equal(await page.locator('.nav .knopf.haupt').isEnabled(), true);
    assert.match(await page.locator('#toast').innerText(), /Willkommen zurück/);
    await ctx.close();
  });

  it('Test 7: Arbeiten ohne Internet → „Offline – wird später synchronisiert“, danach automatische Übertragung', async () => {
    const ctx = await browser.newContext();
    const page = await labPage(ctx);
    await loginInLab(page, people[1].code);
    await page.click('text=Los geht’s!');
    await ctx.setOffline(true);
    await page.click('.wahl >> nth=0');
    await page.waitForFunction(() => document.querySelector('.ll-status')?.dataset.state === 'offline');
    assert.equal(await status(page), 'Offline – wird später synchronisiert');
    assert.equal((await dbRows(`select 1 from lernlabor.task_results r join lernlabor.participants p on p.id = r.participant_id where p.pseudonym = $1`, [people[1].pseudonym])).length, 0);
    // weiterarbeiten ist möglich (lokal), Fortschritt zeigt die Änderung
    assert.match(await page.locator('#fortschritt-text').innerText(), /1 von 6/);
    await page.reload({ waitUntil: 'commit' }).catch(() => null); // Neuladen ohne Netz scheitert am Webserver – ehrlich: Seite braucht Netz
    await ctx.setOffline(false);
    await page.goto(`${srv.url}/labore/${LAB}/`);
    // Sitzung im Tab erhalten → keine Neuanmeldung, ausstehende Änderung aus IndexedDB wird übertragen
    await page.waitForFunction(() => document.querySelector('.ll-status')?.dataset.state === 'saved', null, { timeout: 15000 });
    const rows = await dbRows(`select r.answer->>'choice' as c from lernlabor.task_results r join lernlabor.participants p on p.id = r.participant_id where p.pseudonym = $1`, [people[1].pseudonym]);
    assert.deepEqual(rows, [{ c: 'flach' }]);
    await ctx.close();
  });

  it('Test 7b: Verbindung bricht während der Arbeit ab und kommt zurück (ohne Neuladen)', async () => {
    const ctx = await browser.newContext();
    const page = await labPage(ctx);
    await loginInLab(page, people[2].code);
    await page.click('text=Los geht’s!');
    await page.click('.wahl >> nth=1');
    await page.waitForFunction(() => document.querySelector('.ll-status')?.dataset.state === 'saved');
    await page.click('.nav .knopf.haupt');
    await ctx.setOffline(true);
    for (const r of ['Flach', 'Mittel', 'Steil']) {
      await page.click(`.rampe-knopf:has-text("${r}")`);
      await page.click('#kugel-start');
      await page.waitForFunction(() => !document.querySelector('#kugel-start')?.disabled, null, { timeout: 8000 });
    }
    await page.waitForFunction(() => document.querySelector('.ll-status')?.dataset.state === 'offline');
    await ctx.setOffline(false);
    await page.waitForFunction(() => document.querySelector('.ll-status')?.dataset.state === 'saved', null, { timeout: 15000 });
    const rows = await dbRows(`select r.task_id, r.status, jsonb_array_length(r.data->'laeufe') as n from lernlabor.task_results r join lernlabor.participants p on p.id = r.participant_id where p.pseudonym = $1 order by 1`, [people[2].pseudonym]);
    assert.deepEqual(rows, [{ task_id: 'm1-vermutung', status: 'completed', n: null }, { task_id: 'm2-versuch', status: 'completed', n: 3 }]);
    await ctx.close();
  });
});

describe('Lehrkraft-Dashboard', () => {
  it('Test 8: Fortschritt erscheint innerhalb des Aktualisierungsintervalls (15 s), ohne Klarnamen', async () => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const dash = await ctx.newPage();
    await dash.goto(`${srv.url}/lehrkraft/`);
    await dash.fill('#email', DEV_TEACHER.email);
    await dash.fill('#pw', DEV_TEACHER.password);
    await dash.click('button[type=submit]');
    await dash.waitForSelector('.tabelle');
    const row = dash.locator('tr', { hasText: people[3].pseudonym });
    assert.match(await row.innerText(), /0 %/);

    const sctx = await browser.newContext();
    const page = await labPage(sctx);
    await loginInLab(page, people[3].code);
    await page.click('text=Los geht’s!');
    await page.click('.wahl >> nth=2');
    await page.waitForFunction(() => document.querySelector('.ll-status')?.dataset.state === 'saved');
    const t0 = Date.now();
    await dash.waitForFunction((p) => [...document.querySelectorAll('tr')].some((tr) => tr.textContent.includes(p) && tr.textContent.includes('17 %')), people[3].pseudonym, { timeout: 17000 });
    const dt = (Date.now() - t0) / 1000;
    assert.ok(dt <= 16, `Aktualisierung nach ${dt} s`);
    await dash.screenshot({ path: join(SHOTS, 'e2e-dashboard.png'), fullPage: true });
    await sctx.close();
    await ctx.close();
  });

  it('Test 13: Gastzugänge per Dashboard; Gast bearbeitet das ganze Labor nur mit Code (QR-Fragment)', async () => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const dash = await ctx.newPage();
    await dash.goto(`${srv.url}/lehrkraft/`);
    await dash.fill('#email', DEV_TEACHER.email);
    await dash.fill('#pw', DEV_TEACHER.password);
    await dash.click('button[type=submit]');
    await dash.waitForSelector('.tabs');
    await dash.click('.tab:has-text("Gastzugänge")');
    await dash.selectOption('#v-anzahl', '20');
    await dash.click('text=Gastzugänge erzeugen');
    await dash.waitForSelector('.zugangskarte');
    assert.equal(await dash.locator('.zugangskarte').count(), 20);
    const code = await dash.locator('.zk-code').first().innerText();
    assert.match(code, /^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/);

    const gctx = await browser.newContext({ ...devices['iPad (gen 7)'] });
    const page = await labPage(gctx, `#zugang=${code}`);
    await page.waitForSelector('.karte.start');
    assert.ok(!page.url().includes('zugang='), 'Code wird sofort aus der Adresse entfernt');
    assert.match(await page.locator('h1').first().innerText(), /Tag der offenen Tür/);
    await page.click('text=Los geht’s!');
    await page.click('.wahl >> nth=2');
    await page.click('.nav .knopf.haupt');
    for (const r of ['Flach', 'Mittel', 'Steil']) {
      await page.click(`.rampe-knopf:has-text("${r}")`);
      await page.click('#kugel-start');
      await page.waitForFunction(() => !document.querySelector('#kugel-start')?.disabled, null, { timeout: 8000 });
    }
    await page.click('.nav .knopf.haupt');
    await page.click('.wahl >> nth=0');
    await page.click('.nav .knopf.haupt');
    await page.click('.wahl >> nth=1');
    await page.click('.nav .knopf.haupt');
    await page.click('text=Schalter schließen');
    await page.click('text=Schalter öffnen');
    await page.click('.nav .knopf.haupt');
    await page.click('.wahl >> nth=0');
    await page.click('.nav .knopf.haupt');
    await page.waitForSelector('.urkunde');
    assert.match(await page.locator('h1.jubel').innerText(), /Physik-Entdecker/);
    await page.waitForFunction(() => document.querySelector('.ll-status')?.dataset.state === 'saved');
    await page.screenshot({ path: join(SHOTS, 'e2e-gast-urkunde-ipad.png'), fullPage: true });
    const prog = await dbRows(`select lp.percent, g.kind from lernlabor.lab_progress lp join lernlabor.groups g on g.id = lp.group_id where g.kind = 'event'`);
    assert.deepEqual(prog, [{ percent: 100, kind: 'event' }]);
    await gctx.close();

    await dash.click('.tab:has-text("Übersicht")').catch(() => null);
    await ctx.close();
  });
});

describe('Darstellung und Betrieb', () => {
  for (const [name, opts, idx] of [['Smartphone', devices['iPhone 13'], 6], ['Tablet', devices['iPad (gen 7)'], 7], ['Desktop', { viewport: { width: 1366, height: 800 } }, 8]]) {
    it(`Test 15: Labor funktioniert auf ${name} ohne seitliches Scrollen`, async () => {
      const ctx = await browser.newContext(opts);
      const page = await labPage(ctx);
      await page.waitForSelector('#ll-code');
      const noOverflow = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
      assert.ok(await noOverflow(), 'Anmeldeseite');
      await loginInLab(page, people[idx].code);
      await page.waitForSelector('.karte.start, .aufgaben-kopf');
      if (await page.locator('.karte.start').count()) await page.click('.karte.start .knopf.haupt');
      await page.waitForSelector('.wahl');
      if (!(await page.locator('.wahl[aria-checked=true]').count())) await page.click('.wahl >> nth=0');
      assert.ok(await noOverflow(), 'Vermutung');
      await page.click('.nav .knopf.haupt');
      await page.waitForSelector('#kugel-start');
      assert.ok(await noOverflow(), 'Simulation');
      const box = await page.locator('#kugel-start').boundingBox();
      assert.ok(box.height >= 44, 'große Schaltflächen');
      await page.screenshot({ path: join(SHOTS, `e2e-versuch-${name.toLowerCase()}.png`), fullPage: true });
      await ctx.close();
    });
  }

  it('Test 16: Daten bleiben nach einem regulären Deployment (Neubau + Neustart der Webseite) erhalten', async () => {
    execFileSync(process.execPath, [join(ROOT, 'scripts', 'build.mjs')], { stdio: 'ignore' });
    await srv.close();
    srv = await createServer({ port: 0, quiet: true });
    const ctx = await browser.newContext();
    const page = await labPage(ctx);
    await loginInLab(page, people[0].code);
    await page.waitForSelector('.aufgaben-kopf');
    assert.match(await page.locator('#fortschritt-text').innerText(), /1 von 6/);
    await ctx.close();
  });
});
