import { SIM_DT } from '../config/gameConfig';
import { NORMAL_ASSIST, type Assist } from '../config/difficulty';
import { LevelSimulation, type SimSnapshot } from './levelSim';
import type { LevelDef } from './types';

/**
 * Automatischer Level-Löser für die Tests. Er probiert Sprünge (kurzer Tipp und ganz
 * gehalten) an allen möglichen Absprungstellen und sucht per Tiefensuche einen Weg ins Ziel.
 *
 * Mit minWindow verlangt er zusätzlich Fehlertoleranz: An jeder Stelle, an der gesprungen
 * werden muss, braucht es eine zusammenhängende Spanne von mindestens minWindow Sekunden,
 * in der jeder Absprung zum Ziel führt – und zwar wieder mit derselben Toleranz an allen
 * folgenden Stellen. Ein Level, das so gelöst wird, verlangt nirgends millisekundengenaues Timing.
 */

export interface SolveOptions {
  /** Abstand der geprüften Absprungzeitpunkte in Simulationsschritten (2 = alle 1/60 s). */
  stride?: number;
  /** Haltezeiten der Sprungtaste in Sekunden. */
  holds?: number[];
  assist?: Assist;
  nodeLimit?: number;
  /** Geforderte Fehlertoleranz beim Absprung in Sekunden (0 = nur schaffbar). */
  minWindow?: number;
  /** Start an diesem Checkpoint (wie nach einem Tod) statt am Levelanfang. */
  checkpoint?: number;
  /** Spielzeit beim Start – prüft andere Phasen von Feuer, Gegnern und Plattformen. */
  startTime?: number;
}

export interface SolveResult {
  solved: boolean;
  nodes: number;
  /** Weiteste erreichte x-Position (Fehlersuche). */
  furthest: number;
  /** x-Positionen der Stellen, an denen gesprungen werden musste (aus allen erfolgreichen Knoten). */
  decisions: number[];
}

type FreeOutcome = 'complete' | 'dead' | 'stuck';
type JumpOutcome = 'complete' | 'dead' | 'landed';

export function solveLevel(level: LevelDef, opts: SolveOptions = {}): SolveResult {
  const stride = opts.stride ?? 2;
  const holds = opts.holds ?? [0, 0.3];
  const nodeLimit = opts.nodeLimit ?? 80000;
  const minRun = Math.max(1, Math.ceil((opts.minWindow ?? 0) / (stride * SIM_DT) - 1e-9));
  const sim = new LevelSimulation(level, opts.assist ?? NORMAL_ASSIST);
  sim.collectPickups = false;
  if (opts.startTime) sim.t = opts.startTime;
  if (opts.checkpoint !== undefined) sim.startAtCheckpoint(opts.checkpoint);

  const memo = new Map<string, boolean>();
  const decisions: number[] = [];
  let nodes = 0;
  let furthest = 0;

  const key = (): string => {
    const p = sim.player;
    const tb = level.timed ? Math.round(sim.t * 20) : 0;
    return `${Math.round(p.x / 3)}|${Math.round(p.y / 3)}|${p.groundId}|${sim.defeated.size}|${tb}`;
  };

  const runFree = (candidates: SimSnapshot[]): FreeOutcome => {
    let steps = 0;
    for (;;) {
      const p = sim.player;
      if ((p.grounded || p.coyote > 0) && steps % stride === 0) candidates.push(sim.snapshot());
      sim.step();
      sim.events.length = 0;
      steps++;
      if (sim.player.x > furthest) furthest = sim.player.x;
      if (sim.status === 'complete') return 'complete';
      if (sim.status === 'dead') return 'dead';
      if (sim.player.blockedTime > 1.5 || steps > 20000) return 'stuck';
    }
  };

  const jumpFrom = (snap: SimSnapshot, hold: number): JumpOutcome => {
    sim.restore(snap);
    const holdSteps = Math.round(hold / SIM_DT);
    for (let i = 0; i < 2000; i++) {
      sim.step({ pressed: i === 0, held: i < holdSteps });
      sim.events.length = 0;
      if (sim.player.x > furthest) furthest = sim.player.x;
      if (sim.status === 'complete') return 'complete';
      if (sim.status === 'dead') return 'dead';
      if (i > 2 && sim.player.grounded) return 'landed';
    }
    return 'dead';
  };

  /** Führt der Sprung von snap aus (mit irgendeiner Haltezeit) sicher ins Ziel? */
  const candidateWorks = (snap: SimSnapshot): boolean => {
    for (const hold of holds) {
      const out = jumpFrom(snap, hold);
      if (out === 'complete') return true;
      if (out === 'landed' && search(sim.snapshot())) return true;
    }
    return false;
  };

  const search = (snap: SimSnapshot): boolean => {
    sim.restore(snap);
    const k = key();
    const known = memo.get(k);
    if (known !== undefined) return known;
    if (++nodes > nodeLimit) throw new Error(`Löser: Knotengrenze erreicht in ${level.id} (bis x=${Math.round(furthest)})`);
    memo.set(k, false);
    const candidates: SimSnapshot[] = [];
    if (runFree(candidates) === 'complete') {
      memo.set(k, true);
      return true;
    }
    // Von der spätesten Absprungstelle rückwärts nach einer ausreichend langen Erfolgsspanne suchen.
    let run = 0;
    for (let c = candidates.length - 1; c >= 0; c--) {
      if (candidateWorks(candidates[c])) {
        run++;
        if (run >= minRun) {
          decisions.push(candidates[c + Math.floor(minRun / 2)].player.x);
          memo.set(k, true);
          return true;
        }
      } else {
        run = 0;
      }
    }
    return false;
  };

  const solved = search(sim.snapshot());
  return { solved, nodes, furthest, decisions: decisions.sort((a, b) => a - b) };
}
