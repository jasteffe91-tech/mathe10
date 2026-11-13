"""Akzeptanztests A–F gegen den echten Bestand. Schreibt reports/testergebnisse.md (+ .json).

Aufruf (im Bibliotheksordner):  python3 tests/akzeptanz.py [--ohne-claude]
--ohne-claude: Test F ohne echte Claude-Code-Sitzung (nur Installations-/CLI-Prüfung).
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MEDIA = str(ROOT / "bin" / "media")
OUT = ROOT / "reports"
MAT = OUT / "testmaterial"


def media(*args, env=None, cwd=None):
    r = subprocess.run([MEDIA, *args], capture_output=True, text=True, env=env or os.environ.copy(), cwd=cwd or tempfile.gettempdir())
    return r.returncode, r.stdout, r.stderr


def suche(q, *opts):
    rc, out, err = media("search", q, "--json", "--limit", "10", *opts)
    if rc != 0:
        raise RuntimeError(err)
    return json.loads(out)


ergebnisse = []


def test(name, beschreibung):
    def deco(fn):
        def run(*a):
            t0 = time.time()
            protokoll = []
            try:
                ok, fazit = fn(protokoll, *a)
            except Exception as exc:  # noqa: BLE001
                ok, fazit = False, f"Ausnahme: {exc}"
            ergebnisse.append({"test": name, "beschreibung": beschreibung, "bestanden": bool(ok), "fazit": fazit,
                               "protokoll": protokoll, "dauer_s": round(time.time() - t0, 1)})
            print(f"{'BESTANDEN' if ok else 'FEHLGESCHLAGEN'}  {name}: {fazit}", flush=True)
        return run
    return deco


def kurz(t):
    return f"{t['id']} | {t['titel']} | {t['medientyp']}/{t['format']} | {t['lizenz']} [{t['lizenz_kategorie']}] | Score {t['score']}"


@test("A – Mathematik", "Arbeitsblatt zu quadratischen Funktionen: passende Funktionsgraphen finden und einbinden")
def test_a(p):
    r = suche("quadratische Funktion Parabel", "--fach", "mathematik", "--profil", "offen")
    p.append(f"Anfrage 'quadratische Funktion Parabel' (Mathematik, Profil offen): {r['treffer_gesamt']} Treffer")
    graphen = [t for t in r["treffer"] if t["medientyp"] in ("diagramm", "grafik") and t["speicherung"] == "lokal"
               and (t["thema"] or "").startswith("ma.funktionen") and not t.get("nur_verwandt")]
    for t in r["treffer"][:6]:
        p.append("  " + kurz(t))
    if len(graphen) < 2:
        return False, f"nur {len(graphen)} passende lokale Funktionsgraphen"
    wahl = [t["id"] for t in graphen[:3]]
    ziel = MAT / "A_quadratische_funktionen"
    if ziel.exists():
        shutil.rmtree(ziel)
    rc, out, err = media("export", *wahl, "--ziel", str(ziel / "medien"), "--profil", "offen")
    p.append(f"Export: rc={rc} {out.strip()} {err.strip()}")
    rc2, nachweis_html, err2 = media("verzeichnis", *wahl, "--format", "html", "--profil", "offen")
    dateien = sorted((ziel / "medien").glob("abb-*"))
    figs = "\n".join(
        f'<figure><img src="medien/{d.name}" alt="{t["alt_text"] or t["titel"]}" style="max-width:100%;max-height:300px">'
        f'<figcaption>Abb. {n}: {t["titel"]}</figcaption></figure>'
        for n, (d, t) in enumerate(zip(dateien, graphen[:3]), 1))
    html = f"""<!doctype html><html lang="de"><meta charset="utf-8"><title>Arbeitsblatt Quadratische Funktionen</title>
<body style="font-family:sans-serif;max-width:800px;margin:auto">
<h1>Arbeitsblatt: Quadratische Funktionen</h1>
<ol><li>Beschreibe den Verlauf der Parabel in Abb. 1 und lies den Scheitelpunkt ab.</li>
<li>Gib die Funktionsgleichung in Scheitelpunktform an.</li>
<li>Vergleiche mit der Normalparabel: Wie wurde verschoben?</li></ol>
{figs}
<footer style="font-size:12px;margin-top:2em">{nachweis_html}</footer></body></html>"""
    ziel.mkdir(parents=True, exist_ok=True)
    (ziel / "arbeitsblatt.html").write_text(html, encoding="utf-8")
    nachweise = (ziel / "medien" / "BILDNACHWEISE.md").read_text(encoding="utf-8") if (ziel / "medien" / "BILDNACHWEISE.md").exists() else ""
    ok = rc == 0 and rc2 == 0 and len(dateien) == len(wahl) and nachweise.count("Abb. ") == len(wahl)
    p.append(f"Arbeitsblatt erzeugt: {ziel / 'arbeitsblatt.html'} mit {len(dateien)} Abbildungen und Bildnachweisen")
    return ok, f"{len(graphen)} passende Graphen; {len(dateien)} eingebunden, Bildnachweise erzeugt (Profil offen)"


@test("B – Physik", "Stromkreis mit zwei parallel geschalteten Lampen: fachlich korrekte Grafik oder präzise Neuerstellung")
def test_b(p):
    r = suche("Parallelschaltung zwei Lampen", "--fach", "physik", "--profil", "offen")
    for t in r["treffer"][:5]:
        p.append("  " + kurz(t) + (f" | Hinweis: {t['fachlich_hinweis']}" if t.get("fachlich_hinweis") else ""))
    top = r["treffer"][0] if r["treffer"] else None
    if not top:
        return False, "kein Treffer"
    lampen = "Lampe" in top["titel"] and "Parallel" in top["titel"]
    din = "DIN" in (top.get("fachlich_hinweis") or "") and "us-schaltzeichen" not in json.dumps(top.get("hinweise"))
    p.append("Bestand vor dieser Arbeit: Commons-Treffer zeigten Widerstände bzw. US-Schaltzeichen, keine zwei Lampen nach DIN EN 60617 "
             "→ präzise Eigenproduktion erstellt (medialib/zeichnen.py: parallelschaltung_lampen) und mit `media add --eigen` aufgenommen.")
    us = [t["id"] for t in r["treffer"] if any("US-Norm" in h for h in t.get("hinweise", []))]
    if us:
        p.append(f"Treffer mit US-Schaltzeichen werden gekennzeichnet: {', '.join(us)}")
    return lampen and din, f"Top-Treffer {top['id']} ({top['titel']}), DIN-konform: {din}"


@test("C – Motivationsbild", "Humorvoller Cartoon für den Einstieg zu Newtons Gesetzen, mit Lizenzfiltern")
def test_c(p):
    res = {}
    for prof in ("offen", "unterricht", "extern"):
        r = suche("Newton Gesetze Trägheit", "--typ", "cartoon", "--profil", prof)
        res[prof] = r["treffer"]
        p.append(f"Profil {prof}: {r['treffer_gesamt']} Cartoon/Comic-Treffer, {r['durch_profil_ausgeschlossen']} durch Lizenz ausgeschlossen")
        for t in r["treffer"][:4]:
            p.append("  " + kurz(t) + (" (nur verwandt)" if t.get("nur_verwandt") else ""))
    offen_ok = all(t["lizenz_kategorie"] in ("A", "E") for t in res["offen"])
    unterricht_b = [t for t in res["unterricht"] if t["lizenz_kategorie"] == "B"]
    for t in unterricht_b[:1]:
        p.append(f"  Hinweise B-Treffer: {t['hinweise'][:3]}")
    gefunden = any(not t.get("nur_verwandt") for prof in res for t in res[prof])
    return offen_ok and gefunden, (f"Profil offen nur A/E: {offen_ok}; Treffer offen/unterricht/extern: "
                                   f"{len(res['offen'])}/{len(res['unterricht'])}/{len(res['extern'])}")


@test("D – Animation", "Animation einer harmonischen Schwingung: lokale Animation oder geprüfter externer Verweis")
def test_d(p):
    r = suche("harmonische Schwingung", "--typ", "animation", "--profil", "offen")
    for t in r["treffer"][:4]:
        p.append("  " + kurz(t) + f" | {t['pfad']}")
    lokal = [t for t in r["treffer"] if t["format"] == "gif" and t["pfad"] and Path(t["pfad"]).exists()]
    if lokal:
        try:
            from PIL import Image

            with Image.open(lokal[0]["pfad"]) as im:
                frames = getattr(im, "n_frames", 1)
            p.append(f"  {lokal[0]['id']}: {frames} Einzelbilder (animiert: {frames > 1})")
        except Exception as exc:  # noqa: BLE001
            p.append(f"  Pillow nicht verfügbar: {exc}")
    s = suche("Federpendel Schwingung", "--typ", "simulation", "--profil", "extern")
    for t in s["treffer"][:2]:
        p.append("  extern: " + kurz(t) + f" | {t['url']}")
    return bool(lokal or s["treffer"]), f"{len(lokal)} lokale GIF-Animation(en); {len(s['treffer'])} externe Simulation(en)"


@test("E – Lizenzsicherheit", "Öffentliche Materialsammlung: NC-, ungeklärte und unpassende Lizenzen müssen ausgeschlossen werden")
def test_e(p):
    rc, out, _ = media("stats", "--json")
    st = json.loads(out)
    ids = {}
    import sqlite3

    con = sqlite3.connect(ROOT / "database" / "media.sqlite")
    for kat, extra in (("A", "speicherung='lokal'"), ("E", "1=1"), ("B", "1=1"), ("C", "1=1")):
        r = con.execute(f"SELECT id FROM medien WHERE lizenz_kategorie=? AND {extra} ORDER BY id LIMIT 1", (kat,)).fetchone()
        if r:
            ids[kat] = r[0]
    p.append(f"Testauswahl: {ids}")
    rc, out, err = media("verzeichnis", *ids.values(), "--profil", "offen")
    p.append(f"media verzeichnis --profil offen → Exit {rc}; Meldung: {err.strip()[:300]}")
    blockiert = rc == 3 and ids.get("B", "#") in err and ids.get("C", "#") in err
    ziel = MAT / "E_oeffentliche_sammlung"
    if ziel.exists():
        shutil.rmtree(ziel)
    rc2, out2, err2 = media("export", *ids.values(), "--ziel", str(ziel), "--profil", "offen")
    p.append(f"media export --profil offen → Exit {rc2} (erwartet 3 = abgebrochen)")
    rc3, out3, err3 = media("export", *ids.values(), "--ziel", str(ziel), "--profil", "offen", "--nur-zulaessige")
    exportiert = sorted(f.name for f in ziel.glob("abb-*"))
    p.append(f"mit --nur-zulaessige → Exit {rc3}, exportiert: {exportiert}; {out3.strip()}")
    # Stichprobe: Suchen im Profil offen dürfen nie B/C/ungeprüft liefern
    verstoss = []
    for q in ("Newton", "Pendel", "Parabel", "Comic", "Simulation", "Stromkreis", "Planet", "Wahrscheinlichkeit"):
        for t in suche(q, "--profil", "offen")["treffer"]:
            if t["lizenz_kategorie"] not in ("A", "E") or t["lizenz_status"] not in ("verifiziert", "eigen"):
                verstoss.append(t["id"])
    p.append(f"Stichprobe 8 Suchen im Profil offen: Verstöße {verstoss or 'keine'}")
    ok = blockiert and rc2 == 3 and len(exportiert) == sum(1 for k in ids if k in ("A", "E")) and not verstoss
    return ok, f"NC/ungeklärt blockiert: {blockiert}; Export nur zulässige: {exportiert}; Suchstichprobe sauber: {not verstoss}"


@test("F – Andere Sitzung/anderes Projekt", "Neue Claude-Code-Sitzung in einem fremden Projekt findet und nutzt die zentrale Bibliothek")
def test_f(p, mit_claude=True):
    tmp_home = Path(tempfile.mkdtemp(prefix="home-F-"))
    env = os.environ.copy()
    env["HOME"] = str(tmp_home)
    env.pop("MEDIA_LIB_ROOT", None)
    r = subprocess.run(["bash", str(ROOT / "install.sh")], capture_output=True, text=True, env=env)
    p.append("install.sh (mit leerem Test-HOME): " + " | ".join(l for l in r.stdout.splitlines() if l.startswith(("✓", "!"))))
    checks = {
        "Skill global": (tmp_home / ".claude" / "skills" / "medienbibliothek" / "SKILL.md").exists(),
        "CLI-Link": (tmp_home / ".local" / "bin" / "media").exists(),
        "Speicherort ~/Unterrichtsmedien/Mathe-Physik": (tmp_home / "Unterrichtsmedien" / "Mathe-Physik" / "config").exists(),
        "CLAUDE.md-Hinweis": "medienbibliothek:start" in (tmp_home / ".claude" / "CLAUDE.md").read_text(),
    }
    projekt = Path(tempfile.mkdtemp(prefix="anderes-projekt-"))
    r2 = subprocess.run([str(tmp_home / ".local" / "bin" / "media"), "search", "Satz des Pythagoras", "--json", "--limit", "3"],
                        capture_output=True, text=True, env=env, cwd=projekt)
    try:
        treffer = json.loads(r2.stdout)["treffer"]
    except Exception:  # noqa: BLE001
        treffer = []
    checks["CLI-Suche aus fremdem Projekt"] = bool(treffer)
    p.append("Checks: " + json.dumps(checks, ensure_ascii=False))
    for t in treffer[:3]:
        p.append("  " + kurz(t))
    shutil.rmtree(tmp_home, ignore_errors=True)
    claude_ok = None
    if mit_claude and shutil.which("claude"):
        # Echte, frische Claude-Code-Sitzung in einem leeren Projektordner (globale Installation im echten HOME)
        ri = subprocess.run(["bash", str(ROOT / "install.sh")], capture_output=True, text=True)
        p.append("Globale Installation im echten HOME: " + ("ok" if ri.returncode == 0 else ri.stderr[-200:]))
        prompt = ("Ich erstelle ein Physik-Arbeitsblatt für Klasse 9 über den Satz des Pythagoras in der Mathematik "
                  "und brauche eine passende, frei veröffentlichbare Abbildung. Nutze die vorhandene Medienbibliothek. "
                  "Nenne die ID, den Dateipfad und den fertigen Bildnachweis des besten Treffers.")
        rc = subprocess.run(["claude", "-p", prompt, "--max-turns", "8", "--allowedTools", "Bash", "Read", "Skill", "Glob", "Grep"],
                            capture_output=True, text=True, cwd=projekt, timeout=600)
        antwort = rc.stdout.strip()
        p.append("Antwort der neuen Sitzung (gekürzt): " + antwort[:900].replace("\n", " ⏎ "))
        import re

        ids = re.findall(r"\b(?:wmc|eig|nasa|wel|met|omj|ext|man)-[0-9a-f]{8}\b", antwort)
        claude_ok = bool(ids)
        p.append(f"Gefundene Medien-IDs in der Antwort: {sorted(set(ids))}")
    ok = all(checks.values()) and (claude_ok is not False)
    return ok, f"Installation/CLI: {all(checks.values())}; echte Claude-Sitzung nutzt Bibliothek: {claude_ok}"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ohne-claude", action="store_true")
    a = ap.parse_args()
    MAT.mkdir(parents=True, exist_ok=True)
    test_a()
    test_b()
    test_c()
    test_d()
    test_e()
    test_f(not a.ohne_claude)
    (OUT / "testergebnisse.json").write_text(json.dumps(ergebnisse, ensure_ascii=False, indent=1), encoding="utf-8")
    md = [f"# Akzeptanztests A–F", "", f"Ausgeführt: {time.strftime('%Y-%m-%d %H:%M')} · "
          f"{sum(e['bestanden'] for e in ergebnisse)}/{len(ergebnisse)} bestanden", ""]
    for e in ergebnisse:
        md += [f"## {e['test']} – {'✅ bestanden' if e['bestanden'] else '❌ nicht bestanden'}", "", f"*{e['beschreibung']}*", "",
               f"**Fazit:** {e['fazit']}", "", "```", *e["protokoll"], "```", ""]
    (OUT / "testergebnisse.md").write_text("\n".join(md), encoding="utf-8")
    print(f"\n{sum(e['bestanden'] for e in ergebnisse)}/{len(ergebnisse)} bestanden → reports/testergebnisse.md")
    return 0 if all(e["bestanden"] for e in ergebnisse) else 1


if __name__ == "__main__":
    sys.exit(main())
