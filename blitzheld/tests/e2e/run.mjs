// Browsertests für Blitzheld: startet den fertigen Build (blitzheld/index.html + assets/) mit einem
// kleinen statischen Server und steuert das echte Spiel in Chromium (Playwright).
//
//   npm run build && npm run test:e2e
//
// Voraussetzung: Playwright mit Chromium (`npm i -D playwright && npx playwright install chromium`).
// Screenshots bei Fehlern landen in blitzheld/.shots/ (nicht im Repository).

import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SHOTS = join(ROOT, '.shots');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.woff': 'font/woff', '.svg': 'image/svg+xml' };

if (!existsSync(join(ROOT, 'index.html'))) {
  console.error('Kein Build gefunden – bitte zuerst `npm run build` ausführen.');
  process.exit(1);
}

// ------------------------------------------------------------------ Server

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://localhost');
    let path = decodeURIComponent(url.pathname);
    if (path.endsWith('/')) path += 'index.html';
    const file = normalize(join(ROOT, path));
    if (!file.startsWith(ROOT) || !(path === '/index.html' || path.startsWith('/assets/'))) {
      res.writeHead(404).end();
      return;
    }
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' }).end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}/`;

// ------------------------------------------------------------------ Mini-Testrahmen

const results = [];
const only = process.argv[2];
const browser = await chromium.launch();
await mkdir(SHOTS, { recursive: true });

async function test(name, fn, opts = {}) {
  if (only && !name.toLowerCase().includes(only.toLowerCase())) return;
  const context = await browser.newContext(opts.context ?? { viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console.error: ${m.text()}`);
  });
  const t0 = Date.now();
  try {
    if (opts.seed) {
      await page.addInitScript((data) => {
        if (!sessionStorage.getItem('seeded')) {
          localStorage.setItem('blitzheld.save.v1', JSON.stringify(data));
          sessionStorage.setItem('seeded', '1');
        }
      }, opts.seed);
    }
    await page.goto(BASE + (opts.query ?? ''));
    await page.waitForFunction(() => window.__blitz && window.__blitz.state() === 'MENU', null, { timeout: 20000 });
    await fn(page, context);
    if (errors.length) throw new Error(`Fehler in der Browserkonsole:\n${errors.join('\n')}`);
    results.push({ name, ok: true, ms: Date.now() - t0 });
    console.log(`  ✓ ${name} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  } catch (e) {
    const shot = join(SHOTS, `${name.replace(/[^a-z0-9äöü]+/gi, '_')}.png`);
    await page.screenshot({ path: shot }).catch(() => {});
    results.push({ name, ok: false, error: e });
    console.log(`  ✗ ${name}\n    ${String(e.stack ?? e).split('\n').slice(0, 6).join('\n    ')}\n    Screenshot: ${shot}`);
  } finally {
    await context.close();
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(`Erwartung verletzt: ${msg}`);
}

const B = (page, expr, arg) => page.evaluate(expr, arg);
const state = (page) => B(page, () => window.__blitz.state());
const waitState = (page, s, timeout = 20000) =>
  page.waitForFunction((s) => [].concat(s).includes(window.__blitz.state()), s, { timeout });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Wartet, bis der Held x erreicht hat. */
const waitX = (page, x, timeout = 30000) =>
  page.waitForFunction((x) => (window.__blitz.player()?.x ?? 0) >= x, x, { timeout });

async function startFirstLevel(page) {
  await page.click('[data-action="play"]');
  await waitState(page, 'PLAYING');
}

/** Löst die offenen Mathe-Aufgaben richtig (per Tastatur oder Bildschirmtastatur). */
async function solveMath(page, { pad = false } = {}) {
  await waitState(page, 'MATH_CHALLENGE');
  for (let i = 0; i < 3; i++) {
    await page.waitForFunction((i) => window.__blitz.math() && window.__blitz.math().solved === i && !window.__blitz.math().locked, i);
    const m = await B(page, () => window.__blitz.math());
    if (pad) {
      for (const d of String(m.answer)) await page.click(`#math-pad [data-key="${d}"]`);
      await page.click('#math-check');
    } else {
      await page.fill('#math-input', String(m.answer));
      await page.keyboard.press('Enter');
    }
    if (i < 2) await page.waitForFunction((i) => window.__blitz.math()?.solved === i + 1 && !window.__blitz.math().locked, i);
  }
}

/** Lässt den Helden ins nächste Hindernis laufen und wartet auf das Mathefenster. */
async function dieOnce(page) {
  await waitState(page, 'PLAYING');
  await waitState(page, ['DYING', 'MATH_CHALLENGE'], 30000);
  await waitState(page, 'MATH_CHALLENGE');
}

// ------------------------------------------------------------------ Tests

console.log(`Blitzheld – Browsertests gegen ${BASE}`);

await test('Start: Menü erscheint ohne Fehler, Knöpfe funktionieren', async (page) => {
  assert(await page.isVisible('#screen-menu'), 'Menü sichtbar');
  assert((await page.textContent('.title-main')) === 'Blitzheld', 'Titel');
  for (const label of ['Spielen', 'Welten', 'Hilfe', 'Ton an']) {
    assert(await page.isVisible(`#screen-menu .btn:has-text("${label}")`), `Knopf ${label}`);
  }
  await page.click('[data-action="worlds"]');
  assert(await page.isVisible('#screen-worlds'), 'Weltenauswahl');
  assert((await page.locator('#world-list .world-card').count()) === 4, 'vier Welten');
  assert((await page.locator('#world-list .world-card.locked').count()) === 3, 'drei gesperrt');
  await page.click('#screen-worlds [data-action="back"]');
  await page.click('[data-action="help"]');
  assert(await page.isVisible('#screen-help'), 'Hilfe');
  await page.click('#screen-help [data-action="back"]');
  assert(await page.isVisible('#screen-menu'), 'zurück im Menü');
  // Ton aus/an wird gespeichert
  await page.click('#screen-menu [data-action="sound"]');
  assert((await page.textContent('#screen-menu .sound-label')) === 'Ton aus', 'Ton aus');
  assert((await B(page, () => window.__blitz.progress().settings.sound)) === false, 'Ton-Einstellung gespeichert');
  await page.click('#screen-menu [data-action="sound"]');
  assert((await page.textContent('#screen-menu .sound-label')) === 'Ton an', 'Ton wieder an');
});

await test('Spielen: Bereit-Los, Startanzeige und automatischer Lauf nach vorne', async (page) => {
  await page.click('[data-action="play"]');
  await waitState(page, 'RESPAWNING');
  assert((await page.textContent('#ready-text')).includes('Bereit'), '„Bereit?“');
  assert((await page.textContent('#start-hint')) === 'Drücke LEERTASTE zum Springen!', 'Starthinweis');
  const x0 = (await B(page, () => window.__blitz.player())).x;
  await sleep(500);
  assert((await B(page, () => window.__blitz.player())).x === x0, 'steht während „Bereit?“');
  await waitState(page, 'PLAYING');
  await sleep(1000);
  const x1 = (await B(page, () => window.__blitz.player())).x;
  assert(x1 > x0 + 100, `läuft automatisch (${x0} → ${x1})`);
  assert((await page.locator('#hud-hearts .ico').count()) === 5, 'fünf Herzen');
  assert((await page.textContent('#hud-label')) === 'Welt 1 · Level 1', 'Levelanzeige');
});

await test('Leertaste springt, Pfeil hoch und W auch', async (page) => {
  await startFirstLevel(page);
  for (const key of ['Space', 'ArrowUp', 'KeyW']) {
    await page.waitForFunction(() => window.__blitz.player().grounded);
    await page.keyboard.down(key);
    await page.waitForFunction(() => window.__blitz.player().vy < 0 && !window.__blitz.player().grounded, null, { timeout: 3000 });
    await page.keyboard.up(key);
    await page.waitForFunction(() => window.__blitz.player().grounded, null, { timeout: 3000 });
  }
  assert((await B(page, () => window.__blitz.pressCount())) === 3, 'drei Sprünge gezählt');
});

await test('Über ein Hindernis springen', async (page) => {
  await startFirstLevel(page);
  const lv = await B(page, () => window.__blitz.level());
  const stone = lv.hazards[0];
  await waitX(page, stone.x - 95);
  await page.keyboard.down('Space');
  await sleep(250);
  await page.keyboard.up('Space');
  await waitX(page, stone.x + stone.w + 60);
  const p = await B(page, () => window.__blitz.player());
  assert(p.deaths === 0 && (await state(page)) === 'PLAYING', 'kein Unfall am Stein');
});

await test('Treffer: genau ein Tod, ein Herz weniger, Mathefenster mit 3 Aufgaben', async (page) => {
  await startFirstLevel(page);
  await dieOnce(page);
  const hist = await B(page, () => window.__blitz.history());
  assert(hist.filter((s) => s === 'DYING').length === 1, 'genau ein DYING');
  assert(hist.filter((s) => s === 'MATH_CHALLENGE').length === 1, 'genau ein Mathefenster');
  assert((await B(page, () => window.__blitz.lives())) === 4, 'vier Herzen');
  assert((await B(page, () => window.__blitz.player().lastDeath)) === 'hit', 'Ursache: Treffer');
  assert(await page.isVisible('#screen-math'), 'Mathefenster sichtbar');
  assert((await page.textContent('#math-count')) === 'Aufgabe 1 von 3', 'Aufgabe 1 von 3');
  assert((await page.locator('#math-dots span').count()) === 3, 'drei Fortschrittspunkte');
  assert(/^Wie viel ist \d+ [+−] \d+\?$/.test(await page.textContent('#math-task')), 'Aufgabentext');
  // Das Spiel steht still, solange das Fenster offen ist
  const t0 = await B(page, () => window.__blitz.player().t);
  await sleep(800);
  assert((await B(page, () => window.__blitz.player().t)) === t0, 'Game-Loop pausiert während Mathe');
  // Leertaste im Mathefenster springt nicht
  await page.keyboard.press('Space');
  assert((await state(page)) === 'MATH_CHALLENGE', 'bleibt im Mathefenster');
});

await test('Mathe: falsch bleibt stehen, richtig geht weiter, Doppel-Enter überspringt nichts', async (page) => {
  await startFirstLevel(page);
  await dieOnce(page);
  const m0 = await B(page, () => window.__blitz.math());
  const wrong = m0.answer === 0 ? 1 : m0.answer - 1;
  for (let i = 0; i < 3; i++) {
    await page.fill('#math-input', String(wrong));
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.querySelector('#math-feedback').textContent.includes('Noch nicht'));
    await sleep(500);
  }
  const m1 = await B(page, () => window.__blitz.math());
  assert(m1.solved === 0 && m1.index === 0 && m1.a === m0.a && m1.b === m0.b, 'gleiche Aufgabe nach falschen Antworten');
  assert((await B(page, () => window.__blitz.lives())) === 4, 'kein weiteres Herz verloren');
  // Ungültige Eingaben
  await page.fill('#math-input', '');
  assert(await page.isDisabled('#math-check'), 'Prüfen ohne Eingabe gesperrt');
  // richtig + Enter dreimal schnell hintereinander
  await page.fill('#math-input', String(m0.answer));
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.click('#math-check', { force: true }).catch(() => {});
  assert((await page.textContent('#math-feedback')).includes('Richtig'), '„Richtig! Super!“');
  await page.waitForFunction(() => window.__blitz.math()?.index === 1 && !window.__blitz.math().locked);
  const m2 = await B(page, () => window.__blitz.math());
  assert(m2.solved === 1, `nur eine Aufgabe gelöst (${m2.solved})`);
  assert((await page.textContent('#math-count')) === 'Aufgabe 2 von 3', 'Aufgabe 2 von 3');
  assert(`${m2.a}${m2.op}${m2.b}` !== `${m0.a}${m0.op}${m0.b}`, 'neue Aufgabe');
  // restliche zwei lösen
  for (let i = 1; i < 3; i++) {
    await page.waitForFunction((i) => window.__blitz.math()?.solved === i && !window.__blitz.math().locked, i);
    const m = await B(page, () => window.__blitz.math());
    await page.fill('#math-input', String(m.answer));
    await page.keyboard.press('Enter');
  }
  await waitState(page, 'RESPAWNING');
  assert(!(await page.isVisible('#screen-math')), 'Mathefenster geschlossen');
  assert((await B(page, () => window.__blitz.lives())) === 4, 'nach dem Fortsetzen weiterhin vier Herzen');
  await waitState(page, 'PLAYING');
});

await test('Wiederbelebung ist sicher: unverwundbar, kein sofortiger erneuter Tod', async (page) => {
  await startFirstLevel(page);
  await dieOnce(page);
  await solveMath(page);
  await waitState(page, 'RESPAWNING');
  const p = await B(page, () => window.__blitz.player());
  assert(p.invulnerable > 1.5, 'unverwundbar');
  assert(p.grounded, 'steht auf dem Boden');
  await waitState(page, 'PLAYING');
  await sleep(1500);
  assert((await state(page)) === 'PLAYING', 'lebt nach 1,5 s ohne Eingabe noch');
  assert((await B(page, () => window.__blitz.totalDeaths())) === 1, 'nur ein Tod');
});

await test('Sturz in einen Graben zählt als Tod', async (page) => {
  await startFirstLevel(page);
  const lv = await B(page, () => window.__blitz.level());
  const grounds = lv.solids.sort((a, b) => a.x - b.x);
  const gapStart = grounds.find((g, i) => grounds[i + 1] && grounds[i + 1].x > g.x + g.w + 10);
  const edge = gapStart.x + gapStart.w;
  await B(page, (x) => window.__blitz.teleport(x), edge - 60);
  await waitState(page, ['DYING', 'MATH_CHALLENGE'], 10000);
  assert((await B(page, () => window.__blitz.player().lastDeath)) === 'fall', 'Ursache: Sturz');
  assert((await B(page, () => window.__blitz.lives())) === 4, 'ein Herz weniger');
});

await test('Null Herzen: „Oh nein!“, Mathe, Wiederbelebung mit einem Herz', async (page) => {
  await startFirstLevel(page);
  for (let i = 0; i < 5; i++) {
    await dieOnce(page);
    assert((await B(page, () => window.__blitz.lives())) === 4 - i, `nach Tod ${i + 1}: ${4 - i} Herzen`);
    if (i < 4) await solveMath(page);
  }
  assert((await page.textContent('#math-title')) === 'Oh nein! Alle Herzen sind weg.', 'Überschrift bei 0 Herzen');
  await solveMath(page);
  await page.waitForSelector('#math-choice:not(.hidden)');
  assert(await page.isVisible('[data-action="math-restart"]'), 'Neustart angeboten');
  await page.click('[data-action="math-revive"]');
  await waitState(page, 'RESPAWNING');
  assert((await B(page, () => window.__blitz.lives())) === 1, 'ein Wiederbelebungsherz');
  await waitState(page, 'PLAYING');
  assert((await B(page, () => window.__blitz.totalDeaths())) === 5, 'genau fünf Tode');
});

await test('Checkpoint wird aktiviert, gespeichert und ist der Wiedereinstiegspunkt', async (page) => {
  await startFirstLevel(page);
  const lv = await B(page, () => window.__blitz.level());
  const cp = lv.checkpoints[0];
  await B(page, (x) => window.__blitz.teleport(x), cp.x - 40);
  await page.waitForFunction(() => window.__blitz.player().checkpoint === 0, null, { timeout: 5000 });
  assert((await B(page, () => window.__blitz.progress().checkpoint))?.index === 0, 'Checkpoint gespeichert');
  await waitState(page, ['DYING', 'MATH_CHALLENGE'], 30000);
  await solveMath(page);
  await waitState(page, 'RESPAWNING');
  const p = await B(page, () => window.__blitz.player());
  assert(Math.abs(p.x - (cp.x + 6)) < 2, `Wiedereinstieg am Checkpoint (${p.x} vs ${cp.x})`);
});

await test('Pause und Fortsetzen (Escape und Knopf)', async (page) => {
  await startFirstLevel(page);
  await page.keyboard.press('Escape');
  await waitState(page, 'PAUSED');
  assert(await page.isVisible('#screen-pause'), 'Pausenmenü sichtbar');
  const t0 = await B(page, () => window.__blitz.player().t);
  await sleep(700);
  assert((await B(page, () => window.__blitz.player().t)) === t0, 'Zeit steht in der Pause');
  await page.click('#screen-pause [data-action="resume"]');
  await waitState(page, 'PLAYING');
  await sleep(300);
  assert((await B(page, () => window.__blitz.player().t)) > t0, 'läuft weiter');
  await page.click('#btn-pause');
  await waitState(page, 'PAUSED');
  await page.click('#screen-pause [data-action="restart"]');
  await waitState(page, 'RESPAWNING');
  assert((await B(page, () => window.__blitz.player().t)) < 0.1, 'Neustart setzt das Level zurück');
  await waitState(page, 'PLAYING');
  await page.keyboard.press('Escape');
  await page.click('#screen-pause [data-action="menu"]');
  await waitState(page, 'MENU');
  assert(await page.isVisible('#screen-menu'), 'zurück im Menü');
});

await test('Level geschafft: Abschluss, Speichern, nächstes Level', async (page) => {
  await startFirstLevel(page);
  const lv = await B(page, () => window.__blitz.level());
  await B(page, (x) => window.__blitz.teleport(x), lv.goalX - 200);
  await waitState(page, 'LEVEL_COMPLETE', 10000);
  await page.waitForSelector('#screen-complete:not(.hidden)', { timeout: 5000 });
  assert((await B(page, () => window.__blitz.progress().levels['1-1']?.completed)) === true, 'Level gespeichert');
  await page.click('#screen-complete [data-action="next"]');
  await waitState(page, 'RESPAWNING');
  assert((await page.textContent('#hud-label')) === 'Welt 1 · Level 2', 'Level 2 startet');
  // Neu laden: Fortschritt bleibt
  await page.reload();
  await page.waitForFunction(() => window.__blitz && window.__blitz.state() === 'MENU');
  assert((await page.textContent('#screen-menu .btn-play span:last-child')) === 'Weiterspielen', '„Weiterspielen“');
  await page.click('[data-action="worlds"]');
  assert(await page.isEnabled('[data-world="0"][data-index="1"][data-kind="level"]'), 'Level 1-2 freigeschaltet');
  assert(await page.isDisabled('[data-world="0"][data-index="2"][data-kind="level"]'), 'Level 1-3 noch gesperrt');
});

const SEED_WORLD1_DONE = {
  version: 1,
  unlockedWorld: 0,
  levels: {
    '1-1': { completed: true, stars: [0], bestCoins: 10, bestTime: 40 },
    '1-2': { completed: true, stars: [], bestCoins: 10, bestTime: 40 },
    '1-3': { completed: true, stars: [], bestCoins: 10, bestTime: 40 },
  },
  bossesDefeated: [],
  totalCoins: 30,
  checkpoint: null,
  settings: { sound: false, music: false, helpMode: false },
  math: { offset: 0, recent: [], totalSolved: 0, totalFirstTry: 0 },
  gameCompleted: false,
};

/** Spielt den Bosskampf mit gutem Timing (drückt im grünen Fenster bzw. wenn der Boss benommen ist). */
async function playBoss(page, { until = 'defeated', missAll = false } = {}) {
  const deadline = Date.now() + 150000;
  while (Date.now() < deadline) {
    const b = await B(page, () => window.__blitz.boss());
    const st = await state(page);
    if (!b) break;
    if (until === 'defeated' && b.phase === 'defeated') return;
    if (until === 'heroDown' && (b.phase === 'heroDown' || st === 'DYING' || st === 'MATH_CHALLENGE')) return;
    if (st === 'BOSS_FIGHT' && !missAll) {
      if (b.phase === 'dizzy' || (b.signal === 'now' && !b.airborne)) await page.keyboard.press('Space');
    }
    await sleep(40);
  }
  throw new Error('Bosskampf hat zu lange gedauert');
}

await test('Bosskampf: abschließbar, Sieg schaltet die nächste Welt frei', async (page) => {
  await page.click('[data-action="worlds"]');
  await page.click('[data-world="0"][data-kind="boss"]');
  await waitState(page, 'RESPAWNING');
  assert((await page.textContent('#boss-name')) === 'Stumpi', 'Bossname');
  assert((await page.locator('#boss-hp span').count()) === 3, 'drei Lebenspunkte');
  await waitState(page, 'BOSS_FIGHT', 10000);
  await playBoss(page);
  await waitState(page, 'LEVEL_COMPLETE');
  const prog = await B(page, () => window.__blitz.progress());
  assert(prog.bossesDefeated.includes(0), 'Trophäe gespeichert');
  assert(prog.unlockedWorld === 1, 'Welt 2 freigeschaltet');
  await page.waitForSelector('#screen-complete:not(.hidden)', { timeout: 6000 });
  assert((await page.textContent('#complete-title')).includes('Stumpi'), 'Siegestext');
  await page.click('#screen-complete [data-action="next"]');
  await waitState(page, 'RESPAWNING');
  assert((await page.textContent('#hud-label')) === 'Welt 2 · Level 1', 'weiter in Welt 2');
}, { seed: SEED_WORLD1_DONE });

await test('Bosskampf: ohne Reaktion → Mathe → weiter mit voller Kraft', async (page) => {
  await B(page, () => window.__blitz.startStage(0, 'boss'));
  await waitState(page, 'BOSS_FIGHT', 10000);
  await playBoss(page, { until: 'heroDown', missAll: true });
  await waitState(page, 'MATH_CHALLENGE', 5000);
  assert((await B(page, () => window.__blitz.lives())) === 4, 'ein Herz weniger');
  await solveMath(page);
  await waitState(page, 'BOSS_FIGHT', 10000);
  const b = await B(page, () => window.__blitz.boss());
  assert(b.energy === 3 && b.hp === 3, 'volle Kraft, Boss unverändert');
}, { seed: SEED_WORLD1_DONE });

await test('Touch: Sprungknopf und Tippen aufs Spielfeld, Bildschirmtastatur im Mathefenster', async (page) => {
  assert((await page.textContent('#screen-menu .btn-play span:last-child')) === 'Spielen', 'Menü');
  await page.tap('[data-action="play"]');
  await waitState(page, 'PLAYING');
  assert(await page.isVisible('#btn-jump'), 'Sprungknopf sichtbar');
  assert((await page.textContent('#start-hint')) === 'Tippe zum Springen!', 'Touch-Hinweis');
  await page.tap('#btn-jump');
  await page.waitForFunction(() => !window.__blitz.player().grounded, null, { timeout: 3000 });
  await page.waitForFunction(() => window.__blitz.player().grounded, null, { timeout: 3000 });
  await page.tap('#game canvas', { position: { x: 300, y: 200 } });
  await page.waitForFunction(() => !window.__blitz.player().grounded, null, { timeout: 3000 });
  assert((await B(page, () => window.__blitz.pressCount())) === 2, 'zwei Sprünge');
  await waitState(page, 'MATH_CHALLENGE', 30000);
  assert(await page.isVisible('#math-pad'), 'Bildschirmtastatur');
  assert((await page.getAttribute('#math-input', 'readonly')) !== null, 'keine Gerätetastatur');
  await solveMath(page, { pad: true });
  await waitState(page, 'RESPAWNING');
}, { context: { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 } });

await test('Hochformat auf dem Handy: Hinweis zum Drehen', async (page) => {
  assert(await page.isVisible('#rotate-hint'), 'Drehhinweis');
  await page.tap('[data-action="rotate-ok"]');
  assert(!(await page.isVisible('#rotate-hint')), 'ausblendbar');
}, { context: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true } });

await test('Hilfsmodus: langsamer, längere Unverwundbarkeit, Sprungpfeile', async (page) => {
  await page.click('[data-action="help"]');
  await page.click('.switch-row');
  assert((await B(page, () => window.__blitz.progress().settings.helpMode)) === true, 'gespeichert');
  await page.click('#screen-help [data-action="back"]');
  await startFirstLevel(page);
  const a = await B(page, () => window.__blitz.assist());
  assert(a.timeScale < 1 && a.showHints && a.invulnerable > 3, 'Erleichterungen aktiv');
});

await test('Spielstand löschen nur nach Sicherheitsabfrage', async (page) => {
  await page.click('[data-action="help"]');
  await page.click('[data-action="reset"]');
  assert(await page.isVisible('#dialog-confirm'), 'Abfrage');
  await page.click('[data-action="confirm-no"]');
  assert((await B(page, () => window.__blitz.progress().levels['1-1']?.completed)) === true, 'Nein behält alles');
  await page.click('[data-action="reset"]');
  await page.click('[data-action="confirm-yes"]');
  const prog = await B(page, () => window.__blitz.progress());
  assert(Object.keys(prog.levels).length === 0 && prog.totalCoins === 0, 'gelöscht');
  await page.reload();
  await page.waitForFunction(() => window.__blitz && window.__blitz.state() === 'MENU');
  assert(Object.keys(await B(page, () => window.__blitz.progress().levels)).length === 0, 'bleibt gelöscht');
}, { seed: SEED_WORLD1_DONE });

await test('Alle Level und Bosse laden fehlerfrei', async (page) => {
  for (let w = 0; w < 4; w++) {
    for (const [kind, idx] of [['level', 0], ['level', 1], ['level', 2], ['boss', 0]]) {
      await B(page, ([w, k, i]) => window.__blitz.startStage(w, k, i), [w, kind, idx]);
      await waitState(page, kind === 'boss' ? 'BOSS_FIGHT' : 'PLAYING', 15000);
      await sleep(300);
      await page.keyboard.press('Escape');
      await waitState(page, 'PAUSED');
      await page.click('#screen-pause [data-action="menu"]');
      await waitState(page, 'MENU');
    }
  }
});

// ------------------------------------------------------------------ Zusammenfassung

await browser.close();
server.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length} von ${results.length} Browsertests bestanden.`);
process.exit(failed.length ? 1 : 0);
