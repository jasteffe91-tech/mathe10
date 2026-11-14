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
