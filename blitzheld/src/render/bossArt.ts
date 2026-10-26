import Phaser from 'phaser';
import { bolt, canvasTexture, ellipse, fillStroke, rr, star, vgrad } from './textures';

/**
 * Grafiken der vier Bosse: groß, bunt und frech – aber nicht gruselig.
 * Augen sind eigene Texturen, damit der Boss blinzeln, schielen (benommen) und zwinkern kann.
 */

export interface BossLook {
  body: string;
  /** Position der Augen relativ zur Körpermitte unten (Ursprung 0.5, 1). */
  eyeX: number;
  eyeY: number;
  eyeGap: number;
  projectile: string;
}

export const BOSS_LOOKS: Record<string, BossLook> = {
  'boss-1': { body: 'boss-1', eyeX: -6, eyeY: -150, eyeGap: 46, projectile: 'proj-acorn' },
  'boss-2': { body: 'boss-2', eyeX: -10, eyeY: -138, eyeGap: 48, projectile: 'proj-boulder' },
  'boss-3': { body: 'boss-3', eyeX: -4, eyeY: -132, eyeGap: 50, projectile: 'proj-bolt' },
  'boss-4': { body: 'boss-4', eyeX: -24, eyeY: -158, eyeGap: 44, projectile: 'proj-fireball' },
};

const LINE = '#2b1d3a';

export function createBossTextures(scene: Phaser.Scene): void {
  // --- Stumpi, der Baumstumpf-Riese
  canvasTexture(scene, 'boss-1', 230, 230, (ctx) => {
    // Äste als Arme
    ctx.lineWidth = 14;
    ctx.strokeStyle = '#7a4423';
    ctx.beginPath();
    ctx.moveTo(40, 150);
    ctx.quadraticCurveTo(10, 130, 18, 96);
    ctx.moveTo(190, 150);
    ctx.quadraticCurveTo(222, 128, 210, 92);
    ctx.stroke();
    for (const [x, y] of [
      [18, 90],
      [210, 86],
    ]) {
      ellipse(ctx, x, y, 18, 14);
      fillStroke(ctx, '#5cc94a', '#24601a', 3);
    }
    // Stamm
    ctx.beginPath();
    ctx.moveTo(30, 228);
    ctx.quadraticCurveTo(34, 120, 46, 70);
    ctx.lineTo(184, 70);
    ctx.quadraticCurveTo(196, 120, 200, 228);
    ctx.closePath();
    fillStroke(ctx, vgrad(ctx, 60, 228, [[0, '#b0703f'], [1, '#7a4423']]), '#3e2312', 4);
    ctx.strokeStyle = 'rgba(62,35,18,0.35)';
    ctx.lineWidth = 4;
    for (const x of [70, 115, 160]) {
      ctx.beginPath();
      ctx.moveTo(x, 110);
      ctx.quadraticCurveTo(x + 6, 170, x - 2, 220);
      ctx.stroke();
    }
    // Jahresringe oben
    ellipse(ctx, 115, 70, 70, 20);
    fillStroke(ctx, '#ecc78a', '#3e2312', 4);
    for (const r of [48, 28, 10]) {
      ellipse(ctx, 115, 70, r, r * 0.28);
      ctx.strokeStyle = '#b98852';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
    // Blätterkrone
    for (const [x, y, r] of [
      [70, 52, 26],
      [110, 38, 32],
      [155, 50, 26],
      [92, 30, 20],
      [135, 28, 20],
    ]) {
      ellipse(ctx, x, y, r, r * 0.8);
      fillStroke(ctx, '#6fdc4a', '#2f7a22', 3);
    }
    ellipse(ctx, 160, 34, 7, 6);
    fillStroke(ctx, '#ff5a5a', '#7a1a1a', 2);
    // Mund (frech grinsend)
    ctx.beginPath();
    ctx.moveTo(78, 170);
    ctx.quadraticCurveTo(112, 196, 146, 168);
    ctx.quadraticCurveTo(112, 182, 78, 170);
    ctx.closePath();
    fillStroke(ctx, '#4a1a10', '#3e2312', 3);
    ctx.fillStyle = '#fff';
    ctx.fillRect(98, 174, 10, 7);
    ctx.fillRect(114, 175, 10, 7);
    // Moos-Wangen
    ellipse(ctx, 62, 160, 12, 8);
    ctx.fillStyle = 'rgba(255,120,120,0.45)';
    ctx.fill();
    ellipse(ctx, 162, 160, 12, 8);
    ctx.fill();
  });

  // --- Brocko, das Felsmonster
  canvasTexture(scene, 'boss-2', 240, 230, (ctx) => {
    // Arme
    for (const [x, d] of [
      [34, -1],
      [206, 1],
    ] as const) {
      ellipse(ctx, x + d * 6, 160, 28, 34);
      fillStroke(ctx, vgrad(ctx, 120, 200, [[0, '#9a90c8'], [1, '#5e548c']]), '#241a40', 4);
    }
    // Körper
    ctx.beginPath();
    ctx.moveTo(40, 228);
    ctx.lineTo(30, 120);
    ctx.lineTo(70, 50);
    ctx.lineTo(150, 36);
    ctx.lineTo(205, 90);
    ctx.lineTo(212, 228);
    ctx.closePath();
    fillStroke(ctx, vgrad(ctx, 36, 228, [[0, '#a69cd4'], [1, '#5e548c']]), '#241a40', 4);
    ctx.strokeStyle = 'rgba(36,26,64,0.35)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(70, 50);
    ctx.lineTo(88, 110);
    ctx.lineTo(60, 160);
    ctx.moveTo(150, 36);
    ctx.lineTo(160, 100);
    ctx.lineTo(200, 130);
    ctx.stroke();
    // Kristalle auf dem Rücken
    const shard = (x: number, y: number, h: number, c1: string, c2: string): void => {
      ctx.beginPath();
      ctx.moveTo(x - 12, y);
      ctx.lineTo(x, y - h);
      ctx.lineTo(x + 12, y);
      ctx.closePath();
      fillStroke(ctx, vgrad(ctx, y - h, y, [[0, c1], [1, c2]]), '#241a40', 3);
    };
    shard(84, 60, 46, '#e9d6ff', '#a066ff');
    shard(120, 46, 58, '#c6f6ff', '#3fa7e8');
    shard(160, 52, 44, '#ffd6f6', '#e066c8');
    // Mund
    rr(ctx, 86, 160, 64, 22, 10);
    fillStroke(ctx, '#2a1650', '#241a40', 3);
    ctx.fillStyle = '#fff';
    for (const x of [94, 110, 126]) ctx.fillRect(x, 160, 10, 8);
  });

  // --- Blinki-Bot, der freche Roboter
  canvasTexture(scene, 'boss-3', 230, 240, (ctx) => {
    // Antenne
    ctx.strokeStyle = '#4b5a78';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(115, 52);
    ctx.lineTo(115, 18);
    ctx.stroke();
    ellipse(ctx, 115, 14, 11, 11);
    fillStroke(ctx, '#ff4f7a', '#6b1033', 3);
    // Arme
    for (const [x, d] of [
      [26, -1],
      [204, 1],
    ] as const) {
      rr(ctx, x - 14, 120, 28, 70, 14);
      fillStroke(ctx, '#9fb4d8', '#2c3550', 4);
      ellipse(ctx, x + d * 2, 196, 18, 14);
      fillStroke(ctx, '#ffd23f', '#7a5a00', 3);
    }
    // Räder
    for (const x of [70, 160]) {
      ellipse(ctx, x, 218, 22, 22);
      fillStroke(ctx, '#3a4258', '#1a1f2e', 4);
      ellipse(ctx, x, 218, 8, 8);
      ctx.fillStyle = '#9fb4d8';
      ctx.fill();
    }
    // Körper
    rr(ctx, 36, 50, 158, 160, 34);
    fillStroke(ctx, vgrad(ctx, 50, 210, [[0, '#7ad0ff'], [1, '#2f7bd6']]), '#13325c', 4);
    // Bildschirm-Gesicht
    rr(ctx, 56, 72, 118, 92, 20);
    fillStroke(ctx, '#1a2a4a', '#0a1428', 3);
    // Mund (Pixel-Grinsen)
    ctx.fillStyle = '#7dffb0';
    for (const [x, y] of [
      [86, 140],
      [94, 146],
      [102, 148],
      [110, 148],
      [118, 148],
      [126, 148],
      [134, 146],
      [142, 140],
    ]) {
      ctx.fillRect(x, y, 8, 6);
    }
    // Blitz auf dem Bauch
    bolt(ctx, 112, 172, 2);
    fillStroke(ctx, '#ffd23f', '#7a5a00', 2);
  });

  // --- Flammi, der Vulkan-Drache
  canvasTexture(scene, 'boss-4', 250, 240, (ctx) => {
    // Schwanz
    ctx.beginPath();
    ctx.moveTo(190, 210);
    ctx.quadraticCurveTo(245, 200, 238, 150);
    ctx.lineTo(226, 160);
    ctx.quadraticCurveTo(228, 192, 186, 190);
    ctx.closePath();
    fillStroke(ctx, '#ff5a3a', '#6a1a00', 3.5);
    star(ctx, 236, 146, 12, 5, 3);
    fillStroke(ctx, '#ffd23f', '#7a3a00', 2.5);
    // Flügel
    ctx.beginPath();
    ctx.moveTo(170, 100);
    ctx.quadraticCurveTo(230, 40, 240, 90);
    ctx.quadraticCurveTo(214, 96, 196, 130);
    ctx.closePath();
    fillStroke(ctx, '#ffb84d', '#6a3a00', 3.5);
    // Körper
    ellipse(ctx, 130, 168, 82, 68);
    fillStroke(ctx, vgrad(ctx, 100, 236, [[0, '#ff7a4a'], [1, '#e8401a']]), '#6a1a00', 4);
    ellipse(ctx, 120, 182, 48, 46);
    ctx.fillStyle = '#ffd68a';
    ctx.fill();
    ctx.strokeStyle = 'rgba(170,90,20,0.5)';
    ctx.lineWidth = 3;
    for (const y of [160, 180, 200]) {
      ctx.beginPath();
      ctx.moveTo(84, y);
      ctx.quadraticCurveTo(120, y + 8, 156, y);
      ctx.stroke();
    }
    // Füße
    for (const x of [86, 168]) {
      ellipse(ctx, x, 230, 24, 10);
      fillStroke(ctx, '#e8401a', '#6a1a00', 3);
    }
    // Kopf
    ellipse(ctx, 102, 92, 66, 54);
    fillStroke(ctx, vgrad(ctx, 40, 146, [[0, '#ff8a5a'], [1, '#ff5a2a']]), '#6a1a00', 4);
    // Hörner
    for (const [x, d] of [
      [70, -1],
      [128, 1],
    ] as const) {
      ctx.beginPath();
      ctx.moveTo(x - 10, 50);
      ctx.quadraticCurveTo(x + d * 8, 10, x + d * 18, 14);
      ctx.quadraticCurveTo(x + d * 6, 30, x + 10, 48);
      ctx.closePath();
      fillStroke(ctx, '#fff1c2', '#6a3a00', 3);
    }
    // Schnauze
    ellipse(ctx, 62, 112, 34, 22);
    fillStroke(ctx, '#ffa070', '#6a1a00', 3);
    for (const x of [48, 70]) {
      ellipse(ctx, x, 104, 4, 3);
      ctx.fillStyle = '#6a1a00';
      ctx.fill();
    }
    ctx.beginPath();
    ctx.moveTo(40, 122);
    ctx.quadraticCurveTo(62, 136, 88, 120);
    ctx.strokeStyle = '#6a1a00';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(52, 126);
    ctx.lineTo(56, 134);
    ctx.lineTo(60, 127);
    ctx.fill();
  });

  // --- Augen: normal, benommen, getroffen
  canvasTexture(scene, 'boss-eye', 44, 48, (ctx) => {
    ellipse(ctx, 22, 25, 18, 21);
    fillStroke(ctx, '#ffffff', LINE, 3);
    ellipse(ctx, 18, 27, 9, 11);
    ctx.fillStyle = LINE;
    ctx.fill();
    ellipse(ctx, 15, 22, 3.5, 3.5);
    ctx.fillStyle = '#fff';
    ctx.fill();
    // freche Augenbraue
    ctx.beginPath();
    ctx.moveTo(4, 4);
    ctx.lineTo(38, 10);
    ctx.strokeStyle = LINE;
    ctx.lineWidth = 5;
    ctx.stroke();
  });
  canvasTexture(scene, 'boss-eye-dizzy', 44, 48, (ctx) => {
    ellipse(ctx, 22, 25, 18, 21);
    fillStroke(ctx, '#ffffff', LINE, 3);
    ctx.beginPath();
    for (let a = 0; a < Math.PI * 5; a += 0.25) {
      const r = 1 + a * 1.0;
      const x = 22 + Math.cos(a) * r;
      const y = 25 + Math.sin(a) * r;
      if (a === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = LINE;
    ctx.lineWidth = 2.5;
    ctx.stroke();
  });
  canvasTexture(scene, 'boss-eye-hurt', 44, 48, (ctx) => {
    ctx.strokeStyle = LINE;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(8, 14);
    ctx.lineTo(34, 26);
    ctx.lineTo(8, 38);
    ctx.stroke();
  });
  canvasTexture(scene, 'boss-eye-happy', 44, 48, (ctx) => {
    ctx.strokeStyle = LINE;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(22, 30, 13, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
  });

  // --- Wurfgeschosse
  canvasTexture(scene, 'proj-acorn', 46, 46, (ctx) => {
    ellipse(ctx, 23, 27, 16, 17);
    fillStroke(ctx, vgrad(ctx, 10, 44, [[0, '#d8954a'], [1, '#a8652a']]), '#4a2a12', 3);
    ctx.beginPath();
    ctx.ellipse(23, 15, 19, 10, 0, Math.PI, 0);
    ctx.closePath();
    fillStroke(ctx, '#7a4a22', '#4a2a12', 3);
    rr(ctx, 21, 2, 5, 8, 2);
    ctx.fillStyle = '#4a2a12';
    ctx.fill();
    ellipse(ctx, 17, 26, 3, 5);
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fill();
  });
  canvasTexture(scene, 'proj-boulder', 50, 50, (ctx) => {
    ctx.beginPath();
    ctx.moveTo(25, 3);
    ctx.lineTo(44, 14);
    ctx.lineTo(47, 34);
    ctx.lineTo(30, 47);
    ctx.lineTo(10, 42);
    ctx.lineTo(3, 22);
    ctx.closePath();
    fillStroke(ctx, vgrad(ctx, 3, 47, [[0, '#a69cd4'], [1, '#5e548c']]), '#241a40', 3);
    star(ctx, 25, 25, 7, 3, 4);
    ctx.fillStyle = '#bff6ff';
    ctx.fill();
  });
  canvasTexture(scene, 'proj-bolt', 50, 50, (ctx) => {
    const g = ctx.createRadialGradient(25, 25, 2, 25, 25, 24);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.5, '#fff27a');
    g.addColorStop(1, 'rgba(255,210,63,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 50, 50);
    ellipse(ctx, 25, 25, 14, 14);
    fillStroke(ctx, '#ffd23f', '#7a5a00', 3);
    bolt(ctx, 24, 15, 1.4);
    ctx.fillStyle = '#fff';
    ctx.fill();
  });
  canvasTexture(scene, 'proj-fireball', 56, 50, (ctx) => {
    ctx.beginPath();
    ctx.moveTo(52, 25);
    ctx.quadraticCurveTo(40, 4, 26, 8);
    ctx.quadraticCurveTo(6, 12, 8, 26);
    ctx.quadraticCurveTo(8, 44, 28, 44);
    ctx.quadraticCurveTo(42, 44, 52, 25);
    ctx.closePath();
    ctx.fillStyle = vgrad(ctx, 4, 46, [[0, '#ffe14d'], [1, '#ff5a1a']]);
    ctx.fill();
    ellipse(ctx, 22, 26, 11, 11);
    ctx.fillStyle = '#fff6c2';
    ctx.fill();
  });

  canvasTexture(scene, 'bubble-alert', 50, 56, (ctx) => {
    ellipse(ctx, 25, 24, 22, 22);
    fillStroke(ctx, '#ffffff', LINE, 3);
    ctx.beginPath();
    ctx.moveTo(18, 42);
    ctx.lineTo(14, 54);
    ctx.lineTo(28, 45);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.fillStyle = '#e8433a';
    rr(ctx, 21, 8, 8, 22, 4);
    ctx.fill();
    ellipse(ctx, 25, 37, 4.5, 4.5);
    ctx.fill();
  });
}
