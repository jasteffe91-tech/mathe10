"""Erzeugt metadata/katalog.js für die statische Weboberfläche (index.html).

Als JS-Datei (window.MEDIEN = …), damit index.html auch per Doppelklick
(file://) ohne Server funktioniert.
"""

from __future__ import annotations

import json

from medialib import config, licenses
from medialib.credits import bildnachweis
from medialib.db import DB
from medialib.taxonomy import load as load_tax


def export_web(db: DB) -> int:
    tax = load_tax()
    items = db.all()
    recs = []
    for it in items:
        liz = licenses.get(it.get("lizenz") or "unbekannt")
        prof = [p for p in ("offen", "unterricht", "extern") if licenses.pruefe_nutzung(it, p).erlaubt]
        recs.append({
            "id": it["id"], "t": it.get("titel"), "b": it.get("beschreibung") or "", "alt": it.get("alt_text") or "",
            "o": it.get("originaltitel") or "", "f": it.get("fach"), "th": it.get("hauptthema"),
            "thl": tax.label(it.get("hauptthema") or ""), "ut": it.get("unterthemen") or [],
            "kw": (it.get("schlagworte") or []) + (it.get("schlagworte_en") or []),
            "ty": it.get("medientyp"), "fmt": it.get("format"), "s": [it.get("stufe_min"), it.get("stufe_max")],
            "w": it.get("breite"), "h": it.get("hoehe"), "tr": it.get("transparent"), "sw": it.get("sw_geeignet"),
            "lab": it.get("beschriftung"), "q": it.get("qualitaet"), "fa": it.get("fachlich"), "fh": it.get("fachlich_hinweis") or "",
            "p": it.get("pfad") or "", "tn": it.get("thumbnail") or "", "u": it.get("quelle_url") or "",
            "src": it.get("quelle") or "", "au": it.get("urheber") or "",
            "l": it.get("lizenz"), "ln": liz.name, "lu": it.get("lizenz_url") or liz.url, "lk": it.get("lizenz_kategorie"),
            "ls": it.get("lizenz_status"), "pd": it.get("pruefdatum"), "sp": it.get("speicherung"),
            "e": it.get("einschraenkungen") or [], "prof": prof,
            "cr": bildnachweis(it, "text"), "crh": bildnachweis(it, "html"),
        })
    themen = {k: {"l": kn.label, "p": kn.parent, "f": kn.fach,
                  "syn": [*kn.synonyme, *kn.englisch]} for k, kn in tax.knoten.items()}
    js = ("/* automatisch erzeugt von `media web` – nicht von Hand bearbeiten */\n"
          f"window.MEDIEN = {json.dumps(recs, ensure_ascii=False, separators=(',', ':'))};\n"
          f"window.THEMEN = {json.dumps(themen, ensure_ascii=False, separators=(',', ':'))};\n")
    config.WEB_KATALOG_JS.write_text(js, encoding="utf-8")
    return len(recs)
