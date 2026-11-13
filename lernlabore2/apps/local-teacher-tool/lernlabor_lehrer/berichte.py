"""Berichte: PDF (Klassenübersicht, Einzelauswertungen, offene Aufgaben, anonyme Statistik),
Zugangskarten mit QR-Code, CSV- und XLSX-Export.

Alle Berichte entstehen LOKAL. Berichte mit Namen sind als vertraulich gekennzeichnet.
"""
from __future__ import annotations

import csv
from datetime import datetime
from pathlib import Path
from typing import Any, Iterable

from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas as rl_canvas
from reportlab.platypus import KeepTogether, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from .auswertung import Zeile, fmt_time, task_statistics
from .modell import KIND_NAME, full_name, sorted_people

VERTRAULICH = "VERTRAULICH – enthält personenbezogene Daten. Nur lokal speichern, nicht weitergeben, nicht in Cloud-Speicher ablegen."

_styles = getSampleStyleSheet()
ST = {
    "h1": ParagraphStyle("h1", parent=_styles["Heading1"], fontName="Helvetica-Bold", fontSize=17, spaceAfter=4),
    "h2": ParagraphStyle("h2", parent=_styles["Heading2"], fontName="Helvetica-Bold", fontSize=12.5, spaceBefore=8, spaceAfter=4),
    "p": ParagraphStyle("p", parent=_styles["BodyText"], fontName="Helvetica", fontSize=9.5, leading=12),
    "klein": ParagraphStyle("k", parent=_styles["BodyText"], fontName="Helvetica", fontSize=8, leading=10, textColor=colors.HexColor("#4a5568")),
    "zelle": ParagraphStyle("z", parent=_styles["BodyText"], fontName="Helvetica", fontSize=8.5, leading=10.5),
    "zelleB": ParagraphStyle("zb", parent=_styles["BodyText"], fontName="Helvetica-Bold", fontSize=8.5, leading=10.5),
}


def _safe(text: Any) -> str:
    """Text für die PDF-Standardschrift (WinAnsi) aufbereiten und für Paragraph maskieren."""
    t = "" if text is None else str(text)
    t = t.replace("✓", "ja").replace("×", "x").replace("≈", "ca.").replace("→", "->")
    t = t.encode("cp1252", errors="replace").decode("cp1252")
    return t.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def P(text: Any, style: str = "zelle") -> Paragraph:
    return Paragraph(_safe(text), ST[style])


def _footer(confidential: bool, title: str):
    def draw(c: rl_canvas.Canvas, doc):
        c.saveState()
        w, h = doc.pagesize
        c.setFont("Helvetica", 7.5)
        c.setFillColor(colors.HexColor("#b42318") if confidential else colors.HexColor("#4a5568"))
        c.drawString(15 * mm, 8 * mm, VERTRAULICH if confidential else "Anonymisierte Auswertung – keine Namen, keine Teilnehmerkennungen.")
        c.setFillColor(colors.HexColor("#4a5568"))
        c.drawRightString(w - 15 * mm, 8 * mm, f"{title} · Seite {doc.page} · erstellt {datetime.now():%d.%m.%Y %H:%M}")
        c.restoreState()
    return draw


def _doc(path: Path, title: str, pagesize=A4) -> SimpleDocTemplate:
    path.parent.mkdir(parents=True, exist_ok=True)
    return SimpleDocTemplate(str(path), pagesize=pagesize, leftMargin=15 * mm, rightMargin=15 * mm, topMargin=14 * mm,
                             bottomMargin=16 * mm, title=title, author="Lernlabore 2.0 – Lehrerprogramm")


TABLE_STYLE = TableStyle([
    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e5edff")),
    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
    ("FONTSIZE", (0, 0), (-1, -1), 8.5),
    ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#c9d2e0")),
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f6f8fb")]),
])


def _kopf(group: dict[str, Any], lab_title: str, titel: str, stand: str | None) -> list:
    return [P(titel, "h1"),
            P(f"Lerngruppe: {group['label']} ({KIND_NAME.get(group['kind'], group['kind'])}) · Lernlabor: {lab_title}", "p"),
            P(f"Datenstand vom Server: {fmt_time(stand)} · Bericht erstellt: {datetime.now():%d.%m.%Y %H:%M}", "klein"),
            Spacer(1, 6)]


def _stand(group: dict[str, Any]) -> str | None:
    return (group.get("results") or {}).get("fetched_at")


# ---------------------------------------------------------------- PDF: Klassenübersicht
def pdf_klassenuebersicht(path: str | Path, group: dict[str, Any], rows: list[Zeile], mit_einzelantworten: bool = True) -> Path:
    path = Path(path)
    if not rows:
        raise ValueError("Keine Ergebnisse vorhanden. Bitte zuerst „Lernstände jetzt abrufen“.")
    lab_title = rows[0].lab_title
    doc = _doc(path, f"Klassenübersicht {group['label']}", landscape(A4))
    story = _kopf(group, lab_title, "Klassenübersicht", _stand(group))
    fertig = sum(1 for z in rows if z.finished)
    avg = round(sum(z.percent for z in rows) / len(rows))
    story.append(P(f"{len(rows)} Teilnehmende · {fertig} haben alle Aufgaben abgeschlossen · durchschnittlicher Fortschritt {avg} %", "p"))
    story.append(Spacer(1, 6))
    aufgaben = [a.aufgabe for a in rows[0].antworten]
    head = ["Name", "Kennung", "Fortschritt", "Ergebnis", "Letzte Speicherung"]
    if mit_einzelantworten:
        head += [f"{a.position}. {a.title.split(':')[0]}" for a in aufgaben]
    data = [[P(h, "zelleB") for h in head]]
    for z in rows:
        line = [P(z.name), P(z.pseudonym), P(f"{z.percent} % ({z.completed}/{z.total})"), P(z.ergebnis_text), P(fmt_time(z.last_saved))]
        if mit_einzelantworten:
            for a in z.antworten:
                txt = a.antwort_text or a.messwerte or ("erledigt" if a.status == "completed" else "")
                if a.status == "open":
                    txt = "–"
                if a.aufgabe.graded and a.is_correct is not None:
                    txt += " (richtig)" if a.is_correct else " (nicht richtig)"
                line.append(P(txt))
        data.append(line)
    base = [42 * mm, 18 * mm, 24 * mm, 16 * mm, 26 * mm]
    if mit_einzelantworten and aufgaben:
        rest = (landscape(A4)[0] - 30 * mm - sum(base)) / len(aufgaben)
        base += [rest] * len(aufgaben)
    t = Table(data, colWidths=base, repeatRows=1)
    t.setStyle(TABLE_STYLE)
    story.append(t)
    story.append(Spacer(1, 8))
    story += _statistik_block(rows)
    doc.build(story, onFirstPage=_footer(True, "Klassenübersicht"), onLaterPages=_footer(True, "Klassenübersicht"))
    return path


def _statistik_block(rows: list[Zeile]) -> list:
    out: list = [P("Aufgabenstatistik", "h2")]
    data = [[P(h, "zelleB") for h in ("Aufgabe", "Erledigt", "Beim 1. Versuch richtig", "Antwortverteilung")]]
    for s in task_statistics(rows):
        a = s["aufgabe"]
        erst = f"{s['erst_richtig']} von {s['bewertet']}" if a.graded and s["bewertet"] else "–"
        vert = "; ".join(f"{k}: {v}" for k, v in sorted(s["verteilung"].items(), key=lambda kv: -kv[1]))
        data.append([P(f"{a.position}. {a.title}"), P(f"{s['erledigt']} von {s['n']}"), P(erst), P(vert or "–")])
    t = Table(data, colWidths=[80 * mm, 22 * mm, 30 * mm, None], repeatRows=1)
    t.setStyle(TABLE_STYLE)
    out.append(t)
    return out


# ---------------------------------------------------------------- PDF: Einzelauswertungen
def pdf_einzelauswertung(path: str | Path, group: dict[str, Any], rows: list[Zeile]) -> Path:
    path = Path(path)
    if not rows:
        raise ValueError("Keine Ergebnisse vorhanden.")
    doc = _doc(path, f"Einzelauswertung {group['label']}")
    story: list = []
    for i, z in enumerate(rows):
        if i:
            story.append(PageBreak())
        story += _kopf(group, z.lab_title, f"Einzelauswertung: {z.name}", _stand(group))
        story.append(P(f"Kennung: {z.pseudonym} · Fortschritt: {z.percent} % ({z.completed} von {z.total} Aufgaben) · "
                       f"Auswertungsfragen richtig: {z.ergebnis_text} · zuletzt gespeichert: {fmt_time(z.last_saved)}"
                       + (f" · abgeschlossen: {fmt_time(z.finished)}" if z.finished else ""), "p"))
        story.append(Spacer(1, 6))
        data = [[P(h, "zelleB") for h in ("Aufgabe", "Status", "Antwort", "Messwerte / Versuchsdaten", "Bewertung")]]
        for a in z.antworten:
            status = {"completed": "erledigt", "in_progress": "begonnen", "open": "offen"}[a.status]
            bew = "–"
            if a.aufgabe.graded and a.is_correct is not None:
                bew = "richtig" if a.is_correct else "nicht richtig"
                if a.first_is_correct is False and a.is_correct:
                    bew += " (im 2. Anlauf)"
            elif a.aufgabe.kind == "choice" and a.antwort_text:
                bew = "Vermutung (nicht bewertet)"
            data.append([P(f"{a.aufgabe.position}. {a.aufgabe.title}"), P(status), P(a.antwort_text or "–"), P(a.messwerte or "–"), P(bew)])
        t = Table(data, colWidths=[55 * mm, 17 * mm, 45 * mm, 42 * mm, 21 * mm], repeatRows=1)
        t.setStyle(TABLE_STYLE)
        story.append(t)
    doc.build(story, onFirstPage=_footer(True, "Einzelauswertung"), onLaterPages=_footer(True, "Einzelauswertung"))
    return path


# ---------------------------------------------------------------- PDF: offene Aufgaben
def pdf_offene_aufgaben(path: str | Path, group: dict[str, Any], rows: list[Zeile]) -> Path:
    path = Path(path)
    doc = _doc(path, f"Offene Aufgaben {group['label']}")
    story = _kopf(group, rows[0].lab_title if rows else "–", "Noch nicht abgeschlossene Aufgaben", _stand(group))
    data = [[P(h, "zelleB") for h in ("Name", "Kennung", "Fortschritt", "Offene Aufgaben")]]
    for z in rows:
        offen = z.offene
        if offen:
            data.append([P(z.name), P(z.pseudonym), P(f"{z.percent} %"), P("; ".join(f"{a.position}. {a.title.split(':')[0]}" for a in offen))])
    if len(data) == 1:
        story.append(P("Alle Teilnehmenden haben alle Aufgaben abgeschlossen.", "p"))
    else:
        t = Table(data, colWidths=[45 * mm, 20 * mm, 22 * mm, None], repeatRows=1)
        t.setStyle(TABLE_STYLE)
        story.append(t)
    doc.build(story, onFirstPage=_footer(True, "Offene Aufgaben"), onLaterPages=_footer(True, "Offene Aufgaben"))
    return path


# ---------------------------------------------------------------- PDF: anonym (Fortbildung)
def pdf_anonym(path: str | Path, group: dict[str, Any], rows: list[Zeile]) -> Path:
    """Datensparsame Statistik ohne Namen und ohne Kennungen – z. B. für Fortbildungen."""
    path = Path(path)
    doc = _doc(path, "Anonymisierte Auswertung")
    lab_title = rows[0].lab_title if rows else "–"
    story = [P("Anonymisierte Auswertung", "h1"), P(f"Lernlabor: {lab_title} · Gruppengröße: {len(rows)}", "p"),
             P("Diese Auswertung enthält keine Namen und keine Teilnehmerkennungen. Bei sehr kleinen Gruppen (unter 5 Personen) "
               "können dennoch Rückschlüsse möglich sein – dann bitte nicht weitergeben.", "klein"), Spacer(1, 6)]
    if rows:
        fertig = sum(1 for z in rows if z.finished)
        story.append(P(f"Abgeschlossen: {fertig} von {len(rows)} · Durchschnittlicher Fortschritt: {round(sum(z.percent for z in rows) / len(rows))} %", "p"))
        story += _statistik_block(rows)
    doc.build(story, onFirstPage=_footer(False, "Anonymisierte Auswertung"), onLaterPages=_footer(False, "Anonymisierte Auswertung"))
    return path


# ---------------------------------------------------------------- PDF: Zugangskarten
def lab_url(base_url: str, lab_id: str) -> str:
    base = (base_url or "").strip()
    if not base:
        return ""
    if not base.endswith("/"):
        base += "/"
    return f"{base}labore/{lab_id}/"


def pdf_zugangskarten(path: str | Path, group: dict[str, Any], base_url: str, lab_id: str, lab_title: str,
                      people: Iterable[dict[str, Any]] | None = None, mit_namen: bool = True) -> Path:
    """A4, 10 Karten je Seite (2 × 5), jeweils mit Code, QR-Code (Code nur im #-Fragment) und Hinweisen."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    people = list(people if people is not None else sorted_people(group))
    url = lab_url(base_url, lab_id)
    c = rl_canvas.Canvas(str(path), pagesize=A4)
    c.setTitle(f"Zugangskarten {group['label']}")
    w, h = A4
    cw, ch = 90 * mm, 52 * mm
    x0, y0 = (w - 2 * cw) / 2, h - 18 * mm
    for i, p in enumerate(people):
        if i and i % 10 == 0:
            c.showPage()
        col, row = (i % 10) % 2, (i % 10) // 2
        x, y = x0 + col * cw, y0 - (row + 1) * ch
        c.setDash(3, 3)
        c.setStrokeColor(colors.HexColor("#94a3b8"))
        c.roundRect(x + 2 * mm, y + 2 * mm, cw - 4 * mm, ch - 4 * mm, 4 * mm)
        c.setDash()
        c.setFillColor(colors.black)
        c.setFont("Helvetica-Bold", 9.5)
        c.drawString(x + 6 * mm, y + ch - 10 * mm, _safe(lab_title)[:48].replace("&amp;", "&"))
        if mit_namen and group["kind"] == "class":
            c.setFont("Helvetica-Bold", 11)
            c.drawString(x + 6 * mm, y + ch - 16 * mm, _safe(full_name(p))[:34].replace("&amp;", "&"))
        c.setFont("Helvetica", 7.5)
        c.drawString(x + 6 * mm, y + ch - 22 * mm, "Dein Zugangscode:")
        c.setFont("Courier-Bold", 15.5)
        c.drawString(x + 6 * mm, y + ch - 29 * mm, p["code"])
        c.setFont("Helvetica", 6.8)
        c.drawString(x + 6 * mm, y + 15 * mm, f"Kennung {p['pseudonym']} · {group['label'][:30]}")
        if group.get("code_valid_until"):
            c.drawString(x + 6 * mm, y + 11.5 * mm, f"gültig bis {fmt_time(group['code_valid_until'])}")
        c.drawString(x + 6 * mm, y + 8 * mm, "Code geheim halten. Kein Name nötig.")
        if url:
            c.setFont("Helvetica", 6)
            c.drawString(x + 6 * mm, y + 4.8 * mm, url.replace("https://", "")[:70])
            q = QrCodeWidget(f"{url}#zugang={p['code']}", barLevel="M")
            b = q.getBounds()
            size = 27 * mm
            d = Drawing(size, size, transform=[size / (b[2] - b[0]), 0, 0, size / (b[3] - b[1]), 0, 0])
            d.add(q)
            d.drawOn(c, x + cw - size - 5 * mm, y + ch - size - 7 * mm)
    if not people:
        c.setFont("Helvetica", 12)
        c.drawString(20 * mm, h - 30 * mm, "Keine Teilnehmenden in dieser Gruppe.")
    c.save()
    return path


# ---------------------------------------------------------------- CSV / XLSX
def _antwort_zeilen(rows: list[Zeile], mit_namen: bool = True) -> list[list[Any]]:
    out = [["Name", "Kennung", "Lernlabor", "Aufgabe", "Titel", "Status", "Antwort", "Messwerte", "richtig", "beim 1. Versuch richtig", "gespeichert"]]
    for z in rows:
        for a in z.antworten:
            out.append([z.name if mit_namen else "", z.pseudonym, z.lab_title, a.aufgabe.task_id, a.aufgabe.title, a.status,
                        a.antwort_text, a.messwerte, "" if a.is_correct is None else ("ja" if a.is_correct else "nein"),
                        "" if a.first_is_correct is None else ("ja" if a.first_is_correct else "nein"), fmt_time(a.gespeichert)])
    return out


def _uebersicht_zeilen(rows: list[Zeile]) -> list[list[Any]]:
    out = [["Nachname", "Vorname", "Kennung", "Lernlabor", "Fortschritt %", "Erledigt", "Gesamt", "Richtig", "Bewertet", "Letzte Speicherung", "Abgeschlossen"]]
    for z in rows:
        out.append([z.nachname or z.name, z.vorname, z.pseudonym, z.lab_title, z.percent, z.completed, z.total, z.correct, z.graded,
                    fmt_time(z.last_saved), fmt_time(z.finished) if z.finished else ""])
    return out


def _schutz(v: Any) -> Any:
    """Schutz vor Formel-Injektion in Tabellenkalkulationen."""
    if isinstance(v, str) and v[:1] in ("=", "+", "-", "@", "\t", "\r"):
        return "'" + v
    return v


def csv_export(path: str | Path, rows: list[Zeile], mit_antworten: bool = True) -> Path:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    data = _antwort_zeilen(rows) if mit_antworten else _uebersicht_zeilen(rows)
    with path.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f, delimiter=";")
        for r in data:
            w.writerow([_schutz(v) for v in r])
    return path


def xlsx_export(path: str | Path, group: dict[str, Any], rows: list[Zeile]) -> Path:
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill
    from openpyxl.utils import get_column_letter

    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    wb = Workbook()
    blaetter = [("Übersicht", _uebersicht_zeilen(rows)), ("Antworten", _antwort_zeilen(rows)),
                ("Offene Aufgaben", [["Name", "Kennung", "Offene Aufgaben"]] + [[z.name, z.pseudonym, "; ".join(a.title for a in z.offene)] for z in rows if z.offene])]
    for i, (name, data) in enumerate(blaetter):
        ws = wb.active if i == 0 else wb.create_sheet()
        ws.title = name
        for r in data:
            ws.append([_schutz(v) for v in r])
        for c in ws[1]:
            c.font = Font(bold=True)
            c.fill = PatternFill("solid", fgColor="E5EDFF")
        ws.freeze_panes = "A2"
        for col in range(1, len(data[0]) + 1):
            width = max(len(str(r[col - 1])) if col - 1 < len(r) else 0 for r in data[:200])
            ws.column_dimensions[get_column_letter(col)].width = min(60, max(10, width + 2))
    info = wb.create_sheet("Hinweis")
    info.append(["VERTRAULICH – enthält personenbezogene Daten. Nur lokal speichern."])
    info.append([f"Lerngruppe: {group['label']}", f"Datenstand: {fmt_time(_stand(group))}", f"Erstellt: {datetime.now():%d.%m.%Y %H:%M}"])
    wb.save(path)
    return path
