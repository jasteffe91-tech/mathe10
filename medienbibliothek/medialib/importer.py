"""Importpipeline: entdecken -> bewerten -> auswählen -> herunterladen/verarbeiten.

Wiederaufnehmbar: Jeder Planeintrag und jeder Kandidat hat einen Status in der
Datenbank. Abgebrochene Läufe setzen dort fort; bereits geprüfte Kandidaten
werden nicht erneut bewertet oder heruntergeladen.
"""

from __future__ import annotations

import hashlib
import json
import re
import sys
import time
from pathlib import Path

from medialib import config, licenses
from medialib.db import DB, now, today
from medialib.taxonomy import load as load_tax, tokens

PREFIX = {"commons": "wmc", "nasa": "nasa", "wellcome": "wel", "met": "met", "openmoji": "omj",
          "extern": "ext", "eigen": "eig", "manuell": "man", "xkcd": "ext"}
ERLAUBTE_FORMATE = {"svg", "png", "jpg", "gif", "webp", "tif", "stl"}
SCHLECHT = re.compile(
    r"\b(logo|flag|flagge|coat of arms|wappen|stamp|briefmarke|banner|screenshot|userbox|barnstar|signature|"
    r"unterschrift|book cover|album cover|advertis|werbung|election|wahl\b|politic|map of|karte von|locator|"
    r"poster|meme|sticker|emblem|seal of|siegel|tattoo|nsfw|nude|porn)",
    re.I,
)
FREMDSPRACHE = re.compile(
    r"[-_ (](bn|ne|be|pt|es|fr|it|ru|uk|zh|ja|ko|ar|fa|he|hi|ta|ca|pl|cs|nl|sv|fi|tr|el|hu|ro|sr|hr|vi|id|th|eu|gl|et|"
    r"lv|lt|sk|sl|bg|mk|ka|hy|az|kk|uz|ms|tl|sw|af|sq|bs|is|ga|cy|mt|lb|eo|da|no|nb|nn|ast|oc|br|sh|ur|te|ml|kn|mr|gu|pa)\)?$",
    re.I,
)
QUALI_KAT = re.compile(r"featured pictures|quality images|valued images|exzellent|picture of the day|lesenswert", re.I)


def load_plan(path: Path | None = None) -> list[dict]:
    data = json.loads(Path(path or config.CONFIG_DIR / "importplan.json").read_text(encoding="utf-8"))
    out = []
    for e in data["eintraege"]:
        pid, thema, quelle, suche, typ, maxn, mtyp = (e + [""] * 7)[:7]
        out.append({"id": pid, "thema": thema, "quelle": quelle, "suche": suche, "typ": typ,
                    "max": int(maxn or 2), "medientyp": mtyp})
    return out


def media_id(herkunft: str, quelle_id: str) -> str:
    return f"{PREFIX.get(herkunft, herkunft[:4])}-{hashlib.sha1(quelle_id.encode('utf-8')).hexdigest()[:8]}"


# ------------------------------------------------------------------ Bewertung
_DE_VOCAB: set | None = None
_EN_VOCAB: set | None = None


def _vocab():
    global _DE_VOCAB, _EN_VOCAB
    if _DE_VOCAB is None:
        tax = load_tax()
        de, en = set(), set()
        for kn in tax.knoten.values():
            for b in [kn.label, *kn.synonyme]:
                de.update(t for t in tokens(b) if len(t) >= 5)
            for b in kn.englisch:
                en.update(t for t in tokens(b) if len(t) >= 4)
        _DE_VOCAB, _EN_VOCAB = de - en, en
    return _DE_VOCAB, _EN_VOCAB


def deutsch_beschriftet(text: str) -> bool:
    de, _ = _vocab()
    toks = set(tokens(text))
    return bool(toks & de) or bool(re.search(r"[äöüß]", text or "", re.I))


def bewerte(c: dict, plan: dict, rang: int, limit: int) -> tuple[float, str]:
    """Gibt (score, grund) zurück. score < 0 bedeutet Ablehnung."""
    if c.get("verwerfen"):
        return -1, "; ".join(c["verwerfen"])
    kat = c.get("lizenz_kategorie")
    if kat != "A":
        return -1, f"Lizenz {c.get('lizenz')} ({c.get('lizenz_roh', '')}) Kategorie {kat}: nicht für lokale Aufnahme"
    if "marke" in (c.get("einschraenkungen") or []):
        return -1, "Marken-/Insignien-Einschränkung"
    fmt = c.get("format", "")
    if fmt not in ERLAUBTE_FORMATE:
        return -1, f"Format {fmt} nicht vorgesehen"
    w, h, size = c.get("breite") or 0, c.get("hoehe") or 0, c.get("groesse") or 0
    if fmt not in ("svg", "stl") and w and h and max(w, h) < 300:
        return -1, f"Auflösung zu gering ({w}x{h})"
    if c.get("herkunft") == "commons" and fmt in ("png", "jpg", "gif") and w and w <= 250:
        return -1, f"Breite {w} px: kein Wikimedia-Standard-Vorschaubild möglich"
    if c.get("herkunft") == "commons" and fmt in ("tif", "webp", "stl"):
        return -1, f"Format {fmt}: Original-Download von Wikimedia gedrosselt, kein geeignetes Standard-Vorschaubild"
    if fmt == "gif" and size > 8 * 1024 * 1024:
        return -1, "GIF größer als 8 MB"
    if fmt == "stl" and size > 12 * 1024 * 1024:
        return -1, "3D-Modell größer als 12 MB"
    titel = c.get("originaltitel", "")
    if c.get("herkunft") == "commons" and plan.get("medientyp") not in ("historisch", "foto"):
        if FREMDSPRACHE.search(titel) or re.search(r"[\u0370-\u03ff\u0400-\u04ff\u0590-\u06ff\u0900-\u0dff\u3040-\u9fff\uac00-\ud7af]", titel):
            return -1, "Beschriftung vermutlich weder deutsch noch englisch (Sprachkennung/Schrift im Dateinamen)"
    text = " ".join([titel, c.get("originalbeschreibung", "")[:400], " ".join(c.get("kategorien", [])[:30])])
    if SCHLECHT.search(c.get("originaltitel", "")) or SCHLECHT.search(" ".join(c.get("kategorien", [])[:15])):
        return -1, "Titel/Kategorie deutet auf ungeeigneten Inhalt (Logo, Karte, Flagge, Werbung …)"
    q = re.sub(r"\b\w+:\S+", " ", plan["suche"])
    qt = [t for t in tokens(q) if len(t) >= 3]

    def treffer(toks: set) -> float:
        hit = sum(1 for t in qt if t in toks or (len(t) >= 6 and any(x.startswith(t[:6]) for x in toks)))
        return hit / max(len(qt), 1)

    titel_toks = set(tokens(re.sub(r"([a-z])([A-Z])", r"\1 \2", c.get("originaltitel", "")).replace("_", " ")))
    rel_titel = treffer(titel_toks)
    rel = treffer(set(tokens(text)))
    # Fachbegriffe des Zielthemas im Titel (z. B. "Parallelschaltung" für ph.elektrizitaet.reihe_parallel)
    kn = load_tax().get(plan["thema"])
    thema_toks = set()
    for b in (kn.begriffe() if kn else []):
        thema_toks.update(t for t in tokens(b) if len(t) >= 5)
    thema_im_titel = bool(titel_toks & thema_toks) or any(
        len(t) >= 7 and any(t in x or x in t for x in thema_toks) for t in titel_toks)
    if rel == 0:
        return -1, "Suchbegriffe kommen in Titel/Beschreibung/Kategorien nicht vor"
    if rel_titel == 0 and not thema_im_titel and rel < 0.75:
        return -1, "Weder Suchbegriffe noch Fachbegriffe des Themas im Titel"
    score = 0.3 * rel_titel + 0.25 * rel + 0.15 * thema_im_titel + 0.15 * (1 - rang / max(limit, 1))
    if QUALI_KAT.search(" ".join(c.get("kategorien", []))):
        score += 0.2
    if fmt == "svg" and plan.get("typ") in ("svg", ""):
        score += 0.05
    if deutsch_beschriftet(c.get("originaltitel", "")):
        score += 0.12
    if fmt in ("jpg", "png") and max(w, h) >= 1200:
        score += 0.05
    if "personenrechte" in (c.get("einschraenkungen") or []) and plan.get("medientyp") != "historisch":
        score -= 0.05
    return round(score, 3), f"Relevanz {rel:.2f}"


# ------------------------------------------------------------------ Phasen
def _client():
    from medialib.net import Client

    return Client()


def _adapter(name: str):
    from medialib.sources import commons, met, nasa, wellcome

    return {"commons": commons, "nasa": nasa, "wellcome": wellcome, "met": met}[name]


PRIORITAET = [
    r"^(nasa|wel|met)-",
    r"^ph-(wurf|schraeger|waagerechter|harmonisch|schwingung|federpendel|pendel|newton|cartoon|comic|karikatur|einstein-karikatur)",
    r"^ph-(parallel|reihen|stromkreis|schaltzeichen|feldlinien|reflexion|brechung|snellius|sammellinse|linse)",
    r"^ma-(kreis|pi-|pythagoras|strahlensatz|thales|einheitskreis|sinus|baum|normalvert|wuerfel|galton)",
]


def priorisieren(plan: list[dict]) -> list[dict]:
    """Sortiert den Plan: andere Server zuerst, dann testrelevante Kernthemen, danach reihum über alle
    Fachbereiche (je Bereich zuerst die Einträge mit höherem Soll), damit früh die ganze Breite abgedeckt ist."""
    pos: dict[str, int] = {}
    rest = sorted((p for p in plan), key=lambda p: -p["max"])
    for p in rest:
        bereich = ".".join(p["thema"].split(".")[:2])
        pos[p["id"]] = pos.get("_" + bereich, 0)
        pos["_" + bereich] = pos[p["id"]] + 1

    def rang(p):
        for i, rx in enumerate(PRIORITAET):
            if re.search(rx, p["id"]):
                return (i, 0, 0)
        return (len(PRIORITAET), pos[p["id"]], -p["max"])
    return sorted(plan, key=rang)


def entdecken(db: DB, plan: list[dict], nur: str | None = None, erneut: bool = False, out=sys.stdout) -> None:
    client = _client()
    plan = priorisieren(plan)
    for i, p in enumerate(plan, 1):
        if nur and not re.search(nur, p["id"]):
            continue
        st = db.con.execute("SELECT status FROM plan_status WHERE plan_id=?", (p["id"],)).fetchone()
        if st and st[0] == "entdeckt" and not erneut:
            continue
        try:
            ad = _adapter(p["quelle"])
            limit = 50 if p["quelle"] == "commons" else max(p["max"] * 4, 8)
            cands = ad.search(client, p["suche"], limit=limit, typ=p.get("typ", ""))
        except Exception as exc:  # Netzwerk/API-Fehler protokollieren, weitermachen
            db.log("fehler", f"Suche fehlgeschlagen: {exc}", p["id"])
            db.con.execute("INSERT OR REPLACE INTO plan_status VALUES(?,?,?,?,?)", (p["id"], "fehler", now(), 0, str(exc)[:300]))
            db.con.commit()
            print(f"[{i}/{len(plan)}] {p['id']}: FEHLER {exc}", file=out, flush=True)
            continue
        n_ok = 0
        with db.tx():
            for rang, c in enumerate(cands):
                key = f"{c['herkunft']}:{c['quelle_id']}"
                old = db.con.execute("SELECT status FROM kandidaten WHERE schluessel=?", (key,)).fetchone()
                if old and old[0] in ("importiert", "abgelehnt-kuration", "ausgewaehlt"):
                    continue
                score, grund = bewerte(c, p, rang, len(cands))
                status = "neu" if score >= 0 else "abgelehnt"
                n_ok += status == "neu"
                c["_plan"] = p
                db.con.execute(
                    """INSERT INTO kandidaten(schluessel, herkunft, quelle_id, plan_id, titel, lizenz, lizenz_kategorie, score,
                       status, grund, rohdaten, geprueft_am) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)
                       ON CONFLICT(schluessel) DO UPDATE SET score=MAX(kandidaten.score, excluded.score),
                       rohdaten=excluded.rohdaten, geprueft_am=excluded.geprueft_am,
                       plan_id=CASE WHEN excluded.score > kandidaten.score THEN excluded.plan_id ELSE kandidaten.plan_id END,
                       status=CASE WHEN kandidaten.status IN ('neu','abgelehnt') THEN excluded.status ELSE kandidaten.status END,
                       grund=excluded.grund""",
                    (key, c["herkunft"], c["quelle_id"], p["id"], c.get("originaltitel", "")[:200], c.get("lizenz"),
                     c.get("lizenz_kategorie"), score, status, grund, json.dumps(c, ensure_ascii=False), now()),
                )
            db.con.execute("INSERT OR REPLACE INTO plan_status VALUES(?,?,?,?,?)", (p["id"], "entdeckt", now(), len(cands), f"{n_ok} geeignet"))
        print(f"[{i}/{len(plan)}] {p['id']}: {len(cands)} gefunden, {n_ok} lizenz-/formatgeeignet", file=out, flush=True)
    db.export_kandidaten()


def auswaehlen(db: DB, plan: list[dict], nur: str | None = None, out=sys.stdout, faktor: float = 1.0) -> int:
    """Wählt je Planeintrag die besten noch nicht aufgenommenen Kandidaten (bis max·faktor)."""
    n = 0
    vorhanden_sha1 = {r[0] for r in db.con.execute("SELECT quelle_sha1 FROM medien WHERE quelle_sha1 IS NOT NULL")}
    gewaehlt_sha1 = set()
    for p in plan:
        if nur and not re.search(nur, p["id"]):
            continue
        schon = db.con.execute(
            "SELECT COUNT(*) FROM kandidaten WHERE plan_id=? AND status IN ('ausgewaehlt','importiert')", (p["id"],)
        ).fetchone()[0]
        frei = int(round(p["max"] * faktor)) - schon
        if frei <= 0:
            continue
        rows = db.con.execute(
            "SELECT schluessel, rohdaten, score FROM kandidaten WHERE plan_id=? AND status='neu' ORDER BY score DESC", (p["id"],)
        ).fetchall()
        for r in rows:
            if frei <= 0:
                break
            c = json.loads(r["rohdaten"])
            sha1 = c.get("quelle_sha1")
            if sha1 and (sha1 in vorhanden_sha1 or sha1 in gewaehlt_sha1):
                db.con.execute("UPDATE kandidaten SET status='dublette', grund='gleiche Datei bereits vorhanden' WHERE schluessel=?", (r["schluessel"],))
                continue
            if r["score"] < 0.25:
                continue
            gewaehlt_sha1.add(sha1)
            db.con.execute("UPDATE kandidaten SET status='ausgewaehlt' WHERE schluessel=?", (r["schluessel"],))
            frei -= 1
            n += 1
    db.con.commit()
    print(f"{n} Kandidaten ausgewählt", file=out)
    return n


STANDARDBREITEN = (250, 330, 500, 960, 1280)  # https://www.mediawiki.org/wiki/Common_thumbnail_sizes


def commons_thumb(c: dict) -> tuple[str, int]:
    """Vorschaubild-URL in Wikimedia-Standardbreite.

    Wikimedia drosselt Originaldownloads und bittet ausdrücklich um Vorschaubilder
    in Standardgrößen. SVG -> PNG in 1280 px, Raster/GIF -> größte Standardbreite
    unterhalb der Originalbreite (Animationen bleiben in GIF-Thumbnails erhalten).
    """
    url = (c.get("medien_url") or "").split("?")[0]
    m = re.match(r"https://upload\.wikimedia\.org/wikipedia/commons/(\w/\w\w)/(.+)$", url)
    if not m:
        raise ValueError("keine Commons-Original-URL")
    path, name = m.group(1), m.group(2)
    fmt = c.get("format")
    w = c.get("breite") or 0
    if fmt == "svg":
        breite = 1280
        suffix = ".png"
    elif fmt in ("png", "jpg", "gif"):
        kand = [s for s in STANDARDBREITEN if s < w]
        if not kand:
            raise ValueError(f"Original ({w} px) kleiner als kleinste sinnvolle Standardbreite")
        breite = kand[-1]
        suffix = ""
    else:
        raise ValueError(f"Format {fmt} wird über Vorschaubilder nicht unterstützt")
    return f"https://thumb.wikimedia.org/wikipedia/commons/thumb/{path}/{name}/{breite}px-{name}{suffix}", breite


def _download_url(c: dict) -> str:
    if c.get("download_url"):
        return c["download_url"]
    if c.get("herkunft") == "commons":
        return commons_thumb(c)[0]
    return c["medien_url"]


def _medientyp(c: dict, plan: dict, info: dict) -> str:
    if plan.get("medientyp"):
        if plan["medientyp"] == "animation" and not info.get("animiert"):
            return "diagramm"
        return plan["medientyp"]
    fmt = c.get("format")
    if fmt == "svg":
        return "diagramm"
    if fmt == "gif":
        return "animation" if info.get("animiert") else "diagramm"
    if fmt == "stl":
        return "3d-modell"
    if fmt == "png":
        return "diagramm"
    return "foto"


ZWECK = {
    "diagramm": ["arbeitsblatt", "klassenarbeit", "tafelbild", "praesentation", "lernkarte", "erklaertext"],
    "grafik": ["arbeitsblatt", "praesentation", "erklaertext"],
    "foto": ["einstieg", "praesentation", "arbeitsblatt", "erklaertext"],
    "animation": ["praesentation", "digital", "erklaertext"],
    "video": ["praesentation", "digital", "einstieg"],
    "historisch": ["einstieg", "praesentation", "erklaertext"],
    "cartoon": ["einstieg", "praesentation", "arbeitsblatt"],
    "comic": ["einstieg", "praesentation", "arbeitsblatt"],
    "illustration": ["einstieg", "arbeitsblatt", "praesentation"],
    "symbol": ["arbeitsblatt", "lernkarte", "praesentation", "digital"],
    "simulation": ["interaktiv", "experiment", "digital"],
    "3d-modell": ["digital", "praesentation"],
}


def build_item(c: dict, plan: dict, info: dict, rel_path: str, rel_thumb: str) -> dict:
    tax = load_tax()
    kn = tax.get(plan["thema"])
    mtyp = _medientyp(c, plan, info)
    stufe = kn.stufe if kn else (5, 13)
    fmt = Path(rel_path).suffix.lstrip(".").lower() if rel_path else c.get("format")
    otitle = c.get("originaltitel", "")
    titel_auto = f"{(kn.label if kn else plan['thema'])}: {otitle}"[:160]
    lab = "de" if deutsch_beschriftet(otitle) else "unbekannt"
    liz = licenses.get(c["lizenz"])
    w, h = info.get("breite") or c.get("breite") or 0, info.get("hoehe") or c.get("hoehe") or 0
    item = {
        "id": media_id(c["herkunft"], c["quelle_id"]),
        "titel": titel_auto,
        "beschreibung": "",
        "originaltitel": otitle,
        "originalbeschreibung": c.get("originalbeschreibung", ""),
        "fach": kn.fach if kn else ("mathematik" if plan["thema"].startswith("ma") else "physik"),
        "hauptthema": plan["thema"],
        "unterthemen": [],
        "schlagworte": [],
        "schlagworte_en": [t for t in tokens(re.sub(r"\b\w+:\S+", " ", plan["suche"])) if len(t) > 2][:8],
        "medientyp": mtyp,
        "format": fmt,
        "mime": c.get("mime"),
        "stufe_min": stufe[0],
        "stufe_max": stufe[1],
        "schwierigkeit": "grundlegend" if stufe[1] <= 8 else ("mittel" if stufe[0] <= 10 else "erhoeht"),
        "einsatzzweck": ZWECK.get(mtyp, ["arbeitsblatt"]),
        "fachlich": "ungeprueft",
        "beschriftung": lab,
        "breite": w,
        "hoehe": h,
        "seitenverhaeltnis": round(w / h, 3) if w and h else None,
        "transparent": info.get("transparent"),
        "sw_geeignet": info.get("sw_geeignet"),
        "druck_geeignet": 1 if fmt == "svg" or max(w, h) >= 1200 else 0,
        "dateigroesse": info.get("dateigroesse"),
        "urheber": c.get("urheber") or "unbekannt",
        "urheber_url": c.get("urheber_url"),
        "quelle": c.get("quelle"),
        "quelle_url": c.get("quelle_url"),
        "medien_url": c.get("medien_url"),
        "lizenz": c["lizenz"],
        "lizenz_name": liz.name,
        "lizenz_url": c.get("lizenz_url") or liz.url,
        "lizenz_nachweis_url": c.get("lizenz_nachweis_url"),
        "lizenz_detail": c.get("lizenz_detail"),
        "lizenz_kategorie": liz.kategorie,
        "lizenz_status": "verifiziert",
        "pruefdatum": c.get("pruefdatum") or today(),
        "namensnennung_pflicht": 1 if liz.namensnennung else 0,
        "einschraenkungen": c.get("einschraenkungen") or [],
        "credit_vorgabe": c.get("credit_vorgabe"),
        "speicherung": "lokal",
        "pfad": rel_path,
        "thumbnail": rel_thumb,
        "alt_text": "",
        "qualitaet": 3,
        "sha256": info.get("sha256"),
        "quelle_sha1": c.get("quelle_sha1"),
        "phash": info.get("phash"),
        "herkunft": c["herkunft"],
        "quelle_id": c["quelle_id"],
        "importiert_am": now(),
        "kuratiert": 0,
        "notizen": f"Importplan {plan['id']}" + (f"; {info['skaliert']}" if info.get("skaliert") else ""),
    }
    if c.get("herkunft") == "commons":
        orig_fmt = c.get("format")
        item["notizen"] += (f"; lokal als Wikimedia-Vorschaubild in Standardbreite ({w} px); Original ({orig_fmt}, "
                            f"{c.get('breite')}×{c.get('hoehe')}) unter medien_url")
        if orig_fmt == "svg":
            item["notizen"] += "; Vektor-Original (SVG) verfügbar – bei Bedarf mit `media original ID` einzeln nachladen"
    return item


def herunterladen(db: DB, plan: list[dict], limit: int | None = None, out=sys.stdout) -> int:
    from medialib import media_files as mf

    client = _client()
    plan_by_id = {p["id"]: p for p in plan}
    rows = db.con.execute("SELECT schluessel, plan_id, rohdaten FROM kandidaten WHERE status='ausgewaehlt' ORDER BY plan_id").fetchall()
    tax = load_tax()
    done = 0
    svg_queue = []
    for k, r in enumerate(rows, 1):
        if limit and done >= limit:
            break
        c = json.loads(r["rohdaten"])
        p = plan_by_id.get(r["plan_id"]) or c.get("_plan")
        mid = media_id(c["herkunft"], c["quelle_id"])
        if db.get(mid):
            db.con.execute("UPDATE kandidaten SET status='importiert', medien_id=? WHERE schluessel=?", (mid, r["schluessel"]))
            db.con.commit()
            continue
        try:
            if c["herkunft"] == "nasa":
                from medialib.sources import nasa

                c = nasa.resolve_asset(client, c)
                if c.get("verwerfen"):
                    raise ValueError("; ".join(c["verwerfen"]))
                if not c.get("download_url"):
                    raise ValueError("keine Bilddatei gefunden")
            url = _download_url(c)
            kn = tax.get(p["thema"])
            fach = "mathematik" if p["thema"].startswith("ma") else "physik"
            bereich = p["thema"].split(".")[1] if "." in p["thema"] else "allgemein"
            ext = url.split("?")[0].rsplit(".", 1)[-1].lower()
            ext = {"jpeg": "jpg", "tiff": "tif"}.get(ext, ext)
            if ext not in ERLAUBTE_FORMATE:
                ext = c.get("format") or "jpg"
            rel_dir = Path("assets") / fach / bereich
            fname = f"{mid}__{mf.slugify(c.get('originaltitel', ''))}.{ext}"
            dest = config.ROOT / rel_dir / fname
            nbytes = client.download(url, dest)
            info: dict = {"dateigroesse": nbytes}
            if ext == "svg":
                ok, why, w, h = mf.svg_check(dest)
                if not ok:
                    dest.unlink()
                    raise ValueError(why)
                info.update({"breite": c.get("breite") or w, "hoehe": c.get("hoehe") or h})
                svg_queue.append(mid)
            elif ext == "stl":
                info.update({"breite": 0, "hoehe": 0})
            else:
                pi = mf.process_raster(dest, ext)
                dest = pi.pop("pfad")
                flat = pi.pop("flat")
                info.update(pi)
                thumb = config.THUMBS_DIR / f"{mid}.webp"
                mf.make_thumb(flat, thumb)
            info["sha256"] = mf.sha256_file(dest)
            info["dateigroesse"] = dest.stat().st_size
            dup = db.find_by_hash(sha256=info["sha256"])
            if dup:
                dest.unlink()
                raise ValueError(f"Dublette von {dup['id']}")
            if info.get("phash"):
                for other in db.con.execute("SELECT id, phash FROM medien WHERE phash IS NOT NULL"):
                    if mf.hamming(info["phash"], other["phash"]) <= 3:
                        info.setdefault("aehnlich", []).append(other["id"])
            rel_path = str(dest.relative_to(config.ROOT))
            rel_thumb = f"thumbnails/{mid}.webp" if ext not in ("svg", "stl") else ""
            if ext == "stl":
                mf.placeholder_thumb(config.THUMBS_DIR / f"{mid}.webp", "3D-Modell (STL)")
                rel_thumb = f"thumbnails/{mid}.webp"
            item = build_item(c, p, info, rel_path, rel_thumb)
            if info.get("aehnlich"):
                item["notizen"] += f"; visuell ähnlich zu {', '.join(info['aehnlich'])} (pHash)"
            db.upsert(item, export=False)
            db.con.execute("UPDATE kandidaten SET status='importiert', medien_id=? WHERE schluessel=?", (mid, r["schluessel"]))
            db.con.commit()
            done += 1
            print(f"[{k}/{len(rows)}] {mid} {c.get('originaltitel', '')[:60]} ({nbytes // 1024} KB)", file=out, flush=True)
        except Exception as exc:
            db.con.execute("UPDATE kandidaten SET status='fehler', grund=? WHERE schluessel=?", (str(exc)[:300], r["schluessel"]))
            db.con.commit()
            db.log("fehler", str(exc)[:500], r["plan_id"], r["schluessel"])
            print(f"[{k}/{len(rows)}] FEHLER {r['schluessel']}: {exc}", file=out, flush=True)
    db.export_jsonl()
    db.export_kandidaten()
    return done


def svg_vorschauen(db: DB, ids: list[str] | None = None, out=sys.stdout) -> int:
    """Rastert SVGs (Playwright), erzeugt Thumbnails und ergänzt pHash/Transparenz/S-W-Eignung."""
    from PIL import Image

    from medialib import media_files as mf

    items = db.all("format='svg'") if ids is None else [db.get(i) for i in ids if db.get(i)]
    items = [it for it in items if it.get("pfad") and (ids is not None or not it.get("thumbnail"))]
    if not items:
        return 0
    tmp = config.PREVIEWS_DIR / "_svg_render"
    rendered = mf.render_svgs([config.ROOT / it["pfad"] for it in items], tmp)
    n = 0
    for it in items:
        png = rendered.get(config.ROOT / it["pfad"])
        if not png:
            continue
        with Image.open(png) as im:
            a, flat = mf.analyse_image(im)
            mf.make_thumb(flat, config.THUMBS_DIR / f"{it['id']}.webp")
        it.update({"thumbnail": f"thumbnails/{it['id']}.webp", "phash": a["phash"], "transparent": a["transparent"],
                   "sw_geeignet": a["sw_geeignet"]})
        db.upsert(it, export=False)
        n += 1
    db.export_jsonl()
    for f in tmp.glob("*"):
        f.unlink()
    tmp.rmdir()
    print(f"{n} SVG-Vorschaubilder erzeugt", file=out)
    return n
