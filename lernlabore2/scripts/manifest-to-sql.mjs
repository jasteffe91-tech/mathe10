#!/usr/bin/env node
// Erzeugt aus einer lab.manifest.json das SQL zum Registrieren eines Lernlabors.
//   node scripts/manifest-to-sql.mjs labs/mein-labor/lab.manifest.json > mein-labor.sql
// Das Ergebnis im Supabase-SQL-Editor ausführen (oder als neue Migration ablegen).
import { readFileSync } from 'node:fs';

const file = process.argv[2];
if (!file) {
  console.error('Aufruf: node scripts/manifest-to-sql.mjs <pfad/zu/lab.manifest.json>');
  process.exit(1);
}
const m = JSON.parse(readFileSync(file, 'utf8'));

const errors = [];
if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(m.id ?? '')) errors.push('id: nur Kleinbuchstaben, Ziffern und Bindestriche (2–63 Zeichen)');
if (!/^[0-9]+(\.[0-9]+){0,2}$/.test(m.version ?? '')) errors.push('version: z. B. "1.0"');
if (!m.title) errors.push('title fehlt');
if (!Array.isArray(m.tasks) || m.tasks.length === 0) errors.push('tasks: mindestens eine Aufgabe');
const kinds = ['choice', 'multi', 'text', 'number', 'simulation', 'measurement', 'other'];
const seen = new Set();
(m.tasks ?? []).forEach((t, i) => {
  if (!/^[a-z0-9][a-z0-9._-]{0,62}$/.test(t.task_id ?? '')) errors.push(`tasks[${i}].task_id ungültig`);
  if (seen.has(t.task_id)) errors.push(`tasks[${i}].task_id doppelt: ${t.task_id}`);
  seen.add(t.task_id);
  if (!kinds.includes(t.kind)) errors.push(`tasks[${i}].kind muss eines von ${kinds.join(', ')} sein`);
  if (!t.title) errors.push(`tasks[${i}].title fehlt`);
  if (t.solution && !Array.isArray(t.solution.correct)) errors.push(`tasks[${i}].solution.correct muss eine Liste sein`);
});
if (errors.length) {
  console.error('Manifest ungültig:\n - ' + errors.join('\n - '));
  process.exit(1);
}

const q = (s) => (s === null || s === undefined ? 'null' : `'${String(s).replace(/'/g, "''")}'`);
const j = (o) => (o === null || o === undefined ? 'null' : `${q(JSON.stringify(o))}::jsonb`);

const rows = m.tasks.map((t, i) => `  (${q(m.id)}, ${q(m.version)}, ${q(t.task_id)}, ${i + 1}, ${q(t.section ?? '')}, ${q(t.title)}, ${q(t.kind)}, ${t.graded ? 'true' : 'false'}, ${t.counts_for_progress === false ? 'false' : 'true'}, ${j(t.options ?? [])}, ${j(t.solution ?? null)})`);

console.log(`-- Lernlabor „${m.title}“ (Version ${m.version}) registrieren – erzeugt aus ${file}
begin;
insert into lernlabor.labs (id, title, subject, audience, current_version)
values (${q(m.id)}, ${q(m.title)}, ${q(m.subject ?? 'Physik')}, ${q(m.audience ?? '')}, ${q(m.version)})
on conflict (id) do update set title = excluded.title, subject = excluded.subject,
  audience = excluded.audience, current_version = excluded.current_version;

insert into lernlabor.lab_versions (lab_id, version) values (${q(m.id)}, ${q(m.version)})
on conflict do nothing;

insert into lernlabor.lab_tasks (lab_id, version, task_id, position, section, title, kind, graded, counts_for_progress, options, solution) values
${rows.join(',\n')}
on conflict (lab_id, version, task_id) do update set
  position = excluded.position, section = excluded.section, title = excluded.title, kind = excluded.kind,
  graded = excluded.graded, counts_for_progress = excluded.counts_for_progress,
  options = excluded.options, solution = excluded.solution;
commit;`);
