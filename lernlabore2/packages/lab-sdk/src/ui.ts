// Wiederverwendbare Bedienelemente: Anmeldefenster, Speicheranzeige, Sitzungsleiste, Demo-Hinweis.
// Bewusst ohne Bibliotheken; alle Texte werden als Text (nicht als HTML) eingefügt (XSS-Schutz).
import { containsForbiddenChars, formatCode, isPlausibleCode } from './codes';
import type { LabClient } from './client';
import type { StatusInfo } from './types';

const CSS = `
.ll-root{--ll-bg:#f4f7fb;--ll-card:#fff;--ll-ink:#14213d;--ll-muted:#4a5568;--ll-accent:#2f6fde;--ll-accent-ink:#fff;--ll-ok:#1f7a4d;--ll-warn:#9a5b00;--ll-err:#b42318;--ll-line:#d6deea;font-family:system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;color:var(--ll-ink)}
@media (prefers-color-scheme:dark){.ll-root{--ll-bg:#0f1726;--ll-card:#18233a;--ll-ink:#eef2f8;--ll-muted:#b8c2d4;--ll-accent:#7aa7ff;--ll-accent-ink:#0b1220;--ll-ok:#5fd39a;--ll-warn:#ffc266;--ll-err:#ff8a80;--ll-line:#2c3a55}}
.ll-overlay{position:fixed;inset:0;z-index:2147483000;background:var(--ll-bg);display:flex;align-items:center;justify-content:center;padding:16px;overflow:auto}
.ll-card{background:var(--ll-card);border:1px solid var(--ll-line);border-radius:24px;box-shadow:0 18px 50px rgba(20,33,61,.12);padding:28px 24px;width:100%;max-width:460px;text-align:center}
.ll-card h1{font-size:clamp(26px,6vw,34px);margin:8px 0 4px;line-height:1.15}
.ll-lab{color:var(--ll-muted);margin:0 0 20px;font-size:17px}
.ll-card label{display:block;font-size:20px;font-weight:650;margin:0 0 10px}
.ll-input{font:700 clamp(22px,6vw,30px)/1.2 ui-monospace,"Cascadia Mono","Consolas",monospace;letter-spacing:.08em;text-align:center;width:100%;box-sizing:border-box;padding:14px 10px;border:3px solid var(--ll-line);border-radius:16px;background:var(--ll-card);color:var(--ll-ink);text-transform:uppercase}
.ll-input:focus{outline:none;border-color:var(--ll-accent);box-shadow:0 0 0 4px color-mix(in srgb,var(--ll-accent) 25%,transparent)}
.ll-btn{appearance:none;border:0;border-radius:16px;background:var(--ll-accent);color:var(--ll-accent-ink);font-family: inherit; font-weight: 700; font-size: 22px; line-height: 1;padding:18px 24px;width:100%;margin-top:16px;cursor:pointer;min-height:60px}
.ll-btn:focus-visible{outline:4px solid var(--ll-ink);outline-offset:3px}
.ll-btn[disabled]{opacity:.6;cursor:progress}
.ll-btn.ll-secondary{background:transparent;color:var(--ll-accent);border:2px solid var(--ll-accent);font-size:18px;min-height:52px;padding:12px}
.ll-msg{min-height:1.4em;margin:14px 0 0;font-size:18px;font-weight:600}
.ll-msg.ll-err{color:var(--ll-err)}
.ll-hint{color:var(--ll-muted);font-size:15px;margin:16px 0 0}
.ll-logo{width:72px;height:72px;margin:0 auto}
.ll-demo{margin-top:18px;padding:12px;border:2px dashed var(--ll-warn);border-radius:14px;color:var(--ll-warn);font-size:15px;text-align:left}
.ll-demo button{margin-top:8px}
.ll-status{display:inline-flex;align-items:center;gap:8px;font-size:15px;font-weight:600;padding:6px 12px;border-radius:999px;background:var(--ll-card);border:1px solid var(--ll-line);color:var(--ll-muted)}
.ll-status[data-state=saved]{color:var(--ll-ok)}
.ll-status[data-state=offline],.ll-status[data-state=retrying],.ll-status[data-state=session]{color:var(--ll-warn);border-color:currentColor}
.ll-status[data-state=error]{color:var(--ll-err);border-color:currentColor}
.ll-dot{width:10px;height:10px;border-radius:50%;background:currentColor;flex:none}
.ll-status[data-state=saving] .ll-dot{animation:ll-pulse 1s infinite}
@keyframes ll-pulse{50%{opacity:.25}}
@media (prefers-reduced-motion:reduce){.ll-status[data-state=saving] .ll-dot{animation:none}}
.ll-floating{position:fixed;left:12px;bottom:12px;z-index:2147482000;box-shadow:0 4px 16px rgba(0,0,0,.12)}
.ll-session{display:inline-flex;align-items:center;gap:8px;font-size:15px;color:var(--ll-muted)}
.ll-session strong{font-family:ui-monospace,Consolas,monospace;color:var(--ll-ink)}
.ll-session button{appearance:none;border:1px solid var(--ll-line);background:var(--ll-card);color:var(--ll-ink);border-radius:10px;padding:6px 10px;font:inherit;cursor:pointer;min-height:36px}
.ll-session-floating{position:fixed;right:12px;top:12px;z-index:2147482000;background:var(--ll-card);padding:6px 10px;border-radius:14px;border:1px solid var(--ll-line)}
.ll-banner{position:relative;z-index:10;background:#ffe9b3;color:#3d2a00;font:600 14px/1.3 system-ui,sans-serif;padding:6px 12px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;justify-content:center;width:100%;box-sizing:border-box}
.ll-banner button{font:inherit;border:1px solid #3d2a00;background:#fff6dd;border-radius:8px;padding:2px 8px;cursor:pointer}
.ll-dialog-row{display:flex;gap:10px;flex-wrap:wrap}.ll-dialog-row .ll-btn{flex:1 1 160px}
`;

let cssInjected = false;
export function injectCss(doc: Document = document) {
  if (cssInjected) return;
  const st = doc.createElement('style');
  st.id = 'lernlabor-sdk-css';
  st.textContent = CSS;
  doc.head.appendChild(st);
  cssInjected = true;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (text !== undefined) e.textContent = text;
  return e;
}

const LOGO_SVG = `<svg class="ll-logo" viewBox="0 0 72 72" aria-hidden="true"><circle cx="36" cy="36" r="34" fill="#e8f0ff"/><path d="M28 14h16M31 14v15L18 52a5 5 0 0 0 4 8h28a5 5 0 0 0 4-8L41 29V14" fill="none" stroke="#2f6fde" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M23 46h26l5 8H18z" fill="#2f6fde" opacity=".35"/><circle cx="33" cy="50" r="3" fill="#2f6fde"/><circle cx="42" cy="45" r="2" fill="#2f6fde"/></svg>`;

export interface LoginUiOptions {
  labTitle: string;
  welcomeTitle?: string;
  demoCodes?: string[];
  environmentLabel?: string;
}

/** Zeigt das Anmeldefenster und löst sich erst nach erfolgreicher Anmeldung auf. */
export function promptLogin(client: LabClient, o: LoginUiOptions & { reason?: string; presetCode?: string }): Promise<void> {
  injectCss();
  return new Promise((resolve) => {
    const overlay = el('div', { class: 'll-root ll-overlay', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'll-title' });
    const card = el('form', { class: 'll-card', novalidate: '' });
    card.innerHTML = LOGO_SVG;
    card.append(el('h1', { id: 'll-title' }, o.welcomeTitle || 'Willkommen im Lernlabor!'));
    card.append(el('p', { class: 'll-lab' }, o.labTitle + (o.environmentLabel ? ` · ${o.environmentLabel}` : '')));
    const label = el('label', { for: 'll-code' }, 'Gib deinen Zugangscode ein.');
    const input = el('input', {
      id: 'll-code', class: 'll-input', type: 'text', name: 'zugangscode', autocomplete: 'off', autocapitalize: 'characters',
      autocorrect: 'off', spellcheck: 'false', inputmode: 'text', maxlength: '19', placeholder: 'ABCD-EFGH-JKMN',
      'aria-describedby': 'll-msg ll-hint',
    });
    const btn = el('button', { class: 'll-btn', type: 'submit' }, 'Los geht’s!');
    const msg = el('p', { id: 'll-msg', class: 'll-msg', role: 'alert', 'aria-live': 'assertive' }, o.reason || '');
    if (o.reason) msg.classList.add('ll-err');
    const hint = el('p', { id: 'll-hint', class: 'll-hint' }, 'Deinen Code findest du auf deiner Zugangskarte. Du brauchst keinen Namen.');
    card.append(label, input, btn, msg, hint);

    if (client.mode === 'demo') {
      const d = el('div', { class: 'll-demo' });
      d.append(el('strong', {}, 'Demo-Modus: '), document.createTextNode('Es wird nichts online gespeichert. Alle Daten sind fiktiv und bleiben in diesem Browser.'));
      if (o.demoCodes?.length) {
        const b = el('button', { type: 'button', class: 'll-btn ll-secondary' }, `Demo-Code einsetzen (${o.demoCodes[0]})`);
        b.addEventListener('click', () => { input.value = o.demoCodes![0]; input.focus(); });
        d.append(el('br'), b);
      }
      card.append(d);
    }

    input.addEventListener('input', () => {
      const raw = input.value;
      if (containsForbiddenChars(raw)) {
        msg.textContent = 'Tipp: Die Zeichen 0, O, 1, I und L kommen in Codes nicht vor.';
        msg.classList.remove('ll-err');
      } else if (msg.textContent?.startsWith('Tipp')) msg.textContent = '';
      input.value = formatCode(raw);
    });

    card.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const code = input.value;
      if (!isPlausibleCode(code)) {
        msg.textContent = 'Der Code ist noch nicht vollständig. Schau noch einmal auf deine Karte.';
        msg.classList.add('ll-err');
        input.focus();
        return;
      }
      btn.disabled = true;
      btn.textContent = 'Einen Moment …';
      msg.textContent = '';
      const res = await client.loginWithAccessCode(code);
      btn.disabled = false;
      btn.textContent = 'Los geht’s!';
      if (res.ok) {
        input.value = '';
        overlay.remove();
        resolve();
      } else {
        msg.textContent = res.message;
        msg.classList.add('ll-err');
        input.select();
      }
    });

    overlay.append(card);
    document.body.append(overlay);
    if (o.presetCode) {
      input.value = formatCode(o.presetCode);
      card.requestSubmit();
    } else {
      setTimeout(() => input.focus(), 50);
    }
  });
}

/** Blockierender Hinweis (z. B. Labor nicht freigeschaltet) mit Abmelde-Knopf. */
export function showBlockingMessage(title: string, text: string, actionLabel: string): Promise<void> {
  injectCss();
  return new Promise((resolve) => {
    const overlay = el('div', { class: 'll-root ll-overlay', role: 'alertdialog', 'aria-modal': 'true', 'aria-labelledby': 'll-btitle' });
    const card = el('div', { class: 'll-card' });
    card.innerHTML = LOGO_SVG;
    card.append(el('h1', { id: 'll-btitle' }, title), el('p', { class: 'll-msg' }, text));
    const b = el('button', { class: 'll-btn', type: 'button' }, actionLabel);
    b.addEventListener('click', () => { overlay.remove(); resolve(); });
    card.append(b);
    overlay.append(card);
    document.body.append(overlay);
    b.focus();
  });
}

export function confirmDialog(title: string, text: string, yes: string, no: string): Promise<boolean> {
  injectCss();
  return new Promise((resolve) => {
    const overlay = el('div', { class: 'll-root ll-overlay', role: 'alertdialog', 'aria-modal': 'true', 'aria-labelledby': 'll-ctitle' });
    const card = el('div', { class: 'll-card' });
    card.append(el('h1', { id: 'll-ctitle' }, title), el('p', { class: 'll-msg' }, text));
    const row = el('div', { class: 'll-dialog-row' });
    const bNo = el('button', { class: 'll-btn ll-secondary', type: 'button' }, no);
    const bYes = el('button', { class: 'll-btn', type: 'button' }, yes);
    bNo.addEventListener('click', () => { overlay.remove(); resolve(false); });
    bYes.addEventListener('click', () => { overlay.remove(); resolve(true); });
    row.append(bNo, bYes);
    card.append(row);
    overlay.append(card);
    document.body.append(overlay);
    bNo.focus();
  });
}

/** Unaufdringliche Speicheranzeige. target: eigenes Element oder schwebend unten links. */
export function mountStatusBadge(client: LabClient, target?: HTMLElement | null) {
  injectCss();
  const box = el('div', { class: 'll-root ll-status' + (target ? '' : ' ll-floating'), role: 'status', 'aria-live': 'polite' });
  const dot = el('span', { class: 'll-dot', 'aria-hidden': 'true' });
  const text = el('span');
  box.append(dot, text);
  (target ?? document.body).append(box);
  const update = (s: StatusInfo) => {
    box.dataset.state = s.state;
    text.textContent = s.message;
    box.title = s.lastConfirmedAt ? `Zuletzt vom Server bestätigt: ${s.lastConfirmedAt.toLocaleTimeString('de-DE')}` : 'Noch keine Bestätigung vom Server';
  };
  update(client.getStatus());
  client.on('status', update);
  return box;
}

/** „Angemeldet als P-8F2A · Abmelden“ */
export function mountSessionBar(client: LabClient, target?: HTMLElement | null, onLogout?: () => void) {
  injectCss();
  const box = el('div', { class: 'll-root ll-session' + (target ? '' : ' ll-session-floating') });
  const who = el('span');
  const name = el('strong');
  const btn = el('button', { type: 'button' }, 'Abmelden');
  who.append(document.createTextNode('Angemeldet als '), name);
  box.append(who, btn);
  (target ?? document.body).append(box);
  const refresh = () => { name.textContent = client.participant?.pseudonym ?? '–'; };
  refresh();
  btn.addEventListener('click', async () => {
    const pending = client.pendingCount();
    if (pending > 0) {
      const ok = await confirmDialog('Noch nicht alles gespeichert',
        'Einige Antworten sind noch nicht beim Server angekommen. Sie bleiben auf diesem Gerät und werden übertragen, wenn du dich hier wieder anmeldest. Trotzdem abmelden?',
        'Trotzdem abmelden', 'Zurück');
      if (!ok) return;
    }
    await client.logout();
    if (onLogout) onLogout(); else location.reload();
  });
  return { el: box, refresh };
}

/** Deutlich sichtbarer Hinweis im Demo-Modus (mit Offline-Simulation für Vorführungen). */
export function mountDemoBanner(opts: { isOffline: () => boolean; setOffline: (on: boolean) => void; onReset?: () => void; environmentLabel?: string }) {
  injectCss();
  const b = el('div', { class: 'll-banner', role: 'note' });
  const t = el('span', {}, 'DEMO-MODUS · fiktive Daten · nichts wird online gespeichert');
  const off = el('button', { type: 'button' });
  const sync = () => { off.textContent = opts.isOffline() ? 'Offline-Simulation beenden' : 'Offline simulieren'; off.setAttribute('aria-pressed', String(opts.isOffline())); };
  off.addEventListener('click', () => { opts.setOffline(!opts.isOffline()); sync(); window.dispatchEvent(new Event(opts.isOffline() ? 'offline' : 'online')); });
  sync();
  b.append(t, off);
  document.body.prepend(b);
  return b;
}

export function mountEnvironmentBanner(label: string) {
  injectCss();
  const b = el('div', { class: 'll-banner', role: 'note' }, label);
  document.body.prepend(b);
  return b;
}
