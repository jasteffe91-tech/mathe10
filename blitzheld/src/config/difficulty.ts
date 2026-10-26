import { PHYSICS, TIMING } from './gameConfig';

/**
 * Erleichterungen. Der Hilfsmodus und die automatische Erleichterung nach mehreren
 * Fehlversuchen verlangsamen die gesamte Simulation (timeScale). Weil dabei auch
 * Schwerkraft, Gegner und Feuerfontänen langsamer werden, bleiben alle Sprungweiten
 * geometrisch identisch – jedes Level bleibt also garantiert schaffbar, nur mit mehr Zeit.
 */
export interface Assist {
  /** Faktor für die Spielzeit (1 = normal, 0.8 = 20 % langsamer). */
  timeScale: number;
  coyoteTime: number;
  jumpBuffer: number;
  /** So viele Pixel wird die Kollisionsbox auf jeder Seite zusätzlich verkleinert. */
  hitboxShrink: number;
  invulnerable: number;
  /** Zusätzliche visuelle Hinweise (Sprungpfeile vor Hindernissen). */
  showHints: boolean;
  /** Stufe der automatischen Erleichterung (0 = keine). */
  autoLevel: number;
}

export const HELP_MODE = {
  timeScale: 0.8,
  coyoteTime: 0.17,
  jumpBuffer: 0.26,
  hitboxShrink: 3,
  invulnerable: 3.6,
} as const;

/** Ab so vielen Toden im selben Level wird automatisch erleichtert. */
export const AUTO_ASSIST_STEPS = [
  { deaths: 3, timeScale: 0.92, extraWindow: 0.04 },
  { deaths: 6, timeScale: 0.85, extraWindow: 0.08 },
] as const;

export const MIN_TIME_SCALE = 0.68;

export function computeAssist(helpMode: boolean, deathsInLevel: number): Assist {
  let timeScale = helpMode ? HELP_MODE.timeScale : 1;
  let coyoteTime: number = helpMode ? HELP_MODE.coyoteTime : PHYSICS.coyoteTime;
  let jumpBuffer: number = helpMode ? HELP_MODE.jumpBuffer : PHYSICS.jumpBuffer;
  let autoLevel = 0;
  for (const step of AUTO_ASSIST_STEPS) {
    if (deathsInLevel >= step.deaths) {
      autoLevel++;
      timeScale = (helpMode ? HELP_MODE.timeScale : 1) * step.timeScale;
      coyoteTime = (helpMode ? HELP_MODE.coyoteTime : PHYSICS.coyoteTime) + step.extraWindow;
      jumpBuffer = (helpMode ? HELP_MODE.jumpBuffer : PHYSICS.jumpBuffer) + step.extraWindow;
    }
  }
  return {
    timeScale: Math.max(MIN_TIME_SCALE, timeScale),
    coyoteTime,
    jumpBuffer,
    hitboxShrink: helpMode ? HELP_MODE.hitboxShrink : autoLevel > 0 ? 1 : 0,
    invulnerable: helpMode ? HELP_MODE.invulnerable : TIMING.invulnerable,
    showHints: helpMode,
    autoLevel,
  };
}

export const NORMAL_ASSIST: Assist = computeAssist(false, 0);
