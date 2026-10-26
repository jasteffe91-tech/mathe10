import { describe, expect, it } from 'vitest';
import { GameStateMachine } from '../../src/core/stateMachine';

describe('GameStateMachine', () => {
  it('folgt dem Ablauf MENU → PLAYING → DYING → MATH_CHALLENGE → RESPAWNING → PLAYING', () => {
    const sm = new GameStateMachine();
    expect(sm.state).toBe('MENU');
    expect(sm.transition('RESPAWNING')).toBe(true);
    expect(sm.transition('PLAYING')).toBe(true);
    expect(sm.transition('DYING')).toBe(true);
    expect(sm.transition('MATH_CHALLENGE')).toBe(true);
    expect(sm.transition('RESPAWNING')).toBe(true);
    expect(sm.transition('PLAYING')).toBe(true);
  });

  it('lehnt ungültige Wechsel ab und ändert dabei nichts', () => {
    const sm = new GameStateMachine();
    expect(sm.transition('DYING')).toBe(false);
    expect(sm.state).toBe('MENU');
    sm.transition('RESPAWNING');
    sm.transition('PLAYING');
    sm.transition('DYING');
    // Ein zweiter Tod während DYING ist nicht möglich → kein doppelter Lebensverlust.
    expect(sm.transition('DYING')).toBe(false);
    // Aus dem Mathefenster geht es nur über RESPAWNING weiter (nicht direkt ins Spiel oder ins Menü).
    sm.transition('MATH_CHALLENGE');
    expect(sm.transition('PLAYING')).toBe(false);
    expect(sm.transition('MENU')).toBe(false);
    expect(sm.transition('LEVEL_COMPLETE')).toBe(false);
    expect(sm.state).toBe('MATH_CHALLENGE');
  });

  it('kehrt aus der Pause in den richtigen Zustand zurück', () => {
    const sm = new GameStateMachine();
    sm.transition('BOSS_FIGHT');
    expect(sm.transition('PAUSED')).toBe(true);
    expect(sm.pausedFrom).toBe('BOSS_FIGHT');
    expect(sm.transition('PLAYING')).toBe(false);
    expect(sm.transition('BOSS_FIGHT')).toBe(true);
    expect(sm.pausedFrom).toBeNull();
  });

  it('erlaubt aus der Pause einen Neustart (RESPAWNING) und das Menü', () => {
    const sm = new GameStateMachine();
    sm.transition('RESPAWNING');
    sm.transition('PLAYING');
    sm.transition('PAUSED');
    expect(sm.can('RESPAWNING')).toBe(true);
    expect(sm.can('MENU')).toBe(true);
  });

  it('kann während DYING und MATH_CHALLENGE nicht pausiert werden', () => {
    const sm = new GameStateMachine();
    sm.transition('RESPAWNING');
    sm.transition('PLAYING');
    sm.transition('DYING');
    expect(sm.transition('PAUSED')).toBe(false);
    sm.transition('MATH_CHALLENGE');
    expect(sm.transition('PAUSED')).toBe(false);
  });

  it('meldet Wechsel an Zuhörer', () => {
    const sm = new GameStateMachine();
    const seen: string[] = [];
    sm.onChange((to, from) => seen.push(`${from}>${to}`));
    sm.transition('RESPAWNING');
    sm.transition('DYING');
    expect(seen).toEqual(['MENU>RESPAWNING']);
  });
});
