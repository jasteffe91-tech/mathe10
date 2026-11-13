// =====================================================================
// DEMO-BACKEND – simuliert den Server vollständig im Browser.
// Alle Daten bleiben in diesem Browser (localStorage) und sind FIKTIV.
// Dient der Vorführung ohne Internet/Cloud-Zugang. Verhalten und Antworten
// entsprechen den echten Datenbankfunktionen (siehe supabase/migrations).
// =====================================================================
import { DEMO_DATA } from './generated/demo-data';
import { normalizeCode, uuid } from './codes';
import { TransportError, type Transport } from './transport';
import type { JsonObject, LabManifest, LabTaskDef } from './types';

const STORE_KEY = 'lernlabor.demo.v1';
export const DEMO_OFFLINE_KEY = 'lernlabor.demo.offline';

interface DGroup { id: string; label: string; kind: 'class' | 'event' | 'demo'; valid_from: string | null; valid_until: string | null; retention_until: string; archived_at: string | null; created_at: string }
interface DParticipant { id: string; group_id: string; pseudonym: string; status: 'active' | 'blocked'; created_at: string }
interface DCode { participant_id: string; code: string; valid_until: string | null; revoked_at: string | null }
interface DSession { token: string; participant_id: string; code: string; expires_at: string; revoked: boolean }
interface DResult { participant_id: string; group_id: string; lab_id: string; task_id: string; lab_version: string; answer: JsonObject; data: JsonObject; status: 'in_progress' | 'completed'; is_correct: boolean | null; first_is_correct: boolean | null; revision: number; first_completed_at: string | null; updated_at: string }
interface DProgress { participant_id: string; group_id: string; lab_id: string; lab_version: string; completed: number; total: number; percent: number; resume_state: JsonObject; started_at: string; last_saved_at: string; finished_at: string | null }
interface DLab { id: string; title: string; subject: string; audience: string; version: string; tasks: LabTaskDef[] }
interface DState { v: 1; groups: DGroup[]; participants: DParticipant[]; codes: DCode[]; sessions: DSession[]; results: DResult[]; progress: DProgress[]; labs: DLab[]; group_labs: { group_id: string; lab_id: string; assigned_at: string; archived_at: string | null }[]; ops: string[]; log: { at: string; action: string; group_id: string | null; details: JsonObject }[] }

const now = () => new Date().toISOString();
const minutesAgo = (m: number) => new Date(Date.now() - m * 60000).toISOString();

function memoryStorage() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
}

function safeStorage(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  try {
    const s = globalThis.localStorage;
    s.setItem('__lt', '1'); s.removeItem('__lt');
    return s;
  } catch { return memoryStorage(); }
}

function labFromManifest(m: LabManifest): DLab {
  return { id: m.id, title: m.title, subject: m.subject ?? '', audience: m.audience ?? '', version: m.version,
    tasks: m.tasks.map((t, i) => ({ ...t, position: t.position ?? i + 1, counts_for_progress: t.counts_for_progress !== false })) };
}

function demoSimData(taskId: string): JsonObject {
  if (taskId.startsWith('m2')) return { laeufe: [{ rampe: 'flach', zeit_s: 1.81 }, { rampe: 'mittel', zeit_s: 1.16 }, { rampe: 'steil', zeit_s: 0.94 }], hinweis: 'fiktive Demonstrationsdaten' };
  if (taskId.startsWith('e2')) return { an: 2, aus: 2, hinweis: 'fiktive Demonstrationsdaten' };
  return { hinweis: 'fiktive Demonstrationsdaten' };
}

export class DemoBackend {
  private store = safeStorage();

  constructor(private readonly latencyMs = 120) {}

  load(): DState {
    try {
      const raw = this.store.getItem(STORE_KEY);
      if (raw) {
        const s = JSON.parse(raw) as DState;
        if (s.v === 1) return s;
      }
    } catch { /* neu anlegen */ }
    const s = this.initialState();
    this.save(s);
    return s;
  }

  private save(s: DState) {
    try { this.store.setItem(STORE_KEY, JSON.stringify(s)); } catch { /* Speicher voll */ }
  }

  reset() {
    this.store.removeItem(STORE_KEY);
    this.load();
  }

  setOffline(on: boolean) {
    if (on) this.store.setItem(DEMO_OFFLINE_KEY, '1'); else this.store.removeItem(DEMO_OFFLINE_KEY);
  }

  isOffline() {
    return this.store.getItem(DEMO_OFFLINE_KEY) === '1';
  }

  /** Registriert ein Labor im Demo-Backend (z. B. ein eigenes Labor in der Entwicklung). */
  ensureLab(m: LabManifest) {
    const s = this.load();
    if (!s.labs.some((l) => l.id === m.id && l.version === m.version)) {
      s.labs = s.labs.filter((l) => l.id !== m.id).concat(labFromManifest(m));
      for (const g of s.groups) if (!s.group_labs.some((x) => x.group_id === g.id && x.lab_id === m.id)) s.group_labs.push({ group_id: g.id, lab_id: m.id, assigned_at: now(), archived_at: null });
      this.save(s);
    }
  }

  private initialState(): DState {
    const g = DEMO_DATA.group;
    const s: DState = { v: 1, groups: [{ id: g.id, label: g.label, kind: 'demo', valid_from: null, valid_until: null, retention_until: '2099-12-31', archived_at: null, created_at: now() }],
      participants: [], codes: [], sessions: [], results: [], progress: [], labs: DEMO_DATA.labs.map(labFromManifest), group_labs: [], ops: [], log: [] };
    for (const p of DEMO_DATA.participants) {
      s.participants.push({ id: p.id, group_id: g.id, pseudonym: p.pseudonym, status: 'active', created_at: now() });
      s.codes.push({ participant_id: p.id, code: normalizeCode(p.code), valid_until: null, revoked_at: null });
    }
    for (const lab of s.labs) s.group_labs.push({ group_id: g.id, lab_id: lab.id, assigned_at: now(), archived_at: null });
    this.seedAnswers(s, g.id);
    return s;
  }

  private seedAnswers(s: DState, groupId: string) {
    for (const lab of s.labs) {
      const answers = DEMO_DATA.answers[lab.id] || [];
      const members = s.participants.filter((p) => p.group_id === groupId).sort((a, b) => a.pseudonym.localeCompare(b.pseudonym));
      // die ersten zwei (in Listenreihenfolge des Datensatzes) bleiben leer für die Live-Vorführung
      const order = DEMO_DATA.participants.map((p) => p.id).filter((id) => members.some((m) => m.id === id));
      order.slice(2).forEach((pid, i) => {
        const set = answers[i];
        if (!set) return;
        let minute = 24;
        for (const t of lab.tasks) {
          if (!(t.task_id in set)) continue;
          const choice = set[t.task_id];
          const correct = t.graded && t.solution && choice ? t.solution.correct.includes(choice) : null;
          s.results.push({ participant_id: pid, group_id: groupId, lab_id: lab.id, task_id: t.task_id, lab_version: lab.version,
            answer: choice ? { choice, demo: true } : { demo: true }, data: choice ? { hinweis: 'fiktive Demonstrationsdaten' } : demoSimData(t.task_id),
            status: 'completed', is_correct: correct, first_is_correct: correct, revision: 1, first_completed_at: minutesAgo(minute), updated_at: minutesAgo(minute) });
          minute -= 2 + (i % 3);
        }
        this.recompute(s, pid, groupId, lab.id, lab.version);
        const pr = s.progress.find((x) => x.participant_id === pid && x.lab_id === lab.id);
        if (pr) { pr.last_saved_at = minutesAgo(Math.max(1, minute)); pr.started_at = minutesAgo(26); }
      });
    }
  }

  // ------------------------------------------------------------------
  private lab(s: DState, id: string) { return s.labs.find((l) => l.id === id); }
  private labOpen(s: DState, groupId: string, labId: string) { return s.group_labs.some((x) => x.group_id === groupId && x.lab_id === labId && !x.archived_at); }

  private recompute(s: DState, pid: string, gid: string, labId: string, version: string) {
    const lab = this.lab(s, labId);
    const tasks = (lab?.tasks || []).filter((t) => t.counts_for_progress !== false);
    const done = s.results.filter((r) => r.participant_id === pid && r.lab_id === labId && r.status === 'completed' && tasks.some((t) => t.task_id === r.task_id)).length;
    const total = tasks.length;
    const percent = total === 0 ? 0 : done >= total ? 100 : Math.min(99, Math.round((100 * done) / total));
    let p = s.progress.find((x) => x.participant_id === pid && x.lab_id === labId);
    if (!p) { p = { participant_id: pid, group_id: gid, lab_id: labId, lab_version: version, completed: 0, total, percent: 0, resume_state: {}, started_at: now(), last_saved_at: now(), finished_at: null }; s.progress.push(p); }
    Object.assign(p, { lab_version: version, completed: done, total, percent, last_saved_at: now(), finished_at: total > 0 && done >= total ? p.finished_at || now() : null });
    return { completed: done, total, percent };
  }

  private progressJson(s: DState, pid: string, labId: string) {
    const p = s.progress.find((x) => x.participant_id === pid && x.lab_id === labId);
    if (p) return { completed: p.completed, total: p.total, percent: p.percent, lab_version: p.lab_version, last_saved_at: p.last_saved_at, finished_at: p.finished_at };
    const lab = this.lab(s, labId);
    return { completed: 0, total: (lab?.tasks || []).filter((t) => t.counts_for_progress !== false).length, percent: 0, lab_version: null, last_saved_at: null, finished_at: null };
  }

  private payload(s: DState, pid: string) {
    const p = s.participants.find((x) => x.id === pid)!;
    const g = s.groups.find((x) => x.id === p.group_id)!;
    return {
      pseudonym: p.pseudonym, key: `demo-${p.id.slice(-12)}`,
      group: { label: g.label, kind: g.kind, valid_until: g.valid_until },
      labs: s.group_labs.filter((x) => x.group_id === g.id && !x.archived_at).map((x) => {
        const l = this.lab(s, x.lab_id)!;
        const pr = s.progress.find((y) => y.participant_id === pid && y.lab_id === l.id);
        return { id: l.id, title: l.title, subject: l.subject, audience: l.audience, version: l.version, percent: pr?.percent ?? 0, finished: !!pr?.finished_at };
      }),
    };
  }

  private session(s: DState, token: unknown) {
    const ses = s.sessions.find((x) => x.token === token && !x.revoked && x.expires_at > now());
    if (!ses) return null;
    const p = s.participants.find((x) => x.id === ses.participant_id);
    const c = s.codes.find((x) => x.code === ses.code);
    const g = p && s.groups.find((x) => x.id === p.group_id);
    if (!p || !c || !g || p.status !== 'active' || c.revoked_at || g.archived_at || (g.valid_until && g.valid_until <= now())) return null;
    return { pid: p.id, gid: g.id, pseudonym: p.pseudonym, kind: g.kind };
  }

  private resultJson(r?: DResult) {
    return r ? { task_id: r.task_id, lab_version: r.lab_version, answer: r.answer, data: r.data, status: r.status, is_correct: r.is_correct, revision: r.revision, updated_at: r.updated_at } : null;
  }

  private member(s: DState, gid: string) {
    if (!s.groups.some((g) => g.id === gid)) throw new TransportError('auth', 'Kein Zugriff auf diese Lerngruppe.', 403, '42501');
  }

  // ------------------------------------------------------------------
  async call(fn: string, a: any): Promise<any> {
    if (this.latencyMs) await new Promise((r) => setTimeout(r, this.latencyMs));
    if (fn.startsWith('student_') && this.isOffline()) throw new TransportError('network', 'Keine Verbindung (Demo: Offline simuliert).');
    const s = this.load();
    const out = this.dispatch(s, fn, a ?? {});
    this.save(s);
    return JSON.parse(JSON.stringify(out));
  }

  private dispatch(s: DState, fn: string, a: any): any {
    switch (fn) {
      // ---------------- Lernende ----------------
      case 'student_login': {
        const n = normalizeCode(a.p_code);
        const c = s.codes.find((x) => x.code === n);
        if (!c) return { ok: false, error: 'invalid' };
        const p = s.participants.find((x) => x.id === c.participant_id)!;
        const g = s.groups.find((x) => x.id === p.group_id)!;
        if (c.revoked_at || p.status !== 'active') return { ok: false, error: 'blocked' };
        if (g.archived_at || (g.valid_until && g.valid_until <= now()) || (c.valid_until && c.valid_until <= now())) return { ok: false, error: 'expired' };
        const token = `demo-${uuid()}`;
        const expires = new Date(Date.now() + 12 * 3600e3).toISOString();
        s.sessions.push({ token, participant_id: p.id, code: n, expires_at: expires, revoked: false });
        return { ok: true, session_token: token, expires_at: expires, participant: this.payload(s, p.id) };
      }
      case 'student_session_info': {
        const ses = this.session(s, a.p_session);
        if (!ses) return { ok: false, error: 'session_invalid' };
        return { ok: true, expires_at: s.sessions.find((x) => x.token === a.p_session)!.expires_at, participant: this.payload(s, ses.pid) };
      }
      case 'student_load_lab': {
        const ses = this.session(s, a.p_session);
        if (!ses) return { ok: false, error: 'session_invalid' };
        if (!this.labOpen(s, ses.gid, a.p_lab_id)) return { ok: false, error: 'lab_not_assigned' };
        const lab = this.lab(s, a.p_lab_id)!;
        return {
          ok: true, participant: { pseudonym: ses.pseudonym, group_kind: ses.kind },
          lab: { id: lab.id, title: lab.title, version: lab.version, tasks: lab.tasks.map(({ solution, options, graded, ...t }) => t) },
          results: s.results.filter((r) => r.participant_id === ses.pid && r.lab_id === lab.id).map((r) => this.resultJson(r)),
          progress: this.progressJson(s, ses.pid, lab.id),
          resume_state: s.progress.find((x) => x.participant_id === ses.pid && x.lab_id === lab.id)?.resume_state ?? {},
        };
      }
      case 'student_save_task': {
        const ses = this.session(s, a.p_session);
        if (!ses) return { ok: false, error: 'session_invalid' };
        const opKey = `${ses.pid}|${a.p_op_id}`;
        const find = () => s.results.find((r) => r.participant_id === ses.pid && r.lab_id === a.p_lab_id && r.task_id === a.p_task_id);
        if (s.ops.includes(opKey)) return { ok: true, status: 'duplicate', result: this.resultJson(find()), progress: this.progressJson(s, ses.pid, a.p_lab_id) };
        if (!this.labOpen(s, ses.gid, a.p_lab_id)) return { ok: false, error: 'lab_not_assigned' };
        const lab = this.lab(s, a.p_lab_id);
        const task = lab && lab.version === a.p_lab_version ? lab.tasks.find((t) => t.task_id === a.p_task_id) : undefined;
        if (!task) return { ok: false, error: 'unknown_task' };
        const answer = a.p_answer ?? {}, data = a.p_data ?? {};
        if (JSON.stringify(answer).length > 16000 || JSON.stringify(data).length > 32000) return { ok: false, error: 'too_large' };
        const correct = task.graded && task.solution && typeof answer.choice === 'string' ? task.solution.correct.includes(answer.choice) : null;
        let r = find();
        const base = a.p_base_revision ?? 0;
        if (!r) {
          if (base !== 0) return { ok: true, status: 'conflict', result: null, progress: this.progressJson(s, ses.pid, a.p_lab_id) };
          r = { participant_id: ses.pid, group_id: ses.gid, lab_id: a.p_lab_id, task_id: a.p_task_id, lab_version: a.p_lab_version, answer, data,
            status: a.p_completed ? 'completed' : 'in_progress', is_correct: correct, first_is_correct: a.p_completed ? correct : null, revision: 1,
            first_completed_at: a.p_completed ? now() : null, updated_at: now() };
          s.results.push(r);
        } else {
          if (base !== r.revision) return { ok: true, status: 'conflict', result: this.resultJson(r), progress: this.progressJson(s, ses.pid, a.p_lab_id) };
          if (!r.first_completed_at && a.p_completed) { r.first_completed_at = now(); r.first_is_correct = correct; }
          Object.assign(r, { lab_version: a.p_lab_version, answer, data, status: a.p_completed || r.status === 'completed' ? 'completed' : 'in_progress', is_correct: correct, revision: r.revision + 1, updated_at: now() });
        }
        s.ops.push(opKey);
        const progress = this.recompute(s, ses.pid, ses.gid, a.p_lab_id, a.p_lab_version);
        return { ok: true, status: 'saved', result: this.resultJson(r), progress };
      }
      case 'student_save_resume': {
        const ses = this.session(s, a.p_session);
        if (!ses) return { ok: false, error: 'session_invalid' };
        if (!this.labOpen(s, ses.gid, a.p_lab_id)) return { ok: false, error: 'lab_not_assigned' };
        let p = s.progress.find((x) => x.participant_id === ses.pid && x.lab_id === a.p_lab_id);
        if (!p) { this.recompute(s, ses.pid, ses.gid, a.p_lab_id, this.lab(s, a.p_lab_id)!.version); p = s.progress.find((x) => x.participant_id === ses.pid && x.lab_id === a.p_lab_id)!; }
        p.resume_state = a.p_state ?? {};
        return { ok: true };
      }
      case 'student_logout': {
        s.sessions.forEach((x) => { if (x.token === a.p_session) x.revoked = true; });
        return { ok: true };
      }

      // ---------------- Lehrkraft (Demo: ohne Anmeldung) ----------------
      case 'teacher_me': return { user_id: 'demo', is_teacher: true, is_admin: true, display_name: 'Demo-Lehrkraft' };
      case 'teacher_list_groups':
        return s.groups.filter((g) => a.p_include_archived || !g.archived_at).map((g) => ({ ...g, role: 'owner',
          participants: s.participants.filter((p) => p.group_id === g.id).length,
          labs: s.group_labs.filter((x) => x.group_id === g.id).map((x) => ({ lab_id: x.lab_id, archived_at: x.archived_at })) }));
      case 'teacher_list_labs':
        return s.labs.map((l) => ({ id: l.id, title: l.title, subject: l.subject, audience: l.audience, version: l.version, tasks: l.tasks }));
      case 'teacher_create_group': {
        const id = a.p_group_id || uuid();
        if (!s.groups.some((g) => g.id === id)) {
          s.groups.push({ id, label: a.p_label, kind: a.p_kind || 'class', valid_from: a.p_valid_from ?? null, valid_until: a.p_valid_until ?? null, retention_until: a.p_retention_until ?? '2099-12-31', archived_at: null, created_at: now() });
          return { ...s.groups.at(-1), created: true };
        }
        return { ...s.groups.find((g) => g.id === id), created: false };
      }
      case 'teacher_update_group': {
        this.member(s, a.p_group_id);
        const g = s.groups.find((x) => x.id === a.p_group_id)!;
        const c = a.p_changes || {};
        if ('label' in c) g.label = c.label;
        if ('valid_until' in c) g.valid_until = c.valid_until;
        if ('valid_from' in c) g.valid_from = c.valid_from;
        if ('retention_until' in c && c.retention_until) g.retention_until = c.retention_until;
        if ('archived' in c) g.archived_at = c.archived ? g.archived_at || now() : null;
        return g;
      }
      case 'teacher_end_access': return this.dispatch(s, 'teacher_update_group', { p_group_id: a.p_group_id, p_changes: { valid_until: now() } });
      case 'teacher_register_participants': {
        this.member(s, a.p_group_id);
        let created = 0, reissued = 0, unchanged = 0;
        for (const it of a.p_participants || []) {
          const n = normalizeCode(it.code);
          let p = s.participants.find((x) => x.id === it.id);
          const isNew = !p;
          if (!p) { p = { id: it.id, group_id: a.p_group_id, pseudonym: it.pseudonym, status: 'active', created_at: now() }; s.participants.push(p); created++; }
          const existing = s.codes.find((x) => x.code === n);
          if (existing) { unchanged++; continue; }
          s.codes.forEach((x) => { if (x.participant_id === p!.id && !x.revoked_at) x.revoked_at = now(); });
          s.codes.push({ participant_id: p.id, code: n, valid_until: it.valid_until ?? a.p_code_valid_until ?? null, revoked_at: null });
          if (!isNew) reissued++;
        }
        return { ok: true, created, reissued, unchanged };
      }
      case 'teacher_set_participant_status':
        s.participants.forEach((p) => { if ((a.p_participant_ids || []).includes(p.id)) p.status = a.p_status; });
        return { ok: true };
      case 'teacher_revoke_codes':
        s.codes.forEach((c) => { if ((a.p_participant_ids || []).includes(c.participant_id) && !c.revoked_at) c.revoked_at = now(); });
        return { ok: true };
      case 'teacher_set_lab_assignment': {
        this.member(s, a.p_group_id);
        const x = s.group_labs.find((y) => y.group_id === a.p_group_id && y.lab_id === a.p_lab_id);
        const state = a.p_state || 'active';
        if (state === 'active') { if (x) x.archived_at = null; else s.group_labs.push({ group_id: a.p_group_id, lab_id: a.p_lab_id, assigned_at: now(), archived_at: null }); }
        else if (state === 'archived' && x) x.archived_at = x.archived_at || now();
        else if (state === 'removed') s.group_labs = s.group_labs.filter((y) => y !== x);
        return { ok: true };
      }
      case 'teacher_delete_results':
        s.results = s.results.filter((r) => !(r.group_id === a.p_group_id && (!a.p_lab_id || r.lab_id === a.p_lab_id)));
        s.progress = s.progress.filter((r) => !(r.group_id === a.p_group_id && (!a.p_lab_id || r.lab_id === a.p_lab_id)));
        return { ok: true };
      case 'teacher_reset_results':
        s.results = s.results.filter((r) => !((a.p_participant_ids || []).includes(r.participant_id) && (!a.p_lab_id || r.lab_id === a.p_lab_id)));
        s.progress = s.progress.filter((r) => !((a.p_participant_ids || []).includes(r.participant_id) && (!a.p_lab_id || r.lab_id === a.p_lab_id)));
        return { ok: true };
      case 'teacher_seed_demo_results': {
        this.dispatch(s, 'teacher_delete_results', { p_group_id: a.p_group_id });
        this.seedAnswers(s, a.p_group_id);
        return { ok: true };
      }
      case 'teacher_purge_expired': return { groups_deleted: 0 };
      case 'teacher_audit_log': return [];
      case 'teacher_group_overview': {
        this.member(s, a.p_group_id);
        const g = s.groups.find((x) => x.id === a.p_group_id)!;
        return {
          generated_at: now(), group: g,
          labs: s.group_labs.filter((x) => x.group_id === g.id && (!a.p_lab_id || x.lab_id === a.p_lab_id)).map((x) => {
            const l = this.lab(s, x.lab_id)!;
            return { id: l.id, title: l.title, version: l.version, archived_at: x.archived_at, tasks: l.tasks.map((t) => ({ task_id: t.task_id, title: t.title, section: t.section, position: t.position, counts_for_progress: t.counts_for_progress !== false })) };
          }),
          participants: s.participants.filter((p) => p.group_id === g.id).sort((x, y) => x.pseudonym.localeCompare(y.pseudonym)).map((p) => ({
            id: p.id, pseudonym: p.pseudonym, status: p.status,
            code_active: s.codes.some((c) => c.participant_id === p.id && !c.revoked_at),
            progress: s.progress.filter((x) => x.participant_id === p.id && (!a.p_lab_id || x.lab_id === a.p_lab_id)).map((x) => ({ lab_id: x.lab_id, lab_version: x.lab_version, percent: x.percent, completed: x.completed, total: x.total, started_at: x.started_at, last_saved_at: x.last_saved_at, finished_at: x.finished_at })),
            tasks: s.results.filter((r) => r.participant_id === p.id && (!a.p_lab_id || r.lab_id === a.p_lab_id)).map((r) => ({ lab_id: r.lab_id, task_id: r.task_id, status: r.status, is_correct: r.is_correct, updated_at: r.updated_at })),
          })),
        };
      }
      case 'teacher_task_stats': {
        this.member(s, a.p_group_id);
        const lab = this.lab(s, a.p_lab_id)!;
        const rs = s.results.filter((r) => r.group_id === a.p_group_id && r.lab_id === a.p_lab_id);
        return {
          generated_at: now(),
          participants: s.participants.filter((p) => p.group_id === a.p_group_id).length,
          started: s.progress.filter((p) => p.group_id === a.p_group_id && p.lab_id === a.p_lab_id).length,
          finished: s.progress.filter((p) => p.group_id === a.p_group_id && p.lab_id === a.p_lab_id && p.finished_at).length,
          tasks: lab.tasks.map((t) => {
            const tr = rs.filter((r) => r.task_id === t.task_id);
            const answers: Record<string, number> = {};
            tr.forEach((r) => { const c = r.answer?.choice; if (typeof c === 'string') answers[c] = (answers[c] || 0) + 1; });
            return { task_id: t.task_id, title: t.title, section: t.section, position: t.position, kind: t.kind, graded: !!t.graded, options: t.options || [], solution: t.solution ?? null,
              completed: tr.filter((r) => r.status === 'completed').length, in_progress: tr.filter((r) => r.status === 'in_progress').length,
              correct: tr.filter((r) => r.is_correct === true).length, incorrect: tr.filter((r) => r.is_correct === false).length,
              first_correct: tr.filter((r) => r.first_is_correct === true).length, first_incorrect: tr.filter((r) => r.first_is_correct === false).length, answers };
          }),
        };
      }
      case 'teacher_participant_results': {
        this.member(s, a.p_group_id);
        return s.participants.filter((p) => p.group_id === a.p_group_id && (!a.p_participant_id || p.id === a.p_participant_id)).sort((x, y) => x.pseudonym.localeCompare(y.pseudonym)).map((p) => ({
          participant_id: p.id, pseudonym: p.pseudonym, status: p.status,
          progress: (() => { const x = s.progress.find((y) => y.participant_id === p.id && y.lab_id === a.p_lab_id); return x ? { percent: x.percent, completed: x.completed, total: x.total, last_saved_at: x.last_saved_at, finished_at: x.finished_at } : null; })(),
          results: s.results.filter((r) => r.participant_id === p.id && r.lab_id === a.p_lab_id).map((r) => ({ task_id: r.task_id, lab_version: r.lab_version, answer: r.answer, data: r.data, status: r.status, is_correct: r.is_correct, first_is_correct: r.first_is_correct, revision: r.revision, first_completed_at: r.first_completed_at, updated_at: r.updated_at })),
        }));
      }
      case 'teacher_export_group': {
        this.member(s, a.p_group_id);
        const g = s.groups.find((x) => x.id === a.p_group_id)!;
        const labIds = new Set([...s.group_labs.filter((x) => x.group_id === g.id).map((x) => x.lab_id), ...s.results.filter((r) => r.group_id === g.id).map((r) => r.lab_id)]);
        return {
          format: 'lernlabore2-export', format_version: 1, exported_at: now(), demo: true, group: g,
          labs: s.labs.filter((l) => labIds.has(l.id)).map((l) => ({ id: l.id, title: l.title, subject: l.subject, audience: l.audience, current_version: l.version,
            tasks: l.tasks.map((t, i) => ({ version: l.version, task_id: t.task_id, position: t.position ?? i + 1, section: t.section ?? '', title: t.title, kind: t.kind, graded: !!t.graded, counts_for_progress: t.counts_for_progress !== false, options: t.options || [], solution: t.solution ?? null })) })),
          participants: s.participants.filter((p) => p.group_id === g.id).map((p) => ({ id: p.id, pseudonym: p.pseudonym, status: p.status, created_at: p.created_at })),
          progress: s.progress.filter((p) => p.group_id === g.id).map((p) => ({ participant_id: p.participant_id, lab_id: p.lab_id, lab_version: p.lab_version, completed: p.completed, total: p.total, percent: p.percent, started_at: p.started_at, last_saved_at: p.last_saved_at, finished_at: p.finished_at })),
          results: s.results.filter((r) => r.group_id === g.id).map(({ group_id, ...r }) => r),
        };
      }
      default:
        throw new TransportError('http', `Funktion ${fn} ist im Demo-Modus nicht verfügbar.`, 404, 'PGRST202');
    }
  }
}

export class DemoTransport implements Transport {
  readonly mode = 'demo' as const;
  readonly endpoint = 'demo://browser';
  constructor(readonly backend = new DemoBackend()) {}
  rpc<T = any>(fn: string, args: Record<string, unknown>): Promise<T> {
    return this.backend.call(fn, args);
  }
}
