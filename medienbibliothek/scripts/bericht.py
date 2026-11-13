"""Erzeugt BERICHT.md (Abschlussbericht) aus Datenbank, Quellenmatrix, Importstatus und Testergebnissen.

Aufruf (im Bibliotheksordner):  python3 scripts/bericht.py
"""

from __future__ import annotations

import json
import re
import sys
import time
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from medialib import licenses  # noqa: E402
from medialib.cli import statistik  # noqa: E402
from medialib.db import DB  # noqa: E402
from medialib.importer import load_plan  # noqa: E402
from medialib.taxonomy import load as load_tax  # noqa: E402

db = DB()
st = statistik(db)
tax = load_tax()
qm = json.loads((ROOT / "sources" / "quellenmatrix.json").read_text(encoding="utf-8"))
tests = json.loads((ROOT / "reports" / "testergebnisse.json").read_text(encoding="utf-8")) if (ROOT / "reports" / "testergebnisse.json").exists() else []
plan = load_plan()

TYP = {"diagramm": "Diagramm/Schema", "grafik": "Grafik", "foto": "Foto", "animation": "Animation (GIF)", "video": "Video",
       "cartoon": "Cartoon", "comic": "Comic", "historisch": "Historische Abbildung", "illustration": "Illustration",
       "symbol": "Symbol/Icon (SVG)", "simulation": "Interaktive Simulation (Link)", "3d-modell": "3D-Modell"}


def tab(d: dict, k1: str, k2: str = "Anzahl", label=lambda x: x) -> list[str]:
    out = [f"| {k1} | {k2} |", "|---|---:|"]
    for k, v in d.items():
        out.append(f"| {label(k)} | {v} |")
    return out


lok = st["speicherung"].get("lokal", 0)
ext = st["speicherung"].get("extern", 0)
kand_st = st["kandidaten"]
gepr = sum(kand_st.values())
plan_status = Counter(r[0] for r in db.con.execute("SELECT status FROM plan_status"))
entdeckt = plan_status.get("entdeckt", 0)
# Gründe für Ablehnungen
gruende = Counter()
for (g,) in db.con.execute("SELECT grund FROM kandidaten WHERE status IN ('abgelehnt','abgelehnt-kuration','fehler')"):
    g = g or "?"
    g = re.sub(r"Lizenz \S+ \(.*?\) Kategorie (\w)", r"Lizenz Kategorie \1", g)
    g = re.sub(r"\(\d+x\d+\)|\d+ px|HTTP \d+ für .*|https?://\S+", "", g)
    g = g.split(":")[0] if g.startswith("Sichtprüfung") else g
    gruende[g.strip()[:90]] += 1
# Lücken: Themen (Ebene 3) ohne lokales Medium
mit_medium = {r[0] for r in db.con.execute("SELECT hauptthema FROM medien WHERE speicherung='lokal'")}
mit_medium |= {u for it in db.all("speicherung='lokal'") for u in it.get("unterthemen") or []}
blaetter = [k for k, kn in tax.knoten.items() if k.count(".") >= 2 and not kn.kinder]
luecken = [k for k in blaetter if k not in mit_medium]
nur_extern = [k for k in luecken if db.con.execute("SELECT 1 FROM medien WHERE hauptthema=? AND speicherung='extern'", (k,)).fetchone()]

L = []
A = L.append
A("# Abschlussbericht: Medienbibliothek Mathematik & Physik")
A("")
A(f"Stand: {time.strftime('%Y-%m-%d %H:%M')} · erzeugt mit `python3 scripts/bericht.py` aus Datenbank, Quellenmatrix und Testergebnissen.")
A("")
A("## 1. Speicherort")
A("")
A("- Bibliothek im Repository: `medienbibliothek/` (Branch `claude/medienbibliothek-mathe-physik-mvhzqh`), dauerhaft per Git gesichert.")
A("- Zentraler Speicherort `~/Unterrichtsmedien/Mathe-Physik/` = Verweis auf diesen Ordner, angelegt von `install.sh` "
  "(Abweichung vom Vorschlag: Die Arbeitsumgebung war ein flüchtiger Cloud-Container; nur das Repository bleibt erhalten).")
A("- Projektübergreifend: Befehl `media` (`~/.local/bin`), globale Skill `~/.claude/skills/medienbibliothek`, Hinweisblock in `~/.claude/CLAUDE.md`.")
A("")
A("## 2. Technischer Aufbau")
A("")
A("Python (Standardbibliothek für Suche/Lizenzen/Nachweise; `requests`/`Pillow` nur für Import), SQLite mit FTS5 (Wort- und Trigramm-Index), "
  "versionierter JSONL-Katalog als Quelle der Wahrheit (automatischer Index-Neuaufbau), JSON-Konfiguration (Taxonomie mit "
  f"{len(tax.knoten)} Knoten, Lizenztabelle, Profile, Importplan mit {len(plan)} Einträgen), statische Weboberfläche, CLI `media`, "
  "Claude-Code-Skill. Details: [README.md](README.md).")
A("")
A("## 3. Bestand")
A("")
A(f"- **{st['gesamt']} Medien** erfasst: **{lok} lokal gespeichert** (Dateien in `assets/`, {st['speicher_mb']} MB) und **{ext} extern verlinkt** "
  f"(Simulationen, Webcomics, Lehrbücher), {st['speicherung'].get('kandidat', 0)} Recherchekandidat(en).")
A(f"- Sichtgeprüft/kuratiert: {db.con.execute('SELECT COUNT(*) FROM medien WHERE kuratiert=1').fetchone()[0]} Medien; "
  f"fachlich als sichtgeprüft markiert: {st['fachlich'].get('sichtgeprueft', 0)}.")
A(f"- Geprüfte Kandidaten insgesamt: {gepr} ({', '.join(f'{k}: {v}' for k, v in kand_st.items())}). "
  f"Importplan: {entdeckt} von {len(plan)} Anfragen ausgeführt.")
A("")
A("### 4. Verteilung Mathematik / Physik")
A("")
L += tab({("Mathematik" if k == "mathematik" else "Physik" if k == "physik" else k): v for k, v in st["fach"].items()}, "Fach")
A("")
L += tab({tax.label(k) + f" (`{k}`)": v for k, v in st["bereich"].items()}, "Bereich")
A("")
A("Lokal gespeicherte Medien nach Fach: " + ", ".join(
    f"{k}: {v}" for k, v in db.con.execute("SELECT fach, COUNT(*) FROM medien WHERE speicherung='lokal' GROUP BY 1").fetchall()))
A(f"Klassenstufen (Überschneidung): Sek I {st['stufen']['Sek I (5-10)']}, Sek II {st['stufen']['Sek II (11-13)']}.")
A("")
A("### 5. Verteilung nach Medientyp")
A("")
L += tab(st["medientyp"], "Medientyp", label=lambda k: TYP.get(k, k))
A("")
L += tab(st["format"], "Dateiformat (lokal bzw. Verweis)")
A("")
A("### 6. Verteilung nach Lizenz")
A("")
L += tab(st["lizenz_kategorie"], "Kategorie", label=lambda k: {"A": "A – offen (CC0/PD/CC BY/CC BY-SA)", "B": "B – eingeschränkt (NC, Anbieterlizenz)",
                                                             "C": "C – ungeklärt", "E": "E – Eigenproduktion"}.get(k, k))
A("")
L += tab({licenses.get(k).name + f" (`{k}`)": v for k, v in st["lizenz"].items()}, "Lizenz")
A("")
L += tab(st["herkunft"], "Quelle")
A("")
A("## 7. Geprüfte Bildquellen")
A("")
ent = {"lokal-import": "lokal importiert", "extern-verlinkt": "nur extern verlinkt", "einzeln-moeglich": "Einzelaufnahme möglich, nicht automatisiert",
       "nicht-verwendet": "nicht verwendet"}
A(f"{len(qm['quellen'])} Quellen geprüft (Prüfdatum {qm['geprueft_am']}); vollständige Matrix mit Bewertung: [sources/QUELLEN.md](sources/QUELLEN.md).")
A("")
A("| Quelle | Entscheidung | Lizenz(en) | Bedingungen geprüft unter |")
A("|---|---|---|---|")
for q in qm["quellen"]:
    A(f"| [{q['name']}]({q['url']}) | {ent[q['entscheidung']]} | {q['lizenzen'].replace('|', '/')} | {q['bedingungen_url'] or '– (nicht verfügbar)'} |")
A("")
A("### Nicht für automatischen lokalen Download verwendet (Auswahl mit Grund)")
A("")
for q in qm["quellen"]:
    if q["entscheidung"] in ("extern-verlinkt", "nicht-verwendet"):
        A(f"- **{q['name']}:** {q['begruendung']}")
A("")
A("## 8. Implementierte Suchbefehle")
A("")
A("```")
for c in ['media search "schiefer Wurf" --fach physik', 'media search "quadratische Funktion" --fach mathematik',
          'media search "elektrische Feldlinien" --typ svg', 'media search "Newton Gesetze" --typ cartoon --profil unterricht',
          'media search "Reflexion Brechung" --stufe 8-10', 'media search "Pendel Schwingung" --typ animation',
          'media search "Kreisfläche" --profil offen --json', 'media show ID | media credit ID --format html | media verzeichnis ID… --profil offen',
          'media check ID… --profil offen | media export ID… --ziel ORDNER | media add DATEI --eigen …',
          'media topics | media stats | media verify | media backup | media serve | media web | media original ID']:
    A(c)
A("```")
A("Vollständige Referenz: README Abschnitt 4.")
A("")
A("## 9. Nutzung aus Claude Code")
A("")
A("Skill `medienbibliothek` (global und im Repository) mit verbindlichem Ablauf: Bedarf analysieren → `media search … --json` → "
  "Treffer bewerten → `media export` → nur bei Bedarf neu zeichnen (`medialib/zeichnen.py`) → `media verzeichnis` für Bildnachweise → "
  "gute Eigenproduktionen mit `media add --eigen` aufnehmen. Die Repository-`CLAUDE.md` legt für das öffentliche GitHub-Pages-Repository das Profil `offen` fest.")
A("")
A("## 10. Eigene visuelle Suche")
A("")
A("`medienbibliothek/index.html` per Doppelklick oder `media serve`. Filter nach Fach, Thema, Medientyp, Stufe, Lizenzprofil, lokal, S/W; "
  "Detailansicht mit Animation, Lizenz, kopierbarem Bildnachweis, Pfad/Download und Warnhinweisen.")
A("")
A("## 11. Erweiterung")
A("")
A("Importplan ergänzen und `python3 scripts/import_lauf.py` (wiederaufnehmbar); neue Quellenadapter in `medialib/sources/`; "
  "`media add` für Einzelmedien; `media verify` für Nachprüfungen und tote Links; `media backup/restore`; Kuration über "
  "`media kontaktbogen` + `scripts/kuratieren.py`.")
A("")
A("## 12. Offene Lizenzfragen und bekannte Einschränkungen")
A("")
A("- **Wikimedia-Drosselung:** Ohne Kontaktangabe im User-Agent gilt die Klasse „unidentifiziert“ (ca. 10 Anfragen/min je IP, geteilte "
  "Egress-IP). Effektiv ca. 1 Suchanfrage pro Minute; Originaldateien lieferten 429 mit Retry-After 600 s und dem Hinweis, "
  "Vorschaubilder in Standardgrößen zu nutzen. Daher sind Commons-Medien lokal als PNG/JPG/GIF in Wikimedia-Standardbreiten "
  "(SVG-Originale als 1280-px-PNG) gespeichert; das Vektor-Original ist verlinkt und per `media original ID` einzeln nachladbar.")
A(f"- **Importplan nicht vollständig abgearbeitet:** {entdeckt} von {len(plan)} Anfragen ausgeführt. "
  "`python3 scripts/import_lauf.py` setzt an dieser Stelle fort.")
A("- **Gemeinfreiheit nach US-Recht (NASA, PD-USGov):** in Deutschland nicht abschließend geklärt; NASA erlaubt Bildungsnutzung ausdrücklich. Gekennzeichnet (`us-pd`).")
A("- **Persönlichkeitsrechte/Marken:** aus den Quellmetadaten übernommen und gekennzeichnet; keine werbliche Nutzung.")
A("- **CC BY-SA:** Unverändert eingebunden genügt der Bildnachweis; bearbeitete Fassungen müssen unter derselben Lizenz weitergegeben werden (Hinweis in Nachweis und Prüfung).")
A("- **PhET** steht inzwischen unter CC BY-NC 4.0 (nicht mehr CC BY) → nur Profil `unterricht`/`extern`.")
A("- **Eigenproduktionen** sind nicht automatisch gemeinfrei/CC0; die Lizenz legt die veröffentlichende Lehrkraft fest.")
A("- Automatische Qualitätsmerkmale (S/W-Eignung, Transparenz, Beschriftungssprache) sind Heuristiken; maßgeblich ist die Sichtprüfung (`fachlich`, `qualitaet`).")
A("- Cartoons/Comics mit freier Lizenz sind selten: lokal nur gemeinfreie historische Karikaturen und frei lizenzierte Zeichnungen; moderne Webcomics (xkcd) nur verlinkt (NC).")
A("- Nicht verifizierbar (403/404/JavaScript-Seiten): Smithsonian, Europeana, NOAA, NOIRLab, LEIFIphysik, ZUM-Unterrichten, Desmos, Wolfram – nicht verwendet.")
if luecken:
    A(f"- **Themenlücken** (Blattthemen ohne lokales Medium, {len(luecken)} von {len(blaetter)}): " +
      ", ".join(f"{tax.label(k)}" + (" (nur extern)" if k in nur_extern else "") for k in luecken) + ".")
A("")
A("### Häufigste Ablehnungsgründe beim Import")
A("")
for g, n in gruende.most_common(12):
    A(f"- {n}× {g}")
A("")
A("## 13. Ergebnisse der Funktionstests")
A("")
if tests:
    A(f"{sum(t['bestanden'] for t in tests)} von {len(tests)} Akzeptanztests bestanden; Protokolle: [reports/testergebnisse.md](reports/testergebnisse.md). "
      "Zusätzlich Unit-Tests: `python3 -m unittest discover -s tests`.")
    A("")
    A("| Test | Ergebnis | Fazit |")
    A("|---|---|---|")
    for t in tests:
        A(f"| {t['test']} | {'bestanden' if t['bestanden'] else 'nicht bestanden'} | {t['fazit'].replace('|', '/')} |")
else:
    A("Noch nicht ausgeführt.")
A("")
(ROOT / "BERICHT.md").write_text("\n".join(L) + "\n", encoding="utf-8")
print(f"BERICHT.md geschrieben ({len(L)} Zeilen)")
