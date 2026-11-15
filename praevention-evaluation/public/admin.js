/* Administrationsbereich – Auswertung der Evaluation (WIDE, BL Abt. II) */
(function () {
  'use strict';

  var API = 'api/admin/';
  var root = document.getElementById('admin');
  var data = null;
  var activeTab = 'overview';
  try { activeTab = sessionStorage.getItem('admin-tab') || 'overview'; } catch (e) { /* egal */ }

  /* ---------- Hilfsfunktionen ---------- */

  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === null || v === undefined || v === false) return;
        if (k === 'class') el.className = v;
        else if (k === 'text') el.textContent = v;
        else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
        else el.setAttribute(k, v === true ? '' : v);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var c = arguments[i];
      if (c === null || c === undefined || c === false) continue;
      if (Array.isArray(c)) c.forEach(function (x) { if (x) el.appendChild(typeof x === 'string' ? document.createTextNode(x) : x); });
      else el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return el;
  }
  function pct(p) { return p === null || p === undefined ? '–' : Math.round(p) + ' %'; }

  function api(path, opts) {
    opts = opts || {};
    var headers = { 'X-Requested-With': 'evaluation-admin' };
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
    return fetch(API + path, {
      method: opts.method || 'GET',
      headers: headers,
      credentials: 'same-origin',
      cache: 'no-store',
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (body) {
        if (res.status === 401 && path !== 'login') { renderLogin(); throw new Error('Nicht angemeldet.'); }
        if (!res.ok) throw new Error(body.error || 'Fehler ' + res.status);
        return body;
      });
    });
  }

  function toast(msg) {
    var t = h('div', { class: 'toast', role: 'status', text: msg });
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 3200);
  }

  /* ---------- Anmeldung ---------- */

  function renderLogin(configured) {
    root.innerHTML = '';
    var pw = h('input', { type: 'password', id: 'pw', autocomplete: 'current-password', required: true });
    var err = h('div', { class: 'notice error', hidden: true, role: 'alert' });
    var btn = h('button', { type: 'submit', class: 'btn' }, 'Anmelden');
    var form = h('form', { class: 'card login-card', onsubmit: function (e) {
      e.preventDefault();
      btn.disabled = true;
      err.hidden = true;
      api('login', { method: 'POST', body: { password: pw.value } })
        .then(function () { pw.value = ''; loadDashboard(); })
        .catch(function (e2) { err.textContent = e2.message; err.hidden = false; btn.disabled = false; pw.focus(); });
    } },
    h('div', { class: 'eyebrow', text: 'Geschützter Bereich' }),
    h('h1', { class: 'page-title', text: 'Anmeldung Abteilungsleitung' }),
    h('p', { class: 'muted', text: 'Zugang ausschließlich für WIDE (BL Abt. II). Die Ergebnisse sind nicht öffentlich.' }),
    configured === false ? h('div', { class: 'notice error', text: 'Es ist noch kein Administrationspasswort eingerichtet. Bitte gemäß Anleitung „npm run set-password“ ausführen.' }) : null,
    h('div', { class: 'form-row' }, h('label', { for: 'pw', text: 'Passwort' }), pw),
    err,
    h('div', { class: 'actions' }, h('span', { class: 'spacer' }), btn));
    root.appendChild(form);
    pw.focus();
  }

  /* ---------- Dashboard ---------- */

  function loadDashboard() {
    return api('results').then(function (d) { data = d; renderDashboard(); });
  }

  function renderDashboard() {
    root.innerHTML = '';
    var d = data;
    root.appendChild(h('div', { class: 'admin-bar' },
      h('div', null,
        h('div', { class: 'eyebrow', text: 'Auswertung · ' + d.meta.responsible }),
        h('h1', { class: 'page-title', text: 'Evaluation Präventionsangebot' }),
        h('span', { class: 'badge ' + (d.open ? 'open' : 'closed'), text: d.open ? '● Evaluation geöffnet' : '● Evaluation geschlossen' })),
      h('div', { class: 'btns' },
        h('a', { class: 'btn', href: API + 'report.pdf', download: '' }, 'PDF-Bericht herunterladen'),
        h('a', { class: 'btn secondary', href: API + 'export.csv', download: '' }, 'CSV-Rohdaten'),
        h('button', { type: 'button', class: 'btn secondary', onclick: function () { loadDashboard().then(function () { toast('Aktualisiert.'); }); } }, 'Aktualisieren'),
        h('button', { type: 'button', class: 'btn secondary', onclick: function () { api('../admin/logout', { method: 'POST', body: {} }).finally(function () { renderLogin(); }); } }, 'Abmelden'))));

    var rateFill = h('div', { class: 'rate-fill' });
    rateFill.style.width = d.rate !== null ? Math.min(100, d.rate * 100) + '%' : '0%';
    root.appendChild(h('div', { class: 'kpis' },
      kpi('Eingegangene Evaluationen', String(d.n), d.classes.withClass + ' mit freiwilliger Klassenangabe'),
      kpi('Erwartete Klassenleitungen', d.expected ? String(d.expected) : '–', d.expected ? 'in „Verwaltung“ änderbar' : 'noch nicht hinterlegt'),
      h('div', { class: 'kpi' }, h('div', { class: 'k', text: 'Rücklaufquote' }), h('div', { class: 'v', text: d.rate !== null ? pct(d.rate * 100) : '–' }),
        d.rate !== null ? h('div', { class: 'rate-track' }, rateFill) : h('div', { class: 's', text: 'erwartete Anzahl hinterlegen' })),
      kpi('Weiterempfehlung', pct(d.indicators.recommendPos.pct), d.indicators.recommendPos.count + ' von ' + d.indicators.recommendPos.valid)));

    var dec = d.decision;
    root.appendChild(h('section', { class: 'decision', style: null },
      h('div', { class: 'eyebrow', text: 'Automatische, regelbasierte Gesamteinschätzung' }),
      h('h2', { text: dec.label }),
      h('div', { class: 'small', text: 'Belastbarkeit: ' + dec.strength + ' · Die endgültige Entscheidung liegt bei der Abteilungsleitung. Regeln siehe Reiter „Entscheidungsgrundlage“.' }),
      dec.caveats.length || dec.notes.length ? h('ul', null, dec.caveats.concat(dec.notes).map(function (c) { return h('li', { text: c }); })) : null));
    root.lastChild.classList.add('mt');

    var tabs = [
      ['overview', 'Überblick'], ['results', 'Ergebnisse nach Bereichen'], ['texts', 'Freitexte'],
      ['decision', 'Entscheidungsgrundlage'], ['manage', 'Verwaltung'],
    ];
    var panel = h('div', { id: 'panel', role: 'tabpanel' });
    var tabBar = h('div', { class: 'tabs', role: 'tablist' }, tabs.map(function (t) {
      return h('button', { type: 'button', class: 'tab', role: 'tab', 'aria-selected': String(activeTab === t[0]), onclick: function () {
        activeTab = t[0];
        try { sessionStorage.setItem('admin-tab', activeTab); } catch (e) { /* egal */ }
        renderDashboard();
      } }, t[1]);
    }));
    root.appendChild(tabBar);
    root.appendChild(panel);
    ({ overview: tabOverview, results: tabResults, texts: tabTexts, decision: tabDecision, manage: tabManage }[activeTab] || tabOverview)(panel, d);
  }

  function kpi(k, v, s) {
    return h('div', { class: 'kpi' }, h('div', { class: 'k', text: k }), h('div', { class: 'v', text: v }), s ? h('div', { class: 's', text: s }) : null);
  }

  function autoBox(title, items, note) {
    return h('div', { class: 'autobox' },
      h('span', { class: 'badge auto', text: 'Automatische Auswertung · ' + title }),
      h('ul', null, (items.length ? items : ['Keine Einträge.']).map(function (i) { return h('li', { text: i }); })),
      note ? h('div', { class: 'note', text: note }) : null);
  }

  function tabOverview(p, d) {
    if (d.n === 0) {
      p.appendChild(h('div', { class: 'card notice', text: 'Es liegen noch keine Rückmeldungen vor. Teile den Link zum Fragebogen (siehe „Verwaltung“) mit den Klassenleitungen.' }));
      return;
    }
    var ind = d.indicators;
    p.appendChild(h('div', { class: 'kpis' },
      kpi('Anspruch angemessen', pct(ind.levelOk.pct), ind.levelOk.count + ' von ' + ind.levelOk.valid + ' (Frage 3)'),
      kpi('Interesse sehr/eher groß', pct(ind.interestPos.pct), ind.interestPos.count + ' von ' + ind.interestPos.valid + ' (Frage 6)'),
      kpi('Etablierung befürwortet', pct(ind.establishPos.pct), ind.establishPos.count + ' von ' + ind.establishPos.valid + ' (Frage 12)'),
      kpi('Jahrgang 7 denkbar', pct(ind.grade7Yes.pct), ind.grade7Yes.count + ' von ' + ind.grade7Yes.valid + ' (Frage 5)')));
    p.appendChild(h('div', { class: 'grid-2 mt' },
      h('div', { class: 'card' }, h('h3', { text: 'Zusammenfassung der wichtigsten Ergebnisse' }), h('ul', null, d.summary.map(function (s) { return h('li', { text: s }); }))),
      h('div', { class: 'card' },
        h('h3', { text: 'Entscheidungsrelevante Einschätzungen' }),
        autoBox('Interesse', [d.interest.text]),
        autoBox('Jahrgang 7', [d.grade7.text]),
        autoBox('Stärken (quantitativ)', d.strengths.map(function (s) { return s.label + ' (F' + s.question + '): ' + pct(s.pct) + ' positiv'; }), 'Schwelle: mind. 75 % positiv bei mind. 3 inhaltlichen Antworten.'),
        autoBox('Verbesserungsbedarfe', d.improvementThemes.slice(0, 5).map(function (t) { return t.label + ' – ' + t.count + ' Nennungen (Fragen ' + t.sources.join(', ') + ')'; }).concat(d.concerns),
          'Themen per Stichwortabgleich (mind. ' + d.minThemeMentions + ' Nennungen); erkennt das Thema, nicht die Bewertung.'))));
  }

  function chart(s) {
    var box = h('div', { class: 'chart' + (s.keyQuestion ? ' key' : '') });
    if (s.keyQuestion) box.appendChild(h('span', { class: 'badge key', text: 'Entscheidungsrelevant' }));
    box.appendChild(h('h4', { text: 'Frage ' + s.number + ': ' + s.text }));
    s.options.forEach(function (op) {
      var fill = h('div', { class: 'bar-fill ' + op.tone });
      fill.style.width = (op.pct || 0) + '%';
      box.appendChild(h('div', { class: 'bar-row' + (op.tone === 'nb' ? ' nb' : '') },
        h('div', { text: op.label }),
        h('div', { class: 'bar-track', role: 'img', 'aria-label': op.label + ': ' + op.count + ' Antworten, ' + pct(op.pct) }, fill),
        h('div', { class: 'bar-val' + (op.count ? '' : ' zero'), text: op.count + ' (' + pct(op.pct) + ')' })));
    });
    box.appendChild(h('div', { class: 'meta', text: s.hasNb
      ? 'Antworten: ' + s.answered + ' · inhaltlich gültig: ' + s.valid + ' · „' + s.nbLabel + '“: ' + s.nbCount + ' (' + pct(s.nbPct) + ' aller Antworten). Prozentwerte beziehen sich auf die inhaltlich gültigen Antworten.'
      : 'Gültige Antworten: ' + s.valid + '.' }));
    return box;
  }

  function textBlock(field, d) {
    var block = h('div', { class: 'text-block' },
      h('h4', { text: 'Frage ' + field.number + (field.parent ? ' (Ergänzung)' : '') + ': ' + field.label }),
      h('div', { class: 'small muted', text: field.entries.length + ' Rückmeldung(en) – Aussagen der Lehrkräfte, wörtlich und vollständig' }));
    if (field.entries.length) {
      block.appendChild(h('ol', { class: 'statements' }, field.entries.map(function (e) {
        return h('li', null, h('span', { class: 'no', text: String(e.no) }), h('span', { class: 'txt', text: e.text }));
      })));
      block.appendChild(autoBox('Wiederkehrende Themen',
        field.themes.length ? field.themes.map(function (t) { return t.label + ': ' + t.count + ' Nennungen (Nr. ' + t.refs.join(', ') + ')'; }) : ['Keine wiederkehrenden Themen erkannt.'],
        'Automatisch per Stichwortabgleich gebündelt (mind. ' + d.minThemeMentions + ' Nennungen). Keine Aussage der Lehrkräfte; maßgeblich sind die wörtlichen Antworten.'));
    }
    return block;
  }

  function tabResults(p, d) {
    d.sections.forEach(function (sec) {
      var card = h('div', { class: 'card' }, h('div', { class: 'eyebrow', text: 'Bereich ' + sec.id }), h('h2', { class: 'section-title', text: sec.title }));
      d.definition.questions.filter(function (q) { return q.section === sec.id; }).forEach(function (q) {
        if (q.type === 'single') {
          card.appendChild(chart(d.closed[q.id]));
          if (q.followUp) card.appendChild(textBlock(d.texts[q.followUp.id], d));
        } else {
          card.appendChild(textBlock(d.texts[q.id], d));
        }
      });
      p.appendChild(card);
    });
  }

  function tabTexts(p, d) {
    var card = h('div', { class: 'card' },
      h('h2', { class: 'section-title', text: 'Alle Freitextantworten' }),
      h('p', { class: 'muted small', text: 'Reihenfolge zufällig (nicht chronologisch). Klassenangaben werden hier bewusst nicht angezeigt.' }));
    Object.keys(d.texts).forEach(function (k) { card.appendChild(textBlock(d.texts[k], d)); });
    p.appendChild(card);
  }

  function tabDecision(p, d) {
    var ind = d.indicators;
    var rows = [
      ['Weiterempfehlung (F2, beide Ja-Stufen)', ind.recommendPos], ['davon uneingeschränkt', ind.recommendFull], ['Weiterempfehlung „Nein“ (F2)', ind.recommendNo],
      ['Anspruch genau angemessen (F3)', ind.levelOk], ['Anspruch (eher/deutlich) zu hoch (F3)', ind.levelHigh], ['Anspruch (eher/deutlich) zu niedrig (F3)', ind.levelLow],
      ['Gesamteindruck sehr/eher gelungen (F1)', ind.overallPos], ['Gesamteindruck negativ (F1)', ind.overallNeg],
      ['Interesse sehr/eher groß (F6)', ind.interestPos], ['Jahrgang 7 denkbar (F5)', ind.grade7Yes],
      ['Etablierung befürwortet (F12)', ind.establishPos], ['davon „Ja, unbedingt“', ind.establishFull], ['Nur nach Überarbeitung oder Nein (F12)', ind.establishReviseOrNo],
    ];
    p.appendChild(h('div', { class: 'card' },
      h('h2', { class: 'section-title', text: 'Kennzahlen' }),
      h('div', { class: 'table-wrap' }, h('table', { class: 'simple' },
        h('thead', null, h('tr', null, h('th', { text: 'Kennzahl' }), h('th', { text: 'Anteil' }), h('th', { text: 'Anzahl / Basis' }))),
        h('tbody', null, rows.map(function (r) {
          return h('tr', null, h('td', { text: r[0] }), h('td', { class: 'num', text: pct(r[1].pct) }), h('td', { class: 'num', text: r[1].count + ' / ' + r[1].valid }));
        }))))));
    p.appendChild(h('div', { class: 'card' },
      h('h2', { class: 'section-title', text: 'Offengelegte Entscheidungsregeln' }),
      h('p', { class: 'muted small', text: 'Prüfung in dieser Reihenfolge; die erste zutreffende Regel bestimmt die Einschätzung. Prozentwerte beziehen sich auf inhaltlich gültige Antworten (ohne „nicht beurteilbar“).' }),
      d.decision.rules.map(function (r, i) {
        return h('div', { class: 'rule' + (r.applied ? ' applied' : '') },
          h('div', { class: 'head' }, h('span', { text: 'Regel ' + (i + 1) + ': ' + r.label + (r.fallback ? ' (Auffangregel)' : '') }),
            h('span', { class: 'status-chip', text: r.applied ? 'angewendet' : r.met ? 'erfüllt, nachrangig' : 'nicht erfüllt' })),
          h('div', { class: 'desc', text: r.description }));
      }),
      h('p', { class: 'muted small', text: 'Belastbarkeit „gut belastbar“: mind. 5 Rückmeldungen, Rücklauf mind. 67 %, kein widersprüchliches Antwortbild (je mind. 30 % zustimmend und kritisch bei Frage 1, 2 oder 12); sonst „eingeschränkt belastbar“.' })));
  }

  function tabManage(p, d) {
    var link = location.href.replace(/admin\/?(#.*)?$/, '');
    var linkInput = h('input', { type: 'text', readonly: true, value: link, 'aria-label': 'Link zum Fragebogen' });
    var expected = h('input', { type: 'number', min: '1', max: '500', id: 'expected', value: d.expected ? String(d.expected) : '' });

    p.appendChild(h('div', { class: 'grid-2' },
      h('div', { class: 'card' },
        h('h2', { class: 'section-title', text: 'Teilnahme' }),
        h('div', { class: 'form-row' }, h('label', { text: 'Link für die Klassenleitungen' }),
          h('div', { class: 'copy-field' }, linkInput, h('button', { type: 'button', class: 'btn small secondary', onclick: function () {
            linkInput.select();
            (navigator.clipboard ? navigator.clipboard.writeText(link) : Promise.reject()).then(function () { toast('Link kopiert.'); }, function () { document.execCommand('copy'); toast('Link kopiert.'); });
          } }, 'Kopieren'))),
        h('div', { class: 'form-row' }, h('label', { for: 'expected', text: 'Erwartete Anzahl Klassenleitungen (für Rücklaufquote)' }),
          h('div', { class: 'inline' }, expected, h('button', { type: 'button', class: 'btn small', onclick: function () {
            var v = expected.value.trim();
            api('settings', { method: 'PUT', body: { expected: v === '' ? null : Number(v) } }).then(function () { toast('Gespeichert.'); loadDashboard(); }, function (e) { toast(e.message); });
          } }, 'Speichern'))),
        h('div', { class: 'form-row' }, h('label', { text: 'Status der Evaluation' }),
          h('div', { class: 'inline' },
            h('span', { class: 'badge ' + (d.open ? 'open' : 'closed'), text: d.open ? 'geöffnet' : 'geschlossen' }),
            h('button', { type: 'button', class: 'btn small ' + (d.open ? 'danger' : ''), onclick: function () {
              if (d.open && !confirm('Evaluation jetzt schließen? Danach können keine Antworten mehr abgegeben werden (jederzeit wieder zu öffnen).')) return;
              api('settings', { method: 'PUT', body: { open: !d.open } }).then(function () { toast(d.open ? 'Evaluation geschlossen.' : 'Evaluation geöffnet.'); loadDashboard(); });
            } }, d.open ? 'Evaluation schließen' : 'Evaluation wieder öffnen'))),
        d.classes.distinct.length ? h('p', { class: 'small muted', text: 'Freiwillig angegebene Klassen (ohne Zuordnung zu Antworten): ' + d.classes.distinct.join(', ') }) : null),
      h('div', { class: 'card' },
        h('h2', { class: 'section-title', text: 'Export und Datensicherung' }),
        h('p', { class: 'small muted', text: 'Der PDF-Bericht wird bei jedem Abruf aus dem aktuellen Datenstand erzeugt. Die CSV-Datei (Semikolon, UTF-8) lässt sich direkt in Excel öffnen. Die JSON-Sicherung kann mit „npm run restore“ wieder eingespielt werden.' }),
        h('div', { class: 'inline' },
          h('a', { class: 'btn small', href: API + 'report.pdf', download: '' }, 'PDF-Bericht'),
          h('a', { class: 'btn small secondary', href: API + 'export.csv', download: '' }, 'CSV-Rohdaten'),
          h('a', { class: 'btn small secondary', href: API + 'backup.json', download: '' }, 'Datensicherung (JSON)')),
        h('div', { class: 'notice mt', text: 'Exporte enthalten alle Antworten inkl. freiwilliger Klassenangabe. Bitte nur auf dienstlichen, geschützten Geräten speichern und nach Abschluss löschen.' }))));

    // Einzelne Antworten (z. B. Testabgaben löschen)
    var listCard = h('div', { class: 'card' }, h('h2', { class: 'section-title', text: 'Einzelne Abgaben verwalten' }),
      h('p', { class: 'small muted', text: 'Zum Entfernen von Test- oder Fehlabgaben. Die Reihenfolge ist zufällig; Klassenangaben werden hier bewusst nicht angezeigt.' }));
    var listBody = h('div', { class: 'small muted', text: 'Wird geladen …' });
    listCard.appendChild(listBody);
    p.appendChild(listCard);
    api('responses').then(function (rows) {
      listBody.innerHTML = '';
      if (!rows.length) { listBody.textContent = 'Keine Abgaben vorhanden.'; return; }
      var q1 = d.definition.questions[0];
      listBody.className = 'table-wrap';
      listBody.appendChild(h('table', { class: 'simple' },
        h('thead', null, h('tr', null, h('th', { text: 'Nr.' }), h('th', { text: 'Datum' }), h('th', { text: 'Gesamteindruck (F1)' }), h('th', { text: '' }))),
        h('tbody', null, rows.map(function (r) {
          var op = q1.options.filter(function (o) { return o.value === r.q1; })[0];
          return h('tr', null, h('td', { text: String(r.no) }), h('td', { text: r.submittedOn }), h('td', { text: op ? op.label : '–' }),
            h('td', null, h('button', { type: 'button', class: 'btn small danger', onclick: function () {
              if (!confirm('Abgabe Nr. ' + r.no + ' endgültig löschen?')) return;
              api('responses/' + r.id, { method: 'DELETE' }).then(function () { toast('Abgabe gelöscht.'); loadDashboard(); }, function (e) { toast(e.message); });
            } }, 'Löschen')));
        }))));
    }).catch(function () { listBody.textContent = 'Liste konnte nicht geladen werden.'; });

    var confirmInput = h('input', { type: 'text', id: 'confirm-del', autocomplete: 'off', placeholder: 'LÖSCHEN' });
    p.appendChild(h('div', { class: 'card' },
      h('h2', { class: 'section-title', text: 'Alle Daten löschen' }),
      h('p', { class: 'small', text: 'Löscht unwiderruflich alle gespeicherten Antworten (z. B. nach Abschluss der Auswertung oder vor einer neuen Durchführung). Vorher ggf. PDF-Bericht und Datensicherung herunterladen. Einstellungen (Status, erwartete Anzahl) bleiben erhalten.' }),
      h('div', { class: 'form-row' }, h('label', { for: 'confirm-del', text: 'Zur Bestätigung „LÖSCHEN“ eingeben' }),
        h('div', { class: 'inline' }, confirmInput, h('button', { type: 'button', class: 'btn small danger', onclick: function () {
          api('responses/delete-all', { method: 'POST', body: { confirm: confirmInput.value.trim() } })
            .then(function (r) { toast(r.deleted + ' Abgaben gelöscht.'); loadDashboard(); }, function (e) { toast(e.message); });
        } }, 'Alle Antworten löschen')))));
  }

  /* ---------- Start ---------- */
  fetch(API + 'session', { cache: 'no-store', credentials: 'same-origin' })
    .then(function (r) { return r.json(); })
    .then(function (s) { if (s.authenticated) loadDashboard(); else renderLogin(s.configured); })
    .catch(function () { root.innerHTML = ''; root.appendChild(h('div', { class: 'card notice error', text: 'Server nicht erreichbar.' })); });
})();
