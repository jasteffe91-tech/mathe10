import { randInt, type Rng } from '../core/rng';

/**
 * Plus- und Minusaufgaben für die 2. Klasse im Zahlenraum 0 bis 50.
 * Keine negativen Ergebnisse, keine Summe über 50, keine anderen Rechenarten.
 */

export const MAX_NUMBER = 50;

export type Op = '+' | '-';

export interface MathTask {
  a: number;
  b: number;
  op: Op;
  answer: number;
  /** Schwierigkeitsstufe 1–5. */
  tier: number;
  /** Eindeutiger Schlüssel, z. B. "17-8". */
  key: string;
}

export const MIN_TIER = 1;
export const MAX_TIER = 5;

/** Kurze Beschreibung der Stufen (für README und Tests). */
export const TIER_INFO: Record<number, string> = {
  1: 'bis 10',
  2: 'bis 20 ohne Zehnerübergang',
  3: 'bis 20 mit Zehnerübergang',
  4: 'bis 50 ohne Zehnerübergang',
  5: 'bis 50 mit Zehnerübergang',
};

export function makeTask(a: number, b: number, op: Op, tier: number): MathTask {
  const answer = op === '+' ? a + b : a - b;
  return { a, b, op, answer, tier, key: `${a}${op}${b}` };
}

export function isValidTask(t: MathTask): boolean {
  const ints = [t.a, t.b, t.answer].every((n) => Number.isInteger(n) && n >= 0 && n <= MAX_NUMBER);
  if (!ints) return false;
  if (t.op === '+') return t.a + t.b === t.answer && t.answer <= MAX_NUMBER;
  return t.a - t.b === t.answer && t.answer >= 0;
}

export function taskText(t: MathTask): string {
  return `${t.a} ${t.op === '+' ? '+' : '−'} ${t.b}`;
}

/** Erzeugt eine Aufgabe der gewünschten Stufe. */
export function generateTask(rng: Rng, tier: number): MathTask {
  const level = Math.max(MIN_TIER, Math.min(MAX_TIER, Math.round(tier)));
  const plus = rng() < 0.5;
  switch (level) {
    case 1: {
      if (plus) {
        const a = randInt(rng, 1, 8);
        const b = randInt(rng, 1, 10 - a);
        return makeTask(a, b, '+', 1);
      }
      const a = randInt(rng, 3, 10);
      const b = randInt(rng, 1, a - 1);
      return makeTask(a, b, '-', 1);
    }
    case 2: {
      // Bis 20 ohne Zehnerübergang: 13 + 4, 17 − 5, gelegentlich 10 + 7 oder 18 − 8.
      if (plus) {
        const ones = randInt(rng, 0, 8);
        const a = 10 + ones;
        const b = randInt(rng, 1, 9 - ones);
        return rng() < 0.5 ? makeTask(a, b, '+', 2) : makeTask(b, a, '+', 2);
      }
      const ones = randInt(rng, 1, 9);
      const a = 10 + ones;
      const b = randInt(rng, 1, ones);
      return makeTask(a, b, '-', 2);
    }
    case 3: {
      // Bis 20 mit Zehnerübergang: 7 + 5, 13 − 6.
      if (plus) {
        const a = randInt(rng, 3, 9);
        const b = randInt(rng, 11 - a, 9);
        return makeTask(a, b, '+', 3);
      }
      const a = randInt(rng, 11, 18);
      const b = randInt(rng, a - 9, 9);
      return makeTask(a, b, '-', 3);
    }
    case 4: {
      // Bis 50 ohne Zehnerübergang: 24 + 5, 36 − 4, 30 + 10, 40 − 20.
      if (rng() < 0.25) {
        if (plus) {
          const a = randInt(rng, 1, 4) * 10;
          const b = randInt(rng, 1, 5 - a / 10) * 10;
          return makeTask(a, b, '+', 4);
        }
        const a = randInt(rng, 2, 5) * 10;
        const b = randInt(rng, 1, a / 10 - 1) * 10;
        return makeTask(a, b, '-', 4);
      }
      if (plus) {
        const tens = randInt(rng, 2, 4) * 10;
        const ones = randInt(rng, 0, 8);
        const b = randInt(rng, 1, 9 - ones);
        return makeTask(tens + ones, b, '+', 4);
      }
      const tens = randInt(rng, 2, 4) * 10;
      const ones = randInt(rng, 1, 9);
      const b = randInt(rng, 1, ones);
      return makeTask(tens + ones, b, '-', 4);
    }
    default: {
      // Bis 50 mit Zehnerübergang: 27 + 8, 41 − 7, 30 − 12, 16 + 18.
      const variant = rng();
      if (plus) {
        if (variant < 0.7) {
          const tens = randInt(rng, 1, 3) * 10;
          const ones = randInt(rng, 2, 9);
          const b = randInt(rng, 11 - ones, 9);
          return makeTask(tens + ones, b, '+', 5);
        }
        const a = randInt(rng, 12, 29);
        const b = randInt(rng, 11, Math.min(19, MAX_NUMBER - a));
        return makeTask(a, b, '+', 5);
      }
      if (variant < 0.7) {
        const tens = randInt(rng, 2, 5) * 10;
        const ones = tens === 50 ? 0 : randInt(rng, 0, 7);
        const b = randInt(rng, ones + 2, 9);
        return makeTask(tens + ones, b, '-', 5);
      }
      const a = randInt(rng, 3, 5) * 10;
      const b = randInt(rng, 11, 19);
      return makeTask(a, b, '-', 5);
    }
  }
}

/**
 * Liefert Aufgaben ohne direkte Wiederholungen: Eine Aufgabe, die unter den letzten
 * historySize Aufgaben vorkam, wird nicht noch einmal gestellt.
 */
export class MathTaskGenerator {
  private readonly history: string[] = [];

  constructor(
    private readonly rng: Rng,
    private readonly historySize = 12,
  ) {}

  next(tier: number): MathTask {
    let task = generateTask(this.rng, tier);
    for (let tries = 0; tries < 60 && this.history.includes(task.key); tries++) {
      task = generateTask(this.rng, tier);
    }
    this.history.push(task.key);
    if (this.history.length > this.historySize) this.history.shift();
    return task;
  }

  /** count verschiedene Aufgaben; die erste ist zum Aufwärmen eine Stufe leichter. */
  nextSet(count: number, tier: number): MathTask[] {
    const tasks: MathTask[] = [];
    for (let i = 0; i < count; i++) {
      const t = i === 0 ? Math.max(MIN_TIER, tier - 1) : tier;
      tasks.push(this.next(t));
    }
    return tasks;
  }

  get recentKeys(): readonly string[] {
    return this.history;
  }
}
