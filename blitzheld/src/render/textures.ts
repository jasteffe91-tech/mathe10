import Phaser from 'phaser';
import type { ThemeId } from '../game/types';

/**
 * Alle Grafiken werden beim Start prozedural mit Canvas 2D gezeichnet und als Phaser-Texturen
 * registriert. Es gibt keine Bilddateien und keine Downloads zur Laufzeit.
 */

type Draw = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;

function canvasTexture(scene: Phaser.Scene, key: string, w: number, h: number, draw: Draw): void {
  if (scene.textures.exists(key)) return;
  const c = document.createElement('canvas');
  c.width = Math.ceil(w);
  c.height = Math.ceil(h);
  const ctx = c.getContext('2d');
  if (!ctx) return;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  draw(ctx, w, h);
  scene.textures.addCanvas(key, c);
}

// ------------------------------------------------------------------ Zeichenhilfen

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number): void {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
}

function fillStroke(ctx: CanvasRenderingContext2D, fill: string | CanvasGradient, stroke = '#2b1d3a', lw = 2.5): void {
  ctx.fillStyle = fill;
  ctx.fill();
  if (lw > 0) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.stroke();
  }
}

function vgrad(ctx: CanvasRenderingContext2D, y0: number, y1: number, stops: [number, string][]): CanvasGradient {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}

function star(ctx: CanvasRenderingContext2D, cx: number, cy: number, r1: number, r2: number, points = 5): void {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? r1 : r2;
    const a = -Math.PI / 2 + (i * Math.PI) / points;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function bolt(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  ctx.beginPath();
  ctx.moveTo(x + 2 * s, y);
  ctx.lineTo(x - 3 * s, y + 7 * s);
  ctx.lineTo(x + 0.5 * s, y + 7 * s);
  ctx.lineTo(x - 2 * s, y + 14 * s);
  ctx.lineTo(x + 4 * s, y + 5.5 * s);
  ctx.lineTo(x + 0.6 * s, y + 5.5 * s);
  ctx.lineTo(x + 3 * s, y);
  ctx.closePath();
}

function eyes(ctx: CanvasRenderingContext2D, x1: number, x2: number, y: number, r: number, look = 1): void {
  for (const x of [x1, x2]) {
    ellipse(ctx, x, y, r, r * 1.15);
    fillStroke(ctx, '#ffffff', '#2b1d3a', 2);
    ellipse(ctx, x + look * r * 0.3, y + r * 0.1, r * 0.55, r * 0.65);
    ctx.fillStyle = '#2b1d3a';
    ctx.fill();
    ellipse(ctx, x + look * r * 0.3 + r * 0.2, y - r * 0.2, r * 0.2, r * 0.2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  }
}

function smile(ctx: CanvasRenderingContext2D, x: number, y: number, w: number): void {
  ctx.beginPath();
  ctx.arc(x, y - w * 0.3, w * 0.5, 0.25 * Math.PI, 0.75 * Math.PI);
  ctx.strokeStyle = '#2b1d3a';
  ctx.lineWidth = 2;
  ctx.stroke();
}

// ------------------------------------------------------------------ Held „Blitz“ (ein mutiger Fuchs)

const FOX = '#ff8a2a';
const FOX_DARK = '#e0661a';
const LINE = '#3a2140';

function heroTextures(scene: Phaser.Scene): void {
  canvasTexture(scene, 'hero-head', 60, 56, (ctx) => {
    // Ohren
    for (const [x, d] of [
      [16, -1],
      [44, 1],
    ] as const) {
      ctx.beginPath();
      ctx.moveTo(x - 9, 24);
      ctx.lineTo(x + d * 4, 2);
      ctx.lineTo(x + 9, 22);
      ctx.closePath();
      fillStroke(ctx, FOX, LINE, 2.5);
      ctx.beginPath();
      ctx.moveTo(x - 4, 21);
      ctx.lineTo(x + d * 3, 8);
      ctx.lineTo(x + 5, 20);
      ctx.closePath();
      ctx.fillStyle = '#ffd2c4';
      ctx.fill();
    }
    // Kopf
    ellipse(ctx, 30, 33, 21, 19);
    fillStroke(ctx, vgrad(ctx, 14, 52, [[0, '#ffa04a'], [1, FOX]]), LINE, 2.5);
    // weiße Wangen / Schnauze
    ctx.beginPath();
    ctx.moveTo(16, 38);
    ctx.quadraticCurveTo(30, 30, 50, 37);
    ctx.quadraticCurveTo(52, 50, 33, 52);
    ctx.quadraticCurveTo(14, 50, 16, 38);
    ctx.closePath();
    ctx.fillStyle = '#fff6ea';
    ctx.fill();
    // Nase
    ellipse(ctx, 47, 39, 4, 3);
    ctx.fillStyle = LINE;
    ctx.fill();
    // Mund
    ctx.beginPath();
    ctx.moveTo(38, 45);
    ctx.quadraticCurveTo(42, 48, 46, 44);
    ctx.strokeStyle = LINE;
    ctx.lineWidth = 2;
    ctx.stroke();
    // Schutzbrille auf der Stirn
    rr(ctx, 12, 17, 36, 7, 3.5);
    ctx.fillStyle = '#2f6bff';
    ctx.fill();
    for (const x of [22, 38]) {
      ellipse(ctx, x, 19, 6, 5);
      fillStroke(ctx, '#9fe7ff', LINE, 2);
      ellipse(ctx, x - 2, 17.5, 2, 1.5);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    }
  });

  canvasTexture(scene, 'hero-eyes', 26, 16, (ctx) => {
    for (const x of [7, 19]) {
      ellipse(ctx, x, 8, 5, 6.5);
      fillStroke(ctx, '#ffffff', LINE, 1.8);
      ellipse(ctx, x + 1.6, 8.6, 2.8, 3.8);
      ctx.fillStyle = LINE;
      ctx.fill();
      ellipse(ctx, x + 2.6, 6.6, 1.1, 1.1);
      ctx.fillStyle = '#fff';
      ctx.fill();
    }
  });

  canvasTexture(scene, 'hero-body', 32, 30, (ctx) => {
    rr(ctx, 3, 2, 26, 26, 11);
    fillStroke(ctx, FOX, LINE, 2.5);
    ellipse(ctx, 18, 17, 8, 9);
    ctx.fillStyle = '#fff6ea';
    ctx.fill();
    bolt(ctx, 16.5, 8, 1.05);
    fillStroke(ctx, '#ffd23f', '#c47a00', 1.2);
  });

  canvasTexture(scene, 'hero-leg', 12, 22, (ctx) => {
    rr(ctx, 3, 0, 6, 15, 3);
    fillStroke(ctx, FOX_DARK, LINE, 2);
    // Turnschuh
    rr(ctx, 1, 13, 11, 8, 4);
    fillStroke(ctx, '#ffffff', LINE, 2);
    ctx.fillStyle = '#ff3d5a';
    ctx.fillRect(3, 16, 7, 2);
  });

  canvasTexture(scene, 'hero-arm', 10, 18, (ctx) => {
    rr(ctx, 2, 0, 6, 13, 3);
    fillStroke(ctx, FOX_DARK, LINE, 2);
    ellipse(ctx, 5, 14, 4, 3.6);
    fillStroke(ctx, '#ffffff', LINE, 1.8);
  });

  canvasTexture(scene, 'hero-tail', 40, 30, (ctx) => {
    // Schwanz in Blitzform
    ctx.beginPath();
    ctx.moveTo(38, 22);
    ctx.lineTo(22, 26);
    ctx.lineTo(25, 17);
    ctx.lineTo(8, 20);
    ctx.lineTo(14, 9);
    ctx.lineTo(2, 4);
    ctx.lineTo(24, 6);
    ctx.lineTo(21, 13);
    ctx.lineTo(36, 12);
    ctx.closePath();
    fillStroke(ctx, FOX, LINE, 2.2);
    ctx.beginPath();
    ctx.moveTo(14, 9);
    ctx.lineTo(2, 4);
    ctx.lineTo(16, 5);
    ctx.closePath();
    ctx.fillStyle = '#ffd23f';
    ctx.fill();
  });

  canvasTexture(scene, 'hero-scarf', 22, 10, (ctx) => {
    rr(ctx, 1, 1, 20, 8, 4);
    fillStroke(ctx, '#ff3d5a', LINE, 1.8);
  });
}

// ------------------------------------------------------------------ Sammelsachen und Effekte

function pickupTextures(scene: Phaser.Scene): void {
  canvasTexture(scene, 'coin', 30, 30, (ctx) => {
    ellipse(ctx, 15, 15, 13, 13);
    fillStroke(ctx, vgrad(ctx, 2, 28, [[0, '#fff27a'], [0.5, '#ffc928'], [1, '#e79a00']]), '#9a5a00', 2.2);
    ellipse(ctx, 15, 15, 8.5, 8.5);
    ctx.strokeStyle = 'rgba(160,90,0,0.6)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    bolt(ctx, 14, 7.5, 1.05);
    ctx.fillStyle = '#fff7c2';
    ctx.fill();
    ellipse(ctx, 10, 9, 3, 2);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fill();
  });

  canvasTexture(scene, 'star', 52, 52, (ctx) => {
    star(ctx, 26, 27, 23, 11);
    fillStroke(ctx, vgrad(ctx, 4, 50, [[0, '#fff59a'], [1, '#ffb800']]), '#a8650a', 2.5);
    eyes(ctx, 21, 31, 26, 3.2, 0);
    smile(ctx, 26, 35, 6);
  });

  canvasTexture(scene, 'glow', 64, 64, (ctx) => {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,0.9)');
    g.addColorStop(0.4, 'rgba(255,255,255,0.35)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  });

  canvasTexture(scene, 'p-dust', 16, 16, (ctx) => {
    const g = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 16, 16);
  });

  canvasTexture(scene, 'p-spark', 18, 18, (ctx) => {
    star(ctx, 9, 9, 8.5, 3.2, 4);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  });

  canvasTexture(scene, 'p-confetti', 10, 6, (ctx) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 10, 6);
  });

  canvasTexture(scene, 'p-poof', 40, 40, (ctx) => {
    for (const [x, y, r] of [
      [20, 22, 13],
      [11, 18, 9],
      [29, 17, 10],
      [20, 12, 9],
    ]) {
      ellipse(ctx, x, y, r, r);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    }
  });

  canvasTexture(scene, 'p-heart', 22, 20, (ctx) => {
    ctx.beginPath();
    ctx.moveTo(11, 18);
    ctx.bezierCurveTo(-4, 8, 4, -3, 11, 5);
    ctx.bezierCurveTo(18, -3, 26, 8, 11, 18);
    ctx.closePath();
    fillStroke(ctx, '#ff4f7a', '#a01a43', 1.6);
  });

  canvasTexture(scene, 'arrow-up', 30, 34, (ctx) => {
    ctx.beginPath();
    ctx.moveTo(15, 2);
    ctx.lineTo(28, 17);
    ctx.lineTo(20, 17);
    ctx.lineTo(20, 32);
    ctx.lineTo(10, 32);
    ctx.lineTo(10, 17);
    ctx.lineTo(2, 17);
    ctx.closePath();
    fillStroke(ctx, '#ffe14d', '#7a4b00', 2.5);
  });
}

// ------------------------------------------------------------------ Hindernisse

function hazardTextures(scene: Phaser.Scene): void {
  canvasTexture(scene, 'hz-stone', 42, 30, (ctx) => {
    ctx.beginPath();
    ctx.moveTo(3, 28);
    ctx.quadraticCurveTo(2, 10, 15, 5);
    ctx.quadraticCurveTo(30, 0, 38, 12);
    ctx.quadraticCurveTo(42, 22, 39, 28);
    ctx.closePath();
    fillStroke(ctx, vgrad(ctx, 2, 28, [[0, '#c9cdd6'], [1, '#868d9c']]), '#3c3f52', 2.5);
    ellipse(ctx, 16, 11, 6, 3);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fill();
    ellipse(ctx, 30, 20, 4, 3);
    ctx.fillStyle = 'rgba(80,90,110,0.35)';
    ctx.fill();
  });

  canvasTexture(scene, 'hz-stump', 46, 44, (ctx) => {
    ctx.beginPath();
    ctx.moveTo(4, 43);
    ctx.lineTo(8, 10);
    ctx.lineTo(38, 10);
    ctx.lineTo(42, 43);
    ctx.closePath();
    fillStroke(ctx, vgrad(ctx, 10, 44, [[0, '#a8683a'], [1, '#7a4423']]), '#3e2312', 2.5);
    ellipse(ctx, 23, 10, 15, 6);
    fillStroke(ctx, '#e8c48a', '#3e2312', 2.5);
    ellipse(ctx, 23, 10, 9, 3.5);
    ctx.strokeStyle = '#b98852';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ellipse(ctx, 23, 10, 3.5, 1.4);
    ctx.stroke();
    // Rindenstriche
    ctx.strokeStyle = 'rgba(60,30,10,0.45)';
    ctx.lineWidth = 2;
    for (const x of [14, 23, 32]) {
      ctx.beginPath();
      ctx.moveTo(x, 20);
      ctx.lineTo(x + 1, 36);
      ctx.stroke();
    }
    // kleiner Pilz
    ellipse(ctx, 38, 34, 6, 4);
    fillStroke(ctx, '#ff5a5a', '#5b1717', 1.5);
    ctx.fillStyle = '#ffffff';
    ellipse(ctx, 36, 33, 1.4, 1.2);
    ctx.fill();
  });

  canvasTexture(scene, 'hz-crystal', 38, 52, (ctx) => {
    const shard = (x: number, top: number, w: number, base: number, c1: string, c2: string): void => {
      ctx.beginPath();
      ctx.moveTo(x - w, base);
      ctx.lineTo(x - w * 0.8, top + w);
      ctx.lineTo(x, top);
      ctx.lineTo(x + w * 0.8, top + w);
      ctx.lineTo(x + w, base);
      ctx.closePath();
      fillStroke(ctx, vgrad(ctx, top, base, [[0, c1], [1, c2]]), '#2a1650', 2.2);
      ctx.beginPath();
      ctx.moveTo(x, top + 3);
      ctx.lineTo(x - w * 0.35, base - 4);
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 2;
      ctx.stroke();
    };
    shard(10, 20, 7, 51, '#c8a8ff', '#7a4ee0');
    shard(29, 16, 7, 51, '#a8f0ff', '#3fa7e8');
    shard(19, 2, 9, 51, '#f1d8ff', '#a066ff');
  });

  canvasTexture(scene, 'hz-rock', 48, 40, (ctx) => {
    ctx.beginPath();
    ctx.moveTo(3, 39);
    ctx.lineTo(6, 16);
    ctx.lineTo(18, 4);
    ctx.lineTo(34, 6);
    ctx.lineTo(45, 20);
    ctx.lineTo(45, 39);
    ctx.closePath();
    fillStroke(ctx, vgrad(ctx, 4, 40, [[0, '#8f86b8'], [1, '#544a7c']]), '#241a40', 2.5);
    ctx.beginPath();
    ctx.moveTo(18, 4);
    ctx.lineTo(22, 20);
    ctx.lineTo(45, 20);
    ctx.strokeStyle = 'rgba(36,26,64,0.45)';
    ctx.lineWidth = 2;
    ctx.stroke();
    star(ctx, 31, 28, 4, 1.6, 4);
    ctx.fillStyle = '#9ff3ff';
    ctx.fill();
  });

  canvasTexture(scene, 'hz-spikyBush', 48, 38, (ctx) => {
    // Gewitterwölkchen mit kleinen Blitzen – nicht anfassen!
    for (const [x, y, r] of [
      [14, 24, 11],
      [26, 18, 13],
      [36, 25, 10],
      [24, 28, 11],
    ]) {
      ellipse(ctx, x, y, r, r);
      fillStroke(ctx, '#6c6f9e', '#2c2c55', 2.4);
    }
    for (const [x, y, r] of [
      [14, 24, 9],
      [26, 18, 11],
      [36, 25, 8],
      [24, 28, 9],
    ]) {
      ellipse(ctx, x, y, r, r);
      ctx.fillStyle = '#7d80b3';
      ctx.fill();
    }
    eyes(ctx, 21, 31, 22, 3, 0);
    ctx.beginPath();
    ctx.moveTo(20, 30);
    ctx.quadraticCurveTo(26, 27, 32, 30);
    ctx.strokeStyle = '#2c2c55';
    ctx.lineWidth = 2;
    ctx.stroke();
    bolt(ctx, 9, 25, 0.9);
    fillStroke(ctx, '#ffe14d', '#8a5a00', 1.2);
    bolt(ctx, 39, 24, 0.9);
    fillStroke(ctx, '#ffe14d', '#8a5a00', 1.2);
  });

  canvasTexture(scene, 'hz-lavaRock', 46, 38, (ctx) => {
    ctx.beginPath();
    ctx.moveTo(3, 37);
    ctx.quadraticCurveTo(0, 14, 16, 6);
    ctx.quadraticCurveTo(30, 0, 41, 12);
    ctx.quadraticCurveTo(47, 24, 43, 37);
    ctx.closePath();
    fillStroke(ctx, vgrad(ctx, 2, 38, [[0, '#5a4058'], [1, '#2e1f2f']]), '#170c17', 2.5);
    ctx.strokeStyle = '#ff9a2a';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#ffcc33';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.moveTo(12, 30);
    ctx.lineTo(18, 20);
    ctx.lineTo(16, 12);
    ctx.moveTo(18, 20);
    ctx.lineTo(28, 22);
    ctx.lineTo(34, 14);
    ctx.moveTo(28, 22);
    ctx.lineTo(31, 32);
    ctx.stroke();
    ctx.shadowBlur = 0;
  });

  canvasTexture(scene, 'crate', 46, 46, (ctx) => {
    rr(ctx, 1.5, 1.5, 43, 43, 5);
    fillStroke(ctx, vgrad(ctx, 0, 46, [[0, '#e0a15a'], [1, '#b8763a']]), '#4a2a12', 3);
    ctx.strokeStyle = '#7a4a22';
    ctx.lineWidth = 3;
    rr(ctx, 7, 7, 32, 32, 3);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(9, 9);
    ctx.lineTo(37, 37);
    ctx.moveTo(37, 9);
    ctx.lineTo(9, 37);
    ctx.stroke();
    for (const [x, y] of [
      [5, 5],
      [41, 5],
      [5, 41],
      [41, 41],
    ]) {
      ellipse(ctx, x, y, 2, 2);
      ctx.fillStyle = '#4a2a12';
      ctx.fill();
    }
  });

  canvasTexture(scene, 'spring', 44, 26, (ctx) => {
    ctx.strokeStyle = '#4b5a78';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    for (let i = 0; i <= 4; i++) {
      const y = 22 - i * 4;
      ctx.moveTo(10, y);
      ctx.lineTo(34, y - 2);
    }
    ctx.stroke();
    rr(ctx, 4, 20, 36, 6, 3);
    fillStroke(ctx, '#7d8aa6', '#2c3550', 2);
    rr(ctx, 2, 1, 40, 9, 4.5);
    fillStroke(ctx, vgrad(ctx, 1, 10, [[0, '#ff7aa8'], [1, '#e83a74']]), '#6b1033', 2.2);
  });

  canvasTexture(scene, 'nozzle', 40, 18, (ctx) => {
    rr(ctx, 2, 4, 36, 14, 5);
    fillStroke(ctx, vgrad(ctx, 4, 18, [[0, '#6a5470'], [1, '#3a2a40']]), '#170c17', 2.2);
    ellipse(ctx, 20, 6, 11, 4);
    ctx.fillStyle = '#ff7a1a';
    ctx.fill();
  });

  canvasTexture(scene, 'flame', 40, 72, (ctx) => {
    const g = vgrad(ctx, 0, 72, [[0, 'rgba(255,240,140,0.95)'], [0.4, '#ffb22a'], [1, '#ff5a1a']]);
    ctx.beginPath();
    ctx.moveTo(20, 1);
    ctx.bezierCurveTo(34, 20, 40, 40, 36, 58);
    ctx.quadraticCurveTo(30, 72, 20, 71);
    ctx.quadraticCurveTo(10, 72, 4, 58);
    ctx.bezierCurveTo(0, 40, 6, 20, 20, 1);
    ctx.closePath();
    ctx.fillStyle = g;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(20, 22);
    ctx.bezierCurveTo(28, 34, 30, 48, 26, 60);
    ctx.quadraticCurveTo(20, 68, 14, 60);
    ctx.bezierCurveTo(10, 48, 12, 34, 20, 22);
    ctx.fillStyle = 'rgba(255,255,220,0.9)';
    ctx.fill();
  });
}

// ------------------------------------------------------------------ Gegner (freundlich, gut erkennbar)

function enemyTextures(scene: Phaser.Scene): void {
  canvasTexture(scene, 'en-snail', 54, 40, (ctx) => {
    // Körper
    ctx.beginPath();
    ctx.moveTo(4, 38);
    ctx.quadraticCurveTo(2, 26, 12, 24);
    ctx.lineTo(48, 30);
    ctx.quadraticCurveTo(54, 38, 46, 38);
    ctx.closePath();
    fillStroke(ctx, '#9be36a', '#2d5a1a', 2.4);
    // Fühler
    ctx.strokeStyle = '#2d5a1a';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(9, 25);
    ctx.lineTo(4, 10);
    ctx.moveTo(14, 25);
    ctx.lineTo(14, 9);
    ctx.stroke();
    eyes(ctx, 4, 14, 9, 3.6, -1);
    // Haus
    ellipse(ctx, 33, 21, 15, 15);
    fillStroke(ctx, vgrad(ctx, 6, 36, [[0, '#ff9ad0'], [1, '#d8559c']]), '#5a1840', 2.5);
    ctx.beginPath();
    for (let a = 0; a < Math.PI * 4; a += 0.2) {
      const r = 2 + a * 1.9;
      const x = 33 + Math.cos(a) * r;
      const y = 21 + Math.sin(a) * r;
      if (a === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = '#7a2058';
    ctx.lineWidth = 2;
    ctx.stroke();
  });

  canvasTexture(scene, 'en-beetle', 48, 36, (ctx) => {
    for (const x of [12, 22, 32]) {
      ctx.beginPath();
      ctx.moveTo(x, 26);
      ctx.lineTo(x - 4, 35);
      ctx.strokeStyle = '#2a1d3a';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
    ellipse(ctx, 26, 20, 19, 14);
    fillStroke(ctx, vgrad(ctx, 6, 34, [[0, '#5ad1ff'], [1, '#2a7fd6']]), '#13325c', 2.5);
    ctx.beginPath();
    ctx.moveTo(26, 6);
    ctx.lineTo(26, 33);
    ctx.strokeStyle = '#13325c';
    ctx.lineWidth = 2;
    ctx.stroke();
    for (const [x, y] of [
      [19, 14],
      [33, 16],
      [20, 25],
      [34, 26],
    ]) {
      ellipse(ctx, x, y, 3, 3);
      ctx.fillStyle = '#ffe14d';
      ctx.fill();
    }
    ellipse(ctx, 9, 22, 8, 8);
    fillStroke(ctx, '#2a1d3a', '#2a1d3a', 1);
    eyes(ctx, 6, 12, 20, 2.6, -1);
  });

  for (const frame of [0, 1]) {
    canvasTexture(scene, `en-bat-${frame}`, 56, 36, (ctx) => {
      const up = frame === 0;
      for (const d of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(28 + d * 8, 18);
        ctx.quadraticCurveTo(28 + d * 22, up ? 0 : 30, 28 + d * 27, up ? 6 : 26);
        ctx.quadraticCurveTo(28 + d * 20, up ? 14 : 22, 28 + d * 16, up ? 12 : 26);
        ctx.quadraticCurveTo(28 + d * 12, up ? 18 : 24, 28 + d * 8, 24);
        ctx.closePath();
        fillStroke(ctx, '#8a5ad6', '#2a1650', 2.2);
      }
      ellipse(ctx, 28, 20, 11, 11);
      fillStroke(ctx, '#a978f0', '#2a1650', 2.4);
      for (const d of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(28 + d * 4, 11);
        ctx.lineTo(28 + d * 8, 3);
        ctx.lineTo(28 + d * 10, 13);
        ctx.closePath();
        fillStroke(ctx, '#a978f0', '#2a1650', 2);
      }
      eyes(ctx, 24, 32, 19, 3, -1);
      ctx.beginPath();
      ctx.moveTo(25, 26);
      ctx.lineTo(27, 29);
      ctx.lineTo(29, 26);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    });
    canvasTexture(scene, `en-bird-${frame}`, 54, 38, (ctx) => {
      const up = frame === 0;
      ellipse(ctx, 26, 22, 15, 12);
      fillStroke(ctx, vgrad(ctx, 10, 34, [[0, '#ffd84a'], [1, '#ffa31a']]), '#6a3a00', 2.4);
      ctx.beginPath();
      ctx.moveTo(24, 18);
      ctx.quadraticCurveTo(34, up ? 0 : 36, 44, up ? 4 : 32);
      ctx.quadraticCurveTo(38, 20, 30, 24);
      ctx.closePath();
      fillStroke(ctx, '#ffeb8a', '#6a3a00', 2);
      ctx.beginPath();
      ctx.moveTo(11, 20);
      ctx.lineTo(2, 23);
      ctx.lineTo(11, 26);
      ctx.closePath();
      fillStroke(ctx, '#ff7a1a', '#6a3a00', 1.8);
      eyes(ctx, 15, 22, 18, 3, -1);
      ctx.beginPath();
      ctx.moveTo(40, 22);
      ctx.lineTo(52, 18);
      ctx.lineTo(50, 26);
      ctx.closePath();
      fillStroke(ctx, '#ffa31a', '#6a3a00', 1.8);
    });
  }

  canvasTexture(scene, 'en-blob', 46, 40, (ctx) => {
    ctx.beginPath();
    ctx.moveTo(3, 38);
    ctx.quadraticCurveTo(0, 10, 23, 4);
    ctx.quadraticCurveTo(46, 10, 43, 38);
    ctx.closePath();
    fillStroke(ctx, vgrad(ctx, 4, 38, [[0, '#ffcf4a'], [0.6, '#ff7a1a'], [1, '#e8401a']]), '#6a1a00', 2.5);
    ellipse(ctx, 15, 14, 4, 3);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fill();
    eyes(ctx, 15, 27, 21, 4, -1);
    ctx.beginPath();
    ctx.arc(21, 29, 4, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.strokeStyle = '#6a1a00';
    ctx.lineWidth = 2;
    ctx.stroke();
  });
}

// ------------------------------------------------------------------ Checkpoint, Ziel, Schilder

function markerTextures(scene: Phaser.Scene): void {
  for (const on of [false, true]) {
    canvasTexture(scene, on ? 'cp-on' : 'cp-off', 44, 90, (ctx) => {
      rr(ctx, 5, 6, 5, 82, 2.5);
      fillStroke(ctx, '#e8e8f0', '#3a3a50', 2);
      ellipse(ctx, 7.5, 6, 5, 5);
      fillStroke(ctx, '#ffd23f', '#7a5a00', 2);
      const y = on ? 10 : 50;
      ctx.beginPath();
      ctx.moveTo(10, y);
      ctx.quadraticCurveTo(26, y - 4, 42, y + 6);
      ctx.quadraticCurveTo(28, y + 14, 42, y + 24);
      ctx.quadraticCurveTo(26, y + 20, 10, y + 26);
      ctx.closePath();
      fillStroke(ctx, on ? '#3ddc84' : '#b7bccb', on ? '#16603a' : '#5a5f70', 2);
      if (on) {
        bolt(ctx, 23, y + 4, 1.1);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
      }
      rr(ctx, 0, 84, 16, 6, 3);
      ctx.fillStyle = '#5a5f70';
      ctx.fill();
    });
  }

  canvasTexture(scene, 'goal', 120, 170, (ctx) => {
    for (const x of [8, 104]) {
      rr(ctx, x, 20, 9, 150, 4);
      fillStroke(ctx, vgrad(ctx, 0, 170, [[0, '#ffffff'], [1, '#c8cbe0']]), '#3a3a50', 2.4);
      ellipse(ctx, x + 4.5, 18, 8, 8);
      fillStroke(ctx, '#ffd23f', '#7a5a00', 2.4);
    }
    rr(ctx, 4, 30, 112, 40, 10);
    fillStroke(ctx, vgrad(ctx, 30, 70, [[0, '#ff5a8a'], [1, '#e8306a']]), '#6b1033', 3);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 26px Fredoka, "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('ZIEL', 60, 51);
    // Schachbrett-Streifen
    for (let i = 0; i < 12; i++) {
      ctx.fillStyle = i % 2 ? '#2b1d3a' : '#ffffff';
      ctx.fillRect(12 + i * 8, 72, 8, 6);
      ctx.fillStyle = i % 2 ? '#ffffff' : '#2b1d3a';
      ctx.fillRect(12 + i * 8, 78, 8, 6);
    }
  });

  canvasTexture(scene, 'sign', 150, 92, (ctx) => {
    rr(ctx, 70, 40, 10, 52, 3);
    fillStroke(ctx, '#9a6a3a', '#3e2312', 2);
    rr(ctx, 4, 4, 142, 48, 10);
    fillStroke(ctx, vgrad(ctx, 4, 52, [[0, '#ffe7a8'], [1, '#f4c56a']]), '#6a4212', 3);
  });
}

// ------------------------------------------------------------------ Boden, Plattformen und Hintergründe je Welt

export interface ThemeColors {
  skyTop: string;
  skyBottom: string;
  far: string;
  mid: string;
  near: string;
  groundTop: string;
  groundTop2: string;
  groundFill: string;
  groundFill2: string;
  edge: string;
  pit: string;
  pit2: string;
  /** Phaser-Hintergrundfarbe als Zahl. */
  bg: number;
  /** Farbe der Staubwolken. */
  dust: number;
}

export const THEMES: Record<ThemeId, ThemeColors> = {
  meadow: {
    skyTop: '#5ec8ff',
    skyBottom: '#d8f5ff',
    far: '#9fd7c4',
    mid: '#6cc56a',
    near: '#3f9e4a',
    groundTop: '#6fdc4a',
    groundTop2: '#3fae36',
    groundFill: '#b97a45',
    groundFill2: '#9c6236',
    edge: '#4a2a12',
    pit: '#3fa2ff',
    pit2: '#1f62c8',
    bg: 0x5ec8ff,
    dust: 0xf4e8c8,
  },
  cave: {
    skyTop: '#241a4a',
    skyBottom: '#4a3784',
    far: '#3b2d6e',
    mid: '#54418f',
    near: '#2c2058',
    groundTop: '#8f7ad8',
    groundTop2: '#6a54b8',
    groundFill: '#4e3f84',
    groundFill2: '#3e3070',
    edge: '#1a1236',
    pit: '#2a1a5a',
    pit2: '#120a2c',
    bg: 0x241a4a,
    dust: 0xc9b8ff,
  },
  clouds: {
    skyTop: '#ffb3d9',
    skyBottom: '#bfe6ff',
    far: '#ffffff',
    mid: '#ffffff',
    near: '#ffffff',
    groundTop: '#ffffff',
    groundTop2: '#e6f2ff',
    groundFill: '#f3f8ff',
    groundFill2: '#d6e6fa',
    edge: '#7a90c8',
    pit: '#c9ecff',
    pit2: '#9fd6ff',
    bg: 0xffb3d9,
    dust: 0xffffff,
  },
  volcano: {
    skyTop: '#ff8a5a',
    skyBottom: '#ffd68a',
    far: '#a85a6a',
    mid: '#7a3f55',
    near: '#5a2c40',
    groundTop: '#8a5a50',
    groundTop2: '#6a4040',
    groundFill: '#4f3036',
    groundFill2: '#3e252b',
    edge: '#1e0f14',
    pit: '#ff9a1a',
    pit2: '#ff4a1a',
    bg: 0xff8a5a,
    dust: 0xffc49a,
  },
};

function tileable(w: number, fn: (dx: number) => void): void {
  fn(0);
  fn(-w);
  fn(w);
}

function themeTextures(scene: Phaser.Scene, theme: ThemeId): void {
  const c = THEMES[theme];
  const W = 960;

  // Himmel
  canvasTexture(scene, `${theme}-sky`, 4, 540, (ctx) => {
    ctx.fillStyle = vgrad(ctx, 0, 540, [[0, c.skyTop], [1, c.skyBottom]]);
    ctx.fillRect(0, 0, 4, 540);
  });

  // Ferne Ebene
  canvasTexture(scene, `${theme}-far`, W, 300, (ctx) => {
    ctx.fillStyle = c.far;
    if (theme === 'meadow') {
      tileable(W, (dx) => {
        for (const [x, h, r] of [
          [80, 170, 170],
          [330, 210, 210],
          [600, 160, 180],
          [820, 200, 190],
        ]) {
          ctx.beginPath();
          ctx.moveTo(dx + x - r, 300);
          ctx.quadraticCurveTo(dx + x, 300 - h * 2, dx + x + r, 300);
          ctx.fill();
        }
      });
      // Sonne mit Gesicht
      ellipse(ctx, 760, 70, 42, 42);
      ctx.fillStyle = '#fff3a0';
      ctx.fill();
      ellipse(ctx, 760, 70, 34, 34);
      ctx.fillStyle = '#ffe14d';
      ctx.fill();
      eyes(ctx, 748, 772, 64, 5, 0);
      smile(ctx, 760, 84, 16);
    } else if (theme === 'cave') {
      tileable(W, (dx) => {
        for (let i = 0; i < 9; i++) {
          const x = dx + i * 110 + 20;
          const h = 60 + ((i * 47) % 70);
          ctx.beginPath();
          ctx.moveTo(x - 30, 0);
          ctx.lineTo(x, h);
          ctx.lineTo(x + 30, 0);
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(x + 25, 300);
          ctx.lineTo(x + 55, 300 - h * 1.3);
          ctx.lineTo(x + 85, 300);
          ctx.fill();
        }
      });
      // glimmende Punkte
      for (let i = 0; i < 40; i++) {
        const x = (i * 197) % W;
        const y = 40 + ((i * 83) % 200);
        ellipse(ctx, x, y, 2, 2);
        ctx.fillStyle = i % 3 ? 'rgba(160,240,255,0.7)' : 'rgba(255,170,255,0.7)';
        ctx.fill();
      }
    } else if (theme === 'clouds') {
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      tileable(W, (dx) => {
        for (const [x, y, s] of [
          [100, 120, 1.2],
          [380, 80, 0.9],
          [620, 150, 1.4],
          [860, 100, 1],
        ]) {
          for (const [ox, oy, r] of [
            [0, 0, 40],
            [-40, 12, 28],
            [42, 10, 30],
            [18, -20, 28],
          ]) {
            ellipse(ctx, dx + x + ox * s, y + oy * s, r * s, r * s);
            ctx.fill();
          }
        }
      });
      // Regenbogen
      const cols = ['#ff6b6b', '#ffb84d', '#ffe14d', '#6bdc6b', '#4db8ff', '#9a7aff'];
      cols.forEach((col, i) => {
        ctx.beginPath();
        ctx.arc(520, 330, 230 - i * 12, Math.PI, 2 * Math.PI);
        ctx.strokeStyle = col;
        ctx.globalAlpha = 0.45;
        ctx.lineWidth = 12;
        ctx.stroke();
      });
      ctx.globalAlpha = 1;
    } else {
      // Vulkan mit freundlicher Rauchwolke
      tileable(W, (dx) => {
        ctx.fillStyle = c.far;
        ctx.beginPath();
        ctx.moveTo(dx + 180, 300);
        ctx.lineTo(dx + 400, 70);
        ctx.lineTo(dx + 470, 70);
        ctx.lineTo(dx + 700, 300);
        ctx.fill();
        ctx.fillStyle = '#ff7a2a';
        ctx.beginPath();
        ctx.moveTo(dx + 400, 70);
        ctx.lineTo(dx + 470, 70);
        ctx.lineTo(dx + 452, 100);
        ctx.lineTo(dx + 440, 85);
        ctx.lineTo(dx + 425, 110);
        ctx.lineTo(dx + 415, 88);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = 'rgba(255,240,230,0.7)';
        for (const [x, y, r] of [
          [435, 50, 22],
          [455, 28, 18],
          [425, 20, 15],
        ]) {
          ellipse(ctx, dx + x, y, r, r);
          ctx.fill();
        }
      });
    }
  });

  // Mittlere Ebene
  canvasTexture(scene, `${theme}-mid`, W, 260, (ctx) => {
    if (theme === 'meadow') {
      ctx.fillStyle = c.mid;
      tileable(W, (dx) => {
        ctx.beginPath();
        ctx.moveTo(dx, 260);
        for (let x = 0; x <= W; x += 20) ctx.lineTo(dx + x, 150 + Math.sin((x / W) * Math.PI * 4) * 35);
        ctx.lineTo(dx + W, 260);
        ctx.fill();
      });
      // Bäume
      for (const x of [120, 300, 520, 760, 900]) {
        rr(ctx, x - 5, 120, 10, 60, 4);
        ctx.fillStyle = '#7a4a2a';
        ctx.fill();
        for (const [ox, oy, r] of [
          [0, 100, 30],
          [-20, 115, 22],
          [20, 115, 22],
        ]) {
          ellipse(ctx, x + ox, oy, r, r);
          ctx.fillStyle = '#3f9e4a';
          ctx.fill();
        }
        ellipse(ctx, x - 8, 92, 9, 7);
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.fill();
      }
    } else if (theme === 'cave') {
      ctx.fillStyle = c.mid;
      tileable(W, (dx) => {
        for (let i = 0; i < 6; i++) {
          const x = dx + i * 160 + 40;
          ctx.beginPath();
          ctx.moveTo(x - 50, 260);
          ctx.lineTo(x - 20, 140 + (i % 3) * 25);
          ctx.lineTo(x + 10, 170);
          ctx.lineTo(x + 40, 120 + (i % 2) * 30);
          ctx.lineTo(x + 70, 260);
          ctx.fill();
        }
      });
      for (let i = 0; i < 7; i++) {
        const x = 70 + i * 135;
        ctx.save();
        ctx.shadowColor = i % 2 ? '#8ff0ff' : '#ff9af0';
        ctx.shadowBlur = 14;
        star(ctx, x, 200 - (i % 3) * 20, 9, 4, 4);
        ctx.fillStyle = i % 2 ? '#bff6ff' : '#ffd0f8';
        ctx.fill();
        ctx.restore();
      }
    } else if (theme === 'clouds') {
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      tileable(W, (dx) => {
        for (let i = 0; i < 6; i++) {
          const x = dx + i * 170 + 60;
          const y = 200 + (i % 2) * 25;
          for (const [ox, oy, r] of [
            [0, 0, 34],
            [-34, 10, 24],
            [36, 8, 26],
          ]) {
            ellipse(ctx, x + ox, y + oy, r, r);
            ctx.fill();
          }
        }
      });
      // kleine Ballons
      for (const [x, y, col] of [
        [210, 90, '#ff6b9a'],
        [640, 60, '#6bc8ff'],
        [880, 120, '#ffd23f'],
      ] as const) {
        ellipse(ctx, x, y, 12, 15);
        fillStroke(ctx, col, 'rgba(0,0,0,0.25)', 1.5);
        ctx.beginPath();
        ctx.moveTo(x, y + 15);
        ctx.lineTo(x + 3, y + 40);
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    } else {
      ctx.fillStyle = c.mid;
      tileable(W, (dx) => {
        ctx.beginPath();
        ctx.moveTo(dx, 260);
        for (let x = 0; x <= W; x += 40) ctx.lineTo(dx + x, 160 + ((x * 37) % 60));
        ctx.lineTo(dx + W, 260);
        ctx.fill();
      });
      for (const x of [150, 420, 700]) {
        ctx.strokeStyle = 'rgba(255,140,40,0.6)';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(x, 190);
        ctx.quadraticCurveTo(x + 20, 220, x + 5, 260);
        ctx.stroke();
      }
    }
  });

  // Nahe Ebene (Büsche, Gras, Stalagmiten …)
  canvasTexture(scene, `${theme}-near`, W, 120, (ctx) => {
    if (theme === 'meadow') {
      tileable(W, (dx) => {
        for (let i = 0; i < 8; i++) {
          const x = dx + i * 125 + 30;
          for (const [ox, r] of [
            [0, 24],
            [22, 18],
            [-20, 16],
          ]) {
            ellipse(ctx, x + ox, 100, r, r);
            ctx.fillStyle = c.near;
            ctx.fill();
          }
          for (const [ox, col] of [
            [-6, '#ff6b9a'],
            [10, '#ffe14d'],
          ] as const) {
            ellipse(ctx, x + ox, 86, 4, 4);
            ctx.fillStyle = col;
            ctx.fill();
          }
        }
      });
    } else if (theme === 'cave') {
      ctx.fillStyle = c.near;
      tileable(W, (dx) => {
        for (let i = 0; i < 10; i++) {
          const x = dx + i * 96 + 20;
          ctx.beginPath();
          ctx.moveTo(x - 14, 120);
          ctx.lineTo(x, 60 + (i % 3) * 15);
          ctx.lineTo(x + 14, 120);
          ctx.fill();
        }
      });
    } else if (theme === 'clouds') {
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      tileable(W, (dx) => {
        for (let i = 0; i < 7; i++) {
          ellipse(ctx, dx + i * 140 + 40, 105, 50, 22);
          ctx.fill();
        }
      });
    } else {
      ctx.fillStyle = c.near;
      tileable(W, (dx) => {
        for (let i = 0; i < 9; i++) {
          const x = dx + i * 107 + 30;
          ctx.beginPath();
          ctx.moveTo(x - 20, 120);
          ctx.lineTo(x - 8, 80);
          ctx.lineTo(x + 6, 90);
          ctx.lineTo(x + 20, 120);
          ctx.fill();
        }
      });
    }
  });

  // Bodenfüllung (kachelbar 64 × 64)
  canvasTexture(scene, `${theme}-fill`, 64, 64, (ctx) => {
    ctx.fillStyle = c.groundFill;
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = c.groundFill2;
    if (theme === 'clouds') {
      for (const [x, y, r] of [
        [12, 18, 9],
        [44, 40, 11],
        [30, 58, 7],
      ]) {
        ellipse(ctx, x, y, r, r * 0.7);
        ctx.fill();
      }
    } else {
      for (const [x, y, r] of [
        [10, 14, 5],
        [40, 10, 4],
        [28, 36, 6],
        [54, 48, 5],
        [12, 52, 4],
      ]) {
        ellipse(ctx, x, y, r, r * 0.75);
        ctx.fill();
      }
      if (theme === 'cave') {
        star(ctx, 46, 28, 3.5, 1.4, 4);
        ctx.fillStyle = '#bff6ff';
        ctx.fill();
      }
      if (theme === 'volcano') {
        ctx.strokeStyle = 'rgba(255,120,40,0.55)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(4, 30);
        ctx.lineTo(18, 26);
        ctx.lineTo(24, 34);
        ctx.stroke();
      }
    }
  });

  // Bodenoberkante (kachelbar 64 × 26)
  canvasTexture(scene, `${theme}-top`, 64, 26, (ctx) => {
    if (theme === 'clouds') {
      ctx.fillStyle = c.groundFill;
      ctx.fillRect(0, 10, 64, 16);
      ctx.fillStyle = '#ffffff';
      for (const [x, r] of [
        [0, 13],
        [22, 12],
        [42, 13],
        [64, 13],
      ]) {
        ellipse(ctx, x, 13, r, 11);
        ctx.fill();
      }
      return;
    }
    ctx.fillStyle = c.groundTop2;
    ctx.fillRect(0, 6, 64, 20);
    ctx.fillStyle = c.groundTop;
    ctx.beginPath();
    ctx.moveTo(0, 22);
    for (let x = 0; x <= 64; x += 8) ctx.lineTo(x, x % 16 === 0 ? 20 : 25);
    ctx.lineTo(64, 0);
    ctx.lineTo(0, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.fillRect(0, 2, 64, 4);
    if (theme === 'meadow') {
      ctx.strokeStyle = '#2f8a2a';
      ctx.lineWidth = 2;
      for (const x of [8, 30, 50]) {
        ctx.beginPath();
        ctx.moveTo(x, 4);
        ctx.lineTo(x - 2, -3);
        ctx.stroke();
      }
    }
  });

  // Plattform-Kachel (für Felsplatten, bewegliche Plattformen)
  canvasTexture(scene, `${theme}-ledge`, 64, 28, (ctx) => {
    if (theme === 'clouds') {
      ctx.fillStyle = '#ffffff';
      for (const [x, r] of [
        [0, 14],
        [21, 13],
        [42, 14],
        [64, 14],
      ]) {
        ellipse(ctx, x, 14, r, 12);
        ctx.fill();
      }
      ctx.fillStyle = '#dcebff';
      ctx.fillRect(0, 20, 64, 6);
      return;
    }
    const base = theme === 'meadow' ? '#c98a4a' : theme === 'cave' ? '#7a68c0' : '#6a4a48';
    const dark = theme === 'meadow' ? '#8a5a2a' : theme === 'cave' ? '#4a3a88' : '#3e2a2e';
    ctx.fillStyle = dark;
    ctx.fillRect(0, 8, 64, 20);
    ctx.fillStyle = base;
    ctx.fillRect(0, 6, 64, 14);
    ctx.fillStyle = c.groundTop;
    ctx.fillRect(0, 0, 64, 8);
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect(0, 1, 64, 2);
    ctx.fillStyle = dark;
    for (const x of [14, 46]) {
      ellipse(ctx, x, 16, 3, 2.2);
      ctx.fill();
    }
  });

  // Graben-Boden (Wasser, Kristallschlucht, tiefer Himmel, Lava)
  canvasTexture(scene, `${theme}-pit`, 128, 90, (ctx) => {
    ctx.fillStyle = vgrad(ctx, 0, 90, [[0, c.pit], [1, c.pit2]]);
    ctx.fillRect(0, 0, 128, 90);
    if (theme === 'meadow' || theme === 'volcano') {
      ctx.fillStyle = theme === 'meadow' ? 'rgba(255,255,255,0.5)' : 'rgba(255,240,150,0.8)';
      ctx.beginPath();
      ctx.moveTo(0, 8);
      for (let x = 0; x <= 128; x += 16) ctx.quadraticCurveTo(x + 8, x % 32 ? 2 : 14, x + 16, 8);
      ctx.lineTo(128, 0);
      ctx.lineTo(0, 0);
      ctx.fill();
      if (theme === 'volcano') {
        for (const [x, y, r] of [
          [30, 30, 6],
          [90, 50, 8],
          [60, 70, 5],
        ]) {
          ellipse(ctx, x, y, r, r);
          ctx.fillStyle = 'rgba(255,230,120,0.75)';
          ctx.fill();
        }
      }
    } else if (theme === 'cave') {
      for (const x of [20, 70, 110]) {
        star(ctx, x, 30 + (x % 40), 5, 2, 4);
        ctx.fillStyle = 'rgba(200,170,255,0.7)';
        ctx.fill();
      }
    }
  });
}

function decoTextures(scene: Phaser.Scene): void {
  ['#ff6b9a', '#ffe14d', '#ffffff', '#a978f0'].forEach((col, i) => {
    canvasTexture(scene, `deco-flower-${i}`, 16, 22, (ctx) => {
      ctx.fillStyle = '#2f8a2a';
      ctx.fillRect(7, 8, 2, 14);
      for (let a = 0; a < 5; a++) {
        ellipse(ctx, 8 + Math.cos(a * 1.26) * 4, 7 + Math.sin(a * 1.26) * 4, 3, 3);
        ctx.fillStyle = col;
        ctx.fill();
      }
      ellipse(ctx, 8, 7, 2.2, 2.2);
      ctx.fillStyle = '#ffb800';
      ctx.fill();
    });
  });
  ['#8ff0ff', '#d9a8ff'].forEach((col, i) => {
    canvasTexture(scene, `deco-crystal-${i}`, 14, 22, (ctx) => {
      ctx.beginPath();
      ctx.moveTo(2, 22);
      ctx.lineTo(7, 1);
      ctx.lineTo(12, 22);
      ctx.closePath();
      ctx.fillStyle = col;
      ctx.globalAlpha = 0.9;
      ctx.fill();
    });
  });
  canvasTexture(scene, 'deco-ember', 12, 10, (ctx) => {
    ellipse(ctx, 6, 6, 4.5, 3.5);
    ctx.fillStyle = 'rgba(255,154,42,0.85)';
    ctx.fill();
  });
}

/** Erzeugt alle Texturen (einmal beim Start). */
export function createAllTextures(scene: Phaser.Scene): void {
  heroTextures(scene);
  pickupTextures(scene);
  hazardTextures(scene);
  enemyTextures(scene);
  markerTextures(scene);
  decoTextures(scene);
  for (const t of Object.keys(THEMES) as ThemeId[]) themeTextures(scene, t);
}

export { canvasTexture, rr, ellipse, fillStroke, vgrad, star, bolt, eyes, smile };
