// Zentrale Spielwerte. Alle Längen in Spiel-Pixeln (logische Auflösung 960 × 540),
// alle Zeiten in Sekunden. Die Simulation läuft mit fester Schrittweite.

export const VIEW = { width: 960, height: 540 } as const;

/** Feste Simulationsschrittweite (120 Hz) – unabhängig von der Bildwiederholrate. */
export const SIM_DT = 1 / 120;
/** Höchstens so viele Simulationsschritte pro Bild (verhindert „Spirale des Todes“ nach Tab-Wechsel). */
export const MAX_STEPS_PER_FRAME = 12;

export const PHYSICS = {
  /** Schwerkraft ohne gehaltene Sprungtaste. */
  gravity: 2600,
  /** Schwerkraft, solange die Sprungtaste gehalten wird (nur in der Steigphase). */
  holdGravity: 1150,
  /** Absprunggeschwindigkeit nach oben. Ein kurzer Tipp ergibt ~105 px Höhe, ganz gehalten ~185 px. */
  jumpVelocity: 740,
  /** So lange wirkt das Halten der Taste höchstens. */
  maxHoldTime: 0.24,
  maxFallSpeed: 1100,
  /** Nach dem Verlassen einer Kante darf noch so lange gesprungen werden. */
  coyoteTime: 0.1,
  /** Ein Tastendruck so kurz vor der Landung wird gemerkt und beim Aufsetzen ausgeführt. */
  jumpBuffer: 0.15,
  /** Sprungfeder: Startgeschwindigkeit nach oben. */
  springVelocity: 1180,
  /** Abprall nach dem Hüpfen auf einen Gegner. */
  stompBounce: 620,
} as const;

export const PLAYER = {
  /** Kollisionsbox – bewusst kleiner als die sichtbare Figur (ca. 46 × 62). */
  hitboxW: 28,
  hitboxH: 46,
  /** Horizontale Position des Helden auf dem Bildschirm (Kamera läuft mit). */
  screenX: 250,
} as const;

export const WORLD_LIMITS = {
  /** Standardhöhe der Bodenoberkante. */
  groundY: 430,
  /** Wer unter diese Linie fällt, ist in einen Graben gestürzt. */
  deathY: 660,
} as const;

export const LIVES = {
  start: 5,
  max: 5,
} as const;

export const TIMING = {
  /** Dauer der harmlosen „Puff“-Animation nach einem Treffer, bevor das Mathefenster aufgeht. */
  dying: 1.1,
  /** „Bereit? – Los!“ nach dem Wiederaufnehmen, der Held steht still. */
  respawnReady: 1.0,
  /** Unverwundbarkeit nach dem Wiedereinstieg. */
  invulnerable: 2.2,
  /** Rückmeldung „Richtig! Super!“, bevor die nächste Aufgabe erscheint. */
  mathCorrectFeedbackMs: 950,
  /** Kurze Sperre nach einer falschen Antwort (verhindert Dauerfeuer, keine Strafe). */
  mathWrongLockMs: 450,
  /** Siegesanimation am Levelende. */
  levelCompleteDelay: 1.6,
} as const;

export const COLLECT = {
  coinRadius: 18,
  starRadius: 24,
} as const;

/** Punkte bzw. Belohnungen. */
export const REWARDS = {
  coinsPerStomp: 1,
  coinsPerBossWin: 25,
} as const;
