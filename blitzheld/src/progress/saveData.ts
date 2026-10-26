import { DEFAULT_MATH_STATS, type MathStats } from '../math/mathChallenge';

/**
 * Lokaler Spielstand (localStorage). Keine Konten, kein Server.
 * Unbekannte oder kaputte Daten werden verworfen bzw. auf gültige Werte zurückgesetzt.
 */

export const SAVE_KEY = 'blitzheld.save.v1';
export const WORLD_COUNT = 4;
export const LEVELS_PER_WORLD = 3;

export interface LevelRecord {
  completed: boolean;
  /** IDs der jemals gesammelten Sterne dieses Levels. */
  stars: number[];
  bestCoins: number;
  /** Schnellste Zeit in Sekunden (0 = noch keine). */
  bestTime: number;
}

export interface Settings {
  sound: boolean;
  music: boolean;
  helpMode: boolean;
}

export interface SaveData {
  version: 1;
  /** Höchste freigeschaltete Welt (0-basiert). */
  unlockedWorld: number;
  levels: Record<string, LevelRecord>;
  /** Welt-Indizes der besiegten Bosse (= Boss-Trophäen). */
  bossesDefeated: number[];
  totalCoins: number;
  /** Zuletzt erreichter Checkpoint (für „Weiterspielen“). */
  checkpoint: { levelId: string; index: number } | null;
  settings: Settings;
  math: MathStats;
  gameCompleted: boolean;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function levelId(world: number, index: number): string {
  return `${world + 1}-${index + 1}`;
}

export function defaultSave(): SaveData {
  return {
    version: 1,
    unlockedWorld: 0,
    levels: {},
    bossesDefeated: [],
    totalCoins: 0,
    checkpoint: null,
    settings: { sound: true, music: true, helpMode: false },
    math: { ...DEFAULT_MATH_STATS, recent: [] },
    gameCompleted: false,
  };
}

const int = (v: unknown, min: number, max: number, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, Math.round(v))) : fallback;
const bool = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback);

/** Prüft und bereinigt geladene Daten. */
export function sanitize(raw: unknown): SaveData {
  const d = defaultSave();
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as Record<string, unknown>;
  if (r.version !== 1) return d;
  d.unlockedWorld = int(r.unlockedWorld, 0, WORLD_COUNT - 1, 0);
  d.totalCoins = int(r.totalCoins, 0, 1e9, 0);
  d.gameCompleted = bool(r.gameCompleted, false);
  if (Array.isArray(r.bossesDefeated)) {
    d.bossesDefeated = [...new Set(r.bossesDefeated.filter((w) => Number.isInteger(w) && w >= 0 && w < WORLD_COUNT))].sort();
  }
  if (r.levels && typeof r.levels === 'object') {
    for (const [id, rec] of Object.entries(r.levels as Record<string, unknown>)) {
      if (!/^[1-4]-[1-3]$/.test(id) || !rec || typeof rec !== 'object') continue;
      const lr = rec as Record<string, unknown>;
      d.levels[id] = {
        completed: bool(lr.completed, false),
        stars: Array.isArray(lr.stars) ? [...new Set(lr.stars.filter((s) => Number.isInteger(s) && s >= 0 && s < 10))] : [],
        bestCoins: int(lr.bestCoins, 0, 9999, 0),
        bestTime: typeof lr.bestTime === 'number' && lr.bestTime > 0 ? lr.bestTime : 0,
      };
    }
  }
  const cp = r.checkpoint as Record<string, unknown> | null | undefined;
  if (cp && typeof cp.levelId === 'string' && /^[1-4]-[1-3]$/.test(cp.levelId) && Number.isInteger(cp.index)) {
    d.checkpoint = { levelId: cp.levelId, index: int(cp.index, 0, 20, 0) };
  }
  const s = r.settings as Record<string, unknown> | undefined;
  if (s && typeof s === 'object') {
    d.settings = { sound: bool(s.sound, true), music: bool(s.music, true), helpMode: bool(s.helpMode, false) };
  }
  const m = r.math as Record<string, unknown> | undefined;
  if (m && typeof m === 'object') {
    d.math = {
      offset: int(m.offset, -2, 1, 0),
      recent: Array.isArray(m.recent) ? m.recent.filter((x) => typeof x === 'boolean').slice(-9) : [],
      totalSolved: int(m.totalSolved, 0, 1e9, 0),
      totalFirstTry: int(m.totalFirstTry, 0, 1e9, 0),
    };
  }
  // Freischaltung muss zu den besiegten Bossen passen.
  const maxBoss = d.bossesDefeated.length ? Math.max(...d.bossesDefeated) : -1;
  d.unlockedWorld = Math.max(d.unlockedWorld, Math.min(WORLD_COUNT - 1, maxBoss + 1));
  return d;
}

export function memoryStorage(): StorageLike {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
  };
}

/** localStorage, falls verfügbar – sonst Speicher im Arbeitsspeicher (z. B. privates Fenster). */
export function browserStorage(): StorageLike {
  try {
    const ls = window.localStorage;
    const probe = '__blitzheld_probe__';
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    return ls;
  } catch {
    return memoryStorage();
  }
}

export type Stage = { world: number; kind: 'level'; index: number } | { world: number; kind: 'boss' };

export interface LevelResult {
  coins: number;
  starIds: number[];
  time: number;
}

export class ProgressStore {
  data: SaveData;

  constructor(private readonly storage: StorageLike) {
    this.data = this.load();
  }

  load(): SaveData {
    try {
      const raw = this.storage.getItem(SAVE_KEY);
      return raw ? sanitize(JSON.parse(raw)) : defaultSave();
    } catch {
      return defaultSave();
    }
  }

  save(): void {
    try {
      this.storage.setItem(SAVE_KEY, JSON.stringify(this.data));
    } catch {
      // Speicher voll oder gesperrt – das Spiel läuft trotzdem weiter.
    }
  }

  reset(): void {
    const settings = { ...this.data.settings };
    this.data = defaultSave();
    this.data.settings = settings;
    try {
      this.storage.removeItem(SAVE_KEY);
    } catch {
      /* egal */
    }
    this.save();
  }

  record(id: string): LevelRecord {
    return this.data.levels[id] ?? { completed: false, stars: [], bestCoins: 0, bestTime: 0 };
  }

  isWorldUnlocked(world: number): boolean {
    return world >= 0 && world <= this.data.unlockedWorld;
  }

  isLevelUnlocked(world: number, index: number): boolean {
    if (!this.isWorldUnlocked(world)) return false;
    return index === 0 || this.record(levelId(world, index - 1)).completed;
  }

  isBossUnlocked(world: number): boolean {
    return this.isWorldUnlocked(world) && this.record(levelId(world, LEVELS_PER_WORLD - 1)).completed;
  }

  isBossDefeated(world: number): boolean {
    return this.data.bossesDefeated.includes(world);
  }

  /** Welt-Abzeichen: alle Level der Welt geschafft. */
  hasWorldBadge(world: number): boolean {
    for (let i = 0; i < LEVELS_PER_WORLD; i++) if (!this.record(levelId(world, i)).completed) return false;
    return true;
  }

  starsInWorld(world: number): number {
    let n = 0;
    for (let i = 0; i < LEVELS_PER_WORLD; i++) n += this.record(levelId(world, i)).stars.length;
    return n;
  }

  get totalStars(): number {
    let n = 0;
    for (let w = 0; w < WORLD_COUNT; w++) n += this.starsInWorld(w);
    return n;
  }

  /** Nächste offene Etappe für „Spielen“. */
  nextStage(): Stage {
    for (let w = 0; w <= this.data.unlockedWorld; w++) {
      for (let i = 0; i < LEVELS_PER_WORLD; i++) {
        if (!this.record(levelId(w, i)).completed) return { world: w, kind: 'level', index: i };
      }
      if (!this.isBossDefeated(w)) return { world: w, kind: 'boss' };
    }
    // Alles geschafft: letzte Welt nochmal von vorn.
    return { world: Math.min(WORLD_COUNT - 1, this.data.unlockedWorld), kind: 'level', index: 0 };
  }

  /** Speichert ein geschafftes Level. Gibt zurück, ob es eine neue Bestleistung gab. */
  completeLevel(id: string, result: LevelResult): { newBestCoins: boolean; newBestTime: boolean; newStars: number } {
    const rec = this.record(id);
    const before = rec.stars.length;
    const stars = [...new Set([...rec.stars, ...result.starIds])].sort();
    const newBestCoins = result.coins > rec.bestCoins;
    const newBestTime = rec.bestTime === 0 || result.time < rec.bestTime;
    this.data.levels[id] = {
      completed: true,
      stars,
      bestCoins: Math.max(rec.bestCoins, result.coins),
      bestTime: newBestTime ? Math.round(result.time * 10) / 10 : rec.bestTime,
    };
    this.data.totalCoins += result.coins;
    if (this.data.checkpoint?.levelId === id) this.data.checkpoint = null;
    this.save();
    return { newBestCoins, newBestTime, newStars: stars.length - before };
  }

  defeatBoss(world: number, coins: number): { unlockedWorld: number | null; gameComplete: boolean } {
    let unlocked: number | null = null;
    if (!this.data.bossesDefeated.includes(world)) {
      this.data.bossesDefeated = [...this.data.bossesDefeated, world].sort();
    }
    if (world + 1 < WORLD_COUNT && this.data.unlockedWorld < world + 1) {
      this.data.unlockedWorld = world + 1;
      unlocked = world + 1;
    }
    this.data.totalCoins += coins;
    const gameComplete = world === WORLD_COUNT - 1;
    if (gameComplete) this.data.gameCompleted = true;
    this.save();
    return { unlockedWorld: unlocked, gameComplete };
  }

  setCheckpoint(id: string, index: number): void {
    this.data.checkpoint = { levelId: id, index };
    this.save();
  }

  clearCheckpoint(): void {
    this.data.checkpoint = null;
    this.save();
  }

  /** Gespeicherter Checkpoint für dieses Level (oder −1). */
  checkpointFor(id: string): number {
    return this.data.checkpoint?.levelId === id ? this.data.checkpoint.index : -1;
  }

  setMath(stats: MathStats): void {
    this.data.math = stats;
    this.save();
  }

  updateSettings(patch: Partial<Settings>): void {
    this.data.settings = { ...this.data.settings, ...patch };
    this.save();
  }
}
