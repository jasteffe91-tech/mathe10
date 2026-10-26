import Phaser from 'phaser';
import { TIMING, VIEW, WORLD_LIMITS } from '../../config/gameConfig';
import type { Assist } from '../../config/difficulty';
import type { GameController, PlayScene } from '../../core/gameController';
import { BossFight, type BossEvent, type Projectile } from '../../boss/bossFight';
import { BOSS_TIMING, type BossDef } from '../../boss/bossConfig';
import type { DeathCause } from '../../game/levelSim';
import { ParallaxBackground } from '../backgrounds';
import { Effects } from '../effects';
import { HeroView } from '../hero';
import { THEMES } from '../textures';
import { BOSS_LOOKS } from '../bossArt';

interface InitData {
  controller: GameController;
  boss: BossDef;
}

const HERO_X = 220;
const BOSS_X = 760;
const GROUND = WORLD_LIMITS.groundY;
const JUMP_HEIGHT = 150;

/**
 * Bosskampf: rhythmisch, mit einer Taste. Die Logik steckt in BossFight; die Szene zeigt
 * Ausholen, Wurf, das Sprung-Signal am Helden, den Angriff und den Sieg.
 */
export class BossScene extends Phaser.Scene implements PlayScene {
  private controller!: GameController;
  private def!: BossDef;
  fight!: BossFight;
  private hero!: HeroView;
  private fx!: Effects;
  private bg!: ParallaxBackground;
  private bossRoot!: Phaser.GameObjects.Container;
  private bossBody!: Phaser.GameObjects.Image;
  private eyes: Phaser.GameObjects.Image[] = [];
  private alert!: Phaser.GameObjects.Image;
  private dizzyStars: Phaser.GameObjects.Image[] = [];
  private ring!: Phaser.GameObjects.Graphics;
  private signalText!: Phaser.GameObjects.Text;
  private projViews = new Map<number, Phaser.GameObjects.Image>();
  private clock = 0;
  private readyT = -1;
  private readyLos = false;
  private dyingT = -1;
  private heroHurtT = -1;
  private strikeT = -1;
  private defeatedT = -1;
  private intro = true;

  constructor() {
    super('boss');
  }

  init(data: InitData): void {
    this.controller = data.controller;
    this.def = data.boss;
    this.fight = new BossFight(this.def, this.controller.helpMode);
    this.projViews = new Map();
    this.eyes = [];
    this.dizzyStars = [];
    this.clock = 0;
    this.readyT = -1;
    this.dyingT = -1;
    this.heroHurtT = -1;
    this.strikeT = -1;
    this.defeatedT = -1;
    this.intro = true;
  }

  create(): void {
    const theme = THEMES[this.def.theme];
    this.cameras.main.setBackgroundColor(theme.bg);
    this.bg = new ParallaxBackground(this, this.def.theme);
    this.bg.update(0, 0, 0);
    this.fx = new Effects(this, theme.dust);

    // Arena-Boden
    if (this.def.theme === 'clouds') {
      const g = this.add.graphics().setDepth(-9);
      g.fillStyle(0xffffff, 1);
      g.fillRoundedRect(-20, GROUND + 4, VIEW.width + 40, 80, 20);
      for (let x = 0; x <= VIEW.width; x += 40) g.fillCircle(x, GROUND + 10, 22);
    } else {
      this.add.tileSprite(0, GROUND + 16, VIEW.width, VIEW.height - GROUND, `${this.def.theme}-fill`).setOrigin(0).setDepth(-10);
      this.add.tileSprite(0, GROUND - 3, VIEW.width, 26, `${this.def.theme}-top`).setOrigin(0).setDepth(-9);
    }

    const look = BOSS_LOOKS[this.def.id];
    this.bossRoot = this.add.container(BOSS_X, GROUND + 4).setDepth(30);
    this.bossBody = this.add.image(0, 0, look.body).setOrigin(0.5, 1);
    const e1 = this.add.image(look.eyeX - look.eyeGap / 2, look.eyeY, 'boss-eye');
    const e2 = this.add.image(look.eyeX + look.eyeGap / 2, look.eyeY, 'boss-eye').setFlipX(true);
    this.eyes = [e1, e2];
    this.alert = this.add.image(-20, -250, 'bubble-alert').setVisible(false);
    this.bossRoot.add([this.bossBody, e1, e2, this.alert]);
    for (let i = 0; i < 4; i++) {
      const s = this.add.image(BOSS_X, GROUND - 200, 'p-spark').setTint(0xffe14d).setScale(1.4).setDepth(40).setVisible(false);
      this.dizzyStars.push(s);
    }

    this.hero = new HeroView(this, HERO_X, GROUND);
    this.ring = this.add.graphics().setDepth(45);
    this.signalText = this.add
      .text(HERO_X, GROUND - 150, 'Spring!', {
        fontFamily: 'Fredoka, "Trebuchet MS", sans-serif',
        fontSize: '34px',
        fontStyle: 'bold',
        color: '#3ddc84',
        stroke: '#2b1d3a',
        strokeThickness: 7,
      })
      .setOrigin(0.5)
      .setDepth(70)
      .setVisible(false);

    this.controller.ui.setBoss(this.def.name, this.fight.bossHp, this.def.hp);
    this.controller.ui.setEnergy(this.fight.heroEnergy, BOSS_TIMING.heroEnergy);
    this.controller.registerScene(this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.controller.ui.ready(null));
    this.beginReady();
  }

  private beginReady(): void {
    this.readyT = 0;
    this.readyLos = false;
    this.controller.ui.ready(this.intro ? this.def.title : 'Weiter geht’s!', true);
  }

  private get readyDuration(): number {
    return this.intro ? 2.2 : TIMING.respawnReady;
  }

  respawn(): void {
    this.fight.reviveHero();
    this.controller.ui.setEnergy(this.fight.heroEnergy, BOSS_TIMING.heroEnergy);
    this.hero.setVisible(true);
    this.hero.root.setRotation(0);
    this.hero.setPosition(HERO_X, GROUND);
    this.fx.sparkleAt(HERO_X, GROUND - 30, 16);
    this.projViews.forEach((v) => v.destroy());
    this.projViews.clear();
    this.dyingT = -1;
    this.beginReady();
  }

  applyAssist(_assist: Assist): void {
    // Der Bosskampf nutzt die Zeitskala direkt aus dem Controller.
  }

  playDeath(_cause: DeathCause): void {
    this.dyingT = 0;
    this.cameras.main.shake(260, 0.008);
  }

  override update(_t: number, deltaMs: number): void {
    // Echte vergangene Zeit (Phasers geglättetes delta bremst bei niedriger Bildrate ab).
    const dt = Math.min((this.game.loop.rawDelta || deltaMs) / 1000, 0.1);
    this.clock += dt;
    const state = this.controller.state;

    if (state === 'RESPAWNING' && this.readyT >= 0) {
      this.readyT += dt;
      if (!this.readyLos && this.readyT >= this.readyDuration * 0.6) {
        this.readyLos = true;
        this.controller.ui.flashReady('Los!', 600);
      }
      if (this.readyT >= this.readyDuration) {
        this.readyT = -1;
        this.intro = false;
        this.controller.onReadyDone();
      }
    }

    if (state === 'BOSS_FIGHT') {
      if (this.controller.input.consume().pressed) this.fight.press();
      this.fight.update(dt * this.controller.assist.timeScale);
      this.handleEvents(this.fight.drain());
    } else if (state === 'LEVEL_COMPLETE') {
      this.fight.update(dt);
    }

    this.render(dt);
  }

  private handleEvents(events: BossEvent[]): void {
    const audio = this.controller.audio;
    for (const e of events) {
      switch (e.type) {
        case 'windup':
          audio.play('bossWindup');
          this.alert.setVisible(true).setScale(0);
          this.tweens.add({ targets: this.alert, scale: 1, duration: 260, ease: 'Back.easeOut' });
          break;
        case 'launch': {
          audio.play('bossAttack');
          this.alert.setVisible(false);
          this.tweens.add({ targets: this.bossRoot, x: BOSS_X - 30, duration: 120, yoyo: true, ease: 'Quad.easeOut' });
          break;
        }
        case 'jump':
          audio.play('jump');
          this.hero.kick(0.3);
          this.fx.dustAt(HERO_X, GROUND, 5);
          break;
        case 'dodge':
          audio.play('dodge');
          this.fx.sparkleAt(HERO_X, GROUND - 60, 10);
          this.fx.floatText(HERO_X, GROUND - 170, 'Super!', '#3ddc84', 30);
          break;
        case 'hit':
          audio.play('hurt');
          this.heroHurtT = 0;
          this.cameras.main.shake(200, 0.006);
          this.fx.poofAt(HERO_X + 20, GROUND - 30, 6);
          this.fx.floatText(HERO_X, GROUND - 150, 'Autsch!', '#ff8a8a', 28);
          this.controller.ui.setEnergy(e.energy, BOSS_TIMING.heroEnergy);
          break;
        case 'dizzy':
          this.controller.ui.ready(this.controller.ui.isTouch ? 'Jetzt angreifen! Tippen!' : 'Jetzt angreifen! Leertaste!', true);
          this.eyes.forEach((eye) => eye.setTexture('boss-eye-dizzy'));
          break;
        case 'recover':
          this.controller.ui.ready(null);
          this.eyes.forEach((eye) => eye.setTexture('boss-eye'));
          break;
        case 'strike':
          this.controller.ui.ready(null);
          this.strikeT = 0;
          audio.play('stomp');
          break;
        case 'bossHurt':
          audio.play('bossHurt');
          this.controller.ui.setBoss(this.def.name, e.hp, this.def.hp);
          this.eyes.forEach((eye) => eye.setTexture('boss-eye-hurt'));
          this.time.delayedCall(700, () => {
            if (this.fight.phase !== 'defeated' && this.fight.phase !== 'dizzy') this.eyes.forEach((eye) => eye.setTexture('boss-eye'));
          });
          this.bossBody.setTintFill(0xffffff);
          this.time.delayedCall(120, () => this.bossBody.clearTint());
          this.cameras.main.shake(260, 0.01);
          this.fx.sparkleAt(BOSS_X - 40, GROUND - 120, 24);
          this.fx.floatText(BOSS_X - 40, GROUND - 230, 'Treffer!', '#ffe14d', 34);
          break;
        case 'heroDown':
          this.controller.onPlayerDeath('hit');
          break;
        case 'defeated':
          this.defeatedT = 0;
          this.eyes.forEach((eye) => eye.setTexture('boss-eye-happy'));
          this.fx.confettiAt(BOSS_X, GROUND - 200, 100);
          this.controller.onBossDefeated();
          break;
      }
    }
  }

  private render(dt: number): void {
    const f = this.fight;
    // --- Held
    let heroX = HERO_X;
    let heroY = GROUND - f.heroJumpHeight * JUMP_HEIGHT;
    let pose: 'run' | 'jump' | 'fall' | 'idle' | 'cheer' | 'hurt' = 'run';
    if (f.heroAirborne) pose = f.heroJumpHeight > 0 && f.t - f.heroJumpStart < f.jumpDuration / 2 ? 'jump' : 'fall';
    if (this.strikeT >= 0) {
      this.strikeT += dt;
      const k = this.strikeT / BOSS_TIMING.strike;
      const out = k < 0.45 ? k / 0.45 : k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4;
      heroX = HERO_X + (BOSS_X - 150 - HERO_X) * Phaser.Math.Easing.Quadratic.InOut(Math.max(0, Math.min(1, out)));
      heroY = GROUND - Math.sin(Math.min(1, out) * Math.PI) * 60;
      pose = 'jump';
      if (Math.random() < 0.6) this.fx.sparkleAt(heroX - 20, heroY - 30, 1);
      if (k >= 1) this.strikeT = -1;
    }
    if (this.heroHurtT >= 0) {
      this.heroHurtT += dt;
      pose = 'hurt';
      heroX = HERO_X - Math.sin(Math.min(1, this.heroHurtT / 0.4) * Math.PI) * 30;
      if (this.heroHurtT > 0.6) this.heroHurtT = -1;
    }
    if (this.defeatedT >= 0) pose = 'cheer';
    if (this.controller.state === 'RESPAWNING' || this.controller.state === 'PAUSED') pose = f.phase === 'intro' ? 'idle' : pose;

    if (this.dyingT >= 0) {
      this.dyingT += dt;
      if (this.dyingT < 0.5) {
        this.hero.update(dt, 'hurt', 0);
        this.hero.root.setRotation(-this.dyingT * 8);
        this.hero.setPosition(HERO_X - this.dyingT * 120, GROUND - Math.sin(this.dyingT * Math.PI * 2) * 60);
      } else if (this.hero.root.visible) {
        this.hero.setVisible(false);
        this.fx.poofAt(HERO_X - 60, GROUND - 40, 10);
      }
      if (this.dyingT >= TIMING.dying) {
        this.dyingT = -1;
        this.hero.root.setRotation(0);
        this.controller.onDeathAnimDone();
      }
    } else {
      this.hero.setPosition(heroX, heroY);
      this.hero.update(dt, pose, pose === 'run' ? 200 : 0, f.heroJumpHeight > 0 ? 300 : 0);
      const blink = this.heroHurtT >= 0 && Math.floor(this.clock * 14) % 2 === 0;
      this.hero.setAlpha(blink ? 0.4 : 1);
    }

    // --- Boss
    const idle = Math.sin(this.clock * 2.5);
    let sx = 1 + idle * 0.02;
    let sy = 1 - idle * 0.02;
    let rot = 0;
    if (f.phase === 'windup') {
      const k = f.phaseTime / f.windup;
      sx = 1 - k * 0.08;
      sy = 1 + k * 0.1;
      rot = 0.08 * k + Math.sin(this.clock * 40) * 0.015 * k;
      this.alert.setY(-250 + Math.sin(this.clock * 10) * 4);
    } else if (f.phase === 'dizzy') {
      rot = Math.sin(this.clock * 4) * 0.08;
    }
    if (this.defeatedT >= 0) {
      this.defeatedT += dt;
      const k = Math.min(1, this.defeatedT / 1.4);
      sx = sy = 1 - k * 0.45;
      rot = Math.sin(this.clock * 10) * 0.2 * (1 - k);
      this.bossRoot.y = GROUND + 4 - Math.abs(Math.sin(this.defeatedT * 5)) * 20 * (1 - k);
      if (Math.random() < dt * 4) this.fx.heartsAt(BOSS_X, GROUND - 120, 2);
      if (Math.random() < dt * 2) this.fx.confettiAt(Phaser.Math.Between(300, 800), 60, 14);
    }
    this.bossRoot.setScale(sx, sy);
    this.bossRoot.setRotation(rot);
    // Blinzeln
    const blinkBoss = f.phase !== 'dizzy' && this.defeatedT < 0 && this.clock % 3.2 < 0.12;
    this.eyes.forEach((e) => e.setScale(1, blinkBoss ? 0.15 : 1));

    // Benommenheits-Sterne
    this.dizzyStars.forEach((s, i) => {
      const on = f.phase === 'dizzy';
      s.setVisible(on);
      if (on) {
        const a = this.clock * 4 + (i * Math.PI) / 2;
        s.setPosition(BOSS_X - 10 + Math.cos(a) * 70, GROUND - 230 + Math.sin(a) * 18);
      }
    });

    // --- Geschosse
    const alive = new Set<number>();
    for (const p of f.projectiles) {
      alive.add(p.id);
      let v = this.projViews.get(p.id);
      const prog = f.projectileProgress(p);
      if (prog < 0) continue;
      if (!v) {
        v = this.add.image(BOSS_X - 90, GROUND - 24, BOSS_LOOKS[this.def.id].projectile).setDepth(35);
        this.projViews.set(p.id, v);
      }
      this.placeProjectile(v, p, prog);
    }
    for (const [id, v] of this.projViews) {
      if (!alive.has(id)) {
        v.destroy();
        this.projViews.delete(id);
      }
    }

    // --- Sprung-Signal am Helden
    this.ring.clear();
    this.signalText.setVisible(false);
    const next = f.projectiles.filter((p) => p.state === 'flying').sort((a, b) => a.impactT - b.impactT)[0];
    if (next && this.controller.state === 'BOSS_FIGHT') {
      const w = f.dodgeWindow(next);
      const signal = f.signalFor(next);
      const cy = GROUND - 34;
      if (signal === 'early') {
        const span = Math.max(0.3, (w.from - next.spawnT) * 0.6);
        const k = Phaser.Math.Clamp((w.from - f.t) / span, 0, 1);
        if (k < 1) {
          this.ring.lineStyle(6, 0xffd23f, 0.9);
          this.ring.strokeCircle(HERO_X, cy, 48 + k * 110);
          this.ring.lineStyle(4, 0xffffff, 0.9);
          this.ring.strokeCircle(HERO_X, cy, 48);
        }
      } else if (signal === 'now') {
        const pulse = 1 + Math.sin(this.clock * 20) * 0.06;
        this.ring.fillStyle(0x3ddc84, 0.3);
        this.ring.fillCircle(HERO_X, cy, 52 * pulse);
        this.ring.lineStyle(7, 0x3ddc84, 1);
        this.ring.strokeCircle(HERO_X, cy, 52 * pulse);
        if (!f.heroAirborne) {
          this.signalText.setVisible(true).setScale(pulse);
        }
      }
    }

    this.bg.update(this.clock * 30, 0, dt);
  }

  private placeProjectile(v: Phaser.GameObjects.Image, p: Projectile, prog: number): void {
    const startX = BOSS_X - 90;
    const x = startX + (HERO_X - startX) * prog;
    let y = GROUND - 24;
    if (p.kind === 'bounce') y -= Math.abs(Math.sin(prog * Math.PI * 3)) * 70 * Math.max(0, 1 - prog * 0.9);
    v.setPosition(x, y);
    v.setRotation(-prog * 14);
    const signal = this.fight.signalFor(p);
    if (p.state === 'flying' && signal === 'now') v.setTint(0xb8ffcf);
    else v.clearTint();
    v.setAlpha(p.state === 'dodged' && prog > 1.15 ? Math.max(0, 1 - (prog - 1.15) * 3) : 1);
  }
}
