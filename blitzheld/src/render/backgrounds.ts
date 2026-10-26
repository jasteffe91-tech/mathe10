import Phaser from 'phaser';
import { VIEW } from '../config/gameConfig';
import type { ThemeId } from '../game/types';

/** Mehrschichtiger Hintergrund mit Parallax-Scrolling. */
export class ParallaxBackground {
  private readonly far: Phaser.GameObjects.TileSprite;
  private readonly mid: Phaser.GameObjects.TileSprite;
  private readonly near: Phaser.GameObjects.TileSprite;
  private drift = 0;

  constructor(
    scene: Phaser.Scene,
    private readonly theme: ThemeId,
  ) {
    scene.add.tileSprite(0, 0, VIEW.width, VIEW.height, `${theme}-sky`).setOrigin(0).setScrollFactor(0).setDepth(-100);
    this.far = scene.add.tileSprite(0, 150, VIEW.width, 300, `${theme}-far`).setOrigin(0).setScrollFactor(0).setDepth(-95);
    this.mid = scene.add.tileSprite(0, 230, VIEW.width, 260, `${theme}-mid`).setOrigin(0).setScrollFactor(0).setDepth(-90);
    this.near = scene.add.tileSprite(0, 352, VIEW.width, 120, `${theme}-near`).setOrigin(0).setScrollFactor(0).setDepth(-85);
  }

  update(camX: number, camY: number, dt: number): void {
    // Wolken ziehen auch von allein ein wenig.
    this.drift += dt * (this.theme === 'clouds' ? 14 : 4);
    this.far.tilePositionX = camX * 0.12 + this.drift;
    this.mid.tilePositionX = camX * 0.3;
    this.near.tilePositionX = camX * 0.55;
    this.far.y = 150 - camY * 0.08;
    this.mid.y = 230 - camY * 0.18;
    this.near.y = 352 - camY * 0.35;
  }
}
