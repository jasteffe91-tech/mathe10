// =====================================================================
// Lernlabor-SDK – gemeinsame Schnittstelle für alle Lernlabore.
//
// Kurzform für ein Labor:
//   const lab = await Lernlabor.initializeLab({ labId: 'mein-labor', labVersion: '1.0' });
//   lab.getResult('aufgabe-1');                       // gespeicherten Stand lesen
//   await lab.completeTask('aufgabe-1', { choice: 'b' });  // Aufgabe abschließen
//
// Das SDK übernimmt Anmeldung, Laden, automatisches Speichern, Offline-
// Warteschlange, Speicheranzeige und Abmelden.
// =====================================================================
import { LabClient, ERROR_MESSAGES } from './client';
import { DemoBackend, DemoTransport } from './demo-backend';
import { DEMO_DATA } from './generated/demo-data';
import { IndexedDbStore, MemoryStore, type LocalStore } from './storage';
import { SupabaseTransport, TransportError, type Transport } from './transport';
import { mountDemoBanner, mountEnvironmentBanner, mountSessionBar, mountStatusBadge, promptLogin, showBlockingMessage } from './ui';
import type { LabManifest, LabTaskDef, LernlaborConfig } from './types';

export * from './codes';
export * from './types';
export { LabClient, ERROR_MESSAGES } from './client';
export { SupabaseTransport, TransportError } from './transport';
export type { Transport } from './transport';
export { DemoBackend, DemoTransport } from './demo-backend';
export { IndexedDbStore, MemoryStore } from './storage';
export type { LocalStore } from './storage';
export { mountStatusBadge, mountSessionBar, promptLogin, confirmDialog } from './ui';

export const SDK_VERSION = '2.0.0';

declare global {
  interface Window { LERNLABOR_CONFIG?: Partial<LernlaborConfig> }
}

export function resolveConfig(overrides: Partial<LernlaborConfig> = {}): LernlaborConfig & { effectiveMode: 'online' | 'demo' } {
  const fromWindow = (typeof window !== 'undefined' && window.LERNLABOR_CONFIG) || {};
  const cfg: LernlaborConfig = { supabaseUrl: '', supabaseAnonKey: '', mode: 'auto', sessionPersistence: 'tab', ...fromWindow, ...overrides };
  let effectiveMode: 'online' | 'demo' = cfg.mode === 'demo' ? 'demo' : cfg.mode === 'online' ? 'online' : cfg.supabaseUrl && cfg.supabaseAnonKey ? 'online' : 'demo';
  try {
    const p = new URLSearchParams(location.search);
    if (p.get('demo') === '1') effectiveMode = 'demo';
  } catch { /* kein Browser */ }
  return { ...cfg, effectiveMode };
}

export function createTransport(cfg: ReturnType<typeof resolveConfig>): Transport {
  if (cfg.effectiveMode === 'demo') return new DemoTransport(new DemoBackend());
  return new SupabaseTransport(cfg.supabaseUrl, cfg.supabaseAnonKey);
}

/** Liest einen Zugangscode aus dem URL-Fragment (#zugang=…), entfernt ihn sofort aus Adresse und Verlauf. */
export function takeCodeFromFragment(): string | null {
  try {
    const m = /(?:^#|&)zugang=([A-Za-z0-9-]{8,24})/.exec(location.hash);
    if (!m) return null;
    history.replaceState(null, '', location.pathname + location.search);
    return m[1];
  } catch { return null; }
}

export interface InitializeLabOptions {
  labId: string;
  labVersion: string;
  /** Titel für das Anmeldefenster */
  title?: string;
  /** Aufgabenliste (empfohlen, z. B. aus lab.manifest.json) – für Fortschritt auch ohne Verbindung */
  manifest?: LabManifest;
  tasks?: LabTaskDef[];
  config?: Partial<LernlaborConfig>;
  ui?: {
    /** false = eigenes Anmeldefenster verwenden (dann login() selbst aufrufen) */
    login?: boolean;
    welcomeTitle?: string;
    /** Element für die Speicheranzeige; null = schwebend; false = keine Anzeige */
    statusTarget?: HTMLElement | null | false;
    /** Element für „Angemeldet als … · Abmelden“; null = schwebend; false = keine */
    sessionTarget?: HTMLElement | null | false;
    onLogout?: () => void;
  };
  transport?: Transport;
  store?: LocalStore;
}

/**
 * Initialisiert ein Lernlabor: Anmeldung (falls nötig), Laden des Lernstands,
 * Start der automatischen Speicherung. Erfüllt sich mit einem angemeldeten LabClient.
 */
export async function initializeLab(o: InitializeLabOptions): Promise<LabClient> {
  const cfg = resolveConfig(o.config);
  const title = o.title || o.manifest?.title || 'Lernlabor';
  const tasks = o.tasks || o.manifest?.tasks;
  const showUi = o.ui?.login !== false && typeof document !== 'undefined';

  let transport: Transport;
  try {
    transport = o.transport ?? createTransport(cfg);
  } catch (e) {
    if (showUi) await showBlockingMessage('Noch nicht eingerichtet', ERROR_MESSAGES.config, 'Neu laden').then(() => location.reload());
    throw e;
  }
  if (transport instanceof DemoTransport && o.manifest) transport.backend.ensureLab(o.manifest);

  const store = o.store ?? (await IndexedDbStore.create().catch(() => new MemoryStore()));
  const client = new LabClient({ transport, store, labId: o.labId, labVersion: o.labVersion, tasks, sessionPersistence: cfg.sessionPersistence });

  if (showUi && transport instanceof DemoTransport) {
    const backend = transport.backend;
    mountDemoBanner({ isOffline: () => backend.isOffline(), setOffline: (v) => backend.setOffline(v) });
  } else if (showUi && cfg.environmentLabel) {
    mountEnvironmentBanner(cfg.environmentLabel);
  }

  const demoCodes = transport.mode === 'demo' ? DEMO_DATA.participants.map((p) => p.code) : undefined;
  const loginUi = { labTitle: title, welcomeTitle: o.ui?.welcomeTitle, demoCodes, environmentLabel: cfg.environmentLabel };

  const fragmentCode = takeCodeFromFragment();
  let restored = await client.restoreSession().catch(() => 'none' as const);
  if (fragmentCode) {
    if (showUi) await promptLogin(client, { ...loginUi, presetCode: fragmentCode });
    else await client.loginWithAccessCode(fragmentCode);
    restored = client.isLoggedIn ? 'ok' : 'none';
  }
  if (restored === 'none') {
    if (!showUi) return client; // Labor kümmert sich selbst um die Anmeldung
    await promptLogin(client, loginUi);
  }

  // Lernstand laden – bei nicht freigeschaltetem Labor Hinweis zeigen und neu anmelden lassen
  for (;;) {
    const res = await client.loadProgress();
    if (!res.error) break;
    if (!showUi) throw new TransportError('http', ERROR_MESSAGES[res.error] ?? res.error);
    if (res.error === 'session_invalid') {
      await promptLogin(client, { ...loginUi, reason: ERROR_MESSAGES.session_invalid });
      continue;
    }
    await showBlockingMessage('Hoppla!', ERROR_MESSAGES[res.error] ?? ERROR_MESSAGES.unknown, 'Mit anderem Code anmelden');
    await client.logout();
    await promptLogin(client, loginUi);
  }

  if (showUi) {
    if (o.ui?.statusTarget !== false) mountStatusBadge(client, o.ui?.statusTarget ?? null);
    if (o.ui?.sessionTarget !== false) mountSessionBar(client, o.ui?.sessionTarget ?? null, o.ui?.onLogout);
    client.on('session-expired', async () => {
      const before = client.participant?.key;
      await promptLogin(client, { ...loginUi, reason: 'Deine Anmeldung ist abgelaufen. Gib deinen Code noch einmal ein – deine Antworten sind nicht verloren.' });
      if (client.participant?.key !== before) location.reload();
      else client.resumeAfterLogin();
    });
    client.on('participant-changed', () => location.reload());
  }
  return client;
}

// Kurznamen wie im Masterprompt beschrieben
export const loginWithAccessCode = (c: LabClient, code: string) => c.loginWithAccessCode(code);
export const loadProgress = (c: LabClient) => c.loadProgress();
export const saveAnswer = (c: LabClient, taskId: string, answer: Record<string, any>, opts?: { data?: Record<string, any>; completed?: boolean }) => c.saveAnswer(taskId, answer, opts);
export const completeTask = (c: LabClient, taskId: string, answer?: Record<string, any>, data?: Record<string, any>) => c.completeTask(taskId, answer, data);
export const getProgress = (c: LabClient) => c.getProgress();
export const logout = (c: LabClient) => c.logout();
