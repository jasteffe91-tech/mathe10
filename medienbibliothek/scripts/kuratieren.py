"""Führt Kurationsentscheidungen (JSON von stdin) mit metadata/kuration.json zusammen und wendet sie an.

Beispiel:
  echo '{"wmc-12345678": {"titel": "…", "qualitaet": 4}, "wmc-87654321": {"entfernen": "themenfremd"}}' \
    | python3 scripts/kuratieren.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from medialib import kuration  # noqa: E402
from medialib.db import DB, today  # noqa: E402
from medialib.webexport import export_web  # noqa: E402

neu = json.load(sys.stdin)
data = kuration.laden()
for mid, k in neu.items():
    k.setdefault("sichtgeprueft_am", today())
    data.setdefault(mid, {}).update(k)
kuration.speichern(data)
db = DB()
kuration.anwenden(db)
export_web(db)
