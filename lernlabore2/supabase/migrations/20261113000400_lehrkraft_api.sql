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
