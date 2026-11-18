// Übertragungswege zum Server. Alle Datenzugriffe laufen über RPC-Funktionen
// (POST /rest/v1/rpc/<name>). Parameter stehen im Request-Body, NIE in der URL –
// so landen Zugangscodes und Sitzungstoken nicht in Server-Zugriffsprotokollen.

export type TransportErrorKind = 'network' | 'http' | 'config' | 'auth';

export class TransportError extends Error {
  kind: TransportErrorKind;
  status: number;
  code?: string;
  constructor(kind: TransportErrorKind, message: string, status = 0, code?: string) {
    super(message);
    this.kind = kind;
    this.status = status;
    this.code = code;
  }
}

export interface Transport {
  /** eindeutige Kennung des Backends (für die Trennung lokaler Daten) */
  readonly endpoint: string;
  readonly mode: 'online' | 'demo';
  rpc<T = any>(fn: string, args: Record<string, unknown>, accessToken?: string): Promise<T>;
}

export class SupabaseTransport implements Transport {
  readonly mode = 'online' as const;
  readonly endpoint: string;
  private readonly url: string;
  private readonly key: string;
  private readonly timeoutMs: number;

  constructor(url: string, anonKey: string, timeoutMs = 15000) {
    if (!url || !anonKey) throw new TransportError('config', 'Server-Adresse oder öffentlicher Schlüssel fehlt.');
    if (!/^https:\/\//.test(url) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?/.test(url)) {
      throw new TransportError('config', 'Die Server-Adresse muss mit https:// beginnen.');
    }
    this.url = url.replace(/\/+$/, '');
    this.key = anonKey;
    this.endpoint = this.url;
    this.timeoutMs = timeoutMs;
  }

  async rpc<T = any>(fn: string, args: Record<string, unknown>, accessToken?: string): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      apikey: this.key,
    };
    const bearer = accessToken || (this.key.startsWith('eyJ') ? this.key : '');
    if (bearer) headers.Authorization = `Bearer ${bearer}`;

    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), this.timeoutMs) : null;
    let res: Response;
    try {
      res = await fetch(`${this.url}/rest/v1/rpc/${encodeURIComponent(fn)}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(args ?? {}),
        signal: ctrl?.signal,
        credentials: 'omit',
        cache: 'no-store',
        referrerPolicy: 'no-referrer',
      });
    } catch (e) {
      throw new TransportError('network', 'Keine Verbindung zum Server.');
    } finally {
      if (timer) clearTimeout(timer);
    }
    const text = await res.text();
    let body: any = null;
    try { body = text ? JSON.parse(text) : null; } catch { body = null; }
    if (!res.ok) {
      const msg = body?.message || body?.msg || `Serverfehler (${res.status})`;
      const kind: TransportErrorKind = res.status === 401 || res.status === 403 ? 'auth' : 'http';
      throw new TransportError(kind, msg, res.status, body?.code);
    }
    return body as T;
  }
}
