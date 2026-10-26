import Phaser from 'phaser';
import { VIEW, WORLD_LIMITS } from '../../config/gameConfig';
import { ParallaxBackground } from '../backgrounds';
import { HeroView } from '../hero';

/** Hintergrund des Hauptmenüs: der Held rennt über die Wiese und springt ab und zu. */
export class MenuScene extends Phaser.Scene {
  private bg!: ParallaxBackground;
  private hero!: HeroView;
  private ground!: Phaser.GameObjects.TileSprite;
  private groundTop!: Phaser.GameObjects.TileSprite;
  private coins: Phaser.GameObjects.Image[] = [];
  private scroll = 0;
  private jumpT = -1;
  private nextJump = 1.5;

  constructor() {
    super('menu');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x5ec8ff);
    this.bg = new ParallaxBackground(this, 'meadow');
    const gy = WORLD_LIMITS.groundY;
    this.ground = this.add.tileSprite(0, gy + 16, VIEW.width, VIEW.height - gy, 'meadow-fill').setOrigin(0);
    this.groundTop = this.add.tileSprite(0, gy - 3, VIEW.width, 26, 'meadow-top').setOrigin(0);
    this.hero = new HeroView(this, 230, gy);
    this.hero.root.setScale(1.1);
    this.coins = [0, 1, 2, 3, 4].map((i) => this.add.image(400 + i * 130, gy - 60 - (i % 2) * 40, 'coin'));
    this.scroll = 0;
    this.jumpT = -1;
    this.nextJump = 1.5;
  }

  override update(_t: number, deltaMs: number): void {
    // Echte vergangene Zeit (Phasers geglättetes delta bremst bei niedriger Bildrate ab).
    const dt = Math.min((this.game.loop.rawDelta || deltaMs) / 1000, 0.1);
    const speed = 200;
    this.scroll += speed * dt;
    this.bg.update(this.scroll, 0, dt);
    this.ground.tilePositionX = this.scroll;
    this.groundTop.tilePositionX = this.scroll;

    this.nextJump -= dt;
    if (this.nextJump <= 0 && this.jumpT < 0) {
      this.jumpT = 0;
      this.hero.kick(0.3);
    }
    let y = WORLD_LIMITS.groundY;
    let pose: 'run' | 'jump' | 'fall' = 'run';
    if (this.jumpT >= 0) {
      this.jumpT += dt;
      const k = this.jumpT / 0.7;
      y -= 4 * k * (1 - k) * 120;
      pose = k < 0.5 ? 'jump' : 'fall';
      if (k >= 1) {
        this.jumpT = -1;
        this.nextJump = 1.6 + Math.random() * 2;
        this.hero.kick(-0.3);
      }
    }
    this.hero.setPosition(230, y);
    this.hero.update(dt, pose, speed, pose === 'fall' ? 300 : 0);
    for (const c of this.coins) {
      c.x -= speed * dt;
      if (c.x < -30) c.x += 650 + Math.random() * 200;
      c.setScale(Math.abs(Math.cos(this.scroll * 0.02 + c.y)) * 0.85 + 0.15, 1);
    }
  }
}
