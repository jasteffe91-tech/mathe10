#!/usr/bin/env node
// Erzeugt packages/lab-sdk/src/generated/demo-data.ts aus config/demo-datensatz.json
// und den Lab-Manifesten. Die (fiktiven) Namen werden dabei WEGGELASSEN – sie
// existieren nur im lokalen Lehrerprogramm.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const demo = JSON.parse(readFileSync(join(ROOT, 'config', 'demo-datensatz.json'), 'utf8'));
const labs = readdirSync(join(ROOT, 'labs'))
  .map((d) => join(ROOT, 'labs', d, 'lab.manifest.json'))
  .filter((f) => existsSync(f))
  .map((f) => JSON.parse(readFileSync(f, 'utf8')))
  // Labore mit Demo-Antworten (Physik-Entdecker) zuerst, Beispiel-Labor zuletzt
  .sort((a, b) => Number(!(a.id in demo.demo_answers)) - Number(!(b.id in demo.demo_answers)) || a.id.localeCompare(b.id));

const web = {
  group: demo.group,
  participants: demo.participants.map(({ id, pseudonym, code }) => ({ id, pseudonym, code })),
  answers: demo.demo_answers,
  labs: labs.map((m) => ({ id: m.id, version: m.version, title: m.title, subject: m.subject ?? '', audience: m.audience ?? '', tasks: m.tasks })),
};

const out = join(ROOT, 'packages', 'lab-sdk', 'src', 'generated', 'demo-data.ts');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `// AUTOMATISCH ERZEUGT von scripts/generate-demo-data.mjs – nicht von Hand ändern.
// Fiktive Demonstrationsdaten ohne Namen.
import type { LabManifest } from '../types';

export interface DemoDataset {
  group: { id: string; label: string; kind: 'demo' };
  participants: { id: string; pseudonym: string; code: string }[];
  answers: Record<string, Record<string, string | null>[]>;
  labs: LabManifest[];
}

export const DEMO_DATA: DemoDataset = ${JSON.stringify(web, null, 2)};
`);
console.log('✓', out.slice(ROOT.length + 1));
