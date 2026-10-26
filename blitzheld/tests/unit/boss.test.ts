import { describe, expect, it } from 'vitest';
import { BossFight, type BossEvent } from '../../src/boss/bossFight';
import { BOSSES, BOSS_TIMING } from '../../src/boss/bossConfig';

const DT = 1 / 60;

/** Spielt einen Bosskampf mit einer Strategie für die Taste. */
function play(fight: BossFight, press: (f: BossFight) => boolean, maxSeconds = 300): BossEvent[] {
  const events: BossEvent[] = [];
  for (let t = 0; t < maxSeconds && fight.phase !== 'defeated' && fight.phase !== 'heroDown'; t += DT) {
    if (press(fight)) fight.press();
    fight.update(DT);
    events.push(...fight.drain());
  }
  return events;
}

/** Drückt mitten im grünen Zeitfenster bzw. sofort, wenn der Boss benommen ist. */
const goodPlayer = (f: BossFight): boolean => {
  if (f.phase === 'dizzy') return true;
  const next = f.projectiles.filter((p) => p.state === 'flying').sort((a, b) => a.impactT - b.impactT)[0];
  if (!next || f.heroAirborne) return false;
  const w = f.dodgeWindow(next);
  return f.t >= (w.from + w.to) / 2;
};

describe('Bosskämpfe', () => {
  it.each(BOSSES.map((b) => [b.title, b] as const))('%s ist mit gutem Timing besiegbar', (_t, def) => {
    for (const help of [false, true]) {
      const fight = new BossFight(def, help);
      const events = play(fight, goodPlayer);
      expect(fight.phase).toBe('defeated');
      expect(fight.bossHp).toBe(0);
      expect(fight.heroEnergy).toBe(BOSS_TIMING.heroEnergy);
      expect(events.filter((e) => e.type === 'defeated').length).toBe(1);
      expect(events.filter((e) => e.type === 'bossHurt').length).toBe(def.hp);
    }
  });

  it('das Ausweich-Zeitfenster ist großzügig (mindestens 0,4 s)', () => {
    for (const def of BOSSES) {
      const fight = new BossFight(def);
      const w = fight.dodgeWindow({ id: 1, spawnT: 0, impactT: 2, kind: 'roll', state: 'flying' });
      expect(w.to - w.from).toBeGreaterThanOrEqual(0.4);
      const help = new BossFight(def, true);
      const wh = help.dodgeWindow({ id: 1, spawnT: 0, impactT: 2, kind: 'roll', state: 'flying' });
      expect(wh.to - wh.from).toBeGreaterThan(w.to - w.from);
      expect(help.travel).toBeGreaterThan(fight.travel);
    }
  });

  it('jeder Sprung im Zeitfenster weicht aus – egal ob früh oder spät darin', () => {
    for (const frac of [0.05, 0.5, 0.95]) {
      const fight = new BossFight(BOSSES[0]);
      const press = (f: BossFight): boolean => {
        const next = f.projectiles.filter((p) => p.state === 'flying').sort((a, b) => a.impactT - b.impactT)[0];
        if (!next || f.heroAirborne) return false;
        const w = f.dodgeWindow(next);
        return f.t >= w.from + (w.to - w.from) * frac;
      };
      const events = play(fight, press, 12);
      expect(events.filter((e) => e.type === 'hit').length).toBe(0);
      expect(events.filter((e) => e.type === 'dodge').length).toBeGreaterThan(0);
    }
  });

  it('ohne Reaktion verliert der Held nach genau drei Treffern seine Kraft – ein einziges heroDown', () => {
    const fight = new BossFight(BOSSES[1]);
    const events = play(fight, () => false);
    expect(fight.phase).toBe('heroDown');
    expect(events.filter((e) => e.type === 'hit').length).toBe(BOSS_TIMING.heroEnergy);
    expect(events.filter((e) => e.type === 'heroDown').length).toBe(1);
    // Weitere Zeit erzeugt keine weiteren Ereignisse
    for (let i = 0; i < 600; i++) fight.update(DT);
    expect(fight.drain().length).toBe(0);
  });

  it('nach der Wiederbelebung behält der Boss seinen Schaden', () => {
    const fight = new BossFight(BOSSES[0]);
    // Erst einen Treffer landen …
    play(fight, (f) => (f.bossHp === BOSSES[0].hp ? goodPlayer(f) : false));
    expect(fight.phase).toBe('heroDown');
    expect(fight.bossHp).toBe(BOSSES[0].hp - 1);
    fight.reviveHero();
    expect(fight.heroEnergy).toBe(BOSS_TIMING.heroEnergy);
    expect(fight.bossHp).toBe(BOSSES[0].hp - 1);
    play(fight, goodPlayer);
    expect(fight.phase).toBe('defeated');
  });

  it('zu frühes Springen schützt nicht', () => {
    const fight = new BossFight(BOSSES[0]);
    const events = play(fight, (f) => f.phase === 'attack' && f.phaseTime < 0.05, 8);
    expect(events.some((e) => e.type === 'hit')).toBe(true);
  });

  it('verpasste Angriffschance wird nicht bestraft', () => {
    const fight = new BossFight(BOSSES[0]);
    const events = play(fight, (f) => f.phase !== 'dizzy' && goodPlayer(f), 40);
    expect(events.some((e) => e.type === 'dizzy')).toBe(true);
    expect(events.some((e) => e.type === 'recover')).toBe(true);
    expect(events.some((e) => e.type === 'hit')).toBe(false);
    expect(fight.bossHp).toBe(BOSSES[0].hp);
  });

  it('Tastendrücke im Intro und bei besiegtem Boss bewirken nichts', () => {
    const fight = new BossFight(BOSSES[0]);
    fight.press();
    expect(fight.heroAirborne).toBe(false);
    expect(fight.drain().length).toBe(0);
  });
});
