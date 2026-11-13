-- =====================================================================
-- Online-Lernlabore 2.0 – ERSTINSTALLATION (alle Migrationen in einer Datei)
-- Automatisch erzeugt mit: node scripts/bundle-sql.mjs – nicht von Hand ändern.
--
-- Verwendung: Supabase → SQL Editor → New query → gesamten Inhalt einfügen → Run.
-- Nur EINMAL auf einer leeren Datenbank ausführen. Spätere Aktualisierungen
-- über scripts/migrate.mjs bzw. den GitHub-Workflow einspielen.
-- =====================================================================

create schema if not exists lernlabor_private;
create table if not exists lernlabor_private.angewendete_migrationen (version text primary key, applied_at timestamptz not null default now());
revoke all on lernlabor_private.angewendete_migrationen from public;


-- >>>>>>>>>>>>>>>>>>>> 20261113000100_grundschema.sql >>>>>>>>>>>>>>>>>>>>
-- =====================================================================
-- Online-Lernlabore 2.0 – Migration 1: Grundschema
--
-- Grundsätze
--  * Es werden KEINE Klarnamen gespeichert. Teilnehmende sind nur über
--    zufällige UUIDs und kurze Pseudonyme (z. B. „P-8F2A“) bekannt.
--  * Zugangscodes werden nur als HMAC-SHA-256 mit einem serverseitigen
--    Geheimnis (Pepper) gespeichert, nie im Klartext.
--  * Alle Tabellen liegen im Schema „lernlabor“, das NICHT über die
--    REST-Schnittstelle (PostgREST) veröffentlicht wird. Zugriff erfolgt
--    ausschließlich über die Funktionen im Schema „public“ (RPC).
--  * Row-Level-Security ist auf allen Tabellen aktiv. Lehrkräfte dürfen
--    nur Zeilen ihrer eigenen Lerngruppen lesen. Schreiben ist nur über
--    geprüfte Funktionen möglich.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

create schema if not exists lernlabor;
create schema if not exists lernlabor_private;

revoke all on schema lernlabor from public;
revoke all on schema lernlabor_private from public;
-- Lehrkräfte (Rolle authenticated) benötigen USAGE, damit ihre
-- Lesefunktionen (SECURITY INVOKER) unter RLS auf die Tabellen zugreifen.
grant usage on schema lernlabor to authenticated;
-- anon (Schülerinnen und Schüler, Gäste) erhält KEINEN Zugriff auf das Schema.

-- ---------------------------------------------------------------------
-- Serverseitige Geheimnisse (nur für Funktionen mit SECURITY DEFINER)
-- ---------------------------------------------------------------------
create table if not exists lernlabor_private.settings (
  key        text primary key,
  value      bytea not null,
  created_at timestamptz not null default now()
);
alter table lernlabor_private.settings enable row level security;
revoke all on lernlabor_private.settings from public;

-- Die Geheimnisse werden IN der Datenbank erzeugt und verlassen sie nie.
insert into lernlabor_private.settings (key, value) values
  ('code_pepper',       extensions.gen_random_bytes(32)),
  ('client_key_pepper', extensions.gen_random_bytes(32))
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- Lehrkräfte (verknüpft mit Supabase Auth)
-- ---------------------------------------------------------------------
create table lernlabor.teachers (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 80),
  is_admin     boolean not null default false,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Lerngruppen: Klassen, Veranstaltungen (Gastmodus) und Demo-Gruppen
-- ---------------------------------------------------------------------
create table lernlabor.groups (
  id              uuid primary key default gen_random_uuid(),
  label           text not null check (char_length(btrim(label)) between 1 and 60),
  kind            text not null default 'class' check (kind in ('class', 'event', 'demo')),
  valid_from      timestamptz,
  valid_until     timestamptz,
  retention_until date not null default (current_date + 365),
  archived_at     timestamptz,
  created_by      uuid references lernlabor.teachers (user_id) on delete set null,
  created_at      timestamptz not null default now(),
  constraint groups_validity_order check (valid_until is null or valid_from is null or valid_until > valid_from)
);
comment on column lernlabor.groups.label is 'Pseudonyme Bezeichnung, z. B. „7a Physik“. Keine Namen von Personen eintragen.';
comment on column lernlabor.groups.retention_until is 'Nach diesem Datum werden die Gruppe und alle Ergebnisse automatisch gelöscht.';

create table lernlabor.group_teachers (
  group_id   uuid not null references lernlabor.groups (id) on delete cascade,
  teacher_id uuid not null references lernlabor.teachers (user_id) on delete cascade,
  role       text not null default 'owner' check (role in ('owner', 'member')),
  added_at   timestamptz not null default now(),
  primary key (group_id, teacher_id)
);
create index group_teachers_teacher_idx on lernlabor.group_teachers (teacher_id);

-- ---------------------------------------------------------------------
-- Teilnehmende (pseudonym) und Zugangscodes (nur HMAC)
-- ---------------------------------------------------------------------
create table lernlabor.participants (
  id         uuid primary key,  -- zufällig, wird lokal im Lehrerprogramm erzeugt
  group_id   uuid not null references lernlabor.groups (id) on delete cascade,
  pseudonym  text not null check (pseudonym ~ '^[PGD]-[A-HJKMNP-Z2-9]{4,6}$'),
  status     text not null default 'active' check (status in ('active', 'blocked')),
  created_at timestamptz not null default now(),
  unique (group_id, pseudonym)
);
create index participants_group_idx on lernlabor.participants (group_id);

create table lernlabor.access_codes (
  id             uuid primary key default gen_random_uuid(),
  participant_id uuid not null references lernlabor.participants (id) on delete cascade,
  code_hmac      bytea not null unique,
  valid_until    timestamptz,
  revoked_at     timestamptz,
  created_at     timestamptz not null default now()
);
create index access_codes_participant_idx on lernlabor.access_codes (participant_id);

create table lernlabor.student_sessions (
  token_hash     bytea primary key,  -- SHA-256 des Sitzungstokens; das Token selbst wird nicht gespeichert
  participant_id uuid not null references lernlabor.participants (id) on delete cascade,
  access_code_id uuid not null references lernlabor.access_codes (id) on delete cascade,
  created_at     timestamptz not null default now(),
  expires_at     timestamptz not null,
  revoked_at     timestamptz
);
create index student_sessions_participant_idx on lernlabor.student_sessions (participant_id);
create index student_sessions_expires_idx on lernlabor.student_sessions (expires_at);

-- Fehlgeschlagene Anmeldungen (für die Begrenzung von Rateversuchen).
-- Es wird keine IP-Adresse gespeichert, nur ein HMAC davon; Löschung nach 24 h.
create table lernlabor.login_failures (
  id         bigint generated always as identity primary key,
  client_key bytea not null,
  failed_at  timestamptz not null default now()
);
create index login_failures_client_idx on lernlabor.login_failures (client_key, failed_at);
create index login_failures_time_idx on lernlabor.login_failures (failed_at);

-- ---------------------------------------------------------------------
-- Lernlabore, Versionen und Aufgaben
-- ---------------------------------------------------------------------
create table lernlabor.labs (
  id              text primary key check (id ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  title           text not null,
  subject         text not null default 'Physik',
  audience        text not null default '',
  current_version text,
  created_at      timestamptz not null default now()
);

create table lernlabor.lab_versions (
  lab_id      text not null references lernlabor.labs (id) on delete cascade,
  version     text not null check (version ~ '^[0-9]+(\.[0-9]+){0,2}$'),
  released_at timestamptz not null default now(),
  primary key (lab_id, version)
);

create table lernlabor.lab_tasks (
  lab_id              text not null,
  version             text not null,
  task_id             text not null check (task_id ~ '^[a-z0-9][a-z0-9._-]{0,62}$'),
  position            int not null,
  section             text not null default '',
  title               text not null,
  kind                text not null check (kind in ('choice', 'multi', 'text', 'number', 'simulation', 'measurement', 'other')),
  graded              boolean not null default false,
  counts_for_progress boolean not null default true,
  options             jsonb not null default '[]'::jsonb,
  solution            jsonb,
  primary key (lab_id, version, task_id),
  foreign key (lab_id, version) references lernlabor.lab_versions (lab_id, version) on delete cascade
);

-- Zuweisung von Lernlaboren an Lerngruppen (ein „Durchgang“)
create table lernlabor.group_labs (
  group_id    uuid not null references lernlabor.groups (id) on delete cascade,
  lab_id      text not null references lernlabor.labs (id) on delete cascade,
  assigned_at timestamptz not null default now(),
  archived_at timestamptz,
  primary key (group_id, lab_id)
);

-- ---------------------------------------------------------------------
-- Ergebnisse und Fortschritt
-- ---------------------------------------------------------------------
create table lernlabor.task_results (
  participant_id     uuid not null references lernlabor.participants (id) on delete cascade,
  group_id           uuid not null references lernlabor.groups (id) on delete cascade,
  lab_id             text not null references lernlabor.labs (id) on delete cascade,
  task_id            text not null,
  lab_version        text not null,
  answer             jsonb not null default '{}'::jsonb,
  data               jsonb not null default '{}'::jsonb,
  status             text not null check (status in ('in_progress', 'completed')),
  is_correct         boolean,
  first_is_correct   boolean,
  revision           int not null default 1 check (revision > 0),
  first_completed_at timestamptz,
  client_saved_at    timestamptz,
  updated_at         timestamptz not null default now(),
  primary key (participant_id, lab_id, task_id)
);
create index task_results_group_lab_idx on lernlabor.task_results (group_id, lab_id);

create table lernlabor.lab_progress (
  participant_id  uuid not null references lernlabor.participants (id) on delete cascade,
  group_id        uuid not null references lernlabor.groups (id) on delete cascade,
  lab_id          text not null references lernlabor.labs (id) on delete cascade,
  lab_version     text not null,
  completed_tasks int not null default 0,
  total_tasks     int not null default 0,
  percent         int not null default 0 check (percent between 0 and 100),
  resume_state    jsonb not null default '{}'::jsonb,
  started_at      timestamptz not null default now(),
  last_saved_at   timestamptz not null default now(),
  finished_at     timestamptz,
  primary key (participant_id, lab_id)
);
create index lab_progress_group_lab_idx on lernlabor.lab_progress (group_id, lab_id);

-- Idempotenz: bereits verarbeitete Speicheroperationen (verhindert Doppelungen bei Wiederholungen)
create table lernlabor.applied_ops (
  participant_id uuid not null references lernlabor.participants (id) on delete cascade,
  op_id          uuid not null,
  applied_at     timestamptz not null default now(),
  primary key (participant_id, op_id)
);
create index applied_ops_time_idx on lernlabor.applied_ops (applied_at);

-- Protokoll notwendiger administrativer Aktionen (ohne Codes, ohne Namen)
create table lernlabor.audit_log (
  id       bigint generated always as identity primary key,
  at       timestamptz not null default now(),
  actor    uuid,
  action   text not null,
  group_id uuid,
  details  jsonb not null default '{}'::jsonb
);
create index audit_log_group_idx on lernlabor.audit_log (group_id, at);

-- ---------------------------------------------------------------------
-- Hilfsfunktionen für Berechtigungen (werden in RLS-Regeln genutzt)
-- ---------------------------------------------------------------------
create or replace function lernlabor.is_teacher()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from lernlabor.teachers t where t.user_id = auth.uid());
$$;

create or replace function lernlabor.is_group_member(p_group uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from lernlabor.group_teachers gt
    where gt.group_id = p_group and gt.teacher_id = auth.uid()
  );
$$;

revoke all on function lernlabor.is_teacher() from public;
revoke all on function lernlabor.is_group_member(uuid) from public;
grant execute on function lernlabor.is_teacher() to authenticated;
grant execute on function lernlabor.is_group_member(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Row-Level-Security
-- ---------------------------------------------------------------------
alter table lernlabor.teachers         enable row level security;
alter table lernlabor.groups           enable row level security;
alter table lernlabor.group_teachers   enable row level security;
alter table lernlabor.participants     enable row level security;
alter table lernlabor.access_codes     enable row level security;
alter table lernlabor.student_sessions enable row level security;
alter table lernlabor.login_failures   enable row level security;
alter table lernlabor.labs             enable row level security;
alter table lernlabor.lab_versions     enable row level security;
alter table lernlabor.lab_tasks        enable row level security;
alter table lernlabor.group_labs       enable row level security;
alter table lernlabor.task_results     enable row level security;
alter table lernlabor.lab_progress     enable row level security;
alter table lernlabor.applied_ops      enable row level security;
alter table lernlabor.audit_log        enable row level security;

-- Grundsätzlich keine Rechte für irgendwen …
revoke all on all tables in schema lernlabor from public;
revoke all on all tables in schema lernlabor_private from public;
do $$
begin
  execute 'revoke all on all tables in schema lernlabor from anon, authenticated';
  execute 'revoke all on all tables in schema lernlabor_private from anon, authenticated';
end $$;

-- … außer Lesezugriff für Lehrkräfte, eingeschränkt durch RLS-Regeln.
grant select on
  lernlabor.teachers, lernlabor.groups, lernlabor.group_teachers, lernlabor.participants,
  lernlabor.labs, lernlabor.lab_versions, lernlabor.lab_tasks, lernlabor.group_labs,
  lernlabor.task_results, lernlabor.lab_progress, lernlabor.audit_log
to authenticated;
-- Zugangscodes: nur unkritische Spalten (kein HMAC)
grant select (id, participant_id, valid_until, revoked_at, created_at) on lernlabor.access_codes to authenticated;

create policy teachers_self on lernlabor.teachers
  for select to authenticated using (user_id = (select auth.uid()));

create policy groups_member on lernlabor.groups
  for select to authenticated using (lernlabor.is_group_member(id));

create policy group_teachers_member on lernlabor.group_teachers
  for select to authenticated using (lernlabor.is_group_member(group_id));

create policy participants_member on lernlabor.participants
  for select to authenticated using (lernlabor.is_group_member(group_id));

create policy access_codes_member on lernlabor.access_codes
  for select to authenticated using (
    exists (select 1 from lernlabor.participants p
            where p.id = participant_id and lernlabor.is_group_member(p.group_id)));

create policy labs_teacher on lernlabor.labs
  for select to authenticated using (lernlabor.is_teacher());
create policy lab_versions_teacher on lernlabor.lab_versions
  for select to authenticated using (lernlabor.is_teacher());
create policy lab_tasks_teacher on lernlabor.lab_tasks
  for select to authenticated using (lernlabor.is_teacher());

create policy group_labs_member on lernlabor.group_labs
  for select to authenticated using (lernlabor.is_group_member(group_id));
create policy task_results_member on lernlabor.task_results
  for select to authenticated using (lernlabor.is_group_member(group_id));
create policy lab_progress_member on lernlabor.lab_progress
  for select to authenticated using (lernlabor.is_group_member(group_id));
create policy audit_log_member on lernlabor.audit_log
  for select to authenticated using (group_id is not null and lernlabor.is_group_member(group_id));

-- student_sessions, login_failures, applied_ops: keine Policies → kein Zugriff außer über Funktionen.

insert into lernlabor_private.angewendete_migrationen (version) values ('20261113000100_grundschema') on conflict do nothing;


-- >>>>>>>>>>>>>>>>>>>> 20261113000200_interne_funktionen.sql >>>>>>>>>>>>>>>>>>>>
-- =====================================================================
-- Online-Lernlabore 2.0 – Migration 2: interne Hilfsfunktionen
-- Diese Funktionen liegen im nicht veröffentlichten Schema
-- „lernlabor_private“ und sind von außen nicht aufrufbar.
-- =====================================================================

-- Code normalisieren: Großbuchstaben, nur Buchstaben/Ziffern (Bindestriche/Leerzeichen entfallen)
create or replace function lernlabor.normalize_code(p_code text)
returns text
language sql immutable set search_path = ''
as $$
  select upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
$$;
revoke all on function lernlabor.normalize_code(text) from public;

-- HMAC-SHA-256 eines normalisierten Codes mit serverseitigem Geheimnis
create or replace function lernlabor_private.code_hmac(p_norm text)
returns bytea
language sql stable security definer set search_path = ''
as $$
  select extensions.hmac(
    convert_to(p_norm, 'UTF8'),
    (select s.value from lernlabor_private.settings s where s.key = 'code_pepper'),
    'sha256');
$$;
revoke all on function lernlabor_private.code_hmac(text) from public;

-- Pseudonymer Schlüssel für die Begrenzung von Anmeldeversuchen.
-- Die IP-Adresse wird nicht gespeichert, nur ein HMAC davon.
create or replace function lernlabor_private.client_key()
returns bytea
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_headers jsonb;
  v_ip text;
begin
  begin
    v_headers := nullif(current_setting('request.headers', true), '')::jsonb;
  exception when others then
    v_headers := null;
  end;
  v_ip := coalesce(v_headers ->> 'cf-connecting-ip', v_headers ->> 'x-real-ip', v_headers ->> 'x-forwarded-for', 'unbekannt');
  return extensions.hmac(
    convert_to(v_ip, 'UTF8'),
    (select s.value from lernlabor_private.settings s where s.key = 'client_key_pepper'),
    'sha256');
end;
$$;
revoke all on function lernlabor_private.client_key() from public;

create or replace function lernlabor_private.token_hash(p_token text)
returns bytea
language sql immutable set search_path = ''
as $$
  select extensions.digest(convert_to(coalesce(p_token, ''), 'UTF8'), 'sha256');
$$;
revoke all on function lernlabor_private.token_hash(text) from public;

-- Sitzung prüfen: liefert genau eine Zeile, wenn Sitzung, Code, Teilnehmende
-- und Gruppe gültig sind – sonst keine.
create or replace function lernlabor_private.resolve_session(p_token text)
returns table (participant_id uuid, group_id uuid, pseudonym text, group_kind text, expires_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select p.id, g.id, p.pseudonym, g.kind, s.expires_at
  from lernlabor.student_sessions s
  join lernlabor.participants p on p.id = s.participant_id
  join lernlabor.access_codes c on c.id = s.access_code_id
  join lernlabor.groups g on g.id = p.group_id
  where s.token_hash = lernlabor_private.token_hash(p_token)
    and s.revoked_at is null
    and s.expires_at > now()
    and p.status = 'active'
    and c.revoked_at is null
    and (c.valid_until is null or c.valid_until > now())
    and g.archived_at is null
    and (g.valid_from is null or g.valid_from <= now())
    and (g.valid_until is null or g.valid_until > now());
$$;
revoke all on function lernlabor_private.resolve_session(text) from public;

-- Ist ein Lernlabor der Gruppe zugewiesen und aktiv?
create or replace function lernlabor_private.lab_open_for_group(p_group uuid, p_lab text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from lernlabor.group_labs gl
    where gl.group_id = p_group and gl.lab_id = p_lab and gl.archived_at is null);
$$;
revoke all on function lernlabor_private.lab_open_for_group(uuid, text) from public;

-- Daten, die eine angemeldete Person über sich selbst sehen darf
create or replace function lernlabor_private.participant_payload(p_participant uuid)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'pseudonym', p.pseudonym,
    -- stabiler, nicht sprechender Schlüssel für die Offline-Warteschlange im Browser
    'key', substr(encode(extensions.digest(convert_to(p.id::text, 'UTF8'), 'sha256'), 'hex'), 1, 32),
    'group', jsonb_build_object('label', g.label, 'kind', g.kind, 'valid_until', g.valid_until),
    'labs', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', l.id, 'title', l.title, 'subject', l.subject, 'audience', l.audience,
               'version', l.current_version,
               'percent', coalesce(lp.percent, 0),
               'finished', lp.finished_at is not null)
             order by gl.assigned_at, l.id)
      from lernlabor.group_labs gl
      join lernlabor.labs l on l.id = gl.lab_id
      left join lernlabor.lab_progress lp on lp.participant_id = p.id and lp.lab_id = l.id
      where gl.group_id = g.id and gl.archived_at is null), '[]'::jsonb))
  from lernlabor.participants p
  join lernlabor.groups g on g.id = p.group_id
  where p.id = p_participant;
$$;
revoke all on function lernlabor_private.participant_payload(uuid) from public;

-- Ergebniszeile als JSON (für Antworten an das Lernlabor)
create or replace function lernlabor_private.result_json(r lernlabor.task_results)
returns jsonb
language sql stable set search_path = ''
as $$
  select case when r.task_id is null then null else jsonb_build_object(
    'task_id', r.task_id,
    'lab_version', r.lab_version,
    'answer', r.answer,
    'data', r.data,
    'status', r.status,
    'is_correct', r.is_correct,
    'revision', r.revision,
    'updated_at', r.updated_at) end;
$$;
revoke all on function lernlabor_private.result_json(lernlabor.task_results) from public;

-- Fortschritt eines Labors für eine Person neu berechnen (konsistent, wiederholbar)
create or replace function lernlabor_private.recompute_progress(
  p_participant uuid, p_group uuid, p_lab text, p_version text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_total int;
  v_done int;
  v_pct int;
begin
  select count(*) into v_total
  from lernlabor.lab_tasks t
  where t.lab_id = p_lab and t.version = p_version and t.counts_for_progress;

  select count(*) into v_done
  from lernlabor.task_results r
  join lernlabor.lab_tasks t
    on t.lab_id = r.lab_id and t.version = p_version and t.task_id = r.task_id and t.counts_for_progress
  where r.participant_id = p_participant and r.lab_id = p_lab and r.status = 'completed';

  v_pct := case
    when v_total = 0 then 0
    when v_done >= v_total then 100
    else least(99, round(100.0 * v_done / v_total)::int) end;

  insert into lernlabor.lab_progress as lp
    (participant_id, group_id, lab_id, lab_version, completed_tasks, total_tasks, percent, last_saved_at, finished_at)
  values
    (p_participant, p_group, p_lab, p_version, v_done, v_total, v_pct, now(),
     case when v_total > 0 and v_done >= v_total then now() end)
  on conflict (participant_id, lab_id) do update set
    lab_version     = excluded.lab_version,
    completed_tasks = excluded.completed_tasks,
    total_tasks     = excluded.total_tasks,
    percent         = excluded.percent,
    last_saved_at   = now(),
    finished_at     = case when excluded.total_tasks > 0 and excluded.completed_tasks >= excluded.total_tasks
                           then coalesce(lp.finished_at, now()) else null end;

  return jsonb_build_object('completed', v_done, 'total', v_total, 'percent', v_pct);
end;
$$;
revoke all on function lernlabor_private.recompute_progress(uuid, uuid, text, text) from public;

create or replace function lernlabor_private.progress_json(p_participant uuid, p_lab text)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select jsonb_build_object('completed', lp.completed_tasks, 'total', lp.total_tasks,
                               'percent', lp.percent, 'lab_version', lp.lab_version,
                               'last_saved_at', lp.last_saved_at, 'finished_at', lp.finished_at)
     from lernlabor.lab_progress lp where lp.participant_id = p_participant and lp.lab_id = p_lab),
    jsonb_build_object('completed', 0,
                       'total', (select count(*) from lernlabor.lab_tasks t
                                 join lernlabor.labs l on l.id = t.lab_id and l.current_version = t.version
                                 where t.lab_id = p_lab and t.counts_for_progress),
                       'percent', 0, 'lab_version', null, 'last_saved_at', null, 'finished_at', null));
$$;
revoke all on function lernlabor_private.progress_json(uuid, text) from public;

-- Berechtigungsprüfungen für Lehrkraft-Funktionen
create or replace function lernlabor_private.require_teacher()
returns uuid
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not exists (select 1 from lernlabor.teachers t where t.user_id = v_uid) then
    raise exception using errcode = '42501', message = 'Nur für freigeschaltete Lehrkräfte.';
  end if;
  return v_uid;
end;
$$;
revoke all on function lernlabor_private.require_teacher() from public;

create or replace function lernlabor_private.require_group(p_group uuid, p_owner boolean default false)
returns uuid
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_uid uuid := lernlabor_private.require_teacher();
begin
  if not exists (
    select 1 from lernlabor.group_teachers gt
    where gt.group_id = p_group and gt.teacher_id = v_uid and (not p_owner or gt.role = 'owner')) then
    raise exception using errcode = '42501', message = 'Kein Zugriff auf diese Lerngruppe.';
  end if;
  return v_uid;
end;
$$;
revoke all on function lernlabor_private.require_group(uuid, boolean) from public;

create or replace function lernlabor_private.audit(p_action text, p_group uuid, p_details jsonb default '{}'::jsonb)
returns void
language sql security definer set search_path = ''
as $$
  insert into lernlabor.audit_log (actor, action, group_id, details)
  values (auth.uid(), p_action, p_group, coalesce(p_details, '{}'::jsonb));
$$;
revoke all on function lernlabor_private.audit(text, uuid, jsonb) from public;

-- Aufbewahrungsfristen durchsetzen (siehe auch Migration 6 / pg_cron)
create or replace function lernlabor_private.purge_expired()
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_groups int; v_sessions int; v_failures int; v_ops int; v_audit int;
begin
  with d as (
    delete from lernlabor.groups g where g.retention_until < current_date returning g.id)
  select count(*) into v_groups from d;

  with d as (
    delete from lernlabor.student_sessions s
    where s.expires_at < now() - interval '1 day' or s.revoked_at < now() - interval '1 day' returning 1)
  select count(*) into v_sessions from d;

  with d as (delete from lernlabor.login_failures f where f.failed_at < now() - interval '1 day' returning 1)
  select count(*) into v_failures from d;

  with d as (delete from lernlabor.applied_ops o where o.applied_at < now() - interval '60 days' returning 1)
  select count(*) into v_ops from d;

  with d as (delete from lernlabor.audit_log a where a.at < now() - interval '400 days' returning 1)
  select count(*) into v_audit from d;

  if v_groups > 0 then
    insert into lernlabor.audit_log (actor, action, group_id, details)
    values (auth.uid(), 'purge_expired', null, jsonb_build_object('groups_deleted', v_groups));
  end if;

  return jsonb_build_object('groups_deleted', v_groups, 'sessions_deleted', v_sessions,
                            'login_failures_deleted', v_failures, 'ops_deleted', v_ops, 'audit_deleted', v_audit);
end;
$$;
revoke all on function lernlabor_private.purge_expired() from public;

insert into lernlabor_private.angewendete_migrationen (version) values ('20261113000200_interne_funktionen') on conflict do nothing;


-- >>>>>>>>>>>>>>>>>>>> 20261113000300_schueler_api.sql >>>>>>>>>>>>>>>>>>>>
-- =====================================================================
-- Online-Lernlabore 2.0 – Migration 3: Schnittstelle für Lernende
--
-- Aufrufbar mit dem öffentlichen (anon/publishable) Schlüssel.
-- Alle Funktionen prüfen serverseitig Code bzw. Sitzung.
-- Rückgabe immer JSON: {"ok": true, ...} oder {"ok": false, "error": "<code>"}.
-- Fehler werden bewusst NICHT als Exception gemeldet, damit z. B. die
-- Zählung fehlgeschlagener Anmeldungen nicht durch einen Rollback verloren geht.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Anmeldung mit Zugangscode
-- ---------------------------------------------------------------------
create or replace function public.student_login(p_code text)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  c_max_fail_client constant int := 60;    -- pro Anschluss in 10 Minuten (Schulen teilen sich oft eine IP!)
  c_max_fail_global constant int := 5000;  -- insgesamt in 10 Minuten
  v_client bytea := lernlabor_private.client_key();
  v_norm   text  := lernlabor.normalize_code(p_code);
  v_count  int;
  v_rec    record;
  v_token  text;
  v_expires timestamptz;
begin
  select count(*) into v_count from lernlabor.login_failures f
  where f.client_key = v_client and f.failed_at > now() - interval '10 minutes';
  if v_count >= c_max_fail_client then
    return jsonb_build_object('ok', false, 'error', 'rate_limited');
  end if;

  select count(*) into v_count from lernlabor.login_failures f
  where f.failed_at > now() - interval '10 minutes';
  if v_count >= c_max_fail_global then
    return jsonb_build_object('ok', false, 'error', 'rate_limited');
  end if;

  if v_norm !~ '^[A-HJKMNP-Z2-9]{8,16}$' then
    insert into lernlabor.login_failures (client_key) values (v_client);
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;

  select c.id as code_id, c.valid_until as code_valid_until, c.revoked_at,
         p.id as participant_id, p.status,
         g.id as group_id, g.valid_from, g.valid_until, g.archived_at
    into v_rec
  from lernlabor.access_codes c
  join lernlabor.participants p on p.id = c.participant_id
  join lernlabor.groups g on g.id = p.group_id
  where c.code_hmac = lernlabor_private.code_hmac(v_norm);

  if not found then
    insert into lernlabor.login_failures (client_key) values (v_client);
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;

  if v_rec.revoked_at is not null or v_rec.status <> 'active' then
    insert into lernlabor.login_failures (client_key) values (v_client);
    return jsonb_build_object('ok', false, 'error', 'blocked');
  end if;

  if v_rec.archived_at is not null
     or (v_rec.code_valid_until is not null and v_rec.code_valid_until <= now())
     or (v_rec.valid_until is not null and v_rec.valid_until <= now()) then
    insert into lernlabor.login_failures (client_key) values (v_client);
    return jsonb_build_object('ok', false, 'error', 'expired');
  end if;

  if v_rec.valid_from is not null and v_rec.valid_from > now() then
    return jsonb_build_object('ok', false, 'error', 'not_yet_valid', 'valid_from', v_rec.valid_from);
  end if;

  -- Sitzungstoken: 256 Bit Zufall, URL-sicher; gespeichert wird nur der SHA-256-Wert.
  v_token := translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/=', '-_');
  v_expires := least(now() + interval '12 hours',
                     coalesce(v_rec.code_valid_until, 'infinity'::timestamptz),
                     coalesce(v_rec.valid_until, 'infinity'::timestamptz));

  insert into lernlabor.student_sessions (token_hash, participant_id, access_code_id, expires_at)
  values (lernlabor_private.token_hash(v_token), v_rec.participant_id, v_rec.code_id, v_expires);

  -- Aufräumen (günstig dank Indizes)
  delete from lernlabor.login_failures f where f.failed_at < now() - interval '1 day';
  delete from lernlabor.student_sessions s where s.expires_at < now() - interval '1 day';

  return jsonb_build_object(
    'ok', true,
    'session_token', v_token,
    'expires_at', v_expires,
    'participant', lernlabor_private.participant_payload(v_rec.participant_id));
end;
$$;

-- ---------------------------------------------------------------------
-- Sitzung prüfen (z. B. nach dem Neuladen der Seite)
-- ---------------------------------------------------------------------
create or replace function public.student_session_info(p_session text)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_s record;
begin
  select * into v_s from lernlabor_private.resolve_session(p_session);
  if not found then
    return jsonb_build_object('ok', false, 'error', 'session_invalid');
  end if;
  return jsonb_build_object('ok', true, 'expires_at', v_s.expires_at,
                            'participant', lernlabor_private.participant_payload(v_s.participant_id));
end;
$$;

-- ---------------------------------------------------------------------
-- Lernstand eines Labors laden
-- ---------------------------------------------------------------------
create or replace function public.student_load_lab(p_session text, p_lab_id text)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_s   record;
  v_lab record;
begin
  select * into v_s from lernlabor_private.resolve_session(p_session);
  if not found then
    return jsonb_build_object('ok', false, 'error', 'session_invalid');
  end if;

  if not lernlabor_private.lab_open_for_group(v_s.group_id, p_lab_id) then
    return jsonb_build_object('ok', false, 'error', 'lab_not_assigned');
  end if;

  select l.id, l.title, l.current_version into v_lab from lernlabor.labs l where l.id = p_lab_id;

  return jsonb_build_object(
    'ok', true,
    'participant', jsonb_build_object('pseudonym', v_s.pseudonym, 'group_kind', v_s.group_kind),
    'lab', jsonb_build_object(
      'id', v_lab.id, 'title', v_lab.title, 'version', v_lab.current_version,
      'tasks', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'task_id', t.task_id, 'position', t.position, 'section', t.section, 'title', t.title,
                 'kind', t.kind, 'counts_for_progress', t.counts_for_progress)
               order by t.position)
        from lernlabor.lab_tasks t where t.lab_id = v_lab.id and t.version = v_lab.current_version), '[]'::jsonb)),
    'results', coalesce((
      select jsonb_agg(lernlabor_private.result_json(r) order by r.task_id)
      from lernlabor.task_results r
      where r.participant_id = v_s.participant_id and r.lab_id = p_lab_id), '[]'::jsonb),
    'progress', lernlabor_private.progress_json(v_s.participant_id, p_lab_id),
    'resume_state', coalesce((select lp.resume_state from lernlabor.lab_progress lp
                              where lp.participant_id = v_s.participant_id and lp.lab_id = p_lab_id), '{}'::jsonb));
end;
$$;

-- ---------------------------------------------------------------------
-- Ergebnis einer Aufgabe speichern
--  * idempotent über p_op_id (Wiederholungen erzeugen keine Doppelungen)
--  * optimistische Sperre über p_base_revision (schützt neuere Ergebnisse)
--  * „abgeschlossen“ bleibt abgeschlossen
-- ---------------------------------------------------------------------
create or replace function public.student_save_task(
  p_session         text,
  p_lab_id          text,
  p_lab_version     text,
  p_task_id         text,
  p_op_id           uuid,
  p_base_revision   int default 0,
  p_answer          jsonb default '{}'::jsonb,
  p_data            jsonb default '{}'::jsonb,
  p_completed       boolean default false,
  p_client_saved_at timestamptz default null)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_s        record;
  v_task     record;
  v_row      lernlabor.task_results;
  v_correct  boolean;
  v_answer   jsonb := coalesce(p_answer, '{}'::jsonb);
  v_data     jsonb := coalesce(p_data, '{}'::jsonb);
  v_inserted int;
  v_progress jsonb;
begin
  select * into v_s from lernlabor_private.resolve_session(p_session);
  if not found then
    return jsonb_build_object('ok', false, 'error', 'session_invalid');
  end if;

  if p_op_id is null or jsonb_typeof(v_answer) <> 'object' or jsonb_typeof(v_data) <> 'object' then
    return jsonb_build_object('ok', false, 'error', 'invalid_request');
  end if;

  -- Wiederholte Übertragung derselben Operation → bestehendes Ergebnis zurückgeben
  if exists (select 1 from lernlabor.applied_ops o where o.participant_id = v_s.participant_id and o.op_id = p_op_id) then
    select * into v_row from lernlabor.task_results r
    where r.participant_id = v_s.participant_id and r.lab_id = p_lab_id and r.task_id = p_task_id;
    return jsonb_build_object('ok', true, 'status', 'duplicate',
                              'result', lernlabor_private.result_json(v_row),
                              'progress', lernlabor_private.progress_json(v_s.participant_id, p_lab_id));
  end if;

  if not lernlabor_private.lab_open_for_group(v_s.group_id, p_lab_id) then
    return jsonb_build_object('ok', false, 'error', 'lab_not_assigned');
  end if;

  select t.* into v_task from lernlabor.lab_tasks t
  where t.lab_id = p_lab_id and t.version = p_lab_version and t.task_id = p_task_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'unknown_task');
  end if;

  if octet_length(v_answer::text) > 16000 or octet_length(v_data::text) > 32000 then
    return jsonb_build_object('ok', false, 'error', 'too_large');
  end if;

  -- Bewertung (nur bei Aufgaben mit hinterlegter Lösung)
  if v_task.graded and v_task.solution ? 'correct' and v_answer ? 'choice' then
    v_correct := (v_answer ->> 'choice') in (select jsonb_array_elements_text(v_task.solution -> 'correct'));
  else
    v_correct := null;
  end if;

  select * into v_row from lernlabor.task_results r
  where r.participant_id = v_s.participant_id and r.lab_id = p_lab_id and r.task_id = p_task_id
  for update;

  if not found then
    if coalesce(p_base_revision, 0) <> 0 then
      -- Der Client kennt einen Stand, den es nicht mehr gibt (z. B. von der Lehrkraft zurückgesetzt)
      return jsonb_build_object('ok', true, 'status', 'conflict', 'result', null,
                                'progress', lernlabor_private.progress_json(v_s.participant_id, p_lab_id));
    end if;
    insert into lernlabor.task_results as r
      (participant_id, group_id, lab_id, task_id, lab_version, answer, data, status, is_correct,
       first_is_correct, revision, first_completed_at, client_saved_at, updated_at)
    values
      (v_s.participant_id, v_s.group_id, p_lab_id, p_task_id, p_lab_version, v_answer, v_data,
       case when p_completed then 'completed' else 'in_progress' end, v_correct,
       case when p_completed then v_correct end, 1,
       case when p_completed then now() end, p_client_saved_at, now())
    on conflict (participant_id, lab_id, task_id) do nothing;
    get diagnostics v_inserted = row_count;
    if v_inserted = 0 then
      -- gleichzeitiger Speicherversuch (z. B. zweites Gerät) → Konflikt melden
      select * into v_row from lernlabor.task_results r
      where r.participant_id = v_s.participant_id and r.lab_id = p_lab_id and r.task_id = p_task_id;
      return jsonb_build_object('ok', true, 'status', 'conflict', 'result', lernlabor_private.result_json(v_row),
                                'progress', lernlabor_private.progress_json(v_s.participant_id, p_lab_id));
    end if;
  else
    if coalesce(p_base_revision, 0) <> v_row.revision then
      return jsonb_build_object('ok', true, 'status', 'conflict', 'result', lernlabor_private.result_json(v_row),
                                'progress', lernlabor_private.progress_json(v_s.participant_id, p_lab_id));
    end if;
    update lernlabor.task_results r set
      lab_version        = p_lab_version,
      answer             = v_answer,
      data               = v_data,
      status             = case when p_completed or r.status = 'completed' then 'completed' else 'in_progress' end,
      is_correct         = v_correct,
      first_is_correct   = case when r.first_completed_at is null and p_completed then v_correct else r.first_is_correct end,
      first_completed_at = case when r.first_completed_at is null and p_completed then now() else r.first_completed_at end,
      revision           = r.revision + 1,
      client_saved_at    = p_client_saved_at,
      updated_at         = now()
    where r.participant_id = v_s.participant_id and r.lab_id = p_lab_id and r.task_id = p_task_id;
  end if;

  insert into lernlabor.applied_ops (participant_id, op_id) values (v_s.participant_id, p_op_id);

  v_progress := lernlabor_private.recompute_progress(v_s.participant_id, v_s.group_id, p_lab_id, p_lab_version);

  select * into v_row from lernlabor.task_results r
  where r.participant_id = v_s.participant_id and r.lab_id = p_lab_id and r.task_id = p_task_id;

  return jsonb_build_object('ok', true, 'status', 'saved',
                            'result', lernlabor_private.result_json(v_row),
                            'progress', v_progress);
end;
$$;

-- ---------------------------------------------------------------------
-- Fortsetzungspunkt (z. B. aktueller Schritt) speichern – klein, letzte Version gewinnt
-- ---------------------------------------------------------------------
create or replace function public.student_save_resume(p_session text, p_lab_id text, p_state jsonb)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_s record;
  v_version text;
begin
  select * into v_s from lernlabor_private.resolve_session(p_session);
  if not found then
    return jsonb_build_object('ok', false, 'error', 'session_invalid');
  end if;
  if not lernlabor_private.lab_open_for_group(v_s.group_id, p_lab_id) then
    return jsonb_build_object('ok', false, 'error', 'lab_not_assigned');
  end if;
  if p_state is null or jsonb_typeof(p_state) <> 'object' then
    return jsonb_build_object('ok', false, 'error', 'invalid_request');
  end if;
  if octet_length(p_state::text) > 4000 then
    return jsonb_build_object('ok', false, 'error', 'too_large');
  end if;

  select l.current_version into v_version from lernlabor.labs l where l.id = p_lab_id;

  insert into lernlabor.lab_progress as lp (participant_id, group_id, lab_id, lab_version, total_tasks, resume_state)
  values (v_s.participant_id, v_s.group_id, p_lab_id, v_version,
          (select count(*) from lernlabor.lab_tasks t where t.lab_id = p_lab_id and t.version = v_version and t.counts_for_progress),
          p_state)
  on conflict (participant_id, lab_id) do update set resume_state = excluded.resume_state;

  return jsonb_build_object('ok', true);
end;
$$;

-- ---------------------------------------------------------------------
-- Abmelden (Sitzung serverseitig beenden)
-- ---------------------------------------------------------------------
create or replace function public.student_logout(p_session text)
returns jsonb
language sql volatile security definer set search_path = ''
as $$
  update lernlabor.student_sessions s set revoked_at = now()
  where s.token_hash = lernlabor_private.token_hash(p_session) and s.revoked_at is null;
  select jsonb_build_object('ok', true);
$$;

-- ---------------------------------------------------------------------
-- Rechte: nur diese Funktionen sind für anon (und Lehrkräfte) aufrufbar
-- ---------------------------------------------------------------------
revoke all on function public.student_login(text) from public, anon, authenticated;
revoke all on function public.student_session_info(text) from public, anon, authenticated;
revoke all on function public.student_load_lab(text, text) from public, anon, authenticated;
revoke all on function public.student_save_task(text, text, text, text, uuid, int, jsonb, jsonb, boolean, timestamptz) from public, anon, authenticated;
revoke all on function public.student_save_resume(text, text, jsonb) from public, anon, authenticated;
revoke all on function public.student_logout(text) from public, anon, authenticated;

grant execute on function public.student_login(text) to anon, authenticated;
grant execute on function public.student_session_info(text) to anon, authenticated;
grant execute on function public.student_load_lab(text, text) to anon, authenticated;
grant execute on function public.student_save_task(text, text, text, text, uuid, int, jsonb, jsonb, boolean, timestamptz) to anon, authenticated;
grant execute on function public.student_save_resume(text, text, jsonb) to anon, authenticated;
grant execute on function public.student_logout(text) to anon, authenticated;

insert into lernlabor_private.angewendete_migrationen (version) values ('20261113000300_schueler_api') on conflict do nothing;


-- >>>>>>>>>>>>>>>>>>>> 20261113000400_lehrkraft_api.sql >>>>>>>>>>>>>>>>>>>>
-- =====================================================================
-- Online-Lernlabore 2.0 – Migration 4: Schnittstelle für Lehrkräfte
--
-- Nur mit gültiger Supabase-Auth-Anmeldung (Rolle authenticated) UND
-- Eintrag in lernlabor.teachers nutzbar.
--  * Lesende Funktionen laufen mit den Rechten der Lehrkraft
--    (SECURITY INVOKER) → die RLS-Regeln filtern auf eigene Gruppen.
--  * Schreibende Funktionen (SECURITY DEFINER) prüfen die Berechtigung
--    ausdrücklich und protokollieren die Aktion.
-- Fehler werden als Exception gemeldet (HTTP 4xx über PostgREST).
-- =====================================================================

create or replace function lernlabor_private.group_json(p_group uuid)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'id', g.id, 'label', g.label, 'kind', g.kind,
    'valid_from', g.valid_from, 'valid_until', g.valid_until,
    'retention_until', g.retention_until, 'archived_at', g.archived_at, 'created_at', g.created_at)
  from lernlabor.groups g where g.id = p_group;
$$;
revoke all on function lernlabor_private.group_json(uuid) from public;

create or replace function lernlabor_private.require_participants(p_ids uuid[])
returns void
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform lernlabor_private.require_teacher();
  if p_ids is null or cardinality(p_ids) = 0 then
    raise exception using errcode = '22023', message = 'Keine Teilnehmenden ausgewählt.';
  end if;
  if exists (
    select 1 from unnest(p_ids) as i(id)
    left join lernlabor.participants p on p.id = i.id
    where p.id is null or not lernlabor.is_group_member(p.group_id)) then
    raise exception using errcode = '42501', message = 'Kein Zugriff auf mindestens eine der Teilnehmer-IDs.';
  end if;
end;
$$;
revoke all on function lernlabor_private.require_participants(uuid[]) from public;

-- ---------------------------------------------------------------------
-- Wer bin ich?
-- ---------------------------------------------------------------------
create or replace function public.teacher_me()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'user_id', u.uid,
    'is_teacher', t.user_id is not null,
    'is_admin', coalesce(t.is_admin, false),
    'display_name', coalesce(t.display_name, ''))
  from (select auth.uid() as uid) u
  left join lernlabor.teachers t on t.user_id = u.uid;
$$;

-- ---------------------------------------------------------------------
-- Lerngruppen
-- ---------------------------------------------------------------------
create or replace function public.teacher_create_group(
  p_label           text,
  p_kind            text default 'class',
  p_valid_from      timestamptz default null,
  p_valid_until     timestamptz default null,
  p_retention_until date default null,
  p_group_id        uuid default null)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := lernlabor_private.require_teacher();
  v_id  uuid := coalesce(p_group_id, gen_random_uuid());
begin
  if p_kind is null or p_kind not in ('class', 'event', 'demo') then
    raise exception using errcode = '22023', message = 'Ungültige Gruppenart (erlaubt: class, event, demo).';
  end if;
  if p_label is null or char_length(btrim(p_label)) not between 1 and 60 then
    raise exception using errcode = '22023', message = 'Die Bezeichnung muss 1 bis 60 Zeichen lang sein.';
  end if;

  -- Wiederholbar: existiert die Gruppe schon (gleiche ID), wird sie unverändert zurückgegeben.
  if exists (select 1 from lernlabor.groups g where g.id = v_id) then
    perform lernlabor_private.require_group(v_id);
    return lernlabor_private.group_json(v_id) || jsonb_build_object('created', false);
  end if;

  insert into lernlabor.groups (id, label, kind, valid_from, valid_until, retention_until, created_by)
  values (v_id, btrim(p_label), p_kind, p_valid_from, p_valid_until,
          coalesce(p_retention_until,
                   case when p_kind = 'class' then current_date + 365
                        else coalesce(p_valid_until::date, current_date) + 30 end),
          v_uid);
  insert into lernlabor.group_teachers (group_id, teacher_id, role) values (v_id, v_uid, 'owner');
  perform lernlabor_private.audit('group_created', v_id, jsonb_build_object('kind', p_kind));
  return lernlabor_private.group_json(v_id) || jsonb_build_object('created', true);
end;
$$;

create or replace function public.teacher_list_groups(p_include_archived boolean default false)
returns jsonb
language sql stable security invoker set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', g.id, 'label', g.label, 'kind', g.kind,
           'valid_from', g.valid_from, 'valid_until', g.valid_until,
           'retention_until', g.retention_until, 'archived_at', g.archived_at, 'created_at', g.created_at,
           'role', gt.role,
           'participants', (select count(*) from lernlabor.participants p where p.group_id = g.id),
           'labs', coalesce((select jsonb_agg(jsonb_build_object('lab_id', gl.lab_id, 'archived_at', gl.archived_at)
                                              order by gl.assigned_at, gl.lab_id)
                             from lernlabor.group_labs gl where gl.group_id = g.id), '[]'::jsonb))
         order by g.archived_at nulls first, g.kind, g.created_at desc), '[]'::jsonb)
  from lernlabor.groups g
  join lernlabor.group_teachers gt on gt.group_id = g.id and gt.teacher_id = auth.uid()
  where p_include_archived or g.archived_at is null;
$$;

-- Änderungen als JSON: {"label": "...", "valid_from": ..., "valid_until": ..., "retention_until": "2027-07-31", "archived": true}
create or replace function public.teacher_update_group(p_group_id uuid, p_changes jsonb)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := lernlabor_private.require_group(p_group_id);
  v_end boolean := false;
begin
  if p_changes is null or jsonb_typeof(p_changes) <> 'object' then
    raise exception using errcode = '22023', message = 'Änderungen fehlen.';
  end if;
  if p_changes ? 'label' and char_length(btrim(coalesce(p_changes ->> 'label', ''))) not between 1 and 60 then
    raise exception using errcode = '22023', message = 'Die Bezeichnung muss 1 bis 60 Zeichen lang sein.';
  end if;

  update lernlabor.groups g set
    label           = case when p_changes ? 'label' then btrim(p_changes ->> 'label') else g.label end,
    valid_from      = case when p_changes ? 'valid_from' then (p_changes ->> 'valid_from')::timestamptz else g.valid_from end,
    valid_until     = case when p_changes ? 'valid_until' then (p_changes ->> 'valid_until')::timestamptz else g.valid_until end,
    retention_until = case when p_changes ? 'retention_until' and p_changes ->> 'retention_until' is not null
                           then (p_changes ->> 'retention_until')::date else g.retention_until end,
    archived_at     = case when p_changes ? 'archived'
                           then case when coalesce((p_changes ->> 'archived')::boolean, false) then coalesce(g.archived_at, now()) else null end
                           else g.archived_at end
  where g.id = p_group_id;

  v_end := coalesce((p_changes ->> 'archived')::boolean, false)
           or (p_changes ? 'valid_until' and (p_changes ->> 'valid_until')::timestamptz <= now());
  if v_end then
    update lernlabor.student_sessions s set revoked_at = now()
    from lernlabor.participants p
    where p.id = s.participant_id and p.group_id = p_group_id and s.revoked_at is null;
  end if;

  perform lernlabor_private.audit('group_updated', p_group_id,
    jsonb_build_object('fields', (select jsonb_agg(k) from jsonb_object_keys(p_changes) k)));
  return lernlabor_private.group_json(p_group_id);
end;
$$;

-- Zugang sofort beenden (z. B. Ende des Tags der offenen Tür)
create or replace function public.teacher_end_access(p_group_id uuid)
returns jsonb
language sql volatile security definer set search_path = ''
as $$
  select public.teacher_update_group(p_group_id, jsonb_build_object('valid_until', now()));
$$;

create or replace function public.teacher_delete_group(p_group_id uuid)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := lernlabor_private.require_group(p_group_id, true);
  v_n int;
begin
  select count(*) into v_n from lernlabor.participants p where p.group_id = p_group_id;
  delete from lernlabor.groups g where g.id = p_group_id;
  perform lernlabor_private.audit('group_deleted', p_group_id, jsonb_build_object('participants_deleted', v_n));
  return jsonb_build_object('ok', true, 'participants_deleted', v_n);
end;
$$;

create or replace function public.teacher_share_group(p_group_id uuid, p_email text)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := lernlabor_private.require_group(p_group_id, true);
  v_other uuid;
begin
  select t.user_id into v_other
  from auth.users u join lernlabor.teachers t on t.user_id = u.id
  where lower(u.email) = lower(btrim(p_email));
  if v_other is null then
    raise exception using errcode = '22023', message = 'Unter dieser E-Mail-Adresse ist keine freigeschaltete Lehrkraft bekannt.';
  end if;
  insert into lernlabor.group_teachers (group_id, teacher_id, role) values (p_group_id, v_other, 'member')
  on conflict do nothing;
  perform lernlabor_private.audit('group_shared', p_group_id, jsonb_build_object('teacher', v_other));
  return jsonb_build_object('ok', true);
end;
$$;

-- ---------------------------------------------------------------------
-- Teilnehmende und Zugangscodes
-- p_participants: [{"id": "<uuid>", "pseudonym": "P-8F2A", "code": "ABCD-EFGH-JKMN", "valid_until": null}]
-- Der Rohcode wird nur zur Berechnung des HMAC verwendet und nicht gespeichert.
-- Wiederholbar: Ein erneuter Aufruf mit denselben Daten ändert nichts.
-- ---------------------------------------------------------------------
create or replace function public.teacher_register_participants(
  p_group_id         uuid,
  p_participants     jsonb,
  p_code_valid_until timestamptz default null)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid      uuid := lernlabor_private.require_group(p_group_id);
  v_kind     text;
  v_min_len  int;
  v_item     jsonb;
  v_id       uuid;
  v_pseudo   text;
  v_norm     text;
  v_hmac     bytea;
  v_until    timestamptz;
  v_owner    uuid;
  v_code     record;
  v_new      boolean;
  v_created  int := 0;
  v_reissued int := 0;
  v_same     int := 0;
begin
  if p_participants is null or jsonb_typeof(p_participants) <> 'array' then
    raise exception using errcode = '22023', message = 'Teilnehmerliste fehlt.';
  end if;
  if jsonb_array_length(p_participants) > 500 then
    raise exception using errcode = '22023', message = 'Höchstens 500 Teilnehmende pro Aufruf.';
  end if;

  select g.kind into v_kind from lernlabor.groups g where g.id = p_group_id;
  v_min_len := case when v_kind = 'class' then 12 else 8 end;

  for v_item in select value from jsonb_array_elements(p_participants) loop
    begin
      v_id := (v_item ->> 'id')::uuid;
    exception when others then
      raise exception using errcode = '22023', message = 'Ungültige Teilnehmer-ID.';
    end;
    if v_id is null then
      raise exception using errcode = '22023', message = 'Teilnehmer-ID fehlt.';
    end if;
    v_pseudo := v_item ->> 'pseudonym';
    if v_pseudo is null or v_pseudo !~ '^[PGD]-[A-HJKMNP-Z2-9]{4,6}$' then
      raise exception using errcode = '22023', message = 'Ungültiges Pseudonym.';
    end if;
    v_norm := lernlabor.normalize_code(v_item ->> 'code');
    if v_norm !~ ('^[A-HJKMNP-Z2-9]{' || v_min_len || ',16}$') then
      raise exception using errcode = '22023',
        message = format('Ungültiger Zugangscode (mindestens %s Zeichen aus dem erlaubten Zeichenvorrat).', v_min_len);
    end if;
    v_until := coalesce((v_item ->> 'valid_until')::timestamptz, p_code_valid_until);

    select p.group_id into v_owner from lernlabor.participants p where p.id = v_id;
    v_new := not found;
    if v_new then
      begin
        insert into lernlabor.participants (id, group_id, pseudonym) values (v_id, p_group_id, v_pseudo);
      exception when unique_violation then
        raise exception using errcode = '23505', message = format('Das Pseudonym %s ist in dieser Gruppe bereits vergeben.', v_pseudo);
      end;
      v_created := v_created + 1;
    elsif v_owner <> p_group_id then
      raise exception using errcode = '42501', message = 'Diese Teilnehmer-ID gehört zu einer anderen Lerngruppe.';
    end if;

    v_hmac := lernlabor_private.code_hmac(v_norm);
    select c.id, c.participant_id, c.revoked_at into v_code from lernlabor.access_codes c where c.code_hmac = v_hmac;
    if found then
      if v_code.participant_id <> v_id then
        raise exception using errcode = '23505', message = 'Code-Kollision. Bitte für diese Person einen neuen Code erzeugen.';
      end if;
      if v_code.revoked_at is not null then
        raise exception using errcode = '22023', message = 'Ein gesperrter Code kann nicht wiederverwendet werden. Bitte neuen Code erzeugen.';
      end if;
      update lernlabor.access_codes c set valid_until = v_until where c.id = v_code.id;
      v_same := v_same + 1;
    else
      -- Neuer Code: alte Codes und deren Sitzungen sperren
      with old as (
        update lernlabor.access_codes c set revoked_at = now()
        where c.participant_id = v_id and c.revoked_at is null
        returning c.id)
      update lernlabor.student_sessions s set revoked_at = now()
      where s.access_code_id in (select id from old) and s.revoked_at is null;
      insert into lernlabor.access_codes (participant_id, code_hmac, valid_until) values (v_id, v_hmac, v_until);
      if not v_new then
        v_reissued := v_reissued + 1;
      end if;
    end if;
  end loop;

  perform lernlabor_private.audit('participants_registered', p_group_id,
    jsonb_build_object('created', v_created, 'reissued', v_reissued, 'unchanged', v_same));
  return jsonb_build_object('ok', true, 'created', v_created, 'reissued', v_reissued, 'unchanged', v_same);
end;
$$;

-- Sperren / Entsperren (Sperren beendet sofort alle Sitzungen)
create or replace function public.teacher_set_participant_status(p_participant_ids uuid[], p_status text)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_n int;
  v_g uuid;
begin
  perform lernlabor_private.require_participants(p_participant_ids);
  if p_status not in ('active', 'blocked') then
    raise exception using errcode = '22023', message = 'Status muss active oder blocked sein.';
  end if;
  update lernlabor.participants p set status = p_status where p.id = any (p_participant_ids);
  get diagnostics v_n = row_count;
  if p_status = 'blocked' then
    update lernlabor.student_sessions s set revoked_at = now()
    where s.participant_id = any (p_participant_ids) and s.revoked_at is null;
  end if;
  for v_g in select distinct p.group_id from lernlabor.participants p where p.id = any (p_participant_ids) loop
    perform lernlabor_private.audit('participants_' || p_status, v_g, jsonb_build_object('count', v_n));
  end loop;
  return jsonb_build_object('ok', true, 'updated', v_n);
end;
$$;

-- Codes sperren (z. B. Karte verloren). Danach mit teacher_register_participants neuen Code ausstellen.
create or replace function public.teacher_revoke_codes(p_participant_ids uuid[])
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_n int;
  v_g uuid;
begin
  perform lernlabor_private.require_participants(p_participant_ids);
  update lernlabor.access_codes c set revoked_at = now()
  where c.participant_id = any (p_participant_ids) and c.revoked_at is null;
  get diagnostics v_n = row_count;
  update lernlabor.student_sessions s set revoked_at = now()
  where s.participant_id = any (p_participant_ids) and s.revoked_at is null;
  for v_g in select distinct p.group_id from lernlabor.participants p where p.id = any (p_participant_ids) loop
    perform lernlabor_private.audit('codes_revoked', v_g, jsonb_build_object('count', v_n));
  end loop;
  return jsonb_build_object('ok', true, 'revoked', v_n);
end;
$$;

create or replace function public.teacher_remove_participants(p_participant_ids uuid[])
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_n int;
  v_groups uuid[];
  v_g uuid;
begin
  perform lernlabor_private.require_participants(p_participant_ids);
  select array_agg(distinct p.group_id) into v_groups from lernlabor.participants p where p.id = any (p_participant_ids);
  delete from lernlabor.participants p where p.id = any (p_participant_ids);
  get diagnostics v_n = row_count;
  foreach v_g in array v_groups loop
    perform lernlabor_private.audit('participants_removed', v_g, jsonb_build_object('count', v_n));
  end loop;
  return jsonb_build_object('ok', true, 'removed', v_n);
end;
$$;

-- Lernstand einzelner Personen zurücksetzen (optional nur ein Labor)
create or replace function public.teacher_reset_results(p_participant_ids uuid[], p_lab_id text default null)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_n int;
  v_g uuid;
begin
  perform lernlabor_private.require_participants(p_participant_ids);
  delete from lernlabor.task_results r
  where r.participant_id = any (p_participant_ids) and (p_lab_id is null or r.lab_id = p_lab_id);
  get diagnostics v_n = row_count;
  delete from lernlabor.lab_progress lp
  where lp.participant_id = any (p_participant_ids) and (p_lab_id is null or lp.lab_id = p_lab_id);
  for v_g in select distinct p.group_id from lernlabor.participants p where p.id = any (p_participant_ids) loop
    perform lernlabor_private.audit('results_reset', v_g, jsonb_build_object('lab_id', p_lab_id, 'results_deleted', v_n));
  end loop;
  return jsonb_build_object('ok', true, 'results_deleted', v_n);
end;
$$;

-- Alle Ergebnisse einer Gruppe (optional eines Labors) löschen
create or replace function public.teacher_delete_results(p_group_id uuid, p_lab_id text default null)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := lernlabor_private.require_group(p_group_id);
  v_n int;
begin
  delete from lernlabor.task_results r where r.group_id = p_group_id and (p_lab_id is null or r.lab_id = p_lab_id);
  get diagnostics v_n = row_count;
  delete from lernlabor.lab_progress lp where lp.group_id = p_group_id and (p_lab_id is null or lp.lab_id = p_lab_id);
  perform lernlabor_private.audit('results_deleted', p_group_id, jsonb_build_object('lab_id', p_lab_id, 'results_deleted', v_n));
  return jsonb_build_object('ok', true, 'results_deleted', v_n);
end;
$$;

-- ---------------------------------------------------------------------
-- Lernlabore und Zuweisungen
-- ---------------------------------------------------------------------
create or replace function public.teacher_list_labs()
returns jsonb
language sql stable security invoker set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', l.id, 'title', l.title, 'subject', l.subject, 'audience', l.audience,
           'version', l.current_version,
           'tasks', coalesce((
             select jsonb_agg(jsonb_build_object(
                      'task_id', t.task_id, 'position', t.position, 'section', t.section, 'title', t.title,
                      'kind', t.kind, 'graded', t.graded, 'counts_for_progress', t.counts_for_progress,
                      'options', t.options, 'solution', t.solution) order by t.position)
             from lernlabor.lab_tasks t where t.lab_id = l.id and t.version = l.current_version), '[]'::jsonb))
         order by l.subject, l.title), '[]'::jsonb)
  from lernlabor.labs l;
$$;

-- p_state: 'active' (zuweisen/reaktivieren), 'archived' (Durchgang archivieren), 'removed' (Zuweisung entfernen)
create or replace function public.teacher_set_lab_assignment(p_group_id uuid, p_lab_id text, p_state text default 'active')
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := lernlabor_private.require_group(p_group_id);
begin
  if not exists (select 1 from lernlabor.labs l where l.id = p_lab_id) then
    raise exception using errcode = '22023', message = 'Unbekanntes Lernlabor.';
  end if;
  if p_state = 'active' then
    insert into lernlabor.group_labs (group_id, lab_id) values (p_group_id, p_lab_id)
    on conflict (group_id, lab_id) do update set archived_at = null;
  elsif p_state = 'archived' then
    update lernlabor.group_labs gl set archived_at = coalesce(gl.archived_at, now())
    where gl.group_id = p_group_id and gl.lab_id = p_lab_id;
  elsif p_state = 'removed' then
    delete from lernlabor.group_labs gl where gl.group_id = p_group_id and gl.lab_id = p_lab_id;
  else
    raise exception using errcode = '22023', message = 'Zustand muss active, archived oder removed sein.';
  end if;
  perform lernlabor_private.audit('lab_assignment_' || p_state, p_group_id, jsonb_build_object('lab_id', p_lab_id));
  return jsonb_build_object('ok', true);
end;
$$;

-- ---------------------------------------------------------------------
-- Auswertung (pseudonym) – läuft unter RLS
-- ---------------------------------------------------------------------
create or replace function public.teacher_group_overview(p_group_id uuid, p_lab_id text default null)
returns jsonb
language plpgsql stable security invoker set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if not exists (select 1 from lernlabor.groups g where g.id = p_group_id) then
    raise exception using errcode = '42501', message = 'Kein Zugriff auf diese Lerngruppe.';
  end if;

  select jsonb_build_object(
    'generated_at', now(),
    'group', (select jsonb_build_object('id', g.id, 'label', g.label, 'kind', g.kind, 'valid_from', g.valid_from,
                                        'valid_until', g.valid_until, 'retention_until', g.retention_until,
                                        'archived_at', g.archived_at)
              from lernlabor.groups g where g.id = p_group_id),
    'labs', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', l.id, 'title', l.title, 'version', l.current_version, 'archived_at', gl.archived_at,
               'tasks', coalesce((select jsonb_agg(jsonb_build_object('task_id', t.task_id, 'title', t.title,
                                                                      'section', t.section, 'position', t.position,
                                                                      'counts_for_progress', t.counts_for_progress)
                                                   order by t.position)
                                  from lernlabor.lab_tasks t where t.lab_id = l.id and t.version = l.current_version), '[]'::jsonb))
             order by gl.assigned_at, l.id)
      from lernlabor.group_labs gl join lernlabor.labs l on l.id = gl.lab_id
      where gl.group_id = p_group_id and (p_lab_id is null or gl.lab_id = p_lab_id)), '[]'::jsonb),
    'participants', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', p.id, 'pseudonym', p.pseudonym, 'status', p.status,
               'code_active', exists (select 1 from lernlabor.access_codes c
                                      where c.participant_id = p.id and c.revoked_at is null
                                        and (c.valid_until is null or c.valid_until > now())),
               'progress', coalesce((
                 select jsonb_agg(jsonb_build_object('lab_id', lp.lab_id, 'lab_version', lp.lab_version,
                                                     'percent', lp.percent, 'completed', lp.completed_tasks,
                                                     'total', lp.total_tasks, 'started_at', lp.started_at,
                                                     'last_saved_at', lp.last_saved_at, 'finished_at', lp.finished_at)
                                  order by lp.lab_id)
                 from lernlabor.lab_progress lp
                 where lp.participant_id = p.id and (p_lab_id is null or lp.lab_id = p_lab_id)), '[]'::jsonb),
               'tasks', coalesce((
                 select jsonb_agg(jsonb_build_object('lab_id', r.lab_id, 'task_id', r.task_id, 'status', r.status,
                                                     'is_correct', r.is_correct, 'updated_at', r.updated_at)
                                  order by r.lab_id, r.task_id)
                 from lernlabor.task_results r
                 where r.participant_id = p.id and (p_lab_id is null or r.lab_id = p_lab_id)), '[]'::jsonb))
             order by p.pseudonym)
      from lernlabor.participants p where p.group_id = p_group_id), '[]'::jsonb))
  into v_result;
  return v_result;
end;
$$;

create or replace function public.teacher_task_stats(p_group_id uuid, p_lab_id text)
returns jsonb
language plpgsql stable security invoker set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if not exists (select 1 from lernlabor.groups g where g.id = p_group_id) then
    raise exception using errcode = '42501', message = 'Kein Zugriff auf diese Lerngruppe.';
  end if;

  select jsonb_build_object(
    'generated_at', now(),
    'participants', (select count(*) from lernlabor.participants p where p.group_id = p_group_id),
    'started', (select count(*) from lernlabor.lab_progress lp where lp.group_id = p_group_id and lp.lab_id = p_lab_id),
    'finished', (select count(*) from lernlabor.lab_progress lp where lp.group_id = p_group_id and lp.lab_id = p_lab_id and lp.finished_at is not null),
    'tasks', coalesce((
      select jsonb_agg(jsonb_build_object(
               'task_id', t.task_id, 'title', t.title, 'section', t.section, 'position', t.position,
               'kind', t.kind, 'graded', t.graded, 'options', t.options, 'solution', t.solution,
               'completed', (select count(*) from lernlabor.task_results r where r.group_id = p_group_id and r.lab_id = p_lab_id and r.task_id = t.task_id and r.status = 'completed'),
               'in_progress', (select count(*) from lernlabor.task_results r where r.group_id = p_group_id and r.lab_id = p_lab_id and r.task_id = t.task_id and r.status = 'in_progress'),
               'correct', (select count(*) from lernlabor.task_results r where r.group_id = p_group_id and r.lab_id = p_lab_id and r.task_id = t.task_id and r.is_correct),
               'incorrect', (select count(*) from lernlabor.task_results r where r.group_id = p_group_id and r.lab_id = p_lab_id and r.task_id = t.task_id and r.is_correct = false),
               'first_correct', (select count(*) from lernlabor.task_results r where r.group_id = p_group_id and r.lab_id = p_lab_id and r.task_id = t.task_id and r.first_is_correct),
               'first_incorrect', (select count(*) from lernlabor.task_results r where r.group_id = p_group_id and r.lab_id = p_lab_id and r.task_id = t.task_id and r.first_is_correct = false),
               'answers', coalesce((
                 select jsonb_object_agg(x.choice, x.n) from (
                   select r.answer ->> 'choice' as choice, count(*) as n
                   from lernlabor.task_results r
                   where r.group_id = p_group_id and r.lab_id = p_lab_id and r.task_id = t.task_id and r.answer ? 'choice'
                   group by 1) x), '{}'::jsonb))
             order by t.position)
      from lernlabor.lab_tasks t
      join lernlabor.labs l on l.id = t.lab_id and l.current_version = t.version
      where t.lab_id = p_lab_id), '[]'::jsonb))
  into v_result;
  return v_result;
end;
$$;

create or replace function public.teacher_participant_results(p_group_id uuid, p_lab_id text, p_participant_id uuid default null)
returns jsonb
language plpgsql stable security invoker set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if not exists (select 1 from lernlabor.groups g where g.id = p_group_id) then
    raise exception using errcode = '42501', message = 'Kein Zugriff auf diese Lerngruppe.';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'participant_id', p.id, 'pseudonym', p.pseudonym, 'status', p.status,
           'progress', (select jsonb_build_object('percent', lp.percent, 'completed', lp.completed_tasks,
                                                  'total', lp.total_tasks, 'last_saved_at', lp.last_saved_at,
                                                  'finished_at', lp.finished_at)
                        from lernlabor.lab_progress lp where lp.participant_id = p.id and lp.lab_id = p_lab_id),
           'results', coalesce((
             select jsonb_agg(jsonb_build_object(
                      'task_id', r.task_id, 'lab_version', r.lab_version, 'answer', r.answer, 'data', r.data,
                      'status', r.status, 'is_correct', r.is_correct, 'first_is_correct', r.first_is_correct,
                      'revision', r.revision, 'first_completed_at', r.first_completed_at, 'updated_at', r.updated_at)
                    order by r.task_id)
             from lernlabor.task_results r where r.participant_id = p.id and r.lab_id = p_lab_id), '[]'::jsonb))
         order by p.pseudonym), '[]'::jsonb)
  into v_result
  from lernlabor.participants p
  where p.group_id = p_group_id and (p_participant_id is null or p.id = p_participant_id);
  return v_result;
end;
$$;

-- Vollständiger pseudonymer Export einer Gruppe für das lokale Lehrerprogramm
create or replace function public.teacher_export_group(p_group_id uuid)
returns jsonb
language plpgsql stable security invoker set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if not exists (select 1 from lernlabor.groups g where g.id = p_group_id) then
    raise exception using errcode = '42501', message = 'Kein Zugriff auf diese Lerngruppe.';
  end if;

  with lab_ids as (
    select gl.lab_id from lernlabor.group_labs gl where gl.group_id = p_group_id
    union
    select distinct r.lab_id from lernlabor.task_results r where r.group_id = p_group_id)
  select jsonb_build_object(
    'format', 'lernlabore2-export',
    'format_version', 1,
    'exported_at', now(),
    'group', (select jsonb_build_object('id', g.id, 'label', g.label, 'kind', g.kind, 'valid_from', g.valid_from,
                                        'valid_until', g.valid_until, 'retention_until', g.retention_until,
                                        'archived_at', g.archived_at)
              from lernlabor.groups g where g.id = p_group_id),
    'labs', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', l.id, 'title', l.title, 'subject', l.subject, 'audience', l.audience,
               'current_version', l.current_version,
               'assignment', (select jsonb_build_object('assigned_at', gl.assigned_at, 'archived_at', gl.archived_at)
                              from lernlabor.group_labs gl where gl.group_id = p_group_id and gl.lab_id = l.id),
               'tasks', coalesce((
                 select jsonb_agg(jsonb_build_object(
                          'version', t.version, 'task_id', t.task_id, 'position', t.position, 'section', t.section,
                          'title', t.title, 'kind', t.kind, 'graded', t.graded,
                          'counts_for_progress', t.counts_for_progress, 'options', t.options, 'solution', t.solution)
                        order by t.version, t.position)
                 from lernlabor.lab_tasks t where t.lab_id = l.id), '[]'::jsonb))
             order by l.id)
      from lernlabor.labs l where l.id in (select lab_id from lab_ids)), '[]'::jsonb),
    'participants', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'pseudonym', p.pseudonym, 'status', p.status,
                                          'created_at', p.created_at) order by p.pseudonym)
      from lernlabor.participants p where p.group_id = p_group_id), '[]'::jsonb),
    'progress', coalesce((
      select jsonb_agg(jsonb_build_object(
               'participant_id', lp.participant_id, 'lab_id', lp.lab_id, 'lab_version', lp.lab_version,
               'completed', lp.completed_tasks, 'total', lp.total_tasks, 'percent', lp.percent,
               'started_at', lp.started_at, 'last_saved_at', lp.last_saved_at, 'finished_at', lp.finished_at)
             order by lp.participant_id, lp.lab_id)
      from lernlabor.lab_progress lp where lp.group_id = p_group_id), '[]'::jsonb),
    'results', coalesce((
      select jsonb_agg(jsonb_build_object(
               'participant_id', r.participant_id, 'lab_id', r.lab_id, 'task_id', r.task_id,
               'lab_version', r.lab_version, 'answer', r.answer, 'data', r.data, 'status', r.status,
               'is_correct', r.is_correct, 'first_is_correct', r.first_is_correct, 'revision', r.revision,
               'first_completed_at', r.first_completed_at, 'updated_at', r.updated_at)
             order by r.participant_id, r.lab_id, r.task_id)
      from lernlabor.task_results r where r.group_id = p_group_id), '[]'::jsonb))
  into v_result;
  return v_result;
end;
$$;

create or replace function public.teacher_audit_log(p_group_id uuid)
returns jsonb
language sql stable security invoker set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('at', a.at, 'action', a.action, 'details', a.details) order by a.at desc), '[]'::jsonb)
  from (select * from lernlabor.audit_log a where a.group_id = p_group_id order by a.at desc limit 200) a;
$$;

-- ---------------------------------------------------------------------
-- Demonstrationsdaten (nur für Gruppen der Art „demo“)
-- Erzeugt fiktive Lernstände; die ersten p_leave_empty Teilnehmenden
-- (alphabetisch) bleiben leer für die Live-Vorführung.
-- ---------------------------------------------------------------------
create or replace function public.teacher_seed_demo_results(p_group_id uuid, p_lab_id text, p_leave_empty int default 2)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid     uuid := lernlabor_private.require_group(p_group_id);
  v_kind    text;
  v_version text;
  v_total   int;
  v_p       record;
  v_t       record;
  v_k       int;
  v_choice  text;
  v_n       int := 0;
begin
  select g.kind into v_kind from lernlabor.groups g where g.id = p_group_id;
  if v_kind <> 'demo' then
    raise exception using errcode = '42501', message = 'Demodaten sind nur in Demo-Gruppen erlaubt.';
  end if;
  if not lernlabor_private.lab_open_for_group(p_group_id, p_lab_id) then
    insert into lernlabor.group_labs (group_id, lab_id) values (p_group_id, p_lab_id)
    on conflict (group_id, lab_id) do update set archived_at = null;
  end if;
  select l.current_version into v_version from lernlabor.labs l where l.id = p_lab_id;
  select count(*) into v_total from lernlabor.lab_tasks t where t.lab_id = p_lab_id and t.version = v_version;

  for v_p in
    select p.id from lernlabor.participants p
    where p.group_id = p_group_id
      and not exists (select 1 from lernlabor.task_results r where r.participant_id = p.id and r.lab_id = p_lab_id)
    order by p.pseudonym offset greatest(p_leave_empty, 0)
  loop
    v_k := 1 + floor(random() * v_total)::int;
    for v_t in
      select * from lernlabor.lab_tasks t where t.lab_id = p_lab_id and t.version = v_version order by t.position limit v_k
    loop
      v_choice := null;
      if v_t.kind = 'choice' and jsonb_array_length(v_t.options) > 0 then
        if v_t.graded and v_t.solution ? 'correct' and random() < 0.7 then
          v_choice := v_t.solution -> 'correct' ->> 0;
        else
          v_choice := v_t.options -> floor(random() * jsonb_array_length(v_t.options))::int ->> 'value';
        end if;
      end if;
      insert into lernlabor.task_results
        (participant_id, group_id, lab_id, task_id, lab_version, answer, data, status, is_correct, first_is_correct,
         revision, first_completed_at, updated_at)
      values
        (v_p.id, p_group_id, p_lab_id, v_t.task_id, v_version,
         case when v_choice is not null then jsonb_build_object('choice', v_choice, 'demo', true) else jsonb_build_object('demo', true) end,
         jsonb_build_object('hinweis', 'fiktive Demonstrationsdaten'),
         'completed',
         case when v_t.graded and v_choice is not null then v_choice in (select jsonb_array_elements_text(v_t.solution -> 'correct')) end,
         case when v_t.graded and v_choice is not null then v_choice in (select jsonb_array_elements_text(v_t.solution -> 'correct')) end,
         1, now(), now());
    end loop;
    perform lernlabor_private.recompute_progress(v_p.id, p_group_id, p_lab_id, v_version);
    update lernlabor.lab_progress lp
      set last_saved_at = now() - (random() * interval '20 minutes'),
          started_at = now() - interval '25 minutes'
    where lp.participant_id = v_p.id and lp.lab_id = p_lab_id;
    v_n := v_n + 1;
  end loop;
  perform lernlabor_private.audit('demo_results_seeded', p_group_id, jsonb_build_object('lab_id', p_lab_id, 'participants', v_n));
  return jsonb_build_object('ok', true, 'participants_seeded', v_n);
end;
$$;

-- ---------------------------------------------------------------------
-- Verwaltung
-- ---------------------------------------------------------------------
create or replace function public.admin_add_teacher(p_email text, p_display_name text default '', p_is_admin boolean default false)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := lernlabor_private.require_teacher();
  v_new uuid;
begin
  if not exists (select 1 from lernlabor.teachers t where t.user_id = v_uid and t.is_admin) then
    raise exception using errcode = '42501', message = 'Nur Administratorinnen und Administratoren dürfen Lehrkräfte freischalten.';
  end if;
  select u.id into v_new from auth.users u where lower(u.email) = lower(btrim(p_email));
  if v_new is null then
    raise exception using errcode = '22023', message = 'Diese E-Mail-Adresse ist in Supabase Auth noch nicht angelegt (zuerst einladen).';
  end if;
  insert into lernlabor.teachers (user_id, display_name, is_admin) values (v_new, coalesce(p_display_name, ''), p_is_admin)
  on conflict (user_id) do update set display_name = excluded.display_name, is_admin = excluded.is_admin;
  perform lernlabor_private.audit('teacher_added', null, jsonb_build_object('teacher', v_new, 'is_admin', p_is_admin));
  return jsonb_build_object('ok', true, 'user_id', v_new);
end;
$$;

-- Nur im SQL-Editor (als postgres) aufrufbar: erste Lehrkraft freischalten
create or replace function lernlabor_private.bootstrap_teacher(p_email text, p_display_name text default '', p_is_admin boolean default true)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_id uuid;
begin
  select u.id into v_id from auth.users u where lower(u.email) = lower(btrim(p_email));
  if v_id is null then
    raise exception 'Keine Benutzerin/kein Benutzer mit dieser E-Mail in Supabase Auth gefunden. Bitte zuerst unter Authentication → Users anlegen.';
  end if;
  insert into lernlabor.teachers (user_id, display_name, is_admin) values (v_id, coalesce(p_display_name, ''), p_is_admin)
  on conflict (user_id) do update set is_admin = excluded.is_admin, display_name = excluded.display_name;
  return jsonb_build_object('ok', true, 'user_id', v_id);
end;
$$;
revoke all on function lernlabor_private.bootstrap_teacher(text, text, boolean) from public;

create or replace function public.teacher_purge_expired()
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
begin
  perform lernlabor_private.require_teacher();
  return lernlabor_private.purge_expired();
end;
$$;

-- ---------------------------------------------------------------------
-- Rechte: Lehrkraft-Funktionen nur für authenticated
-- ---------------------------------------------------------------------
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and (p.proname like 'teacher\_%' or p.proname like 'admin\_%')
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
    execute format('grant execute on function %s to authenticated', f.sig);
  end loop;
end $$;

insert into lernlabor_private.angewendete_migrationen (version) values ('20261113000400_lehrkraft_api') on conflict do nothing;


-- >>>>>>>>>>>>>>>>>>>> 20261113000500_labor_physik_entdecker.sql >>>>>>>>>>>>>>>>>>>>
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

insert into lernlabor_private.angewendete_migrationen (version) values ('20261113000500_labor_physik_entdecker') on conflict do nothing;

-- Fertig. Weiter mit INSTALLATION.md, Schritt 3 (erste Lehrkraft freischalten).
