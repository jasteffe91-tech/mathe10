// Datentypen der Level. Koordinaten: x nach rechts, y nach unten, Rechtecke mit linker oberer Ecke.

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type ThemeId = 'meadow' | 'cave' | 'clouds' | 'volcano';

/** Sanfte Hin-und-her-Bewegung: Versatz = (dx, dy) · (1 − cos(2π · (t / period) + phase)) / 2. */
export interface MoveDef {
  dx: number;
  dy: number;
  period: number;
  phase: number;
}

export type SolidKind =
  | 'ground' // Boden bis ganz nach unten
  | 'crate' // Holzkiste (fest, man kann darauf stehen, schiebt einen an der Seite zurück)
  | 'ledge' // schwebende Felsplatte (von unten durchlässig)
  | 'cloud' // Wolke (von unten und von der Seite durchlässig)
  | 'mover'; // bewegliche Plattform (von unten durchlässig)

export interface SolidDef {
  id: number;
  kind: SolidKind;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Nur von oben begehbar (keine Seiten- oder Deckenkollision). */
  oneWay: boolean;
  move?: MoveDef;
}

export type HazardKind = 'stone' | 'stump' | 'crystal' | 'rock' | 'spikyBush' | 'lavaRock';

export interface HazardDef {
  id: number;
  kind: HazardKind;
  /** Kollisionsbox (etwas kleiner als die Grafik). */
  x: number;
  y: number;
  w: number;
  h: number;
}

export type EnemyKind = 'snail' | 'beetle' | 'bat' | 'bird' | 'blob';

export interface EnemyDef {
  id: number;
  kind: EnemyKind;
  /** Startposition der Kollisionsbox. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Läufer: pendelt um patrol Pixel nach links und wieder zurück. */
  patrol?: { dx: number; speed: number };
  /** Flieger: schwebt auf und ab. */
  hover?: { dy: number; period: number; phase: number };
}

/** Feuerfontäne: warnt (blubbert), speit, ruht. Phase = (t + offset) mod period. */
export interface FireDef {
  id: number;
  x: number;
  /** Oberkante des Bodens, auf dem die Düse sitzt. */
  groundY: number;
  w: number;
  /** Höhe des Feuerstrahls. */
  h: number;
  period: number;
  warn: number;
  active: number;
  offset: number;
}

export interface SpringDef {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PickupDef {
  id: number;
  x: number;
  y: number;
}

export interface CheckpointDef {
  id: number;
  x: number;
  /** Bodenhöhe am Checkpoint. */
  y: number;
}

/** Kleiner Hinweis, der im Hilfsmodus vor neuen Hindernissen erscheint. */
export interface HintDef {
  x: number;
  y: number;
  text: string;
}

export interface LevelDef {
  id: string;
  world: number; // 0-basiert
  index: number; // 0-basiert innerhalb der Welt
  name: string;
  theme: ThemeId;
  /** Laufgeschwindigkeit in px/s (vor Erleichterungen). */
  speed: number;
  length: number;
  start: { x: number; y: number };
  goalX: number;
  solids: SolidDef[];
  hazards: HazardDef[];
  enemies: EnemyDef[];
  fires: FireDef[];
  springs: SpringDef[];
  coins: PickupDef[];
  stars: PickupDef[];
  checkpoints: CheckpointDef[];
  hints: HintDef[];
  /** Enthält zeitabhängige Elemente (bewegliche Plattformen, Feuer, Gegner). */
  timed: boolean;
}
