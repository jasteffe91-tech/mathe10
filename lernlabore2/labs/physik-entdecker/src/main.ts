// =====================================================================
// Physik-Entdecker: Bewegung und Strom – Lernlabor für Klasse 4
// Vollständig an das Lernlabor-SDK angebunden: Anmeldung per Code,
// automatische Speicherung jeder Aufgabe, Fortsetzen nach Unterbrechung.
// =====================================================================
import { initializeLab, type LabClient, type JsonObject, type LabManifest } from '../../../packages/lab-sdk/src/index';
import manifestJson from '../lab.manifest.json';
import { RAMPEN, rollzeit, endgeschwindigkeit, weg, leuchtet, luecken, zahl, type Rampe, type Kreis } from './physik';

const manifest = manifestJson as LabManifest;

// ------------------------------------------------------------------ DOM-Helfer
type Child = Node | string | null | undefined | false;
function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, any> = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children) if (c !== null && c !== undefined && c !== false) e.append(c);
  return e;
}
const SVGNS = 'http://www.w3.org/2000/svg';
function s(tag: string, attrs: Record<string, any> = {}, ...children: (SVGElement | string)[]): SVGElement {
  const e = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) e.setAttribute(k, String(v));
  for (const c of children) e.append(c);
  return e;
}
const $ = (id: string) => document.getElementById(id)!;
const reduziert = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// ------------------------------------------------------------------ Schritte
type Bereich = 'start' | 'mechanik' | 'strom' | 'ende';
interface Schritt { id: string; bereich: Bereich; nr?: number; kurz: string; icon: string }
const SCHRITTE: Schritt[] = [
  { id: 'start', bereich: 'start', kurz: 'Start', icon: '▶' },
  { id: 'm1-vermutung', bereich: 'mechanik', nr: 1, kurz: 'Vermutung', icon: '?' },
  { id: 'm2-versuch', bereich: 'mechanik', nr: 2, kurz: 'Versuch', icon: '●' },
  { id: 'm3-auswertung', bereich: 'mechanik', nr: 3, kurz: 'Auswertung', icon: '!' },
  { id: 'e1-vermutung', bereich: 'strom', nr: 4, kurz: 'Vermutung', icon: '?' },
  { id: 'e2-versuch', bereich: 'strom', nr: 5, kurz: 'Versuch', icon: '●' },
  { id: 'e3-auswertung', bereich: 'strom', nr: 6, kurz: 'Auswertung', icon: '!' },
  { id: 'ende', bereich: 'ende', kurz: 'Urkunde', icon: '★' },
];
const AUFGABEN = SCHRITTE.filter((x) => x.nr);
const optionen = (taskId: string) => manifest.tasks.find((t) => t.task_id === taskId)?.options ?? [];
const optionText = (taskId: string, v: string | undefined) => optionen(taskId).find((o) => o.value === v)?.label ?? '–';

let lab: LabClient;
let aktuell = 0;

// ------------------------------------------------------------------ Simulationen: Zustand
interface Lauf { rampe: Rampe; winkel_grad: number; zeit_s: number; tempo_unten_m_s: number }
const rampenSim = { gewaehlt: 'flach' as Rampe, laeuft: false, zeitlupe: false, laeufe: [] as Lauf[], anim: 0, amZiel: null as Rampe | null };
const kreis: Kreis & { anZaehler: number; ausZaehler: number; versuche: JsonObject[]; warAn: boolean } = {
  schalterZu: false, kabel1: true, kabel2: true, anZaehler: 0, ausZaehler: 0, versuche: [], warAn: false,
};

function ladeSimZustand() {
  const m2 = lab.getResult('m2-versuch');
  const laeufe = (m2?.data as any)?.laeufe;
  rampenSim.laeufe = Array.isArray(laeufe) ? laeufe.filter((l: any) => l && l.rampe in RAMPEN) : [];
  const e2 = lab.getResult('e2-versuch')?.data as any;
  if (e2) {
    kreis.anZaehler = Number(e2.an) || 0;
    kreis.ausZaehler = Number(e2.aus) || 0;
    kreis.versuche = Array.isArray(e2.probiert) ? e2.probiert : [];
    kreis.warAn = kreis.anZaehler > 0;
  }
}

// ------------------------------------------------------------------ Fortschritt & Navigation
const erledigt = (id: string) => lab.isCompleted(id);
function erreichbar(i: number): boolean {
  const s = SCHRITTE[i];
  if (s.id === 'start') return true;
  if (s.id === 'ende') return AUFGABEN.every((a) => erledigt(a.id));
  // eine Aufgabe ist erreichbar, wenn alle vorherigen Aufgaben erledigt sind
  return SCHRITTE.slice(1, i).every((x) => !x.nr || erledigt(x.id));
}
function ersterOffenerSchritt(): number {
  const i = SCHRITTE.findIndex((x) => x.nr && !erledigt(x.id));
  return i === -1 ? SCHRITTE.length - 1 : i;
}

function zeigeFortschritt() {
  const ol = $('schritte');
  ol.replaceChildren();
  SCHRITTE.forEach((st, i) => {
    if (!st.nr) return;
    const fertig = erledigt(st.id);
    const istAktuell = i === aktuell;
    const b = h('button', {
      type: 'button', class: `punkt ${st.bereich}${fertig ? ' fertig' : ''}${istAktuell ? ' aktuell' : ''}`,
      'aria-current': istAktuell ? 'step' : undefined, disabled: !erreichbar(i),
      'aria-label': `Aufgabe ${st.nr}: ${st.kurz} (${st.bereich === 'mechanik' ? 'Bewegung' : 'Strom'})${fertig ? ', erledigt' : ''}`,
      onclick: () => gehe(i),
    }, h('span', { class: 'punkt-nr', 'aria-hidden': 'true', text: fertig ? '✓' : String(st.nr) }), h('span', { class: 'punkt-text', text: st.kurz }));
    ol.append(h('li', {}, b));
  });
  const p = lab.getProgress();
  const balken = $('balken-fuellung');
  balken.style.width = `${p.percent}%`;
  $('balken').setAttribute('aria-valuenow', String(p.percent));
  $('fortschritt-text').textContent = `${p.completed} von ${p.total} Aufgaben geschafft`;
}

function gehe(i: number, fokus = true) {
  if (i < 0 || i >= SCHRITTE.length || !erreichbar(i)) return;
  if (rampenSim.laeuft) return;
  aktuell = i;
  void lab.setResumeState({ schritt: SCHRITTE[i].id });
  render();
  if (fokus) {
    $('inhalt').focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: reduziert() ? 'auto' : 'smooth' });
  }
}

/** Speichert (lokal sofort, dann online) und zeichnet danach neu. */
function speichere(p: Promise<unknown>) {
  p.then(() => render(), (e) => { console.error(e); toast('Speichern hat nicht geklappt. Bitte versuche es noch einmal.'); });
}

function toast(text: string) {
  const t = $('toast');
  t.textContent = text;
  t.classList.add('sichtbar');
  clearTimeout((t as any)._timer);
  (t as any)._timer = setTimeout(() => t.classList.remove('sichtbar'), 5000);
}

// ------------------------------------------------------------------ Bausteine
function bereichsKopf(st: Schritt) {
  const name = st.bereich === 'mechanik' ? 'Bereich 1 · Bewegung' : 'Bereich 2 · Strom';
  return h('div', { class: 'aufgaben-kopf' },
    h('span', { class: `bereich-chip ${st.bereich}`, text: name }),
    h('span', { class: 'aufgaben-nr', text: `Aufgabe ${st.nr} von 6` }));
}

function navigation(weiterAktiv: boolean, weiterText = 'Weiter') {
  const zur = h('button', { type: 'button', class: 'knopf zweit', onclick: () => gehe(aktuell - 1), text: 'Zurück' });
  const weiter = h('button', { type: 'button', class: 'knopf haupt', disabled: !weiterAktiv, onclick: () => gehe(aktuell + 1), text: weiterText });
  const hinweis = weiterAktiv ? null : h('p', { class: 'nav-hinweis', text: 'Erledige zuerst die Aufgabe, dann geht es weiter.' });
  return h('div', { class: 'nav' }, zur, h('div', { class: 'nav-rechts' }, hinweis, weiter));
}

function auswahl(taskId: string, onWahl: (v: string) => void, icons?: Record<string, Element>) {
  const gewaehlt = (lab.getResult(taskId)?.answer as any)?.choice as string | undefined;
  const gruppe = h('div', { class: 'wahl-gruppe', role: 'radiogroup', 'aria-label': 'Antwortmöglichkeiten' });
  for (const o of optionen(taskId)) {
    const an = o.value === gewaehlt;
    gruppe.append(h('button', {
      type: 'button', role: 'radio', 'aria-checked': String(an), class: `wahl${an ? ' gewaehlt' : ''}`,
      onclick: () => onWahl(o.value),
    }, icons?.[o.value] ?? null, h('span', { text: o.label })));
  }
  return gruppe;
}

function miniRampe(winkel: number): SVGElement {
  const L = 58, x1 = 74, y1 = 46, a = (winkel * Math.PI) / 180;
  const x0 = x1 - L * Math.cos(a), y0 = y1 - L * Math.sin(a);
  return s('svg', { viewBox: '0 0 80 50', class: 'mini', 'aria-hidden': 'true' },
    s('polygon', { points: `${x0},${y1} ${x0},${y0} ${x1},${y1}`, fill: 'var(--mech-hell)' }),
    s('line', { x1: x0, y1: y0, x2: x1, y2: y1, stroke: 'var(--mech)', 'stroke-width': 4, 'stroke-linecap': 'round' }),
    s('circle', { cx: x0 + 9 * Math.cos(a) + 7 * Math.sin(a), cy: y0 + 9 * Math.sin(a) - 7 * Math.cos(a), r: 5, fill: 'var(--mech)' }));
}

// ------------------------------------------------------------------ Seiten
function seiteStart() {
  const gast = lab.participant?.group.kind === 'event';
  const schonBegonnen = lab.getProgress().completed > 0;
  return h('section', { class: 'karte start' },
    h('h1', { text: gast ? 'Willkommen beim Tag der offenen Tür!' : 'Hallo, Physik-Entdeckerin und Physik-Entdecker!' }),
    h('p', { class: 'gross-text', text: 'Hier machst du zwei Experimente. Du überlegst zuerst, was passiert. Dann probierst du es aus. Am Ende bekommst du eine Urkunde.' }),
    h('div', { class: 'bereiche' },
      h('div', { class: 'bereich-karte mechanik' }, h('strong', { text: 'Bewegung' }), h('span', { text: 'Die rollende Kugel' })),
      h('div', { class: 'bereich-karte strom' }, h('strong', { text: 'Strom' }), h('span', { text: 'Bring die Lampe zum Leuchten!' }))),
    h('p', { class: 'klein', text: 'Deine Antworten werden automatisch gespeichert. Du kannst jederzeit aufhören und später mit deinem Code weitermachen.' }),
    h('div', { class: 'nav' }, h('span'), h('button', { type: 'button', class: 'knopf haupt gross', onclick: () => gehe(schonBegonnen ? ersterOffenerSchritt() : 1), text: schonBegonnen ? 'Weitermachen' : 'Los geht’s!' })));
}

function seiteM1(st: Schritt) {
  const icons: Record<string, Element> = { flach: miniRampe(RAMPEN.flach.winkelGrad), mittel: miniRampe(RAMPEN.mittel.winkelGrad), steil: miniRampe(RAMPEN.steil.winkelGrad) };
  return h('section', { class: 'karte mechanik' }, bereichsKopf(st),
    h('h1', { text: 'Was glaubst du?' }),
    h('p', { class: 'frage', text: 'Auf welcher Rampe rollt die Kugel am schnellsten nach unten?' }),
    auswahl('m1-vermutung', (v) => { speichere(lab.completeTask('m1-vermutung', { choice: v })); }, icons),
    erledigt('m1-vermutung') ? h('p', { class: 'rueckmeldung neutral', text: 'Danke! Deine Vermutung ist notiert. Jetzt testest du sie im Versuch.' }) : null,
    navigation(erledigt('m1-vermutung')));
}

function seiteM2(st: Schritt) {
  const svg = s('svg', { viewBox: '0 0 420 270', class: 'rampe-svg', role: 'img', 'aria-label': 'Rampe mit Kugel' });
  const stoppuhr = h('div', { class: 'stoppuhr', 'aria-live': 'polite' }, h('span', { text: 'Zeit' }), h('strong', { id: 'uhr', text: '0,0 s' }));
  const rampenKnoepfe = h('div', { class: 'rampen-wahl', role: 'radiogroup', 'aria-label': 'Rampe wählen' });
  (Object.keys(RAMPEN) as Rampe[]).forEach((r) => {
    const getestet = rampenSim.laeufe.some((l) => l.rampe === r);
    rampenKnoepfe.append(h('button', {
      type: 'button', role: 'radio', 'aria-checked': String(rampenSim.gewaehlt === r), class: `rampe-knopf${rampenSim.gewaehlt === r ? ' gewaehlt' : ''}`,
      onclick: () => { if (rampenSim.laeuft) return; rampenSim.gewaehlt = r; rampenSim.amZiel = null; render(); },
    }, miniRampe(RAMPEN[r].winkelGrad), h('span', { text: r === 'flach' ? 'Flach' : r === 'mittel' ? 'Mittel' : 'Steil' }), getestet ? h('span', { class: 'haken', 'aria-label': 'getestet', text: '✓' }) : null));
  });
  const start = h('button', { type: 'button', id: 'kugel-start', class: 'knopf haupt gross', text: 'Kugel starten', onclick: () => starteKugel(svg) });
  const zeitlupe = h('label', { class: 'schalter-zeile' },
    h('input', { type: 'checkbox', checked: rampenSim.zeitlupe, onchange: (e: Event) => { rampenSim.zeitlupe = (e.target as HTMLInputElement).checked; } }),
    h('span', { text: 'Zeitlupe (langsamer zeigen)' }));
  const amZiel = rampenSim.amZiel === rampenSim.gewaehlt;
  zeichneRampe(svg, rampenSim.gewaehlt, amZiel ? 2.0 : 0);
  if (amZiel) (stoppuhr.querySelector('#uhr') as HTMLElement).textContent = `${zahl(rollzeit(RAMPEN[rampenSim.gewaehlt].winkelGrad))} s`;

  const getestet = new Set(rampenSim.laeufe.map((l) => l.rampe));
  const tabelle = h('table', { class: 'messwerte' },
    h('caption', { text: 'Deine Messwerte' }),
    h('thead', {}, h('tr', {}, h('th', { scope: 'col', text: 'Rampe' }), h('th', { scope: 'col', text: 'Zeit bis unten' }), h('th', { scope: 'col', text: 'Tempo unten' }))),
    h('tbody', {}, ...(Object.keys(RAMPEN) as Rampe[]).map((r) => {
      const l = [...rampenSim.laeufe].reverse().find((x) => x.rampe === r);
      const maxTempo = endgeschwindigkeit(RAMPEN.steil.winkelGrad);
      return h('tr', {}, h('th', { scope: 'row', text: RAMPEN[r].name }),
        h('td', { text: l ? `${zahl(l.zeit_s)} s` : 'noch nicht getestet' }),
        h('td', {}, l ? h('span', { class: 'tempo' }, h('span', { class: 'tempo-balken', style: `width:${Math.round((100 * l.tempo_unten_m_s) / maxTempo)}%` }), h('span', { class: 'vh', text: `${zahl(l.tempo_unten_m_s)} Meter pro Sekunde` })) : '–'));
    })));

  return h('section', { class: 'karte mechanik' }, bereichsKopf(st),
    h('h1', { text: 'Probiere es aus!' }),
    h('p', { class: 'frage', text: 'Wähle eine Rampe und starte die Kugel. Teste alle drei Rampen.' }),
    h('div', { class: 'sim' }, h('div', { class: 'sim-buehne' }, svg, stoppuhr),
      h('div', { class: 'sim-steuer' }, rampenKnoepfe, start, zeitlupe)),
    h('p', { class: `aufgaben-hinweis${getestet.size === 3 ? ' ok' : ''}`, text: getestet.size === 3 ? 'Super, du hast alle drei Rampen getestet!' : `Getestet: ${getestet.size} von 3 Rampen` }),
    tabelle,
    h('details', { class: 'modell' }, h('summary', { text: 'Für Erwachsene: So rechnet die Simulation' }),
      h('p', { text: `Vollkugel rollt ohne Rutschen auf einem ${zahl(2, 0)} m langen Brett: a = 5/7 · g · sin α, Reibung und Luftwiderstand werden vernachlässigt. Winkel: flach 10°, mittel 20°, steil 35°.` })),
    navigation(erledigt('m2-versuch')));
}

function zeichneRampe(svg: SVGElement, r: Rampe, sMeter: number) {
  svg.replaceChildren();
  const winkel = (RAMPEN[r].winkelGrad * Math.PI) / 180;
  const boden = 236, x1 = 360, Lpx = 300, rad = 14;
  const x0 = x1 - Lpx * Math.cos(winkel), y0 = boden - Lpx * Math.sin(winkel);
  svg.append(
    s('rect', { x: 0, y: boden, width: 420, height: 34, fill: 'var(--boden)' }),
    s('line', { x1: 0, y1: boden, x2: 420, y2: boden, stroke: 'var(--linie)', 'stroke-width': 2 }));
  // Bücherstapel unter dem oberen Ende
  const hoeheStapel = boden - y0;
  const n = RAMPEN[r].buecher;
  const farben = ['#d9480f', '#2b8a3e', '#1c7ed6', '#ae3ec9'];
  for (let i = 0; i < n; i++) {
    const hb = hoeheStapel / n;
    svg.append(s('rect', { x: x0 - 28, y: boden - (i + 1) * hb, width: 56, height: hb - 2, rx: 4, fill: farben[i % farben.length], opacity: 0.85 }));
  }
  svg.append(
    s('polygon', { points: `${x0},${boden} ${x0},${y0} ${x1},${boden}`, fill: 'var(--mech-hell)', opacity: 0.5 }),
    s('line', { x1: x0, y1: y0, x2: x1, y2: boden, stroke: 'var(--brett)', 'stroke-width': 10, 'stroke-linecap': 'round' }),
    s('line', { x1: x1 + 22, y1: boden, x2: x1 + 22, y2: boden - 60, stroke: 'var(--linie)', 'stroke-width': 3 }),
    s('polygon', { points: `${x1 + 22},${boden - 60} ${x1 + 52},${boden - 50} ${x1 + 22},${boden - 40}`, fill: 'var(--mech)' }),
    s('text', { x: x1 + 26, y: boden - 66, 'font-size': 14, fill: 'var(--tinte)', 'font-weight': 700 }, 'Ziel'));
  // Kugel
  const sPx = (sMeter / 2.0) * Lpx;
  const cx = x0 + sPx * Math.cos(winkel) + rad * Math.sin(winkel) + 6 * Math.cos(winkel);
  const cy = y0 + sPx * Math.sin(winkel) - rad * Math.cos(winkel) + 6 * Math.sin(winkel);
  const drehung = ((sPx / rad) * 180) / Math.PI;
  svg.append(s('g', { transform: `translate(${cx.toFixed(2)} ${cy.toFixed(2)}) rotate(${drehung.toFixed(1)})` },
    s('circle', { r: rad, fill: 'var(--kugel)', stroke: '#7c2d12', 'stroke-width': 2 }),
    s('path', { d: `M${-rad} 0 A${rad} ${rad} 0 0 0 ${rad} 0`, fill: '#fff', opacity: 0.35 }),
    s('circle', { cx: -4, cy: -5, r: 3, fill: '#fff', opacity: 0.8 })));
}

function starteKugel(svg: SVGElement) {
  if (rampenSim.laeuft) return;
  const r = rampenSim.gewaehlt;
  const w = RAMPEN[r].winkelGrad;
  const T = rollzeit(w);
  const faktor = rampenSim.zeitlupe ? 3 : 1;
  rampenSim.laeuft = true;
  document.querySelectorAll<HTMLButtonElement>('.rampe-knopf, #kugel-start, .punkt, .nav button').forEach((b) => (b.disabled = true));
  const uhr = $('uhr');
  const t0 = performance.now();
  const schritt = (jetzt: number) => {
    const t = Math.min(T, (jetzt - t0) / 1000 / faktor);
    zeichneRampe(svg, r, weg(w, t));
    uhr.textContent = `${zahl(t)} s`;
    if (t < T) { rampenSim.anim = requestAnimationFrame(schritt); return; }
    rampenSim.laeuft = false;
    rampenSim.amZiel = r;
    const lauf: Lauf = { rampe: r, winkel_grad: w, zeit_s: Math.round(T * 100) / 100, tempo_unten_m_s: Math.round(endgeschwindigkeit(w) * 100) / 100 };
    rampenSim.laeufe = [...rampenSim.laeufe, lauf].slice(-12);
    const alle = new Set(rampenSim.laeufe.map((l) => l.rampe)).size === 3;
    const data = { laeufe: rampenSim.laeufe as unknown as JsonObject[] } as unknown as JsonObject;
    $('ansage').textContent = `Die Kugel ist unten. Zeit auf der ${RAMPEN[r].name}: ${zahl(T)} Sekunden.`;
    render();
    if (alle) speichere(lab.completeTask('m2-versuch', { getestete_rampen: 3 }, data));
    else speichere(lab.saveAnswer('m2-versuch', { getestete_rampen: new Set(rampenSim.laeufe.map((l) => l.rampe)).size }, { data }));
  };
  rampenSim.anim = requestAnimationFrame(schritt);
}

function hypotheseVergleich(vermutungId: string, auswertungRichtig: string, text: (v: string) => string) {
  const v = (lab.getResult(vermutungId)?.answer as any)?.choice as string | undefined;
  if (!v) return null;
  return h('p', { class: 'vergleich', text: v === auswertungRichtig ? `Deine Vermutung war: „${optionText(vermutungId, v)}“. Du hattest recht – stark!` : text(v) });
}

function seiteM3(st: Schritt) {
  const r = lab.getResult('m3-auswertung');
  const wahl = (r?.answer as any)?.choice as string | undefined;
  const versuche = Number((r?.answer as any)?.versuche) || 0;
  let rueck: HTMLElement | null = null;
  if (wahl === 'steil') {
    rueck = h('div', { class: 'rueckmeldung gut' },
      h('strong', { text: 'Genau richtig beobachtet!' }),
      h('p', { text: 'Auf der steilen Rampe war die Kugel am schnellsten unten. Die Erde zieht alles nach unten. Je steiler die Rampe ist, desto mehr hilft dieser Zug der Kugel beim Rollen – sie wird immer schneller.' }),
      hypotheseVergleich('m1-vermutung', 'steil', (v) => `Du hattest „${optionText('m1-vermutung', v)}“ vermutet. Das Experiment hat etwas anderes gezeigt. Genau so arbeiten Forscherinnen und Forscher: vermuten, ausprobieren, dazulernen!`));
  } else if (wahl) {
    rueck = h('div', { class: 'rueckmeldung tipp' },
      h('strong', { text: 'Schau noch einmal genau hin!' }),
      h('p', { text: 'Sieh dir deine Messwerte an: Auf welcher Rampe war die Zeit am kürzesten? Du kannst noch einmal wählen.' }),
      h('button', { type: 'button', class: 'knopf zweit', text: 'Zurück zum Versuch', onclick: () => gehe(2) }));
  }
  return h('section', { class: 'karte mechanik' }, bereichsKopf(st),
    h('h1', { text: 'Was hast du beobachtet?' }),
    h('p', { class: 'frage', text: 'Kreuze an, was im Versuch passiert ist.' }),
    auswahl('m3-auswertung', (v) => { speichere(lab.completeTask('m3-auswertung', { choice: v, versuche: versuche + 1 })); }),
    rueck,
    navigation(erledigt('m3-auswertung'), 'Weiter zum Strom'));
}

function seiteE1(st: Schritt) {
  return h('section', { class: 'karte strom' }, bereichsKopf(st),
    h('h1', { text: 'Was glaubst du?' }),
    h('p', { class: 'frage', text: 'Was braucht die Lampe, damit sie leuchtet?' }),
    auswahl('e1-vermutung', (v) => { speichere(lab.completeTask('e1-vermutung', { choice: v })); }),
    erledigt('e1-vermutung') ? h('p', { class: 'rueckmeldung neutral', text: 'Danke! Jetzt baust du den Stromkreis selbst.' }) : null,
    navigation(erledigt('e1-vermutung')));
}

function kreisSvg(): SVGElement {
  const an = leuchtet(kreis);
  const svg = s('svg', { viewBox: '0 0 400 300', class: `kreis-svg${an ? ' an' : ''}`, role: 'img', 'aria-label': an ? 'Stromkreis: Die Lampe leuchtet.' : 'Stromkreis: Die Lampe ist aus.' });
  const draht = (d: string, verbunden: boolean, id: string) => s('path', { d, class: `draht${verbunden ? '' : ' lose'}`, 'data-teil': id });
  // Lichtschein
  if (an) svg.append(s('circle', { cx: 200, cy: 62, r: 58, class: 'schein' }));
  // Drähte (Kabel 1: Batterie + → Lampe links; Kabel 2: Lampe rechts → Schalter; fest: Schalter → Batterie −)
  svg.append(
    draht(kreis.kabel1 ? 'M70 120 V60 H170' : 'M70 120 V75 Q75 52 120 60', kreis.kabel1, 'kabel1'),
    draht(kreis.kabel2 ? 'M230 60 H330 V240 H250' : 'M230 60 H300 Q340 70 330 140', kreis.kabel2, 'kabel2'),
    draht('M150 240 H70 V180', true, 'fest'));
  if (an) svg.append(s('path', { d: 'M70 180 V60 H330 V240 H70 Z', class: 'fluss' }));
  // Stecker-Markierungen bei losen Kabeln
  if (!kreis.kabel1) svg.append(s('circle', { cx: 170, cy: 60, r: 7, class: 'buchse' }), s('text', { x: 108, y: 44, class: 'beschriftung' }, 'Kabel 1 lose'));
  if (!kreis.kabel2) svg.append(s('circle', { cx: 330, cy: 240, r: 7, class: 'buchse' }), s('text', { x: 300, y: 172, class: 'beschriftung' }, 'Kabel 2 lose'));
  // Batterie
  svg.append(s('g', { class: 'batterie' },
    s('rect', { x: 46, y: 120, width: 48, height: 64, rx: 8, fill: 'var(--batterie)' }),
    s('rect', { x: 46, y: 120, width: 48, height: 22, rx: 8, fill: 'var(--batterie-kopf)' }),
    s('rect', { x: 62, y: 112, width: 16, height: 10, rx: 2, fill: '#555' }),
    s('text', { x: 70, y: 137, 'text-anchor': 'middle', class: 'pol' }, '+'),
    s('text', { x: 70, y: 176, 'text-anchor': 'middle', class: 'pol' }, '−'),
    s('text', { x: 102, y: 158, class: 'beschriftung' }, 'Batterie')));
  // Lampe
  svg.append(s('g', { class: 'lampe' },
    s('rect', { x: 170, y: 54, width: 60, height: 14, rx: 3, fill: '#9aa5b1' }),
    s('circle', { cx: 200, cy: 40, r: 26, class: 'glas' }),
    s('path', { d: 'M190 54 L194 38 L198 46 L202 34 L206 46 L210 38 L214 54', class: 'faden' }),
    s('text', { x: 200, y: 96, 'text-anchor': 'middle', class: 'beschriftung' }, 'Lampe')));
  // Schalter
  const hebel = kreis.schalterZu ? 'M150 240 L250 240' : 'M150 240 L240 205';
  svg.append(s('g', { class: 'schalter', 'data-teil': 'schalter' },
    s('circle', { cx: 150, cy: 240, r: 8, class: 'kontakt' }),
    s('circle', { cx: 250, cy: 240, r: 8, class: 'kontakt' }),
    s('path', { d: hebel, class: 'hebel' }),
    s('text', { x: 200, y: 280, 'text-anchor': 'middle', class: 'beschriftung' }, kreis.schalterZu ? 'Schalter: zu' : 'Schalter: offen')));
  return svg;
}

function kreisAenderung(aenderung: Partial<Kreis>) {
  const vorher = leuchtet(kreis);
  Object.assign(kreis, aenderung);
  const nachher = leuchtet(kreis);
  kreis.versuche = [...kreis.versuche, { schalter: kreis.schalterZu ? 'zu' : 'offen', kabel1: kreis.kabel1, kabel2: kreis.kabel2, leuchtet: nachher }].slice(-12);
  if (!vorher && nachher) { kreis.anZaehler++; kreis.warAn = true; }
  if (vorher && !nachher) kreis.ausZaehler++;
  const fertig = kreis.anZaehler >= 1 && kreis.ausZaehler >= 1;
  const data = { an: kreis.anZaehler, aus: kreis.ausZaehler, probiert: kreis.versuche } as unknown as JsonObject;
  const l = luecken(kreis);
  $('ansage').textContent = nachher ? 'Die Lampe leuchtet!' : `Die Lampe ist aus, weil ${l.join(' und ')}.`;
  render();
  if (vorher !== nachher || fertig !== erledigt('e2-versuch')) {
    if (fertig) speichere(lab.completeTask('e2-versuch', { lampe_an_gesehen: true, lampe_aus_gesehen: true }, data));
    else speichere(lab.saveAnswer('e2-versuch', { lampe_an_gesehen: kreis.anZaehler > 0, lampe_aus_gesehen: kreis.ausZaehler > 0 }, { data }));
  }
}

function seiteE2(st: Schritt) {
  const an = leuchtet(kreis);
  const l = luecken(kreis);
  const fertig = kreis.anZaehler >= 1 && kreis.ausZaehler >= 1;
  const ziel = kreis.anZaehler === 0 ? 'Schaffst du es, dass die Lampe leuchtet?' : kreis.ausZaehler === 0 ? 'Super! Und jetzt: Mach die Lampe wieder aus.' : 'Prima! Probiere ruhig noch mehr aus.';
  return h('section', { class: 'karte strom' }, bereichsKopf(st),
    h('h1', { text: 'Bring die Lampe zum Leuchten!' }),
    h('p', { class: 'frage', text: ziel }),
    h('div', { class: 'sim' },
      h('div', { class: 'sim-buehne strom-buehne' }, kreisSvg(),
        h('p', { class: `lampen-status${an ? ' an' : ''}`, text: an ? 'Die Lampe leuchtet!' : `Die Lampe ist aus: ${l.join(', ')}.` })),
      h('div', { class: 'sim-steuer' },
        h('button', { type: 'button', class: `knopf schalt${kreis.schalterZu ? ' aktiv' : ''}`, 'aria-pressed': String(kreis.schalterZu), onclick: () => kreisAenderung({ schalterZu: !kreis.schalterZu }), text: kreis.schalterZu ? 'Schalter öffnen' : 'Schalter schließen' }),
        h('button', { type: 'button', class: `knopf schalt${kreis.kabel1 ? ' aktiv' : ''}`, 'aria-pressed': String(kreis.kabel1), onclick: () => kreisAenderung({ kabel1: !kreis.kabel1 }), text: kreis.kabel1 ? 'Kabel 1 abziehen' : 'Kabel 1 anstecken' }),
        h('button', { type: 'button', class: `knopf schalt${kreis.kabel2 ? ' aktiv' : ''}`, 'aria-pressed': String(kreis.kabel2), onclick: () => kreisAenderung({ kabel2: !kreis.kabel2 }), text: kreis.kabel2 ? 'Kabel 2 abziehen' : 'Kabel 2 anstecken' }))),
    h('p', { class: `aufgaben-hinweis${fertig ? ' ok' : ''}`, text: fertig ? 'Klasse! Du hast die Lampe an- und wieder ausgemacht.' : `Lampe an: ${kreis.anZaehler > 0 ? '✓' : '–'}   ·   Lampe wieder aus: ${kreis.ausZaehler > 0 ? '✓' : '–'}` }),
    navigation(erledigt('e2-versuch')));
}

function seiteE3(st: Schritt) {
  const r = lab.getResult('e3-auswertung');
  const wahl = (r?.answer as any)?.choice as string | undefined;
  const versuche = Number((r?.answer as any)?.versuche) || 0;
  let rueck: HTMLElement | null = null;
  if (wahl === 'kreis') {
    rueck = h('div', { class: 'rueckmeldung gut' },
      h('strong', { text: 'Richtig erkannt!' }),
      h('p', { text: 'Der Strom braucht einen Weg rundherum: von der Batterie durch das Kabel zur Lampe, weiter zum Schalter und zurück zur Batterie. Ist irgendwo eine Lücke – ein offener Schalter oder ein loses Kabel –, bleibt die Lampe dunkel. Diesen geschlossenen Weg nennt man Stromkreis.' }),
      hypotheseVergleich('e1-vermutung', 'kreis', (v) => `Du hattest „${optionText('e1-vermutung', v)}“ vermutet. Jetzt weißt du mehr – so funktioniert Forschen!`));
  } else if (wahl) {
    rueck = h('div', { class: 'rueckmeldung tipp' },
      h('strong', { text: 'Gute Idee – aber schau noch einmal!' }),
      h('p', { text: 'Wann ging die Lampe aus? Immer dann, wenn der Schalter offen war oder ein Kabel lose war. Du kannst noch einmal wählen.' }),
      h('button', { type: 'button', class: 'knopf zweit', text: 'Zurück zum Versuch', onclick: () => gehe(5) }));
  }
  return h('section', { class: 'karte strom' }, bereichsKopf(st),
    h('h1', { text: 'Warum leuchtet die Lampe nur manchmal?' }),
    h('p', { class: 'frage', text: 'Wähle die beste Erklärung.' }),
    auswahl('e3-auswertung', (v) => { speichere(lab.completeTask('e3-auswertung', { choice: v, versuche: versuche + 1 })); }),
    rueck,
    navigation(erledigt('e3-auswertung'), 'Zur Urkunde'));
}

function seiteEnde() {
  const nameFeld = h('input', { type: 'text', id: 'urkunde-name', maxlength: 40, autocomplete: 'off', placeholder: 'z. B. Lea', 'aria-describedby': 'name-hinweis' }) as HTMLInputElement;
  const urkundeName = h('p', { class: 'urkunde-name', text: ' ' });
  nameFeld.addEventListener('input', () => { urkundeName.textContent = nameFeld.value.trim() || ' '; });
  const datum = new Date().toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });
  const zusammenfassung = h('ul', { class: 'zusammenfassung' },
    ...AUFGABEN.map((a) => {
      const r = lab.getResult(a.id);
      const c = (r?.answer as any)?.choice as string | undefined;
      const wert = c ? optionText(a.id, c) : a.id === 'm2-versuch' ? `${new Set(rampenSim.laeufe.map((l) => l.rampe)).size} Rampen getestet` : a.id === 'e2-versuch' ? `Lampe ${kreis.anZaehler}× an, ${kreis.ausZaehler}× aus` : '–';
      return h('li', {}, h('strong', { text: `${a.nr}. ${manifest.tasks.find((t) => t.task_id === a.id)?.title.split(':')[0]}: ` }), wert);
    }));
  return h('section', { class: 'karte ende' },
    h('h1', { class: 'jubel', text: 'Super! Du bist jetzt ein Physik-Entdecker!' }),
    h('p', { class: 'gross-text', text: 'Du hast alle sechs Aufgaben geschafft. Ob alles beim Server angekommen ist, siehst du unten an der Speicheranzeige.' }),
    h('div', { class: 'urkunde', id: 'urkunde', role: 'img', 'aria-label': 'Urkunde Physik-Entdecker' },
      h('div', { class: 'siegel', 'aria-hidden': 'true', text: '★' }),
      h('p', { class: 'urkunde-titel', text: 'Urkunde' }),
      h('p', { text: 'Diese Urkunde bekommt' }),
      urkundeName,
      h('p', { text: 'für das erfolgreiche Erforschen von' }),
      h('p', { class: 'urkunde-thema', text: 'Bewegung und Strom' }),
      h('p', { class: 'urkunde-klein', text: `Physik-Entdecker-Labor · ${datum}` })),
    h('div', { class: 'feld' }, h('label', { for: 'urkunde-name', text: 'Dein Vorname für die Urkunde (freiwillig)' }), nameFeld,
      h('p', { id: 'name-hinweis', class: 'klein', text: 'Der Name erscheint nur auf dem Ausdruck. Er wird nirgends gespeichert oder gesendet.' })),
    h('div', { class: 'nav' },
      h('button', { type: 'button', class: 'knopf zweit', text: 'Zurück', onclick: () => gehe(aktuell - 1) }),
      h('button', { type: 'button', class: 'knopf haupt', text: 'Urkunde drucken', onclick: () => window.print() })),
    h('details', { class: 'modell' }, h('summary', { text: 'Meine Antworten ansehen' }), zusammenfassung));
}

// ------------------------------------------------------------------ Darstellung
function render() {
  const st = SCHRITTE[aktuell];
  $('app').dataset.bereich = st.bereich;
  const inhalt = $('inhalt');
  let seite: HTMLElement;
  switch (st.id) {
    case 'start': seite = seiteStart(); break;
    case 'm1-vermutung': seite = seiteM1(st); break;
    case 'm2-versuch': seite = seiteM2(st); break;
    case 'm3-auswertung': seite = seiteM3(st); break;
    case 'e1-vermutung': seite = seiteE1(st); break;
    case 'e2-versuch': seite = seiteE2(st); break;
    case 'e3-auswertung': seite = seiteE3(st); break;
    default: seite = seiteEnde();
  }
  inhalt.replaceChildren(seite);
  zeigeFortschritt();
}

// ------------------------------------------------------------------ Start
async function start() {
  lab = await initializeLab({
    labId: manifest.id,
    labVersion: manifest.version,
    manifest,
    ui: { statusTarget: $('speicherstatus'), sessionTarget: $('sitzung'), welcomeTitle: 'Willkommen im Lernlabor!' },
  });
  ladeSimZustand();
  const resume = String(lab.getResumeState().schritt ?? '');
  const ri = SCHRITTE.findIndex((x) => x.id === resume);
  aktuell = ri > 0 && erreichbar(ri) ? ri : lab.getProgress().completed > 0 ? ersterOffenerSchritt() : 0;
  if (lab.getProgress().completed > 0 && aktuell !== SCHRITTE.length - 1) toast('Willkommen zurück! Dein Lernstand wurde geladen.');
  lab.on('conflict', () => { ladeSimZustand(); render(); toast('Auf einem anderen Gerät wurde weitergearbeitet. Der neuere Stand wurde übernommen.'); });
  lab.on('save-error', (e: any) => toast(e.message));
  lab.on('progress', () => zeigeFortschritt());
  $('app').removeAttribute('aria-busy');
  render();
}

start().catch((e) => {
  console.error(e);
  $('inhalt').replaceChildren(h('section', { class: 'karte' }, h('h1', { text: 'Das Lernlabor konnte nicht starten.' }), h('p', { text: 'Bitte lade die Seite neu oder sag deiner Lehrkraft Bescheid.' })));
});
