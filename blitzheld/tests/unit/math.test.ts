import { describe, expect, it } from 'vitest';
import { createRng } from '../../src/core/rng';
import { generateTask, isValidTask, makeTask, MathTaskGenerator, MAX_NUMBER, taskText } from '../../src/math/mathTasks';
import { DEFAULT_MATH_STATS, MathChallenge, parseAnswer, tierFor, updateStats } from '../../src/math/mathChallenge';

describe('Aufgabengenerator', () => {
  it('erzeugt in allen Stufen nur gültige Aufgaben im Zahlenraum 0 bis 50', () => {
    const rng = createRng(42);
    for (let tier = 1; tier <= 5; tier++) {
      for (let i = 0; i < 4000; i++) {
        const t = generateTask(rng, tier);
        expect(isValidTask(t), `${t.key}`).toBe(true);
        expect(t.a).toBeGreaterThanOrEqual(0);
        expect(t.b).toBeGreaterThanOrEqual(0);
        expect(t.a).toBeLessThanOrEqual(MAX_NUMBER);
        expect(t.b).toBeLessThanOrEqual(MAX_NUMBER);
        expect(t.answer).toBeGreaterThanOrEqual(0);
        expect(t.answer).toBeLessThanOrEqual(MAX_NUMBER);
        if (t.op === '+') expect(t.a + t.b).toBe(t.answer);
        else expect(t.a - t.b).toBe(t.answer);
        expect(['+', '-']).toContain(t.op);
      }
    }
  });

  it('Subtraktionen sind nie negativ, Additionen nie über 50', () => {
    const rng = createRng(7);
    for (let i = 0; i < 20000; i++) {
      const t = generateTask(rng, 1 + (i % 5));
      if (t.op === '-') expect(t.a - t.b).toBeGreaterThanOrEqual(0);
      else expect(t.a + t.b).toBeLessThanOrEqual(50);
    }
  });

  it('Stufen bauen aufeinander auf (Stufe 1 bis 10, Stufe 3 mit Zehnerübergang)', () => {
    const rng = createRng(3);
    for (let i = 0; i < 2000; i++) {
      const t1 = generateTask(rng, 1);
      expect(Math.max(t1.a, t1.b, t1.answer)).toBeLessThanOrEqual(10);
      const t2 = generateTask(rng, 2);
      expect(Math.max(t2.a, t2.b, t2.answer)).toBeLessThanOrEqual(20);
      const t3 = generateTask(rng, 3);
      expect(Math.max(t3.a, t3.b, t3.answer)).toBeLessThanOrEqual(20);
      // Zehnerübergang: Einer passen nicht ohne Übertrag
      if (t3.op === '+') expect((t3.a % 10) + (t3.b % 10)).toBeGreaterThanOrEqual(10);
      else expect(t3.a % 10).toBeLessThan(t3.b % 10);
    }
  });

  it('beide Rechenarten kommen vor', () => {
    const rng = createRng(11);
    const ops = new Set<string>();
    for (let i = 0; i < 50; i++) ops.add(generateTask(rng, 2).op);
    expect(ops).toEqual(new Set(['+', '-']));
  });

  it('wiederholt keine Aufgabe direkt hintereinander und keine innerhalb eines Satzes', () => {
    const gen = new MathTaskGenerator(createRng(5));
    let prev = '';
    for (let i = 0; i < 300; i++) {
      const set = gen.nextSet(3, 1 + (i % 5));
      expect(new Set(set.map((t) => t.key)).size).toBe(3);
      expect(set[0].key).not.toBe(prev);
      prev = set[2].key;
    }
  });

  it('die erste Aufgabe eines Satzes ist eine Stufe leichter', () => {
    const gen = new MathTaskGenerator(createRng(9));
    const set = gen.nextSet(3, 4);
    expect(set[0].tier).toBe(3);
    expect(set[1].tier).toBe(4);
  });

  it('zeigt Minus als echtes Minuszeichen', () => {
    expect(taskText(makeTask(17, 8, '-', 3))).toBe('17 − 8');
    expect(taskText(makeTask(7, 5, '+', 3))).toBe('7 + 5');
  });
});

describe('Mathefenster (MathChallenge)', () => {
  const tasks = [makeTask(7, 5, '+', 3), makeTask(18, 9, '-', 3), makeTask(16, 8, '+', 3)];

  it('verlangt genau drei richtige Antworten', () => {
    const c = new MathChallenge(tasks);
    expect(c.total).toBe(3);
    expect(c.submit('12')).toBe('correct');
    expect(c.advance()).toBe(false);
    expect(c.submit('9')).toBe('correct');
    expect(c.advance()).toBe(false);
    expect(c.isComplete).toBe(false);
    expect(c.submit('24')).toBe('correct');
    expect(c.advance()).toBe(true);
    expect(c.isComplete).toBe(true);
  });

  it('falsche Antworten werden nicht akzeptiert, die Aufgabe bleibt bestehen', () => {
    const c = new MathChallenge(tasks);
    expect(c.submit('13')).toBe('wrong');
    expect(c.submit('11')).toBe('wrong');
    expect(c.current.key).toBe('7+5');
    expect(c.index).toBe(0);
    expect(c.solved).toBe(0);
    expect(c.wrongAttempts[0]).toBe(2);
    expect(c.submit('12')).toBe('correct');
  });

  it('falsche Antworten setzen gelöste Aufgaben nicht zurück', () => {
    const c = new MathChallenge(tasks);
    c.submit('12');
    c.advance();
    for (let i = 0; i < 20; i++) expect(c.submit('0')).toBe('wrong');
    expect(c.solved).toBe(1);
    expect(c.current.key).toBe('18-9');
  });

  it('Doppelklick/Enter nach einer richtigen Antwort überspringt keine Aufgabe', () => {
    const c = new MathChallenge(tasks);
    expect(c.submit('12')).toBe('correct');
    expect(c.submit('12')).toBe('locked');
    expect(c.submit('9')).toBe('locked');
    expect(c.solved).toBe(1);
    c.advance();
    c.advance(); // doppeltes advance ohne neue Antwort bewirkt nichts
    expect(c.index).toBe(1);
    expect(c.current.key).toBe('18-9');
  });

  it('nach dem Ende werden keine Antworten mehr gezählt', () => {
    const c = new MathChallenge(tasks);
    for (const a of ['12', '9', '24']) {
      c.submit(a);
      c.advance();
    }
    expect(c.submit('24')).toBe('done');
    expect(c.solved).toBe(3);
  });

  it('nimmt nur ganze Zahlen von 0 bis 50 an', () => {
    expect(parseAnswer('0')).toBe(0);
    expect(parseAnswer('50')).toBe(50);
    expect(parseAnswer(' 7 ')).toBe(7);
    expect(parseAnswer('51')).toBeNull();
    expect(parseAnswer('-3')).toBeNull();
    expect(parseAnswer('3.5')).toBeNull();
    expect(parseAnswer('')).toBeNull();
    expect(parseAnswer('abc')).toBeNull();
    expect(parseAnswer('123')).toBeNull();
    const c = new MathChallenge(tasks);
    expect(c.submit('')).toBe('invalid');
    expect(c.submit('x')).toBe('invalid');
    expect(c.wrongAttempts[0]).toBe(0);
  });

  it('beginnt mit leichten Aufgaben und passt die Stufe langsam an', () => {
    expect(tierFor(3, DEFAULT_MATH_STATS, 0)).toBe(1);
    expect(tierFor(0, DEFAULT_MATH_STATS, 10)).toBe(1);
    expect(tierFor(1, DEFAULT_MATH_STATS, 10)).toBe(2);
    expect(tierFor(3, DEFAULT_MATH_STATS, 10)).toBe(4);
    // Zweimal alles auf Anhieb richtig → eine Stufe schwerer
    let stats = { ...DEFAULT_MATH_STATS, recent: [] as boolean[] };
    for (let r = 0; r < 2; r++) {
      const c = new MathChallenge(tasks);
      for (const a of ['12', '9', '24']) {
        c.submit(a);
        c.advance();
      }
      stats = updateStats(stats, c);
    }
    expect(stats.offset).toBe(1);
    expect(tierFor(1, stats, 10)).toBe(3);
    // Viele Fehler → eine Stufe leichter
    const hard = new MathChallenge(tasks);
    for (const [wrong, right] of [
      ['1', '12'],
      ['1', '9'],
      ['1', '24'],
    ]) {
      hard.submit(wrong);
      hard.submit(wrong);
      hard.submit(right);
      hard.advance();
    }
    stats = updateStats(stats, hard);
    expect(stats.offset).toBe(0);
  });
});
