#!/usr/bin/env node
// Baut alle Webseiten nach site/ (wird von GitHub Pages bzw. Cloudflare Pages ausgeliefert).
//   npm run build
// site/config.js wird NIE überschrieben (enthält die Verbindungsdaten der Schule).
import { build } from 'esbuild';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = join(ROOT, 'site');
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));

execSync(`node ${JSON.stringify(join(ROOT, 'scripts', 'generate-demo-data.mjs'))}`, { stdio: 'inherit' });

const banner = `/* Online-Lernlabore 2.0 · v${pkg.version} · MIT-Lizenz · enthält qrcode-generator (MIT, Kazuhiko Arase) */`;
const common = { bundle: true, minify: true, target: ['es2020', 'safari14'], legalComments: 'none', banner: { js: banner }, logLevel: 'warning' };

const copy = (from, to) => { mkdirSync(dirname(join(SITE, to)), { recursive: true }); copyFileSync(join(ROOT, from), join(SITE, to)); };

for (const d of ['sdk', 'labore/physik-entdecker', 'lehrkraft']) rmSync(join(SITE, d), { recursive: true, force: true });

await Promise.all([
  // SDK für bestehende Labore (klassisches <script>, globales Objekt „Lernlabor“)
  build({ ...common, entryPoints: [join(ROOT, 'packages/lab-sdk/src/index.ts')], outfile: join(SITE, 'sdk/lernlabor-sdk.js'), format: 'iife', globalName: 'Lernlabor' }),
  // SDK als ES-Modul für neue Labore
  build({ ...common, entryPoints: [join(ROOT, 'packages/lab-sdk/src/index.ts')], outfile: join(SITE, 'sdk/lernlabor-sdk.mjs'), format: 'esm' }),
  build({ ...common, entryPoints: [join(ROOT, 'labs/physik-entdecker/src/main.ts')], outfile: join(SITE, 'labore/physik-entdecker/app.js'), format: 'esm' }),
  build({ ...common, entryPoints: [join(ROOT, 'apps/teacher-dashboard/src/main.ts')], outfile: join(SITE, 'lehrkraft/app.js'), format: 'esm' }),
  build({ ...common, entryPoints: [join(ROOT, 'apps/student-portal/src/main.ts')], outfile: join(SITE, 'start.js'), format: 'esm' }),
]);

copy('labs/physik-entdecker/index.html', 'labore/physik-entdecker/index.html');
copy('labs/physik-entdecker/styles.css', 'labore/physik-entdecker/styles.css');
copy('labs/physik-entdecker/lab.manifest.json', 'labore/physik-entdecker/lab.manifest.json');
copy('apps/teacher-dashboard/index.html', 'lehrkraft/index.html');
copy('apps/teacher-dashboard/styles.css', 'lehrkraft/styles.css');
copy('apps/student-portal/index.html', 'index.html');
copy('apps/student-portal/start.css', 'start.css');
copy('packages/lab-sdk/adapter/stationen-labor-adapter.js', 'sdk/stationen-labor-adapter.js');
copy('labs/beispiel-labor/index.html', 'labore/beispiel-labor/index.html');
copy('labs/beispiel-labor/lab.manifest.json', 'labore/beispiel-labor/lab.manifest.json');
if (!existsSync(join(SITE, 'config.js'))) copy('config/config.example.js', 'config.js');
writeFileSync(join(SITE, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
writeFileSync(join(SITE, 'build-info.json'), JSON.stringify({ version: pkg.version, built_at: new Date().toISOString() }, null, 2) + '\n');
console.log('✓ site/ gebaut');
