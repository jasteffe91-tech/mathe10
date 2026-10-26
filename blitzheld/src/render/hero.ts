import Phaser from 'phaser';

/**
 * Der Held „Blitz“ – aus mehreren Teilen zusammengesetzt und prozedural animiert:
 * Laufzyklus mit schwingenden Beinen und Armen, wehender Schal, wedelnder Blitzschwanz,
 * Strecken und Stauchen beim Springen und Landen, Blinzeln.
 * Der Ursprung des Containers liegt zwischen den Füßen.
 */

/** Gesamtgröße des Helden: ca. 68 px hoch bei einer 46 px hohen Kollisionsbox. */
export const HERO_SCALE = 0.8;

export type HeroPose = 'run' | 'jump' | 'fall' | 'idle' | 'cheer' | 'hurt';

export class HeroView {
  readonly root: Phaser.GameObjects.Container;
  private readonly body: Phaser.GameObjects.Container;
  private readonly head: Phaser.GameObjects.Image;
  private readonly eyes: Phaser.GameObjects.Image;
  private readonly torso: Phaser.GameObjects.Image;
  private readonly legFront: Phaser.GameObjects.Image;
  private readonly legBack: Phaser.GameObjects.Image;
  private readonly armFront: Phaser.GameObjects.Image;
  private readonly armBack: Phaser.GameObjects.Image;
  private readonly tail: Phaser.GameObjects.Image;
  private readonly scarf: Phaser.GameObjects.Image[];
  private phase = 0;
  private blinkTimer = 2;
  private squash = 0;
  private squashVel = 0;
  private time = 0;
  pose: HeroPose = 'idle';

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.root = scene.add.container(x, y);
    this.body = scene.add.container(0, 0);
    this.tail = scene.add.image(-12, -20, 'hero-tail').setOrigin(0.92, 0.72);
    this.legBack = scene.add.image(-3, -20, 'hero-leg').setOrigin(0.5, 0.05).setTint(0xd8d0d0);
    this.armBack = scene.add.image(-6, -36, 'hero-arm').setOrigin(0.5, 0.1).setTint(0xd8d0d0);
    this.torso = scene.add.image(0, -18, 'hero-body').setOrigin(0.5, 0.95);
    this.scarf = [0, 1, 2].map((i) => scene.add.image(-8 - i * 9, -40 + i, 'hero-scarf').setOrigin(0.9, 0.5));
    this.head = scene.add.image(3, -38, 'hero-head').setOrigin(0.5, 0.9);
    this.eyes = scene.add.image(10, -57, 'hero-eyes').setOrigin(0.5, 0.5);
    this.legFront = scene.add.image(4, -20, 'hero-leg').setOrigin(0.5, 0.05);
    this.armFront = scene.add.image(6, -36, 'hero-arm').setOrigin(0.5, 0.1);
    this.body.add([
      this.tail,
      this.legBack,
      this.armBack,
      this.torso,
      ...this.scarf.slice().reverse(),
      this.head,
      this.eyes,
      this.legFront,
      this.armFront,
    ]);
    this.root.add(this.body);
    this.root.setScale(HERO_SCALE);
    this.root.setDepth(50);
  }

  setPosition(x: number, y: number): void {
    this.root.setPosition(x, y);
  }

  /** Kurzer Stauch-Impuls: positiv = in die Länge gezogen, negativ = gestaucht. */
  kick(amount: number): void {
    this.squashVel += amount;
  }

  setVisible(v: boolean): void {
    this.root.setVisible(v);
  }

  setAlpha(a: number): void {
    this.root.setAlpha(a);
  }

  /**
   * @param dt Sekunden
   * @param speed Laufgeschwindigkeit in px/s (0 = steht)
   * @param vy senkrechte Geschwindigkeit (für die Flugphase)
   */
  update(dt: number, pose: HeroPose, speed: number, vy = 0): void {
    this.pose = pose;
    this.time += dt;
    // Feder für Strecken/Stauchen
    const k = 180;
    const damp = 14;
    this.squashVel += (-k * this.squash - damp * this.squashVel) * dt;
    this.squash += this.squashVel * dt;
    const s = Phaser.Math.Clamp(this.squash, -0.35, 0.35);
    this.body.setScale(1 - s * 0.6, 1 + s);

    // Blinzeln
    this.blinkTimer -= dt;
    let eyeScale = 1;
    if (this.blinkTimer < 0.12) eyeScale = 0.15;
    if (this.blinkTimer <= 0) this.blinkTimer = 2 + Math.random() * 2.5;
    if (pose === 'hurt') eyeScale = 0.3;
    this.eyes.setScale(1, eyeScale);

    let legF = 0;
    let legB = 0;
    let armF = 0;
    let armB = 0;
    let bob = 0;
    let lean = 0;
    let tailRot = Math.sin(this.time * 6) * 0.15;

    switch (pose) {
      case 'run': {
        this.phase += dt * (speed / 52) * Math.PI * 2 * 0.55;
        const sw = Math.sin(this.phase);
        legF = sw * 0.9;
        legB = -sw * 0.9;
        armF = -sw * 0.8;
        armB = sw * 0.8;
        bob = -Math.abs(Math.cos(this.phase)) * 3.5;
        lean = 0.12;
        tailRot = Math.sin(this.phase * 2) * 0.25 + 0.1;
        break;
      }
      case 'jump':
        legF = -0.9;
        legB = 0.6;
        armF = -2.3;
        armB = -1.6;
        lean = 0.05;
        tailRot = -0.3;
        break;
      case 'fall': {
        const f = Phaser.Math.Clamp(vy / 600, 0, 1);
        legF = 0.4 - f * 0.3;
        legB = -0.3;
        armF = -1.2 - f * 0.8 + Math.sin(this.time * 20) * 0.15;
        armB = -1.0 - f * 0.6;
        tailRot = 0.5;
        break;
      }
      case 'cheer':
        armF = -2.8 + Math.sin(this.time * 12) * 0.2;
        armB = -2.6;
        bob = -Math.abs(Math.sin(this.time * 8)) * 4;
        tailRot = Math.sin(this.time * 14) * 0.4;
        break;
      case 'hurt':
        armF = -2.4;
        armB = -2.4;
        legF = 0.6;
        legB = -0.6;
        break;
      case 'idle':
      default:
        bob = Math.sin(this.time * 3) * 1;
        armF = Math.sin(this.time * 3) * 0.08;
        armB = -armF;
        break;
    }

    this.legFront.setRotation(legF);
    this.legBack.setRotation(legB);
    this.armFront.setRotation(armF);
    this.armBack.setRotation(armB);
    this.tail.setRotation(tailRot);
    this.body.setY(bob);
    this.body.setRotation(lean);
    this.head.setRotation(pose === 'run' ? Math.sin(this.phase * 2) * 0.04 : 0);

    // Schal weht nach hinten
    const wind = pose === 'idle' ? 0.3 : 1;
    this.scarf.forEach((seg, i) => {
      const wave = Math.sin(this.time * 14 - i * 0.9) * (0.18 + i * 0.1) * wind;
      seg.setRotation(wave + (pose === 'fall' ? -0.4 : 0.05 * i));
      seg.setPosition(-6 - i * (8 * (0.6 + 0.4 * wind)), -40 + i * 1.5 + Math.sin(this.time * 14 - i) * i * wind);
    });
  }
}
