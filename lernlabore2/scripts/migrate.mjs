#!/usr/bin/env node
// Spielt noch nicht angewendete Migrationen in eine Datenbank ein (wiederholbar, jede Datei in einer Transaktion).
//   SUPABASE_DB_URL="postgresql://postgres:<passwort>@db.<ref>.supabase.co:5432/postgres" node scripts/migrate.mjs
//   node scripts/migrate.mjs --status     # nur anzeigen
// Die Verbindungszeichenkette ist GEHEIM: nur als Umgebungsvariable bzw. GitHub-Secret verwenden, nie einchecken.
import pg from 'pg';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const url = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
if (!url) {
  console.error('Bitte SUPABASE_DB_URL setzen (Supabase → Project Settings → Database → Connection string).');
  process.exit(1);
}
const statusOnly = process.argv.includes('--status');
const dir = join(ROOT, 'supabase', 'migrations');
const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();

const client = new pg.Client({ connectionString: url, ssl: /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: true } });
await client.connect();
try {
  await client.query(`create schema if not exists lernlabor_private;
    create table if not exists lernlabor_private.angewendete_migrationen (version text primary key, applied_at timestamptz not null default now());
    revoke all on lernlabor_private.angewendete_migrationen from public;`);
  const done = new Set((await client.query('select version from lernlabor_private.angewendete_migrationen')).rows.map((r) => r.version));
  for (const f of files) {
    const version = basename(f, '.sql');
    if (done.has(version)) { console.log(`  = ${f} (bereits angewendet)`); continue; }
    if (statusOnly) { console.log(`  ! ${f} (AUSSTEHEND)`); continue; }
    await client.query('begin');
    try {
      await client.query(readFileSync(join(dir, f), 'utf8'));
      await client.query('insert into lernlabor_private.angewendete_migrationen (version) values ($1)', [version]);
      await client.query('commit');
      console.log(`  ✓ ${f}`);
    } catch (e) {
      await client.query('rollback');
      console.error(`  ✗ ${f}: ${e.message}`);
      process.exitCode = 1;
      break;
    }
  }
} finally {
  await client.end();
}
