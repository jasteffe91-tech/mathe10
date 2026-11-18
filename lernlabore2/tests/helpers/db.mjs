// Hilfsfunktionen für Datenbanktests gegen die lokale PostgreSQL-Testdatenbank.
import pg from 'pg';
import { randomUUID, randomBytes } from 'node:crypto';
import { reset, DB_URL } from '../../tools/local-db.mjs';
import { loadSignatures, callRpc } from '../../tools/dev-server/rpc.mjs';

export const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // ohne I, L, O, 0, 1

/** Kryptografisch zufällige Zeichen ohne Modulo-Verzerrung (Ablehnungsverfahren). */
export function randomChars(n) {
  let out = '';
  while (out.length < n) {
    for (const b of randomBytes(n * 2)) {
      if (b < 248) out += ALPHABET[b % 31];
      if (out.length === n) break;
    }
  }
  return out;
}

export function makeCode(len = 12) {
  return randomChars(len).match(/.{1,4}/g).join('-');
}

export function makePseudonym(prefix = 'P') {
  return `${prefix}-${randomChars(4)}`;
}

export async function freshDb() {
  reset({ quiet: true });
  const pool = new pg.Pool({ connectionString: DB_URL, max: 8 });
  const sigs = await loadSignatures(pool);
  return { pool, sigs, close: () => pool.end() };
}

export async function createUser(pool, email, { teacher = true, admin = false } = {}) {
  const id = randomUUID();
  await pool.query('insert into auth.users (id, email) values ($1, $2)', [id, email]);
  if (teacher) await pool.query('select lernlabor_private.bootstrap_teacher($1, $2, $3)', [email, 'Testlehrkraft', admin]);
  return id;
}

export function api(db) {
  return {
    anon: (fn, args, ip = '203.0.113.10') =>
      callRpc(db.pool, db.sigs, fn, args, { role: 'anon', claims: { role: 'anon' }, headers: { 'x-forwarded-for': ip } }),
    as: (uid) => (fn, args) =>
      callRpc(db.pool, db.sigs, fn, args, { role: 'authenticated', claims: { sub: uid, role: 'authenticated' }, headers: {} }),
  };
}

/** Legt n pseudonyme Teilnehmende an und gibt [{id, pseudonym, code}] zurück. */
export function makeParticipants(n, prefix = 'P', codeLen = 12) {
  const seen = new Set();
  const list = [];
  while (list.length < n) {
    const pseudonym = makePseudonym(prefix);
    if (seen.has(pseudonym)) continue;
    seen.add(pseudonym);
    list.push({ id: randomUUID(), pseudonym, code: makeCode(codeLen) });
  }
  return list;
}
