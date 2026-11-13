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
