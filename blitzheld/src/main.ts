import Phaser from 'phaser';
import '@fontsource/fredoka/latin-500.css';
import '@fontsource/fredoka/latin-600.css';
import '@fontsource/fredoka/latin-700.css';
import './styles/main.css';
import { VIEW } from './config/gameConfig';
import { GameController } from './core/gameController';
import { browserStorage, ProgressStore } from './progress/saveData';
import { BootScene } from './render/scenes/BootScene';
import { MenuScene } from './render/scenes/MenuScene';
import { LevelScene } from './render/scenes/LevelScene';
import { BossScene } from './render/scenes/BossScene';
import { installDebugApi } from './debug';

async function start(): Promise<void> {
  // Schrift laden, bevor Texturen mit Text gezeichnet werden (lokal gebündelt, kein Download von außen).
  try {
    await Promise.race([
      Promise.all(['500', '600', '700'].map((w) => document.fonts.load(`${w} 20px Fredoka`))),
      new Promise((r) => setTimeout(r, 1500)),
    ]);
  } catch {
    /* Ersatzschrift genügt */
  }

  const progress = new ProgressStore(browserStorage());
  const controller = new GameController(progress);
  const gameEl = document.getElementById('game') as HTMLElement;

  // ?renderer=canvas erzwingt den Canvas-Renderer (z. B. für sehr alte Geräte oder Tests ohne GPU).
  const params = new URLSearchParams(window.location.search);
  const renderer = params.get('renderer') === 'canvas' ? Phaser.CANVAS : Phaser.AUTO;
  const game = new Phaser.Game({
    type: renderer,
    parent: gameEl,
    width: VIEW.width,
    height: VIEW.height,
    backgroundColor: '#5ec8ff',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    render: { antialias: true, powerPreference: 'high-performance' },
    input: { keyboard: false, mouse: false, touch: false, gamepad: false },
    audio: { noAudio: true },
    banner: false,
    fps: { target: 60, smoothStep: true },
    scene: [BootScene, MenuScene, LevelScene, BossScene],
  });

  controller.attachGame(game, gameEl, document.getElementById('btn-jump') as HTMLElement);
  game.events.once('blitzheld-ready', () => controller.showMenu());
  installDebugApi(controller, game);
}

void start();
