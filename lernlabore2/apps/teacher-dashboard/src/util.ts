// Hilfsfunktionen für das Dashboard. Alle Inhalte werden als Text eingefügt (Schutz vor XSS).
import qrcode from 'qrcode-generator';

type Child = Node | string | number | null | undefined | false;
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, any> = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = String(v);
    else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children) if (c !== null && c !== undefined && c !== false) e.append(typeof c === 'number' ? String(c) : c);
  return e;
}

const SVGNS = 'http://www.w3.org/2000/svg';
export function s(tag: string, attrs: Record<string, any> = {}): SVGElement {
  const e = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  return e;
}

export function relativeTime(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return '–';
  const diff = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (diff < 45) return 'gerade eben';
  if (diff < 90) return 'vor 1 Minute';
  if (diff < 3600) return `vor ${Math.round(diff / 60)} Minuten`;
  if (diff < 7200) return 'vor 1 Stunde';
  if (diff < 86400) return `vor ${Math.round(diff / 3600)} Stunden`;
  return new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function dateTime(iso: string | null | undefined): string {
  if (!iso) return '–';
  return new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function progressBar(percent: number, label?: string) {
  const p = Math.max(0, Math.min(100, Math.round(percent)));
  return h('div', { class: 'fbalken', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': p, 'aria-label': label ?? 'Fortschritt' },
    h('div', { class: 'fbalken-fuellung', style: { width: `${p}%` } }),
    h('span', { class: 'fbalken-text', text: `${p} %` }));
}

/** CSV mit Semikolon und BOM (öffnet in deutschem Excel korrekt), Schutz vor Formel-Injektion. */
export function toCsv(rows: (string | number | boolean | null | undefined)[][]): string {
  const cell = (v: unknown) => {
    let t = v === null || v === undefined ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`;
    return /[";\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  return '﻿' + rows.map((r) => r.map(cell).join(';')).join('\r\n');
}

export function download(filename: string, content: string, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = h('a', { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** QR-Code als SVG-Element (ohne innerHTML). */
export function qrSvg(text: string, sizePx = 120): SVGElement {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  const m = 2;
  const svg = s('svg', { viewBox: `0 0 ${n + 2 * m} ${n + 2 * m}`, width: sizePx, height: sizePx, 'shape-rendering': 'crispEdges', role: 'img', 'aria-label': 'QR-Code' });
  svg.append(s('rect', { width: n + 2 * m, height: n + 2 * m, fill: '#fff' }));
  let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c + m} ${r + m}h1v1h-1z`;
  svg.append(s('path', { d, fill: '#000' }));
  return svg;
}

export function labelForOption(options: { value: string; label: string }[] | undefined, v: unknown): string {
  if (typeof v !== 'string') return '';
  return options?.find((o) => o.value === v)?.label ?? v;
}

/** Kurze, gut lesbare Darstellung beliebiger Antwort-/Messdaten. */
export function describeData(data: Record<string, any> | null | undefined): string {
  if (!data || typeof data !== 'object') return '';
  if (Array.isArray(data.laeufe)) {
    return data.laeufe.map((l: any) => `${l.rampe}: ${Number(l.zeit_s).toLocaleString('de-DE')} s`).join(' · ');
  }
  if ('an' in data && 'aus' in data) return `Lampe ${data.an}× an, ${data.aus}× aus`;
  return Object.entries(data).filter(([k]) => k !== 'probiert').map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join(', ');
}
