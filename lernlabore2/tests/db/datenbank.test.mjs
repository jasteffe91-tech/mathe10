// Datenbanktests: Sicherheit, Datenschutz, Idempotenz, Konflikte, Gastmodus.
// Laufen gegen eine lokale PostgreSQL-Instanz mit denselben Migrationen wie Supabase.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { freshDb, createUser, api, makeParticipants, makeCode } from '../helpers/db.mjs';

const LAB = 'physik-entdecker';
let db, A, teacherA, teacherB, nonTeacher;
let group, people;

before(async () => {
  db = await freshDb();
  A = api(db);
  teacherA = await createUser(db.pool, 'lehrkraft-a@schule.example', { admin: true });
  teacherB = await createUser(db.pool, 'lehrkraft-b@schule.example');
  nonTeacher = await createUser(db.pool, 'fremd@example.org', { teacher: false });
});
after(async () => { await db?.close(); });

async function login(code, ip) {
  return A.anon('student_login', { p_code: code }, ip);
}

describe('Lerngruppe und Zugangscodes (Tests 2, 3)', () => {
  it('Lehrkraft legt Gruppe an und registriert 30 pseudonyme Teilnehmende', async () => {
    const res = await A.as(teacherA)('teacher_create_group', { p_label: '7a Physik (Test)', p_kind: 'class' });
    assert.equal(res.created, true);
    group = res.id;
    people = makeParticipants(30);
    const reg = await A.as(teacherA)('teacher_register_participants', { p_group_id: group, p_participants: people });
    assert.deepEqual(reg, { ok: true, created: 30, reissued: 0, unchanged: 0 });
    await A.as(teacherA)('teacher_set_lab_assignment', { p_group_id: group, p_lab_id: LAB, p_state: 'active' });
  });

  it('Wiederholte Registrierung ist idempotent', async () => {
    const reg = await A.as(teacherA)('teacher_register_participants', { p_group_id: group, p_participants: people });
    assert.deepEqual(reg, { ok: true, created: 0, reissued: 0, unchanged: 30 });
  });

  it('Rohcodes stehen nirgends in der Datenbank, nur HMAC-Werte mit Geheimnis', async () => {
    const { rows } = await db.pool.query('select code_hmac from lernlabor.access_codes');
    assert.equal(rows.length, 30);
    const all = await db.pool.query(`select string_agg(t::text, '|') as dump from (
      select row_to_json(x)::text as t from lernlabor.access_codes x union all
      select row_to_json(x)::text from lernlabor.participants x union all
      select row_to_json(x)::text from lernlabor.audit_log x) s`);
    for (const p of people) {
      const norm = p.code.replace(/-/g, '');
      assert.ok(!all.rows[0].dump.includes(norm), 'Rohcode gefunden');
      const plainSha = createHash('sha256').update(norm).digest();
      assert.ok(!rows.some((r) => r.code_hmac.equals(plainSha)), 'ungesalzener SHA-256 gefunden');
    }
  });

  it('Für eine Klasse werden Codes unter 12 Zeichen abgelehnt', async () => {
    const bad = [{ id: randomUUID(), pseudonym: 'P-ZZZZ', code: 'ABCD-EFGH' }];
    await assert.rejects(A.as(teacherA)('teacher_register_participants', { p_group_id: group, p_participants: bad }), /Ungültiger Zugangscode/);
  });
});

describe('Anmeldung (Tests 4, 11)', () => {
  it('gültiger Code → Sitzung, Lernlabor sichtbar, keine Klarnamen nötig', async () => {
    const res = await login(people[0].code);
    assert.equal(res.ok, true);
    assert.match(res.session_token, /^[A-Za-z0-9_-]{43}$/);
    assert.equal(res.participant.pseudonym, people[0].pseudonym);
    assert.equal(res.participant.labs[0].id, LAB);
  });

  it('Code-Eingabe ist tolerant (Kleinbuchstaben, Leerzeichen, ohne Bindestriche)', async () => {
    const messy = ` ${people[1].code.toLowerCase().replace(/-/g, ' ')} `;
    const res = await login(messy);
    assert.equal(res.ok, true);
  });

  it('falscher Code wird abgelehnt', async () => {
    const res = await login(makeCode(12));
    assert.deepEqual(res, { ok: false, error: 'invalid' });
  });

  it('gesperrte Person wird abgelehnt und bestehende Sitzungen enden', async () => {
    const s = await login(people[2].code);
    await A.as(teacherA)('teacher_set_participant_status', { p_participant_ids: [people[2].id], p_status: 'blocked' });
    assert.equal((await login(people[2].code)).error, 'blocked');
    assert.equal((await A.anon('student_session_info', { p_session: s.session_token })).error, 'session_invalid');
    await A.as(teacherA)('teacher_set_participant_status', { p_participant_ids: [people[2].id], p_status: 'active' });
    assert.equal((await login(people[2].code)).ok, true);
  });

  it('neu ausgestellter Code ersetzt den alten (alter Code und alte Sitzung ungültig)', async () => {
    const old = await login(people[3].code);
    const fresh = { ...people[3], code: makeCode(12) };
    const reg = await A.as(teacherA)('teacher_register_participants', { p_group_id: group, p_participants: [fresh] });
    assert.equal(reg.reissued, 1);
    assert.equal((await login(people[3].code)).error, 'blocked');
    assert.equal((await A.anon('student_session_info', { p_session: old.session_token })).error, 'session_invalid');
    assert.equal((await login(fresh.code)).ok, true);
    people[3] = fresh;
  });

  it('Rateversuche werden pro Anschluss begrenzt, andere Anschlüsse bleiben unberührt', async () => {
    const ip = '198.51.100.77';
    for (let i = 0; i < 60; i++) await login(makeCode(12), ip);
    assert.equal((await login(people[4].code, ip)).error, 'rate_limited');
    assert.equal((await login(people[4].code, '198.51.100.78')).ok, true);
  });

  it('IP-Adressen werden nicht gespeichert', async () => {
    const { rows } = await db.pool.query(`select count(*)::int as n from lernlabor.login_failures where position('198.51.100.77' in encode(client_key, 'escape')) > 0`);
    assert.equal(rows[0].n, 0);
  });
});

describe('Speichern, Laden, Idempotenz, Konflikte (Tests 5, 6, 12)', () => {
  let token;
  before(async () => { token = (await login(people[5].code)).session_token; });

  it('Vermutung wird gespeichert und Fortschritt berechnet', async () => {
    const res = await A.anon('student_save_task', {
      p_session: token, p_lab_id: LAB, p_lab_version: '1.0', p_task_id: 'm1-vermutung',
      p_op_id: randomUUID(), p_base_revision: 0, p_answer: { choice: 'steil' }, p_completed: true });
    assert.equal(res.status, 'saved');
    assert.equal(res.result.revision, 1);
    assert.deepEqual(res.progress, { completed: 1, total: 6, percent: 17 });
  });

  it('Neuanmeldung (Browser geschlossen) lädt den gespeicherten Stand', async () => {
    const again = (await login(people[5].code)).session_token;
    assert.notEqual(again, token);
    const load = await A.anon('student_load_lab', { p_session: again, p_lab_id: LAB });
    assert.equal(load.ok, true);
    assert.equal(load.results.length, 1);
    assert.equal(load.results[0].answer.choice, 'steil');
    assert.equal(load.progress.percent, 17);
    assert.equal(load.lab.tasks.length, 6);
    assert.ok(!JSON.stringify(load).includes('solution'), 'Lösungen dürfen nicht an Lernende gehen');
  });

  it('Doppelt gesendete Operation erzeugt keinen zweiten Abschluss', async () => {
    const op = randomUUID();
    const args = { p_session: token, p_lab_id: LAB, p_lab_version: '1.0', p_task_id: 'm3-auswertung',
      p_op_id: op, p_base_revision: 0, p_answer: { choice: 'flach' }, p_completed: true };
    const first = await A.anon('student_save_task', args);
    const second = await A.anon('student_save_task', args);
    assert.equal(first.status, 'saved');
    assert.equal(second.status, 'duplicate');
    assert.equal(second.result.revision, 1);
    const { rows } = await db.pool.query(`select count(*)::int as n from lernlabor.task_results r join lernlabor.participants p on p.id = r.participant_id where p.pseudonym = $1 and task_id = 'm3-auswertung'`, [people[5].pseudonym]);
    assert.equal(rows[0].n, 1);
    assert.equal(first.result.is_correct, false);
  });

  it('veralteter Stand überschreibt kein neueres Ergebnis (Konflikt)', async () => {
    const upd = await A.anon('student_save_task', { p_session: token, p_lab_id: LAB, p_lab_version: '1.0', p_task_id: 'm3-auswertung',
      p_op_id: randomUUID(), p_base_revision: 1, p_answer: { choice: 'steil' }, p_completed: true });
    assert.equal(upd.status, 'saved');
    assert.equal(upd.result.revision, 2);
    assert.equal(upd.result.is_correct, true);
    const stale = await A.anon('student_save_task', { p_session: token, p_lab_id: LAB, p_lab_version: '1.0', p_task_id: 'm3-auswertung',
      p_op_id: randomUUID(), p_base_revision: 1, p_answer: { choice: 'gleich' }, p_completed: true });
    assert.equal(stale.status, 'conflict');
    assert.equal(stale.result.answer.choice, 'steil');
    const { rows } = await db.pool.query(`select first_is_correct, is_correct from lernlabor.task_results r join lernlabor.participants p on p.id = r.participant_id where p.pseudonym = $1 and task_id = 'm3-auswertung'`, [people[5].pseudonym]);
    assert.deepEqual(rows[0], { first_is_correct: false, is_correct: true });
  });

  it('abgeschlossen bleibt abgeschlossen', async () => {
    const r = await A.anon('student_save_task', { p_session: token, p_lab_id: LAB, p_lab_version: '1.0', p_task_id: 'm1-vermutung',
      p_op_id: randomUUID(), p_base_revision: 1, p_answer: { choice: 'flach' }, p_completed: false });
    assert.equal(r.result.status, 'completed');
  });

  it('unbekannte Aufgaben, zu große Daten und ungültige Sitzungen werden abgelehnt', async () => {
    const base = { p_session: token, p_lab_id: LAB, p_lab_version: '1.0', p_op_id: randomUUID(), p_base_revision: 0 };
    assert.equal((await A.anon('student_save_task', { ...base, p_task_id: 'gibt-es-nicht' })).error, 'unknown_task');
    assert.equal((await A.anon('student_save_task', { ...base, p_op_id: randomUUID(), p_task_id: 'e1-vermutung', p_answer: { text: 'x'.repeat(20000) } })).error, 'too_large');
    assert.equal((await A.anon('student_save_task', { ...base, p_session: 'falsch', p_task_id: 'e1-vermutung' })).error, 'session_invalid');
  });

  it('Fortsetzungspunkt wird gespeichert', async () => {
    assert.equal((await A.anon('student_save_resume', { p_session: token, p_lab_id: LAB, p_state: { schritt: 'm3' } })).ok, true);
    const load = await A.anon('student_load_lab', { p_session: token, p_lab_id: LAB });
    assert.deepEqual(load.resume_state, { schritt: 'm3' });
  });

  it('nicht zugewiesenes Labor ist gesperrt; archivierter Durchgang nimmt nichts mehr an', async () => {
    await A.as(teacherA)('teacher_set_lab_assignment', { p_group_id: group, p_lab_id: LAB, p_state: 'archived' });
    const r = await A.anon('student_save_task', { p_session: token, p_lab_id: LAB, p_lab_version: '1.0', p_task_id: 'e1-vermutung',
      p_op_id: randomUUID(), p_base_revision: 0, p_answer: { choice: 'kreis' }, p_completed: true });
    assert.equal(r.error, 'lab_not_assigned');
    await A.as(teacherA)('teacher_set_lab_assignment', { p_group_id: group, p_lab_id: LAB, p_state: 'active' });
  });

  it('Abmelden beendet die Sitzung serverseitig', async () => {
    const s = (await login(people[6].code)).session_token;
    await A.anon('student_logout', { p_session: s });
    assert.equal((await A.anon('student_session_info', { p_session: s })).error, 'session_invalid');
  });
});

describe('Zugriffsschutz (Test 10)', () => {
  it('Lernende (anon) können keine Tabellen direkt lesen', async () => {
    const c = await db.pool.connect();
    try {
      for (const t of ['task_results', 'participants', 'access_codes', 'lab_progress', 'student_sessions']) {
        await c.query('begin');
        await c.query('set local role anon');
        await assert.rejects(c.query(`select * from lernlabor.${t}`), /permission denied/);
        await c.query('rollback');
      }
      await c.query('begin');
      await c.query('set local role anon');
      await assert.rejects(c.query('select * from lernlabor_private.settings'), /permission denied/);
      await c.query('rollback');
    } finally {
      await c.query('rollback').catch(() => {});
      c.release();
    }
  });

  it('Lernende können keine Lehrkraft-Funktionen aufrufen', async () => {
    await assert.rejects(A.anon('teacher_export_group', { p_group_id: group }), (e) => e.status === 401);
    await assert.rejects(A.anon('teacher_group_overview', { p_group_id: group }), (e) => e.status === 401);
    await assert.rejects(A.anon('teacher_register_participants', { p_group_id: group, p_participants: [] }), (e) => e.status === 401);
  });

  it('Eine Sitzung liefert nur die eigenen Ergebnisse – fremde Teilnehmer-IDs sind nicht adressierbar', async () => {
    const t7 = (await login(people[7].code)).session_token;
    const load = await A.anon('student_load_lab', { p_session: t7, p_lab_id: LAB });
    assert.equal(load.results.length, 0, 'Person 7 darf die Ergebnisse von Person 5 nicht sehen');
    // Es gibt keinen Parameter für eine fremde Teilnehmer-ID; zusätzliche Parameter werden abgewiesen:
    await assert.rejects(A.anon('student_load_lab', { p_session: t7, p_lab_id: LAB, p_participant_id: people[5].id }), (e) => e.status === 404);
  });

  it('Fremde Lehrkraft sieht die Gruppe nicht (RLS) und kann nichts ändern', async () => {
    await assert.rejects(A.as(teacherB)('teacher_group_overview', { p_group_id: group }), (e) => e.status === 403);
    await assert.rejects(A.as(teacherB)('teacher_export_group', { p_group_id: group }), (e) => e.status === 403);
    await assert.rejects(A.as(teacherB)('teacher_register_participants', { p_group_id: group, p_participants: [] }), (e) => e.status === 403);
    await assert.rejects(A.as(teacherB)('teacher_set_participant_status', { p_participant_ids: [people[0].id], p_status: 'blocked' }), (e) => e.status === 403);
    assert.deepEqual(await A.as(teacherB)('teacher_list_groups', {}), []);
    const c = await db.pool.connect();
    try {
      await c.query('begin');
      await c.query('set local role authenticated');
      await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: teacherB, role: 'authenticated' })]);
      const r = await c.query('select count(*)::int as n from lernlabor.task_results');
      assert.equal(r.rows[0].n, 0);
      for (const sql of ['select code_hmac from lernlabor.access_codes', `update lernlabor.participants set status = 'blocked'`,
        `insert into lernlabor.group_teachers (group_id, teacher_id) values ('${group}', '${teacherB}')`]) {
        await c.query('savepoint s');
        await assert.rejects(c.query(sql), /permission denied/);
        await c.query('rollback to savepoint s');
      }
    } finally {
      await c.query('rollback').catch(() => {});
      c.release();
    }
  });

  it('Angemeldete Person ohne Lehrkraft-Freischaltung kann nichts anlegen', async () => {
    await assert.rejects(A.as(nonTeacher)('teacher_create_group', { p_label: 'X' }), (e) => e.status === 403);
    const me = await A.as(nonTeacher)('teacher_me', {});
    assert.equal(me.is_teacher, false);
  });

  it('Eigene Lehrkraft sieht pseudonyme Übersicht, Statistik und Export', async () => {
    const ov = await A.as(teacherA)('teacher_group_overview', { p_group_id: group, p_lab_id: LAB });
    assert.equal(ov.participants.length, 30);
    const p5 = ov.participants.find((p) => p.pseudonym === people[5].pseudonym);
    assert.equal(p5.progress[0].completed, 2);
    const stats = await A.as(teacherA)('teacher_task_stats', { p_group_id: group, p_lab_id: LAB });
    const m3 = stats.tasks.find((t) => t.task_id === 'm3-auswertung');
    assert.equal(m3.first_incorrect, 1);
    assert.equal(m3.correct, 1);
    const exp = await A.as(teacherA)('teacher_export_group', { p_group_id: group });
    assert.equal(exp.format, 'lernlabore2-export');
    assert.equal(exp.participants.length, 30);
    assert.ok(exp.results.length >= 2);
    assert.ok(exp.labs[0].tasks.some((t) => t.solution));
  });

  it('Kollegin mit geteilter Gruppe erhält Zugriff', async () => {
    await A.as(teacherA)('teacher_share_group', { p_group_id: group, p_email: 'lehrkraft-b@schule.example' });
    const ov = await A.as(teacherB)('teacher_group_overview', { p_group_id: group });
    assert.equal(ov.participants.length, 30);
    await assert.rejects(A.as(teacherB)('teacher_delete_group', { p_group_id: group }), (e) => e.status === 403, 'nur Besitzerin darf löschen');
  });
});

describe('Gastmodus (Test 13) und Demo-Daten', () => {
  let event, guests;
  it('Veranstaltung mit 20 Gastcodes (8 Zeichen) wird angelegt', async () => {
    const until = new Date(Date.now() + 6 * 3600e3).toISOString();
    const g = await A.as(teacherA)('teacher_create_group', { p_label: 'Tag der offenen Tür', p_kind: 'event', p_valid_until: until });
    event = g.id;
    guests = makeParticipants(20, 'G', 8);
    const reg = await A.as(teacherA)('teacher_register_participants', { p_group_id: event, p_participants: guests });
    assert.equal(reg.created, 20);
    await A.as(teacherA)('teacher_set_lab_assignment', { p_group_id: event, p_lab_id: LAB });
  });

  it('Gast meldet sich nur mit Code an und bearbeitet das Labor', async () => {
    const s = await login(guests[0].code);
    assert.equal(s.ok, true);
    assert.equal(s.participant.group.kind, 'event');
    const r = await A.anon('student_save_task', { p_session: s.session_token, p_lab_id: LAB, p_lab_version: '1.0', p_task_id: 'e1-vermutung',
      p_op_id: randomUUID(), p_base_revision: 0, p_answer: { choice: 'kreis' }, p_completed: true });
    assert.equal(r.status, 'saved');
    const stats = await A.as(teacherA)('teacher_task_stats', { p_group_id: event, p_lab_id: LAB });
    assert.equal(stats.started, 1);
    guests.session = s.session_token;
  });

  it('Veranstaltung beenden sperrt alle Gastcodes und Sitzungen', async () => {
    await A.as(teacherA)('teacher_end_access', { p_group_id: event });
    assert.equal((await login(guests[1].code)).error, 'expired');
    assert.equal((await A.anon('student_session_info', { p_session: guests.session })).error, 'session_invalid');
  });

  it('Demo-Daten nur in Demo-Gruppen und deutlich gekennzeichnet', async () => {
    await assert.rejects(A.as(teacherA)('teacher_seed_demo_results', { p_group_id: group, p_lab_id: LAB }), /nur in Demo-Gruppen/);
    const demo = await A.as(teacherA)('teacher_create_group', { p_label: 'DEMO Fortbildung', p_kind: 'demo' });
    const ppl = makeParticipants(12, 'D', 8);
    await A.as(teacherA)('teacher_register_participants', { p_group_id: demo.id, p_participants: ppl });
    const seed = await A.as(teacherA)('teacher_seed_demo_results', { p_group_id: demo.id, p_lab_id: LAB, p_leave_empty: 2 });
    assert.equal(seed.participants_seeded, 10);
    const exp = await A.as(teacherA)('teacher_export_group', { p_group_id: demo.id });
    assert.equal(exp.group.kind, 'demo');
    // gezielt freigehaltene Personen (für die Live-Vorführung)
    const demo2 = await A.as(teacherA)('teacher_create_group', { p_label: 'DEMO 2', p_kind: 'demo' });
    const ppl2 = makeParticipants(5, 'D', 12);
    await A.as(teacherA)('teacher_register_participants', { p_group_id: demo2.id, p_participants: ppl2 });
    const seed2 = await A.as(teacherA)('teacher_seed_demo_results', { p_group_id: demo2.id, p_lab_id: LAB, p_skip_ids: [ppl2[0].id, ppl2[1].id] });
    assert.equal(seed2.participants_seeded, 3);
    const exp2 = await A.as(teacherA)('teacher_export_group', { p_group_id: demo2.id });
    assert.ok(!exp2.results.some((r) => r.participant_id === ppl2[0].id || r.participant_id === ppl2[1].id));
    assert.ok(exp.results.every((r) => r.answer.demo === true));
  });
});

describe('Aufbewahrung und Löschung', () => {
  it('abgelaufene Gruppen werden mit allen Ergebnissen gelöscht', async () => {
    const g = await A.as(teacherA)('teacher_create_group', { p_label: 'Alt', p_kind: 'class' });
    const ppl = makeParticipants(2);
    await A.as(teacherA)('teacher_register_participants', { p_group_id: g.id, p_participants: ppl });
    await db.pool.query(`update lernlabor.groups set retention_until = current_date - 1 where id = $1`, [g.id]);
    const res = await A.as(teacherA)('teacher_purge_expired', {});
    assert.ok(res.groups_deleted >= 1);
    const { rows } = await db.pool.query('select count(*)::int as n from lernlabor.participants where group_id = $1', [g.id]);
    assert.equal(rows[0].n, 0);
  });

  it('Ergebnisse eines Labors lassen sich gezielt löschen', async () => {
    const r = await A.as(teacherA)('teacher_delete_results', { p_group_id: group, p_lab_id: LAB });
    assert.ok(r.results_deleted >= 2);
    const ov = await A.as(teacherA)('teacher_group_overview', { p_group_id: group, p_lab_id: LAB });
    assert.ok(ov.participants.every((p) => p.progress.length === 0));
  });

  it('Audit-Protokoll enthält Aktionen, aber keine Codes', async () => {
    const log = await A.as(teacherA)('teacher_audit_log', { p_group_id: group });
    assert.ok(log.some((e) => e.action === 'participants_registered'));
    const text = JSON.stringify(log);
    for (const p of people) assert.ok(!text.includes(p.code.replace(/-/g, '')));
  });
});
