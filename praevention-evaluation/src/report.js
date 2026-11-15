'use strict';
const path = require('path');
const PDFDocument = require('pdfkit');
const { fmtPct } = require('./analysis');

const FONT_DIR = path.join(__dirname, '..', 'fonts');
const F = { R: 'Inter-R', M: 'Inter-M', SB: 'Inter-SB', B: 'Inter-B', I: 'Inter-I' };

const C = {
  ink: '#22302A',
  muted: '#5B6B63',
  faint: '#8A9790',
  line: '#D5DED8',
  sage: '#5E8B6E',
  sageDark: '#3E6450',
  sageLight: '#E3EDE6',
  sagePale: '#F3F7F4',
  sand: '#F7F2E6',
  sandLine: '#E2D5B5',
  sandInk: '#7A6431',
  tone: { pos: '#6E9B7B', mid: '#D6C394', neg: '#C98F7E', nb: '#B9C0BC' },
  white: '#FFFFFF',
};

const PAGE = { w: 595.28, h: 841.89, ml: 56, mr: 56, mt: 70, mb: 66 };
const CW = PAGE.w - PAGE.ml - PAGE.mr;

function germanDate(d = new Date()) {
  return d.toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Berlin' });
}

function buildReport(a) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: PAGE.mt, bottom: PAGE.mb, left: PAGE.ml, right: PAGE.mr },
      bufferPages: true,
      autoFirstPage: false,
      info: {
        Title: a.meta.reportTitle,
        Author: a.meta.responsible,
        Subject: `${a.meta.school} – ${a.meta.departmentShort}`,
        Creator: 'Evaluation Präventionsangebot',
      },
      lang: 'de-DE',
    });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.registerFont(F.R, path.join(FONT_DIR, 'Inter-Regular.otf'));
    doc.registerFont(F.M, path.join(FONT_DIR, 'Inter-Medium.otf'));
    doc.registerFont(F.SB, path.join(FONT_DIR, 'Inter-SemiBold.otf'));
    doc.registerFont(F.B, path.join(FONT_DIR, 'Inter-Bold.otf'));
    doc.registerFont(F.I, path.join(FONT_DIR, 'Inter-Italic.otf'));

    try {
      render(doc, a);
      decoratePages(doc, a);
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/* ------------------------------------------------------------------------- */
/* Grundbausteine                                                             */
/* ------------------------------------------------------------------------- */

function makeKit(doc) {
  const bottom = () => PAGE.h - PAGE.mb;
  const kit = {
    left: PAGE.ml,
    newPage() { doc.addPage(); doc.x = PAGE.ml; doc.y = PAGE.mt; },
    ensure(h) { if (doc.y + h > bottom()) kit.newPage(); },
    space(h) { doc.y += h; },
    textHeight(text, font, size, width, opts = {}) {
      doc.font(font).fontSize(size);
      return doc.heightOfString(text, { width, lineGap: opts.lineGap ?? 2.5 });
    },
    para(text, { font = F.R, size = 10, color = C.ink, width = CW, x = PAGE.ml, lineGap = 2.5, after = 8, align = 'left' } = {}) {
      const h = kit.textHeight(text, font, size, width, { lineGap });
      kit.ensure(Math.min(h, 60));
      doc.font(font).fontSize(size).fillColor(color).text(text, x, doc.y, { width, lineGap, align });
      doc.y += after;
    },
    sectionTitle(no, title) {
      kit.ensure(110);
      if (doc.y > PAGE.mt + 4) doc.y += 10;
      const y = doc.y;
      doc.roundedRect(PAGE.ml, y, 30, 30, 6).fill(C.sage);
      doc.font(F.B).fontSize(13).fillColor(C.white).text(String(no), PAGE.ml, y + 8.5, { width: 30, align: 'center' });
      doc.font(F.B).fontSize(16).fillColor(C.ink).text(title, PAGE.ml + 42, y + 5, { width: CW - 42 });
      doc.y = Math.max(doc.y, y + 30) + 6;
      doc.moveTo(PAGE.ml, doc.y).lineTo(PAGE.ml + CW, doc.y).lineWidth(0.8).strokeColor(C.line).stroke();
      doc.y += 14;
    },
    subTitle(text, { color = C.sageDark, size = 12, after = 6 } = {}) {
      kit.ensure(70);
      doc.font(F.SB).fontSize(size).fillColor(color).text(text, PAGE.ml, doc.y, { width: CW });
      doc.y += after;
    },
    bullets(items, { size = 10, color = C.ink, bulletColor = C.sage, x = PAGE.ml, width = CW, after = 4 } = {}) {
      for (const it of items) {
        const h = kit.textHeight(it, F.R, size, width - 14);
        kit.ensure(h + after);
        const y = doc.y;
        doc.circle(x + 3.5, y + size * 0.62, 2.2).fill(bulletColor);
        doc.font(F.R).fontSize(size).fillColor(color).text(it, x + 14, y, { width: width - 14, lineGap: 2.5 });
        doc.y += after;
      }
    },
    label(text, x, y, { color = C.muted, size = 7.5 } = {}) {
      doc.font(F.SB).fontSize(size).fillColor(color).text(text.toUpperCase(), x, y, { characterSpacing: 0.6, lineBreak: false });
    },
    /** Kasten für automatisch erstellte Inhalte – optisch klar von Aussagen der Lehrkräfte getrennt. */
    autoBox(title, lines, { note } = {}) {
      const pad = 12;
      const w = CW - 2 * pad;
      const rows = lines.length ? lines : ['Keine Einträge.'];
      let h = pad + 12 + 6;
      for (const l of rows) h += kit.textHeight(l, F.R, 9.5, w - 12) + 4;
      if (note) h += kit.textHeight(note, F.I, 8, w) + 6;
      h += pad - 4;
      kit.ensure(h + 10);
      const y = doc.y;
      doc.roundedRect(PAGE.ml, y, CW, h, 6).fillAndStroke(C.sand, C.sandLine);
      kit.label(`Automatische Auswertung · ${title}`, PAGE.ml + pad, y + pad, { color: C.sandInk });
      doc.y = y + pad + 18;
      for (const l of rows) {
        const yy = doc.y;
        doc.rect(PAGE.ml + pad, yy + 4, 4, 4).fill(C.sandInk);
        doc.font(F.R).fontSize(9.5).fillColor(C.ink).text(l, PAGE.ml + pad + 12, yy, { width: w - 12, lineGap: 2.5 });
        doc.y += 4;
      }
      if (note) {
        doc.y += 2;
        doc.font(F.I).fontSize(8).fillColor(C.muted).text(note, PAGE.ml + pad, doc.y, { width: w, lineGap: 2 });
      }
      doc.y = y + h + 12;
    },
    /** Wörtliche Aussagen der Lehrkräfte. */
    statements(field, emptyText = 'Zu dieser Frage liegen keine Rückmeldungen vor.') {
      if (!field.entries.length) {
        kit.para(emptyText, { font: F.I, size: 9.5, color: C.muted, after: 10 });
        return;
      }
      kit.ensure(40);
      kit.label(`Aussagen der Lehrkräfte – wörtlich und vollständig (${field.entries.length})`, PAGE.ml, doc.y, { color: C.sageDark });
      doc.y += 14;
      const textX = PAGE.ml + 34;
      const textW = CW - 34;
      for (const e of field.entries) {
        const body = `„${e.text}“`;
        const h = kit.textHeight(body, F.R, 9.5, textW);
        kit.ensure(Math.min(h, 120) + 10);
        const y = doc.y;
        doc.roundedRect(PAGE.ml, y, 24, 14, 3).fill(C.sageLight);
        doc.font(F.SB).fontSize(7.5).fillColor(C.sageDark).text(String(e.no), PAGE.ml, y + 3.6, { width: 24, align: 'center' });
        doc.font(F.R).fontSize(9.5).fillColor(C.ink).text(body, textX, y, { width: textW, lineGap: 2.5 });
        const endY = doc.y;
        // Seitenumbruch innerhalb einer sehr langen Aussage: Linie nur auf der aktuellen Seite zeichnen
        const lineTop = endY > y ? y + 17 : PAGE.mt;
        if (endY - lineTop > 4) doc.moveTo(PAGE.ml + 12, lineTop).lineTo(PAGE.ml + 12, endY - 2).lineWidth(1.2).strokeColor(C.sageLight).stroke();
        doc.y = endY + 7;
      }
      doc.y += 4;
    },
    themeBox(field, a) {
      if (!field.entries.length) return;
      const lines = field.themes.map((t) => `${t.label}: ${t.count} Nennung${t.count === 1 ? '' : 'en'} (Nr. ${t.refs.join(', ')})`);
      kit.autoBox('Wiederkehrende Themen', lines.length ? lines : ['Es wurden keine wiederkehrenden Themen erkannt.'], {
        note: `Gebündelt per festgelegtem Stichwortabgleich (mind. ${a.minThemeMentions} Nennungen). Das Verfahren erkennt, dass ein Thema angesprochen wird, nicht ob positiv oder negativ. Mehrfachzuordnungen sind möglich; maßgeblich sind die wörtlichen Aussagen.`,
      });
    },
  };
  return kit;
}

/* ------------------------------------------------------------------------- */
/* Balkendiagramm je geschlossener Frage                                      */
/* ------------------------------------------------------------------------- */

function chart(doc, kit, s) {
  const pad = s.keyQuestion ? 12 : 0;
  const x0 = PAGE.ml + pad;
  const w = CW - 2 * pad;
  const labelW = 178;
  const valueW = 74;
  const barX = x0 + labelW + 10;
  const barW = w - labelW - 10 - valueW - 6;
  const titleText = `Frage ${s.number}: ${s.text}`;

  const titleH = kit.textHeight(titleText, F.SB, 10.5, w - (s.keyQuestion ? 0 : 0));
  const rows = s.options.map((op) => {
    const h = Math.max(17, kit.textHeight(op.label, F.R, 8.8, labelW, { lineGap: 1 }) + 6);
    return { op, h };
  });
  const nbGap = s.hasNb ? 8 : 0;
  const meta = s.hasNb
    ? `Antworten: ${s.answered} · inhaltlich gültig: ${s.valid} · „${s.nbLabel}“: ${s.nbCount}${s.answered ? ` (${fmtPct(s.nbPct)} aller Antworten)` : ''}. Prozentwerte beziehen sich auf die inhaltlich gültigen Antworten.`
    : `Gültige Antworten: ${s.valid}${s.missing ? ` · ohne Angabe: ${s.missing}` : ''}.`;
  const metaH = kit.textHeight(meta, F.R, 8, w, { lineGap: 1.5 });
  const badgeH = s.keyQuestion ? 18 : 0;
  const total = pad + badgeH + titleH + 8 + rows.reduce((t, r) => t + r.h, 0) + nbGap + 6 + metaH + pad;

  kit.ensure(total + 14);
  const y0 = doc.y;
  if (s.keyQuestion) {
    doc.roundedRect(PAGE.ml, y0, CW, total, 7).fillAndStroke(C.sagePale, C.sageLight);
    doc.roundedRect(x0, y0 + pad, 118, 14, 7).fill(C.sage);
    doc.font(F.SB).fontSize(7).fillColor(C.white).text('ENTSCHEIDUNGSRELEVANT', x0, y0 + pad + 3.8, { width: 118, align: 'center', characterSpacing: 0.5 });
  }
  let y = y0 + pad + badgeH;
  doc.font(F.SB).fontSize(10.5).fillColor(C.ink).text(titleText, x0, y, { width: w, lineGap: 2.5 });
  y += titleH + 8;

  for (const { op, h } of rows) {
    if (op.tone === 'nb') {
      doc.moveTo(x0, y + nbGap / 2).lineTo(x0 + w, y + nbGap / 2).dash(2, { space: 2 }).lineWidth(0.6).strokeColor(C.line).stroke().undash();
      y += nbGap;
    }
    const isNb = op.tone === 'nb';
    doc.font(isNb ? F.I : F.R).fontSize(8.8).fillColor(isNb ? C.muted : C.ink).text(op.label, x0, y + 3, { width: labelW, lineGap: 1 });
    // Hintergrundspur
    const by = y + (h - 10) / 2;
    doc.roundedRect(barX, by, barW, 10, 2).fill('#EEF1EF');
    const p = op.pct || 0;
    if (op.count > 0) doc.roundedRect(barX, by, Math.max(2.5, (barW * p) / 100), 10, 2).fill(C.tone[op.tone]);
    const val = `${op.count} (${op.pct === null ? '–' : fmtPct(op.pct)})`;
    doc.font(op.count ? F.SB : F.R).fontSize(8.8).fillColor(op.count ? C.ink : C.faint).text(val, barX + barW + 6, by + 0.6, { width: valueW, align: 'right' });
    y += h;
  }
  y += 6;
  doc.font(F.R).fontSize(8).fillColor(C.muted).text(meta, x0, y, { width: w, lineGap: 1.5 });
  doc.y = y0 + total + 14;
}

/* ------------------------------------------------------------------------- */
/* Seiten                                                                     */
/* ------------------------------------------------------------------------- */

function render(doc, a) {
  const kit = makeKit(doc);
  const q = a.closed;
  const ind = a.indicators;
  const t = a.texts;

  /* 1 Deckblatt */
  doc.addPage();
  doc.rect(0, 0, PAGE.w, 300).fill(C.sagePale);
  doc.rect(0, 0, 14, PAGE.h).fill(C.sage);
  kit.label(`${a.meta.school} · ${a.meta.departmentShort}`, PAGE.ml, 92, { color: C.sageDark, size: 9 });
  doc.font(F.B).fontSize(26).fillColor(C.ink).text('Auswertung der Evaluation', PAGE.ml, 120, { width: CW });
  doc.font(F.M).fontSize(17).fillColor(C.sageDark).text('Präventionsangebot der Jugendhilfe der Stadt Voerde', PAGE.ml, doc.y + 6, { width: CW, lineGap: 3 });
  doc.font(F.R).fontSize(10.5).fillColor(C.muted).text('Befragung der Klassenleitungen des 8. Jahrgangs', PAGE.ml, doc.y + 14, { width: CW });

  const rows = [
    ['Schule', a.meta.school],
    ['Abteilung', a.meta.department],
    ['Verantwortlich', a.meta.responsible],
    ['Durchführung des Angebots', 'Mitarbeiterinnen der Jugendhilfe der Stadt Voerde'],
    ['Befragte Zielgruppe', a.meta.audience],
    ['Auswertungsdatum', germanDate(new Date(a.generatedAt))],
    ['Datengrundlage', `${a.n} Rückmeldung${a.n === 1 ? '' : 'en'}${a.expected ? ` von ${a.expected} erwarteten (Rücklauf ${fmtPct(a.rate * 100)})` : ''}`],
  ];
  let y = 350;
  for (const [k, v] of rows) {
    doc.font(F.SB).fontSize(8).fillColor(C.muted).text(k.toUpperCase(), PAGE.ml, y, { width: 160, characterSpacing: 0.5 });
    doc.font(F.R).fontSize(11).fillColor(C.ink).text(v, PAGE.ml + 170, y - 2, { width: CW - 170 });
    y = Math.max(doc.y, y + 14) + 12;
    doc.moveTo(PAGE.ml, y - 6).lineTo(PAGE.ml + CW, y - 6).lineWidth(0.5).strokeColor(C.line).stroke();
  }
  doc.roundedRect(PAGE.ml, 690, CW, 62, 6).fill(C.sand);
  doc.font(F.SB).fontSize(9).fillColor(C.sandInk).text('Vertraulich – nur für den innerschulischen Dienstgebrauch', PAGE.ml + 14, 702, { width: CW - 28 });
  doc.font(F.R).fontSize(8.5).fillColor(C.ink).text('Die Befragung erfolgte anonym. Der Bericht enthält keine personenbezogenen Daten von Schülerinnen und Schülern. Automatisch erstellte Einschätzungen sind als solche gekennzeichnet; die Entscheidung trifft die Abteilungsleitung.', PAGE.ml + 14, doc.y + 4, { width: CW - 28, lineGap: 2 });

  /* 2 Zielsetzung */
  kit.newPage();
  kit.sectionTitle(2, 'Zielsetzung der Evaluation');
  kit.para(`Das Präventionsangebot wurde von Mitarbeiterinnen der Jugendhilfe der Stadt Voerde in den Klassen des 8. Jahrgangs der ${a.meta.school} durchgeführt. Die Evaluation soll der Abteilungsleitung (${a.meta.responsible}) eine fundierte Entscheidungsgrundlage für die zukünftige Gestaltung liefern. Leitfragen der Auswertung sind:`);
  kit.bullets([
    'War das Präventionsangebot insgesamt erfolgreich?',
    'War es für Schülerinnen und Schüler des 8. Jahrgangs pädagogisch sinnvoll und altersangemessen?',
    'Wie werden Interesse und Beteiligung der Schülerinnen und Schüler eingeschätzt?',
    'Sollte das Angebot langfristig in Abteilung II fortgeführt werden?',
    'Ist eine Durchführung bereits im 7. Jahrgang sinnvoll?',
    'Welche Verbesserungsmöglichkeiten ergeben sich für die durchführenden Mitarbeiterinnen und die schulische Organisation?',
  ]);
  doc.y += 6;
  kit.subTitle('Vorgehen und Lesehinweise');
  kit.bullets([
    'Befragt wurden die Klassenleitungen des 8. Jahrgangs mit einem anonymen Online-Fragebogen (14 Fragen in fünf Themenbereichen, davon zehn geschlossene Fragen und sechs Freitextfelder).',
    'Prozentwerte beziehen sich auf die inhaltlich gültigen Antworten einer Frage. Antworten wie „Nicht beurteilbar“ werden getrennt ausgewiesen und gehen nicht in die Prozentbasis ein. Durch Rundung können Summen von 100 % abweichen.',
    'Freitextantworten werden vollständig und wörtlich wiedergegeben. Automatisch erstellte Bündelungen und Einschätzungen stehen in gesondert gekennzeichneten Kästen („Automatische Auswertung“) und sind keine Aussagen der Lehrkräfte.',
    'Fragen 2, 3, 5 und 12 sind für die Entscheidung über die zukünftige Durchführung maßgeblich und als „entscheidungsrelevant“ hervorgehoben.',
  ]);

  /* 3 Teilnahme */
  kit.sectionTitle(3, 'Teilnahme und Rücklaufquote');
  const tiles = [
    ['Rückmeldungen', String(a.n)],
    ['Erwartete Klassenleitungen', a.expected ? String(a.expected) : 'nicht hinterlegt'],
    ['Rücklaufquote', a.rate !== null ? fmtPct(Math.min(a.rate, 9.99) * 100) : '–'],
  ];
  kit.ensure(80);
  const tw = (CW - 2 * 12) / 3;
  const ty = doc.y;
  tiles.forEach(([k, v], i) => {
    const tx = PAGE.ml + i * (tw + 12);
    doc.roundedRect(tx, ty, tw, 64, 6).fill(C.sagePale);
    kit.label(k, tx + 12, ty + 12, { color: C.muted, size: 7 });
    doc.font(F.B).fontSize(v.length > 6 ? 13 : 22).fillColor(C.sageDark).text(v, tx + 12, ty + (v.length > 6 ? 32 : 27), { width: tw - 24 });
  });
  doc.y = ty + 78;
  if (a.rate !== null) {
    kit.ensure(30);
    const by = doc.y;
    doc.roundedRect(PAGE.ml, by, CW, 8, 4).fill('#EEF1EF');
    doc.roundedRect(PAGE.ml, by, Math.max(4, CW * Math.min(1, a.rate)), 8, 4).fill(C.sage);
    doc.y = by + 18;
  }
  kit.para(`${a.classes.withClass} von ${a.n} Rückmeldungen enthalten eine freiwillige Klassenangabe (${a.classes.distinct.length} verschiedene Klassen). Klassenangaben werden in diesem Bericht nicht mit einzelnen Antworten verknüpft, damit keine Rückschlüsse auf einzelne Lehrkräfte entstehen.`, { size: 9.5, color: C.muted });
  if (a.decision.caveats.length) {
    kit.autoBox('Hinweise zur Aussagekraft', a.decision.caveats);
  }

  /* 4 Zusammenfassung */
  kit.sectionTitle(4, 'Zusammenfassung der wichtigsten Ergebnisse');
  kit.bullets(a.summary);
  doc.y += 4;
  kit.autoBox('Vorläufige Gesamteinschätzung', [
    `Regelbasierte Einschätzung: ${a.decision.label} (${a.decision.strength}).`,
    a.interest.text,
    `Jahrgang 7: ${a.grade7.text}`,
  ], { note: 'Herleitung und Entscheidungsregeln siehe Abschnitt 10; kompakte Entscheidungsvorlage auf der Seite „Fazit und Entscheidung zur zukünftigen Durchführung“.' });

  /* 5 Quantitative Auswertung */
  kit.sectionTitle(5, 'Quantitative Auswertung der geschlossenen Fragen');
  kit.para('Balkendiagramme zeigen die absolute Anzahl je Antwortmöglichkeit und in Klammern den prozentualen Anteil. Farbgebung: Grün = zustimmend/positiv, Sand = mittel/teils, Terrakotta = kritisch, Grau = nicht beurteilbar.', { size: 9, color: C.muted });
  for (const sec of a.sections) {
    const qs = Object.values(q).filter((s) => s.section === sec.id);
    if (!qs.length) continue;
    kit.subTitle(`Bereich ${sec.id}: ${sec.title}`, { after: 10 });
    for (const s of qs) chart(doc, kit, s);
  }

  /* 6 Qualitative Auswertung */
  kit.sectionTitle(6, 'Qualitative Auswertung der Freitextantworten');
  kit.para('Alle Freitextantworten werden vollständig und unverändert wiedergegeben (Nummerierung je Frage, in zufälliger, nicht chronologischer Reihenfolge). Die Antworten zu den Fragen 10, 11 und 13 finden sich in den Abschnitten 7 bis 9.', { size: 9.5 });
  kit.ensure(130);
  const overview = [
    [t.q2_text, '6'], [t.q5_text, '6'], [t.q10, '8'], [t.q11, '9'], [t.q13, '7'], [t.q14, '6'],
  ];
  {
    const y0 = doc.y;
    doc.rect(PAGE.ml, y0, CW, 18).fill(C.sageLight);
    doc.font(F.SB).fontSize(8.5).fillColor(C.sageDark);
    doc.text('Freitextfeld', PAGE.ml + 8, y0 + 5, { width: 320 });
    doc.text('Antworten', PAGE.ml + 340, y0 + 5, { width: 60, align: 'right' });
    doc.text('Abschnitt', PAGE.ml + 410, y0 + 5, { width: 65, align: 'right' });
    let yy = y0 + 18;
    for (const [f, sec] of overview) {
      const lbl = `F${f.number}${f.parent ? ' (Ergänzung)' : ''}: ${f.label}`;
      const h = kit.textHeight(lbl, F.R, 8.5, 320, { lineGap: 1 }) + 8;
      doc.font(F.R).fontSize(8.5).fillColor(C.ink).text(lbl, PAGE.ml + 8, yy + 4, { width: 320, lineGap: 1 });
      doc.text(String(f.entries.length), PAGE.ml + 340, yy + 4, { width: 60, align: 'right' });
      doc.text(sec, PAGE.ml + 410, yy + 4, { width: 65, align: 'right' });
      yy += h;
      doc.moveTo(PAGE.ml, yy).lineTo(PAGE.ml + CW, yy).lineWidth(0.5).strokeColor(C.line).stroke();
    }
    doc.y = yy + 16;
  }
  kit.subTitle('Frage 2 – Begründungen zur Weiterempfehlung');
  kit.statements(t.q2_text);
  kit.themeBox(t.q2_text, a);
  kit.subTitle('Frage 5 – Erforderliche Anpassungen für eine Durchführung in Jahrgang 7');
  kit.statements(t.q5_text);
  kit.themeBox(t.q5_text, a);
  kit.subTitle('Frage 14 – Weitere Anmerkungen');
  kit.statements(t.q14);
  kit.themeBox(t.q14, a);

  /* 7 Stärken */
  kit.sectionTitle(7, 'Stärken des Präventionsangebots');
  kit.autoBox('Quantitativ besonders positiv bewertet', a.strengths.length
    ? a.strengths.map((s) => `${s.label} (Frage ${s.question}): ${s.count} von ${s.valid} (${fmtPct(s.pct)}) positiv`)
    : ['Kein Aspekt erreicht die Schwelle von mindestens 75 % positiven Bewertungen (bei mindestens 3 inhaltlichen Antworten).'],
  { note: 'Schwelle: mindestens 75 % positive Antworten bei mindestens 3 inhaltlich gültigen Antworten.' });
  kit.subTitle('Frage 13 – Was war besonders gelungen?');
  kit.statements(t.q13);
  kit.themeBox(t.q13, a);

  /* 8 Verbesserungen Jugendhilfe */
  kit.sectionTitle(8, 'Genannte Verbesserungsmöglichkeiten für die Jugendhilfe der Stadt Voerde');
  kit.subTitle('Frage 10 – Verbesserungsvorschläge für die Mitarbeiterinnen');
  kit.statements(t.q10);
  kit.themeBox(t.q10, a);
  kit.autoBox('Quantitativ auffällige Punkte', a.concerns.length ? a.concerns : ['Keine geschlossene Frage weist einen kritischen Anteil von 25 % oder mehr auf.'],
    { note: 'Schwelle: mindestens 25 % kritische bzw. abweichende Antworten bei mindestens 3 inhaltlich gültigen Antworten.' });

  /* 9 Organisation */
  kit.sectionTitle(9, 'Organisatorische Hinweise für die Abteilungsleitung');
  kit.subTitle('Frage 11 – Hinweise zur zukünftigen Organisation');
  kit.statements(t.q11);
  kit.themeBox(t.q11, a);

  /* 10 Entscheidungsgrundlage */
  kit.sectionTitle(10, 'Entscheidungsgrundlage zur langfristigen Fortführung');
  kit.para('Die folgenden Kennzahlen bilden die Grundlage der regelbasierten Einschätzung. Die Empfehlung ergibt sich nicht aus einem Durchschnittswert, sondern aus festgelegten Schwellen für mehrere Fragen, der Datenbasis (Anzahl, Rücklaufquote) und der Prüfung auf widersprüchliche Antwortbilder.', { size: 9.5 });
  const indRows = [
    ['Weiterempfehlung (F2: beide Ja-Stufen)', ind.recommendPos],
    ['  davon uneingeschränkt (F2)', ind.recommendFull],
    ['Weiterempfehlung „Nein“ (F2)', ind.recommendNo],
    ['Anspruch genau angemessen (F3)', ind.levelOk],
    ['Gesamteindruck sehr/eher gelungen (F1)', ind.overallPos],
    ['Gesamteindruck eher nicht/überhaupt nicht gelungen (F1)', ind.overallNeg],
    ['Interesse sehr/eher groß (F6)', ind.interestPos],
    ['Jahrgang 7 denkbar (F5: beide Ja-Stufen)', ind.grade7Yes],
    ['Etablierung befürwortet (F12: unbedingt/mit Anpassungen)', ind.establishPos],
    ['  davon „Ja, unbedingt“ (F12)', ind.establishFull],
    ['Nur nach grundlegender Überarbeitung oder Nein (F12)', ind.establishReviseOrNo],
  ];
  {
    kit.ensure(40);
    let yy = doc.y;
    doc.rect(PAGE.ml, yy, CW, 18).fill(C.sageLight);
    doc.font(F.SB).fontSize(8.5).fillColor(C.sageDark);
    doc.text('Kennzahl', PAGE.ml + 8, yy + 5, { width: 300 });
    doc.text('Anteil', PAGE.ml + 320, yy + 5, { width: 60, align: 'right' });
    doc.text('Anzahl / Basis', PAGE.ml + 390, yy + 5, { width: 85, align: 'right' });
    yy += 18;
    for (const [k, v] of indRows) {
      if (yy + 18 > PAGE.h - PAGE.mb) { kit.newPage(); yy = doc.y; }
      doc.font(k.startsWith('  ') ? F.I : F.R).fontSize(8.8).fillColor(C.ink).text(k.trim(), PAGE.ml + (k.startsWith('  ') ? 18 : 8), yy + 4.5, { width: 300 });
      doc.font(F.SB).text(fmtPct(v.pct), PAGE.ml + 320, yy + 4.5, { width: 60, align: 'right' });
      doc.font(F.R).fillColor(C.muted).text(`${v.count} / ${v.valid}`, PAGE.ml + 390, yy + 4.5, { width: 85, align: 'right' });
      yy += 18;
      doc.moveTo(PAGE.ml, yy).lineTo(PAGE.ml + CW, yy).lineWidth(0.5).strokeColor(C.line).stroke();
    }
    doc.y = yy + 16;
  }
  kit.subTitle('Offengelegte Entscheidungsregeln (Prüfung in dieser Reihenfolge)');
  kit.para('Die erste zutreffende Regel bestimmt die Einschätzung. Prozentwerte beziehen sich auf inhaltlich gültige Antworten.', { size: 9, color: C.muted, after: 8 });
  a.decision.rules.forEach((r, i) => {
    const status = r.applied ? 'ANGEWENDET' : r.met ? 'erfüllt, nachrangig' : 'nicht erfüllt';
    const head = `Regel ${i + 1}: ${r.label}${r.fallback ? ' (Auffangregel)' : ''}`;
    const hHead = kit.textHeight(head, F.SB, 9.5, CW - 130);
    const hDesc = kit.textHeight(r.description, F.R, 8.8, CW - 24);
    const h = 10 + hHead + 4 + hDesc + 10;
    kit.ensure(h + 6);
    const yy = doc.y;
    doc.roundedRect(PAGE.ml, yy, CW, h, 5).fillAndStroke(r.applied ? C.sageLight : C.white, r.applied ? C.sage : C.line);
    doc.font(F.SB).fontSize(9.5).fillColor(C.ink).text(head, PAGE.ml + 12, yy + 10, { width: CW - 130 });
    doc.roundedRect(PAGE.ml + CW - 112, yy + 8, 100, 15, 7).fill(r.applied ? C.sage : r.met ? C.tone.mid : '#EEF1EF');
    doc.font(F.SB).fontSize(7).fillColor(r.applied ? C.white : C.ink).text(status, PAGE.ml + CW - 112, yy + 12.3, { width: 100, align: 'center' });
    doc.font(F.R).fontSize(8.8).fillColor(C.muted).text(r.description, PAGE.ml + 12, yy + 10 + hHead + 4, { width: CW - 24, lineGap: 2.5 });
    doc.y = yy + h + 6;
  });
  doc.y += 6;
  kit.para('Zusätzlich gilt: Die Belastbarkeit wird als „gut belastbar“ eingestuft, wenn mindestens 5 Rückmeldungen vorliegen, die Rücklaufquote mindestens 67 % beträgt und kein widersprüchliches Antwortbild vorliegt; andernfalls „eingeschränkt belastbar“. Ein widersprüchliches Bild liegt vor, wenn bei Frage 1, 2 oder 12 jeweils mindestens 30 % zustimmend und mindestens 30 % kritisch antworten.', { size: 9, color: C.muted });

  renderConclusion(doc, kit, a);
  renderDecisionField(doc, kit, a);
}

/* ------------------------------------------------------------------------- */
/* Fazit-Seite                                                                */
/* ------------------------------------------------------------------------- */

function renderConclusion(doc, kit, a) {
  const ind = a.indicators;
  kit.newPage();
  doc.rect(0, 0, PAGE.w, PAGE.h).fill(C.sagePale);
  doc.rect(0, 0, PAGE.w, 132).fill(C.sageDark);
  kit.label('Entscheidungsvorlage für die Abteilungsleitung', PAGE.ml, 50, { color: '#CFE0D4', size: 8 });
  doc.font(F.B).fontSize(20).fillColor(C.white).text('Fazit und Entscheidung zur zukünftigen Durchführung', PAGE.ml, 66, { width: CW, lineGap: 2 });

  const tiles = [
    ['Weiterempfehlung', fmtPct(ind.recommendPos.pct), `${ind.recommendPos.count} von ${ind.recommendPos.valid} (davon ${ind.recommendFull.count} uneingeschränkt)`],
    ['Anspruch angemessen', fmtPct(ind.levelOk.pct), `${ind.levelOk.count} von ${ind.levelOk.valid} „genau angemessen“`],
    ['Interesse der SuS', fmtPct(ind.interestPos.pct), `sehr/eher groß · ${ind.interestPos.count} von ${ind.interestPos.valid}`],
    ['Dauerhafte Etablierung', fmtPct(ind.establishPos.pct), `befürwortet · ${ind.establishPos.count} von ${ind.establishPos.valid} (davon ${ind.establishFull.count} „unbedingt“)`],
  ];
  const gap = 10;
  const tw = (CW - 3 * gap) / 4;
  const ty = 152;
  tiles.forEach(([k, v, sub], i) => {
    const tx = PAGE.ml + i * (tw + gap);
    doc.roundedRect(tx, ty, tw, 92, 6).fillAndStroke(C.white, C.sageLight);
    doc.font(F.SB).fontSize(7.5).fillColor(C.muted).text(k.toUpperCase(), tx + 10, ty + 10, { width: tw - 20, characterSpacing: 0.4 });
    doc.font(F.B).fontSize(22).fillColor(C.sageDark).text(v, tx + 10, ty + 28, { width: tw - 20 });
    doc.font(F.R).fontSize(7.5).fillColor(C.muted).text(sub, tx + 10, ty + 58, { width: tw - 20, lineGap: 1 });
  });
  doc.y = ty + 92 + 14;

  const block = (title, lines) => {
    const w = CW - 24;
    let h = 12 + 14;
    for (const l of lines) h += kit.textHeight(l, F.R, 9, w - 12, { lineGap: 2 }) + 3;
    h += 8;
    const y = doc.y;
    doc.roundedRect(PAGE.ml, y, CW, h, 6).fillAndStroke(C.white, C.sageLight);
    kit.label(title, PAGE.ml + 12, y + 11, { color: C.sageDark });
    doc.y = y + 27;
    for (const l of lines) {
      const yy = doc.y;
      doc.circle(PAGE.ml + 15, yy + 5.6, 1.8).fill(C.sage);
      doc.font(F.R).fontSize(9).fillColor(C.ink).text(l, PAGE.ml + 24, yy, { width: w - 12, lineGap: 2 });
      doc.y += 3;
    }
    doc.y = y + h + 9;
  };

  block('Interesse und Eignung für Jahrgang 7', [a.interest.text, a.grade7.text]);

  const needs = [
    ...a.improvementThemes.slice(0, 4).map((th) => `${th.label} – ${th.count} Nennungen in den Freitexten (Fragen ${th.sources.join(', ')}; Stichwortabgleich)`),
    ...a.concerns.slice(0, 3),
  ];
  block('Wesentliche Verbesserungsbedarfe', needs.length ? needs : ['Es wurden keine wiederkehrenden Verbesserungsthemen und keine quantitativ auffälligen Kritikpunkte erkannt.']);

  // Empfehlungskasten
  const recLines = [...a.decision.caveats.slice(0, 3), ...a.decision.notes.slice(0, 2)];
  const w = CW - 28;
  let h = 16 + 12 + 6 + kit.textHeight(a.decision.label, F.B, 14, w) + 8 + 14;
  for (const l of recLines) h += kit.textHeight(l, F.R, 8.6, w - 10, { lineGap: 1.5 }) + 3;
  h += 12;
  const y = doc.y;
  doc.roundedRect(PAGE.ml, y, CW, h, 8).fill(C.sageDark);
  kit.label('Datenbasierte Gesamteinschätzung (automatisch, regelbasiert)', PAGE.ml + 14, y + 16, { color: '#CFE0D4' });
  doc.font(F.B).fontSize(14).fillColor(C.white).text(a.decision.label, PAGE.ml + 14, y + 34, { width: w });
  doc.font(F.SB).fontSize(8.8).fillColor('#DDEBE1').text(`Belastbarkeit: ${a.decision.strength} · Grundlage: ${a.n} Rückmeldungen${a.rate !== null ? `, Rücklauf ${fmtPct(a.rate * 100)}` : ', Rücklauf unbekannt'}`, PAGE.ml + 14, doc.y + 6, { width: w });
  doc.y += 6;
  for (const l of recLines) {
    const yy = doc.y;
    doc.circle(PAGE.ml + 17, yy + 5, 1.6).fill('#CFE0D4');
    doc.font(F.R).fontSize(8.6).fillColor(C.white).text(l, PAGE.ml + 24, yy, { width: w - 10, lineGap: 1.5 });
    doc.y += 3;
  }
  doc.y = y + h + 10;

  kit.para('Hinweis: Diese Einschätzung wurde automatisch nach den in Abschnitt 10 offengelegten Regeln erstellt. Sie ersetzt keine pädagogische Abwägung. Die endgültige Entscheidung über die zukünftige Durchführung liegt ausdrücklich bei der Abteilungsleitung.', { font: F.I, size: 8.6, color: C.muted, after: 0 });
}

/* ------------------------------------------------------------------------- */
/* Feld für die Stellungnahme der Abteilungsleitung                           */
/* ------------------------------------------------------------------------- */

function renderDecisionField(doc, kit, a) {
  kit.newPage();
  doc.rect(0, 0, PAGE.w, 8).fill(C.sage);
  doc.font(F.B).fontSize(16).fillColor(C.ink).text('Abschließende Bewertung und Entscheidung der Abteilungsleitung – WIDE', PAGE.ml, PAGE.mt, { width: CW, lineGap: 2 });
  doc.font(F.R).fontSize(9.5).fillColor(C.muted).text(`${a.meta.school} · ${a.meta.departmentShort} · ${a.meta.responsible}`, PAGE.ml, doc.y + 4, { width: CW });
  doc.y += 18;

  kit.label('Entscheidung (bitte ankreuzen)', PAGE.ml, doc.y, { color: C.sageDark });
  doc.y += 16;
  const options = [
    'Fortführung ohne wesentliche Veränderungen',
    'Fortführung mit gezielten Anpassungen',
    'Grundlegende Überarbeitung vor erneuter Durchführung',
    'Keine Fortführung',
    'Entscheidung vertagt / weitere Informationen erforderlich',
  ];
  for (const op of options) {
    const yy = doc.y;
    doc.rect(PAGE.ml, yy, 11, 11).lineWidth(1).strokeColor(C.ink).stroke();
    doc.font(F.R).fontSize(10).fillColor(C.ink).text(op, PAGE.ml + 20, yy - 0.5, { width: CW - 20 });
    doc.y = yy + 20;
  }
  doc.y += 4;
  {
    const yy = doc.y;
    doc.font(F.SB).fontSize(10).fillColor(C.ink).text('Durchführung bereits in Jahrgang 7:', PAGE.ml, yy - 0.5, { width: 200, lineBreak: false });
    let xx = PAGE.ml + 210;
    for (const op of ['ja', 'nein', 'prüfen']) {
      doc.rect(xx, yy, 11, 11).lineWidth(1).strokeColor(C.ink).stroke();
      doc.font(F.R).fontSize(10).fillColor(C.ink).text(op, xx + 17, yy - 0.5, { width: 60, lineBreak: false });
      xx += 80;
    }
    doc.y = yy + 28;
  }

  kit.label('Stellungnahme / Begründung / vereinbarte Anpassungen', PAGE.ml, doc.y, { color: C.sageDark });
  doc.y += 14;
  const boxTop = doc.y;
  const boxBottom = PAGE.h - PAGE.mb - 70;
  doc.roundedRect(PAGE.ml, boxTop, CW, boxBottom - boxTop, 6).lineWidth(0.8).strokeColor(C.line).stroke();
  for (let ly = boxTop + 26; ly < boxBottom - 8; ly += 24) {
    doc.moveTo(PAGE.ml + 12, ly).lineTo(PAGE.ml + CW - 12, ly).lineWidth(0.4).strokeColor('#E3E8E5').stroke();
  }
  const sy = PAGE.h - PAGE.mb - 24;
  doc.moveTo(PAGE.ml, sy).lineTo(PAGE.ml + 180, sy).lineWidth(0.8).strokeColor(C.ink).stroke();
  doc.moveTo(PAGE.ml + 230, sy).lineTo(PAGE.ml + CW, sy).stroke();
  doc.font(F.R).fontSize(8.5).fillColor(C.muted).text('Datum', PAGE.ml, sy + 5, { width: 180 });
  doc.text('Unterschrift WIDE (BL Abt. II)', PAGE.ml + 230, sy + 5, { width: CW - 230 });
  doc.y = sy + 20;
}

/* ------------------------------------------------------------------------- */
/* Kopf- und Fußzeilen                                                        */
/* ------------------------------------------------------------------------- */

function decoratePages(doc, a) {
  const range = doc.bufferedPageRange();
  const total = range.count;
  for (let i = range.start; i < range.start + total; i++) {
    doc.switchToPage(i);
    const oldBottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    const isCover = i === range.start;
    const isConclusion = i === range.start + total - 2;
    if (!isCover && !isConclusion) {
      doc.font(F.R).fontSize(7.5).fillColor(C.faint)
        .text('Auswertung der Evaluation – Präventionsangebot der Jugendhilfe der Stadt Voerde', PAGE.ml, 32, { width: CW - 150, lineBreak: false });
      doc.text(`${a.meta.school}`, PAGE.ml + CW - 150, 32, { width: 150, align: 'right', lineBreak: false });
      doc.moveTo(PAGE.ml, 46).lineTo(PAGE.ml + CW, 46).lineWidth(0.4).strokeColor(C.line).stroke();
    }
    if (!isCover) {
      doc.font(F.R).fontSize(7.5).fillColor(C.faint)
        .text('Vertraulich – nur für den innerschulischen Dienstgebrauch', PAGE.ml, PAGE.h - 40, { width: CW / 2, lineBreak: false });
      doc.text(`Seite ${i - range.start + 1} von ${total}`, PAGE.ml + CW / 2, PAGE.h - 40, { width: CW / 2, align: 'right', lineBreak: false });
    }
    doc.page.margins.bottom = oldBottom;
  }
}

module.exports = { buildReport };
