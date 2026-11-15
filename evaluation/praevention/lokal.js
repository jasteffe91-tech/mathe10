'use strict';
// Auswertung ohne Server (GitHub-Pages-Version):
// WIDE fügt die per E-Mail erhaltenen Antwort-Codes ein. Alles bleibt in DIESEM Browser
// (localStorage) – es wird nichts an einen Server geschickt. Sicherung als Datei möglich.
(() => {
  const E = window.EVAL; // gebündelte Bausteine aus lib/ (werkzeuge/pages-bauen.js)
  const KEY = 'praevention-auswertung-v1';

  const lade = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } };
  const speichere = (d) => { try { localStorage.setItem(KEY, JSON.stringify(d)); return true; } catch { return false; } };
  let speicher = { codes: [], erwartet: null, ...lade() };

  let letzteAuswertung = null; // Rohergebnis (mit Funktionen) für PDF
  let hinweis = null; // Meldung, die das Neuzeichnen überlebt: { art, text, liste }

  async function antwortenAusCodes(codes) {
    const gesehen = new Set(); const antworten = [];
    for (const c of codes) {
      try {
        const { kennung, antwort } = await E.code.codeLesen(c);
        if (gesehen.has(kennung)) continue;
        gesehen.add(kennung); antworten.push(antwort);
      } catch { /* fehlerhafte Codes werden beim Einlesen schon abgewiesen */ }
    }
    return antworten;
  }

  async function laden() {
    const antworten = await antwortenAusCodes(speicher.codes);
    // zufällige Reihenfolge, damit die Reihenfolge der E-Mails keine Rolle spielt
    for (let i = antworten.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [antworten[i], antworten[j]] = [antworten[j], antworten[i]]; }
    letzteAuswertung = { antworten, erg: E.auswertung.auswerten(antworten, { erwartet: speicher.erwartet }) };
    return { einstellungen: { offen: E.offen, erwartet: speicher.erwartet }, auswertung: E.auswertung.fuerJson(letzteAuswertung.erg) };
  }

  async function codesUebernehmen(text) {
    const gefunden = E.code.codesFinden(text);
    const bekannt = new Set();
    for (const c of speicher.codes) { try { bekannt.add((await E.code.codeLesen(c)).kennung); } catch { /* */ } }
    let neu = 0, doppelt = 0; const fehler = [];
    for (const c of gefunden) {
      try {
        const { kennung } = await E.code.codeLesen(c);
        if (bekannt.has(kennung)) { doppelt++; continue; }
        bekannt.add(kennung); speicher.codes.push(c); neu++;
      } catch (err) { fehler.push(`${c.slice(0, 18)}… – ${err.message}`); }
    }
    speichere(speicher);
    return { gefunden: gefunden.length, neu, doppelt, fehler };
  }

  function herunterladen(blob, name) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  }
  const heute = () => new Date().toISOString().slice(0, 10);

  async function pdfErstellen() {
    const bericht = await E.ladeBericht(); // lädt die PDF-Bibliothek erst bei Bedarf (≈ 2,7 MB)
    const schriften = {};
    for (const [k, datei] of Object.entries(bericht.SCHRIFT_DATEIEN)) {
      const r = await fetch('schriften/' + datei); if (!r.ok) throw new Error('Schrift konnte nicht geladen werden.');
      schriften[k] = await r.arrayBuffer();
    }
    const blob = await bericht.berichtErstellen(letzteAuswertung.erg, { schriften, alsBlob: true });
    herunterladen(blob, `Evaluation_Praeventionsangebot_${heute()}.pdf`);
  }

  function verwaltung(a, e, { el, laden: neuLaden }) {
    const meldung = el('div', { class: 'meldung', role: 'status' });
    const zeige = (h) => { meldung.className = 'meldung ' + h.art; meldung.replaceChildren(h.text, h.liste?.length ? el('ul', { class: 'liste-kurz code-liste' }, h.liste.map((f) => el('li', {}, f))) : ''); };
    const ok = (t) => { hinweis = { art: 'ok', text: t }; zeige(hinweis); };
    const fehler = (t) => { hinweis = { art: 'fehler', text: t }; zeige(hinweis); };
    if (hinweis) { zeige(hinweis); hinweis = null; }
    const eingabe = el('textarea', { class: 'importfeld', id: 'codes', placeholder: 'Hier die E-Mails bzw. Codes einfügen (PRAEV1.…). Mehrere auf einmal sind möglich.' });
    const erwartet = el('input', { type: 'number', id: 'erwartet', min: '1', max: '200', value: speicher.erwartet ?? '' });
    const loeschFeld = el('input', { type: 'text', id: 'loeschen', autocomplete: 'off', placeholder: 'LÖSCHEN' });
    const dateiWahl = el('input', { type: 'file', accept: '.json,application/json', class: 'versteckt', id: 'sicherung-datei', onchange: async (ev) => {
      const f = ev.target.files[0]; if (!f) return;
      try {
        const d = JSON.parse(await f.text());
        if (!Array.isArray(d.codes)) throw new Error('Keine gültige Sicherungsdatei.');
        const r = await codesUebernehmen(d.codes.join('\n'));
        if (d.erwartet && !speicher.erwartet) { speicher.erwartet = d.erwartet; speichere(speicher); }
        ok(`Sicherung geladen: ${r.neu} neue Code(s), ${r.doppelt} bereits vorhanden.`); await neuLaden();
      } catch (err) { fehler(err.message); }
    } });

    return el('div', {},
      el('div', { class: 'karte' }, el('h2', {}, 'Antwort-Codes einlesen'),
        el('p', { class: 'leise' }, 'Die Klassenleitungen schicken dir ihren Antwort-Code per E-Mail. Füge hier den Text der E-Mails ein – die Codes werden automatisch erkannt. Doppelt eingefügte Codes werden nur einmal gezählt.'),
        meldung,
        eingabe,
        el('div', { class: 'form-zeile', style: 'margin-top:10px' },
          el('button', { class: 'knopf', type: 'button', onclick: async () => {
            const r = await codesUebernehmen(eingabe.value);
            hinweis = { art: r.fehler.length || !r.gefunden ? 'fehler' : 'ok', liste: r.fehler,
              text: r.gefunden ? `${r.gefunden} Code(s) gefunden: ${r.neu} neu übernommen, ${r.doppelt} bereits vorhanden${r.fehler.length ? `, ${r.fehler.length} fehlerhaft` : ''}.` : 'Kein Antwort-Code im eingefügten Text gefunden.' };
            if (r.neu) { await neuLaden(); } else { zeige(hinweis); hinweis = null; }
          } }, 'Codes übernehmen')),
        el('p', { class: 'klein leise', style: 'margin-top:10px' }, `Derzeit gespeichert: ${a.n} Evaluation(en). Die Daten liegen nur in diesem Browser auf diesem Gerät – bitte regelmäßig eine Sicherung herunterladen.`)),
      el('div', { class: 'karte' }, el('h2', {}, 'Berichte und Export'),
        el('div', { class: 'form-zeile' },
          el('button', { class: 'knopf', type: 'button', onclick: async (ev) => {
            ev.target.disabled = true; ev.target.textContent = 'PDF wird erstellt …';
            try { await pdfErstellen(); ok('PDF erstellt.'); } catch (err) { fehler('PDF-Fehler: ' + err.message); }
            ev.target.disabled = false; ev.target.textContent = 'PDF-Gesamtbericht herunterladen';
          } }, 'PDF-Gesamtbericht herunterladen'),
          el('button', { class: 'knopf zweit', type: 'button', onclick: () => herunterladen(new Blob([E.csv.csvErstellen(letzteAuswertung.antworten)], { type: 'text/csv;charset=utf-8' }), `Evaluation_Rohdaten_${heute()}.csv`) }, 'Rohdaten als CSV'),
          el('button', { class: 'knopf zweit', type: 'button', onclick: () => herunterladen(new Blob([JSON.stringify({ gesichert: heute(), erwartet: speicher.erwartet, codes: speicher.codes }, null, 1)], { type: 'application/json' }), `Evaluation_Sicherung_${heute()}.json`) }, 'Sicherung herunterladen'),
          el('label', { class: 'knopf zweit', for: 'sicherung-datei', style: 'cursor:pointer' }, 'Sicherung laden'), dateiWahl),
        el('p', { class: 'klein leise', style: 'margin-top:10px' }, 'PDF und CSV werden direkt in diesem Browser erstellt; es wird nichts hochgeladen. Die Klassenangabe ist im CSV nicht enthalten.')),
      el('div', { class: 'karte' }, el('h2', {}, 'Einstellungen'),
        el('div', { class: 'form-zeile' },
          el('label', { for: 'erwartet' }, 'Erwartete Anzahl Klassenleitungen', erwartet),
          el('button', { class: 'knopf zweit', type: 'button', onclick: async () => {
            const v = erwartet.value === '' ? null : Number(erwartet.value);
            if (v !== null && !(Number.isInteger(v) && v >= 1 && v <= 200)) return fehler('Bitte eine ganze Zahl zwischen 1 und 200 eingeben.');
            speicher.erwartet = v; speichere(speicher); ok('Gespeichert.'); await neuLaden();
          } }, 'Speichern')),
        el('p', { class: 'klein leise', style: 'margin-top:12px' }, e.offen
          ? 'Der Fragebogen ist geöffnet. Zum Schließen bitte Bescheid geben – dann wird die Online-Seite auf „geschlossen“ umgestellt. Später eintreffende Codes kannst du hier einfach nicht mehr einlesen.'
          : 'Der Fragebogen ist geschlossen.')),
      el('div', { class: 'karte' }, el('h2', {}, 'Alle Codes löschen'),
        el('p', {}, 'Entfernt alle eingelesenen Codes aus diesem Browser (z. B. nach Abschluss und Archivierung des PDF-Berichts). Vorher bei Bedarf eine Sicherung herunterladen. Die E-Mails selbst bleiben in deinem Postfach.'),
        el('div', { class: 'form-zeile' },
          el('label', { for: 'loeschen' }, 'Zur Bestätigung LÖSCHEN eingeben', loeschFeld),
          el('button', { class: 'knopf gefahr', type: 'button', onclick: async () => {
            if (loeschFeld.value !== 'LÖSCHEN') return fehler('Bitte genau LÖSCHEN eingeben.');
            if (!confirm(`Wirklich alle ${a.n} Evaluationen aus diesem Browser löschen?`)) return;
            speicher = { codes: [], erwartet: speicher.erwartet }; speichere(speicher); ok('Alle Codes wurden gelöscht.'); await neuLaden();
          } }, 'Endgültig löschen'))),
      el('div', { class: 'karte' }, el('h2', {}, 'Link für die Klassenleitungen'),
        el('p', {}, el('strong', { style: 'overflow-wrap:anywhere' }, new URL('./', location.href).href))));
  }

  window.EVAL_LOKAL = { laden, verwaltung };
})();
