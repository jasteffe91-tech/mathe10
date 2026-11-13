# Schnittstellen

## 1. Lernlabor-SDK (Browser)

Einbinden – **klassisch** (bestehende Labore, kein Build nötig):
```html
<script src="../../config.js"></script>
<script src="../../sdk/lernlabor-sdk.js"></script>   <!-- globales Objekt „Lernlabor“ -->
```
oder als **ES-Modul**: `import { initializeLab } from '../../sdk/lernlabor-sdk.mjs';`

### `Lernlabor.initializeLab(optionen) → Promise<LabClient>`
Zeigt bei Bedarf das Anmeldefenster („Willkommen im Lernlabor! Gib deinen Zugangscode ein.“), lädt den Lernstand,
startet die automatische Speicherung und blendet Speicheranzeige sowie „Angemeldet als P-8F2A · Abmelden“ ein.

| Option | Bedeutung |
|---|---|
| `labId`, `labVersion` | Pflicht; müssen in der Datenbank registriert sein (Manifest) |
| `manifest` | Inhalt der `lab.manifest.json` (empfohlen: Aufgabenliste für Fortschritt auch offline) |
| `title` | Titel im Anmeldefenster |
| `ui.statusTarget` | Element für die Speicheranzeige (`null` = schwebend unten links, `false` = keine) |
| `ui.sessionTarget` | Element für die Sitzungsleiste (`null` = schwebend oben rechts, `false` = keine) |
| `ui.login` | `false` = eigenes Anmeldefenster; dann `loginWithAccessCode()` selbst aufrufen |
| `config` | überschreibt Werte aus `config.js` |

### `LabClient`
| Methode | Zweck |
|---|---|
| `loginWithAccessCode(code)` | Anmeldung (`{ok, participant}` oder `{ok:false, error, message}`) |
| `loadProgress()` | Lernstand vom Server laden (ohne Netz aus dem lokalen Zwischenspeicher) |
| `saveAnswer(taskId, answer, {data, completed})` | Zwischenstand speichern (Objekt, max. 16 KB; `data` max. 32 KB) |
| `completeTask(taskId, answer, data)` | Aufgabe abschließen |
| `getResult(taskId)` / `getResults()` | gespeicherter Stand (`pending: true` = noch nicht vom Server bestätigt) |
| `isCompleted(taskId)` | Aufgabe erledigt? |
| `getProgress()` / `serverProgress()` | Fortschritt inkl. bzw. ohne ausstehende Änderungen |
| `setResumeState(obj)` / `getResumeState()` | Fortsetzungspunkt (z. B. aktueller Schritt, < 4 KB) |
| `pendingCount()`, `flush(ms)` | ausstehende Übertragungen; warten bis alles übertragen ist |
| `getStatus()` | `{state, message, pending, lastConfirmedAt, mode}` |
| `logout()` | abmelden (ausstehende Daten bleiben für dieselbe Person auf dem Gerät) |
| `on(ereignis, fn)` | `status`, `results`, `progress`, `conflict`, `session-expired`, `save-error`, `participant-changed` |

Speicherstatus (`state` → angezeigter Text):
`saving` „Wird gespeichert …“ · `saved` „Gespeichert“ (nur nach Serverbestätigung) · `offline` „Offline – wird später
synchronisiert“ · `retrying` „Speicherung fehlgeschlagen – erneuter Versuch“ · `session` „Bitte melde dich neu an …“ ·
`error` „Eine Antwort konnte nicht gespeichert werden“. Im Demo-Modus: „Gespeichert (Demo – nur in diesem Browser)“.

Kurzformen wie im Konzept: `Lernlabor.loginWithAccessCode(lab, code)`, `loadProgress(lab)`, `saveAnswer(lab, …)`,
`completeTask(lab, …)`, `getProgress(lab)`, `logout(lab)`.

### Antwortformate (Empfehlung)
- Auswahl: `{ choice: '<value aus options>' }` – wird serverseitig bewertet, wenn im Manifest `graded` + `solution` stehen.
- Freitext: `{ text: '…' }` · Zahl: `{ value: 3.2, einheit: 'N' }` · Messreihen/Simulation: in `data` ablegen.

## 2. Lab-Manifest (`lab.manifest.json`)

```json
{ "id": "mein-labor", "version": "1.0", "title": "…", "subject": "Physik", "audience": "Klasse 7",
  "tasks": [
    { "task_id": "a1", "section": "Teil 1", "title": "Vermutung …", "kind": "choice", "graded": false,
      "options": [{ "value": "x", "label": "…" }] },
    { "task_id": "a2", "title": "Auswertung …", "kind": "choice", "graded": true,
      "options": [...], "solution": { "correct": ["x"] } },
    { "task_id": "a3", "title": "Messreihe", "kind": "measurement", "counts_for_progress": true } ] }
```
`kind`: `choice`, `multi`, `text`, `number`, `simulation`, `measurement`, `other`. Registrierung:
`node scripts/manifest-to-sql.mjs labs/mein-labor/lab.manifest.json` → SQL im Supabase-SQL-Editor ausführen.
Neue Inhalte ⇒ neue `version`; alte Ergebnisse behalten ihre Version.

## 3. Server-Funktionen (Supabase RPC)

Aufruf: `POST https://<projekt>.supabase.co/rest/v1/rpc/<funktion>`, Header `apikey: <öffentlicher Schlüssel>`,
JSON-Body mit benannten Parametern. Lehrkraft-Funktionen zusätzlich `Authorization: Bearer <Zugriffstoken>`.

### Lernende (öffentlicher Schlüssel) – Antwort `{ok:true,…}` oder `{ok:false,error}`
| Funktion | Parameter | Ergebnis |
|---|---|---|
| `student_login` | `p_code` | `session_token`, `expires_at`, `participant {pseudonym, key, group, labs[]}`; Fehler `invalid`, `blocked`, `expired`, `not_yet_valid`, `rate_limited` |
| `student_session_info` | `p_session` | wie oben ohne Token; `session_invalid` |
| `student_load_lab` | `p_session`, `p_lab_id` | `lab {version, tasks}`, `results[]`, `progress`, `resume_state`; `lab_not_assigned` |
| `student_save_task` | `p_session`, `p_lab_id`, `p_lab_version`, `p_task_id`, `p_op_id` (UUID), `p_base_revision`, `p_answer`, `p_data`, `p_completed`, `p_client_saved_at` | `status: saved/duplicate/conflict`, `result`, `progress`; Fehler `unknown_task`, `too_large`, `invalid_request` |
| `student_save_resume` | `p_session`, `p_lab_id`, `p_state` | `ok` |
| `student_logout` | `p_session` | `ok` |

### Lehrkräfte (angemeldet und freigeschaltet) – Fehler als HTTP 4xx
| Funktion | Zweck |
|---|---|
| `teacher_me` | eigene Rolle |
| `teacher_create_group(p_label, p_kind, p_valid_from, p_valid_until, p_retention_until, p_group_id)` | Gruppe anlegen (wiederholbar mit fester ID) |
| `teacher_list_groups(p_include_archived)` | eigene Gruppen (RLS) |
| `teacher_update_group(p_group_id, p_changes)` | Bezeichnung, Gültigkeit, Löschdatum, archivieren |
| `teacher_end_access(p_group_id)` | Zugang sofort beenden (Veranstaltung) |
| `teacher_delete_group(p_group_id)` | Gruppe mit allen Daten löschen (nur Besitzerin) |
| `teacher_share_group(p_group_id, p_email)` | Kollegin/Kollege hinzufügen |
| `teacher_register_participants(p_group_id, p_participants, p_code_valid_until)` | `[{id, pseudonym, code}]` registrieren / Codes neu ausstellen (idempotent) |
| `teacher_set_participant_status(p_participant_ids, p_status)` | sperren/entsperren |
| `teacher_revoke_codes(p_participant_ids)` | Codes ungültig machen |
| `teacher_remove_participants(p_participant_ids)` | Teilnehmende löschen |
| `teacher_reset_results(p_participant_ids, p_lab_id)` | Lernstand zurücksetzen |
| `teacher_delete_results(p_group_id, p_lab_id)` | Ergebnisse löschen |
| `teacher_list_labs()` | Labore inkl. Aufgaben, Optionen, Lösungen |
| `teacher_set_lab_assignment(p_group_id, p_lab_id, p_state)` | `active` / `archived` / `removed` |
| `teacher_group_overview(p_group_id, p_lab_id)` | Fortschritt je Kennung (RLS) |
| `teacher_task_stats(p_group_id, p_lab_id)` | Aufgabenstatistik inkl. Antwortverteilung |
| `teacher_participant_results(p_group_id, p_lab_id, p_participant_id)` | Antworten und Messwerte |
| `teacher_export_group(p_group_id)` | vollständiger pseudonymer Export (für das Lehrerprogramm) |
| `teacher_audit_log(p_group_id)` | Protokoll |
| `teacher_seed_demo_results(p_group_id, p_lab_id, p_leave_empty, p_skip_ids)` | fiktive Lernstände (nur Demo-Gruppen) |
| `teacher_purge_expired()` | Löschfristen anwenden |
| `admin_add_teacher(p_email, p_display_name, p_is_admin)` | Lehrkraft freischalten (nur Admin) |

Nur im SQL-Editor: `lernlabor_private.bootstrap_teacher(email, name, is_admin)`, `lernlabor_private.purge_expired()`.
