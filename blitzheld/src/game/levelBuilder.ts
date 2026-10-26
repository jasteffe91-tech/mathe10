import { WORLD_LIMITS } from '../config/gameConfig';
import type {
  CheckpointDef,
  EnemyDef,
  EnemyKind,
  FireDef,
  HazardDef,
  HazardKind,
  HintDef,
  LevelDef,
  MoveDef,
  PickupDef,
  SolidDef,
  SolidKind,
  SpringDef,
  ThemeId,
} from './types';

/** Kollisionsgrößen der Hindernisse (Grafik ist jeweils ein paar Pixel größer). */
export const HAZARD_SIZE: Record<HazardKind, { w: number; h: number }> = {
  stone: { w: 30, h: 20 },
  stump: { w: 30, h: 34 },
  crystal: { w: 24, h: 40 },
  rock: { w: 36, h: 30 },
  spikyBush: { w: 34, h: 26 },
  lavaRock: { w: 32, h: 28 },
};

export const ENEMY_SIZE: Record<EnemyKind, { w: number; h: number }> = {
  snail: { w: 38, h: 28 },
  beetle: { w: 34, h: 26 },
  bat: { w: 34, h: 24 },
  bird: { w: 38, h: 24 },
  blob: { w: 34, h: 28 },
};

export const CRATE_SIZE = 46;
export const SPRING_SIZE = { w: 40, h: 18 };

export interface BuilderOptions {
  id: string;
  world: number;
  index: number;
  name: string;
  theme: ThemeId;
  speed: number;
  /** Bodenart: fester Boden bis ganz unten oder dicke Wolken. */
  groundKind?: 'ground' | 'cloud';
}

/**
 * Baukasten für Level. Ein „Cursor“ läuft von links nach rechts; jedes Element
 * setzt Objekte an die aktuelle Stelle und schiebt den Cursor weiter.
 * Der Boden unter dem Cursor wird automatisch verlängert, bis eine Lücke (gap) kommt.
 */
export class LevelBuilder {
  x = 0;
  groundY: number = WORLD_LIMITS.groundY;
  /** Der erste Boden beginnt links außerhalb des Bildes. */
  private segStart = -640;
  private onGround = true;
  private readonly groundKind: 'ground' | 'cloud';

  private readonly solids: SolidDef[] = [];
  private readonly hazards: HazardDef[] = [];
  private readonly enemies: EnemyDef[] = [];
  private readonly fires: FireDef[] = [];
  private readonly springs: SpringDef[] = [];
  private readonly coinList: PickupDef[] = [];
  private readonly starList: PickupDef[] = [];
  private readonly checkpoints: CheckpointDef[] = [];
  private readonly hints: HintDef[] = [];
  private goalX = 0;

  constructor(private readonly opts: BuilderOptions) {
    this.groundKind = opts.groundKind ?? 'ground';
  }

  // ------------------------------------------------------------------ Boden

  private closeSegment(): void {
    if (!this.onGround) return;
    const w = this.x - this.segStart;
    if (w > 0) this.addGround(this.segStart, this.groundY, w);
    this.onGround = false;
  }

  private addGround(x: number, y: number, w: number): void {
    if (this.groundKind === 'cloud') {
      this.addSolid('cloud', x, y, w, 46, true);
    } else {
      this.addSolid('ground', x, y, w, WORLD_LIMITS.deathY + 200 - y, false);
    }
  }

  private addSolid(kind: SolidKind, x: number, y: number, w: number, h: number, oneWay: boolean, move?: MoveDef): SolidDef {
    const s: SolidDef = { id: this.solids.length, kind, x, y, w, h, oneWay, move };
    this.solids.push(s);
    return s;
  }

  /** Läuft len Pixel auf dem aktuellen Boden weiter. */
  run(len: number): this {
    if (!this.onGround) {
      this.segStart = this.x;
      this.onGround = true;
    }
    this.x += len;
    return this;
  }

  /** Graben der Breite w. Danach geht der Boden auf Höhe groundY + dy weiter. */
  gap(w: number, dy = 0): this {
    this.closeSegment();
    this.x += w;
    this.groundY += dy;
    this.segStart = this.x;
    this.onGround = true;
    return this;
  }

  /** Stufe: Der Boden springt um dy (negativ = höher). Hohe Stufen halten den Helden an, bis er springt. */
  stepTo(dy: number): this {
    this.closeSegment();
    this.groundY += dy;
    this.segStart = this.x;
    this.onGround = true;
    return this;
  }

  /** Sanfter Hügel aus kleinen Stufen (läuft der Held ohne Sprung hinauf und hinunter). */
  hill(steps: number, stepLen = 70, top = 0): this {
    for (let i = 0; i < steps; i++) this.stepTo(-16).run(stepLen);
    if (top > 0) this.run(top);
    for (let i = 0; i < steps; i++) this.stepTo(16).run(stepLen);
    return this;
  }

  // ------------------------------------------------------------------ Hindernisse

  hazard(kind: HazardKind, after = 0): this {
    const { w, h } = HAZARD_SIZE[kind];
    this.run(0);
    this.hazards.push({ id: this.hazards.length, kind, x: this.x, y: this.groundY - h, w, h });
    this.x += w;
    if (after > 0) this.run(after);
    return this;
  }

  /** Kistenstapel (n Kisten hoch). Kisten sind fest: man kann darauf landen. */
  crates(n = 1, after = 0, wide = 1): this {
    this.run(0);
    for (let c = 0; c < wide; c++) {
      for (let r = 0; r < n; r++) {
        this.addSolid('crate', this.x + c * CRATE_SIZE, this.groundY - (r + 1) * CRATE_SIZE, CRATE_SIZE, CRATE_SIZE, false);
      }
    }
    this.x += CRATE_SIZE * wide;
    if (after > 0) this.run(after);
    return this;
  }

  /** Gegner auf dem Boden (Läufer) – pendelt patrol Pixel nach links. */
  walker(kind: EnemyKind, patrol = 0, speed = 40, offset = 0): this {
    const { w, h } = ENEMY_SIZE[kind];
    this.run(0);
    const x = this.x + offset;
    this.enemies.push({
      id: this.enemies.length,
      kind,
      x,
      y: this.groundY - h,
      w,
      h,
      patrol: patrol > 0 ? { dx: patrol, speed } : undefined,
    });
    return this;
  }

  /** Schwebender Gegner, height = Abstand der Unterkante über dem Boden. */
  flyer(kind: EnemyKind, height: number, dy = 30, period = 2, offset = 0, phase = 0): this {
    const { w, h } = ENEMY_SIZE[kind];
    this.enemies.push({
      id: this.enemies.length,
      kind,
      x: this.x + offset,
      y: this.groundY - height - h,
      w,
      h,
      hover: { dy, period, phase },
    });
    return this;
  }

  spring(after = 0): this {
    this.run(0);
    this.springs.push({
      id: this.springs.length,
      x: this.x,
      y: this.groundY - SPRING_SIZE.h,
      w: SPRING_SIZE.w,
      h: SPRING_SIZE.h,
    });
    this.x += SPRING_SIZE.w;
    if (after > 0) this.run(after);
    return this;
  }

  fire(opts: { period?: number; warn?: number; active?: number; offset?: number; h?: number } = {}, after = 0): this {
    this.run(0);
    this.fires.push({
      id: this.fires.length,
      x: this.x,
      groundY: this.groundY,
      w: 34,
      h: opts.h ?? 64,
      period: opts.period ?? 3.2,
      warn: opts.warn ?? 1.0,
      active: opts.active ?? 0.9,
      offset: opts.offset ?? 0,
    });
    this.x += 34;
    if (after > 0) this.run(after);
    return this;
  }

  // ------------------------------------------------------------------ Plattformen

  /** Schwebende Plattform relativ zum Cursor (dx) und zur Bodenhöhe (height über dem Boden). */
  platform(dx: number, height: number, w: number, kind: 'ledge' | 'cloud' = 'ledge'): this {
    this.addSolid(kind, this.x + dx, this.groundY - height, w, kind === 'cloud' ? 34 : 26, true);
    return this;
  }

  /** Plattform mit absoluter Oberkante y. */
  platformAt(dx: number, y: number, w: number, kind: 'ledge' | 'cloud' = 'ledge'): this {
    this.addSolid(kind, this.x + dx, y, w, kind === 'cloud' ? 34 : 26, true);
    return this;
  }

  /** Bewegliche Plattform (startet bei dx, height über Boden), pendelt um (mdx, mdy). */
  mover(dx: number, height: number, w: number, mdx: number, mdy: number, period: number, phase = 0): this {
    this.addSolid('mover', this.x + dx, this.groundY - height, w, 24, true, { dx: mdx, dy: mdy, period, phase });
    return this;
  }

  // ------------------------------------------------------------------ Sammelsachen

  /** n Münzen in einer Reihe, beginnend bei dx, height über dem Boden. */
  coins(n: number, dx = 0, height = 40, spacing = 38): this {
    for (let i = 0; i < n; i++) this.coin(dx + i * spacing, height);
    return this;
  }

  coin(dx: number, height: number): this {
    this.coinList.push({ id: this.coinList.length, x: this.x + dx, y: this.groundY - height });
    return this;
  }

  /** Münzbogen über ein Hindernis: zeigt gleichzeitig, wann man springen sollte. */
  coinArc(n: number, dx: number, width: number, height: number, baseHeight = 40): this {
    for (let i = 0; i < n; i++) {
      const f = n === 1 ? 0.5 : i / (n - 1);
      const y = baseHeight + Math.sin(f * Math.PI) * (height - baseHeight);
      this.coin(dx + f * width, y);
    }
    return this;
  }

  star(dx: number, height: number): this {
    this.starList.push({ id: this.starList.length, x: this.x + dx, y: this.groundY - height });
    return this;
  }

  checkpoint(after = 0): this {
    this.run(0);
    this.checkpoints.push({ id: this.checkpoints.length, x: this.x, y: this.groundY });
    if (after > 0) this.run(after);
    return this;
  }

  hint(text: string, dx = 0, height = 150): this {
    this.hints.push({ x: this.x + dx, y: this.groundY - height, text });
    return this;
  }

  /** Ziel bei der aktuellen Position, danach noch etwas Auslauf. */
  goal(runout = 600): LevelDef {
    this.run(0);
    this.goalX = this.x;
    this.run(runout);
    this.closeSegment();
    const o = this.opts;
    const first = this.solids.find((s) => s.kind === 'ground' || s.kind === 'cloud');
    const startY = first ? first.y : WORLD_LIMITS.groundY;
    return {
      id: o.id,
      world: o.world,
      index: o.index,
      name: o.name,
      theme: o.theme,
      speed: o.speed,
      length: this.x,
      start: { x: 60, y: startY },
      goalX: this.goalX,
      solids: this.solids,
      hazards: this.hazards,
      enemies: this.enemies,
      fires: this.fires,
      springs: this.springs,
      coins: this.coinList,
      stars: this.starList,
      checkpoints: this.checkpoints,
      hints: this.hints,
      timed: this.enemies.length > 0 || this.fires.length > 0 || this.solids.some((s) => !!s.move),
    };
  }
}
