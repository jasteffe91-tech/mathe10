"""Kompletter, wiederaufnehmbarer Importlauf (Entdecken + Auswählen + Laden in Etappen).

Aufruf (aus dem Bibliotheksordner):  python3 scripts/import_lauf.py [--etappe 12] [--nur REGEX]
Kann jederzeit abgebrochen und neu gestartet werden: Bereits entdeckte Planeinträge,
geprüfte Kandidaten und geladene Medien werden übersprungen.
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from medialib import importer as I  # noqa: E402
from medialib.db import DB  # noqa: E402
from medialib.webexport import export_web  # noqa: E402

ap = argparse.ArgumentParser()
ap.add_argument("--etappe", type=int, default=12)
ap.add_argument("--nur")
a = ap.parse_args()

db = DB()
plan = I.priorisieren(I.load_plan())
if a.nur:
    plan = [p for p in plan if re.search(a.nur, p["id"])]
offen = [p for p in plan if (db.con.execute("SELECT status FROM plan_status WHERE plan_id=?", (p["id"],)).fetchone() or ["-"])[0] != "entdeckt"]
print(f"{len(offen)} von {len(plan)} Planeinträgen noch zu entdecken", flush=True)
for i in range(0, max(len(offen), 1), a.etappe):
    etappe = offen[i:i + a.etappe]
    if etappe:
        I.entdecken(db, etappe)
    ids = "|".join(re.escape(p["id"]) for p in plan)
    I.auswaehlen(db, plan)
    I.herunterladen(db, plan)
    I.svg_vorschauen(db)
    export_web(db)
    n = db.con.execute("SELECT COUNT(*) FROM medien").fetchone()[0]
    print(f"=== Etappe {i // a.etappe + 1}: Bestand {n} Medien ===", flush=True)
print("FERTIG Importlauf", flush=True)
