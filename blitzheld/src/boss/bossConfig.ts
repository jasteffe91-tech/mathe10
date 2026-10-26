import type { ThemeId } from '../game/types';

/** Angriffsarten der Bosse. Alle werden mit derselben Taste (Springen) ausgewichen. */
export type AttackKind = 'roll' | 'double' | 'bounce' | 'fast';

export interface BossDef {
  id: string;
  world: number;
  name: string;
  title: string;
  theme: ThemeId;
  /** Lebenspunkte des Bosses (Treffer bis zum Sieg). */
  hp: number;
  /** So oft muss ausgewichen werden, bevor der Boss benommen ist und man angreifen kann. */
  dodgesPerOpening: number;
  /** Flugzeit eines Geschosses vom Boss bis zum Helden (s). */
  travel: number;
  /** Dauer der Angriffsvorbereitung (s) – der Boss holt sichtbar aus. */
  windup: number;
  /** Reihenfolge der Angriffe (wird wiederholt). */
  pattern: AttackKind[];
  /** Was der Boss wirft (nur Grafik). */
  projectile: 'acorn' | 'boulder' | 'bolt' | 'fireball';
}

export const BOSSES: BossDef[] = [
  {
    id: 'boss-1',
    world: 0,
    name: 'Stumpi',
    title: 'Stumpi, der Baumstumpf-Riese',
    theme: 'meadow',
    hp: 3,
    dodgesPerOpening: 2,
    travel: 2.0,
    windup: 1.3,
    pattern: ['roll', 'roll', 'roll', 'double'],
    projectile: 'acorn',
  },
  {
    id: 'boss-2',
    world: 1,
    name: 'Brocko',
    title: 'Brocko, das Felsmonster',
    theme: 'cave',
    hp: 3,
    dodgesPerOpening: 2,
    travel: 1.85,
    windup: 1.2,
    pattern: ['roll', 'double', 'roll', 'bounce'],
    projectile: 'boulder',
  },
  {
    id: 'boss-3',
    world: 2,
    name: 'Blinki-Bot',
    title: 'Blinki-Bot, der freche Roboter',
    theme: 'clouds',
    hp: 4,
    dodgesPerOpening: 3,
    travel: 1.75,
    windup: 1.1,
    pattern: ['roll', 'bounce', 'double', 'fast'],
    projectile: 'bolt',
  },
  {
    id: 'boss-4',
    world: 3,
    name: 'Flammi',
    title: 'Flammi, der Vulkan-Drache',
    theme: 'volcano',
    hp: 5,
    dodgesPerOpening: 3,
    travel: 1.65,
    windup: 1.05,
    pattern: ['roll', 'double', 'fast', 'bounce', 'double'],
    projectile: 'fireball',
  },
];

export const BOSS_TIMING = {
  intro: 1.4,
  /** So lange ist der Held nach einem Sprung in der Luft. */
  heroJump: 0.62,
  heroJumpHelp: 0.8,
  /** Das Geschoss berührt den Helden in [Einschlag − overlap, Einschlag + overlap]. */
  overlap: 0.08,
  /** Abstand der beiden Geschosse beim Doppelangriff. */
  doubleGap: 1.05,
  /** Faktor für die Flugzeit beim schnellen Angriff. */
  fastFactor: 0.8,
  /** Zeitfenster zum Angreifen, wenn der Boss benommen ist. */
  attackWindow: 3.2,
  attackWindowHelp: 6,
  /** Dauer des eigenen Angriffs (Held saust zum Boss). */
  strike: 1.0,
  /** Rückmeldung nach Treffer/Ausweichen, bevor es weitergeht. */
  feedback: 0.7,
  /** Kurze Pause nach einem eigenen Treffer. */
  heroHit: 1.0,
  /** Energie des Helden im Bosskampf. */
  heroEnergy: 3,
  /** Im Hilfsmodus fliegen Geschosse langsamer. */
  helpTravelFactor: 1.35,
  helpWindupFactor: 1.3,
} as const;

export function bossForWorld(world: number): BossDef {
  return BOSSES[Math.max(0, Math.min(BOSSES.length - 1, world))];
}
