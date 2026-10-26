import { BOSS_TIMING, type AttackKind, type BossDef } from './bossConfig';

/**
 * Logik eines Bosskampfs – rhythmisch und mit einer Taste spielbar:
 *
 * 1. Der Boss holt sichtbar aus (windup).
 * 2. Er wirft ein Geschoss, das auf den Helden zurollt (attack). Ein Ring zeigt,
 *    wann man springen muss; im grünen Zeitfenster gedrückt, springt der Held drüber.
 * 3. Nach genug Ausweichern ist der Boss benommen (dizzy). Jetzt drücken = Angriff.
 * 4. Jeder Angriff kostet den Boss einen Lebenspunkt. Bei 0 ist er besiegt.
 *
 * Verpasst das Kind ein Geschoss, verliert der Held einen von drei Energiepunkten.
 * Sind alle weg, meldet der Kampf heroDown – das zählt wie ein Tod (Mathefenster).
 * Danach geht der Kampf mit voller Energie weiter; der Boss behält seinen Schaden.
 */

export type BossPhase = 'intro' | 'windup' | 'attack' | 'dizzy' | 'strike' | 'hurt' | 'heroDown' | 'defeated';

export type BossEvent =
  | { type: 'windup'; attack: AttackKind }
  | { type: 'launch'; id: number }
  | { type: 'jump' }
  | { type: 'dodge'; id: number }
  | { type: 'hit'; id: number; energy: number }
  | { type: 'dizzy' }
  | { type: 'strike' }
  | { type: 'bossHurt'; hp: number }
  | { type: 'recover' }
  | { type: 'heroDown' }
  | { type: 'defeated' };

export interface Projectile {
  id: number;
  spawnT: number;
  impactT: number;
  kind: AttackKind;
  state: 'flying' | 'dodged' | 'hit';
}

export class BossFight {
  readonly def: BossDef;
  readonly help: boolean;
  t = 0;
  phase: BossPhase = 'intro';
  phaseStart = 0;
  bossHp: number;
  heroEnergy: number = BOSS_TIMING.heroEnergy;
  dodges = 0;
  projectiles: Projectile[] = [];
  heroJumpStart = -10;
  events: BossEvent[] = [];
  /** Statistik für Tests und Auswertung. */
  readonly stats = { dodged: 0, hits: 0, strikes: 0, attacks: 0 };

  private patternIndex = 0;
  private nextId = 1;
  private currentAttack: AttackKind = 'roll';

  constructor(def: BossDef, help = false) {
    this.def = def;
    this.help = help;
    this.bossHp = def.hp;
  }

  get travel(): number {
    return this.def.travel * (this.help ? BOSS_TIMING.helpTravelFactor : 1);
  }

  get windup(): number {
    return this.def.windup * (this.help ? BOSS_TIMING.helpWindupFactor : 1);
  }

  get jumpDuration(): number {
    return this.help ? BOSS_TIMING.heroJumpHelp : BOSS_TIMING.heroJump;
  }

  get attackWindow(): number {
    return this.help ? BOSS_TIMING.attackWindowHelp : BOSS_TIMING.attackWindow;
  }

  get phaseTime(): number {
    return this.t - this.phaseStart;
  }

  get heroAirborne(): boolean {
    return this.t >= this.heroJumpStart && this.t < this.heroJumpStart + this.jumpDuration;
  }

  /** Sprunghöhe des Helden 0..1 (für die Grafik). */
  get heroJumpHeight(): number {
    if (!this.heroAirborne) return 0;
    const k = (this.t - this.heroJumpStart) / this.jumpDuration;
    return 4 * k * (1 - k);
  }

  get currentAttackKind(): AttackKind {
    return this.currentAttack;
  }

  /** Zeitfenster, in dem ein Sprung dieses Geschoss sicher überspringt. */
  dodgeWindow(p: Projectile): { from: number; to: number } {
    return { from: p.impactT + BOSS_TIMING.overlap - this.jumpDuration, to: p.impactT - BOSS_TIMING.overlap };
  }

  /** 'early' | 'now' | 'late' – für das Signal am Helden. */
  signalFor(p: Projectile): 'early' | 'now' | 'late' {
    const w = this.dodgeWindow(p);
    if (this.t < w.from) return 'early';
    if (this.t <= w.to) return 'now';
    return 'late';
  }

  /** Fortschritt des Geschosses vom Boss (0) zum Helden (1); danach fliegt es weiter. */
  projectileProgress(p: Projectile): number {
    return (this.t - p.spawnT) / (p.impactT - p.spawnT);
  }

  private setPhase(phase: BossPhase): void {
    this.phase = phase;
    this.phaseStart = this.t;
  }

  private startWindup(): void {
    this.currentAttack = this.def.pattern[this.patternIndex % this.def.pattern.length];
    this.patternIndex++;
    this.setPhase('windup');
    this.events.push({ type: 'windup', attack: this.currentAttack });
  }

  private launch(): void {
    this.setPhase('attack');
    this.stats.attacks++;
    const travel = this.currentAttack === 'fast' ? this.travel * BOSS_TIMING.fastFactor : this.travel;
    const spawn = (offset: number): void => {
      const id = this.nextId++;
      this.projectiles.push({
        id,
        spawnT: this.t + offset,
        impactT: this.t + offset + travel,
        kind: this.currentAttack,
        state: 'flying',
      });
    };
    spawn(0);
    if (this.currentAttack === 'double') spawn(BOSS_TIMING.doubleGap);
    this.events.push({ type: 'launch', id: this.projectiles[this.projectiles.length - 1].id });
  }

  /** Die eine Aktionstaste: springen bzw. angreifen. */
  press(): void {
    switch (this.phase) {
      case 'windup':
      case 'attack':
        if (!this.heroAirborne) {
          this.heroJumpStart = this.t;
          this.events.push({ type: 'jump' });
        }
        break;
      case 'dizzy':
        this.setPhase('strike');
        this.stats.strikes++;
        this.events.push({ type: 'strike' });
        break;
      default:
        break;
    }
  }

  update(dt: number): void {
    if (this.phase === 'heroDown' || this.phase === 'defeated') {
      this.t += dt;
      return;
    }
    this.t += dt;
    switch (this.phase) {
      case 'intro':
        if (this.phaseTime >= BOSS_TIMING.intro) this.startWindup();
        break;
      case 'windup':
        if (this.phaseTime >= this.windup) this.launch();
        break;
      case 'attack':
        this.updateAttack();
        break;
      case 'dizzy':
        if (this.phaseTime >= this.attackWindow) {
          // Chance verpasst – keine Strafe, nach dem nächsten Ausweichen kommt die nächste.
          this.dodges = this.def.dodgesPerOpening - 1;
          this.events.push({ type: 'recover' });
          this.startWindup();
        }
        break;
      case 'strike':
        if (this.phaseTime >= BOSS_TIMING.strike) {
          this.bossHp--;
          this.events.push({ type: 'bossHurt', hp: this.bossHp });
          this.dodges = 0;
          if (this.bossHp <= 0) {
            this.setPhase('defeated');
            this.events.push({ type: 'defeated' });
          } else {
            this.startWindup();
          }
        }
        break;
      case 'hurt':
        if (this.phaseTime >= BOSS_TIMING.heroHit) this.startWindup();
        break;
    }
    this.projectiles = this.projectiles.filter((p) => this.t < p.impactT + 1.2);
  }

  private updateAttack(): void {
    const ov = BOSS_TIMING.overlap;
    for (const p of this.projectiles) {
      if (p.state !== 'flying' || this.t < p.impactT - ov) continue;
      const safe = this.heroJumpStart <= p.impactT - ov && this.heroJumpStart + this.jumpDuration >= p.impactT + ov;
      if (safe) {
        p.state = 'dodged';
        this.dodges++;
        this.stats.dodged++;
        this.events.push({ type: 'dodge', id: p.id });
      } else {
        p.state = 'hit';
        this.stats.hits++;
        this.heroEnergy = Math.max(0, this.heroEnergy - 1);
        this.events.push({ type: 'hit', id: p.id, energy: this.heroEnergy });
        // Weitere Geschosse dieses Angriffs verschwinden – der Held bekommt eine Verschnaufpause.
        for (const q of this.projectiles) if (q.state === 'flying') q.state = 'dodged';
        if (this.heroEnergy <= 0) {
          this.setPhase('heroDown');
          this.events.push({ type: 'heroDown' });
        } else {
          this.setPhase('hurt');
        }
        return;
      }
    }
    const lastImpact = Math.max(...this.projectiles.map((p) => p.impactT), 0);
    if (this.projectiles.every((p) => p.state !== 'flying') && this.t >= lastImpact + BOSS_TIMING.feedback) {
      if (this.dodges >= this.def.dodgesPerOpening) {
        this.setPhase('dizzy');
        this.events.push({ type: 'dizzy' });
      } else {
        this.startWindup();
      }
    }
  }

  /** Nach dem Mathefenster: volle Energie, der Boss behält seinen Schaden. */
  reviveHero(): void {
    if (this.phase !== 'heroDown') return;
    this.heroEnergy = BOSS_TIMING.heroEnergy;
    this.projectiles = [];
    this.heroJumpStart = -10;
    this.dodges = Math.min(this.dodges, this.def.dodgesPerOpening - 1);
    this.setPhase('hurt');
  }

  drain(): BossEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }
}
