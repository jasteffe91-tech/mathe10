import { describe, expect, it } from 'vitest';
import { allLevels } from '../../src/levels/catalog';
import { solveLevel } from '../../src/game/solver';
import { overlaps, circleHitsRect } from '../../src/game/collision';
import { COLLECT, PHYSICS } from '../../src/config/gameConfig';
import type { LevelDef } from '../../src/game/types';

const levels = allLevels();
/** Geforderte Fehlertoleranz beim Absprung (Sekunden). */
const TOLERANCE = 0.2;

function groundAt(lv: LevelDef, x: number): number | null {
  let best: number | null = null;
  for (const s of lv.solids) {
    if ((s.kind === 'ground' || s.kind === 'cloud') && !s.move && x >= s.x && x <= s.x + s.w) {
      if (best === null || s.y < best) best = s.y;
    }
  }
  return best;
}

describe('Levelaufbau', () => {
  it('es gibt 4 Welten mit je 3 Leveln', () => {
    expect(levels.length).toBe(12);
    for (let w = 0; w < 4; w++) expect(levels.filter((l) => l.world === w).length).toBe(3);
    expect(new Set(levels.map((l) => l.theme)).size).toBe(4);
  });

  it.each(levels.map((l) => [l.id, l] as const))('%s: kurz genug, mit Checkpoints und drei Sternen', (_id, lv) => {
    const seconds = (lv.goalX - lv.start.x) / lv.speed;
    expect(seconds).toBeLessThan(60);
    expect(lv.checkpoints.length).toBeGreaterThanOrEqual(2);
    expect(lv.stars.length).toBe(3);
    expect(lv.coins.length).toBeGreaterThan(30);
  });

  it.each(levels.map((l) => [l.id, l] as const))('%s: Start und Checkpoints haben freien Anlauf', (_id, lv) => {
    const spots = [lv.start.x, ...lv.checkpoints.map((c) => c.x)];
    for (const x of spots) {
      const runway = { x: x - 20, y: -1000, w: 380, h: 3000 };
      for (const h of lv.hazards) expect(overlaps(runway, h), `Hindernis bei ${h.x} nach ${x}`).toBe(false);
      for (const f of lv.fires) expect(overlaps(runway, { x: f.x, y: 0, w: f.w, h: 1000 })).toBe(false);
      for (const e of lv.enemies) expect(e.x < x - 20 - (e.w + 10) || e.x - (e.patrol?.dx ?? 0) > x + 360).toBe(true);
      // Durchgehender Boden ohne Graben
      for (let px = x; px <= x + 360; px += 10) expect(groundAt(lv, px), `Graben bei ${px}`).not.toBeNull();
    }
  });

  it.each(levels.map((l) => [l.id, l] as const))('%s: keine unsichtbaren oder schwebenden Hindernisse', (_id, lv) => {
    for (const h of lv.hazards) {
      const standsOn = lv.solids.some((s) => Math.abs(s.y - (h.y + h.h)) < 0.5 && h.x + h.w > s.x && h.x < s.x + s.w);
      expect(standsOn, `${h.kind} bei ${h.x}`).toBe(true);
      expect(h.w).toBeGreaterThan(10);
      expect(h.h).toBeGreaterThan(10);
    }
  });

  it.each(levels.map((l) => [l.id, l] as const))('%s: Münzen liegen nicht in Hindernissen', (_id, lv) => {
    for (const c of lv.coins) {
      for (const h of lv.hazards) expect(circleHitsRect(c.x, c.y, COLLECT.coinRadius - 6, h), `Münze ${c.id}`).toBe(false);
    }
  });

  it.each(levels.map((l) => [l.id, l] as const))('%s: Sterne sind erreichbar hoch', (_id, lv) => {
    // Höchster Sprung ~185 px + Kopf (46 px) + Sammelradius; Federn schleudern höher.
    const reach = 185 + 46 + COLLECT.starRadius;
    const springReach = (PHYSICS.springVelocity * PHYSICS.springVelocity) / (2 * PHYSICS.gravity) + 46 + COLLECT.starRadius;
    for (const st of lv.stars) {
      const fromSolid = lv.solids.some((s) => st.x > s.x - 120 && st.x < s.x + s.w + 120 + (s.move?.dx ?? 0) && s.y + (s.move?.dy ?? 0) - st.y <= reach && s.y - st.y >= -20);
      const fromSpring = lv.springs.some((sp) => st.x > sp.x - 50 && st.x < sp.x + 320 && sp.y - st.y <= springReach);
      expect(fromSolid || fromSpring, `Stern ${st.id} bei ${st.x}`).toBe(true);
    }
  });
});

describe('Schaffbarkeit (automatischer Löser)', () => {
  it.each(levels.map((l) => [l.id, l] as const))(`%s: vom Start aus mit ${TOLERANCE * 1000} ms Toleranz lösbar`, (_id, lv) => {
    const r = solveLevel(lv, { minWindow: TOLERANCE });
    expect(r.solved, `kam nur bis x=${Math.round(r.furthest)}`).toBe(true);
  });

  it.each(levels.map((l) => [l.id, l] as const))('%s: von jedem Checkpoint und zu verschiedenen Zeiten lösbar', (_id, lv) => {
    const starts: { checkpoint?: number; startTime: number }[] = [{ startTime: 0.9 }];
    lv.checkpoints.forEach((_, c) => {
      for (const t of [7, 11.3]) starts.push({ checkpoint: c, startTime: t });
    });
    for (const s of starts) {
      const r = solveLevel(lv, { ...s, minWindow: TOLERANCE });
      expect(r.solved, `Start ${JSON.stringify(s)}: nur bis x=${Math.round(r.furthest)}`).toBe(true);
    }
  });
});
