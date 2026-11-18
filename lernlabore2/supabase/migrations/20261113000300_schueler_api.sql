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
