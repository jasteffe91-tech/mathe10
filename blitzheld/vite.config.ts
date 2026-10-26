import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// Quelltext liegt in src/, der fertige Build landet direkt in blitzheld/ (index.html + assets/),
// damit GitHub Pages das Spiel ohne Build-Schritt unter /mathe10/blitzheld/ ausliefern kann.
// tools/clean.mjs entfernt vor jedem Build den alten Stand.
const projectDir = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root: 'src',
  base: './',
  publicDir: false,
  build: {
    outDir: projectDir,
    emptyOutDir: false,
    assetsDir: 'assets',
    target: 'es2020',
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks: { phaser: ['phaser'] },
      },
    },
  },
  server: { port: 5173 },
  preview: { port: 4173 },
});
