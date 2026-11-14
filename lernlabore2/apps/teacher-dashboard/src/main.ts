// =====================================================================
// Lehrkraft-Dashboard (online, pseudonym)
// Zeigt ausschließlich Pseudonyme – Klarnamen existieren nur im lokalen
// Lehrerprogramm. Rechte werden serverseitig (RLS + Funktionen) geprüft.
// =====================================================================
import { resolveConfig } from '../../../packages/lab-sdk/src/index';
import { DemoBackend, DemoTransport } from '../../../packages/lab-sdk/src/demo-backend';
import { SupabaseTransport, TransportError, type Transport } from '../../../packages/lab-sdk/src/transport';
import { generatePseudonym, randomCodeChars, formatCode, uuid } from '../../../packages/lab-sdk/src/codes';
import { TeacherAuth } from './auth';
import { h, relativeTime, dateTime, progressBar, toCsv, download, qrSvg, labelForOption, describeData } from './util';

const REFRESH_MS = 15000;
const cfg = resolveConfig();
const demo = cfg.effectiveMode === 'demo';
let transport: Transport;
let auth: TeacherAuth | null = null;
let demoBackend: DemoBackend | null = null;
try {
  if (demo) { demoBackend = new DemoBackend(60); transport = new DemoTransport(demoBackend); }
  else { transport = new SupabaseTransport(cfg.supabaseUrl, cfg.supabaseAnonKey); auth = new TeacherAuth(cfg.supabaseUrl, cfg.supabaseAnonKey); }
} catch (e) {
  transport = null as unknown as Transport;
}

interface State {
  me: any; groups: any[]; labs: any[]; groupId: string; labId: string;
  tab: 'uebersicht' | 'aufgaben' | 'antworten' | 'verwaltung' | 'gaeste';
  overview: any; stats: any; results: any[]; participantId: string;
  lastRefresh: Date | null; refreshError: string; loading: boolean;
}
const st: State = { me: null, groups: [], labs: [], groupId: '', labId: '', tab: 'uebersicht', overview: null, stats: null, results: [], participantId: '', lastRefresh: null, refreshError: '', loading: false };
let refreshTimer: ReturnType<typeof setInterval> | null = null;
let clockTimer: ReturnType<typeof setInterval> | null = null;

const root = () => document.getElementById('app')!;

async function api<T = any>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const token = auth ? await auth.token() : undefined;
  try {
    return await transport.rpc<T>(fn, args, token);
  } catch (e) {
    if (e instanceof TransportError && e.kind === 'auth' && e.status === 401 && auth) {
      auth.clear();
      showLogin('Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.');
    }
    throw e;
  }
}

function errorText(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}

function remember() {
  try { sessionStorage.setItem('lernlabor.dashboard.auswahl', JSON.stringify({ groupId: st.groupId, labId: st.labId, tab: st.tab })); } catch { /* egal */ }
}
function recall() {
  try { Object.assign(st, JSON.parse(sessionStorage.getItem('lernlabor.dashboard.auswahl') || '{}')); } catch { /* egal */ }
}

// ------------------------------------------------------------------ Anmeldung
function showLogin(message = '') {
  stopTimers();
  const email = h('input', { type: 'email', id: 'email', autocomplete: 'username', required: true }) as HTMLInputElement;
  const pw = h('input', { type: 'password', id: 'pw', autocomplete: 'current-password', required: true }) as HTMLInputElement;
  const msg = h('p', { class: 'meldung fehler', role: 'alert', text: message });
  const btn = h('button', { type: 'submit', class: 'knopf haupt', text: 'Anmelden' });
  const form = h('form', { class: 'login-karte', 'aria-labelledby': 'login-titel' },
    h('h1', { id: 'login-titel', text: 'Lehrkraft-Dashboard' }),
    h('p', { class: 'leise', text: 'Online-Lernlabore 2.0 · pseudonyme Lernstände' }),
    h('label', { for: 'email', text: 'E-Mail-Adresse' }), email,
    h('label', { for: 'pw', text: 'Passwort' }), pw,
    btn, msg,
    h('p', { class: 'klein leise', text: 'Hier erscheinen keine Klarnamen. Die Zuordnung zu Namen erfolgt nur im lokalen Lehrerprogramm.' }));
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    btn.disabled = true; msg.textContent = 'Anmeldung läuft …';
    try {
      await auth!.login(email.value.trim(), pw.value);
      pw.value = '';
      await boot();
    } catch (e) {
      msg.textContent = errorText(e);
    } finally { btn.disabled = false; }
  });
  root().replaceChildren(h('main', { class: 'login' }, form));
  email.focus();
}

// ------------------------------------------------------------------ Start
async function boot() {
  if (!transport) {
    root().replaceChildren(h('main', { class: 'login' }, h('div', { class: 'login-karte' }, h('h1', { text: 'Noch nicht eingerichtet' }),
      h('p', { text: 'In der Datei config.js fehlen die Server-Adresse oder der öffentliche Schlüssel. Siehe INSTALLATION.md, Schritt 4.' }))));
    return;
  }
  if (auth && !auth.loggedIn) { showLogin(); return; }
  root().replaceChildren(h('main', { class: 'laden', text: 'Lade Daten …' }));
  try {
    st.me = await api('teacher_me');
    if (!st.me?.is_teacher) {
      await auth?.logout();
      showLogin('Dieses Konto ist (noch) nicht als Lehrkraft freigeschaltet. Bitte an die Administration wenden.');
      return;
    }
    if (!demo) api('teacher_purge_expired').catch(() => null); // Löschfristen nebenbei anwenden
    [st.groups, st.labs] = await Promise.all([api('teacher_list_groups', { p_include_archived: true }), api('teacher_list_labs')]);
    recall();
    if (!st.groups.some((g) => g.id === st.groupId)) st.groupId = st.groups.find((g) => !g.archived_at)?.id ?? '';
    pickLab();
    renderShell();
    await refresh();
    startTimers();
  } catch (e) {
    root().replaceChildren(h('main', { class: 'login' }, h('div', { class: 'login-karte' }, h('h1', { text: 'Fehler beim Laden' }), h('p', { text: errorText(e) }),
      h('button', { class: 'knopf haupt', text: 'Erneut versuchen', onclick: () => boot() }))));
  }
}

function pickLab() {
  const g = st.groups.find((x) => x.id === st.groupId);
  const assigned: string[] = (g?.labs ?? []).map((l: any) => l.lab_id);
  if (!assigned.includes(st.labId)) st.labId = assigned[0] ?? st.labs[0]?.id ?? '';
}

function startTimers() {
  stopTimers();
  refreshTimer = setInterval(() => { if (!document.hidden) void refresh(); }, REFRESH_MS);
  clockTimer = setInterval(updateRefreshInfo, 1000);
}
function stopTimers() {
  if (refreshTimer) clearInterval(refreshTimer);
  if (clockTimer) clearInterval(clockTimer);
  refreshTimer = clockTimer = null;
}
document.addEventListener('visibilitychange', () => { if (!document.hidden && refreshTimer) void refresh(); });

// ------------------------------------------------------------------ Daten
async function refresh() {
  if (!st.groupId || st.loading) { renderTab(); return; }
  st.loading = true;
  try {
    const tasks: Promise<any>[] = [api('teacher_group_overview', { p_group_id: st.groupId, p_lab_id: st.labId || null })];
    if (st.labId && (st.tab === 'aufgaben' || st.tab === 'uebersicht')) tasks.push(api('teacher_task_stats', { p_group_id: st.groupId, p_lab_id: st.labId }));
    else tasks.push(Promise.resolve(st.stats));
    if (st.labId && st.tab === 'antworten') tasks.push(api('teacher_participant_results', { p_group_id: st.groupId, p_lab_id: st.labId }));
    else tasks.push(Promise.resolve(st.results));
    [st.overview, st.stats, st.results] = await Promise.all(tasks);
    st.lastRefresh = new Date();
    st.refreshError = '';
  } catch (e) {
    st.refreshError = errorText(e);
  } finally {
    st.loading = false;
  }
  renderTab();
  updateRefreshInfo();
}

function updateRefreshInfo() {
  const el = document.getElementById('aktualisiert');
  if (!el) return;
  if (st.refreshError) {
    el.className = 'aktualisiert fehler';
    el.textContent = `Aktualisierung fehlgeschlagen (${st.refreshError}) – angezeigt: Stand ${st.lastRefresh ? st.lastRefresh.toLocaleTimeString('de-DE') : '–'}`;
    return;
  }
  el.className = 'aktualisiert';
  const sec = st.lastRefresh ? Math.round((Date.now() - st.lastRefresh.getTime()) / 1000) : null;
  el.textContent = st.lastRefresh ? `Aktualisiert um ${st.lastRefresh.toLocaleTimeString('de-DE')} (vor ${sec} s) · automatisch alle 15 s` : 'Noch nicht geladen';
}

// ------------------------------------------------------------------ Gerüst
const TABS: [State['tab'], string][] = [['uebersicht', 'Übersicht'], ['aufgaben', 'Aufgaben'], ['antworten', 'Antworten'], ['verwaltung', 'Verwaltung'], ['gaeste', 'Gastzugänge']];

function groupLabel(g: any) {
  const art = g.kind === 'event' ? 'Veranstaltung' : g.kind === 'demo' ? 'DEMO' : 'Klasse';
  return `${g.label} (${art}${g.archived_at ? ', archiviert' : ''})`;
}

function renderShell() {
  const gSel = h('select', { id: 'gruppe', 'aria-label': 'Lerngruppe wählen', onchange: (e: Event) => { st.groupId = (e.target as HTMLSelectElement).value; pickLab(); remember(); renderShell(); void refresh(); } },
    ...(st.groups.length ? st.groups.map((g) => h('option', { value: g.id, selected: g.id === st.groupId, text: groupLabel(g) })) : [h('option', { value: '', text: 'Noch keine Lerngruppe' })]));
  const g = st.groups.find((x) => x.id === st.groupId);
  const assigned = new Set((g?.labs ?? []).map((l: any) => l.lab_id));
  const lSel = h('select', { id: 'labor', 'aria-label': 'Lernlabor wählen', onchange: (e: Event) => { st.labId = (e.target as HTMLSelectElement).value; remember(); void refresh(); } },
    ...st.labs.map((l) => h('option', { value: l.id, selected: l.id === st.labId, text: `${l.title}${assigned.has(l.id) ? '' : ' (nicht zugewiesen)'}` })));
  const tabs = h('nav', { class: 'tabs', 'aria-label': 'Ansichten' }, ...TABS.map(([id, name]) => h('button', {
    type: 'button', class: `tab${st.tab === id ? ' aktiv' : ''}`, 'aria-current': st.tab === id ? 'page' : undefined,
    onclick: () => { st.tab = id; remember(); renderShell(); void refresh(); }, text: name,
  })));
  const header = h('header', { class: 'kopf' },
    h('div', { class: 'kopf-titel' }, h('strong', { text: 'Lehrkraft-Dashboard' }), h('span', { class: 'leise', text: demo ? 'Demo-Lehrkraft' : st.me?.display_name || auth?.email || '' })),
    h('div', { class: 'auswahl' }, h('label', { for: 'gruppe', text: 'Lerngruppe' }), gSel, h('label', { for: 'labor', text: 'Lernlabor' }), lSel),
    h('div', { class: 'kopf-rechts' },
      h('button', { type: 'button', class: 'knopf klein-knopf', text: 'Jetzt aktualisieren', onclick: () => refresh() }),
      auth ? h('button', { type: 'button', class: 'knopf klein-knopf', text: 'Abmelden', onclick: async () => { stopTimers(); await auth!.logout(); showLogin(); } }) : null));
  const banner = demo ? h('div', { class: 'demo-banner', role: 'note' },
    h('strong', { text: 'DEMO-MODUS: ' }), 'Alle Daten sind fiktiv und liegen nur in diesem Browser. Es findet keine Online-Speicherung statt. ',
    h('button', { type: 'button', class: 'knopf klein-knopf', text: 'Demo zurücksetzen', onclick: () => { demoBackend!.reset(); void boot(); } })) : null;
  root().replaceChildren(banner ?? '', header, tabs, h('p', { id: 'aktualisiert', class: 'aktualisiert', 'aria-live': 'polite' }), h('main', { id: 'ansicht', class: 'ansicht', tabindex: '-1' }));
  updateRefreshInfo();
}

function renderTab() {
  const v = document.getElementById('ansicht');
  if (!v) return;
  if (!st.groupId && st.tab !== 'gaeste') {
    v.replaceChildren(h('section', { class: 'karte' }, h('h2', { text: 'Noch keine Lerngruppe' }),
      h('p', { text: 'Klassen legst du im lokalen Lehrerprogramm an („Schülerliste importieren“ → „Mit Online-Datenbank synchronisieren“). Gastzugänge für Veranstaltungen kannst du direkt hier im Reiter „Gastzugänge“ erzeugen.' })));
    return;
  }
  switch (st.tab) {
    case 'uebersicht': v.replaceChildren(viewOverview()); break;
    case 'aufgaben': v.replaceChildren(viewTasks()); break;
    case 'antworten': v.replaceChildren(viewAnswers()); break;
    case 'verwaltung': v.replaceChildren(viewAdmin()); break;
    case 'gaeste': v.replaceChildren(viewGuests()); break;
  }
}

// ------------------------------------------------------------------ Übersicht
function labOf(id: string) { return st.labs.find((l) => l.id === id); }

function viewOverview() {
  const ov = st.overview;
  if (!ov) return h('p', { text: 'Lade …' });
  const lab = ov.labs.find((l: any) => l.id === st.labId) ?? ov.labs[0];
  const tasks: any[] = lab?.tasks ?? labOf(st.labId)?.tasks ?? [];
  const people: any[] = ov.participants;
  const prog = (p: any) => p.progress.find((x: any) => x.lab_id === st.labId);
  const started = people.filter((p) => prog(p)).length;
  const finished = people.filter((p) => prog(p)?.finished_at).length;
  const active = people.filter((p) => { const x = prog(p); return x && Date.now() - new Date(x.last_saved_at).getTime() < 5 * 60000; }).length;
  const avg = people.length ? Math.round(people.reduce((a, p) => a + (prog(p)?.percent ?? 0), 0) / people.length) : 0;
  const kacheln = h('div', { class: 'kacheln' },
    kachel('Teilnehmende', String(people.length)), kachel('Begonnen', `${started}`), kachel('Abgeschlossen', `${finished}`),
    kachel('Gerade aktiv (5 Min.)', `${active}`), kachel('Ø Fortschritt', `${avg} %`));

  const tabelle = h('table', { class: 'tabelle' },
    h('caption', { class: 'vh', text: 'Fortschritt je Teilnehmer-ID' }),
    h('thead', {}, h('tr', {}, h('th', { scope: 'col', text: 'Teilnehmer' }), h('th', { scope: 'col', text: 'Fortschritt' }),
      h('th', { scope: 'col', text: 'Aufgaben' }), h('th', { scope: 'col', text: 'Letzte Speicherung' }), h('th', { scope: 'col', text: 'Status' }))),
    h('tbody', {}, ...people.map((p) => {
      const x = prog(p);
      const done = new Set(p.tasks.filter((t: any) => t.lab_id === st.labId && t.status === 'completed').map((t: any) => t.task_id));
      const aktiv = x && Date.now() - new Date(x.last_saved_at).getTime() < 5 * 60000;
      return h('tr', { class: p.status === 'blocked' ? 'gesperrt' : '' },
        h('th', { scope: 'row', class: 'pseudo' }, p.pseudonym, aktiv ? h('span', { class: 'aktiv-punkt', title: 'in den letzten 5 Minuten gespeichert', 'aria-label': 'gerade aktiv' }) : null),
        h('td', {}, progressBar(x?.percent ?? 0, `Fortschritt ${p.pseudonym}`)),
        h('td', {}, h('span', { class: 'punkte' }, ...tasks.map((t) => h('span', { class: `tpunkt${done.has(t.task_id) ? ' an' : ''}`, title: `${t.title}${done.has(t.task_id) ? ' – erledigt' : ''}`, 'aria-label': `${t.title}${done.has(t.task_id) ? ': erledigt' : ': offen'}` })))),
        h('td', { title: dateTime(x?.last_saved_at), text: relativeTime(x?.last_saved_at) }),
        h('td', { text: p.status === 'blocked' ? 'gesperrt' : x?.finished_at ? 'fertig' : x ? 'in Arbeit' : 'nicht begonnen' }));
    })));
  return h('div', {},
    ov.group.kind === 'demo' ? h('p', { class: 'hinweis-demo', text: 'Demo-Gruppe: fiktive Teilnehmende zu Vorführzwecken.' }) : null,
    kacheln,
    h('section', { class: 'karte' }, h('h2', { text: lab ? `Fortschritt: ${lab.title}` : 'Fortschritt' }),
      people.length ? tabelle : h('p', { text: 'Diese Gruppe hat noch keine Teilnehmenden.' }),
      h('p', { class: 'klein leise', text: 'Sortiert nach Teilnehmer-ID (keine Rangliste). Angezeigt wird der Stand nach jeder abgeschlossenen Aufgabe.' }),
      h('div', { class: 'aktionen' }, h('button', { type: 'button', class: 'knopf', text: 'Klassenübersicht als CSV (pseudonym)', onclick: () => exportOverviewCsv(people, tasks, lab) }))));
}

function kachel(titel: string, wert: string) {
  return h('div', { class: 'kachel' }, h('span', { class: 'kachel-wert', text: wert }), h('span', { class: 'kachel-titel', text: titel }));
}

function exportOverviewCsv(people: any[], tasks: any[], lab: any) {
  const rows: any[][] = [['Teilnehmer-ID', 'Lernlabor', 'Fortschritt %', 'Erledigt', 'Gesamt', 'Letzte Speicherung', 'Abgeschlossen am', ...tasks.map((t) => t.task_id)]];
  for (const p of people) {
    const x = p.progress.find((y: any) => y.lab_id === st.labId);
    const done = new Set(p.tasks.filter((t: any) => t.lab_id === st.labId && t.status === 'completed').map((t: any) => t.task_id));
    rows.push([p.pseudonym, lab?.title ?? st.labId, x?.percent ?? 0, x?.completed ?? 0, x?.total ?? tasks.length, dateTime(x?.last_saved_at), dateTime(x?.finished_at), ...tasks.map((t) => (done.has(t.task_id) ? 'ja' : ''))]);
  }
  download(`uebersicht_${st.labId}_${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows));
}

// ------------------------------------------------------------------ Aufgaben
function viewTasks() {
  const s = st.stats;
  if (!st.labId) return h('p', { text: 'Bitte ein Lernlabor wählen.' });
  if (!s) return h('p', { text: 'Lade …' });
  const n = s.participants || 0;
  return h('div', {},
    h('div', { class: 'kacheln' }, kachel('Teilnehmende', String(n)), kachel('Begonnen', String(s.started)), kachel('Abgeschlossen', String(s.finished))),
    ...s.tasks.map((t: any) => {
      const answered = Object.values(t.answers as Record<string, number>).reduce((a, b) => a + b, 0);
      const firstTotal = t.first_correct + t.first_incorrect;
      const quote = firstTotal ? Math.round((100 * t.first_correct) / firstTotal) : null;
      const schwierig = t.graded && firstTotal >= 3 && quote !== null && quote < 50;
      const box = h('section', { class: `karte aufgabe${schwierig ? ' schwierig' : ''}` },
        h('h2', {}, `${t.position}. ${t.title}`),
        h('p', { class: 'leise', text: `${t.section} · ${t.graded ? 'bewertete Auswertungsfrage' : t.kind === 'simulation' ? 'Versuch' : 'Vermutung (nicht bewertet)'}` }),
        h('div', { class: 'zeile' }, h('span', { text: `Erledigt: ${t.completed} von ${n}` }), progressBar(n ? (100 * t.completed) / n : 0, `Erledigt ${t.title}`)),
        t.graded && firstTotal ? h('p', { class: schwierig ? 'warnung' : '', text: `Beim ersten Versuch richtig: ${t.first_correct} von ${firstTotal} (${quote} %)${schwierig ? ' – wird besonders häufig falsch beantwortet' : ''}. Aktuell richtig: ${t.correct}.` }) : null);
      if (t.kind === 'choice' && t.options?.length) {
        const correct = new Set<string>(t.solution?.correct ?? []);
        box.append(h('div', { class: 'verteilung' }, ...t.options.map((o: any) => {
          const c = t.answers[o.value] ?? 0;
          return h('div', { class: 'vzeile' },
            h('span', { class: 'vlabel' }, o.label, correct.has(o.value) ? h('strong', { class: 'richtig', text: ' ✓ richtig' }) : null),
            h('span', { class: 'vbalken' }, h('span', { class: `vfuellung${correct.has(o.value) ? ' ok' : ''}`, style: { width: `${answered ? (100 * c) / answered : 0}%` } })),
            h('span', { class: 'vzahl', text: String(c) }));
        })));
      }
      return box;
    }));
}

// ------------------------------------------------------------------ Antworten
function viewAnswers() {
  if (!st.labId) return h('p', { text: 'Bitte ein Lernlabor wählen.' });
  const lab = labOf(st.labId);
  const tasks: any[] = lab?.tasks ?? [];
  const list = st.results ?? [];
  const sel = h('select', { id: 'tn', onchange: (e: Event) => { st.participantId = (e.target as HTMLSelectElement).value; renderTab(); } },
    h('option', { value: '', text: 'Alle (Matrix)' }), ...list.map((p: any) => h('option', { value: p.participant_id, selected: p.participant_id === st.participantId, text: p.pseudonym })));
  const answerText = (t: any, r: any) => {
    if (!r) return '–';
    const parts = [];
    if (r.answer?.choice) parts.push(labelForOption(t.options, r.answer.choice));
    const d = describeData(r.data);
    if (d && !r.answer?.demo) parts.push(d);
    if (r.answer?.demo) parts.push('(fiktiv)');
    return parts.join(' · ') || (r.status === 'completed' ? 'erledigt' : 'begonnen');
  };
  let body: HTMLElement;
  if (st.participantId) {
    const p = list.find((x: any) => x.participant_id === st.participantId);
    body = h('section', { class: 'karte' }, h('h2', { text: `Antworten von ${p?.pseudonym ?? '–'}` }),
      h('table', { class: 'tabelle' }, h('thead', {}, h('tr', {}, h('th', { text: 'Aufgabe' }), h('th', { text: 'Antwort / Messwerte' }), h('th', { text: 'Bewertung' }), h('th', { text: 'Gespeichert' }))),
        h('tbody', {}, ...tasks.map((t) => {
          const r = p?.results.find((x: any) => x.task_id === t.task_id);
          return h('tr', {}, h('th', { scope: 'row', text: `${t.position}. ${t.title}` }), h('td', { text: answerText(t, r) }),
            h('td', { text: !t.graded || !r ? '–' : `${r.is_correct ? 'richtig' : 'nicht richtig'}${r.first_is_correct === false && r.is_correct ? ' (im 2. Anlauf)' : ''}` }),
            h('td', { text: dateTime(r?.updated_at) }));
        }))));
  } else {
    body = h('section', { class: 'karte breit' }, h('h2', { text: 'Alle Antworten (pseudonym)' }),
      h('div', { class: 'scroll' }, h('table', { class: 'tabelle matrix' },
        h('thead', {}, h('tr', {}, h('th', { text: 'Teilnehmer' }), ...tasks.map((t) => h('th', { title: t.title, text: `${t.position}. ${t.title.split(':')[0]}` })))),
        h('tbody', {}, ...list.map((p: any) => h('tr', {}, h('th', { scope: 'row', class: 'pseudo', text: p.pseudonym }),
          ...tasks.map((t) => { const r = p.results.find((x: any) => x.task_id === t.task_id); return h('td', { class: t.graded && r ? (r.is_correct ? 'ok' : 'nok') : '', text: answerText(t, r) }); })))))));
  }
  return h('div', {},
    h('div', { class: 'aktionen' }, h('label', { for: 'tn', text: 'Teilnehmer-ID' }), sel,
      h('button', { type: 'button', class: 'knopf', text: 'Antworten als CSV (pseudonym)', onclick: () => {
        const rows: any[][] = [['Teilnehmer-ID', 'Aufgabe', 'Titel', 'Status', 'Antwort', 'Messwerte', 'richtig', 'beim 1. Versuch richtig', 'gespeichert']];
        for (const p of list) for (const t of tasks) {
          const r = p.results.find((x: any) => x.task_id === t.task_id);
          rows.push([p.pseudonym, t.task_id, t.title, r?.status ?? 'offen', r?.answer?.choice ? labelForOption(t.options, r.answer.choice) : '', describeData(r?.data), r?.is_correct ?? '', r?.first_is_correct ?? '', dateTime(r?.updated_at)]);
        }
        download(`antworten_${st.labId}_${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows));
      } }),
      h('button', { type: 'button', class: 'knopf', text: 'Pseudonymer Gesamtexport (JSON)', onclick: async () => {
        const data = await api('teacher_export_group', { p_group_id: st.groupId });
        download(`export_${(data.group?.label ?? 'gruppe').replace(/[^\w-]+/g, '_')}_${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data, null, 2), 'application/json');
      } })),
    body);
}

// ------------------------------------------------------------------ Verwaltung
function confirmTyped(text: string, expected: string): boolean {
  const v = window.prompt(`${text}\n\nZur Bestätigung bitte „${expected}“ eintippen:`);
  return v !== null && v.trim() === expected;
}

function viewAdmin() {
  const g = st.groups.find((x) => x.id === st.groupId);
  if (!g) return h('p', { text: 'Keine Gruppe gewählt.' });
  const msg = h('p', { class: 'meldung', role: 'status', 'aria-live': 'polite' });
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    msg.textContent = 'Wird ausgeführt …';
    try { await fn(); msg.textContent = ok; st.groups = await api('teacher_list_groups', { p_include_archived: true }); renderShell(); await refresh(); }
    catch (e) { msg.textContent = `Fehler: ${errorText(e)}`; }
  };
  const assigned = new Map<string, any>((g.labs ?? []).map((l: any) => [l.lab_id, l]));
  const labList = h('ul', { class: 'liste' }, ...st.labs.map((l) => {
    const a = assigned.get(l.id);
    return h('li', {}, h('span', {}, h('strong', { text: l.title }), h('span', { class: 'leise', text: a ? (a.archived_at ? ` – archiviert am ${dateTime(a.archived_at)}` : ' – zugewiesen') : ' – nicht zugewiesen' })),
      h('span', { class: 'knopfreihe' },
        !a || a.archived_at ? h('button', { type: 'button', class: 'knopf klein-knopf', text: a ? 'Reaktivieren' : 'Zuweisen', onclick: () => run(() => api('teacher_set_lab_assignment', { p_group_id: g.id, p_lab_id: l.id, p_state: 'active' }), 'Lernlabor ist freigeschaltet.') }) : null,
        a && !a.archived_at ? h('button', { type: 'button', class: 'knopf klein-knopf', text: 'Durchgang archivieren', onclick: () => run(() => api('teacher_set_lab_assignment', { p_group_id: g.id, p_lab_id: l.id, p_state: 'archived' }), 'Durchgang archiviert – keine neuen Speicherungen mehr.') }) : null,
        h('button', { type: 'button', class: 'knopf klein-knopf gefahr', text: 'Ergebnisse löschen', onclick: () => {
          if (confirmTyped(`Alle Ergebnisse von „${l.title}“ in „${g.label}“ endgültig löschen?`, 'LÖSCHEN')) void run(() => api('teacher_delete_results', { p_group_id: g.id, p_lab_id: l.id }), 'Ergebnisse gelöscht.');
        } })));
  }));

  const retention = h('input', { type: 'date', id: 'loeschdatum', value: g.retention_until ?? '' }) as HTMLInputElement;
  const people: any[] = st.overview?.participants ?? [];
  const pList = h('ul', { class: 'liste' }, ...people.map((p) => h('li', {},
    h('span', {}, h('strong', { class: 'pseudo', text: p.pseudonym }), h('span', { class: 'leise', text: ` – ${p.status === 'blocked' ? 'gesperrt' : 'aktiv'}${p.code_active ? '' : ', kein gültiger Code'}` })),
    h('span', { class: 'knopfreihe' },
      h('button', { type: 'button', class: 'knopf klein-knopf', text: p.status === 'blocked' ? 'Entsperren' : 'Sperren', onclick: () => run(() => api('teacher_set_participant_status', { p_participant_ids: [p.id], p_status: p.status === 'blocked' ? 'active' : 'blocked' }), 'Status geändert.') }),
      h('button', { type: 'button', class: 'knopf klein-knopf', text: 'Code ungültig machen', onclick: () => { if (window.confirm(`Code von ${p.pseudonym} sperren? Einen neuen Code stellst du im Lehrerprogramm aus.`)) void run(() => api('teacher_revoke_codes', { p_participant_ids: [p.id] }), 'Code gesperrt.'); } }),
      h('button', { type: 'button', class: 'knopf klein-knopf', text: 'Lernstand zurücksetzen', onclick: () => { if (window.confirm(`Lernstand von ${p.pseudonym} in diesem Labor löschen?`)) void run(() => api('teacher_reset_results', { p_participant_ids: [p.id], p_lab_id: st.labId || null }), 'Lernstand zurückgesetzt.'); } })))));

  const share = h('input', { type: 'email', id: 'kollegin', placeholder: 'kollegin@schule.de' }) as HTMLInputElement;
  const audit = h('div', { class: 'klein' }, h('button', { type: 'button', class: 'knopf klein-knopf', text: 'Protokoll anzeigen', onclick: async (e: Event) => {
    const log = await api<any[]>('teacher_audit_log', { p_group_id: g.id });
    (e.target as HTMLElement).replaceWith(h('ul', { class: 'protokoll' }, ...log.map((x) => h('li', { text: `${dateTime(x.at)} – ${x.action} ${JSON.stringify(x.details)}` }))));
  } }));

  return h('div', { class: 'raster' },
    h('section', { class: 'karte' }, h('h2', { text: 'Lernlabore dieser Gruppe' }), labList),
    h('section', { class: 'karte' }, h('h2', { text: 'Aufbewahrung und Archiv' }),
      h('p', { text: `Gruppe „${g.label}“ · angelegt ${dateTime(g.created_at)}${g.valid_until ? ` · Zugang gültig bis ${dateTime(g.valid_until)}` : ''}` }),
      h('label', { for: 'loeschdatum', text: 'Automatische Löschung aller Daten dieser Gruppe am' }), retention,
      h('div', { class: 'knopfreihe' },
        h('button', { type: 'button', class: 'knopf', text: 'Löschdatum speichern', onclick: () => run(() => api('teacher_update_group', { p_group_id: g.id, p_changes: { retention_until: retention.value } }), 'Löschdatum gespeichert.') }),
        h('button', { type: 'button', class: 'knopf', text: g.archived_at ? 'Gruppe reaktivieren' : 'Gruppe archivieren', onclick: () => run(() => api('teacher_update_group', { p_group_id: g.id, p_changes: { archived: !g.archived_at } }), g.archived_at ? 'Gruppe reaktiviert.' : 'Gruppe archiviert – Anmeldungen sind gesperrt.') }),
        h('button', { type: 'button', class: 'knopf gefahr', text: 'Gruppe endgültig löschen', onclick: () => {
          if (confirmTyped(`Gruppe „${g.label}“ mit allen Teilnehmenden und Ergebnissen endgültig löschen? Das kann nicht rückgängig gemacht werden.`, g.label)) {
            void run(async () => { await api('teacher_delete_group', { p_group_id: g.id }); st.groupId = ''; }, 'Gruppe gelöscht.');
          }
        } }))),
    h('section', { class: 'karte' }, h('h2', { text: 'Teilnehmende (pseudonym)' }),
      h('p', { class: 'klein leise', text: 'Neue Codes mit Namen stellst du im lokalen Lehrerprogramm aus. Hier kannst du sperren, Codes ungültig machen oder Lernstände zurücksetzen.' }), pList),
    h('section', { class: 'karte' }, h('h2', { text: 'Mit Kollegin oder Kollegen teilen' }),
      h('label', { for: 'kollegin', text: 'E-Mail einer freigeschalteten Lehrkraft' }), share,
      h('button', { type: 'button', class: 'knopf', text: 'Lesezugriff geben', onclick: () => run(() => api('teacher_share_group', { p_group_id: g.id, p_email: share.value }), 'Gruppe geteilt.') }),
      h('h3', { text: 'Protokoll' }), audit),
    msg);
}

// ------------------------------------------------------------------ Gastzugänge
function localDateTimeValue(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function viewGuests() {
  const heute = new Date();
  const ende = new Date(); ende.setHours(18, 0, 0, 0);
  if (ende < heute) ende.setDate(ende.getDate() + 1);
  const name = h('input', { id: 'v-name', value: `Tag der offenen Tür ${heute.getFullYear()}`, maxlength: 60 }) as HTMLInputElement;
  const anzahl = h('select', { id: 'v-anzahl' }, ...[10, 20, 30, 50, 80].map((n) => h('option', { value: n, selected: n === 30, text: String(n) }))) as HTMLSelectElement;
  const von = h('input', { id: 'v-von', type: 'datetime-local', value: localDateTimeValue(heute) }) as HTMLInputElement;
  const bis = h('input', { id: 'v-bis', type: 'datetime-local', value: localDateTimeValue(ende) }) as HTMLInputElement;
  const labSel = h('select', { id: 'v-labor' }, ...st.labs.map((l) => h('option', { value: l.id, selected: l.id === 'physik-entdecker', text: l.title }))) as HTMLSelectElement;
  const msg = h('p', { class: 'meldung', role: 'status', 'aria-live': 'polite' });
  const ausgabe = h('div', { id: 'karten-ausgabe' });

  const erzeugen = h('button', { type: 'button', class: 'knopf haupt', text: 'Gastzugänge erzeugen', onclick: async () => {
    const n = Number(anzahl.value);
    const validFrom = new Date(von.value), validUntil = new Date(bis.value);
    if (!(validUntil > validFrom)) { msg.textContent = 'Das Ende muss nach dem Beginn liegen.'; return; }
    erzeugen.setAttribute('disabled', '');
    msg.textContent = 'Erzeuge Zugänge … Bitte warten, bis der Server bestätigt.';
    try {
      const group = await api('teacher_create_group', { p_label: name.value.trim() || 'Veranstaltung', p_kind: 'event', p_valid_from: validFrom.toISOString(), p_valid_until: validUntil.toISOString() });
      const seen = new Set<string>();
      const guests: { id: string; pseudonym: string; code: string }[] = [];
      while (guests.length < n) {
        const pseudonym = generatePseudonym('G');
        if (seen.has(pseudonym)) continue;
        seen.add(pseudonym);
        guests.push({ id: uuid(), pseudonym, code: formatCode(randomCodeChars(8)) });
      }
      const reg = await api('teacher_register_participants', { p_group_id: group.id, p_participants: guests });
      await api('teacher_set_lab_assignment', { p_group_id: group.id, p_lab_id: labSel.value, p_state: 'active' });
      if (reg.created !== n) throw new Error(`Server meldet ${reg.created} statt ${n} neuen Zugängen.`);
      msg.textContent = `${n} Gastzugänge wurden vom Server bestätigt. Die Codes werden NUR JETZT angezeigt – bitte gleich drucken.`;
      st.groups = await api('teacher_list_groups', { p_include_archived: true });
      ausgabe.replaceChildren(guestCards(guests, group, labSel.value, validUntil));
      zeigeListe();
    } catch (e) {
      msg.textContent = `Fehler: ${errorText(e)} – es wurden keine Karten erzeugt.`;
    } finally { erzeugen.removeAttribute('disabled'); }
  } });

  const listeBox = h('div');
  const zeigeListe = () => {
    const evs = st.groups.filter((g) => g.kind === 'event');
    listeBox.replaceChildren(evs.length ? baueListe(evs) : h('p', { text: 'Noch keine Veranstaltung angelegt.' }));
  };
  const baueListe = (events: any[]) => h('ul', { class: 'liste' }, ...events.map((g) => {
    const vorbei = g.valid_until && new Date(g.valid_until) <= new Date();
    return h('li', {}, h('span', {}, h('strong', { text: g.label }), h('span', { class: 'leise', text: ` – ${g.participants} Zugänge · ${vorbei ? 'beendet' : `gültig bis ${dateTime(g.valid_until)}`} · Löschung am ${new Date(g.retention_until).toLocaleDateString('de-DE')}` })),
      h('span', { class: 'knopfreihe' },
        h('button', { type: 'button', class: 'knopf klein-knopf', text: 'Übersicht öffnen', onclick: () => { st.groupId = g.id; pickLab(); st.tab = 'uebersicht'; remember(); renderShell(); void refresh(); } }),
        vorbei ? null : h('button', { type: 'button', class: 'knopf klein-knopf gefahr', text: 'Veranstaltung jetzt beenden', onclick: async () => {
          if (!window.confirm(`„${g.label}“ jetzt beenden? Alle Gastcodes werden sofort ungültig.`)) return;
          await api('teacher_end_access', { p_group_id: g.id });
          st.groups = await api('teacher_list_groups', { p_include_archived: true });
          zeigeListe();
        } })));
  }));
  zeigeListe();

  return h('div', {},
    h('section', { class: 'karte' }, h('h2', { text: 'Neue Veranstaltung (Gastmodus)' }),
      h('p', { class: 'leise', text: 'Für Besucherkinder ohne Namen: Es werden nur zufällige Gastcodes und Kennungen (G-…) erzeugt. Keine Namen, keine E-Mail-Adressen.' }),
      h('div', { class: 'formular' },
        h('label', { for: 'v-name', text: 'Bezeichnung' }), name,
        h('label', { for: 'v-anzahl', text: 'Anzahl Gastzugänge' }), anzahl,
        h('label', { for: 'v-labor', text: 'Lernlabor' }), labSel,
        h('label', { for: 'v-von', text: 'Gültig ab' }), von,
        h('label', { for: 'v-bis', text: 'Gültig bis (danach automatisch gesperrt)' }), bis),
      h('p', { class: 'klein leise', text: 'Die Daten der Veranstaltung werden 30 Tage nach Ende automatisch gelöscht (änderbar unter „Verwaltung“).' }),
      erzeugen, msg),
    ausgabe,
    h('section', { class: 'karte' }, h('h2', { text: 'Veranstaltungen' }), listeBox));
}

function labUrl(labId: string) {
  return new URL(`../labore/${labId}/`, location.href).href;
}

function guestCards(guests: { pseudonym: string; code: string }[], group: any, labId: string, validUntil: Date) {
  const url = labUrl(labId);
  const title = st.labs.find((l) => l.id === labId)?.title ?? 'Lernlabor';
  return h('section', { class: 'karte' },
    h('div', { class: 'aktionen nicht-drucken' }, h('button', { type: 'button', class: 'knopf haupt', text: 'Karten drucken', onclick: () => window.print() }),
      h('span', { class: 'leise', text: 'Tipp: Im Druckdialog „Hintergrundgrafiken“ aktivieren. 10 Karten pro A4-Seite.' })),
    h('div', { class: 'karten-raster', id: 'druckbereich' }, ...guests.map((g) => h('div', { class: 'zugangskarte' },
      h('div', { class: 'zk-text' },
        h('p', { class: 'zk-titel', text: title }),
        h('p', { class: 'zk-label', text: 'Dein Zugangscode' }),
        h('p', { class: 'zk-code', text: g.code }),
        h('p', { class: 'zk-klein', text: `${group.label} · gültig bis ${validUntil.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}` }),
        h('p', { class: 'zk-klein', text: `${g.pseudonym} · ${url.replace(/^https?:\/\//, '')}` })),
      qrSvg(`${url}#zugang=${g.code}`, 104)))));
}

// ------------------------------------------------------------------
void boot();
