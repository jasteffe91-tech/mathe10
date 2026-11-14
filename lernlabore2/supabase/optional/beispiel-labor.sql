-- Lernlabor „Beispiel-Labor: Schwimmt oder sinkt?“ (Version 1.0) registrieren – erzeugt aus labs/beispiel-labor/lab.manifest.json
begin;
insert into lernlabor.labs (id, title, subject, audience, current_version)
values ('beispiel-labor', 'Beispiel-Labor: Schwimmt oder sinkt?', 'Physik', 'Vorlage für neue Lernlabore', '1.0')
on conflict (id) do update set title = excluded.title, subject = excluded.subject,
  audience = excluded.audience, current_version = excluded.current_version;

insert into lernlabor.lab_versions (lab_id, version) values ('beispiel-labor', '1.0')
on conflict do nothing;

insert into lernlabor.lab_tasks (lab_id, version, task_id, position, section, title, kind, graded, counts_for_progress, options, solution) values
  ('beispiel-labor', '1.0', 'a1-vermutung', 1, 'Schwimmen und Sinken', 'Vermutung: Schwimmt ein Apfel?', 'choice', false, true, '[{"value":"schwimmt","label":"Er schwimmt."},{"value":"sinkt","label":"Er sinkt."}]'::jsonb, null),
  ('beispiel-labor', '1.0', 'a2-begruendung', 2, 'Schwimmen und Sinken', 'Begründung in eigenen Worten', 'text', false, true, '[]'::jsonb, null)
on conflict (lab_id, version, task_id) do update set
  position = excluded.position, section = excluded.section, title = excluded.title, kind = excluded.kind,
  graded = excluded.graded, counts_for_progress = excluded.counts_for_progress,
  options = excluded.options, solution = excluded.solution;
commit;
