'use strict';
// Fragebogen für Klassenleitungen – Schritt für Schritt nach Bereichen A–E, dann Kontrolle, dann Abgabe.
(() => {
  const ENTWURF = 'praevention-eval-entwurf-v1';
  const ABGEGEBEN = 'praevention-eval-abgegeben-v1';
  const main = document.getElementById('inhalt');
  // GitHub-Pages-Version (ohne Server): Abgabe als Antwort-Code, siehe werkzeuge/pages-bauen.js
  const STATISCH = window.EVAL_STATISCH || null;
  // Cloudflare-Version: Seite auf GitHub Pages, Speicherung über den Worker (werkzeuge/cloud-bauen.js)
  const CLOUD = window.EVAL_CLOUD || null;

  let DEF; // { meta, bereiche, fragen, maxText, maxKlasse }
  let zustand = { schritt: 0, antworten: {}, klasse: '', kennung: neueKennung() };
  let sendetGerade = false;

  // ---------- kleine Helfer
  function el(tag, attr = {}, ...kinder) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attr)) {
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (k === 'text') e.textContent = v;
      else if (k === 'style') e.style.cssText = v; // per CSSOM: mit strenger CSP erlaubt
      else e.setAttribute(k, v === true ? '' : v);
    }
    for (const k of kinder.flat()) if (k != null && k !== false) e.append(k.nodeType ? k : document.createTextNode(String(k)));
    return e;
  }
  function neueKennung() {
    if (window.crypto?.randomUUID) return crypto.randomUUID();
    const b = new Uint8Array(16); crypto.getRandomValues(b);
    return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  }
  const lese = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
  const schreibe = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* privat */ } };
  const speichereEntwurf = () => schreibe(ENTWURF, JSON.stringify(zustand));

  const bereichsFragen = (b) => DEF.fragen.filter((f) => f.bereich === b);
  const SCHRITTE = () => DEF.bereiche.length + 2; // Start + Bereiche + Kontrolle

  // ---------- Start
  async function start() {
    try {
      if (CLOUD) {
        DEF = CLOUD.def;
        const status = await (await fetch(CLOUD.api + '/api/status')).json();
        if (!status.offen) return zeigeGeschlossen();
        if (!status.zugangEingerichtet) return zeigeGeschlossen('Die Evaluation ist noch nicht freigeschaltet.');
      } else if (STATISCH) {
        DEF = STATISCH.def;
        if (!STATISCH.offen) return zeigeGeschlossen();
      } else {
        const [r1, r2] = await Promise.all([fetch('/api/fragen'), fetch('/api/status')]);
        DEF = await r1.json();
        const status = await r2.json();
        if (!status.offen) return zeigeGeschlossen();
      }
    } catch {
      main.replaceChildren(el('div', { class: 'karte hinweisbox fehler' }, 'Der Fragebogen konnte nicht geladen werden. Bitte später erneut versuchen.'));
      return;
    }
    try {
      const e = JSON.parse(lese(ENTWURF) || 'null');
      if (e && e.antworten && e.kennung) zustand = { ...zustand, ...e };
    } catch { /* ignorieren */ }
    if (zustand.schritt > SCHRITTE() - 1) zustand.schritt = 0;
    zeichne();
  }

  function zeigeGeschlossen(text) {
    main.replaceChildren(el('div', { class: 'karte danke' },
      el('h1', {}, text || 'Die Evaluation ist derzeit geschlossen.'),
      el('p', { class: 'leise' }, 'Vielen Dank für dein Interesse. Bei Fragen wende dich bitte an WIDE (BL Abt. II).')));
  }

  function fortschritt() {
    const gesamt = SCHRITTE();
    const s = zustand.schritt;
    const namen = ['Start', ...DEF.bereiche.map((b) => b.id), 'Kontrolle'];
    return el('div', { class: 'fortschritt', role: 'group', 'aria-label': 'Fortschritt' },
      el('div', { class: 'fortschritt-text' },
        el('span', {}, s === 0 ? 'Einführung' : s <= DEF.bereiche.length ? `Bereich ${DEF.bereiche[s - 1].id} von ${DEF.bereiche.at(-1).id}` : 'Antworten kontrollieren'),
        el('span', {}, `Schritt ${s + 1} von ${gesamt}`)),
      el('div', { class: 'fortschritt-balken', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(gesamt), 'aria-valuenow': String(s + 1) },
        el('div', { style: `width:${Math.round(((s + 1) / gesamt) * 100)}%` })),
      el('div', { class: 'schritte', 'aria-hidden': 'true' }, namen.map((n, i) => el('span', { class: i === s ? 'aktiv' : i < s ? 'fertig' : '' }, n))));
  }

  function zeichne(fokusOben = true) {
    const s = zustand.schritt;
    let inhalt;
    if (s === 0) inhalt = startSeite();
    else if (s <= DEF.bereiche.length) inhalt = bereichSeite(DEF.bereiche[s - 1]);
    else inhalt = kontrollSeite();
    main.replaceChildren(fortschritt(), inhalt);
    if (fokusOben) {
      window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
      const h = main.querySelector('h1'); if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
    }
  }

  function geh(schritt) { zustand.schritt = schritt; speichereEntwurf(); zeichne(); }

  // ---------- Seiten
  function startSeite() {
    const schonAbgegeben = lese(ABGEGEBEN);
    const klasse = el('input', { type: 'text', id: 'klasse', maxlength: String(DEF.maxKlasse), autocomplete: 'off', placeholder: 'z. B. 8b', value: zustand.klasse || '',
      oninput: (e) => { zustand.klasse = e.target.value; speichereEntwurf(); } });
    return el('div', {},
      el('div', { class: 'karte' },
        el('h1', {}, 'Wie war das Präventionsangebot?'),
        el('p', {}, 'Liebe Klassenleitungen des 8. Jahrgangs, die Mitarbeiterinnen der Jugendhilfe der Stadt Voerde haben in euren Klassen ein Präventionsangebot durchgeführt. Eure Einschätzung hilft der Abteilungsleitung zu entscheiden, ob und in welcher Form das Angebot künftig in Abteilung II fortgeführt wird – auch, ob es schon in Jahrgang 7 sinnvoll wäre.'),
        el('ul', { class: 'liste-kurz' },
          el('li', {}, 'Dauer: etwa 5–7 Minuten, 5 kurze Bereiche'),
          CLOUD
            ? el('li', {}, 'Anonym: Es werden weder Name noch Klasse, IP-Adresse oder Uhrzeit gespeichert. Die Antworten werden verschlüsselt übertragen und in einer Datenbank mit Serverstandort EU abgelegt.')
            : STATISCH
            ? el('li', {}, 'Am Ende erhältst du einen Antwort-Code, den du per E-Mail an WIDE schickst. Ausgewertet wird nur zusammengefasst. Weil die E-Mail deinen Absender zeigt, ist die Abgabe nicht vollständig anonym.')
            : el('li', {}, 'Anonym: keine Registrierung, kein Name, keine Speicherung von IP-Adresse oder Uhrzeit'),
          STATISCH ? el('li', {}, 'Deine Antworten verlassen dieses Gerät nur über den Code, den du selbst verschickst.') : null,
          el('li', {}, 'Bitte keine Namen von Schülerinnen und Schülern in die Freitextfelder schreiben'),
          el('li', {}, ['Fragen mit ', el('span', { class: 'pflicht', 'aria-hidden': 'true' }, '*'), ' sind Pflichtfragen, alle Textfelder sind freiwillig'])),
        schonAbgegeben ? el('div', { class: 'hinweisbox sand' }, 'Hinweis: Von diesem Gerät wurde bereits eine Evaluation abgegeben. Bitte nur einmal pro Klasse teilnehmen.',
          STATISCH && schonAbgegeben.startsWith('PRAEV1') ? el('div', { style: 'margin-top:10px' }, el('button', { class: 'knopf zweit klein', type: 'button', onclick: () => zeigeCode(schonAbgegeben) }, 'Meinen Antwort-Code erneut anzeigen')) : null) : null),
      CLOUD ? zugangKarte() : el('div', { class: 'karte' },
        el('div', { class: 'frage', style: 'margin-bottom:0' },
          el('label', { class: 'frage-titel', for: 'klasse' }, 'Klasse', el('span', { class: 'optional' }, '(freiwillig)')),
          el('p', { class: 'hilfe' }, 'Die Angabe ist freiwillig. Sie wird nur als Liste der beteiligten Klassen angezeigt und nicht mit deinen Antworten verknüpft ausgewertet oder exportiert.'),
          klasse)),
      el('div', { class: 'knopfleiste' }, el('span'), el('button', { class: 'knopf', type: 'button', id: 'los', onclick: (e) => (CLOUD ? zugangPruefen(e.currentTarget) : geh(1)) }, 'Los geht’s →')));
  }

  // ---------- Zugangscode (Cloudflare-Version)
  function zugangKarte() {
    const feld = el('input', { type: 'text', id: 'zugangscode', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', maxlength: '32', value: zustand.zugangscode || '',
      'aria-describedby': 'zugang-fehler', oninput: (e) => { zustand.zugangscode = e.target.value; speichereEntwurf(); },
      onkeydown: (e) => { if (e.key === 'Enter') document.getElementById('los').click(); } });
    return el('div', { class: 'karte' },
      el('div', { class: 'frage', style: 'margin-bottom:0' },
        el('label', { class: 'frage-titel', for: 'zugangscode' }, 'Zugangscode', el('span', { class: 'pflicht', title: 'Pflichtfeld' }, '*')),
        el('p', { class: 'hilfe' }, 'Den Zugangscode hast du von WIDE (BL Abt. II) erhalten. Er ist für alle Klassenleitungen gleich und wird nicht mit deinen Antworten gespeichert.'),
        feld,
        el('div', { class: 'meldung fehler', id: 'zugang-fehler', role: 'alert' })));
  }
  async function zugangPruefen(knopf) {
    const fehler = document.getElementById('zugang-fehler');
    const code = (zustand.zugangscode || '').trim();
    if (!code) { fehler.textContent = 'Bitte den Zugangscode eingeben.'; document.getElementById('zugangscode').focus(); return; }
    knopf.disabled = true; fehler.textContent = '';
    try {
      const r = await fetch(CLOUD.api + '/api/zugang', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Evaluation': '1' }, body: JSON.stringify({ zugangscode: code }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.fehler || 'Der Zugangscode konnte nicht geprüft werden.');
      geh(1);
    } catch (err) {
      fehler.textContent = err.message === 'Failed to fetch' || err.message === 'Load failed' ? 'Keine Verbindung zum Server. Bitte später erneut versuchen.' : err.message;
      knopf.disabled = false;
    }
  }

  function frageElement(f) {
    if (f.typ === 'wahl') {
      const name = f.id;
      const fs = el('fieldset', { class: 'frage', id: `f-${f.id}`, 'aria-describedby': `fehler-${f.id}`, 'aria-required': f.pflicht ? 'true' : null },
        el('legend', {}, el('span', { class: 'nr' }, `${f.nr}.`), f.text, f.pflicht ? el('span', { class: 'pflicht', title: 'Pflichtfrage' }, '*') : null, f.pflicht ? el('span', { class: 'versteckt' }, '(Pflichtfrage)') : null),
        el('div', { class: 'optionen' }, f.optionen.map((o) => el('label', { class: 'option' + (o.neutral ? ' neutral' : '') },
          el('input', { type: 'radio', name, value: o.k, checked: zustand.antworten[f.id] === o.k,
            onchange: () => { zustand.antworten[f.id] = o.k; fs.classList.remove('ungueltig'); speichereEntwurf(); } }),
          el('span', {}, o.t)))),
        el('div', { class: 'fehlertext', id: `fehler-${f.id}` }, 'Bitte wähle eine Antwort aus.'));
      return fs;
    }
    const id = `t-${f.id}`;
    const zaehler = el('div', { class: 'zaehler', 'aria-live': 'off' });
    const aktual = (v) => { zaehler.textContent = `${v.length} / ${DEF.maxText} Zeichen`; };
    const ta = el('textarea', { id, rows: String(f.zeilen || 4), maxlength: String(DEF.maxText),
      oninput: (e) => { zustand.antworten[f.id] = e.target.value; aktual(e.target.value); speichereEntwurf(); } });
    ta.value = zustand.antworten[f.id] || ''; aktual(ta.value);
    return el('div', { class: 'frage' + (f.gehoertZu ? ' unterfrage' : '') },
      el('label', { class: 'frage-titel', for: id }, el('span', { class: 'nr' }, f.gehoertZu ? '' : `${f.nr}.`), f.text, el('span', { class: 'optional' }, '(freiwillig)')),
      f.hilfe ? el('p', { class: 'hilfe' }, f.hilfe) : null, ta, zaehler);
  }

  function bereichSeite(b) {
    const fragen = bereichsFragen(b.id);
    const idx = DEF.bereiche.indexOf(b);
    const weiter = () => {
      const fehlend = fragen.filter((f) => f.typ === 'wahl' && f.pflicht && !zustand.antworten[f.id]);
      main.querySelectorAll('.frage.ungueltig').forEach((x) => x.classList.remove('ungueltig'));
      if (fehlend.length) {
        fehlend.forEach((f) => document.getElementById(`f-${f.id}`).classList.add('ungueltig'));
        const erstes = document.getElementById(`f-${fehlend[0].id}`);
        erstes.scrollIntoView({ behavior: 'smooth', block: 'center' });
        erstes.querySelector('input').focus({ preventScroll: true });
        return;
      }
      geh(zustand.schritt + 1);
    };
    return el('div', {},
      el('div', { class: 'karte' },
        el('div', { class: 'bereich-kopf' }, el('span', { class: 'marke' }, `Bereich ${b.id}`), el('h1', {}, b.titel)),
        fragen.map(frageElement)),
      el('div', { class: 'knopfleiste' },
        el('button', { class: 'knopf zweit', type: 'button', onclick: () => geh(zustand.schritt - 1) }, '← Zurück'),
        el('button', { class: 'knopf', type: 'button', onclick: weiter }, idx === DEF.bereiche.length - 1 ? 'Antworten kontrollieren →' : 'Weiter →')));
  }

  function kontrollSeite() {
    const meldung = el('div', { class: 'meldung', role: 'alert' });
    const sendenKnopf = el('button', { class: 'knopf', type: 'button', onclick: () => absenden(sendenKnopf, meldung) }, STATISCH ? 'Antwort-Code erstellen' : 'Evaluation verbindlich absenden');
    const zeilen = [];
    if ((zustand.klasse || '').trim()) zeilen.push(['Klasse (freiwillig)', zustand.klasse.trim(), 0]);
    DEF.bereiche.forEach((b, i) => {
      for (const f of bereichsFragen(b.id)) {
        const w = zustand.antworten[f.id];
        const text = f.typ === 'wahl' ? (f.optionen.find((o) => o.k === w) || {}).t : (w || '').trim();
        zeilen.push([`${f.nr}. ${f.text}`, text, i + 1]);
      }
    });
    return el('div', {},
      el('div', { class: 'karte kontrolle' },
        el('h1', {}, 'Bitte kontrolliere deine Antworten'),
        el('p', { class: 'leise' }, 'Nach dem Absenden können die Antworten nicht mehr geändert werden.'),
        el('dl', {}, zeilen.map(([frage, wert, schritt]) => el('div', { class: 'zeile' },
          el('dt', {}, frage),
          el('dd', { class: wert ? '' : 'leer' }, wert || 'keine Angabe'),
          el('button', { class: 'knopf zweit klein aendern', type: 'button', onclick: () => geh(schritt), 'aria-label': `Ändern: ${frage}` }, 'Ändern'))))),
      meldung,
      el('div', { class: 'knopfleiste' },
        el('button', { class: 'knopf zweit', type: 'button', onclick: () => geh(zustand.schritt - 1) }, '← Zurück'),
        sendenKnopf));
  }

  async function absenden(knopf, meldung) {
    if (sendetGerade) return; // Schutz vor Doppelklick
    sendetGerade = true; knopf.disabled = true; knopf.textContent = 'Wird gesendet …';
    meldung.className = 'meldung'; meldung.textContent = '';
    const antworten = { ...zustand.antworten, klasse: zustand.klasse || '' };
    if (STATISCH) {
      try {
        const code = await STATISCH.codeErzeugen(zustand.kennung, antworten);
        schreibe(ENTWURF, null); schreibe(ABGEGEBEN, code);
        zeigeCode(code);
      } catch (err) {
        meldung.className = 'meldung fehler'; meldung.textContent = err.message;
        sendetGerade = false; knopf.disabled = false; knopf.textContent = 'Erneut versuchen';
      }
      return;
    }
    try {
      const r = await fetch((CLOUD ? CLOUD.api : '') + '/api/antworten', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Evaluation': '1' },
        body: JSON.stringify({ kennung: zustand.kennung, antworten, zugangscode: CLOUD ? (zustand.zugangscode || '').trim() : undefined }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.fehler || 'Die Abgabe ist fehlgeschlagen.');
      schreibe(ENTWURF, null); schreibe(ABGEGEBEN, '1');
      danke();
    } catch (err) {
      meldung.className = 'meldung fehler';
      meldung.textContent = (err.message === 'Failed to fetch' || err.message === 'Load failed' ? 'Keine Verbindung zum Server.' : err.message) + ' Deine Antworten bleiben erhalten – bitte erneut versuchen.';
      sendetGerade = false; knopf.disabled = false; knopf.textContent = 'Erneut absenden';
    }
  }

  function danke() {
    main.replaceChildren(el('div', { class: 'karte danke' },
      el('div', { class: 'haken', 'aria-hidden': 'true' }, el('img', { src: 'symbol.svg', alt: '', width: '48', height: '48' })),
      el('h1', { tabindex: '-1' }, 'Vielen Dank! Deine Evaluation wurde gespeichert.'),
      el('p', {}, 'Deine Rückmeldung fließt anonym in die Gesamtauswertung für die Abteilungsleitung ein.'),
      el('p', { class: 'leise' }, 'Du kannst dieses Fenster jetzt schließen.')));
    window.scrollTo(0, 0); main.querySelector('h1').focus();
  }

  // ---------- Antwort-Code anzeigen (GitHub-Pages-Version)
  function zeigeCode(code) {
    const feld = el('textarea', { class: 'codefeld', readonly: true, rows: '5', 'aria-label': 'Dein Antwort-Code', onfocus: (e) => e.target.select() });
    feld.value = code;
    const meldung = el('div', { class: 'meldung', role: 'status' });
    const kopieren = async () => {
      try { await navigator.clipboard.writeText(code); }
      catch { feld.focus(); feld.select(); try { document.execCommand('copy'); } catch { /* manuell */ } }
      meldung.className = 'meldung ok'; meldung.textContent = 'Code kopiert – jetzt in eine E-Mail an WIDE einfügen.';
    };
    const betreff = 'Evaluation Präventionsangebot – Antwort-Code';
    const kurz = code.length <= 1800;
    const text = kurz ? `Hallo,\n\nhier mein Antwort-Code zur Evaluation des Präventionsangebots:\n\n${code}\n` : 'Hallo,\n\nhier mein Antwort-Code zur Evaluation des Präventionsangebots (bitte unten einfügen):\n\n';
    const mail = `mailto:${encodeURIComponent(STATISCH.empfaenger || '')}?subject=${encodeURIComponent(betreff)}&body=${encodeURIComponent(text)}`;
    main.replaceChildren(el('div', { class: 'karte' },
      el('h1', { tabindex: '-1' }, 'Fast geschafft: Bitte den Code an WIDE senden'),
      el('p', {}, 'Deine Antworten sind in diesem Code zusammengefasst. Erst wenn WIDE den Code erhalten hat, ist deine Evaluation abgegeben.'),
      el('ol', { class: 'liste-kurz' },
        el('li', {}, 'Auf „Code kopieren“ tippen.'),
        el('li', {}, STATISCH.empfaenger ? `E-Mail an ${STATISCH.empfaenger} öffnen (Knopf unten) und den Code einfügen.` : 'Eine E-Mail an WIDE (BL Abt. II) schreiben und den Code einfügen.'),
        el('li', {}, 'Absenden – fertig. Danke!')),
      feld,
      el('div', { class: 'knopfleiste', style: 'margin-top:14px;justify-content:flex-start' },
        el('button', { class: 'knopf', type: 'button', onclick: kopieren }, 'Code kopieren'),
        el('a', { class: 'knopf zweit', href: mail }, kurz ? 'E-Mail mit Code öffnen' : 'E-Mail öffnen')),
      meldung,
      el('p', { class: 'klein leise', style: 'margin-top:12px' }, 'Der Code bleibt auf diesem Gerät gespeichert und kann über die Startseite erneut angezeigt werden. Bitte nur einmal pro Klasse abgeben.')));
    window.scrollTo(0, 0); main.querySelector('h1').focus();
  }

  start();
})();
