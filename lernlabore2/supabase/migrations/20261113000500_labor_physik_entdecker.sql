-- =====================================================================
-- Online-Lernlabore 2.0 – Migration 5: Testlabor „Physik-Entdecker“
-- Erzeugt aus labs/physik-entdecker/lab.manifest.json
-- (node scripts/manifest-to-sql.mjs labs/physik-entdecker/lab.manifest.json)
-- =====================================================================

insert into lernlabor.labs (id, title, subject, audience, current_version)
values ('physik-entdecker', 'Physik-Entdecker: Bewegung und Strom', 'Physik / Sachunterricht', 'Klasse 4 (9–10 Jahre)', '1.0')
on conflict (id) do update set title = excluded.title, subject = excluded.subject,
  audience = excluded.audience, current_version = excluded.current_version;

insert into lernlabor.lab_versions (lab_id, version) values ('physik-entdecker', '1.0')
on conflict do nothing;

insert into lernlabor.lab_tasks (lab_id, version, task_id, position, section, title, kind, graded, counts_for_progress, options, solution) values
  ('physik-entdecker', '1.0', 'm1-vermutung', 1, 'Mechanik: Die rollende Kugel',
   'Vermutung: Auf welcher Rampe rollt die Kugel am schnellsten nach unten?', 'choice', false, true,
   '[{"value":"flach","label":"Auf der flachen Rampe"},{"value":"mittel","label":"Auf der mittleren Rampe"},{"value":"steil","label":"Auf der steilen Rampe"}]'::jsonb,
   null),
  ('physik-entdecker', '1.0', 'm2-versuch', 2, 'Mechanik: Die rollende Kugel',
   'Versuch: Kugel auf drei Rampen rollen lassen', 'simulation', false, true, '[]'::jsonb, null),
  ('physik-entdecker', '1.0', 'm3-auswertung', 3, 'Mechanik: Die rollende Kugel',
   'Auswertung: Was hast du beobachtet?', 'choice', true, true,
   '[{"value":"steil","label":"Auf der steilen Rampe war die Kugel am schnellsten unten."},{"value":"flach","label":"Auf der flachen Rampe war die Kugel am schnellsten unten."},{"value":"gleich","label":"Die Kugel war auf allen Rampen gleich schnell unten."}]'::jsonb,
   '{"correct":["steil"]}'::jsonb),
  ('physik-entdecker', '1.0', 'e1-vermutung', 4, 'Strom: Bring die Lampe zum Leuchten!',
   'Vermutung: Was braucht die Lampe, damit sie leuchtet?', 'choice', false, true,
   '[{"value":"batterie","label":"Nur eine Batterie"},{"value":"kreis","label":"Einen geschlossenen Kreis aus Batterie, Kabeln und Lampe"},{"value":"kabel","label":"Nur ein Kabel"},{"value":"weiss-nicht","label":"Ich weiß es noch nicht"}]'::jsonb,
   null),
  ('physik-entdecker', '1.0', 'e2-versuch', 5, 'Strom: Bring die Lampe zum Leuchten!',
   'Versuch: Stromkreis schließen und öffnen', 'simulation', false, true, '[]'::jsonb, null),
  ('physik-entdecker', '1.0', 'e3-auswertung', 6, 'Strom: Bring die Lampe zum Leuchten!',
   'Auswertung: Warum leuchtet die Lampe nur manchmal?', 'choice', true, true,
   '[{"value":"kreis","label":"Die Lampe leuchtet nur, wenn der Weg für den Strom rundherum geschlossen ist."},{"value":"muede","label":"Die Lampe braucht manchmal eine Pause."},{"value":"batterie-aus","label":"Die Batterie schaltet sich von selbst aus."}]'::jsonb,
   '{"correct":["kreis"]}'::jsonb)
on conflict (lab_id, version, task_id) do update set
  position = excluded.position, section = excluded.section, title = excluded.title, kind = excluded.kind,
  graded = excluded.graded, counts_for_progress = excluded.counts_for_progress,
  options = excluded.options, solution = excluded.solution;
