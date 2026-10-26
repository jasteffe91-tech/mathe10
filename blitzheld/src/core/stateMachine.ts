/**
 * Zentraler Spielzustand. Alle Wechsel laufen über transition(); ungültige Wechsel
 * werden abgelehnt. So können Tod, Mathefenster, Wiederbelebung und Levelwechsel
 * nicht gleichzeitig ausgelöst werden.
 *
 * MENU → PLAYING → DYING → MATH_CHALLENGE → RESPAWNING → PLAYING
 * zusätzlich PAUSED, BOSS_FIGHT, LEVEL_COMPLETE, GAME_COMPLETE.
 */
export type GameState =
  | 'MENU'
  | 'PLAYING'
  | 'PAUSED'
  | 'DYING'
  | 'MATH_CHALLENGE'
  | 'RESPAWNING'
  | 'BOSS_FIGHT'
  | 'LEVEL_COMPLETE'
  | 'GAME_COMPLETE';

const TRANSITIONS: Record<GameState, readonly GameState[]> = {
  MENU: ['PLAYING', 'BOSS_FIGHT', 'RESPAWNING'],
  PLAYING: ['PAUSED', 'DYING', 'LEVEL_COMPLETE', 'MENU'],
  BOSS_FIGHT: ['PAUSED', 'DYING', 'LEVEL_COMPLETE', 'MENU'],
  PAUSED: ['PLAYING', 'BOSS_FIGHT', 'RESPAWNING', 'MENU'],
  DYING: ['MATH_CHALLENGE'],
  MATH_CHALLENGE: ['RESPAWNING'],
  RESPAWNING: ['PLAYING', 'BOSS_FIGHT', 'PAUSED', 'MENU'],
  LEVEL_COMPLETE: ['MENU', 'RESPAWNING', 'GAME_COMPLETE'],
  GAME_COMPLETE: ['MENU'],
};

export type StateListener = (to: GameState, from: GameState) => void;

export class GameStateMachine {
  private current: GameState = 'MENU';
  /** Zustand, in den PAUSED zurückkehrt. */
  private resumeTarget: GameState | null = null;
  private listeners: StateListener[] = [];
  private readonly history: GameState[] = ['MENU'];

  get state(): GameState {
    return this.current;
  }

  get pausedFrom(): GameState | null {
    return this.resumeTarget;
  }

  /** Letzte Zustände (für Tests und Fehlersuche). */
  get recent(): readonly GameState[] {
    return this.history;
  }

  can(to: GameState): boolean {
    if (!TRANSITIONS[this.current].includes(to)) return false;
    // Weiterspielen nur in den Zustand, aus dem pausiert wurde. RESPAWNING ist immer erlaubt
    // (Neustart des Levels oder Fortsetzen während „Bereit? Los!“).
    if (this.current === 'PAUSED' && (to === 'PLAYING' || to === 'BOSS_FIGHT')) {
      return to === this.resumeTarget;
    }
    return true;
  }

  /** Führt einen Wechsel aus. Gibt false zurück (und ändert nichts), wenn er nicht erlaubt ist. */
  transition(to: GameState): boolean {
    if (!this.can(to)) return false;
    const from = this.current;
    if (to === 'PAUSED') this.resumeTarget = from;
    if (from === 'PAUSED') this.resumeTarget = null;
    this.current = to;
    this.history.push(to);
    if (this.history.length > 40) this.history.shift();
    for (const l of this.listeners) l(to, from);
    return true;
  }

  is(...states: GameState[]): boolean {
    return states.includes(this.current);
  }

  onChange(listener: StateListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }
}
