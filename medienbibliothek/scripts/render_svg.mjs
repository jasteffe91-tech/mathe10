// Rastert SVG-Dateien mit Playwright/Chromium zu PNG (transparenter Hintergrund).
// Aufruf: node scripts/render_svg.mjs jobs.json
// jobs.json: {"width": 720, "jobs": [{"svg": "/pfad/a.svg", "png": "/pfad/a.png"}, ...]}
// Die SVGs werden als <img> mit data:-URL geladen: Skripte in den Dateien werden
// dabei vom Browser nicht ausgeführt, externe Ressourcen nicht nachgeladen.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  ({ chromium } = await import('playwright'));
}

const cfg = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const width = cfg.width || 720;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: width + 20, height: width + 20 } });
let ok = 0;
for (const job of cfg.jobs) {
  try {
    const b64 = readFileSync(job.svg).toString('base64');
    await page.setContent(
      `<html><body style="margin:0;background:transparent"><img id="i" src="data:image/svg+xml;base64,${b64}" ` +
      `style="display:block;width:${width}px;height:auto;max-height:${width}px;object-fit:contain"></body></html>`
    );
    const loaded = await page.waitForFunction(() => {
      const i = document.getElementById('i');
      return i.complete ? (i.naturalWidth > 0 ? 'ok' : 'broken') : false;
    }, null, { timeout: 15000 });
    if ((await loaded.jsonValue()) !== 'ok') { console.error('nicht darstellbar', job.svg); continue; }
    const box = await page.locator('#i').boundingBox();
    if (!box || box.width < 2 || box.height < 2) continue;
    await page.locator('#i').screenshot({ path: job.png, omitBackground: true });
    ok++;
  } catch (e) {
    console.error('Fehler', job.svg, String(e).slice(0, 200));
  }
}
await browser.close();
console.log(`gerendert: ${ok}/${cfg.jobs.length}`);
