"""Externe Ressourcen (nur Verweis) und OpenMoji-Symbole (lokal, CC BY-SA 4.0)."""

from __future__ import annotations

import hashlib
import json
import re
import sys

from medialib import config, licenses
from medialib.db import DB, now, today
from medialib.importer import ZWECK, media_id
from medialib.taxonomy import load as load_tax


def _ext_item(key: str, titel: str, url: str, thema: str, typ: str, stufe, lizenz: str, nachweis: str,
              urheber: str, beschreibung: str, quelle: str, speicherung: str = "extern", status: str = "verifiziert",
              extra: dict | None = None) -> dict:
    tax = load_tax()
    kn = tax.get(thema)
    liz = licenses.get(lizenz)
    item = {
        "id": media_id("extern", key), "titel": titel, "beschreibung": beschreibung, "originaltitel": titel,
        "fach": kn.fach if kn else ("mathematik" if thema.startswith("ma") else "physik"),
        "hauptthema": thema, "unterthemen": [], "schlagworte": [], "schlagworte_en": [],
        "medientyp": typ, "format": "html", "stufe_min": stufe[0], "stufe_max": stufe[1],
        "schwierigkeit": "grundlegend" if stufe[1] <= 8 else ("mittel" if stufe[0] <= 10 else "erhoeht"),
        "einsatzzweck": ZWECK.get(typ, ["digital"]), "fachlich": "ungeprueft", "beschriftung": "unbekannt",
        "urheber": urheber, "quelle": quelle, "quelle_url": url, "medien_url": url,
        "lizenz": liz.id, "lizenz_name": liz.name, "lizenz_url": liz.url, "lizenz_nachweis_url": nachweis,
        "lizenz_kategorie": liz.kategorie, "lizenz_status": status if liz.id != "unbekannt" else "ungeprueft",
        "pruefdatum": today(), "namensnennung_pflicht": 1 if liz.namensnennung else 0,
        "einschraenkungen": [], "speicherung": speicherung, "pfad": "", "thumbnail": "",
        "alt_text": f"Externe Ressource: {titel}", "qualitaet": 4, "herkunft": "extern", "quelle_id": key,
        "importiert_am": now(), "kuratiert": 1, "notizen": "Externe Ressource – nur verlinken",
    }
    if extra:
        item.update(extra)
    return item


def importieren(db: DB, out=sys.stdout) -> int:
    from medialib.net import Client, HttpError

    cfg = json.loads((config.CONFIG_DIR / "extern.json").read_text(encoding="utf-8"))
    client = Client(intervals={"phet.colorado.edu": 1.0})
    items = []
    # --- PhET: Lizenzkopf jeder Simulation lesen
    ph = cfg["phet"]
    for slug, titel, thema, stufe in ph["simulationen"]:
        sim = f"https://phet.colorado.edu/sims/html/{slug}/latest/{slug}_all.html"
        try:
            r = client.s.get(sim, headers={"Range": "bytes=0-8000"}, timeout=40)
            head = r.text[:8000] if r.status_code in (200, 206) else ""
        except Exception as exc:  # noqa: BLE001
            head = ""
            print(f"PhET {slug}: Fehler {exc}", file=out)
        m = re.search(r"licensed under ([^<\n]{0,140}?\((CC [A-Z-]+ \d\.\d)\))", head)
        if not m:
            print(f"PhET {slug}: Lizenz nicht lesbar – übersprungen (HTTP {getattr(r, 'status_code', '?')})", file=out)
            continue
        lid, _ = licenses.normalize(m.group(2))
        page = f"https://phet.colorado.edu/de/simulations/{slug}"
        items.append(_ext_item(
            f"phet:{slug}", f"PhET-Simulation: {titel}", page, thema, "simulation", stufe, lid, sim,
            "PhET Interactive Simulations, University of Colorado Boulder",
            f"Interaktive HTML5-Simulation (deutsch verfügbar: {sim.replace('_all.html', '_de.html')}). Lizenz laut Simulationsdatei: {m.group(2)}.",
            "PhET Interactive Simulations",
            extra={"medien_url": sim.replace("_all.html", "_de.html"), "beschriftung": "de",
                   "notizen": "Externe Simulation – nur verlinken/einbetten, nicht kommerziell; Marke 'PhET' nicht für eigene Produkte verwenden"},
        ))
        print(f"PhET {slug}: {lid}", file=out, flush=True)
    # --- xkcd: offizielle JSON-API
    xk = cfg["xkcd"]
    for num, thema, beschr, stufe in xk["comics"]:
        try:
            d = client.json(f"https://xkcd.com/{num}/info.0.json")
        except HttpError as exc:
            print(f"xkcd {num}: {exc}", file=out)
            continue
        items.append(_ext_item(
            f"xkcd:{num}", f"xkcd {num}: {d.get('safe_title')}", f"https://xkcd.com/{num}/", thema, "comic", stufe,
            xk["lizenz"], xk["nachweis"], "Randall Munroe (xkcd)",
            f"{beschr}. Englischsprachiger Webcomic. Alt-Text: {d.get('alt', '')[:200]}", "xkcd",
            extra={"originaltitel": d.get("safe_title"), "medien_url": d.get("img"), "beschriftung": "en",
                   "schlagworte": ["Comic", "Humor", "Webcomic"], "schlagworte_en": ["comic", "humor", "xkcd"],
                   "einsatzzweck": ["einstieg", "praesentation"]},
        ))
        print(f"xkcd {num}: {d.get('safe_title')}", file=out, flush=True)
    # --- weitere geprüfte Einzelressourcen
    for w in cfg["weitere"]:
        ok = False
        try:
            r = client.get(w["url"], accept_404=True)
            ok = r.status_code < 400
        except Exception:  # noqa: BLE001
            ok = False
        status = "verifiziert" if ok and w["lizenz"] != "unbekannt" else "ungeprueft"
        items.append(_ext_item(w["id_key"], w["titel"], w["url"], w["thema"], w["typ"], w["stufe"], w["lizenz"],
                               w.get("nachweis", ""), w["urheber"], w["beschreibung"], w["urheber"],
                               speicherung=w.get("speicherung", "extern"), status=status))
        print(f"{w['id_key']}: {'erreichbar' if ok else 'NICHT erreichbar'} ({status})", file=out, flush=True)
    db.upsert_many(items)
    print(f"{len(items)} externe Ressourcen erfasst", file=out)
    return len(items)


# ------------------------------------------------------------------ OpenMoji
OPENMOJI_VERSION = "15.1.0"
OPENMOJI = [
    ("1F4A1", "Glühlampe", "ph.elektrizitaet.stromkreis", "light bulb"),
    ("1F50B", "Batterie", "ph.elektrizitaet.spannung", "battery"),
    ("1F50C", "Netzstecker", "ph.elektrizitaet.sicherheit", "electric plug"),
    ("26A1", "Hochspannung / Blitz", "ph.elektrizitaet.ladung", "high voltage lightning"),
    ("1F9F2", "Hufeisenmagnet", "ph.magnetismus.magnete", "magnet"),
    ("1F9ED", "Kompass", "ph.magnetismus.magnete", "compass"),
    ("1F52D", "Teleskop", "ph.astronomie.teleskope", "telescope"),
    ("1F52C", "Mikroskop", "ph.optik.geraete", "microscope"),
    ("1F321", "Thermometer", "ph.waerme.temperatur", "thermometer"),
    ("1F680", "Rakete", "ph.astronomie.raumfahrt", "rocket"),
    ("1F6F0", "Satellit", "ph.astronomie.raumfahrt", "satellite"),
    ("1FA90", "Planet mit Ring", "ph.astronomie.planeten", "ringed planet"),
    ("1F30D", "Erdkugel (Europa/Afrika)", "ph.astronomie.erde_mond", "globe earth"),
    ("1F319", "Mondsichel", "ph.astronomie.erde_mond", "crescent moon"),
    ("2600", "Sonne", "ph.astronomie.sonnensystem", "sun"),
    ("1F308", "Regenbogen", "ph.optik.farben", "rainbow"),
    ("1F34E", "Roter Apfel (Newtons Apfel)", "ph.mechanik.newton", "red apple"),
    ("2696", "Waage", "ph.mechanik.gewichtskraft", "balance scale"),
    ("23F1", "Stoppuhr", "ph.experimente.messgeraete", "stopwatch"),
    ("1F4CF", "Lineal", "ph.experimente.messgeraete", "ruler"),
    ("1F4D0", "Geodreieck (Dreieckslineal)", "ma.geometrie.grundbegriffe", "triangular ruler"),
    ("1F9EE", "Abakus", "ma.geschichte", "abacus"),
    ("1F3B2", "Spielwürfel", "ma.stochastik.zufallsexperiment", "game die"),
    ("1F4CA", "Balkendiagramm", "ma.stochastik.diagramme", "bar chart"),
    ("1F4C8", "Steigendes Liniendiagramm", "ma.stochastik.diagramme", "chart increasing"),
    ("267E", "Unendlich-Zeichen", "ma.analysis.grenzwert", "infinity"),
    ("2797", "Divisionszeichen", "ma.arithmetik.brueche", "division sign"),
    ("2622", "Radioaktiv-Warnzeichen", "ph.atom.radioaktivitaet", "radioactive"),
    ("269B", "Atomsymbol", "ph.atom.atommodelle", "atom symbol"),
    ("1F50A", "Lautsprecher (laut)", "ph.schwingungen.schall", "speaker high volume"),
    ("1F3B5", "Musiknote", "ph.schwingungen.schall", "musical note"),
    ("1F9CA", "Eiswürfel", "ph.waerme.aggregatzustaende", "ice cube"),
    ("1F525", "Feuer", "ph.waerme.waerme", "fire"),
    ("1F4A7", "Wassertropfen", "ph.waerme.aggregatzustaende", "droplet"),
    ("1F526", "Taschenlampe", "ph.optik.lichtausbreitung", "flashlight"),
    ("1F9EA", "Reagenzglas", "ph.experimente.laborgeraete", "test tube"),
    ("1F97D", "Schutzbrille", "ph.experimente.sicherheit", "goggles"),
    ("26A0", "Warnzeichen", "ph.experimente.sicherheit", "warning"),
    ("1F9D1-200D-1F52C", "Forschende Person", "ph.experimente.schulversuche", "scientist"),
    ("1F9D1-200D-1F680", "Astronautin/Astronaut", "ph.astronomie.raumfahrt", "astronaut"),
    ("1F32C", "Wind", "ph.energieversorgung", "wind face"),
    ("1F3A2", "Achterbahn", "ph.mechanik.energie", "roller coaster"),
    ("1F6B2", "Fahrrad", "ph.alltag", "bicycle"),
    ("1F3C0", "Basketball", "ph.mechanik.wurf", "basketball"),
]


def openmoji(db: DB, out=sys.stdout) -> int:
    from medialib import media_files as mf
    from medialib.importer import svg_vorschauen
    from medialib.net import Client

    client = Client()
    tax = load_tax()
    liz = licenses.get("CC-BY-SA-4.0")
    n = 0
    ids = []
    for code, titel, thema, en in OPENMOJI:
        key = f"openmoji:{code}"
        mid = media_id("openmoji", key)
        if db.get(mid):
            continue
        url = f"https://cdn.jsdelivr.net/npm/openmoji@{OPENMOJI_VERSION}/color/svg/{code}.svg"
        kn = tax.get(thema)
        fach = kn.fach
        dest = config.ASSETS_DIR / fach / "symbole" / f"{mid}__openmoji-{mf.slugify(titel)}.svg"
        try:
            client.download(url, dest)
        except Exception as exc:  # noqa: BLE001
            print(f"OpenMoji {code}: {exc}", file=out)
            continue
        ok, why, w, h = mf.svg_check(dest)
        if not ok:
            dest.unlink()
            print(f"OpenMoji {code}: {why}", file=out)
            continue
        item = {
            "id": mid, "titel": f"Symbol: {titel}", "beschreibung": f"Farbiges Emoji-Symbol „{titel}“ (OpenMoji) für Arbeitsblätter, Lernkarten und Folien.",
            "originaltitel": f"OpenMoji {code} ({en})", "fach": fach, "hauptthema": thema, "unterthemen": [],
            "schlagworte": [titel, "Symbol", "Icon", "Emoji", "Piktogramm"], "schlagworte_en": [en, "icon", "emoji"],
            "medientyp": "symbol", "format": "svg", "mime": "image/svg+xml", "stufe_min": 5, "stufe_max": 13,
            "schwierigkeit": "grundlegend", "einsatzzweck": ["arbeitsblatt", "lernkarte", "praesentation", "digital"],
            "fachlich": "sichtgeprueft", "beschriftung": "ohne", "breite": w or 72, "hoehe": h or 72,
            "seitenverhaeltnis": 1.0, "transparent": 1, "sw_geeignet": 0, "druck_geeignet": 1,
            "dateigroesse": dest.stat().st_size, "urheber": "OpenMoji (HfG Schwäbisch Gmünd)",
            "quelle": "OpenMoji", "quelle_url": f"https://openmoji.org/library/emoji-{code}/", "medien_url": url,
            "lizenz": liz.id, "lizenz_name": liz.name, "lizenz_url": liz.url,
            "lizenz_nachweis_url": "https://github.com/hfg-gmuend/openmoji#license", "lizenz_detail": "OpenMoji graphics: CC BY-SA 4.0",
            "lizenz_kategorie": "A", "lizenz_status": "verifiziert", "pruefdatum": today(), "namensnennung_pflicht": 1,
            "einschraenkungen": [], "credit_vorgabe": "OpenMoji – the open-source emoji and icon project",
            "speicherung": "lokal", "pfad": str(dest.relative_to(config.ROOT)), "thumbnail": "",
            "alt_text": f"Symbol: {titel}", "qualitaet": 4, "sha256": mf.sha256_file(dest),
            "herkunft": "openmoji", "quelle_id": key, "importiert_am": now(), "kuratiert": 1,
            "notizen": f"OpenMoji {OPENMOJI_VERSION} via jsDelivr (npm-Paket openmoji)",
        }
        db.upsert(item, export=False)
        ids.append(mid)
        n += 1
    db.export_jsonl()
    if ids:
        svg_vorschauen(db, ids, out=out)
    print(f"{n} OpenMoji-Symbole aufgenommen", file=out)
    return n
