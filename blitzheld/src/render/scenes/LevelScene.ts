import Phaser from 'phaser';
import { MAX_STEPS_PER_FRAME, PLAYER, SIM_DT, TIMING, VIEW, WORLD_LIMITS } from '../../config/gameConfig';
import type { Assist } from '../../config/difficulty';
import type { GameController, PlayScene } from '../../core/gameController';
import { LevelSimulation, type DeathCause, type SimEvent } from '../../game/levelSim';
import type { LevelDef, SolidDef } from '../../game/types';
import { ParallaxBackground } from '../backgrounds';
import { Effects } from '../effects';
import { HeroView } from '../hero';
import { THEMES } from '../textures';

interface InitData {
  controller: GameController;
  level: LevelDef;
  checkpoint: number;
}

interface FireView {
  flame: Phaser.GameObjects.Image;
  glow: Phaser.GameObjects.Image;
  nozzle: Phaser.GameObjects.Image;
}

const TEXT_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: 'Fredoka, "Trebuchet MS", sans-serif',
  fontSize: '19px',
  fontStyle: 'bold',
  color: '#2b1d3a',
  align: 'center',
  wordWrap: { width: 132 },
};

/**
 * Darstellung eines Levels. Die Spiellogik steckt in LevelSimulation; die Szene
 * führt sie mit fester Schrittweite aus, solange der Zustand PLAYING ist, und
 * zeichnet das Ergebnis.
 */
export class LevelScene extends Phaser.Scene implements PlayScene {
  private controller!: GameController;
  private level!: LevelDef;
  sim!: LevelSimulation;
  private hero!: HeroView;
  private bg!: ParallaxBackground;
  private fx!: Effects;
  private acc = 0;
  private time0 = 0;
  private clock = 0;

  private coinViews = new Map<number, Phaser.GameObjects.Image>();
  private starViews = new Map<number, Phaser.GameObjects.Image[]>();
  private enemyViews: Phaser.GameObjects.Image[] = [];
  private moverViews: { index: number; view: Phaser.GameObjects.Container | Phaser.GameObjects.Image }[] = [];
  private fireViews: FireView[] = [];
  private springViews: Phaser.GameObjects.Image[] = [];
  private cpViews: Phaser.GameObjects.Image[] = [];
  private goalView!: Phaser.GameObjects.Image;
  private arrowViews: Phaser.GameObjects.Image[] = [];
  private arrowBaseY: number[] = [];

  private readyT = -1;
  private readyLos = false;
  private dyingT = -1;
  private deathCause: DeathCause = 'hit';
  private deathPos = { x: 0, y: 0, vx: 0, vy: 0, spin: 0 };
  private victoryT = -1;
  private hintTimer = 0;
  private dustTimer = 0;
  private pit!: Phaser.GameObjects.TileSprite;
  private pitY = 478;
  private firstStart = true;

  constructor() {
    super('level');
  }

  init(data: InitData): void {
    this.controller = data.controller;
    this.level = data.level;
    this.acc = 0;
    this.clock = 0;
    this.readyT = -1;
    this.dyingT = -1;
    this.victoryT = -1;
    this.firstStart = true;
    this.coinViews = new Map();
    this.starViews = new Map();
    this.enemyViews = [];
    this.moverViews = [];
    this.fireViews = [];
    this.springViews = [];
    this.cpViews = [];
    this.arrowViews = [];
    this.arrowBaseY = [];
    this.sim = new LevelSimulation(this.level, this.controller.assist);
    if (data.checkpoint >= 0) this.sim.startAtCheckpoint(data.checkpoint);
    this.time0 = this.sim.t;
  }

  create(): void {
    const lv = this.level;
    const theme = THEMES[lv.theme];
    this.cameras.main.setBackgroundColor(theme.bg);
    this.bg = new ParallaxBackground(this, lv.theme);
    this.fx = new Effects(this, theme.dust);

    // Grabenboden (Wasser, Lava …) – sichtbar nur in Gräben. Bildschirmbreit, scrollt mit der Kamera.
    this.pitY = lv.theme === 'clouds' ? 520 : 478;
    this.pit = this.add.tileSprite(0, this.pitY, VIEW.width, 200, `${lv.theme}-pit`).setOrigin(0).setScrollFactor(0).setDepth(-50);

    lv.solids.forEach((s, i) => this.buildSolid(s, i));
    this.buildDecor();

    lv.hazards.forEach((h) => {
      this.add.image(h.x + h.w / 2, h.y + h.h + 1, `hz-${h.kind}`).setOrigin(0.5, 1).setDepth(10);
    });
    lv.springs.forEach((s) => {
      this.springViews.push(this.add.image(s.x + s.w / 2, s.y + s.h, 'spring').setOrigin(0.5, 1).setDepth(10));
    });
    lv.fires.forEach((f) => {
      const cx = f.x + f.w / 2;
      const glow = this.add.image(cx, f.groundY - 20, 'glow').setTint(0xff8a2a).setBlendMode(Phaser.BlendModes.ADD).setDepth(9);
      const flame = this.add.image(cx, f.groundY - 8, 'flame').setOrigin(0.5, 1).setDepth(11).setVisible(false);
      const nozzle = this.add.image(cx, f.groundY + 2, 'nozzle').setOrigin(0.5, 1).setDepth(12);
      this.fireViews.push({ flame, glow, nozzle });
    });
    lv.enemies.forEach((e) => {
      const key = e.kind === 'bat' || e.kind === 'bird' ? `en-${e.kind}-0` : `en-${e.kind}`;
      this.enemyViews.push(this.add.image(e.x + e.w / 2, e.y + e.h + 2, key).setOrigin(0.5, 1).setDepth(30));
    });
    lv.coins.forEach((c) => {
      this.coinViews.set(c.id, this.add.image(c.x, c.y, 'coin').setDepth(20));
    });
    lv.stars.forEach((s) => {
      const glow = this.add.image(s.x, s.y, 'glow').setScale(1.4).setTint(0xfff3a0).setBlendMode(Phaser.BlendModes.ADD).setDepth(19);
      const img = this.add.image(s.x, s.y, 'star').setDepth(21);
      this.starViews.set(s.id, [glow, img]);
    });
    lv.checkpoints.forEach((cp, i) => {
      const on = i <= this.sim.checkpointIndex;
      this.cpViews.push(this.add.image(cp.x, cp.y + 2, on ? 'cp-on' : 'cp-off').setOrigin(0.18, 1).setDepth(8));
    });
    const goalY = this.groundYAt(lv.goalX);
    this.goalView = this.add.image(lv.goalX + 30, goalY + 2, 'goal').setOrigin(0.5, 1).setDepth(7);

    this.buildHints();

    this.hero = new HeroView(this, this.sim.player.x, this.sim.player.y);

    const cam = this.cameras.main;
    cam.setScroll(this.sim.player.x - PLAYER.screenX, this.cameraTargetY());
    cam.roundPixels = false;

    this.controller.registerScene(this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.controller.ui.startHint(false);
      this.controller.ui.ready(null);
    });
    this.beginReady();
  }

  // ---------------------------------------------------------------- Aufbau

  private groundYAt(x: number): number {
    let best: number = WORLD_LIMITS.groundY;
    let found = false;
    for (const s of this.level.solids) {
      if ((s.kind === 'ground' || s.kind === 'cloud') && !s.move && x >= s.x && x <= s.x + s.w) {
        if (!found || s.y < best) best = s.y;
        found = true;
      }
    }
    return best;
  }

  /** Kachelfläche in Stücken von höchstens 512 px Breite (spart Speicher, bleibt unter der Texturgrenze). */
  private tiles(x: number, y: number, w: number, h: number, key: string, depth: number): void {
    for (let off = 0; off < w; off += 512) {
      const cw = Math.min(512, w - off);
      this.add.tileSprite(x + off, y, cw, h, key).setOrigin(0).setDepth(depth).setTilePosition(off % 64, 0);
    }
  }

  private buildSolid(s: SolidDef, index: number): void {
    const theme = this.level.theme;
    const c = THEMES[theme];
    const edge = Phaser.Display.Color.HexStringToColor(c.edge).color;
    if (s.kind === 'ground') {
      const bottom = 780;
      const band = Math.max(64, 576 - s.y);
      this.add.rectangle(s.x, s.y + 16, s.w, bottom - s.y, Phaser.Display.Color.HexStringToColor(c.groundFill2).color).setOrigin(0).setDepth(-11);
      this.tiles(s.x, s.y + 16, s.w, band, `${theme}-fill`, -10);
      this.tiles(s.x, s.y - 3, s.w, 26, `${theme}-top`, -9);
      this.add.rectangle(s.x, s.y + 4, 5, bottom - s.y, edge, 0.9).setOrigin(0).setDepth(-8);
      this.add.rectangle(s.x + s.w - 5, s.y + 4, 5, bottom - s.y, edge, 0.9).setOrigin(0).setDepth(-8);
      this.add.rectangle(s.x + 5, s.y + 22, s.w - 10, 6, 0x000000, 0.12).setOrigin(0).setDepth(-8);
      return;
    }
    if (s.kind === 'crate') {
      this.add.image(s.x, s.y, 'crate').setOrigin(0).setDepth(-5);
      return;
    }
    if (theme === 'clouds' || s.kind === 'cloud') {
      const img = this.add.image(s.x, s.y, this.cloudTexture(s.w, Math.max(28, s.h))).setOrigin(0).setDepth(s.move ? -6 : -9);
      if (s.move) this.moverViews.push({ index, view: img });
      return;
    }
    // Felsplatte oder bewegliche Plattform
    const container = this.add.container(s.x, s.y).setDepth(-6);
    const tile = this.add.tileSprite(0, 0, s.w, 28, `${theme}-ledge`).setOrigin(0);
    const g = this.add.graphics();
    g.lineStyle(3, edge, 1);
    g.strokeRoundedRect(0, 0, s.w, 28, 6);
    if (s.kind === 'mover') {
      g.fillStyle(0xffd23f, 1);
      g.fillCircle(10, 14, 4);
      g.fillCircle(s.w - 10, 14, 4);
    }
    container.add([tile, g]);
    if (s.move) this.moverViews.push({ index, view: container });
  }

  /** Wolke als einmal erzeugte Textur (statt sie jedes Bild neu zu zeichnen). */
  private cloudTexture(w: number, h: number): string {
    const key = `cloud-${Math.round(w)}x${Math.round(h)}`;
    if (this.textures.exists(key)) return key;
    const g = this.make.graphics({}, false);
    g.fillStyle(0x9fb4e0, 0.55);
    for (let px = 12; px <= w - 12; px += 22) g.fillCircle(px, h - 4 + 4, 14);
    g.fillStyle(0xffffff, 1);
    g.fillRoundedRect(0, 4, w, h - 10, Math.min(16, (h - 10) / 2));
    for (let px = 14; px <= w - 14; px += 26) g.fillCircle(px, 14, 14);
    g.fillStyle(0xe6f0ff, 1);
    g.fillRect(8, h - 14, w - 16, 6);
    g.generateTexture(key, Math.ceil(w), Math.ceil(h + 14));
    g.destroy();
    return key;
  }

  private buildDecor(): void {
    // Kleine Deko auf dem Boden (Blumen, Kristalle, Glut) – rein optisch, ohne Kollision.
    const lv = this.level;
    if (lv.theme === 'clouds') return;
    let seed = 7;
    const rnd = (): number => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (const s of lv.solids) {
      if (s.kind !== 'ground') continue;
      for (let x = s.x + 30; x < s.x + s.w - 30; x += 70 + rnd() * 120) {
        const blocked =
          lv.hazards.some((h) => Math.abs(h.x - x) < 60) ||
          lv.springs.some((sp) => Math.abs(sp.x - x) < 60) ||
          lv.fires.some((f) => Math.abs(f.x - x) < 60);
        if (blocked) continue;
        const key =
          lv.theme === 'meadow' ? `deco-flower-${Math.floor(rnd() * 4)}` : lv.theme === 'cave' ? `deco-crystal-${Math.floor(rnd() * 2)}` : 'deco-ember';
        this.add.image(x, s.y + 3, key).setOrigin(0.5, 1).setDepth(-7);
      }
    }
  }

  private buildHints(): void {
    const lv = this.level;
    for (const h of lv.hints) {
      const gy = this.groundYAt(h.x - 90);
      const x = h.x - 90;
      this.add.image(x, gy + 2, 'sign').setOrigin(0.5, 1).setDepth(6).setScale(0.95);
      this.add.text(x, gy - 64, h.text, TEXT_STYLE).setOrigin(0.5).setDepth(6);
    }
    // Im Hilfsmodus: Sprungpfeile vor jeder Gefahr.
    if (!this.controller.assist.showHints) return;
    const spots: number[] = [];
    lv.hazards.forEach((h) => spots.push(h.x));
    lv.fires.forEach((f) => spots.push(f.x));
    lv.enemies.forEach((e) => {
      if (!e.hover) spots.push(e.x);
    });
    const grounds = lv.solids.filter((s) => (s.kind === 'ground' || s.kind === 'cloud') && !s.move).sort((a, b) => a.x - b.x);
    for (let i = 0; i + 1 < grounds.length; i++) {
      const end = grounds[i].x + grounds[i].w;
      if (grounds[i + 1].x - end > 30) spots.push(end + 30);
    }
    for (const x of spots) {
      const ax = x - 80;
      const gy = this.groundYAt(ax);
      this.arrowViews.push(this.add.image(ax, gy - 34, 'arrow-up').setDepth(15).setAlpha(0.9));
      this.arrowBaseY.push(gy - 34);
    }
  }

  // ---------------------------------------------------------------- Ablauf

  private beginReady(): void {
    this.readyT = 0;
    this.readyLos = false;
    this.acc = 0;
    this.controller.ui.ready('Bereit?');
    if (this.firstStart) {
      this.controller.ui.startHint(true);
      this.hintTimer = 5;
    }
    this.firstStart = false;
  }

  respawn(): void {
    this.sim.setAssist(this.controller.assist);
    this.sim.respawn();
    this.hero.setVisible(true);
    this.hero.setAlpha(1);
    this.hero.root.setRotation(0);
    this.hero.setPosition(this.sim.player.x, this.sim.player.y);
    this.fx.sparkleAt(this.sim.player.x, this.sim.player.y - 30, 16);
    this.dyingT = -1;
    this.beginReady();
  }

  applyAssist(assist: Assist): void {
    this.sim.setAssist(assist);
  }

  playDeath(cause: DeathCause): void {
    const p = this.sim.player;
    this.dyingT = 0;
    this.deathCause = cause;
    this.deathPos = { x: p.x, y: p.y, vx: cause === 'hit' ? -150 : 0, vy: cause === 'hit' ? -480 : 0, spin: 0 };
    this.cameras.main.shake(220, 0.006);
    if (cause === 'hit') this.fx.sparkleAt(p.x + 10, p.y - 30, 12);
  }

  override update(_t: number, deltaMs: number): void {
    // Echte vergangene Zeit (Phasers geglättetes delta bremst bei niedriger Bildrate ab).
    const dt = Math.min((this.game.loop.rawDelta || deltaMs) / 1000, 0.1);
    this.clock += dt;
    const state = this.controller.state;
    const p = this.sim.player;

    if (state === 'PLAYING') {
      this.runSimulation(dt);
    } else if (state === 'RESPAWNING' && this.readyT >= 0) {
      this.readyT += dt;
      if (!this.readyLos && this.readyT >= TIMING.respawnReady * 0.55) {
        this.readyLos = true;
        this.controller.ui.flashReady('Los!', 600);
      }
      if (this.readyT >= TIMING.respawnReady) {
        this.readyT = -1;
        this.controller.onReadyDone();
      }
    }

    if (this.hintTimer > 0) {
      this.hintTimer -= dt;
      if (this.hintTimer <= 0) this.controller.ui.startHint(false);
    }

    // --- Held zeichnen
    if (this.dyingT >= 0) {
      this.updateDeath(dt);
    } else if (this.victoryT >= 0) {
      this.updateVictory(dt);
    } else {
      this.hero.setPosition(p.x, p.y);
      const running = state === 'PLAYING';
      const pose = !running ? 'idle' : p.grounded ? 'run' : p.vy < 0 ? 'jump' : 'fall';
      this.hero.update(dt, pose, this.level.speed * this.controller.assist.timeScale, p.vy);
      const blink = p.invulnerable > 0 && Math.floor(this.clock * 12) % 2 === 0;
      this.hero.setAlpha(blink ? 0.35 : 1);
      // Kleine Staubwölkchen beim Rennen
      if (running && p.grounded) {
        this.dustTimer -= dt;
        if (this.dustTimer <= 0) {
          this.dustTimer = 0.14;
          this.fx.dustAt(p.x - 12, p.y, 1);
        }
      }
    }

    this.updateWorldViews();
    this.updateCamera(dt);
    this.controller.ui.setProgress(this.sim.progress);
  }

  private runSimulation(dt: number): void {
    this.acc += dt * this.controller.assist.timeScale;
    let steps = 0;
    while (this.acc >= SIM_DT && steps < MAX_STEPS_PER_FRAME) {
      this.sim.step(this.controller.input.consume());
      this.acc -= SIM_DT;
      steps++;
      const stop = this.handleEvents(this.sim.drain());
      if (stop) {
        this.acc = 0;
        return;
      }
    }
    if (steps >= MAX_STEPS_PER_FRAME) this.acc = 0;
  }

  /** Verarbeitet Ereignisse; gibt true zurück, wenn die Simulation anhalten muss. */
  private handleEvents(events: SimEvent[]): boolean {
    const audio = this.controller.audio;
    for (const e of events) {
      switch (e.type) {
        case 'jump':
          audio.play('jump');
          this.hero.kick(0.28);
          this.fx.dustAt(e.x, e.y, 4);
          if (this.hintTimer > 0) {
            this.hintTimer = 0;
            this.controller.ui.startHint(false);
          }
          break;
        case 'land': {
          const k = Math.min(1, e.impact / 900);
          this.hero.kick(-0.35 * k - 0.05);
          if (e.impact > 250) {
            audio.play('land');
            this.fx.dustAt(e.x, e.y, Math.round(3 + k * 7));
          }
          if (e.impact > 1000) this.cameras.main.shake(120, 0.004);
          break;
        }
        case 'coin': {
          const v = this.coinViews.get(e.id);
          if (v) {
            this.coinViews.delete(e.id);
            this.tweens.add({ targets: v, y: v.y - 36, alpha: 0, scale: 1.4, duration: 260, onComplete: () => v.destroy() });
          }
          this.fx.sparkleAt(e.x, e.y, 5);
          audio.play('coin');
          this.controller.onCoin();
          break;
        }
        case 'star': {
          const vs = this.starViews.get(e.id);
          if (vs) {
            this.starViews.delete(e.id);
            this.tweens.add({ targets: vs, y: e.y - 60, alpha: 0, scale: 2, duration: 500, onComplete: () => vs.forEach((v) => v.destroy()) });
          }
          this.fx.sparkleAt(e.x, e.y, 22);
          this.fx.floatText(e.x, e.y - 30, 'Stern!', '#ffe14d', 30);
          audio.play('star');
          break;
        }
        case 'checkpoint': {
          const v = this.cpViews[e.index];
          if (v) {
            v.setTexture('cp-on');
            this.tweens.add({ targets: v, scaleY: { from: 0.7, to: 1 }, duration: 300, ease: 'Back.easeOut' });
            this.fx.sparkleAt(v.x + 20, v.y - 70, 14);
          }
          audio.play('checkpoint');
          this.controller.onCheckpoint(e.index);
          break;
        }
        case 'stomp': {
          const v = this.enemyViews[e.id];
          if (v) {
            this.tweens.add({ targets: v, scaleY: 0.2, scaleX: 1.4, alpha: 0, duration: 260, onComplete: () => v.setVisible(false) });
          }
          this.fx.poofAt(e.x, e.y + 10, 6);
          this.fx.floatText(e.x, e.y - 10, '+1', '#ffe14d');
          this.hero.kick(0.3);
          audio.play('stomp');
          this.controller.onStomp();
          break;
        }
        case 'spring': {
          const v = this.springViews[e.id];
          if (v) this.tweens.add({ targets: v, scaleY: { from: 0.45, to: 1 }, duration: 380, ease: 'Elastic.easeOut' });
          this.hero.kick(0.45);
          audio.play('spring');
          break;
        }
        case 'death':
          this.controller.onPlayerDeath(e.cause);
          return true;
        case 'complete':
          this.victoryT = 0;
          this.fx.confettiAt(this.level.goalX + 30, this.groundYAt(this.level.goalX) - 160, 80);
          this.tweens.add({ targets: this.goalView, scaleX: { from: 1.08, to: 1 }, scaleY: { from: 0.92, to: 1 }, duration: 500, ease: 'Elastic.easeOut' });
          this.controller.onLevelComplete({ starIds: [...this.sim.collectedStars], time: this.sim.t - this.time0 });
          return true;
      }
    }
    return false;
  }

  private updateDeath(dt: number): void {
    this.dyingT += dt;
    const d = this.deathPos;
    if (this.deathCause === 'hit') {
      // Harmlos zurückgeschleudert, dreht sich und verschwindet in einer Sternenwolke.
      if (this.dyingT < 0.55) {
        d.vy += 1600 * dt;
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        d.spin -= 9 * dt;
        this.hero.setPosition(d.x, d.y);
        this.hero.root.setRotation(d.spin);
        this.hero.update(dt, 'hurt', 0);
      } else if (this.hero.root.visible) {
        this.hero.setVisible(false);
        this.fx.poofAt(d.x, d.y - 25, 10);
        this.fx.sparkleAt(d.x, d.y - 25, 12);
      }
    } else {
      if (this.dyingT < 0.35) {
        d.vy = Math.min(900, d.vy + 2200 * dt);
        d.y += d.vy * dt;
        this.hero.setPosition(d.x, d.y);
        this.hero.update(dt, 'fall', 0, 900);
      } else if (this.hero.root.visible) {
        this.hero.setVisible(false);
        const splashY = this.level.theme === 'clouds' ? 520 : 490;
        this.fx.poofAt(d.x, Math.min(d.y, splashY), 10, Phaser.Display.Color.HexStringToColor(THEMES[this.level.theme].pit).color);
        this.fx.sparkleAt(d.x, Math.min(d.y, splashY) - 10, 8);
      }
    }
    if (this.dyingT >= TIMING.dying) {
      this.dyingT = -1;
      this.hero.root.setRotation(0);
      this.controller.onDeathAnimDone();
    }
  }

  private updateVictory(dt: number): void {
    this.victoryT += dt;
    const p = this.sim.player;
    if (this.victoryT < 0.7) {
      p.x += this.level.speed * 0.6 * dt * (1 - this.victoryT / 0.7);
      this.hero.setPosition(p.x, p.y);
      this.hero.update(dt, 'run', this.level.speed * 0.5);
    } else {
      const hop = Math.abs(Math.sin((this.victoryT - 0.7) * 5)) * 26;
      this.hero.setPosition(p.x, p.y - hop);
      this.hero.update(dt, 'cheer', 0);
      if (Math.random() < dt * 3) this.fx.confettiAt(p.x + Phaser.Math.Between(-200, 200), p.y - 250, 12);
    }
    this.hero.setAlpha(1);
  }

  private updateWorldViews(): void {
    const sim = this.sim;
    const cam = this.cameras.main;
    const left = cam.scrollX - 120;
    const right = cam.scrollX + VIEW.width + 120;

    for (const m of this.moverViews) {
      const r = sim.solidRect(m.index);
      m.view.setPosition(r.x, r.y);
    }
    this.level.enemies.forEach((e, i) => {
      const v = this.enemyViews[i];
      if (!v.visible || sim.defeated.has(i)) return;
      const r = sim.enemyRect(i);
      if (r.x + r.w < left || r.x > right) return;
      v.setPosition(r.x + r.w / 2, r.y + r.h + 2);
      if (e.kind === 'bat' || e.kind === 'bird') {
        v.setTexture(`en-${e.kind}-${Math.floor(this.clock * 7 + i) % 2}`);
      } else {
        const wob = Math.sin(this.clock * 8 + i) * 0.05;
        if (!this.tweens.isTweening(v)) v.setScale(1 + wob, 1 - wob);
      }
      v.setFlipX(sim.enemyFacing(i) > 0);
    });
    this.level.fires.forEach((f, i) => {
      const v = this.fireViews[i];
      if (f.x < left || f.x > right) return;
      const { phase, progress } = sim.firePhase(i);
      if (phase === 'warn') {
        // Blubbern und Glühen als Warnung – noch ungefährlich.
        v.flame.setVisible(true);
        const s = 0.18 + progress * 0.22 + Math.sin(this.clock * 30) * 0.04;
        v.flame.setScale(0.7, s);
        v.flame.setAlpha(0.75);
        v.glow.setAlpha(0.35 + progress * 0.5 + Math.sin(this.clock * 20) * 0.15);
        v.glow.setScale(1 + progress * 0.4);
        v.nozzle.setX(f.x + f.w / 2 + Math.sin(this.clock * 60) * progress * 2);
      } else if (phase === 'active') {
        v.flame.setVisible(true);
        const full = (f.h + 12) / 72;
        const grow = Math.min(1, progress * 6);
        v.flame.setScale(1 + Math.sin(this.clock * 25) * 0.06, full * grow * (1 + Math.sin(this.clock * 31) * 0.05));
        v.flame.setAlpha(1);
        v.glow.setAlpha(1);
        v.glow.setScale(1.8);
        v.nozzle.setX(f.x + f.w / 2);
      } else {
        v.flame.setVisible(false);
        v.glow.setAlpha(0.15);
        v.glow.setScale(0.8);
        v.nozzle.setX(f.x + f.w / 2);
      }
    });
    for (const [id, v] of this.coinViews) {
      if (v.x < left || v.x > right) continue;
      v.setScale(Math.abs(Math.cos(this.clock * 3.5 + id * 0.4)) * 0.85 + 0.15, 1);
    }
    for (const [, vs] of this.starViews) {
      const img = vs[1];
      if (img.x < left || img.x > right) continue;
      img.setRotation(Math.sin(this.clock * 2) * 0.18);
      vs[0].setAlpha(0.55 + Math.sin(this.clock * 4) * 0.25);
    }
    this.arrowViews.forEach((a, i) => a.setY(this.arrowBaseY[i] + Math.sin(this.clock * 6 + i) * 6));
  }

  private cameraTargetY(): number {
    const top = this.sim.player.y - PLAYER.hitboxH;
    return Phaser.Math.Clamp(top - 150, -280, 0);
  }

  private updateCamera(dt: number): void {
    const cam = this.cameras.main;
    const px = this.dyingT >= 0 ? this.deathPos.x : this.sim.player.x;
    const targetX = px - PLAYER.screenX;
    const k = 1 - Math.exp(-dt * (this.readyT >= 0 ? 6 : 12));
    cam.scrollX += (targetX - cam.scrollX) * k;
    if (this.dyingT < 0) cam.scrollY += (this.cameraTargetY() - cam.scrollY) * (1 - Math.exp(-dt * 5));
    this.bg.update(cam.scrollX, cam.scrollY, dt);
    this.pit.y = this.pitY - cam.scrollY;
    this.pit.tilePositionX = cam.scrollX + this.clock * 18;
  }
}
