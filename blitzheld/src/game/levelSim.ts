import { COLLECT, PHYSICS, PLAYER, SIM_DT, WORLD_LIMITS } from '../config/gameConfig';
import { NORMAL_ASSIST, type Assist } from '../config/difficulty';
import { circleHitsRect, inset, overlaps, XBuckets } from './collision';
import type { LevelDef, Rect } from './types';

/**
 * Reine Spielsimulation eines Levels – ohne Phaser, ohne DOM. Dadurch lassen sich
 * Sprünge, Kollisionen, Tod, Checkpoints und Levelende in Node testen.
 */

export interface SimInput {
  /** Taste wurde seit dem letzten Schritt neu gedrückt. */
  pressed: boolean;
  /** Taste ist gerade gedrückt. */
  held: boolean;
}

export type DeathCause = 'hit' | 'fall';

export type SimEvent =
  | { type: 'jump'; x: number; y: number }
  | { type: 'land'; x: number; y: number; impact: number }
  | { type: 'coin'; id: number; x: number; y: number }
  | { type: 'star'; id: number; x: number; y: number }
  | { type: 'checkpoint'; index: number }
  | { type: 'stomp'; id: number; x: number; y: number }
  | { type: 'spring'; id: number }
  | { type: 'death'; cause: DeathCause; x: number; y: number }
  | { type: 'complete' };

export interface PlayerState {
  /** Mitte der Kollisionsbox. */
  x: number;
  /** Unterkante (Füße). */
  y: number;
  vy: number;
  grounded: boolean;
  groundId: number;
  coyote: number;
  buffer: number;
  holdTime: number;
  jumpHeld: boolean;
  invulnerable: number;
  /** Steht gerade vor einer Wand. */
  blocked: boolean;
  blockedTime: number;
  airTime: number;
}

export type SimStatus = 'running' | 'dead' | 'complete';

export interface SimSnapshot {
  t: number;
  player: PlayerState;
  status: SimStatus;
  checkpointIndex: number;
  defeated: number[];
  springCooldown: number;
}

export type FirePhase = 'idle' | 'warn' | 'active';

const BUCKET = 256;
/** Stufen bis zu dieser Höhe läuft der Held ohne Sprung hinauf. */
export const STEP_UP = 18;
const EMPTY_INPUT: SimInput = { pressed: false, held: false };

export class LevelSimulation {
  readonly level: LevelDef;
  assist: Assist;
  t = 0;
  status: SimStatus = 'running';
  player: PlayerState;
  checkpointIndex = -1;
  readonly collectedCoins = new Set<number>();
  readonly collectedStars = new Set<number>();
  readonly defeated = new Set<number>();
  /** Ereignisse seit dem letzten drain(). */
  events: SimEvent[] = [];
  /** Im Löser ausgeschaltet – Münzen sind für das Durchkommen egal. */
  collectPickups = true;
  /** Anzahl der Tode in diesem Lauf (zählt jeder Treffer und Sturz genau einmal). */
  deaths = 0;
  /** Letzte Todesursache. */
  lastDeath: DeathCause | null = null;

  private readonly solidX: Float64Array;
  private readonly solidY: Float64Array;
  private readonly prevSolidX: Float64Array;
  private readonly prevSolidY: Float64Array;
  private springCooldown = 0;

  private readonly solidBuckets: XBuckets;
  private readonly hazardBuckets: XBuckets;
  private readonly enemyBuckets: XBuckets;
  private readonly fireBuckets: XBuckets;
  private readonly springBuckets: XBuckets;
  private readonly coinBuckets: XBuckets;
  private readonly starBuckets: XBuckets;
  private readonly seen: Uint32Array;
  private stamp = 1;
  private readonly tmp: number[] = [];

  constructor(level: LevelDef, assist: Assist = NORMAL_ASSIST) {
    this.level = level;
    this.assist = assist;
    const n = level.solids.length;
    this.solidX = new Float64Array(n);
    this.solidY = new Float64Array(n);
    this.prevSolidX = new Float64Array(n);
    this.prevSolidY = new Float64Array(n);

    const len = level.length + 2000;
    this.solidBuckets = new XBuckets(BUCKET, len);
    this.hazardBuckets = new XBuckets(BUCKET, len);
    this.enemyBuckets = new XBuckets(BUCKET, len);
    this.fireBuckets = new XBuckets(BUCKET, len);
    this.springBuckets = new XBuckets(BUCKET, len);
    this.coinBuckets = new XBuckets(BUCKET, len);
    this.starBuckets = new XBuckets(BUCKET, len);
    level.solids.forEach((s, i) => {
      const dx = s.move?.dx ?? 0;
      this.solidBuckets.insert(i, Math.min(s.x, s.x + dx), Math.max(s.x + s.w, s.x + s.w + dx));
    });
    level.hazards.forEach((h, i) => this.hazardBuckets.insert(i, h.x, h.x + h.w));
    level.enemies.forEach((e, i) => this.enemyBuckets.insert(i, e.x - (e.patrol?.dx ?? 0), e.x + e.w));
    level.fires.forEach((f, i) => this.fireBuckets.insert(i, f.x, f.x + f.w));
    level.springs.forEach((s, i) => this.springBuckets.insert(i, s.x, s.x + s.w));
    level.coins.forEach((c, i) => this.coinBuckets.insert(i, c.x - 30, c.x + 30));
    level.stars.forEach((c, i) => this.starBuckets.insert(i, c.x - 30, c.x + 30));
    const maxCount = Math.max(
      n,
      level.hazards.length,
      level.enemies.length,
      level.fires.length,
      level.springs.length,
      level.coins.length,
      level.stars.length,
      1,
    );
    this.seen = new Uint32Array(maxCount);

    this.updateSolids();
    this.prevSolidX.set(this.solidX);
    this.prevSolidY.set(this.solidY);
    this.player = this.makePlayer(level.start.x, level.start.y);
    this.snapToGround();
  }

  private makePlayer(x: number, y: number): PlayerState {
    return {
      x,
      y,
      vy: 0,
      grounded: false,
      groundId: -1,
      coyote: 0,
      buffer: 0,
      holdTime: 0,
      jumpHeld: false,
      invulnerable: 0,
      blocked: false,
      blockedTime: 0,
      airTime: 0,
    };
  }

  /** Aktuelle Laufgeschwindigkeit in px/s (Erleichterungen wirken über die Zeitskala). */
  get speed(): number {
    return this.level.speed;
  }

  // ---------------------------------------------------------------- Abfragen für Grafik und Tests

  playerRect(shrink = 0): Rect {
    const p = this.player;
    const r = { x: p.x - PLAYER.hitboxW / 2, y: p.y - PLAYER.hitboxH, w: PLAYER.hitboxW, h: PLAYER.hitboxH };
    return shrink > 0 ? inset(r, shrink) : r;
  }

  solidRect(i: number): Rect {
    const s = this.level.solids[i];
    return { x: this.solidX[i], y: this.solidY[i], w: s.w, h: s.h };
  }

  enemyRect(i: number): Rect {
    const e = this.level.enemies[i];
    let x = e.x;
    let y = e.y;
    if (e.patrol) {
      const span = e.patrol.dx;
      const p = (this.t * e.patrol.speed) % (2 * span);
      x = e.x - (p < span ? p : 2 * span - p);
    }
    if (e.hover) {
      y = e.y + Math.sin((this.t / e.hover.period) * Math.PI * 2 + e.hover.phase) * e.hover.dy;
    }
    return { x, y, w: e.w, h: e.h };
  }

  /** Laufrichtung eines Läufers (−1 = nach links). */
  enemyFacing(i: number): number {
    const e = this.level.enemies[i];
    if (!e.patrol) return -1;
    const p = (this.t * e.patrol.speed) % (2 * e.patrol.dx);
    return p < e.patrol.dx ? -1 : 1;
  }

  firePhase(i: number): { phase: FirePhase; progress: number } {
    const f = this.level.fires[i];
    const p = (((this.t + f.offset) % f.period) + f.period) % f.period;
    if (p < f.warn) return { phase: 'warn', progress: p / f.warn };
    if (p < f.warn + f.active) return { phase: 'active', progress: (p - f.warn) / f.active };
    return { phase: 'idle', progress: (p - f.warn - f.active) / Math.max(0.001, f.period - f.warn - f.active) };
  }

  fireRect(i: number): Rect {
    const f = this.level.fires[i];
    return { x: f.x, y: f.groundY - f.h, w: f.w, h: f.h };
  }

  /** Fortschritt 0..1 bis zum Ziel. */
  get progress(): number {
    const s = this.level.start.x;
    return Math.max(0, Math.min(1, (this.player.x - s) / (this.level.goalX - s)));
  }

  drain(): SimEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  // ---------------------------------------------------------------- Simulation

  private updateSolids(): void {
    const solids = this.level.solids;
    for (let i = 0; i < solids.length; i++) {
      const s = solids[i];
      if (s.move) {
        const k = (1 - Math.cos((this.t / s.move.period) * Math.PI * 2 + s.move.phase)) / 2;
        this.solidX[i] = s.x + s.move.dx * k;
        this.solidY[i] = s.y + s.move.dy * k;
      } else {
        this.solidX[i] = s.x;
        this.solidY[i] = s.y;
      }
    }
  }

  private nextStamp(): number {
    this.stamp = (this.stamp + 1) >>> 0;
    if (this.stamp === 0) {
      this.seen.fill(0);
      this.stamp = 1;
    }
    return this.stamp;
  }

  /** Setzt den Helden auf den Boden direkt unter ihm (Start und Wiedereinstieg). */
  private snapToGround(): void {
    const p = this.player;
    let best = -1;
    let bestY = Infinity;
    const hw = PLAYER.hitboxW / 2;
    for (let i = 0; i < this.level.solids.length; i++) {
      const r = this.solidRect(i);
      if (p.x + hw <= r.x || p.x - hw >= r.x + r.w) continue;
      if (r.y >= p.y - 40 && r.y < bestY) {
        bestY = r.y;
        best = i;
      }
    }
    if (best >= 0) {
      p.y = bestY;
      p.grounded = true;
      p.groundId = best;
      p.vy = 0;
      p.coyote = this.assist.coyoteTime;
    }
  }

  step(input: SimInput = EMPTY_INPUT): void {
    if (this.status !== 'running') return;
    const dt = SIM_DT;
    this.prevSolidX.set(this.solidX);
    this.prevSolidY.set(this.solidY);
    this.t += dt;
    this.updateSolids();
    if (this.springCooldown > 0) this.springCooldown -= dt;

    const p = this.player;
    const solids = this.level.solids;
    const hw = PLAYER.hitboxW / 2;
    const wasGrounded = p.grounded;

    // Auf beweglichen Plattformen fährt der Held mit.
    if (p.grounded && p.groundId >= 0 && solids[p.groundId].move) {
      p.x += this.solidX[p.groundId] - this.prevSolidX[p.groundId];
      p.y += this.solidY[p.groundId] - this.prevSolidY[p.groundId];
    }

    // --- Eingabe: Sprungpuffer, Coyote-Zeit, variabler Sprung
    if (input.pressed) p.buffer = this.assist.jumpBuffer;
    else if (p.buffer > 0) p.buffer -= dt;
    if (p.grounded) p.coyote = this.assist.coyoteTime;
    else if (p.coyote > 0) p.coyote -= dt;

    if (p.buffer > 0 && (p.grounded || p.coyote > 0)) {
      p.vy = -PHYSICS.jumpVelocity;
      p.grounded = false;
      p.groundId = -1;
      p.coyote = 0;
      p.buffer = 0;
      p.holdTime = 0;
      p.jumpHeld = true;
      this.events.push({ type: 'jump', x: p.x, y: p.y });
    }
    if (p.jumpHeld && !input.held) p.jumpHeld = false;

    const holding = p.jumpHeld && p.vy < 0 && p.holdTime < PHYSICS.maxHoldTime;
    p.vy = Math.min(PHYSICS.maxFallSpeed, p.vy + (holding ? PHYSICS.holdGravity : PHYSICS.gravity) * dt);
    if (p.jumpHeld) p.holdTime += dt;

    // --- Waagerecht: automatisch nach vorne, feste Blöcke halten an
    const stamp = this.nextStamp();
    const near = this.solidBuckets.query(p.x - 80, p.x + 80, this.seen, stamp, this.tmp);
    const nextX = p.x + this.speed * dt;
    p.blocked = false;
    let newX = nextX;
    for (let k = 0; k < near.length; k++) {
      const i = near[k];
      if (solids[i].oneWay) continue;
      const sx = this.solidX[i];
      const sy = this.solidY[i];
      const s = solids[i];
      const top = p.y - PLAYER.hitboxH;
      // Nur blockieren, wenn der Held seitlich hineinläuft (Füße unterhalb der Oberkante).
      if (p.y > sy + 3 && top < sy + s.h && newX + hw > sx && p.x + hw <= sx + 0.5) {
        if (p.grounded && p.y - sy <= STEP_UP) {
          // Kleine Stufen (sanfte Hügel) läuft der Held einfach hinauf.
          p.y = sy;
          continue;
        }
        newX = Math.min(newX, sx - hw - 0.01);
        p.blocked = true;
      }
    }
    p.x = Math.max(p.x, newX);
    p.blockedTime = p.blocked ? p.blockedTime + dt : 0;

    // --- Senkrecht
    const prevBottom = p.y;
    const prevTop = p.y - PLAYER.hitboxH;
    const vyBefore = p.vy;
    p.y += p.vy * dt;
    p.grounded = false;
    if (p.vy >= 0) {
      let best = -1;
      let bestTop = Infinity;
      for (let k = 0; k < near.length; k++) {
        const i = near[k];
        const sx = this.solidX[i];
        const sw = solids[i].w;
        if (p.x + hw <= sx || p.x - hw >= sx + sw) continue;
        const top = this.solidY[i];
        const prevTopS = this.prevSolidY[i];
        if (prevBottom <= Math.max(prevTopS, top) + 1 && p.y >= top && top < bestTop) {
          best = i;
          bestTop = top;
        }
      }
      if (best >= 0) {
        p.y = bestTop;
        p.vy = 0;
        p.grounded = true;
        p.groundId = best;
      } else {
        p.groundId = -1;
      }
    } else {
      p.groundId = -1;
      for (let k = 0; k < near.length; k++) {
        const i = near[k];
        if (solids[i].oneWay) continue;
        const sx = this.solidX[i];
        const s = solids[i];
        if (p.x + hw <= sx || p.x - hw >= sx + s.w) continue;
        const bottom = this.solidY[i] + s.h;
        if (prevTop >= bottom - 0.5 && p.y - PLAYER.hitboxH < bottom) {
          p.y = bottom + PLAYER.hitboxH;
          p.vy = 0;
        }
      }
    }

    if (p.grounded) {
      if (!wasGrounded) this.events.push({ type: 'land', x: p.x, y: p.y, impact: vyBefore });
      p.airTime = 0;
    } else {
      p.airTime += dt;
    }

    // --- Sprungfedern
    if (this.springCooldown <= 0 && p.vy >= 0) {
      const sp = this.springBuckets.query(p.x - 60, p.x + 60, this.seen, this.nextStamp(), this.tmp);
      for (let k = 0; k < sp.length; k++) {
        const s = this.level.springs[sp[k]];
        if (p.x + hw > s.x + 4 && p.x - hw < s.x + s.w - 4 && p.y >= s.y - 2 && p.y <= s.y + s.h + 1) {
          p.vy = -PHYSICS.springVelocity;
          p.grounded = false;
          p.groundId = -1;
          p.jumpHeld = false;
          p.coyote = 0;
          this.springCooldown = 0.3;
          this.events.push({ type: 'spring', id: s.id });
          break;
        }
      }
    }

    // --- Gefahren
    const shrink = 2 + this.assist.hitboxShrink;
    const body = this.playerRect(shrink);
    const vulnerable = p.invulnerable <= 0;

    if (vulnerable) {
      const hz = this.hazardBuckets.query(body.x - 40, body.x + body.w + 40, this.seen, this.nextStamp(), this.tmp);
      for (let k = 0; k < hz.length; k++) {
        if (overlaps(body, this.level.hazards[hz[k]])) {
          this.die('hit');
          return;
        }
      }
      const fi = this.fireBuckets.query(body.x - 40, body.x + body.w + 40, this.seen, this.nextStamp(), this.tmp);
      for (let k = 0; k < fi.length; k++) {
        if (this.firePhase(fi[k]).phase === 'active' && overlaps(body, inset(this.fireRect(fi[k]), 4))) {
          this.die('hit');
          return;
        }
      }
    }

    const en = this.enemyBuckets.query(body.x - 80, body.x + body.w + 80, this.seen, this.nextStamp(), this.tmp);
    for (let k = 0; k < en.length; k++) {
      const i = en[k];
      if (this.defeated.has(i)) continue;
      const r = inset(this.enemyRect(i), 2);
      if (!overlaps(body, r)) continue;
      // Von oben draufgehüpft? Dann ist der Gegner besiegt.
      if (vyBefore > 0 && prevBottom <= r.y + 14) {
        this.defeated.add(i);
        p.vy = -PHYSICS.stompBounce;
        p.grounded = false;
        p.groundId = -1;
        p.jumpHeld = input.held;
        p.holdTime = 0;
        this.events.push({ type: 'stomp', id: i, x: r.x + r.w / 2, y: r.y });
      } else if (vulnerable) {
        this.die('hit');
        return;
      }
    }

    // --- Sammeln
    if (this.collectPickups) {
      const full = this.playerRect();
      const cx = full.x + full.w / 2;
      const co = this.coinBuckets.query(cx - 40, cx + 40, this.seen, this.nextStamp(), this.tmp);
      for (let k = 0; k < co.length; k++) {
        const c = this.level.coins[co[k]];
        if (!this.collectedCoins.has(c.id) && circleHitsRect(c.x, c.y, COLLECT.coinRadius, full)) {
          this.collectedCoins.add(c.id);
          this.events.push({ type: 'coin', id: c.id, x: c.x, y: c.y });
        }
      }
      const st = this.starBuckets.query(cx - 40, cx + 40, this.seen, this.nextStamp(), this.tmp);
      for (let k = 0; k < st.length; k++) {
        const c = this.level.stars[st[k]];
        if (!this.collectedStars.has(c.id) && circleHitsRect(c.x, c.y, COLLECT.starRadius, full)) {
          this.collectedStars.add(c.id);
          this.events.push({ type: 'star', id: c.id, x: c.x, y: c.y });
        }
      }
    }

    // --- Checkpoints
    const cps = this.level.checkpoints;
    for (let i = this.checkpointIndex + 1; i < cps.length; i++) {
      if (p.x >= cps[i].x && p.y <= cps[i].y + 1) {
        this.checkpointIndex = i;
        this.events.push({ type: 'checkpoint', index: i });
      } else break;
    }

    if (p.invulnerable > 0) p.invulnerable -= dt;

    // --- Sturz in einen Graben (zählt immer, auch wenn unverwundbar)
    if (p.y - PLAYER.hitboxH > WORLD_LIMITS.deathY) {
      this.die('fall');
      return;
    }

    if (p.x >= this.level.goalX) {
      this.status = 'complete';
      this.events.push({ type: 'complete' });
    }
  }

  /** Genau ein Todesereignis pro Tod – danach steht die Simulation, bis respawn() aufgerufen wird. */
  private die(cause: DeathCause): void {
    if (this.status !== 'running') return;
    this.status = 'dead';
    this.deaths++;
    this.lastDeath = cause;
    this.events.push({ type: 'death', cause, x: this.player.x, y: this.player.y });
  }

  /** Wiederaufnahmepunkt: letzter aktivierter Checkpoint, sonst der Levelstart. */
  respawnPoint(): { x: number; y: number } {
    if (this.checkpointIndex >= 0) {
      const cp = this.level.checkpoints[this.checkpointIndex];
      return { x: cp.x + 6, y: cp.y };
    }
    return { ...this.level.start };
  }

  /** Setzt den Helden sicher am Wiederaufnahmepunkt ab und macht ihn kurz unverwundbar. */
  respawn(): void {
    const pt = this.respawnPoint();
    this.player = this.makePlayer(pt.x, pt.y);
    this.player.invulnerable = this.assist.invulnerable;
    this.snapToGround();
    this.status = 'running';
    this.events = [];
  }

  /** Startet bei einem bestimmten Checkpoint (gespeicherter Fortschritt). */
  startAtCheckpoint(index: number): void {
    if (index < 0 || index >= this.level.checkpoints.length) return;
    this.checkpointIndex = index;
    this.respawn();
    this.player.invulnerable = 0;
  }

  setAssist(assist: Assist): void {
    this.assist = assist;
  }

  // ---------------------------------------------------------------- Für den Level-Löser

  snapshot(): SimSnapshot {
    return {
      t: this.t,
      player: { ...this.player },
      status: this.status,
      checkpointIndex: this.checkpointIndex,
      defeated: [...this.defeated],
      springCooldown: this.springCooldown,
    };
  }

  restore(s: SimSnapshot): void {
    this.t = s.t;
    this.player = { ...s.player };
    this.status = s.status;
    this.checkpointIndex = s.checkpointIndex;
    this.defeated.clear();
    for (const d of s.defeated) this.defeated.add(d);
    this.springCooldown = s.springCooldown;
    this.updateSolids();
    this.prevSolidX.set(this.solidX);
    this.prevSolidY.set(this.solidY);
    // Vorherige Positionen der beweglichen Plattformen rekonstruieren.
    const t = this.t;
    this.t = t - SIM_DT;
    this.updateSolids();
    this.prevSolidX.set(this.solidX);
    this.prevSolidY.set(this.solidY);
    this.t = t;
    this.updateSolids();
    this.events.length = 0;
  }
}
