import { describe, it, expect } from 'vitest';
import { RAMPEN, beschleunigung, rollzeit, endgeschwindigkeit, weg, hoehe, leuchtet, luecken, BRETT_LAENGE_M, G } from '../src/physik';

describe('Modell rollende Kugel', () => {
  it('a = 5/7 · g · sin α (Vollkugel ohne Rutschen)', () => {
    expect(beschleunigung(90)).toBeCloseTo((5 / 7) * G, 6);
    expect(beschleunigung(30)).toBeCloseTo((5 / 7) * G * 0.5, 6);
  });
  it('steilere Rampe → kürzere Zeit und höheres Tempo unten', () => {
    const t = (['flach', 'mittel', 'steil'] as const).map((r) => rollzeit(RAMPEN[r].winkelGrad));
    expect(t[0]).toBeGreaterThan(t[1]);
    expect(t[1]).toBeGreaterThan(t[2]);
    expect(t[0]).toBeCloseTo(1.81, 2);
    expect(t[2]).toBeCloseTo(1.0, 1);
    const v = (['flach', 'mittel', 'steil'] as const).map((r) => endgeschwindigkeit(RAMPEN[r].winkelGrad));
    expect(v[2]).toBeGreaterThan(v[0]);
  });
  it('Energieerhaltung: ½mv² + ½Iω² = mgh mit I = 2/5 mr²', () => {
    for (const r of Object.values(RAMPEN)) {
      const v = endgeschwindigkeit(r.winkelGrad);
      expect(0.5 * v * v * (1 + 2 / 5)).toBeCloseTo(G * hoehe(r.winkelGrad), 6);
    }
  });
  it('Weg ist durch das Brett begrenzt', () => {
    expect(weg(35, 100)).toBe(BRETT_LAENGE_M);
    expect(weg(35, 0)).toBe(0);
  });
});

describe('Modell Stromkreis', () => {
  it('Lampe leuchtet nur bei geschlossenem Kreis', () => {
    expect(leuchtet({ schalterZu: true, kabel1: true, kabel2: true })).toBe(true);
    expect(leuchtet({ schalterZu: false, kabel1: true, kabel2: true })).toBe(false);
    expect(leuchtet({ schalterZu: true, kabel1: false, kabel2: true })).toBe(false);
    expect(luecken({ schalterZu: false, kabel1: false, kabel2: true })).toEqual(['Kabel 1 ist nicht angeschlossen', 'der Schalter ist offen']);
  });
});
