import { MAX_NUMBER, MAX_TIER, MIN_TIER, type MathTask } from './mathTasks';

/**
 * Ablauf eines Mathefensters nach einem Tod: genau `tasks.length` (normalerweise 3)
 * Aufgaben müssen richtig gelöst werden.
 *
 * - Falsche Antworten sind unbegrenzt erlaubt, die Aufgabe bleibt stehen.
 * - Nach einer richtigen Antwort ist die Eingabe gesperrt, bis advance() aufgerufen wird.
 *   Dadurch können Doppelklicks oder ein mehrfach ausgelöstes Enter keine Aufgabe überspringen.
 */

export type SubmitResult = 'correct' | 'wrong' | 'invalid' | 'locked' | 'done';

export function parseAnswer(raw: string | number): number | null {
  const s = String(raw).trim();
  if (!/^\d{1,2}$/.test(s)) return null;
  const n = Number(s);
  return n >= 0 && n <= MAX_NUMBER ? n : null;
}

export class MathChallenge {
  readonly tasks: readonly MathTask[];
  private idx = 0;
  private solvedCount = 0;
  private waitingForAdvance = false;
  /** Fehlversuche je Aufgabe. */
  readonly wrongAttempts: number[];

  constructor(tasks: readonly MathTask[]) {
    if (tasks.length === 0) throw new Error('MathChallenge braucht mindestens eine Aufgabe');
    this.tasks = tasks;
    this.wrongAttempts = tasks.map(() => 0);
  }

  get index(): number {
    return this.idx;
  }

  get solved(): number {
    return this.solvedCount;
  }

  get total(): number {
    return this.tasks.length;
  }

  get current(): MathTask {
    return this.tasks[Math.min(this.idx, this.tasks.length - 1)];
  }

  get isComplete(): boolean {
    return this.solvedCount >= this.tasks.length;
  }

  /** true, solange nach einer richtigen Antwort die Rückmeldung läuft. */
  get isLocked(): boolean {
    return this.waitingForAdvance;
  }

  submit(raw: string | number): SubmitResult {
    if (this.isComplete && !this.waitingForAdvance) return 'done';
    if (this.waitingForAdvance) return 'locked';
    const value = parseAnswer(raw);
    if (value === null) return 'invalid';
    if (value === this.current.answer) {
      this.solvedCount++;
      this.waitingForAdvance = true;
      return 'correct';
    }
    this.wrongAttempts[this.idx]++;
    return 'wrong';
  }

  /** Nach der Rückmeldung zur nächsten Aufgabe. Gibt true zurück, wenn alle gelöst sind. */
  advance(): boolean {
    if (!this.waitingForAdvance) return this.isComplete;
    this.waitingForAdvance = false;
    if (this.idx < this.tasks.length - 1) this.idx++;
    return this.isComplete;
  }
}

/** Lernstand für die Anpassung der Schwierigkeit (wird lokal gespeichert). */
export interface MathStats {
  /** Verschiebung gegenüber der Grundstufe der Welt (−2 … +1). */
  offset: number;
  /** Die letzten Ergebnisse: true = beim ersten Versuch richtig. */
  recent: boolean[];
  totalSolved: number;
  totalFirstTry: number;
}

export const DEFAULT_MATH_STATS: MathStats = { offset: 0, recent: [], totalSolved: 0, totalFirstTry: 0 };

/** Grundstufe je Welt: Welt 1 bis 10, Welt 2 bis 20, Welt 3 mit Zehnerübergang, Welt 4 bis 50. */
export const WORLD_BASE_TIER = [1, 2, 3, 4] as const;

export function tierFor(world: number, stats: MathStats, everSolved: number): number {
  // Ganz am Anfang immer mit leichten Aufgaben beginnen.
  if (everSolved < 3) return MIN_TIER;
  const base = WORLD_BASE_TIER[Math.max(0, Math.min(WORLD_BASE_TIER.length - 1, world))];
  return Math.max(MIN_TIER, Math.min(MAX_TIER, base + stats.offset));
}

/** Aktualisiert den Lernstand nach einem abgeschlossenen Mathefenster. */
export function updateStats(stats: MathStats, challenge: MathChallenge): MathStats {
  const recent = [...stats.recent, ...challenge.wrongAttempts.map((w) => w === 0)].slice(-9);
  const firstTry = challenge.wrongAttempts.filter((w) => w === 0).length;
  let offset = stats.offset;
  const last6 = recent.slice(-6);
  if (last6.length === 6 && last6.every(Boolean) && offset < 1) {
    offset++;
    recent.length = 0;
  } else if (challenge.wrongAttempts.filter((w) => w >= 2).length >= 2 && offset > -2) {
    offset--;
    recent.length = 0;
  }
  return {
    offset,
    recent,
    totalSolved: stats.totalSolved + challenge.total,
    totalFirstTry: stats.totalFirstTry + firstTry,
  };
}
