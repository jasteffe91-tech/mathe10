// Anmeldung der Lehrkraft über Supabase Auth (E-Mail + Passwort).
// Tokens liegen nur im sessionStorage dieses Tabs (nicht dauerhaft) und
// werden automatisch erneuert. Kein Service-Role-Schlüssel im Browser!
import { TransportError } from '../../../packages/lab-sdk/src/transport';

const KEY = 'lernlabor.lehrkraft.v1';

export interface TeacherSession {
  access_token: string;
  refresh_token: string;
  expires_at: number; // Sekunden seit 1970
  email: string;
  endpoint: string;
}

export class TeacherAuth {
  private session: TeacherSession | null = null;
  private refreshing: Promise<void> | null = null;

  constructor(private readonly url: string, private readonly anonKey: string) {
    try {
      const raw = sessionStorage.getItem(KEY);
      const s = raw ? (JSON.parse(raw) as TeacherSession) : null;
      if (s && s.endpoint === url) this.session = s;
    } catch { /* ohne Sitzung starten */ }
  }

  get email() { return this.session?.email ?? ''; }
  get loggedIn() { return !!this.session; }

  private headers() {
    const h: Record<string, string> = { 'Content-Type': 'application/json', apikey: this.anonKey };
    if (this.anonKey.startsWith('eyJ')) h.Authorization = `Bearer ${this.anonKey}`;
    return h;
  }

  private store(body: any, email: string) {
    this.session = {
      access_token: body.access_token, refresh_token: body.refresh_token,
      expires_at: body.expires_at ?? Math.floor(Date.now() / 1000) + (body.expires_in ?? 3600),
      email: body.user?.email ?? email, endpoint: this.url,
    };
    sessionStorage.setItem(KEY, JSON.stringify(this.session));
  }

  async login(email: string, password: string): Promise<void> {
    let res: Response;
    try {
      res = await fetch(`${this.url}/auth/v1/token?grant_type=password`, {
        method: 'POST', headers: this.headers(), body: JSON.stringify({ email, password }), credentials: 'omit', cache: 'no-store',
      });
    } catch {
      throw new TransportError('network', 'Keine Verbindung zum Server.');
    }
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const code = body.error_code || body.error || '';
      const msg = /invalid/.test(code) || res.status === 400 ? 'E-Mail-Adresse oder Passwort ist falsch.'
        : res.status === 429 ? 'Zu viele Versuche. Bitte später erneut versuchen.'
        : body.msg || body.error_description || `Anmeldung fehlgeschlagen (${res.status}).`;
      throw new TransportError('auth', msg, res.status);
    }
    this.store(body, email);
  }

  private async refresh(): Promise<void> {
    if (!this.session) throw new TransportError('auth', 'Nicht angemeldet.', 401);
    const res = await fetch(`${this.url}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST', headers: this.headers(), body: JSON.stringify({ refresh_token: this.session.refresh_token }), credentials: 'omit', cache: 'no-store',
    }).catch(() => { throw new TransportError('network', 'Keine Verbindung zum Server.'); });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) { this.clear(); throw new TransportError('auth', 'Sitzung abgelaufen. Bitte neu anmelden.', 401); }
    this.store(body, this.session.email);
  }

  /** Gültiges Zugriffstoken (erneuert es bei Bedarf). */
  async token(): Promise<string> {
    if (!this.session) throw new TransportError('auth', 'Nicht angemeldet.', 401);
    if (this.session.expires_at - 60 < Date.now() / 1000) {
      this.refreshing ??= this.refresh().finally(() => { this.refreshing = null; });
      await this.refreshing;
    }
    return this.session!.access_token;
  }

  async logout() {
    const s = this.session;
    this.clear();
    if (s) {
      await fetch(`${this.url}/auth/v1/logout`, { method: 'POST', headers: { ...this.headers(), Authorization: `Bearer ${s.access_token}` }, credentials: 'omit' }).catch(() => null);
    }
  }

  clear() {
    this.session = null;
    try { sessionStorage.removeItem(KEY); } catch { /* egal */ }
  }
}
