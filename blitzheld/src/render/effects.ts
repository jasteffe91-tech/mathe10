import Phaser from 'phaser';

/** Partikel und kleine Textanimationen, die Level- und Bossszene gemeinsam nutzen. */
export class Effects {
  private readonly dust: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly sparks: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly poof: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly confetti: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly hearts: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor(
    private readonly scene: Phaser.Scene,
    dustTint = 0xffffff,
  ) {
    this.dust = scene.add.particles(0, 0, 'p-dust', {
      lifespan: 420,
      speed: { min: 30, max: 110 },
      angle: { min: 190, max: 350 },
      scale: { start: 1.3, end: 0.2 },
      alpha: { start: 0.8, end: 0 },
      gravityY: 120,
      tint: dustTint,
      emitting: false,
    });
    this.sparks = scene.add.particles(0, 0, 'p-spark', {
      lifespan: 520,
      speed: { min: 60, max: 200 },
      scale: { start: 1, end: 0 },
      rotate: { min: 0, max: 360 },
      tint: [0xffe14d, 0xffffff, 0xffb84d],
      emitting: false,
    });
    this.poof = scene.add.particles(0, 0, 'p-poof', {
      lifespan: 650,
      speed: { min: 40, max: 160 },
      scale: { start: 0.6, end: 1.4 },
      alpha: { start: 0.95, end: 0 },
      rotate: { min: 0, max: 360 },
      emitting: false,
    });
    this.confetti = scene.add.particles(0, 0, 'p-confetti', {
      lifespan: 1800,
      speedX: { min: -220, max: 220 },
      speedY: { min: -520, max: -220 },
      gravityY: 520,
      rotate: { start: 0, end: 720 },
      scale: { min: 0.8, max: 1.4 },
      tint: [0xff4f7a, 0xffd23f, 0x3ddc84, 0x4db8ff, 0xa978f0, 0xff8a2a],
      emitting: false,
    });
    this.hearts = scene.add.particles(0, 0, 'p-heart', {
      lifespan: 1200,
      speedY: { min: -120, max: -60 },
      speedX: { min: -40, max: 40 },
      scale: { start: 0.9, end: 0.3 },
      alpha: { start: 1, end: 0 },
      emitting: false,
    });
    for (const e of [this.dust, this.sparks, this.poof, this.confetti, this.hearts]) e.setDepth(60);
  }

  dustAt(x: number, y: number, n = 6): void {
    this.dust.explode(n, x, y);
  }

  sparkleAt(x: number, y: number, n = 10): void {
    this.sparks.explode(n, x, y);
  }

  poofAt(x: number, y: number, n = 8, tint = 0xffffff): void {
    this.poof.setParticleTint(tint);
    this.poof.explode(n, x, y);
  }

  confettiAt(x: number, y: number, n = 60): void {
    this.confetti.explode(n, x, y);
  }

  heartsAt(x: number, y: number, n = 8): void {
    this.hearts.explode(n, x, y);
  }

  /** Kleiner aufsteigender Text, z. B. „+1“. */
  floatText(x: number, y: number, text: string, color = '#ffffff', size = 26): void {
    const t = this.scene.add
      .text(x, y, text, {
        fontFamily: 'Fredoka, "Trebuchet MS", sans-serif',
        fontSize: `${size}px`,
        fontStyle: 'bold',
        color,
        stroke: '#2b1d3a',
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(70);
    this.scene.tweens.add({
      targets: t,
      y: y - 50,
      alpha: { from: 1, to: 0 },
      scale: { from: 0.6, to: 1.1 },
      duration: 900,
      ease: 'Cubic.easeOut',
      onComplete: () => t.destroy(),
    });
  }
}
