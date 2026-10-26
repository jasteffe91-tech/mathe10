import Phaser from 'phaser';
import { createAllTextures } from '../textures';
import { createBossTextures } from '../bossArt';

/** Erzeugt alle Grafiken und wechselt dann ins Menü. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  create(): void {
    createAllTextures(this);
    createBossTextures(this);
    this.scene.start('menu');
    this.game.events.emit('blitzheld-ready');
  }
}
