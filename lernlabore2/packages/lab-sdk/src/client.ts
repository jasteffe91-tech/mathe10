// =====================================================================
// LabClient – Kern des SDK: Sitzung, Laden, Speichern, Offline-Warteschlange.
//
// Wichtigste Regel: „Gespeichert“ wird NUR angezeigt, wenn der Server die
// Speicherung bestätigt hat. Lokal zwischengespeicherte Änderungen gelten
// als „ausstehend“ (pending) und werden so angezeigt.
// =====================================================================
import { uuid } from './codes';
import { TransportError, type Transport } from './transport';
import type { LocalStore } from './storage';
import type {
  ApiErrorCode, JsonObject, LabCache, LabTaskDef, ParticipantInfo, Progress, QueueItem,
  SaveState, StatusInfo, StoredSession, TaskResult,
} from './types';

const SESSION_KEY = 'lernlabor.sitzung.v1';
const BACKOFF_MS = [1000, 2000, 5000, 10000, 20000, 30000, 60000];
const CACHE_MAX_AGE_MS = 24 * 3600 * 1000;

export const ERROR_MESSAGES: Record<ApiErrorCode | 'network' | 'config' | 'unknown', string> = {
  invalid: 'Diesen Code kennen wir leider nicht. Schau noch einmal genau auf deine Karte.',
  blocked: 'Dieser Code ist gesperrt. Bitte frag deine Lehrerin oder deinen Lehrer.',
  expired: 'Dieser Code gilt nicht mehr. Bitte frag deine Lehrerin oder deinen Lehrer.',
  not_yet_valid: 'Dieser Code gilt erst später. Bitte frag deine Lehrerin oder deinen Lehrer.',
  rate_limited: 'Zu viele Versuche. Bitte warte ein paar Minuten und versuche es dann noch einmal.',
  session_invalid: 'Deine Anmeldung ist abgelaufen. Gib deinen Code bitte noch einmal ein.',
  lab_not_assigned: 'Dieses Lernlabor ist für deine Gruppe gerade nicht freigeschaltet.',
  unknown_task: 'Diese Aufgabe kennt der Server nicht. Bitte sag deiner Lehrkraft Bescheid.',
  too_large: 'Die Antwort ist zu lang zum Speichern.',
  invalid_request: 'Die Antwort konnte nicht gespeichert werden.',
  network: 'Keine Internetverbindung. Für die Anmeldung brauchst du Internet.',
  config: 'Dieses Lernlabor ist noch nicht mit dem Server verbunden. (Hinweis für Lehrkräfte: config.js ausfüllen.)',
  unknown: 'Etwas ist schiefgelaufen. Bitte versuche es noch einmal.',
};

type Listener = (payload: any) => void;
type EventName = 'status' | 'conflict' | 'session-expired' | 'progress' | 'results' | 'participant-changed' | 'save-error';

interface SessionStorageLike { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void }

function pickStorage(kind: 'tab' | 'device'): SessionStorageLike {
  const mem = new Map<string, string>();
  const fallback = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) };
  try {
    const s = kind === 'device' ? globalThis.localStorage : globalThis.sessionStorage;
    if (!s) return fallback;
    s.setItem('__lls', '1'); s.removeItem('__lls');
    return s;
  } catch { return fallback; }
}

export interface LabClientOptions {
  transport: Transport;
  store: LocalStore;
  labId: string;
  labVersion: string;
  tasks?: LabTaskDef[];
  sessionPersistence?: 'tab' | 'device';
  /** nur für Tests: eigener Sitzungsspeicher */
  sessionStorage?: SessionStorageLike;
  /** nur für Tests: Online-Erkennung */
  isOnline?: () => boolean;
}

export class LabClient {
  readonly labId: string;
  readonly labVersion: string;
  readonly mode: 'online' | 'demo';
  private readonly transport: Transport;
  private readonly store: LocalStore;
  private readonly sessions: SessionStorageLike;
  private readonly isOnline: () => boolean;

  private session: StoredSession | null = null;
  private tasks: LabTaskDef[];
  private labTitle = '';
  private server = new Map<string, TaskResult>();
  private pending = new Map<string, QueueItem>();
  private pendingResume: QueueItem | null = null;
  private resume: JsonObject = {};
  private listeners = new Map<EventName, Set<Listener>>();

  private running: Promise<void> | null = null;
  private destroyed = false;
  private inFlightId: string | null = null;
  private failures = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private lastError: 'network' | 'server' | 'session' | 'permanent' | null = null;
  private lastConfirmedAt: Date | null = null;
  private stateCache: SaveState = 'idle';
  private onlineHandler = () => { this.failures = 0; this.kick(0); };

  constructor(o: LabClientOptions) {
    this.transport = o.transport;
    this.store = o.store;
    this.labId = o.labId;
    this.labVersion = o.labVersion;
    this.tasks = (o.tasks ?? []).map((t, i) => ({ ...t, position: t.position ?? i + 1 }));
    this.mode = o.transport.mode;
    this.sessions = o.sessionStorage ?? pickStorage(o.sessionPersistence ?? 'tab');
    this.isOnline = o.isOnline ?? (() => (typeof navigator === 'undefined' ? true : navigator.onLine !== false));
    if (typeof window !== 'undefined') window.addEventListener('online', this.onlineHandler);
  }

  // ------------------------------------------------------------------ Ereignisse
  on(event: EventName, fn: Listener) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(fn);
    return () => this.listeners.get(event)?.delete(fn);
  }
  private emit(event: EventName, payload?: unknown) {
    this.listeners.get(event)?.forEach((fn) => { try { fn(payload); } catch (e) { console.error(e); } });
  }

  // ------------------------------------------------------------------ Sitzung
  get participant(): ParticipantInfo | null { return this.session?.participant ?? null; }
  get isLoggedIn() { return !!this.session; }
  get title() { return this.labTitle; }

  private readStoredSession(): StoredSession | null {
    try {
      const raw = this.sessions.getItem(SESSION_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw) as StoredSession;
      if (s.endpoint !== this.transport.endpoint || s.mode !== this.mode || new Date(s.expiresAt) <= new Date()) {
        this.sessions.removeItem(SESSION_KEY);
        return null;
      }
      return s;
    } catch { return null; }
  }

  private storeSession(s: StoredSession) {
    this.session = s;
    try { this.sessions.setItem(SESSION_KEY, JSON.stringify(s)); } catch { /* nur im Speicher */ }
  }

  /** Vorhandene Sitzung prüfen. 'offline' = Sitzung lokal vorhanden, Server nicht erreichbar. */
  async restoreSession(): Promise<'ok' | 'none' | 'offline'> {
    const s = this.readStoredSession();
    if (!s) return 'none';
    try {
      const res = await this.transport.rpc('student_session_info', { p_session: s.token });
      if (!res?.ok) { this.sessions.removeItem(SESSION_KEY); return 'none'; }
      this.storeSession({ ...s, participant: res.participant, expiresAt: res.expires_at });
      return 'ok';
    } catch (e) {
      if (e instanceof TransportError && e.kind === 'network') { this.session = s; return 'offline'; }
      throw e;
    }
  }

  /** Anmeldung mit Zugangscode (nur mit Internet möglich). */
  async loginWithAccessCode(code: string): Promise<{ ok: true; participant: ParticipantInfo } | { ok: false; error: string; message: string }> {
    if (!this.isOnline() && this.mode === 'online') return { ok: false, error: 'network', message: ERROR_MESSAGES.network };
    let res: any;
    try {
      res = await this.transport.rpc('student_login', { p_code: code });
    } catch (e) {
      const kind = e instanceof TransportError && (e.kind === 'network' || e.kind === 'config') ? e.kind : 'unknown';
      return { ok: false, error: kind, message: ERROR_MESSAGES[kind] };
    }
    if (!res?.ok) {
      const err = (res?.error ?? 'unknown') as keyof typeof ERROR_MESSAGES;
      return { ok: false, error: err, message: ERROR_MESSAGES[err] ?? ERROR_MESSAGES.unknown };
    }
    const previousKey = this.session?.participant.key;
    this.storeSession({ token: res.session_token, expiresAt: res.expires_at, mode: this.mode, endpoint: this.transport.endpoint, participant: res.participant });
    this.lastError = null;
    this.failures = 0;
    if (previousKey && previousKey !== res.participant.key) this.emit('participant-changed', res.participant);
    return { ok: true, participant: res.participant };
  }

  /** Abmelden. Ausstehende Änderungen bleiben in der Warteschlange und werden beim nächsten Anmelden derselben Person übertragen. */
  async logout(): Promise<{ ok: true; pendingLeftOnDevice: number }> {
    const pendingCount = this.pendingCount();
    if (pendingCount > 0 && this.isOnline()) await this.flush(4000).catch(() => false);
    const left = this.pendingCount();
    const token = this.session?.token;
    const key = this.session?.participant.key;
    if (token) await this.transport.rpc('student_logout', { p_session: token }).catch(() => null);
    if (key) await this.store.deleteCache(this.cacheKey(key)).catch(() => null);
    this.sessions.removeItem(SESSION_KEY);
    this.session = null;
    this.server.clear();
    this.pending.clear();
    this.pendingResume = null;
    this.resume = {};
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.updateStatus();
    return { ok: true, pendingLeftOnDevice: left };
  }

  // ------------------------------------------------------------------ Laden
  private cacheKey(pkey: string) { return `${this.transport.endpoint}|${pkey}|${this.labId}`; }

  /** Lernstand vom Server laden; ohne Verbindung aus dem lokalen Zwischenspeicher. */
  async loadProgress(): Promise<{ source: 'server' | 'cache' | 'empty'; error?: ApiErrorCode }> {
    if (!this.session) throw new Error('Nicht angemeldet.');
    const pkey = this.session.participant.key;
    await this.store.pruneCaches(CACHE_MAX_AGE_MS).catch(() => null);
    let source: 'server' | 'cache' | 'empty' = 'empty';
    try {
      const res = await this.transport.rpc('student_load_lab', { p_session: this.session.token, p_lab_id: this.labId });
      if (!res?.ok) {
        if (res?.error === 'session_invalid') this.handleSessionInvalid();
        return { source: 'empty', error: res?.error };
      }
      this.labTitle = res.lab.title;
      if (res.lab.version === this.labVersion && Array.isArray(res.lab.tasks) && res.lab.tasks.length) this.tasks = res.lab.tasks;
      this.server = new Map((res.results as TaskResult[]).map((r) => [r.task_id, r]));
      this.resume = res.resume_state ?? {};
      source = 'server';
      this.lastConfirmedAt = res.progress?.last_saved_at ? new Date(res.progress.last_saved_at) : null;
      await this.saveCache();
    } catch (e) {
      if (!(e instanceof TransportError && e.kind === 'network')) throw e;
      const c = await this.store.getCache(this.cacheKey(pkey)).catch(() => null);
      if (c) {
        if (c.tasks.length) this.tasks = c.tasks;
        this.server = new Map(c.results.map((r) => [r.task_id, r]));
        this.resume = c.resume ?? {};
        source = 'cache';
      }
      this.lastError = 'network';
    }
    // ausstehende Änderungen (z. B. von vor einem Browser-Neustart) einblenden
    const items = await this.store.list(this.transport.endpoint, pkey);
    this.pending.clear();
    this.pendingResume = null;
    for (const it of items) {
      if (it.labId !== this.labId) continue;
      if (it.type === 'task' && it.taskId) this.pending.set(it.taskId, it);
      if (it.type === 'resume') this.pendingResume = it;
    }
    if (this.pendingResume?.state) this.resume = this.pendingResume.state;
    this.updateStatus();
    this.emit('results', this.getResults());
    this.emit('progress', this.getProgress());
    this.kick(0);
    return { source };
  }

  private async saveCache() {
    if (!this.session) return;
    const c: LabCache = {
      key: this.cacheKey(this.session.participant.key), savedAt: new Date().toISOString(), tasks: this.tasks,
      results: [...this.server.values()], progress: this.serverProgress(), resume: this.resume,
    };
    await this.store.putCache(c).catch(() => null);
  }

  // ------------------------------------------------------------------ Lesen
  getTasks(): LabTaskDef[] { return this.tasks.slice().sort((a, b) => (a.position ?? 0) - (b.position ?? 0)); }

  getResult(taskId: string): TaskResult | null {
    const p = this.pending.get(taskId);
    const s = this.server.get(taskId);
    if (p) {
      return { task_id: taskId, lab_version: p.labVersion, answer: p.answer ?? {}, data: p.data ?? {},
        status: p.completed || s?.status === 'completed' ? 'completed' : 'in_progress', is_correct: null,
        revision: s?.revision ?? 0, pending: true };
    }
    return s ? { ...s, pending: false } : null;
  }

  getResults(): Record<string, TaskResult> {
    const out: Record<string, TaskResult> = {};
    for (const id of new Set([...this.server.keys(), ...this.pending.keys()])) out[id] = this.getResult(id)!;
    return out;
  }

  isCompleted(taskId: string) { return this.getResult(taskId)?.status === 'completed'; }

  private computeProgress(includePending: boolean): Progress {
    const counted = this.tasks.filter((t) => t.counts_for_progress !== false);
    const total = counted.length;
    let done = 0;
    let usesPending = false;
    for (const t of counted) {
      const s = this.server.get(t.task_id);
      const p = includePending ? this.pending.get(t.task_id) : undefined;
      if (s?.status === 'completed') done++;
      else if (p?.completed) { done++; usesPending = true; }
    }
    const percent = total === 0 ? 0 : done >= total ? 100 : Math.min(99, Math.round((100 * done) / total));
    return { completed: done, total, percent, includesPending: usesPending };
  }

  /** Fortschritt inkl. lokal ausstehender Änderungen (includesPending zeigt das an). */
  getProgress(): Progress { return this.computeProgress(true); }
  /** Nur vom Server bestätigter Fortschritt. */
  serverProgress(): Progress { return this.computeProgress(false); }
  getResumeState(): JsonObject { return { ...this.resume }; }

  // ------------------------------------------------------------------ Speichern
  /**
   * Antwort speichern. Die Änderung wird SOFORT dauerhaft in die lokale
   * Warteschlange geschrieben und dann an den Server übertragen.
   * Das zurückgegebene Promise erfüllt sich, sobald die Änderung lokal gesichert ist.
   */
  async saveAnswer(taskId: string, answer: JsonObject, opts: { data?: JsonObject; completed?: boolean } = {}): Promise<{ queued: true; opId: string }> {
    if (!this.session) throw new Error('Nicht angemeldet.');
    if (this.tasks.length && !this.tasks.some((t) => t.task_id === taskId)) throw new Error(`Unbekannte Aufgabe: ${taskId}`);
    const item: QueueItem = {
      id: uuid(), opId: uuid(), participantKey: this.session.participant.key, endpoint: this.transport.endpoint,
      labId: this.labId, labVersion: this.labVersion, type: 'task', taskId, answer: answer ?? {}, data: opts.data ?? {},
      completed: !!opts.completed, createdAt: new Date().toISOString(), clientSavedAt: new Date().toISOString(),
    };
    const previous = this.pending.get(taskId);
    // noch nicht gesendete ältere Änderung derselben Aufgabe ersetzen (Zusammenfassen)
    if (previous && previous.id !== this.inFlightId) {
      item.completed = item.completed || !!previous.completed;
      await this.store.remove(previous.id).catch(() => null);
    }
    await this.store.add(item);
    this.pending.set(taskId, item);
    this.updateStatus();
    this.emit('results', this.getResults());
    this.emit('progress', this.getProgress());
    this.kick(0);
    return { queued: true, opId: item.opId };
  }

  completeTask(taskId: string, answer: JsonObject = {}, data: JsonObject = {}) {
    return this.saveAnswer(taskId, answer, { data, completed: true });
  }

  /** Fortsetzungspunkt (z. B. aktueller Schritt) – klein halten (< 4 KB). */
  async setResumeState(state: JsonObject) {
    if (!this.session) return;
    this.resume = { ...state };
    const item: QueueItem = {
      id: uuid(), opId: uuid(), participantKey: this.session.participant.key, endpoint: this.transport.endpoint,
      labId: this.labId, labVersion: this.labVersion, type: 'resume', state: this.resume,
      createdAt: new Date().toISOString(), clientSavedAt: new Date().toISOString(),
    };
    if (this.pendingResume && this.pendingResume.id !== this.inFlightId) await this.store.remove(this.pendingResume.id).catch(() => null);
    await this.store.add(item);
    this.pendingResume = item;
    this.updateStatus();
    this.kick(300);
  }

  // ------------------------------------------------------------------ Warteschlange
  pendingCount() { return this.pending.size + (this.pendingResume ? 1 : 0); }

  private kick(delayMs: number) {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = setTimeout(() => { this.retryTimer = null; void this.process(); }, delayMs);
  }

  private scheduleRetry() {
    const d = BACKOFF_MS[Math.min(this.failures, BACKOFF_MS.length - 1)];
    this.failures++;
    this.kick(d);
  }

  private handleSessionInvalid() {
    this.lastError = 'session';
    this.updateStatus();
    this.emit('session-expired', { pending: this.pendingCount() });
  }

  /** Überträgt ausstehende Änderungen nacheinander (genau eine Anfrage gleichzeitig).
   *  Läuft bereits eine Übertragung, wird auf diese gewartet. */
  process(): Promise<void> {
    if (this.running) return this.running;
    if (!this.session || this.lastError === 'session' || this.destroyed) return Promise.resolve();
    this.running = this.runQueue().finally(() => { this.running = null; this.updateStatus(); });
    return this.running;
  }

  private async runQueue(): Promise<void> {
    {
      while (this.session && !this.destroyed) {
        const items = await this.store.list(this.transport.endpoint, this.session.participant.key);
        const item = items.find((i) => i.labId === this.labId);
        if (!item) { this.lastError = this.lastError === 'permanent' ? 'permanent' : null; break; }
        if (!this.isOnline()) { this.lastError = 'network'; this.updateStatus(); this.scheduleRetry(); break; }
        this.inFlightId = item.id;
        this.updateStatus();
        let res: any;
        try {
          if (item.type === 'task') {
            res = await this.transport.rpc('student_save_task', {
              p_session: this.session.token, p_lab_id: item.labId, p_lab_version: item.labVersion, p_task_id: item.taskId,
              p_op_id: item.opId, p_base_revision: this.server.get(item.taskId!)?.revision ?? 0,
              p_answer: item.answer, p_data: item.data, p_completed: !!item.completed, p_client_saved_at: item.clientSavedAt,
            });
          } else {
            res = await this.transport.rpc('student_save_resume', { p_session: this.session.token, p_lab_id: item.labId, p_state: item.state ?? {} });
          }
        } catch (e) {
          this.inFlightId = null;
          this.lastError = e instanceof TransportError && e.kind === 'network' ? 'network' : 'server';
          this.updateStatus();
          this.scheduleRetry();
          break;
        }
        this.inFlightId = null;

        if (!res?.ok) {
          const err = res?.error as ApiErrorCode;
          if (err === 'session_invalid') { this.handleSessionInvalid(); break; }
          if (err === 'lab_not_assigned') { this.lastError = 'server'; this.updateStatus(); this.failures = BACKOFF_MS.length - 1; this.scheduleRetry(); break; }
          // dauerhafter Fehler (unbekannte Aufgabe, zu groß …): Eintrag verwerfen, aber melden
          await this.store.remove(item.id);
          this.dropFromMemory(item);
          this.lastError = 'permanent';
          this.emit('save-error', { taskId: item.taskId, error: err, message: ERROR_MESSAGES[err] ?? ERROR_MESSAGES.unknown });
          this.updateStatus();
          continue;
        }

        this.failures = 0;
        if (this.lastError !== 'permanent') this.lastError = null;
        if (item.type === 'task') {
          if (res.status === 'conflict') {
            const local = this.getResult(item.taskId!);
            if (res.result) this.server.set(item.taskId!, res.result); else this.server.delete(item.taskId!);
            // auch eine neuere, darauf aufbauende lokale Änderung verwerfen
            const newer = this.pending.get(item.taskId!);
            if (newer && newer.id !== item.id) await this.store.remove(newer.id).catch(() => null);
            this.pending.delete(item.taskId!);
            await this.store.remove(item.id);
            this.emit('conflict', { taskId: item.taskId, server: res.result, local });
          } else {
            if (res.result) this.server.set(item.taskId!, res.result);
            await this.store.remove(item.id);
            if (this.pending.get(item.taskId!)?.id === item.id) this.pending.delete(item.taskId!);
          }
        } else {
          await this.store.remove(item.id);
          if (this.pendingResume?.id === item.id) this.pendingResume = null;
        }
        this.lastConfirmedAt = new Date();
        await this.saveCache();
        this.updateStatus();
        this.emit('results', this.getResults());
        this.emit('progress', this.getProgress());
      }
    }
  }

  private dropFromMemory(item: QueueItem) {
    if (item.type === 'task' && this.pending.get(item.taskId!)?.id === item.id) this.pending.delete(item.taskId!);
    if (item.type === 'resume' && this.pendingResume?.id === item.id) this.pendingResume = null;
  }

  /** Wartet, bis alles übertragen ist (oder die Zeit abläuft). true = nichts mehr ausstehend. */
  async flush(timeoutMs = 10000): Promise<boolean> {
    const end = Date.now() + timeoutMs;
    this.failures = 0;
    while (Date.now() < end) {
      await this.process();
      if (this.pendingCount() === 0) return true;
      if (this.lastError === 'session' || !this.session) return false;
      await new Promise((r) => setTimeout(r, 200));
    }
    return this.pendingCount() === 0;
  }

  /** Nach erneuter Anmeldung (abgelaufene Sitzung) weitermachen. */
  resumeAfterLogin() {
    this.lastError = null;
    this.failures = 0;
    this.kick(0);
  }

  // ------------------------------------------------------------------ Status
  private updateStatus() {
    const pending = this.pendingCount();
    let state: SaveState;
    if (!this.session) state = 'idle';
    else if (this.inFlightId) state = 'saving';
    else if (this.lastError === 'session') state = 'session';
    else if (pending > 0 && this.lastError === 'network') state = 'offline';
    else if (pending > 0 && this.lastError === 'server') state = 'retrying';
    else if (pending > 0) state = 'saving';
    else if (this.lastError === 'permanent') state = 'error';
    else state = this.lastConfirmedAt ? 'saved' : 'idle';
    this.stateCache = state;
    this.emit('status', this.getStatus());
  }

  getStatus(): StatusInfo {
    const pending = this.pendingCount();
    const demo = this.mode === 'demo';
    const msg: Record<SaveState, string> = {
      idle: demo ? 'Demo-Modus – nichts wird online gespeichert' : 'Bereit',
      saving: 'Wird gespeichert …',
      saved: demo ? 'Gespeichert (Demo – nur in diesem Browser)' : 'Gespeichert',
      offline: 'Offline – wird später synchronisiert',
      retrying: 'Speicherung fehlgeschlagen – erneuter Versuch',
      session: 'Bitte melde dich neu an – deine Antworten sind hier zwischengespeichert',
      error: 'Eine Antwort konnte nicht gespeichert werden',
    };
    let message = msg[this.stateCache];
    if (pending > 0 && !this.store.persistent && this.stateCache !== 'saving') message += ' (Seite bitte nicht schließen)';
    return { state: this.stateCache, mode: this.mode, pending, lastConfirmedAt: this.lastConfirmedAt, message };
  }

  destroy() {
    this.destroyed = true;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    if (typeof window !== 'undefined') window.removeEventListener('online', this.onlineHandler);
  }
}
