#!/usr/bin/env node
// Fasst alle Migrationen zu EINER Datei für den Supabase-SQL-Editor zusammen (Erstinstallation per Copy & Paste).
//   node scripts/bundle-sql.mjs   → supabase/einspielen/ERSTINSTALLATION.sql
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(ROOT, 'supabase', 'migrations');
const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
let out = `-- =====================================================================
-- Online-Lernlabore 2.0 – ERSTINSTALLATION (alle Migrationen in einer Datei)
-- Automatisch erzeugt mit: node scripts/bundle-sql.mjs – nicht von Hand ändern.
--
-- Verwendung: Supabase → SQL Editor → New query → gesamten Inhalt einfügen → Run.
-- Nur EINMAL auf einer leeren Datenbank ausführen. Spätere Aktualisierungen
-- über scripts/migrate.mjs bzw. den GitHub-Workflow einspielen.
-- =====================================================================

create schema if not exists lernlabor_private;
create table if not exists lernlabor_private.angewendete_migrationen (version text primary key, applied_at timestamptz not null default now());
revoke all on lernlabor_private.angewendete_migrationen from public;
`;
for (const f of files) {
  out += `\n\n-- >>>>>>>>>>>>>>>>>>>> ${f} >>>>>>>>>>>>>>>>>>>>\n`;
  out += readFileSync(join(dir, f), 'utf8');
  out += `\ninsert into lernlabor_private.angewendete_migrationen (version) values ('${basename(f, '.sql')}') on conflict do nothing;\n`;
}
out += `\n-- Fertig. Weiter mit INSTALLATION.md, Schritt 3 (erste Lehrkraft freischalten).\n`;
mkdirSync(join(ROOT, 'supabase', 'einspielen'), { recursive: true });
writeFileSync(join(ROOT, 'supabase', 'einspielen', 'ERSTINSTALLATION.sql'), out);
console.log('✓ supabase/einspielen/ERSTINSTALLATION.sql');
