import { describe, it, expect, beforeEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { LabClient } from '../src/client';
import { DemoBackend, DemoTransport } from '../src/demo-backend';
import { IndexedDbStore, MemoryStore, type LocalStore } from '../src/storage';
import { TransportError, type Transport } from '../src/transport';
import { DEMO_DATA } from '../src/generated/demo-data';
import { formatCode, generateCode, isPlausibleCode, normalizeCode, CODE_ALPHABET } from '../src/codes';

const LAB = 'physik-entdecker';
const MANIFEST = DEMO_DATA.labs.find((l) => l.id === LAB)!;
const CODE_A = DEMO_DATA.participants[0].code; // ohne Vorbelegung
const CODE_B = DEMO_DATA.participants[1].code;

/** Transport mit steuerbarer Netzverbindung und optional „verlorenen Antworten“. */
class FlakyTransport implements Transport {
  readonly mode = 'online' as const;
  readonly endpoint = 'test://server';
  offline = false;
  loseNextResponse = false;
  calls: string[] = [];
  constructor(readonly inner: DemoTransport) {}
  async rpc(fn: string, args: Record<string, unknown>) {
    this.calls.push(fn);
    if (this.offline) throw new TransportError('network', 'offline');
    const res = await this.inner.rpc(fn, args);
    if (this.loseNextResponse) { this.loseNextResponse = false; throw new TransportError('network', 'Antwort verloren'); }
    return res;
  }
}

function memSession() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m };
}

function makeClient(t: Transport, store: LocalStore, session = memSession()) {
  return new LabClient({ transport: t, store, labId: LAB, labVersion: '1.0', tasks: MANIFEST.tasks, sessionStorage: session });
}

let backend: DemoBackend;
let transport: FlakyTransport;

beforeEach(() => {
  backend = new DemoBackend(0);
  backend.reset();
  transport = new FlakyTransport(new DemoTransport(backend));
});

describe('Zugangscodes', () => {
  it('erzeugt lesbare, zufällige Codes ohne verwechselbare Zeichen', () => {
    const codes = new Set(Array.from({ length: 2000 }, () => generateCode(12)));
    expect(codes.size).toBe(2000);
    for (const c of codes) {
      expect(c).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
      expect(c).not.toMatch(/[IL01O]/);
    }
  });
  it('normalisiert und formatiert Eingaben', () => {
    expect(normalizeCode(' abcd efgh-jkmn ')).toBe('ABCDEFGHJKMN');
    expect(formatCode('abcdefghjkmn')).toBe('ABCD-EFGH-JKMN');
    expect(isPlausibleCode('ABCD-EFG')).toBe(false);
    expect(isPlausibleCode('ABCD-EFGH')).toBe(true);
    expect(CODE_ALPHABET).toHaveLength(31);
  });
});

describe('LabClient', () => {
  it('Anmeldung, Speichern und Wiederherstellen nach Neuanmeldung', async () => {
    const store = new MemoryStore();
    const c = makeClient(transport, store);
    expect((await c.loginWithAccessCode('falsch-code-xx')).ok).toBe(false);
    const login = await c.loginWithAccessCode(CODE_A);
    expect(login.ok).toBe(true);
    await c.loadProgress();
    await c.completeTask('m1-vermutung', { choice: 'steil' });
    expect(await c.flush(2000)).toBe(true);
    expect(c.getStatus().state).toBe('saved');
    expect(c.serverProgress()).toMatchObject({ completed: 1, total: 6, percent: 17 });

    // neues Gerät / Browser geschlossen: neue Sitzung, neuer Speicher
    const c2 = makeClient(transport, new MemoryStore());
    await c2.loginWithAccessCode(CODE_A);
    await c2.loadProgress();
    expect(c2.getResult('m1-vermutung')).toMatchObject({ answer: { choice: 'steil' }, status: 'completed', pending: false });
  });

  it('meldet „Gespeichert“ erst nach Serverbestätigung; offline bleibt es ausstehend', async () => {
    const c = makeClient(transport, new MemoryStore());
    await c.loginWithAccessCode(CODE_A);
    await c.loadProgress();
    const states: string[] = [];
    c.on('status', (s) => states.push(s.state));
    transport.offline = true;
    await c.completeTask('m1-vermutung', { choice: 'flach' });
    await c.process();
    expect(c.getStatus().state).toBe('offline');
    expect(c.getStatus().message).toContain('Offline – wird später synchronisiert');
    expect(c.getResult('m1-vermutung')?.pending).toBe(true);
    expect(c.getProgress()).toMatchObject({ completed: 1, includesPending: true });
    expect(c.serverProgress().completed).toBe(0);
    expect(states).not.toContain('saved');

    transport.offline = false;
    expect(await c.flush(3000)).toBe(true);
    expect(c.getStatus().state).toBe('saved');
    expect(c.getResult('m1-vermutung')?.pending).toBe(false);
  });

  it('Offline-Änderungen überleben einen Browser-Neustart (IndexedDB) und werden später übertragen', async () => {
    const idb = new IDBFactory();
    const store1 = await IndexedDbStore.create(idb);
    expect(store1.persistent).toBe(true);
    const c = makeClient(transport, store1);
    await c.loginWithAccessCode(CODE_A);
    await c.loadProgress();
    transport.offline = true;
    await c.completeTask('e1-vermutung', { choice: 'kreis' });
    await c.process();
    c.destroy();

    // „Browser neu gestartet“: Sitzung (Tab) weg, IndexedDB bleibt
    transport.offline = false;
    const store2 = await IndexedDbStore.create(idb);
    const c2 = makeClient(transport, store2);
    expect(await c2.restoreSession()).toBe('none');
    await c2.loginWithAccessCode(CODE_A);
    await c2.loadProgress();
    expect(c2.getResult('e1-vermutung')?.pending).toBe(true);
    expect(await c2.flush(3000)).toBe(true);
    const c3 = makeClient(transport, new MemoryStore());
    await c3.loginWithAccessCode(CODE_A);
    await c3.loadProgress();
    expect(c3.getResult('e1-vermutung')).toMatchObject({ answer: { choice: 'kreis' }, status: 'completed' });
  });

  it('verlorene Serverantwort führt nicht zu doppelten Abschlüssen (Idempotenz)', async () => {
    const c = makeClient(transport, new MemoryStore());
    await c.loginWithAccessCode(CODE_A);
    await c.loadProgress();
    transport.loseNextResponse = true;
    await c.completeTask('m3-auswertung', { choice: 'steil' });
    expect(await c.flush(5000)).toBe(true);
    const saves = transport.calls.filter((f) => f === 'student_save_task').length;
    expect(saves).toBe(2);
    expect(c.getResult('m3-auswertung')?.revision).toBe(1);
    const state = backend.load();
    expect(state.results.filter((r) => r.task_id === 'm3-auswertung' && r.participant_id === DEMO_DATA.participants[0].id)).toHaveLength(1);
  });

  it('schützt neuere Ergebnisse von einem anderen Gerät (Konflikt → Serverstand gewinnt)', async () => {
    const deviceA = makeClient(transport, new MemoryStore());
    await deviceA.loginWithAccessCode(CODE_A);
    await deviceA.loadProgress();

    const deviceB = makeClient(transport, new MemoryStore());
    await deviceB.loginWithAccessCode(CODE_A);
    await deviceB.loadProgress();
    await deviceB.completeTask('m1-vermutung', { choice: 'mittel' });
    await deviceB.flush(2000);

    const conflicts: any[] = [];
    deviceA.on('conflict', (x) => conflicts.push(x));
    await deviceA.completeTask('m1-vermutung', { choice: 'flach' });
    await deviceA.flush(2000);
    expect(conflicts).toHaveLength(1);
    expect(deviceA.getResult('m1-vermutung')?.answer).toMatchObject({ choice: 'mittel' });
  });

  it('Benutzerwechsel auf geteiltem Gerät: fremde ausstehende Daten bleiben getrennt', async () => {
    const store = new MemoryStore();
    const session = memSession();
    const a = makeClient(transport, store, session);
    await a.loginWithAccessCode(CODE_A);
    await a.loadProgress();
    transport.offline = true;
    await a.completeTask('m1-vermutung', { choice: 'steil' });
    await a.process();
    transport.offline = false;
    // Kind A meldet sich ab, obwohl noch etwas aussteht (Server war offline)
    transport.offline = true;
    const out = await a.logout();
    expect(out.pendingLeftOnDevice).toBe(1);
    transport.offline = false;

    const b = makeClient(transport, store, session);
    await b.loginWithAccessCode(CODE_B);
    await b.loadProgress();
    expect(b.getResult('m1-vermutung')).toBeNull();
    await b.flush(2000);
    const st = backend.load();
    expect(st.results.some((r) => r.participant_id === DEMO_DATA.participants[1].id)).toBe(false);
    await b.logout();

    // Kind A kommt zurück → Daten werden jetzt übertragen
    const a2 = makeClient(transport, store, session);
    await a2.loginWithAccessCode(CODE_A);
    await a2.loadProgress();
    expect(await a2.flush(2000)).toBe(true);
    expect(backend.load().results.some((r) => r.participant_id === DEMO_DATA.participants[0].id && r.task_id === 'm1-vermutung')).toBe(true);
  });

  it('abgelaufene Sitzung: Warteschlange bleibt erhalten, nach Neuanmeldung wird übertragen', async () => {
    const c = makeClient(transport, new MemoryStore());
    await c.loginWithAccessCode(CODE_A);
    await c.loadProgress();
    const expired: any[] = [];
    c.on('session-expired', (x) => expired.push(x));
    const st = backend.load();
    st.sessions.forEach((s) => { s.revoked = true; });
    localStorage_set(backend, st);
    await c.completeTask('m1-vermutung', { choice: 'steil' });
    await c.process();
    expect(expired).toHaveLength(1);
    expect(c.getStatus().state).toBe('session');
    expect(c.pendingCount()).toBe(1);
    await c.loginWithAccessCode(CODE_A);
    c.resumeAfterLogin();
    expect(await c.flush(2000)).toBe(true);
  });

  it('Fortsetzungspunkt wird gespeichert und geladen', async () => {
    const c = makeClient(transport, new MemoryStore());
    await c.loginWithAccessCode(CODE_A);
    await c.loadProgress();
    await c.setResumeState({ schritt: 'e2' });
    await c.flush(2000);
    const c2 = makeClient(transport, new MemoryStore());
    await c2.loginWithAccessCode(CODE_A);
    await c2.loadProgress();
    expect(c2.getResumeState()).toEqual({ schritt: 'e2' });
  });
});

// Hilfsfunktion: Demo-Zustand zurückschreiben (DemoBackend speichert intern)
function localStorage_set(b: DemoBackend, st: ReturnType<DemoBackend['load']>) {
  (b as any).save(st);
}
