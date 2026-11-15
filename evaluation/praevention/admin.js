'use strict';
// Geschützter Auswertungsbereich für die Abteilungsleitung.
(() => {
  const main = document.getElementById('inhalt');
  // GitHub-Pages-Version: Daten kommen aus eingefügten Antwort-Codes im Browser (pages-quelle/lokal.js)
  const LOKAL = window.EVAL_LOKAL || null;
  const REITER_KEY = 'praevention-admin-reiter';
  let daten = null;
  let reiter = (() => { try { return localStorage.getItem(REITER_KEY) || 'uebersicht'; } catch { return 'uebersicht'; } })();

  function el(tag, attr = {}, ...kinder) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attr)) {
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'style') e.style.cssText = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    }
    for (const k of kinder.flat()) if (k != null && k !== false) e.append(k.nodeType ? k : document.createTextNode(String(k)));
    return e;
  }
  const pct = (x) => (x == null ? '–' : `${Math.round(x)} %`);
  async function api(pfad, opt = {}) {
    const r = await fetch(pfad, { ...opt, headers: { 'Content-Type': 'application/json', 'X-Evaluation': '1', ...(opt.headers || {}) }, credentials: 'same-origin' });
    const d = await r.json().catch(() => ({}));
    if (r.status === 401 && pfad !== '/api/admin/anmelden') { zeigeLogin(); throw new Error('abgemeldet'); }
    if (!r.ok) throw new Error(d.fehler || 'Fehler');
    return d;
  }

  // ---------- Login
  function zeigeLogin(hinweis) {
    const meldung = el('div', { class: 'meldung fehler', role: 'alert' }, hinweis || '');
    const pw = el('input', { type: 'password', id: 'pw', autocomplete: 'current-password', required: true });
    const knopf = el('button', { class: 'knopf', type: 'submit' }, 'Anmelden');
    const form = el('form', { class: 'karte login', onsubmit: async (e) => {
      e.preventDefault(); knopf.disabled = true; meldung.textContent = '';
      try {
        await api('/api/admin/anmelden', { method: 'POST', body: JSON.stringify({ passwort: pw.value }) });
        laden();
      } catch (err) { meldung.textContent = err.message; knopf.disabled = false; pw.select(); }
    } },
      el('h1', {}, 'Anmeldung'),
      el('p', { class: 'leise' }, 'Dieser Bereich ist nur für die Abteilungsleitung (WIDE, BL Abt. II) bestimmt.'),
      el('label', { for: 'pw', style: 'font-weight:600;display:block;margin-bottom:6px' }, 'Passwort'), pw,
      el('div', { style: 'margin-top:14px' }, knopf), meldung);
    main.replaceChildren(form); pw.focus();
  }

  async function laden() {
    if (LOKAL) {
      try { daten = await LOKAL.laden(); zeichne(); }
      catch (err) { main.replaceChildren(el('div', { class: 'karte hinweisbox fehler' }, err.message)); }
      return;
    }
    try { daten = await api('/api/admin/auswertung'); zeichne(); }
    catch (err) { if (err.message !== 'abgemeldet') main.replaceChildren(el('div', { class: 'karte hinweisbox fehler' }, err.message)); }
  }

  // ---------- Bausteine
  function diagramm(f) {
    return el('div', { class: 'diagramm', role: 'list' }, f.optionen.map((o) => el('div', { class: 'balken-zeile' + (o.neutral ? ' neutral' : ''), role: 'listitem' },
      el('span', { class: 'bez' }, o.t),
      el('div', { class: 'balken-spur', 'aria-hidden': 'true' }, el('div', { style: `width:${o.prozent ? Math.max(o.prozent, 1) : 0}%` })),
      el('span', { class: 'zahl' }, `${o.anzahl} · ${pct(o.prozent)}`))));
  }
  function frageKarte(f) {
    return el('div', { class: 'karte frage-karte' + (f.entscheidend ? ' wichtig' : '') },
      el('h3', {}, `${f.nr}. ${f.text}`, f.entscheidend ? el('span', { class: 'marke-wichtig' }, 'entscheidungsrelevant') : null),
      diagramm(f),
      el('p', { class: 'klein leise', style: 'margin-top:8px' },
        `Gültige Antworten: ${f.gueltig}`, f.neutral || f.optionen.some((o) => o.neutral) ? ` · „nicht beurteilbar“: ${f.neutral} (${pct(f.neutralProzent)} aller Antworten, nicht in den Prozentwerten enthalten)` : '',
        f.ohneAngabe ? ` · ohne Angabe: ${f.ohneAngabe}` : ''));
  }
  function zitate(liste) {
    if (!liste.length) return el('p', { class: 'leise' }, 'Keine Rückmeldungen.');
    return el('div', {}, liste.map((t) => el('div', { class: 'zitat' }, t)));
  }
  function themenBlock(themen, titel) {
    return el('div', { class: 'hinweisbox blau' },
      el('strong', {}, titel || 'Automatische Stichwortbündelung'),
      el('p', { class: 'klein', style: 'margin:4px 0 8px' }, 'Automatisch erstellt: Rückmeldungen werden anhand fester Stichwörter Themen zugeordnet. Die Zuordnung sagt nur, dass ein Thema angesprochen wird – nicht, ob positiv oder kritisch. Maßgeblich sind die wörtlichen Aussagen.'),
      themen.length ? themen.map((t) => el('details', { class: 'thema' },
        el('summary', {}, `${t.titel} – ${t.anzahl} Nennung(en)`),
        t.treffer.map((x) => el('div', { class: 'zitat klein' }, `(Frage ${x.frage}) ${x.text}`)))) : el('p', { class: 'klein leise' }, 'Keine Themen erkannt.'));
  }

  // ---------- Reiter
  function uebersicht(a, e) {
    const empf = a.entscheidung;
    return el('div', {},
      el('div', { class: 'raster' },
        el('div', { class: 'kennzahl' }, el('div', { class: 'wert' }, String(a.n)), el('div', { class: 'bez' }, LOKAL && !LOKAL.reiterName ? 'eingelesene Antwort-Codes' : 'eingegangene Evaluationen')),
        el('div', { class: 'kennzahl' }, el('div', { class: 'wert' }, a.erwartet ? pct(a.quote) : '–'), el('div', { class: 'bez' }, a.erwartet ? `Rücklaufquote (erwartet: ${a.erwartet})` : `Rücklaufquote – erwartete Anzahl unter „${LOKAL ? (LOKAL.reiterName || 'Codes & Export') : 'Verwaltung'}“ eintragen`)),
        el('div', { class: 'kennzahl' }, el('div', { class: 'wert' }, el('span', { class: 'status-punkt' + (e.offen ? '' : ' zu') }), e.offen ? 'offen' : 'geschlossen'), el('div', { class: 'bez' }, 'Status der Evaluation')),
        el('div', { class: 'kennzahl' }, el('div', { class: 'wert' }, pct(a.q.q12.positiv)), el('div', { class: 'bez' }, 'befürworten eine dauerhafte Etablierung'))),
      el('div', { class: 'karte' },
        el('div', { class: 'empfehlung' },
          el('div', { class: 'klein leise' }, `Automatisch ermittelte, vorläufige Einschätzung (Regel ${empf.regel})`),
          el('div', { class: 'titel' }, empf.titel),
          el('p', { class: 'klein', style: 'margin:0' }, 'Die Einschätzung folgt offen gelegten Regeln (Reiter „Entscheidungsregeln“). Die endgültige Entscheidung trifft die Abteilungsleitung.')),
        empf.vorbehalte.length ? el('div', { class: 'hinweisbox sand' }, el('strong', {}, 'Vorbehalte'), el('ul', { class: 'liste-kurz' }, empf.vorbehalte.map((v) => el('li', {}, v)))) : null),
      a.n ? el('div', { class: 'karte' }, el('h2', {}, 'Wichtigste Ergebnisse'), el('p', { class: 'klein leise' }, 'Automatisch aus den Zahlen formuliert; Prozentwerte beziehen sich auf gültige Antworten.'),
        el('ul', { class: 'liste-kurz' }, a.kern.map((k) => el('li', {}, k)))) : el('div', { class: 'karte' }, el('p', {}, 'Es sind noch keine Evaluationen eingegangen.')),
      a.klassen.length ? el('div', { class: 'karte' }, el('h3', {}, 'Freiwillig angegebene Klassen'), el('p', {}, a.klassen.join(', ')),
        el('p', { class: 'klein leise' }, 'Nur als Liste; die Angaben werden nicht mit einzelnen Antworten verknüpft angezeigt.')) : null);
  }

  function ergebnisse(a) {
    return el('div', {}, a.bereiche.map((b) => {
      const fr = Object.values(a.q).filter((f) => f.bereich === b.id);
      if (!fr.length) return null;
      return el('section', {}, el('h2', { style: 'margin:22px 0 10px' }, `Bereich ${b.id}: ${b.titel}`), fr.map(frageKarte));
    }));
  }

  function freitexte(a) {
    const t = a.texte;
    const block = (id, extra) => el('div', { class: 'karte' }, el('h3', {}, `${t[id].nr}. ${t[id].text}`),
      el('p', { class: 'klein leise' }, `${t[id].eintraege.length} Rückmeldung(en) – wörtlich, alphabetisch sortiert`), zitate(t[id].eintraege), extra || null);
    return el('div', {},
      el('div', { class: 'karte' }, themenBlock(a.themen.gesamt, 'Wiederkehrende Themen über alle Freitexte')),
      block('q10', a.themen.jugendhilfe.length ? themenBlock(a.themen.jugendhilfe, 'Themen in Frage 10') : null),
      block('q11', a.themen.organisation.length ? themenBlock(a.themen.organisation, 'Themen in Frage 11') : null),
      block('q13'), block('q2_text'), block('q5_text'), block('q14'));
  }

  function regeln(a) {
    const empf = a.entscheidung;
    return el('div', {},
      el('div', { class: 'karte' }, el('h2', {}, 'Offen gelegte Entscheidungsregeln'),
        el('p', { class: 'leise' }, 'Die Regeln werden der Reihe nach geprüft; die erste zutreffende bestimmt die Einschätzung. Es wird kein Mittelwert gebildet.'),
        el('ol', { class: 'liste-kurz' }, a.regeln.map((r) => el('li', {}, r)))),
      el('div', { class: 'karte' }, el('h2', {}, 'Prüfung mit den aktuellen Daten'),
        el('table', { class: 'regeltabelle' }, el('thead', {}, el('tr', {}, el('th', {}, 'Regel'), el('th', {}, 'trifft zu?'), el('th', {}, 'Werte'))),
          el('tbody', {}, empf.geprueft.map((g) => el('tr', {}, el('td', {}, g.regel), el('td', {}, g.erfuellt ? 'ja' : 'nein'), el('td', {}, g.text))))),
        el('p', { style: 'margin-top:12px' }, el('strong', {}, `Ergebnis: ${empf.titel}`))),
      el('div', { class: 'karte' }, el('h3', {}, 'Stichwortliste der Themenbündelung'),
        el('table', { class: 'regeltabelle' }, el('tbody', {}, a.themenListe.map((t) => el('tr', {}, el('td', {}, t.titel), el('td', { class: 'klein', style: 'font-family:ui-monospace,monospace;overflow-wrap:anywhere' }, t.muster)))))));
  }

  function verwaltung(a, e) {
    const meldung = el('div', { class: 'meldung', role: 'status' });
    const ok = (t) => { meldung.className = 'meldung ok'; meldung.textContent = t; };
    const fehler = (t) => { meldung.className = 'meldung fehler'; meldung.textContent = t; };
    const erwartet = el('input', { type: 'number', id: 'erwartet', min: '1', max: '200', value: e.erwartet ?? '' });
    const loeschFeld = el('input', { type: 'text', id: 'loeschen', autocomplete: 'off', placeholder: 'LÖSCHEN' });
    return el('div', {},
      el('div', { class: 'karte' }, el('h2', {}, 'Berichte und Export'),
        el('p', { class: 'leise' }, 'Der PDF-Bericht wird bei jedem Klick neu aus den aktuellen Daten erstellt.'),
        el('div', { class: 'form-zeile' },
          el('a', { class: 'knopf', href: '/api/admin/bericht.pdf' }, 'PDF-Gesamtbericht herunterladen'),
          el('a', { class: 'knopf zweit', href: '/api/admin/rohdaten.csv' }, 'Rohdaten als CSV'),
          el('a', { class: 'knopf zweit', href: '/api/admin/sicherung.json' }, 'Datensicherung (JSON)')),
        el('p', { class: 'klein leise', style: 'margin-top:10px' }, 'Die freiwillige Klassenangabe ist im CSV-Export bewusst nicht enthalten; die Zeilen stehen in zufälliger Reihenfolge.')),
      el('div', { class: 'karte' }, el('h2', {}, 'Einstellungen'),
        el('div', { class: 'form-zeile' },
          el('label', { for: 'erwartet' }, 'Erwartete Anzahl Klassenleitungen', erwartet),
          el('button', { class: 'knopf zweit', type: 'button', onclick: async () => {
            try { await api('/api/admin/einstellungen', { method: 'POST', body: JSON.stringify({ erwartet: erwartet.value }) }); ok('Gespeichert.'); await laden(); } catch (err) { fehler(err.message); }
          } }, 'Speichern')),
        el('hr', { style: 'border:0;border-top:1px solid var(--rand);margin:20px 0' }),
        el('p', {}, el('span', { class: 'status-punkt' + (e.offen ? '' : ' zu') }), e.offen ? 'Die Evaluation ist geöffnet – Abgaben sind möglich.' : 'Die Evaluation ist geschlossen – es werden keine Abgaben angenommen.'),
        el('button', { class: 'knopf' + (e.offen ? ' zweit' : ''), type: 'button', onclick: async () => {
          try { await api('/api/admin/einstellungen', { method: 'POST', body: JSON.stringify({ offen: !e.offen }) }); await laden(); } catch (err) { fehler(err.message); }
        } }, e.offen ? 'Evaluation schließen' : 'Evaluation wieder öffnen')),
      el('div', { class: 'karte' }, el('h2', {}, 'Alle Antworten löschen'),
        el('p', {}, 'Löscht alle eingegangenen Evaluationen endgültig (z. B. nach Abschluss und Archivierung des PDF-Berichts). Dies kann nicht rückgängig gemacht werden. Lade vorher bei Bedarf PDF, CSV oder Datensicherung herunter.'),
        el('div', { class: 'form-zeile' },
          el('label', { for: 'loeschen' }, 'Zur Bestätigung LÖSCHEN eingeben', loeschFeld),
          el('button', { class: 'knopf gefahr', type: 'button', onclick: async () => {
            if (loeschFeld.value !== 'LÖSCHEN') return fehler('Bitte genau LÖSCHEN eingeben.');
            if (!confirm(`Wirklich alle ${a.n} Evaluationen endgültig löschen?`)) return;
            try { await api('/api/admin/loeschen', { method: 'POST', body: JSON.stringify({ bestaetigung: loeschFeld.value }) }); ok('Alle Antworten wurden gelöscht.'); await laden(); } catch (err) { fehler(err.message); }
          } }, 'Endgültig löschen'))),
      meldung,
      el('div', { class: 'karte' }, el('h2', {}, 'Teilnahme-Link'),
        el('p', {}, 'Diesen Link an die Klassenleitungen weitergeben:'),
        el('p', {}, el('strong', { style: 'overflow-wrap:anywhere' }, location.origin + '/')),
        el('button', { class: 'knopf zweit', type: 'button', onclick: async () => {
          try { await api('/api/admin/abmelden', { method: 'POST' }); } catch { /* egal */ } zeigeLogin('Abgemeldet.');
        } }, 'Abmelden')));
  }

  const REITER = [
    ['uebersicht', 'Übersicht', uebersicht],
    ['ergebnisse', 'Ergebnisse nach Bereichen', ergebnisse],
    ['freitexte', 'Freitexte', freitexte],
    ['regeln', 'Entscheidungsregeln', regeln],
    ['verwaltung', 'Verwaltung & Export', verwaltung],
  ];

  if (LOKAL) REITER[4] = ['verwaltung', LOKAL.reiterName || 'Codes & Export', (a, e) => LOKAL.verwaltung(a, e, { el, laden, pct })];

  function zeichne() {
    const a = daten.auswertung; const e = daten.einstellungen;
    if (!REITER.some((r) => r[0] === reiter)) reiter = 'uebersicht';
    const leiste = el('div', { class: 'reiter', role: 'tablist' }, REITER.map(([id, name]) => el('button', { role: 'tab', 'aria-selected': String(id === reiter), type: 'button',
      onclick: () => { reiter = id; try { localStorage.setItem(REITER_KEY, id); } catch { /* egal */ } zeichne(); } }, name)));
    const fn = REITER.find((r) => r[0] === reiter)[2];
    main.replaceChildren(el('h1', {}, 'Auswertung'), leiste, el('div', { role: 'tabpanel' }, fn(a, e)));
  }

  laden();
})();
