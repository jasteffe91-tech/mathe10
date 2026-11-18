// Physikalische Modelle des Physik-Entdecker-Labors (ohne DOM, testbar).

export const G = 9.81; // m/s²

export type Rampe = 'flach' | 'mittel' | 'steil';

export const RAMPEN: Record<Rampe, { winkelGrad: number; buecher: number; name: string }> = {
  flach: { winkelGrad: 10, buecher: 1, name: 'flache Rampe' },
  mittel: { winkelGrad: 20, buecher: 2, name: 'mittlere Rampe' },
  steil: { winkelGrad: 35, buecher: 3, name: 'steile Rampe' },
};

/** Länge des Bretts im Modell (m). Alle Rampen nutzen dasselbe Brett, nur die Höhe ändert sich. */
export const BRETT_LAENGE_M = 2.0;

/**
 * Rollende Vollkugel ohne Rutschen und ohne Reibungsverluste:
 * a = (5/7) · g · sin(α). (Eine gleitende Kiste hätte a = g · sin(α).)
 */
export function beschleunigung(winkelGrad: number): number {
  return (5 / 7) * G * Math.sin((winkelGrad * Math.PI) / 180);
}

/** Zurückgelegter Weg nach t Sekunden (m), begrenzt auf die Brettlänge. */
export function weg(winkelGrad: number, t: number): number {
  return Math.min(BRETT_LAENGE_M, 0.5 * beschleunigung(winkelGrad) * t * t);
}

/** Zeit bis zum Ende des Bretts (s). */
export function rollzeit(winkelGrad: number, laenge = BRETT_LAENGE_M): number {
  return Math.sqrt((2 * laenge) / beschleunigung(winkelGrad));
}

/** Geschwindigkeit am Ende des Bretts (m/s). */
export function endgeschwindigkeit(winkelGrad: number, laenge = BRETT_LAENGE_M): number {
  return beschleunigung(winkelGrad) * rollzeit(winkelGrad, laenge);
}

/** Höhe des oberen Brettendes (m). */
export function hoehe(winkelGrad: number, laenge = BRETT_LAENGE_M): number {
  return laenge * Math.sin((winkelGrad * Math.PI) / 180);
}

// ---------------------------------------------------------------------
// Stromkreis: Die Lampe leuchtet genau dann, wenn der Kreis geschlossen ist.
// ---------------------------------------------------------------------
export interface Kreis { schalterZu: boolean; kabel1: boolean; kabel2: boolean }

export function leuchtet(k: Kreis): boolean {
  return k.schalterZu && k.kabel1 && k.kabel2;
}

/** Kindgerechte Beschreibung, wo der Kreis offen ist. */
export function luecken(k: Kreis): string[] {
  const l: string[] = [];
  if (!k.kabel1) l.push('Kabel 1 ist nicht angeschlossen');
  if (!k.kabel2) l.push('Kabel 2 ist nicht angeschlossen');
  if (!k.schalterZu) l.push('der Schalter ist offen');
  return l;
}

export function zahl(x: number, stellen = 1): string {
  return x.toLocaleString('de-DE', { minimumFractionDigits: stellen, maximumFractionDigits: stellen });
}
