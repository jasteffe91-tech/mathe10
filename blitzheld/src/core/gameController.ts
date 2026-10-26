import type Phaser from 'phaser';
import { LIVES, REWARDS } from '../config/gameConfig';
import { computeAssist, type Assist } from '../config/difficulty';
import { GameStateMachine, type GameState } from './stateMachine';
import { InputController } from './input';
import { createRng } from './rng';
import { AudioManager } from '../audio/audio';
import { UI, type UIAction } from '../ui/ui';
import { MathChallenge, tierFor, updateStats } from '../math/mathChallenge';
import { MathTaskGenerator } from '../math/mathTasks';
import { LEVELS_PER_WORLD, WORLD_COUNT, levelId, type ProgressStore, type Stage } from '../progress/saveData';
import { getLevel, WORLD_NAMES, WORLD_THEMES } from '../levels/catalog';
import { bossForWorld } from '../boss/bossConfig';
import type { DeathCause } from '../game/levelSim';
import type { LevelDef } from '../game/types';
import { ICONS } from '../ui/icons';

/** Laufende Etappe (Level oder Bosskampf). */
export interface Session {
  stage: Stage;
  level: LevelDef | null;
  lives: number;
  coins: number;
  deathsInStage: number;
  /** Beim Start zu verwendender Checkpoint (−1 = Levelanfang). */
  startCheckpoint: number;
  /** Ergebnis der letzten abgeschlossenen Etappe. */
  lastResult: { starIds: number[]; time: number } | null;
}

/** Schnittstelle, die Level- und Bossszene dem Controller anbieten. */
export interface PlayScene {
  /** Nach dem Mathefenster: Held sicher wieder absetzen und „Bereit? Los!“ zeigen. */
  respawn(): void;
  /** Todesanimation abspielen; danach host.onDeathAnimDone() aufrufen. */
  playDeath(cause: DeathCause): void;
  /** Erleichterungen geändert. */
  applyAssist(assist: Assist): void;
}

export class GameController {
  readonly sm = new GameStateMachine();
  readonly input = new InputController();
  readonly ui = new UI();
  readonly audio: AudioManager;
  readonly mathGen: MathTaskGenerator;
  session: Session | null = null;
  math: MathChallenge | null = null;
  private game: Phaser.Game | null = null;
  private activeScene: PlayScene | null = null;
  private pendingConfirm: (() => void) | null = null;
  private rotateDismissed = false;
  /** Gesamtzahl der Tode (für Tests). */
  totalDeaths = 0;

  constructor(readonly progress: ProgressStore) {
    const s = progress.data.settings;
    this.audio = new AudioManager(s.sound, s.music);
    this.mathGen = new MathTaskGenerator(createRng((Date.now() ^ 0x5bd1e995) >>> 0));
    this.ui.onAction((a) => this.handleAction(a));
    this.ui.setSoundLabel(s.sound);
    this.ui.setHelpMode(s.helpMode);
    this.input.onPause = () => this.pause();
    this.sm.onChange((to) => this.onStateChange(to));

    // Ton erst nach der ersten Nutzeraktion freischalten (kein automatischer Ton).
    const unlock = (): void => this.audio.unlock();
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock);

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.pause();
        this.audio.suspend();
      } else {
        this.audio.resume();
      }
    });
    const checkRotate = (): void => this.checkOrientation();
    window.addEventListener('resize', checkRotate);
    window.addEventListener('orientationchange', checkRotate);
  }

  attachGame(game: Phaser.Game, gameEl: HTMLElement, jumpBtn: HTMLElement): void {
    this.game = game;
    this.input.attach(gameEl);
    this.input.attachButton(jumpBtn);
  }

  get state(): GameState {
    return this.sm.state;
  }

  get helpMode(): boolean {
    return this.progress.data.settings.helpMode;
  }

  get assist(): Assist {
    return computeAssist(this.helpMode, this.session?.deathsInStage ?? 0);
  }

  registerScene(scene: PlayScene | null): void {
    this.activeScene = scene;
  }

  private onStateChange(to: GameState): void {
    // Sprungeingaben nur im Spiel und beim Bosskampf – nie während des Mathefensters.
    const play = to === 'PLAYING' || to === 'BOSS_FIGHT' || to === 'RESPAWNING';
    this.input.setEnabled(play);
    this.ui.showHud(to !== 'MENU' && to !== 'GAME_COMPLETE');
    if (play && document.activeElement instanceof HTMLElement) document.activeElement.blur();
  }

  // ---------------------------------------------------------------- Menü

  showMenu(): void {
    this.ui.hideAll();
    this.ui.renderMenu(this.progress);
    this.ui.show('menu');
    this.audio.music('menu');
    this.checkOrientation();
  }

  private checkOrientation(): void {
    const portrait = window.innerHeight > window.innerWidth * 1.1 && window.innerWidth < 900;
    if (portrait && !this.rotateDismissed) this.ui.show('rotate');
    else this.ui.hide('rotate');
  }

  private toMenu(): void {
    if (this.sm.state !== 'MENU' && !this.sm.transition('MENU')) return;
    this.math = null;
    this.ui.closeMath();
    this.session = null;
    this.activeScene = null;
    this.stopPlayScenes();
    if (this.game && !this.game.scene.isActive('menu')) this.game.scene.start('menu');
    this.showMenu();
  }

  /** Beendet Level- und Bossszene – auch wenn sie gerade pausiert sind. */
  private stopPlayScenes(): void {
    const g = this.game;
    if (!g) return;
    for (const key of ['level', 'boss']) {
      if (g.scene.isActive(key) || g.scene.isPaused(key) || g.scene.isSleeping(key)) g.scene.stop(key);
    }
    this.ui.startHint(false);
    this.ui.ready(null);
  }

  // ---------------------------------------------------------------- Etappen

  /** Startet ein Level oder einen Bosskampf. Alle Starts laufen über RESPAWNING („Bereit? Los!“). */
  startStage(stage: Stage, opts: { useSavedCheckpoint?: boolean; keepDeaths?: boolean } = {}): void {
    if (!this.game) return;
    if (!this.sm.transition('RESPAWNING')) return;
    const prevDeaths = opts.keepDeaths && this.session ? this.session.deathsInStage : 0;
    const level = stage.kind === 'level' ? getLevel(stage.world, stage.index) : null;
    const cp = level && opts.useSavedCheckpoint ? this.progress.checkpointFor(level.id) : -1;
    this.session = {
      stage,
      level,
      lives: LIVES.start,
      coins: 0,
      deathsInStage: prevDeaths,
      startCheckpoint: cp,
      lastResult: null,
    };
    this.math = null;
    this.ui.hideAll();
    this.ui.closeMath();
    this.ui.resetHudCache();
    this.ui.setLives(LIVES.start, LIVES.max);
    this.ui.setCoins(0);
    this.ui.setProgress(0);
    this.input.reset();
    this.stopPlayScenes();
    if (this.game.scene.isActive('menu')) this.game.scene.stop('menu');
    if (stage.kind === 'level') {
      this.ui.setHudMode('level');
      this.ui.setLabel(`Welt ${stage.world + 1} · Level ${stage.index + 1}`);
      this.audio.music(WORLD_THEMES[stage.world]);
      this.game.scene.start('level', { controller: this, level, checkpoint: cp });
    } else {
      const boss = bossForWorld(stage.world);
      this.ui.setHudMode('boss');
      this.ui.setLabel(`Welt ${stage.world + 1} · Boss`);
      this.audio.music('boss');
      this.game.scene.start('boss', { controller: this, boss });
    }
  }

  /** Die Szene meldet: „Bereit? Los!“ ist vorbei. */
  onReadyDone(): void {
    if (!this.session || this.sm.state !== 'RESPAWNING') return;
    this.sm.transition(this.session.stage.kind === 'boss' ? 'BOSS_FIGHT' : 'PLAYING');
  }

  // ---------------------------------------------------------------- Ereignisse aus dem Spiel

  onCoin(n = 1): void {
    if (!this.session) return;
    this.session.coins += n;
    this.ui.setCoins(this.session.coins);
  }

  onStomp(): void {
    this.onCoin(REWARDS.coinsPerStomp);
  }

  onCheckpoint(index: number): void {
    const lv = this.session?.level;
    if (!lv) return;
    this.progress.setCheckpoint(lv.id, index);
    this.ui.toast('Checkpoint!', 1400);
  }

  /**
   * Tod (Treffer, Sturz oder im Bosskampf keine Kraft mehr). Durch den Zustandswechsel
   * PLAYING/BOSS_FIGHT → DYING wird jeder Tod genau einmal gezählt.
   */
  onPlayerDeath(cause: DeathCause): void {
    const s = this.session;
    if (!s) return;
    if (!this.sm.transition('DYING')) return;
    s.lives = Math.max(0, s.lives - 1);
    s.deathsInStage++;
    this.totalDeaths++;
    this.ui.setLives(s.lives, LIVES.max);
    this.audio.play('hurt');
    const before = computeAssist(this.helpMode, s.deathsInStage - 1).autoLevel;
    const assist = this.assist;
    this.activeScene?.applyAssist(assist);
    if (assist.autoLevel > before) {
      window.setTimeout(() => this.ui.toast('Rückenwind! Jetzt geht es etwas langsamer.', 3000), 300);
    }
    this.activeScene?.playDeath(cause);
  }

  /** Die Todesanimation ist vorbei → Mathefenster. */
  onDeathAnimDone(): void {
    const s = this.session;
    if (!s || !this.sm.transition('MATH_CHALLENGE')) return;
    const stats = this.progress.data.math;
    const tier = tierFor(s.stage.world, stats, stats.totalSolved);
    this.math = new MathChallenge(this.mathGen.nextSet(3, tier));
    this.ui.openMath({
      challenge: this.math,
      livesZero: s.lives === 0,
      boss: s.stage.kind === 'boss',
      onSound: (ok) => this.audio.play(ok ? 'correct' : 'wrong'),
      onDone: () => this.onMathComplete(),
    });
  }

  private onMathComplete(): void {
    const s = this.session;
    const m = this.math;
    if (!s || !m || !m.isComplete || this.sm.state !== 'MATH_CHALLENGE') return;
    this.progress.setMath(updateStats(this.progress.data.math, m));
    if (s.lives === 0) {
      this.ui.showMathChoice();
    } else {
      this.continueAfterMath();
    }
  }

  /** Nach drei richtigen Aufgaben: sicher weiterspielen. */
  private continueAfterMath(): void {
    const s = this.session;
    if (!s || !this.math?.isComplete || !this.sm.transition('RESPAWNING')) return;
    if (s.lives === 0) {
      // Wiederbelebungsleben – das verlorene Leben wurde beim Tod bereits abgezogen.
      s.lives = 1;
      this.ui.setLives(s.lives, LIVES.max);
    }
    this.math = null;
    this.ui.closeMath();
    this.input.reset();
    this.activeScene?.respawn();
  }

  onLevelComplete(result: { starIds: number[]; time: number }): void {
    const s = this.session;
    if (!s || !s.level || s.stage.kind !== 'level' || !this.sm.transition('LEVEL_COMPLETE')) return;
    s.lastResult = result;
    this.audio.play('levelComplete');
    const id = s.level.id;
    const prevStars = this.progress.record(id).stars;
    const prevBestCoins = this.progress.record(id).bestCoins;
    const hadBadge = this.progress.hasWorldBadge(s.stage.world);
    const res = this.progress.completeLevel(id, { coins: s.coins, starIds: result.starIds, time: result.time });
    const stars = [0, 1, 2].map((i) =>
      result.starIds.includes(i) && !prevStars.includes(i) ? 'new' : prevStars.includes(i) || result.starIds.includes(i) ? 'old' : 'none',
    ) as ('new' | 'old' | 'none')[];
    const lines: { html: string; record?: boolean }[] = [
      { html: `${ICONS.coin} ${s.coins} Münzen` },
      { html: `${ICONS.star} ${result.starIds.length} von 3 Sternen gefunden` },
    ];
    if (res.newBestCoins && prevBestCoins > 0) {
      lines.push({ html: 'Neuer Münzrekord!', record: true });
    }
    if (!hadBadge && this.progress.hasWorldBadge(s.stage.world)) {
      lines.push({ html: `${ICONS.badge} Welt-Abzeichen verdient!`, record: true });
    }
    const next = this.nextStage(s.stage);
    window.setTimeout(() => {
      if (this.sm.state !== 'LEVEL_COMPLETE') return;
      this.ui.showComplete({
        title: s.deathsInStage === 0 ? 'Super! Ohne Unfall!' : 'Geschafft!',
        stars,
        lines,
        nextLabel: next ? (next.kind === 'boss' ? 'Zum Boss!' : 'Weiter') : null,
      });
    }, 1700);
  }

  onBossDefeated(): void {
    const s = this.session;
    if (!s || s.stage.kind !== 'boss' || !this.sm.transition('LEVEL_COMPLETE')) return;
    const world = s.stage.world;
    const boss = bossForWorld(world);
    const coins = s.coins + REWARDS.coinsPerBossWin;
    const res = this.progress.defeatBoss(world, coins);
    this.audio.play('bossDefeated');
    const lines: { html: string; record?: boolean }[] = [
      { html: `${ICONS.trophy} Boss-Trophäe für Welt ${world + 1}` },
      { html: `${ICONS.coin} ${coins} Münzen (mit Siegerbonus)` },
    ];
    if (res.unlockedWorld !== null) {
      lines.push({ html: `Neue Welt: ${WORLD_NAMES[res.unlockedWorld]}!`, record: true });
    }
    window.setTimeout(() => {
      if (this.sm.state !== 'LEVEL_COMPLETE') return;
      this.ui.showComplete({
        title: `Du hast ${boss.name} besiegt!`,
        stars: null,
        lines,
        nextLabel: res.gameComplete ? 'Zum Finale' : 'Nächste Welt',
      });
    }, 2600);
  }

  private nextStage(stage: Stage): Stage | null {
    if (stage.kind === 'level') {
      if (stage.index < LEVELS_PER_WORLD - 1) return { world: stage.world, kind: 'level', index: stage.index + 1 };
      return { world: stage.world, kind: 'boss' };
    }
    if (stage.world < WORLD_COUNT - 1) return { world: stage.world + 1, kind: 'level', index: 0 };
    return null;
  }

  // ---------------------------------------------------------------- Pause

  pause(): void {
    if (!this.sm.is('PLAYING', 'BOSS_FIGHT', 'RESPAWNING')) return;
    if (!this.sm.transition('PAUSED')) return;
    this.game?.scene.getScenes(true).forEach((sc) => {
      if (sc.scene.key === 'level' || sc.scene.key === 'boss') sc.scene.pause();
    });
    this.ui.show('pause');
  }

  resume(): void {
    if (this.sm.state !== 'PAUSED') return;
    const target = this.sm.pausedFrom;
    if (!target || !this.sm.transition(target)) return;
    this.ui.hide('pause');
    this.input.reset();
    this.game?.scene.getScenes(false).forEach((sc) => {
      if ((sc.scene.key === 'level' || sc.scene.key === 'boss') && sc.scene.isPaused()) sc.scene.resume();
    });
  }

  // ---------------------------------------------------------------- Knöpfe

  private handleAction(a: UIAction): void {
    this.audio.unlock();
    if (a.type !== 'pause') this.audio.play('click');
    switch (a.type) {
      case 'play': {
        const stage = this.progress.nextStage();
        this.startStage(stage, { useSavedCheckpoint: true });
        break;
      }
      case 'worlds':
        this.ui.hide('menu');
        this.ui.renderWorlds(this.progress);
        this.ui.show('worlds');
        break;
      case 'help':
        this.ui.hide('menu');
        this.ui.show('help');
        break;
      case 'back':
        this.ui.hide('worlds');
        this.ui.hide('help');
        this.showMenu();
        break;
      case 'sound': {
        const on = !this.progress.data.settings.sound;
        this.progress.updateSettings({ sound: on, music: on });
        this.audio.setSound(on);
        this.ui.setSoundLabel(on);
        break;
      }
      case 'help-mode':
        this.progress.updateSettings({ helpMode: a.on });
        this.ui.toast(a.on ? 'Hilfsmodus ist an' : 'Hilfsmodus ist aus', 1500);
        break;
      case 'pause':
        this.pause();
        break;
      case 'resume':
        this.resume();
        break;
      case 'restart':
        if (this.session && this.sm.state === 'PAUSED') {
          this.ui.hide('pause');
          this.startStage(this.session.stage, { keepDeaths: true });
        }
        break;
      case 'menu':
        if (this.sm.is('PAUSED', 'LEVEL_COMPLETE', 'GAME_COMPLETE')) this.toMenu();
        break;
      case 'next': {
        const s = this.session;
        if (!s || this.sm.state !== 'LEVEL_COMPLETE') break;
        const next = this.nextStage(s.stage);
        if (!next) {
          if (this.sm.transition('GAME_COMPLETE')) {
            this.ui.hideAll();
            this.ui.showGameComplete(this.progress);
            this.audio.play('bossDefeated');
          }
        } else {
          this.startStage(next);
        }
        break;
      }
      case 'replay':
        if (this.session && this.sm.state === 'LEVEL_COMPLETE') this.startStage(this.session.stage);
        break;
      case 'stage':
        if (this.sm.state !== 'MENU') break;
        if (a.kind === 'boss' ? !this.progress.isBossUnlocked(a.world) : !this.progress.isLevelUnlocked(a.world, a.index)) break;
        this.startStage(a.kind === 'boss' ? { world: a.world, kind: 'boss' } : { world: a.world, kind: 'level', index: a.index });
        break;
      case 'reset':
        this.pendingConfirm = () => {
          this.progress.reset();
          this.ui.setHelpMode(this.helpMode);
          this.ui.toast('Spielstand gelöscht', 1600);
        };
        this.ui.confirm('Spielstand wirklich löschen?', 'Alle Welten, Sterne, Münzen und Trophäen sind dann weg.');
        break;
      case 'confirm-yes':
        this.ui.hide('confirm');
        this.pendingConfirm?.();
        this.pendingConfirm = null;
        break;
      case 'confirm-no':
        this.ui.hide('confirm');
        this.pendingConfirm = null;
        break;
      case 'math-revive':
        this.continueAfterMath();
        break;
      case 'math-restart': {
        const s = this.session;
        if (!s || !this.math?.isComplete || this.sm.state !== 'MATH_CHALLENGE') break;
        this.ui.closeMath();
        this.math = null;
        this.progress.clearCheckpoint();
        this.startStage(s.stage, { keepDeaths: true });
        break;
      }
      case 'rotate-ok':
        this.rotateDismissed = true;
        this.ui.hide('rotate');
        break;
    }
  }

  /** Anzeigename der aktuellen Etappe. */
  stageName(stage: Stage): string {
    return stage.kind === 'boss' ? bossForWorld(stage.world).title : getLevel(stage.world, stage.index).name;
  }

  levelIdOf(stage: Stage): string | null {
    return stage.kind === 'level' ? levelId(stage.world, stage.index) : null;
  }
}
