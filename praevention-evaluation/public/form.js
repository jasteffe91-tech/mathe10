/* Fragebogen – Evaluation Präventionsangebot (ohne externe Bibliotheken) */
(function () {
  'use strict';

  var API = 'api/';
  var DRAFT_KEY = 'praev-eval-draft-v1';
  var DONE_KEY = 'praev-eval-submitted-v1';

  var app = document.getElementById('app');
  var def = null;
  var state = { step: 0, classLabel: '', answers: {}, token: newToken(), submitting: false };

  /* ---------- Hilfsfunktionen ---------- */

  function newToken() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    var a = new Uint8Array(16);
    (window.crypto || window.msCrypto).getRandomValues(a);
    return Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('').replace(/^(.{8})(.{4})(.{4})(.{4})/, '$1-$2-$3-$4-');
  }

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

  function store(key, value) {
    try {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(value));
    } catch (e) { /* Speicher nicht verfügbar – Formular funktioniert trotzdem */ }
  }
  function load(key) {
    try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch (e) { return null; }
  }
  function saveDraft() { store(DRAFT_KEY, { classLabel: state.classLabel, answers: state.answers, token: state.token, step: state.step }); }

  function sectionQuestions(sectionId) {
    return def.questions.filter(function (q) { return q.section === sectionId; });
  }
  function requiredQuestions() { return def.questions.filter(function (q) { return q.required; }); }
  function answeredRequired() { return requiredQuestions().filter(function (q) { return !!state.answers[q.id]; }).length; }
  function optionLabel(q, v) {
    var op = q.options.filter(function (o) { return o.value === v; })[0];
    return op ? op.label : '';
  }
  function scrollTop() { window.scrollTo({ top: 0, behavior: 'smooth' }); }

  /* ---------- Ansichten ---------- */

  function render() {
    app.innerHTML = '';
    if (state.step === 0) return renderIntro();
    if (state.step >= 1 && state.step <= def.sections.length) return renderSection(def.sections[state.step - 1]);
    if (state.step === def.sections.length + 1) return renderReview();
  }

  function progress() {
    var total = def.sections.length + 1;
    var current = state.step;
    var pct = Math.round((answeredRequired() / requiredQuestions().length) * 100);
    var fill = h('div', { class: 'progress-fill' });
    fill.style.width = pct + '%';
    var dots = [];
    def.sections.forEach(function (s, i) {
      var n = i + 1;
      dots.push(h('span', { class: 'step-dot' + (n === current ? ' current' : n < current ? ' done' : ''), text: s.id }));
    });
    dots.push(h('span', { class: 'step-dot' + (current === total ? ' current' : ''), text: 'Prüfen' }));
    return h('div', { class: 'progress' },
      h('div', { class: 'progress-top' },
        h('span', { text: current <= def.sections.length ? 'Bereich ' + current + ' von ' + def.sections.length : 'Antworten überprüfen' }),
        h('span', { text: pct + ' % der Pflichtfragen beantwortet' })),
      h('div', { class: 'progress-track', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(pct), 'aria-label': 'Fortschritt' }, fill),
      h('div', { class: 'steps', 'aria-hidden': 'true' }, dots));
  }

  function renderIntro() {
    var draft = load(DRAFT_KEY);
    var previously = load(DONE_KEY);
    var hasDraft = draft && draft.answers && Object.keys(draft.answers).length > 0;
    var classInput = h('input', { type: 'text', id: 'classLabel', maxlength: String(def.limits.classLabel), autocomplete: 'off', placeholder: 'z. B. 8c', value: state.classLabel || '' });
    classInput.addEventListener('input', function () { state.classLabel = classInput.value; saveDraft(); });

    app.appendChild(h('div', { class: 'card' },
      h('div', { class: 'eyebrow', text: 'Befragung der Klassenleitungen · Jahrgang 8' }),
      h('h1', { class: 'page-title', text: def.meta.title }),
      h('p', { class: 'lead', text: 'Das Präventionsangebot wurde von Mitarbeiterinnen der Jugendhilfe der Stadt Voerde in deiner Klasse durchgeführt. Deine Einschätzung hilft der Abteilungsleitung bei der Entscheidung, ob und in welcher Form das Angebot künftig fortgeführt wird.' }),
      h('div', { class: 'facts' },
        h('div', { class: 'fact' }, h('strong', { text: 'Dauer' }), 'ca. 5–7 Minuten'),
        h('div', { class: 'fact' }, h('strong', { text: 'Umfang' }), '14 Fragen in 5 Bereichen'),
        h('div', { class: 'fact' }, h('strong', { text: 'Teilnahme' }), 'anonym, ohne Registrierung')),
      h('p', null, 'Pflichtfragen sind mit ', h('span', { class: 'req', text: '*' }), ' gekennzeichnet. Alle Freitextfelder sind freiwillig. Vor dem Absenden kannst du alle Antworten noch einmal überprüfen.'),
      h('div', { class: 'notice' },
        h('strong', { text: 'Datenschutz: ' }),
        'Es werden keine Namen, IP-Adressen oder Gerätedaten gespeichert. Bitte nenne in den Freitexten keine Namen von Schülerinnen und Schülern oder anderen Personen. Die Ergebnisse sieht ausschließlich die Abteilungsleitung (WIDE). Dein Zwischenstand wird nur lokal in diesem Browser gespeichert.'),
      h('div', { class: 'form-row', style: null },
        h('label', { for: 'classLabel' }, 'Klasse ', h('span', { class: 'optional-tag', text: 'freiwillig' })),
        classInput,
        h('div', { class: 'privacy-hint', text: 'Die Angabe ist freiwillig. Im Bericht wird sie nicht mit einzelnen Antworten verknüpft.' })),
      previously ? h('div', { class: 'notice ok' }, 'Von diesem Gerät wurde bereits eine Evaluation abgegeben. Falls du eine weitere Klasse leitest oder das Gerät geteilt wird, kannst du trotzdem einen neuen Bogen ausfüllen.') : null,
      h('div', { class: 'actions' },
        hasDraft ? h('button', { type: 'button', class: 'btn secondary', onclick: function () {
          store(DRAFT_KEY, null);
          state.answers = {}; state.classLabel = ''; state.token = newToken();
          render();
        } }, 'Neu beginnen') : h('span', { class: 'spacer' }),
        h('button', { type: 'button', class: 'btn', onclick: function () { state.step = 1; saveDraft(); render(); scrollTop(); } },
          hasDraft ? 'Bearbeitung fortsetzen' : 'Evaluation starten'))));
  }

  function questionNode(q) {
    var id = 'q-' + q.id;
    if (q.type === 'single') {
      var fs = h('fieldset', { class: 'question', id: id, 'aria-describedby': q.required ? id + '-err' : null });
      fs.appendChild(h('legend', null,
        h('span', { class: 'q-number', text: q.number + '.' }), q.text,
        q.required ? h('span', { class: 'req', 'aria-hidden': 'true', text: ' *' }) : null,
        q.required ? h('span', { class: 'sr-only', text: ' (Pflichtfrage)' }) : null));
      var opts = h('div', { class: 'options', role: 'radiogroup' });
      q.options.forEach(function (op) {
        var input = h('input', { type: 'radio', name: q.id, value: op.value, required: q.required ? true : null });
        if (state.answers[q.id] === op.value) input.checked = true;
        input.addEventListener('change', function () {
          state.answers[q.id] = op.value;
          fs.classList.remove('invalid');
          var err = document.getElementById(id + '-err'); if (err) err.hidden = true;
          saveDraft();
          updateProgress();
        });
        opts.appendChild(h('label', { class: 'option' + (op.tone === 'nb' ? ' nb' : '') }, input, h('span', { class: 'option-body', text: op.label })));
      });
      fs.appendChild(opts);
      fs.appendChild(h('div', { class: 'field-error', id: id + '-err', hidden: true, role: 'alert' }, 'Bitte wähle eine Antwort aus.'));
      if (q.followUp) fs.appendChild(textArea(q.followUp.id, q.followUp.label, null, true, true));
      return fs;
    }
    var wrap = h('div', { class: 'question', id: id });
    wrap.appendChild(textArea(q.id, q.text, q.help, false, false, q.number));
    return wrap;
  }

  function textArea(fieldId, label, help, isFollowUp, short, number) {
    var tid = 't-' + fieldId;
    var max = def.limits.text;
    var ta = h('textarea', { id: tid, maxlength: String(max), class: short ? 'short' : null, 'aria-describedby': help ? tid + '-help' : null });
    ta.value = state.answers[fieldId] || '';
    var counter = h('div', { class: 'char-count', 'aria-live': 'polite' });
    function upd() { counter.textContent = ta.value.length + ' / ' + max + ' Zeichen'; }
    upd();
    ta.addEventListener('input', function () {
      if (ta.value.trim()) state.answers[fieldId] = ta.value; else delete state.answers[fieldId];
      upd(); saveDraft();
    });
    return h('div', { class: isFollowUp ? 'followup' : null },
      h('label', { for: tid, class: isFollowUp ? null : 'q-label' },
        number ? h('span', { class: 'q-number', text: number + '.' }) : null,
        label, h('span', { class: 'optional-tag', text: 'freiwillig' })),
      help ? h('p', { class: 'help', id: tid + '-help', text: help }) : null,
      ta, counter);
  }

  var progressHolder = null;
  function updateProgress() {
    if (!progressHolder) return;
    var p = progress();
    progressHolder.replaceWith(p);
    progressHolder = p;
  }

  function renderSection(sec) {
    progressHolder = progress();
    app.appendChild(progressHolder);
    var card = h('div', { class: 'card' },
      h('div', { class: 'eyebrow', text: 'Bereich ' + sec.id }),
      h('h2', { class: 'section-title', text: sec.title }));
    sectionQuestions(sec.id).forEach(function (q) { card.appendChild(questionNode(q)); });
    var last = state.step === def.sections.length;
    card.appendChild(h('div', { class: 'actions' },
      h('button', { type: 'button', class: 'btn secondary', onclick: function () { state.step -= 1; saveDraft(); render(); scrollTop(); } }, 'Zurück'),
      h('button', { type: 'button', class: 'btn', onclick: function () {
        if (!validateSection(sec)) return;
        state.step += 1; saveDraft(); render(); scrollTop();
      } }, last ? 'Antworten überprüfen' : 'Weiter')));
    app.appendChild(card);
  }

  function validateSection(sec) {
    var firstInvalid = null;
    sectionQuestions(sec.id).forEach(function (q) {
      if (q.required && !state.answers[q.id]) {
        var el = document.getElementById('q-' + q.id);
        el.classList.add('invalid');
        document.getElementById('q-' + q.id + '-err').hidden = false;
        if (!firstInvalid) firstInvalid = el;
      }
    });
    if (firstInvalid) {
      firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
      var input = firstInvalid.querySelector('input');
      if (input) input.focus({ preventScroll: true });
      return false;
    }
    return true;
  }

  function renderReview() {
    progressHolder = progress();
    app.appendChild(progressHolder);
    var card = h('div', { class: 'card' },
      h('div', { class: 'eyebrow', text: 'Letzter Schritt' }),
      h('h2', { class: 'section-title', text: 'Antworten überprüfen' }),
      h('p', { class: 'muted', text: 'Bitte kontrolliere deine Angaben. Über „Ändern“ gelangst du zum jeweiligen Bereich zurück. Nach dem Absenden sind keine Änderungen mehr möglich.' }));

    var missing = requiredQuestions().filter(function (q) { return !state.answers[q.id]; });
    card.appendChild(h('div', { class: 'review-section' },
      h('div', { class: 'review-item' }, h('div', { class: 'q', text: 'Klasse (freiwillig)' }),
        h('div', { class: 'a' + (state.classLabel.trim() ? '' : ' empty'), text: state.classLabel.trim() || 'keine Angabe' }))));

    def.sections.forEach(function (sec, i) {
      var block = h('div', { class: 'review-section' },
        h('h3', null, h('span', { text: sec.id + ' · ' + sec.title }),
          h('button', { type: 'button', class: 'link-btn', onclick: function () { state.step = i + 1; saveDraft(); render(); scrollTop(); } }, 'Ändern')));
      sectionQuestions(sec.id).forEach(function (q) {
        var val = q.type === 'single' ? optionLabel(q, state.answers[q.id]) : (state.answers[q.id] || '').trim();
        block.appendChild(h('div', { class: 'review-item' },
          h('div', { class: 'q', text: q.number + '. ' + q.text }),
          h('div', { class: 'a' + (val ? '' : ' empty'), text: val || (q.required ? 'Noch nicht beantwortet (Pflichtfrage)' : 'keine Angabe') })));
        if (q.followUp) {
          var fv = (state.answers[q.followUp.id] || '').trim();
          block.appendChild(h('div', { class: 'review-item' },
            h('div', { class: 'q', text: q.followUp.label }),
            h('div', { class: 'a' + (fv ? '' : ' empty'), text: fv || 'keine Angabe' })));
        }
      });
      card.appendChild(block);
    });

    var errorBox = h('div', { class: 'notice error', hidden: true, role: 'alert' });
    if (missing.length) {
      errorBox.hidden = false;
      errorBox.textContent = 'Bitte beantworte noch folgende Pflichtfragen: ' + missing.map(function (q) { return q.number; }).join(', ') + '.';
    }
    card.appendChild(h('div', { class: 'actions' },
      h('button', { type: 'button', class: 'btn secondary', onclick: function () { state.step -= 1; saveDraft(); render(); scrollTop(); } }, 'Zurück'),
      submitButton(errorBox, missing.length > 0)));
    card.insertBefore(errorBox, card.lastChild);
    app.appendChild(card);
  }

  function submitButton(errorBox, blocked) {
    var btn = h('button', { type: 'button', class: 'btn', disabled: blocked ? true : null }, 'Evaluation verbindlich absenden');
    btn.addEventListener('click', function () {
      if (state.submitting) return; // Schutz gegen Mehrfachklick
      state.submitting = true;
      btn.disabled = true;
      btn.textContent = '';
      btn.appendChild(h('span', { class: 'spinner', 'aria-hidden': 'true' }));
      btn.appendChild(document.createTextNode(' Wird gesendet …'));
      send(0);

      function send(attempt) {
        fetch(API + 'responses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: state.token, classLabel: state.classLabel.trim() || null, answers: state.answers }),
        }).then(function (res) {
          return res.json().catch(function () { return {}; }).then(function (body) { return { res: res, body: body }; });
        }).then(function (r) {
          if (r.res.ok) return renderDone();
          var msg = r.body.error || 'Die Antworten konnten nicht gespeichert werden.';
          if (r.body.details && r.body.details.length) msg += ' ' + r.body.details.join(' ');
          fail(msg);
        }).catch(function () {
          // Netzwerkfehler: mit identischem Token erneut versuchen – der Server speichert nicht doppelt.
          if (attempt < 2) return setTimeout(function () { send(attempt + 1); }, 1200 * (attempt + 1));
          fail('Keine Verbindung zum Server. Deine Antworten sind lokal gesichert – bitte versuche es gleich noch einmal.');
        });
      }
      function fail(msg) {
        state.submitting = false;
        btn.disabled = false;
        btn.textContent = 'Erneut versuchen';
        errorBox.hidden = false;
        errorBox.textContent = msg;
        errorBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
    return btn;
  }

  function renderDone() {
    store(DRAFT_KEY, null);
    store(DONE_KEY, { on: new Date().toISOString().slice(0, 10) });
    state = { step: 0, classLabel: '', answers: {}, token: newToken(), submitting: false };
    app.innerHTML = '';
    app.appendChild(h('div', { class: 'card', tabindex: '-1', id: 'done' },
      h('div', { class: 'done-icon', 'aria-hidden': 'true' },
        svgCheck()),
      h('h1', { class: 'page-title', text: 'Vielen Dank für deine Rückmeldung!' }),
      h('p', { class: 'lead', text: 'Deine Antworten wurden anonym und erfolgreich gespeichert.' }),
      h('p', { class: 'muted', text: 'Die Ergebnisse werden von der Abteilungsleitung (WIDE, BL Abt. II) gesammelt ausgewertet und fließen in die Entscheidung über die zukünftige Durchführung des Präventionsangebots ein. Du kannst dieses Fenster jetzt schließen.' })));
    scrollTop();
    document.getElementById('done').focus({ preventScroll: true });
  }

  function svgCheck() {
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', '#3E6450');
    svg.setAttribute('stroke-width', '2.5');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    var p = document.createElementNS(ns, 'path');
    p.setAttribute('d', 'M5 12.5l4.5 4.5L19 7.5');
    svg.appendChild(p);
    return svg;
  }

  function renderMessage(title, text, kind) {
    app.innerHTML = '';
    app.appendChild(h('div', { class: 'card' },
      h('h1', { class: 'page-title', text: title }),
      h('div', { class: 'notice' + (kind ? ' ' + kind : ''), text: text })));
  }

  /* ---------- Start ---------- */

  fetch(API + 'form', { cache: 'no-store' })
    .then(function (r) { if (!r.ok) throw new Error(); return r.json(); })
    .then(function (data) {
      def = data;
      if (!data.open) {
        return renderMessage('Evaluation geschlossen', 'Die Evaluation ist derzeit geschlossen. Es können keine Antworten mehr abgegeben werden. Vielen Dank für dein Interesse.');
      }
      var draft = load(DRAFT_KEY);
      if (draft && draft.answers) {
        state.answers = draft.answers;
        state.classLabel = draft.classLabel || '';
        if (draft.token) state.token = draft.token;
      }
      render();
    })
    .catch(function () {
      renderMessage('Fragebogen nicht erreichbar', 'Der Fragebogen konnte nicht geladen werden. Bitte prüfe die Internetverbindung und lade die Seite neu.', 'error');
    });
})();
