export type Mode = 'online' | 'demo';

export interface LernlaborConfig {
  /** z. B. https://abcdefghijkl.supabase.co */
  supabaseUrl: string;
  /** öffentlicher „anon“- bzw. „publishable“-Schlüssel (kein Geheimnis) */
  supabaseAnonKey: string;
  /** 'auto' = online, sobald URL und Schlüssel eingetragen sind, sonst Demo */
  mode: 'auto' | 'online' | 'demo';
  /** 'tab' = Sitzung endet mit dem Schließen des Tabs (sicher für geteilte Geräte); 'device' = bleibt bis zum Abmelden (max. 12 h) */
  sessionPersistence: 'tab' | 'device';
  /** Anzeigename der Umgebung, z. B. 'Testsystem' (wird dann sichtbar angezeigt) */
  environmentLabel?: string;
}

export interface LabTaskDef {
  task_id: string;
  position?: number;
  section?: string;
  title: string;
  kind: string;
  counts_for_progress?: boolean;
  graded?: boolean;
  options?: { value: string; label: string }[];
  solution?: { correct: string[] } | null;
}

export interface LabManifest {
  id: string;
  version: string;
  title: string;
  subject?: string;
  audience?: string;
  tasks: LabTaskDef[];
}

export type Json = null | boolean | number | string | Json[] | { [k: string]: Json };
export type JsonObject = { [k: string]: Json };

export interface TaskResult {
  task_id: string;
  lab_version?: string;
  answer: JsonObject;
  data: JsonObject;
  status: 'in_progress' | 'completed';
  is_correct?: boolean | null;
  revision: number;
  updated_at?: string;
  /** true = nur lokal, noch nicht vom Server bestätigt */
  pending?: boolean;
}

export interface Progress {
  completed: number;
  total: number;
  percent: number;
  /** true, wenn lokal noch unbestätigte Änderungen enthalten sind */
  includesPending?: boolean;
}

export interface ParticipantInfo {
  pseudonym: string;
  key: string;
  group: { label: string; kind: 'class' | 'event' | 'demo'; valid_until?: string | null };
  labs: { id: string; title: string; subject?: string; version?: string; percent: number; finished: boolean }[];
}

export interface StoredSession {
  token: string;
  expiresAt: string;
  mode: Mode;
  endpoint: string;
  participant: ParticipantInfo;
}

export type SaveState = 'idle' | 'saving' | 'saved' | 'offline' | 'retrying' | 'session' | 'error';

export interface StatusInfo {
  state: SaveState;
  mode: Mode;
  pending: number;
  lastConfirmedAt: Date | null;
  message: string;
}

export interface QueueItem {
  id: string;
  participantKey: string;
  endpoint: string;
  labId: string;
  labVersion: string;
  type: 'task' | 'resume';
  taskId?: string;
  opId: string;
  answer?: JsonObject;
  data?: JsonObject;
  completed?: boolean;
  state?: JsonObject;
  createdAt: string;
  clientSavedAt: string;
}

export interface LabCache {
  key: string;
  savedAt: string;
  tasks: LabTaskDef[];
  results: TaskResult[];
  progress: Progress;
  resume: JsonObject;
}

export type ApiErrorCode =
  | 'invalid' | 'blocked' | 'expired' | 'not_yet_valid' | 'rate_limited'
  | 'session_invalid' | 'lab_not_assigned' | 'unknown_task' | 'too_large' | 'invalid_request';
