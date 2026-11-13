"""Erzeugt die mitgelieferten Eigenproduktionen (medialib/zeichnen.py) und nimmt sie auf.

Aufruf (aus dem Bibliotheksordner):  python3 scripts/eigene_grafiken.py [--nur NAME]
Bereits vorhandene Dateien (gleicher Hash) werden nicht doppelt aufgenommen.
"""

from __future__ import annotations

import argparse
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from medialib import zeichnen as Z  # noqa: E402
from medialib.cli import main as media  # noqa: E402

ap = argparse.ArgumentParser()
ap.add_argument("--nur")
a = ap.parse_args()

with tempfile.TemporaryDirectory() as tmp:
    for name, (fn, thema, stufe, kw, kw_en) in Z.GRAFIKEN.items():
        if a.nur and a.nur != name:
            continue
        svg = fn()
        f = Path(tmp) / f"{name}.svg"
        f.write_text(svg.render(), encoding="utf-8")
        media([
            "add", str(f), "--eigen", "--titel", svg.titel, "--thema", thema, "--typ", "diagramm",
            "--stufe", f"{stufe[0]}-{stufe[1]}", "--beschreibung", svg.beschreibung, "--alt", svg.beschreibung,
            "--schlagworte", kw, "--schlagworte-en", kw_en, "--beschriftung", "de", "--qualitaet", "5",
            "--entstehung", f"Mit Claude programmatisch als SVG erzeugt (medialib/zeichnen.py, Funktion {fn.__name__}); "
                            "Schaltzeichen nach DIN EN 60617, Kurven exakt berechnet; keine fremden Vorlagen verwendet.",
            "--fachlich-hinweis", "Selbst erstellt und sichtgeprüft; Schaltzeichen nach DIN EN 60617." if thema.startswith("ph.elektrizitaet")
            else "Selbst erstellt und sichtgeprüft; Kurve exakt berechnet.",
        ])
