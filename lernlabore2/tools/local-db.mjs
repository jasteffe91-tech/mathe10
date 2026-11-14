#!/usr/bin/env node
// Lokale PostgreSQL-Testdatenbank für Entwicklung und automatische Tests.
// NICHT für den Unterrichtsbetrieb – dort läuft Supabase.
//
//   node tools/local-db.mjs reset   # anlegen/zurücksetzen + Migrationen einspielen
//   node tools/local-db.mjs start | stop | status | url
//
// Umgebungsvariablen: LERNLABOR_PGPORT (Standard 54329), LERNLABOR_PGDATA

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, chownSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const PORT = Number(process.env.LERNLABOR_PGPORT || 54329);
const DATA = process.env.LERNLABOR_PGDATA || join(ROOT, '.lokal', 'pgdata');
const LOG = join(dirname(DATA), 'postgres.log');
export const DBNAME = 'lernlabore_test';
export const DB_URL = `postgres://postgres@127.0.0.1:${PORT}/${DBNAME}`;

function bindir() {
  const r = spawnSync('pg_config', ['--bindir'], { encoding: 'utf8' });
  if (r.status === 0) return r.stdout.trim();
  for (const v of ['17', '16', '15']) {
    const p = `/usr/lib/postgresql/${v}/bin`;
    if (existsSync(p)) return p;
  }
  throw new Error('PostgreSQL-Programme nicht gefunden (pg_config/initdb).');
}
const BIN = bindir();
const isRoot = typeof process.getuid === 'function' && process.getuid() === 0;

function run(cmd, args, opts = {}) {
  const full = join(BIN, cmd);
  const [c, a] = isRoot && ['initdb', 'pg_ctl'].includes(cmd) ? ['runuser', ['-u', 'postgres', '--', full, ...args]] : [full, args];
  const r = spawnSync(c, a, { encoding: 'utf8', ...opts });
  if (r.status !== 0 && !opts.allowFail) {
    throw new Error(`${cmd} ${args.join(' ')} fehlgeschlagen:\n${r.stdout}\n${r.stderr}`);
  }
  return r;
}

function psql(db, args, opts = {}) {
  return run('psql', ['-X', '-q', '-h', '127.0.0.1', '-p', String(PORT), '-U', 'postgres', '-d', db, '-v', 'ON_ERROR_STOP=1', ...args], opts);
}

function ensureInit() {
  if (existsSync(join(DATA, 'PG_VERSION'))) return;
  mkdirSync(DATA, { recursive: true });
  if (isRoot) {
    const pw = spawnSync('id', ['-u', 'postgres'], { encoding: 'utf8' });
    const gid = spawnSync('id', ['-g', 'postgres'], { encoding: 'utf8' });
    chownSync(DATA, Number(pw.stdout), Number(gid.stdout));
    chownSync(dirname(DATA), Number(pw.stdout), Number(gid.stdout));
  }
  run('initdb', ['-D', DATA, '-U', 'postgres', '--auth=trust', '-E', 'UTF8', '--locale=C.UTF-8']);
}

function running() {
  return run('pg_ctl', ['-D', DATA, 'status'], { allowFail: true }).status === 0;
}

export function start() {
  ensureInit();
  if (running()) return;
  run('pg_ctl', ['-D', DATA, '-l', LOG, '-w', '-o', `-p ${PORT} -k ${os.tmpdir()} -c listen_addresses=127.0.0.1 -c fsync=off`, 'start']);
}

export function stop() {
  if (existsSync(join(DATA, 'PG_VERSION')) && running()) run('pg_ctl', ['-D', DATA, '-w', '-m', 'fast', 'stop']);
}

export function migrationFiles() {
  const dir = join(ROOT, 'supabase', 'migrations');
  return readdirSync(dir).filter((f) => f.endsWith('.sql')).sort().map((f) => join(dir, f));
}

export function reset({ quiet = false } = {}) {
  start();
  psql('postgres', ['-c', `drop database if exists ${DBNAME} with (force)`]);
  psql('postgres', ['-c', `create database ${DBNAME}`]);
  const files = [join(ROOT, 'supabase', 'tests', 'local', '00_supabase_shim.sql'), ...migrationFiles()];
  for (const f of files) {
    psql(DBNAME, ['-1', '-f', f]);
    if (!quiet) console.log('  ✓', f.slice(ROOT.length + 1));
  }
}

const cmd = process.argv[2];
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('local-db.mjs')) {
  try {
    if (cmd === 'start') { start(); console.log('Läuft:', DB_URL); }
    else if (cmd === 'stop') { stop(); console.log('Gestoppt.'); }
    else if (cmd === 'status') { console.log(running() ? `Läuft: ${DB_URL}` : 'Gestoppt.'); }
    else if (cmd === 'url') { console.log(DB_URL); }
    else if (cmd === 'reset') { console.log('Setze lokale Testdatenbank zurück …'); reset(); console.log('Fertig:', DB_URL); }
    else { console.log('Aufruf: node tools/local-db.mjs reset|start|stop|status|url'); }
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
