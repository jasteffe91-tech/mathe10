'use strict';
// Auswertungsbereich für WIDE (Cloudflare-Version): Anmeldung beim Worker, Antworten laden,
// Auswertung + PDF + CSV entstehen im Browser (gleiche Bausteine wie die Server-Version).
// Die Anmeldung gilt 8 Stunden und nur in diesem Browser-Tab (sessionStorage).
(() => {
  const E = window.EVAL;
  const API = window.EVAL_CLOUD_API;
  const TOKEN = 'praevention-admin-token';
  const main = document.getElementById('inhalt');
  let letzte = null; // { antworten, erg }
  let hinweis = null;

  const token = () => { try { return sessionStorage.getItem(TOKEN); } catch { return null; } };
  const tokenSetzen = (t) => { try { t ? sessionStorage.setItem(TOKEN, t) : sessionStorage.removeItem(TOKEN); } catch { /* */ } };

  async function api(pfad, opt = {}) {
    let r;
    try {
      r = await fetch(API + pfad, { ...opt, headers: { 'Content-Type': 'application/json', 'X-Evaluation': '1', ...(token() ? { Authorization: 'Bearer ' + token() } : {}), ...(opt.headers || {}) } });
    } catch { throw new Error('Keine Verbindung zum Server (Cloudflare).'); }
    const d = await r.json().catch(() => ({}));
    if (r.status === 401 && pfad !== '/api/admin/anmelden') { tokenSetzen(null); throw Object.assign(new Error('Bitte anmelden.'), { login: true }); }
    if (!r.ok) throw new Error(d.fehler || 'Fehler ' + r.status);
    return d;
  }

  function el(tag, attr = {}, ...kinder) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attr)) {
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v; else if (k === 'style') e.style.cssText = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v);
    }
    for (const k of kinder.flat()) if (k != null && k !== false) e.append(k.nodeType ? k : document.createTextNode(String(k)));
    return e;
  }

  function zeigeLogin(text) {
    const meldung = el('div', { class: 'meldung fehler', role: 'alert' }, text || '');
    const pw = el('input', { type: 'password', id: 'pw', autocomplete: 'current-password', required: true });
    const knopf = el('button', { class: 'knopf', type: 'submit' }, 'Anmelden');
    main.replaceChildren(el('form', { class: 'karte login', onsubmit: async (e) => {
      e.preventDefault(); knopf.disabled = true; meldung.textContent = '';
      try { const d = await api('/api/admin/anmelden', { method: 'POST', body: JSON.stringify({ passwort: pw.value }) }); tokenSetzen(d.token); location.reload(); }
      catch (err) { meldung.textContent = err.message; knopf.disabled = false; pw.select(); }
    } },
      el('h1', {}, 'Anmeldung'),
      el('p', { class: 'leise' }, 'Dieser Bereich ist nur für die Abteilungsleitung (WIDE, BL Abt. II) bestimmt.'),
      el('label', { for: 'pw', style: 'font-weight:600;display:block;margin-bottom:6px' }, 'Passwort'), pw,
      el('div', { style: 'margin-top:14px' }, knopf), meldung));
    pw.focus();
  }

  async function laden() {
    if (!token()) { zeigeLogin(); return new Promise(() => {}); } // admin.js wartet; nach Login wird neu geladen
    try {
      const d = await api('/api/admin/daten');
      const erg = E.auswertung.auswerten(d.antworten, { erwartet: d.einstellungen.erwartet });
      letzte = { antworten: d.antworten, erg, einstellungen: d.einstellungen };
      return { einstellungen: d.einstellungen, auswertung: E.auswertung.fuerJson(erg) };
    } catch (err) {
      if (err.login) { zeigeLogin('Die Anmeldung ist abgelaufen. Bitte erneut anmelden.'); return new Promise(() => {}); }
      throw err;
    }
  }

  function herunterladen(blob, name) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  }
  const heute = () => new Date().toISOString().slice(0, 10);

  async function pdfErstellen() {
    const bericht = await E.ladeBericht();
    const schriften = {};
    for (const [k, datei] of Object.entries(bericht.SCHRIFT_DATEIEN)) {
      const r = await fetch('schriften/' + datei); if (!r.ok) throw new Error('Schrift konnte nicht geladen werden.');
      schriften[k] = await r.arrayBuffer();
    }
    herunterladen(await bericht.berichtErstellen(letzte.erg, { schriften, alsBlob: true }), `Evaluation_Praeventionsangebot_${heute()}.pdf`);
  }

  function verwaltung(a, e, { laden: neuLaden }) {
    const meldung = el('div', { class: 'meldung', role: 'status' });
    const zeige = (h) => { meldung.className = 'meldung ' + h.art; meldung.textContent = h.text; };
    const ok = (t) => { hinweis = { art: 'ok', text: t }; zeige(hinweis); };
    const fehler = (t) => { hinweis = { art: 'fehler', text: t }; zeige(hinweis); };
    if (hinweis) { zeige(hinweis); hinweis = null; }
    const setzen = async (teil, text) => {
      try { await api('/api/admin/einstellungen', { method: 'POST', body: JSON.stringify(teil) }); ok(text); await neuLaden(); }
      catch (err) { if (err.login) zeigeLogin(err.message); else fehler(err.message); }
    };
    const code = el('input', { type: 'text', id: 'zugangscode', value: e.zugangscode || '', autocomplete: 'off', maxlength: '32', style: 'width:220px;text-transform:uppercase' });
    const erwartet = el('input', { type: 'number', id: 'erwartet', min: '1', max: '200', value: e.erwartet ?? '' });
    const loeschFeld = el('input', { type: 'text', id: 'loeschen', autocomplete: 'off', placeholder: 'LÖSCHEN' });
    const vorschlag = () => { const z = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; const b = crypto.getRandomValues(new Uint8Array(8)); const s = Array.from(b, (x) => z[x % z.length]).join(''); return `PRAE-${s.slice(0, 4)}-${s.slice(4)}`; };
    const link = new URL('./', location.href).href;

    return el('div', {},
      meldung,
      el('div', { class: 'karte' }, el('h2', {}, 'Zugangscode für die Klassenleitungen'),
        e.zugangscode ? el('div', { class: 'hinweisbox' }, 'Aktueller Zugangscode: ', el('strong', {}, e.zugangscode), ' – der Fragebogen ist freigeschaltet.') : el('div', { class: 'hinweisbox sand' }, 'Noch kein Zugangscode gespeichert – bis dahin ist der Fragebogen gesperrt. Code eintragen (oder „Vorschlag erzeugen“) und auf „Zugangscode speichern“ klicken.'),
        el('p', { class: 'leise' }, 'Alle Klassenleitungen bekommen denselben Code (z. B. per Dienst-Mail). Er wird nicht mit den Antworten gespeichert. Ändern sperrt den alten Code sofort.'),
        el('div', { class: 'form-zeile' },
          el('label', { for: 'zugangscode' }, 'Zugangscode', code),
          el('button', { class: 'knopf zweit', type: 'button', onclick: () => { code.value = vorschlag(); } }, 'Vorschlag erzeugen'),
          el('button', { class: 'knopf', type: 'button', onclick: () => {
            const c = code.value.trim().replace(/\s+/g, '-').replace(/[äÄ]/g, 'AE').replace(/[öÖ]/g, 'OE').replace(/[üÜ]/g, 'UE').replace(/ß/g, 'SS').toUpperCase();
            if (!/^[A-Z0-9-]{6,32}$/.test(c)) return fehler('Der Zugangscode braucht 6–32 Zeichen: nur Buchstaben A–Z, Ziffern und Bindestrich.');
            setzen({ zugangscode: c }, `Zugangscode „${c}“ gespeichert – der Fragebogen ist jetzt freigeschaltet.`);
          } }, 'Zugangscode speichern')),
        el('p', { style: 'margin-top:14px' }, 'Link zum Fragebogen: ', el('strong', { style: 'overflow-wrap:anywhere' }, link))),
      el('div', { class: 'karte' }, el('h2', {}, 'Berichte und Export'),
        el('p', { class: 'leise' }, 'Der PDF-Bericht wird bei jedem Klick neu aus den aktuellen Daten erstellt – direkt in diesem Browser. Er eignet sich auch, um ihn Claude zur weiteren Analyse zu geben; er enthält keine personenbezogenen Daten.'),
        el('div', { class: 'form-zeile' },
          el('button', { class: 'knopf', type: 'button', onclick: async (ev) => {
            const k = ev.currentTarget; k.disabled = true; k.textContent = 'PDF wird erstellt …';
            try { await pdfErstellen(); ok('PDF erstellt.'); } catch (err) { fehler('PDF-Fehler: ' + err.message); }
            k.disabled = false; k.textContent = 'PDF-Gesamtbericht herunterladen';
          } }, 'PDF-Gesamtbericht herunterladen'),
          el('button', { class: 'knopf zweit', type: 'button', onclick: () => herunterladen(new Blob([E.csv.csvErstellen(letzte.antworten)], { type: 'text/csv;charset=utf-8' }), `Evaluation_Rohdaten_${heute()}.csv`) }, 'Rohdaten als CSV'),
          el('button', { class: 'knopf zweit', type: 'button', onclick: () => herunterladen(new Blob([JSON.stringify({ gesichert: heute(), erwartet: e.erwartet, antworten: letzte.antworten }, null, 1)], { type: 'application/json' }), `Evaluation_Sicherung_${heute()}.json`) }, 'Datensicherung (JSON)'))),
      el('div', { class: 'karte' }, el('h2', {}, 'Einstellungen'),
        el('div', { class: 'form-zeile' },
          el('label', { for: 'erwartet' }, 'Erwartete Anzahl Klassenleitungen', erwartet),
          el('button', { class: 'knopf zweit', type: 'button', onclick: () => setzen({ erwartet: erwartet.value }, 'Erwartete Anzahl gespeichert.') }, 'Anzahl speichern')),
        el('hr', { style: 'border:0;border-top:1px solid var(--rand);margin:20px 0' }),
        el('p', {}, el('span', { class: 'status-punkt' + (e.offen ? '' : ' zu') }), e.offen ? 'Die Evaluation ist geöffnet – Abgaben sind möglich.' : 'Die Evaluation ist geschlossen – es werden keine Abgaben angenommen.'),
        el('button', { class: 'knopf' + (e.offen ? ' zweit' : ''), type: 'button', onclick: () => setzen({ offen: !e.offen }, e.offen ? 'Evaluation geschlossen.' : 'Evaluation geöffnet.') }, e.offen ? 'Evaluation schließen' : 'Evaluation wieder öffnen')),
      el('div', { class: 'karte' }, el('h2', {}, 'Alle Antworten löschen'),
        el('p', {}, 'Löscht alle eingegangenen Evaluationen endgültig aus der Cloudflare-Datenbank (z. B. nach Abschluss und Archivierung des PDF-Berichts). Das kann nicht rückgängig gemacht werden.'),
        el('div', { class: 'form-zeile' },
          el('label', { for: 'loeschen' }, 'Zur Bestätigung LÖSCHEN eingeben', loeschFeld),
          el('button', { class: 'knopf gefahr', type: 'button', onclick: async () => {
            if (loeschFeld.value !== 'LÖSCHEN') return fehler('Bitte genau LÖSCHEN eingeben.');
            if (!confirm(`Wirklich alle ${a.n} Evaluationen endgültig löschen?`)) return;
            try { await api('/api/admin/loeschen', { method: 'POST', body: JSON.stringify({ bestaetigung: 'LÖSCHEN' }) }); ok('Alle Antworten wurden gelöscht.'); await neuLaden(); }
            catch (err) { fehler(err.message); }
          } }, 'Endgültig löschen'))),
      el('div', { class: 'karte' },
        el('button', { class: 'knopf zweit', type: 'button', onclick: () => { tokenSetzen(null); zeigeLogin('Abgemeldet.'); } }, 'Abmelden')));
  }

  window.EVAL_LOKAL = { laden, verwaltung, reiterName: 'Verwaltung & Export' };
})();
