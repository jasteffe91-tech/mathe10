import { describe, expect, it } from 'vitest';
import { LevelBuilder } from '../../src/game/levelBuilder';
import { LevelSimulation, type SimEvent, type SimInput } from '../../src/game/levelSim';
import { computeAssist, NORMAL_ASSIST } from '../../src/config/difficulty';
import { PHYSICS, SIM_DT, TIMING } from '../../src/config/gameConfig';
import type { LevelDef } from '../../src/game/types';

const NONE: SimInput = { pressed: false, held: false };

function build(fn: (b: LevelBuilder) => void, speed = 220): LevelDef {
  const b = new LevelBuilder({ id: 't', world: 0, index: 0, name: 'Test', theme: 'meadow', speed });
  fn(b);
  return b.goal();
}

/** Simuliert bis zur Bedingung; sammelt alle Ereignisse. */
function runUntil(sim: LevelSimulation, cond: () => boolean, input: (i: number) => SimInput = () => NONE, max = 6000): SimEvent[] {
  const events: SimEvent[] = [];
  for (let i = 0; i < max && !cond(); i++) {
    sim.step(input(i));
    events.push(...sim.drain());
  }
  return events;
}

describe('Bewegung und Sprung', () => {
  it('der Held läuft automatisch nach vorne', () => {
    const sim = new LevelSimulation(build((b) => b.run(2000)));
    const x0 = sim.player.x;
    runUntil(sim, () => sim.t >= 1);
    expect(sim.player.x - x0).toBeCloseTo(220, -1);
    expect(sim.player.grounded).toBe(true);
  });

  it('ein Tastendruck löst einen Sprung aus', () => {
    const sim = new LevelSimulation(build((b) => b.run(2000)));
    sim.step(NONE);
    const ev = runUntil(sim, () => sim.player.vy < 0, (i) => ({ pressed: i === 0, held: true }), 3);
    expect(ev.some((e) => e.type === 'jump')).toBe(true);
    expect(sim.player.grounded).toBe(false);
  });

  it('kurzer Tipp springt niedriger als gehaltene Taste', () => {
    const height = (hold: number): number => {
      const sim = new LevelSimulation(build((b) => b.run(3000)));
      sim.step(NONE);
      const y0 = sim.player.y;
      let min = y0;
      let i = 0;
      do {
        sim.step({ pressed: i === 0, held: i * SIM_DT < hold });
        min = Math.min(min, sim.player.y);
        i++;
      } while (!sim.player.grounded && i < 500);
      return y0 - min;
    };
    const tap = height(0);
    const full = height(1);
    expect(tap).toBeGreaterThan(90);
    expect(full).toBeGreaterThan(tap + 60);
  });

  it('Sprungpuffer: ein Druck kurz vor der Landung wird ausgeführt', () => {
    const sim = new LevelSimulation(build((b) => b.run(3000)));
    sim.step({ pressed: true, held: false });
    // fallen lassen, bis der Held kurz vor dem Boden ist
    runUntil(sim, () => sim.player.vy > 0 && sim.player.y > 430 - 25);
    expect(sim.player.grounded).toBe(false);
    const ev = runUntil(sim, () => sim.player.vy < 0 && sim.player.grounded === false && sim.player.y < 425, (i) => ({ pressed: i === 0, held: false }), 40);
    expect(ev.filter((e) => e.type === 'jump').length).toBe(1);
  });

  it('Coyote-Zeit: kurz nach der Kante darf noch gesprungen werden', () => {
    const lv = build((b) => b.run(400).gap(300).run(800));
    const sim = new LevelSimulation(lv);
    runUntil(sim, () => !sim.player.grounded);
    expect(sim.player.coyote).toBeGreaterThan(0);
    sim.step(NONE);
    sim.step(NONE);
    const ev = runUntil(sim, () => sim.player.vy < 0, (i) => ({ pressed: i === 0, held: true }), 2);
    expect(ev.some((e) => e.type === 'jump')).toBe(true);
  });

  it('kleine Stufen läuft der Held ohne Sprung hinauf, hohe Stufen halten ihn an', () => {
    const small = new LevelSimulation(build((b) => b.run(400).stepTo(-16).run(800)));
    runUntil(small, () => small.player.x > 700);
    expect(small.player.y).toBe(414);
    const high = new LevelSimulation(build((b) => b.run(400).stepTo(-60).run(800)));
    runUntil(high, () => high.t > 3);
    expect(high.player.blocked).toBe(true);
    expect(high.status).toBe('running');
    // Springen löst die Blockade
    runUntil(high, () => high.player.y < 371 && high.player.grounded, (i) => ({ pressed: i === 0, held: i < 40 }), 300);
    expect(high.player.y).toBe(370);
  });
});

describe('Hindernisse, Gräben und Tod', () => {
  it('mit rechtzeitigem Sprung über ein Hindernis', () => {
    const lv = build((b) => b.run(700).hazard('stump', 600));
    const sim = new LevelSimulation(lv);
    const stumpX = lv.hazards[0].x;
    runUntil(sim, () => sim.player.x >= stumpX - 110);
    runUntil(sim, () => sim.status !== 'running', (i) => ({ pressed: i === 0, held: i < 20 }));
    expect(sim.status).toBe('complete');
    expect(sim.deaths).toBe(0);
  });

  it('ohne Sprung führt ein Hindernis zu genau einem Todesereignis', () => {
    const lv = build((b) => b.run(700).hazard('stone', 600));
    const sim = new LevelSimulation(lv);
    const ev = runUntil(sim, () => sim.status !== 'running');
    expect(sim.status).toBe('dead');
    expect(sim.lastDeath).toBe('hit');
    // Weitere Schritte erzeugen keine weiteren Ereignisse
    for (let i = 0; i < 200; i++) sim.step(NONE);
    ev.push(...sim.drain());
    expect(ev.filter((e) => e.type === 'death').length).toBe(1);
    expect(sim.deaths).toBe(1);
  });

  it('ein Sturz in einen Graben ist ein Tod', () => {
    const lv = build((b) => b.run(600).gap(200).run(600));
    const sim = new LevelSimulation(lv);
    const ev = runUntil(sim, () => sim.status !== 'running');
    expect(sim.status).toBe('dead');
    expect(ev.find((e) => e.type === 'death')).toMatchObject({ cause: 'fall' });
  });

  it('ein Graben ist mit Sprung zu überwinden', () => {
    const lv = build((b) => b.run(600).gap(130).run(600));
    const sim = new LevelSimulation(lv);
    const edge = lv.solids[0].x + lv.solids[0].w;
    runUntil(sim, () => sim.player.x >= edge - 30);
    runUntil(sim, () => sim.status !== 'running', (i) => ({ pressed: i === 0, held: i < 30 }));
    expect(sim.status).toBe('complete');
  });

  it('Kollisionsbox ist kleiner als die Grafik: knapp an der Kante vorbei ist kein Treffer', () => {
    const lv = build((b) => b.run(700).hazard('stone', 500));
    const sim = new LevelSimulation(lv);
    const stone = lv.hazards[0];
    // Held so absetzen, dass sich die Grafiken (Held ~23 px halbe Breite) berühren würden, die Boxen aber nicht.
    sim.player.x = stone.x - 14 - 1;
    sim.step(NONE);
    expect(sim.status === 'dead' && sim.player.x < stone.x - 16).toBe(false);
  });

  it('auf Gegner hüpfen besiegt sie, seitlich hineinlaufen ist ein Treffer', () => {
    const lv = build((b) => b.run(700).walker('snail').run(800));
    const stomp = new LevelSimulation(lv);
    const ex = lv.enemies[0].x;
    runUntil(stomp, () => stomp.player.x >= ex - 150);
    const ev = runUntil(stomp, () => stomp.status !== 'running', (i) => ({ pressed: i === 0, held: i < 10 }));
    expect(ev.some((e) => e.type === 'stomp') || stomp.status === 'complete').toBe(true);
    expect(stomp.status).toBe('complete');
    const hit = new LevelSimulation(lv);
    runUntil(hit, () => hit.status !== 'running');
    expect(hit.status).toBe('dead');
  });

  it('Feuerfontäne: Warnphase ist harmlos, aktive Phase nicht', () => {
    const lv = build((b) => b.run(700).fire({ period: 4, warn: 1, active: 1, offset: 0 }, 600));
    const sim = new LevelSimulation(lv);
    const f = lv.fires[0];
    // Held mitten in die Düse setzen, während sie warnt
    sim.t = 0.2;
    sim.player.x = f.x + f.w / 2;
    sim.step(NONE);
    expect(sim.firePhase(0).phase).toBe('warn');
    expect(sim.status).toBe('running');
    sim.t = 1.4;
    sim.player.x = f.x + f.w / 2;
    sim.step(NONE);
    expect(sim.status).toBe('dead');
  });

  it('Sprungfeder schleudert hoch', () => {
    const lv = build((b) => b.run(700).spring(10).gap(150).run(600));
    const sim = new LevelSimulation(lv);
    const ev = runUntil(sim, () => sim.status !== 'running');
    expect(ev.some((e) => e.type === 'spring')).toBe(true);
    expect(sim.status).toBe('complete');
  });

  it('bewegliche Plattform nimmt den Helden mit', () => {
    const lv = build((b) => b.run(600).mover(0, 0, 700, 0, -60, 4).gap(700).run(600));
    const sim = new LevelSimulation(lv);
    const mover = lv.solids.findIndex((s) => s.kind === 'mover');
    // Held auf die Plattform setzen, solange sie unten ist
    sim.player.x = lv.solids[mover].x + 20;
    sim.player.y = 430;
    sim.step(NONE);
    expect(sim.player.groundId).toBe(mover);
    runUntil(sim, () => sim.t >= 1.5);
    // Die Plattform ist inzwischen gestiegen – der Held steht weiter darauf.
    expect(sim.player.groundId).toBe(mover);
    expect(sim.player.y).toBeLessThan(430 - 25);
    expect(sim.player.y).toBeCloseTo(sim.solidRect(mover).y, 5);
    expect(sim.status).toBe('running');
  });
});

describe('Checkpoints und Wiederbelebung', () => {
  const lv = build((b) => b.run(800).checkpoint(500).hazard('stump', 500).run(400));

  it('Checkpoints werden beim Überlaufen aktiviert', () => {
    const sim = new LevelSimulation(lv);
    const ev = runUntil(sim, () => sim.status !== 'running');
    expect(ev.filter((e) => e.type === 'checkpoint').length).toBe(1);
    expect(sim.checkpointIndex).toBe(0);
  });

  it('nach dem Tod erscheint der Held am Checkpoint, unverwundbar und sicher', () => {
    const sim = new LevelSimulation(lv);
    runUntil(sim, () => sim.status !== 'running');
    expect(sim.status).toBe('dead');
    sim.respawn();
    expect(sim.status).toBe('running');
    expect(sim.player.x).toBeCloseTo(lv.checkpoints[0].x + 6, 0);
    expect(sim.player.grounded).toBe(true);
    expect(sim.player.invulnerable).toBeCloseTo(TIMING.invulnerable, 5);
    // Ohne jede Eingabe vergeht mindestens eine Sekunde, bevor etwas passieren kann.
    runUntil(sim, () => sim.status !== 'running' || sim.t > 0);
    const tStart = sim.t;
    runUntil(sim, () => sim.status !== 'running');
    expect(sim.t - tStart).toBeGreaterThan(1.5);
  });

  it('ohne Checkpoint geht es am Levelanfang weiter', () => {
    const l2 = build((b) => b.run(600).hazard('stone', 500));
    const sim = new LevelSimulation(l2);
    runUntil(sim, () => sim.status !== 'running');
    sim.respawn();
    expect(sim.player.x).toBe(l2.start.x);
  });

  it('Unverwundbarkeit schützt vor Hindernissen, nicht vor Gräben', () => {
    const l2 = build((b) => b.run(500).hazard('stone', 300).gap(250).run(300));
    const sim = new LevelSimulation(l2);
    sim.player.invulnerable = 10;
    runUntil(sim, () => sim.status !== 'running');
    expect(sim.lastDeath).toBe('fall');
  });

  it('Erleichterung nach vielen Toden und Hilfsmodus', () => {
    expect(computeAssist(false, 0)).toEqual(NORMAL_ASSIST);
    expect(computeAssist(false, 3).timeScale).toBeLessThan(1);
    expect(computeAssist(false, 6).timeScale).toBeLessThan(computeAssist(false, 3).timeScale);
    const help = computeAssist(true, 0);
    expect(help.timeScale).toBeLessThan(1);
    expect(help.coyoteTime).toBeGreaterThan(PHYSICS.coyoteTime);
    expect(help.jumpBuffer).toBeGreaterThan(PHYSICS.jumpBuffer);
    expect(help.invulnerable).toBeGreaterThan(TIMING.invulnerable);
    expect(help.showHints).toBe(true);
    expect(computeAssist(true, 20).timeScale).toBeGreaterThanOrEqual(0.68);
  });
});
