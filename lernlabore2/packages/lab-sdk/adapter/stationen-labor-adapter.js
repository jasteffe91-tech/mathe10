/*
 * Adapter für bestehende „Stationen-Labore“ (Muster: Zustand S.d, Aufgabenliste AUFG,
 * Funktionen istFertig(a), zaehlt(a), speichern(), init(); jede Aufgabe als Element mit id = a.id).
 * Betroffen u. a.: labor/physik/arbeit-leistung, labor/nw/elektrizitaet, labor/mathe/{funktionen,stochastik,terme,zins-berichtigung}
 *
 * Einbau (siehe docs/INTEGRATION-10-SCHRITTE.md):
 *   <script src="…/lernlabore2/site/config.js"></script>
 *   <script src="…/lernlabore2/site/sdk/lernlabor-sdk.js"></script>
 *   <script src="…/lernlabore2/site/sdk/stationen-labor-adapter.js"></script>
 * und am Ende des Labor-Skripts  init();  ersetzen durch:
 *   LernlaborAdapter.start({ labId: 'mein-labor', labVersion: '1.0', title: 'Mein Labor' });
 * Ohne SDK (z. B. Datei lokal geöffnet) läuft das Labor unverändert wie bisher.
 */
(function () {
  'use strict';

  function taskId(a) { return String(a.id).toLowerCase().replace(/[^a-z0-9._-]/g, '-'); }

  /** Alle Eingabewerte einer Aufgabe (aus dem DOM-Bereich der Aufgabe) plus Prüfvermerke. */
  function felder(a) {
    var el = document.getElementById(a.id), out = {};
    if (!el) return out;
    el.querySelectorAll('[data-k]').forEach(function (x) {
      var k = x.dataset.k;
      [k, k + '.ok', k + '.ausgewertet'].forEach(function (kk) { if (S.d[kk] != null && S.d[kk] !== '') out[kk] = S.d[kk]; });
    });
    return out;
  }

  function daten(a) {
    var d = {};
    if (a.tab && Array.isArray(S[a.tab])) { d.tabellen = {}; d.tabellen[a.tab] = S[a.tab]; }
    return d;
  }

  function manifestAusAufg(o) {
    return {
      id: o.labId, version: o.labVersion, title: o.title || document.title,
      tasks: AUFG.filter(zaehlt).map(function (a) {
        return { task_id: taskId(a), title: (a.nr ? a.nr + ' ' : '') + (a.titel || a.ph || a.frage || 'Aufgabe'),
          section: a.st && a.st.titel ? 'Station ' + a.st.nr + ': ' + a.st.titel : '', kind: a.art === 'messung' ? 'measurement' : a.art === 'text' ? 'text' : 'other' };
      })
    };
  }

  async function start(o) {
    if (!window.Lernlabor) { init(); return null; } // ohne SDK: altes Verhalten
    var manifest = o.manifest || manifestAusAufg(o);
    var lab = await Lernlabor.initializeLab({ labId: manifest.id, labVersion: manifest.version, manifest: manifest, title: manifest.title });

    // 1) Server-Stand ist maßgeblich: alten lokalen Stand (anderer Personen) verwerfen und gespeicherte Antworten übernehmen
    S = neuerZustand();
    Object.values(lab.getResults()).forEach(function (r) {
      Object.assign(S.d, (r.answer && r.answer.felder) || {});
      var t = r.data && r.data.tabellen;
      if (t) Object.keys(t).forEach(function (n) { S[n] = t[n]; });
    });
    // 2) Namen werden nicht mehr gebraucht: Kennung statt Name (z. B. im freiwilligen PDF)
    S.d.vorname = lab.participant.pseudonym;
    S.d.nachname = '(Kennung)';
    // „Seite wirklich verlassen?“ nur noch, wenn Änderungen nicht beim Server angekommen sind
    Object.defineProperty(S, 'exportiert', { get: function () { return lab.pendingCount() === 0; }, set: function () {}, enumerable: false });
    if (o.klasse) S.d.klasse = o.klasse;
    init();
    ['vorname', 'nachname'].forEach(function (id) {
      var f = document.getElementById(id);
      if (f) { f.closest('div').style.display = 'none'; }
    });

    // 3) Nach jedem lokalen Speichern: abgeschlossene, geänderte Aufgaben an den Server
    var zuletzt = {};
    AUFG.filter(zaehlt).forEach(function (a) { var r = lab.getResult(taskId(a)); if (r) zuletzt[a.id] = JSON.stringify([r.answer, r.data]); });
    var timer = null;
    function abgleichen() {
      AUFG.filter(zaehlt).forEach(function (a) {
        var fertig = istFertig(a);
        var ans = { felder: felder(a) }, dat = daten(a);
        var sig = JSON.stringify([ans, dat]);
        var leer = !Object.keys(ans.felder).length && !(dat.tabellen && Object.keys(dat.tabellen).some(function (n) { return dat.tabellen[n].length; }));
        if (zuletzt[a.id] === sig || (!fertig && leer)) return;
        zuletzt[a.id] = sig;
        if (fertig) lab.completeTask(taskId(a), ans, dat); else lab.saveAnswer(taskId(a), ans, { data: dat });
      });
    }
    var original = speichern;
    speichern = function () { original.apply(this, arguments); clearTimeout(timer); timer = setTimeout(abgleichen, 1200); };
    window.addEventListener('pagehide', abgleichen);
    return lab;
  }

  window.LernlaborAdapter = { start: start, felder: felder, taskId: taskId };
})();
