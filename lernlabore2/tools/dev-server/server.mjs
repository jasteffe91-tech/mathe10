#!/usr/bin/env node
// =====================================================================
// Lokaler Entwicklungs- und Testserver – NUR für Entwicklung/Tests!
//  * liefert site/ aus (wie GitHub Pages)
//  * bildet die Supabase-Endpunkte nach, die das System nutzt:
//      POST /rest/v1/rpc/<funktion>   (PostgREST-Verhalten, echte SQL-Funktionen)
//      POST /auth/v1/token            (Passwort- und Refresh-Anmeldung, wie GoTrue)
//      POST /auth/v1/logout
//  * nutzt die lokale PostgreSQL-Testdatenbank (tools/local-db.mjs)
//
//   node tools/dev-server/server.mjs [--port 8787] [--seed]
// =====================================================================
import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { join, resolve, dirname, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import pg from 'pg';
import { loadSignatures, callRpc, RpcError } from './rpc.mjs';
import { DB_URL as LOCAL_DB_URL, start as startDb } from '../local-db.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SITE = join(ROOT, 'site');
export const DEV_ANON_KEY = 'sb_publishable_lokaler_testschluessel';
export const DEV_TEACHER = { email: 'lehrkraft@test.local', password: 'test-passwort-123' };

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.txt': 'text/plain; charset=utf-8', '.ico': 'image/x-icon' };

function b64url(buf) { return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }

export async function createServer({ port = 8787, dbUrl = process.env.DATABASE_URL || LOCAL_DB_URL, quiet = false, offline = () => false } = {}) {
  const pool = new pg.Pool({ connectionString: dbUrl, max: 10 });
  let signatures = await loadSignatures(pool);
  const secret = crypto.randomBytes(32);
  const refreshTokens = new Map();

  const signJwt = (claims) => {
    const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const body = b64url(JSON.stringify(claims));
    const sig = b64url(crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest());
    return `${header}.${body}.${sig}`;
  };
  const verifyJwt = (token) => {
    const [h, b, s] = String(token).split('.');
    if (!h || !b || !s) return null;
    const expected = b64url(crypto.createHmac('sha256', secret).update(`${h}.${b}`).digest());
    if (expected.length !== s.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(s))) return null;
    const claims = JSON.parse(Buffer.from(b, 'base64url').toString());
    if (claims.exp && claims.exp < Date.now() / 1000) return null;
    return claims;
  };
  const issue = (user) => {
    const now = Math.floor(Date.now() / 1000);
    const access = signJwt({ sub: user.id, email: user.email, role: 'authenticated', aud: 'authenticated', iat: now, exp: now + 3600 });
    const refresh = b64url(crypto.randomBytes(24));
    refreshTokens.set(refresh, user);
    return { access_token: access, token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, refresh_token: refresh, user: { id: user.id, email: user.email } };
  };

  const send = (res, status, body, headers = {}) => {
    const data = typeof body === 'string' ? body : JSON.stringify(body);
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...cors, ...headers });
    res.end(data);
  };
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'apikey, authorization, content-type, x-client-info, prefer', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };
  const readBody = (req) => new Promise((ok, fail) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > 1e6) { fail(new Error('zu groß')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { ok(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); } catch (e) { fail(e); } });
  });

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    try {
      if (req.method === 'OPTIONS') { res.writeHead(204, cors); res.end(); return; }

      if (url.pathname.startsWith('/rest/v1/') || url.pathname.startsWith('/auth/v1/')) {
        if (offline()) { req.socket.destroy(); return; }
        if (req.headers.apikey !== DEV_ANON_KEY) return send(res, 401, { message: 'Invalid API key' });
      }

      if (req.method === 'POST' && url.pathname.startsWith('/rest/v1/rpc/')) {
        const fn = decodeURIComponent(url.pathname.slice('/rest/v1/rpc/'.length));
        const body = await readBody(req);
        const auth = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
        const claims = auth ? verifyJwt(auth) : null;
        if (auth && auth !== DEV_ANON_KEY && !claims) return send(res, 401, { code: 'PGRST301', message: 'JWT expired or invalid' });
        const ctx = claims
          ? { role: 'authenticated', claims, headers: { 'x-forwarded-for': req.socket.remoteAddress } }
          : { role: 'anon', claims: { role: 'anon' }, headers: { 'x-forwarded-for': req.headers['x-test-ip'] || req.socket.remoteAddress } };
        try {
          const result = await callRpc(pool, signatures, fn, body, ctx);
          return send(res, 200, result);
        } catch (e) {
          if (e instanceof RpcError) return send(res, e.status, e.toJSON());
          throw e;
        }
      }

      if (req.method === 'POST' && url.pathname === '/auth/v1/token') {
        const body = await readBody(req);
        const grant = url.searchParams.get('grant_type');
        if (grant === 'password') {
          const { rows } = await pool.query(
            `select id, email from auth.users where lower(email) = lower($1) and encrypted_password is not null
               and encrypted_password = extensions.crypt($2, encrypted_password)`, [body.email ?? '', body.password ?? '']);
          if (!rows[0]) return send(res, 400, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' });
          return send(res, 200, issue(rows[0]));
        }
        if (grant === 'refresh_token') {
          const user = refreshTokens.get(body.refresh_token);
          if (!user) return send(res, 400, { code: 400, error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token' });
          refreshTokens.delete(body.refresh_token);
          return send(res, 200, issue(user));
        }
        return send(res, 400, { msg: 'unsupported grant_type' });
      }

      if (req.method === 'POST' && url.pathname === '/auth/v1/logout') {
        const claims = verifyJwt(String(req.headers.authorization || '').replace(/^Bearer\s+/i, ''));
        if (claims) for (const [k, u] of refreshTokens) if (u.id === claims.sub) refreshTokens.delete(k);
        res.writeHead(204, cors); res.end(); return;
      }

      if (req.method === 'GET' || req.method === 'HEAD') {
        if (url.pathname === '/config.js') {
          const cfg = { supabaseUrl: `http://${req.headers.host}`, supabaseAnonKey: DEV_ANON_KEY, mode: 'auto', sessionPersistence: 'tab', environmentLabel: 'LOKALER TESTSERVER – keine echten Schülerdaten' };
          res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store' });
          res.end(`window.LERNLABOR_CONFIG = ${JSON.stringify(cfg)};\n`);
          return;
        }
        let p = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
        let file = join(SITE, p);
        if (!file.startsWith(SITE)) return send(res, 403, { message: 'verboten' });
        if (existsSync(file) && statSync(file).isDirectory()) {
          if (!url.pathname.endsWith('/')) { res.writeHead(301, { Location: url.pathname + '/' + url.search }); res.end(); return; }
          file = join(file, 'index.html');
        }
        if (!existsSync(file)) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Nicht gefunden'); return; }
        res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
        if (req.method === 'HEAD') { res.end(); return; }
        createReadStream(file).pipe(res);
        return;
      }
      send(res, 404, { message: 'Nicht gefunden' });
    } catch (e) {
      if (!quiet) console.error(e);
      send(res, 500, { message: 'Interner Fehler' });
    }
  });

  await new Promise((ok) => server.listen(port, '127.0.0.1', ok));
  const actualPort = server.address().port;
  if (!quiet) console.log(`Lokaler Testserver: http://localhost:${actualPort}/   (Datenbank: ${dbUrl})`);
  return {
    port: actualPort, url: `http://localhost:${actualPort}`, pool,
    reloadSignatures: async () => { signatures = await loadSignatures(pool); },
    close: async () => { await new Promise((ok) => server.close(ok)); await pool.end(); },
  };
}

/** Testlehrkraft mit Passwort anlegen (nur lokal). */
export async function seedTeacher(pool, { email = DEV_TEACHER.email, password = DEV_TEACHER.password, admin = true } = {}) {
  const { rows } = await pool.query(
    `insert into auth.users (email, encrypted_password) values ($1, extensions.crypt($2, extensions.gen_salt('bf')))
     on conflict (email) do update set encrypted_password = excluded.encrypted_password returning id`, [email, password]);
  await pool.query('select lernlabor_private.bootstrap_teacher($1, $2, $3)', [email, 'Testlehrkraft', admin]);
  return rows[0].id;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const args = process.argv.slice(2);
  const port = Number(args[args.indexOf('--port') + 1]) || Number(process.env.PORT) || 8787;
  if (!process.env.DATABASE_URL) startDb();
  const srv = await createServer({ port });
  if (args.includes('--seed')) {
    await seedTeacher(srv.pool);
    console.log(`Testlehrkraft: ${DEV_TEACHER.email} / ${DEV_TEACHER.password}`);
  }
}
