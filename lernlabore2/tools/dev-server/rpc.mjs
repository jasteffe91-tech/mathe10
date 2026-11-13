// Führt RPC-Aufrufe so aus, wie PostgREST (Supabase) es tut:
// eigene Transaktion, SET LOCAL ROLE, JWT-Claims und Request-Header als
// Einstellungen, benannte Argumente mit Typumwandlung.
// Wird vom lokalen Entwicklungsserver und von den Datenbanktests genutzt.

const ROLES = new Set(['anon', 'authenticated', 'service_role']);

function quoteIdent(name) {
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) throw new RpcError(400, 'PGRST100', `Ungültiger Parametername: ${name}`);
  return `"${name}"`;
}

export class RpcError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details ?? null;
  }
  toJSON() {
    return { code: this.code, message: this.message, details: this.details, hint: null };
  }
}

export async function loadSignatures(pool) {
  const { rows } = await pool.query(`
    select p.proname as name,
           coalesce(p.proargnames, '{}') as argnames,
           coalesce((select array_agg(format_type(t.oid, null) order by x.ord)
                     from unnest(p.proargtypes) with ordinality as x(typ, ord)
                     join pg_type t on t.oid = x.typ), '{}') as argtypes
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'`);
  const map = new Map();
  for (const r of rows) {
    const types = {};
    r.argnames.forEach((n, i) => { types[n] = r.argtypes[i]; });
    map.set(r.name, types);
  }
  return map;
}

function encode(value, type) {
  if (value === null || value === undefined) return null;
  if (type === 'jsonb' || type === 'json') return JSON.stringify(value);
  return value;
}

/**
 * @param {import('pg').Pool} pool
 * @param {Map<string, Record<string,string>>} signatures
 * @param {string} fn
 * @param {Record<string, unknown>} args
 * @param {{ role: string, claims?: object, headers?: object }} ctx
 */
export async function callRpc(pool, signatures, fn, args, ctx) {
  if (!ROLES.has(ctx.role)) throw new RpcError(401, 'PGRST301', 'Ungültige Rolle');
  const sig = signatures.get(fn);
  if (!sig) throw new RpcError(404, 'PGRST202', `Could not find the function public.${fn}`);
  const keys = Object.keys(args ?? {});
  for (const k of keys) {
    if (!(k in sig)) throw new RpcError(404, 'PGRST202', `Could not find the function public.${fn}(${keys.join(', ')})`);
  }
  const parts = keys.map((k, i) => `${quoteIdent(k)} => $${i + 1}::${sig[k]}`);
  const values = keys.map((k) => encode(args[k], sig[k]));

  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query(`set local role ${ctx.role}`);
    await client.query(
      `select set_config('request.jwt.claims', $1, true), set_config('request.headers', $2, true), set_config('statement_timeout', '8s', true)`,
      [JSON.stringify(ctx.claims ?? { role: ctx.role }), JSON.stringify(ctx.headers ?? {})]);
    const res = await client.query(`select public.${quoteIdent(fn)}(${parts.join(', ')}) as result`, values);
    await client.query('commit');
    return res.rows[0]?.result ?? null;
  } catch (e) {
    await client.query('rollback').catch(() => {});
    if (e instanceof RpcError) throw e;
    const code = e.code || 'XX000';
    const status = code === '42501' ? (ctx.role === 'anon' ? 401 : 403) : code.startsWith('22') || code.startsWith('23') || code === 'P0001' ? 400 : 500;
    throw new RpcError(status, code, e.message, e.detail);
  } finally {
    client.release();
  }
}
