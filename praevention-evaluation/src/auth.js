'use strict';
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };
const SESSION_HOURS = 8;
const COOKIE = 'eval_admin';
const MIN_PASSWORD_LENGTH = 10;

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  // Trennzeichen „:“ statt „$“, damit der Hash ohne Escaping in .env-/Compose-Dateien stehen kann.
  return `scrypt:${SCRYPT.N}:${SCRYPT.r}:${SCRYPT.p}:${salt.toString('base64')}:${hash.toString('base64')}`;
}

function verifyPassword(password, stored) {
  try {
    const [scheme, N, r, p, saltB64, hashB64] = String(stored).trim().split(/[:$]/);
    if (scheme !== 'scrypt') return false;
    const expected = Buffer.from(hashB64, 'base64');
    const actual = crypto.scryptSync(String(password), Buffer.from(saltB64, 'base64'), expected.length, {
      N: Number(N), r: Number(r), p: Number(p), maxmem: 64 * 1024 * 1024,
    });
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

/**
 * Ermittelt den Passwort-Hash. Reihenfolge:
 * 1. ADMIN_PASSWORD_HASH (Umgebungsvariable, empfohlen)
 * 2. Datei <DATA_DIR>/admin-password.hash (angelegt mit `npm run set-password`)
 * 3. ADMIN_PASSWORD (Klartext in Umgebungsvariable; wird beim Start nur im Speicher gehasht)
 */
function resolvePasswordHash(dataDir, env = process.env) {
  if (env.ADMIN_PASSWORD_HASH) return { hash: env.ADMIN_PASSWORD_HASH.trim(), source: 'ADMIN_PASSWORD_HASH' };
  const file = path.join(dataDir, 'admin-password.hash');
  if (fs.existsSync(file)) return { hash: fs.readFileSync(file, 'utf8').trim(), source: file };
  if (env.ADMIN_PASSWORD) {
    if (env.ADMIN_PASSWORD.length < MIN_PASSWORD_LENGTH) {
      throw new Error(`ADMIN_PASSWORD muss mindestens ${MIN_PASSWORD_LENGTH} Zeichen lang sein.`);
    }
    return { hash: hashPassword(env.ADMIN_PASSWORD), source: 'ADMIN_PASSWORD' };
  }
  return { hash: null, source: null };
}

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

/** Einfache Begrenzung fehlgeschlagener Anmeldeversuche (im Arbeitsspeicher, ohne Speicherung von IPs auf Datenträger). */
class LoginLimiter {
  constructor({ maxFailures = 5, windowMs = 15 * 60 * 1000 } = {}) {
    this.maxFailures = maxFailures;
    this.windowMs = windowMs;
    this.map = new Map();
  }
  key(ip) { return sha256(String(ip || 'unknown')); }
  isBlocked(ip) {
    const e = this.map.get(this.key(ip));
    if (!e) return false;
    if (Date.now() - e.first > this.windowMs) { this.map.delete(this.key(ip)); return false; }
    return e.count >= this.maxFailures;
  }
  fail(ip) {
    const k = this.key(ip);
    const e = this.map.get(k);
    if (!e || Date.now() - e.first > this.windowMs) this.map.set(k, { first: Date.now(), count: 1 });
    else e.count++;
  }
  reset(ip) { this.map.delete(this.key(ip)); }
}

function createAuth({ db, dataDir, env = process.env }) {
  let { hash, source } = resolvePasswordHash(dataDir, env);
  const limiter = new LoginLimiter();
  const forceSecure = env.COOKIE_SECURE === 'true';

  function cookieOptions(req) {
    const secure = forceSecure || req.secure;
    return `Path=/; HttpOnly; SameSite=Strict${secure ? '; Secure' : ''}`;
  }

  function getToken(req) {
    return parseCookies(req.headers.cookie)[COOKIE] || null;
  }

  function isAuthenticated(req) {
    const token = getToken(req);
    if (!token || !/^[A-Za-z0-9_-]{40,}$/.test(token)) return false;
    return !!db.getSession(sha256(token));
  }

  return {
    get configured() { return !!hash; },
    get source() { return source; },
    limiter,
    async login(req, res, password) {
      const ip = req.ip;
      if (!hash) return { ok: false, status: 503, error: 'Es ist noch kein Administrationspasswort eingerichtet. Siehe Anleitung (npm run set-password).' };
      if (limiter.isBlocked(ip)) return { ok: false, status: 429, error: 'Zu viele Fehlversuche. Bitte in 15 Minuten erneut versuchen.' };
      const ok = typeof password === 'string' && password.length <= 500 && verifyPassword(password, hash);
      if (!ok) {
        limiter.fail(ip);
        await new Promise((r) => setTimeout(r, 400));
        return { ok: false, status: 401, error: 'Das Passwort ist nicht korrekt.' };
      }
      limiter.reset(ip);
      const token = crypto.randomBytes(32).toString('base64url');
      const expires = Date.now() + SESSION_HOURS * 3600 * 1000;
      db.addSession(sha256(token), expires);
      res.setHeader('Set-Cookie', `${COOKIE}=${token}; ${cookieOptions(req)}; Max-Age=${SESSION_HOURS * 3600}`);
      return { ok: true };
    },
    logout(req, res) {
      const token = getToken(req);
      if (token) db.deleteSession(sha256(token));
      res.setHeader('Set-Cookie', `${COOKIE}=; ${cookieOptions(req)}; Max-Age=0`);
    },
    isAuthenticated,
    /** Middleware: Anmeldung erforderlich; bei verändernden Anfragen zusätzlich Schutz gegen Cross-Site-Anfragen. */
    requireAdmin(req, res, next) {
      if (!isAuthenticated(req)) {
        return res.status(401).json({ error: 'Nicht angemeldet.' });
      }
      if (!['GET', 'HEAD'].includes(req.method)) {
        if (req.get('X-Requested-With') !== 'evaluation-admin') {
          return res.status(403).json({ error: 'Anfrage abgelehnt.' });
        }
        const origin = req.get('Origin');
        if (origin) {
          let host;
          try { host = new URL(origin).host; } catch { host = null; }
          if (host !== req.get('Host')) return res.status(403).json({ error: 'Anfrage abgelehnt (Herkunft).' });
        }
      }
      res.setHeader('Cache-Control', 'no-store');
      next();
    },
  };
}

module.exports = { hashPassword, verifyPassword, resolvePasswordHash, createAuth, MIN_PASSWORD_LENGTH, LoginLimiter };
