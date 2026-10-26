import type Phaser from 'phaser';
import type { GameController } from './core/gameController';
import type { LevelScene } from './render/scenes/LevelScene';
import type { BossScene } from './render/scenes/BossScene';
import { SAVE_KEY } from './progress/saveData';

/**
 * Schnittstelle für die automatischen Browsertests (Playwright). Sie liest vor allem den
 * Zustand aus; die wenigen Steuerfunktionen (z. B. Held versetzen) dienen dazu, bestimmte
 * Situationen gezielt herzustellen. Für das normale Spielen wird sie nicht gebraucht.
 */
export function installDebugApi(controller: GameController, game: Phaser.Game): void {
  const level = (): LevelScene | null => {
    const s = game.scene.getScene('level') as LevelScene | null;
    return s && game.scene.isActive('level') ? s : s && game.scene.isPaused('level') ? s : null;
  };
  const boss = (): BossScene | null => {
    const s = game.scene.getScene('boss') as BossScene | null;
    return s && (game.scene.isActive('boss') || game.scene.isPaused('boss')) ? s : null;
  };

  const api = {
    state: () => controller.state,
    history: () => [...controller.sm.recent],
    lives: () => controller.session?.lives ?? null,
    coins: () => controller.session?.coins ?? null,
    totalDeaths: () => controller.totalDeaths,
    stage: () => controller.session?.stage ?? null,
    player: () => {
      const sim = level()?.sim;
      if (!sim) return null;
      const p = sim.player;
      return {
        x: p.x,
        y: p.y,
        vy: p.vy,
        grounded: p.grounded,
        invulnerable: p.invulnerable,
        status: sim.status,
        deaths: sim.deaths,
        checkpoint: sim.checkpointIndex,
        lastDeath: sim.lastDeath,
        t: sim.t,
      };
    },
    level: () => {
      const sim = level()?.sim;
      if (!sim) return null;
      const lv = sim.level;
      return {
        id: lv.id,
        goalX: lv.goalX,
        checkpoints: lv.checkpoints.map((c) => ({ x: c.x, y: c.y })),
        hazards: lv.hazards.map((h) => ({ x: h.x, y: h.y, w: h.w, h: h.h, kind: h.kind })),
        solids: lv.solids.filter((s) => s.kind === 'ground').map((s) => ({ x: s.x, y: s.y, w: s.w })),
        stars: lv.stars.map((s) => ({ x: s.x, y: s.y })),
      };
    },
    /** Versetzt den Helden (nur für Tests: an eine Stelle direkt vor einem Hindernis oder Graben). */
    teleport: (x: number, y?: number) => {
      const sim = level()?.sim;
      if (!sim) return false;
      sim.player.x = x;
      if (y !== undefined) sim.player.y = y;
      sim.player.vy = 0;
      return true;
    },
    math: () => {
      const m = controller.math;
      if (!m) return null;
      return { a: m.current.a, b: m.current.b, op: m.current.op, answer: m.current.answer, solved: m.solved, index: m.index, total: m.total, locked: m.isLocked };
    },
    boss: () => {
      const f = boss()?.fight;
      if (!f) return null;
      const flying = f.projectiles.filter((p) => p.state === 'flying').sort((a, b) => a.impactT - b.impactT)[0];
      return {
        phase: f.phase,
        hp: f.bossHp,
        energy: f.heroEnergy,
        t: f.t,
        signal: flying ? f.signalFor(flying) : null,
        airborne: f.heroAirborne,
        stats: { ...f.stats },
      };
    },
    /** Startet eine Etappe direkt aus dem Menü (nur für Tests). */
    startStage: (world: number, kind: 'level' | 'boss', index = 0) => {
      if (controller.state !== 'MENU') return false;
      controller.startStage(kind === 'boss' ? { world, kind: 'boss' } : { world, kind: 'level', index });
      return true;
    },
    assist: () => ({ ...controller.assist }),
    progress: () => JSON.parse(JSON.stringify(controller.progress.data)),
    savedRaw: () => window.localStorage.getItem(SAVE_KEY),
    pressCount: () => controller.input.pressCount,
    sfx: () => [...controller.audio.played],
  };
  (window as unknown as { __blitz: typeof api }).__blitz = api;
}
