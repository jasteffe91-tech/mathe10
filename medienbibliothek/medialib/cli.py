"""Kommandozeile `media` – Zugriff für Claude Code und Lehrkräfte.

Beispiele:
  media search "schiefer Wurf" --fach physik
  media search "Kreisfläche" --profil offen --json
  media credit wmc-1a2b3c4d --format markdown
  media verzeichnis wmc-1a2b3c4d nasa-0f0f0f0f --profil offen
  media add grafik.svg --eigen --titel "Parallelschaltung zweier Lampen" --thema ph.elektrizitaet.reihe_parallel
"""

from __future__ import annotations

import argparse
import json
import shutil
import sys
import tarfile
import time
from pathlib import Path

from medialib import config, licenses
from medialib.db import DB, now, today

TYP_KURZ = {"diagramm": "Diagramm", "grafik": "Grafik", "foto": "Foto", "animation": "Animation", "video": "Video",
            "cartoon": "Cartoon", "comic": "Comic", "historisch": "Historisch", "illustration": "Illustration",
            "symbol": "Symbol", "simulation": "Simulation", "3d-modell": "3D-Modell"}


def _p(*a, **k):
    print(*a, **k, flush=True)


# ---------------------------------------------------------------- Suche
def cmd_search(a) -> int:
    from medialib.search import ergebnis_dict, suche

    try:
        res, info = suche(a.query, fach=a.fach, typ=a.typ, stufe=a.stufe, profil=a.profil, thema=a.thema,
                          lizenz=a.lizenz, nur_lokal=a.lokal, limit=a.limit, mit_nd=a.mit_nd, bearbeitung=a.bearbeitung)
    except ValueError as exc:
        _p(f"Fehler: {exc}", file=sys.stderr)
        return 2
    if a.json:
        _p(json.dumps({"anfrage": a.query, "profil": info["profil"], "erkannte_themen": info["themen"],
                       "treffer_gesamt": info.get("gesamt", 0), "durch_profil_ausgeschlossen": info["ausgeschlossen_lizenz"],
                       "treffer": [ergebnis_dict(e) for e in res]}, ensure_ascii=False, indent=2))
        return 0
    if info["themen"]:
        _p("Erkannte Themen: " + "; ".join(f"{lab} ({art}, {sc:.2f})" for _, lab, sc, art in info["themen"][:4]))
    _p(f"Profil: {info['profil']} | Treffer: {info.get('gesamt', 0)} | wegen Lizenz/Profil ausgeschlossen: {info['ausgeschlossen_lizenz']}")
    if not res:
        _p("Keine passenden Medien. → Eigene Grafik erstellen und mit `media add --eigen` aufnehmen.")
        return 1
    for n, e in enumerate(res, 1):
        it = e.item
        ort = str(config.ROOT / it["pfad"]) if it.get("pfad") else it.get("quelle_url")
        warn = " ⚠ nur verwandt" if e.nur_verwandt else ""
        _p(f"\n{n}. [{it['id']}] {it.get('titel')}  (Score {e.score}){warn}")
        _p(f"   {TYP_KURZ.get(it.get('medientyp'), it.get('medientyp'))}, {it.get('format')}, Kl. {it.get('stufe_min')}-{it.get('stufe_max')}, "
           f"Beschriftung: {it.get('beschriftung') or '?'}, {it.get('breite') or '?'}×{it.get('hoehe') or '?'}"
           f"{', S/W-tauglich' if it.get('sw_geeignet') else ''}{', transparent' if it.get('transparent') else ''}")
        _p(f"   Lizenz: {licenses.kurzlabel(it)} – {it.get('lizenz_status')} am {it.get('pruefdatum')}")
        _p(f"   Datei/Link: {ort}")
        if it.get("thumbnail"):
            _p(f"   Vorschau: {config.ROOT / it['thumbnail']}")
        if e.gruende:
            _p(f"   Treffer: {', '.join(e.gruende)}")
        if it.get("fachlich_hinweis"):
            _p(f"   Fachlicher Hinweis: {it['fachlich_hinweis']}")
        for h in e.pruefung.hinweise[:3] if e.pruefung else []:
            _p(f"   Hinweis: {h}")
    return 0


def cmd_show(a) -> int:
    from medialib.credits import bildnachweis
    from medialib.taxonomy import load as load_tax

    db = DB()
    rc = 0
    for mid in a.ids:
        it = db.get(mid)
        if not it:
            _p(f"{mid}: nicht gefunden", file=sys.stderr)
            rc = 1
            continue
        if a.json:
            it = dict(it)
            it["pfad_absolut"] = str(config.ROOT / it["pfad"]) if it.get("pfad") else None
            it["bildnachweis"] = bildnachweis(it)
            _p(json.dumps(it, ensure_ascii=False, indent=2))
            continue
        tax = load_tax()
        _p(f"[{it['id']}] {it.get('titel')}")
        for k in ("beschreibung", "alt_text", "originaltitel", "fach", "medientyp", "format", "breite", "hoehe",
                  "beschriftung", "stufe_min", "stufe_max", "schwierigkeit", "einsatzzweck", "didaktik", "fachlich",
                  "fachlich_hinweis", "qualitaet", "urheber", "quelle", "quelle_url", "lizenz_name", "lizenz_url",
                  "lizenz_detail", "lizenz_kategorie", "lizenz_status", "pruefdatum", "lizenz_nachweis_url",
                  "einschraenkungen", "speicherung", "pfad", "thumbnail", "sha256", "phash", "notizen"):
            v = it.get(k)
            if v not in (None, "", []):
                _p(f"  {k:20s} {v}")
        _p(f"  {'thema':20s} {tax.pfad_label(it.get('hauptthema') or '')}")
        if it.get("unterthemen"):
            _p(f"  {'unterthemen':20s} {', '.join(tax.label(u) for u in it['unterthemen'])}")
        _p(f"  {'bildnachweis':20s} {bildnachweis(it)}")
    return rc


def _load_items(ids: list[str]) -> tuple[list[dict], list[str]]:
    db = DB()
    items, missing = [], []
    for i in ids:
        it = db.get(i)
        (items.append(it) if it else missing.append(i))
    return items, missing


def cmd_credit(a) -> int:
    from medialib.credits import bildnachweis

    items, missing = _load_items(a.ids)
    for it in items:
        _p(bildnachweis(it, a.format, a.bearbeitung))
    for m in missing:
        _p(f"{m}: nicht gefunden", file=sys.stderr)
    return 1 if missing else 0


def _parse_bearb(pairs: list[str] | None) -> dict:
    out = {}
    for p in pairs or []:
        if "=" in p:
            k, v = p.split("=", 1)
            out[k.strip()] = v.strip()
    return out


def cmd_verzeichnis(a) -> int:
    from medialib.credits import medienverzeichnis

    items, missing = _load_items(a.ids)
    text, verst = medienverzeichnis(items, a.format, a.profil, _parse_bearb(a.bearbeitet), a.titel)
    _p(text)
    if missing:
        _p(f"\nNicht gefunden: {', '.join(missing)}", file=sys.stderr)
    if verst:
        _p(f"\nACHTUNG – im Profil '{a.profil or licenses.standardprofil()}' NICHT zulässig:", file=sys.stderr)
        for mid, gr in verst:
            _p(f"  {mid}: {'; '.join(gr)}", file=sys.stderr)
        return 3
    return 1 if missing else 0


def cmd_check(a) -> int:
    items, missing = _load_items(a.ids)
    profil = a.profil or licenses.standardprofil()
    rc = 0
    res = []
    for it in items:
        pr = licenses.pruefe_nutzung(it, profil, bearbeitung=a.bearbeitung, mit_nd=a.mit_nd)
        res.append({"id": it["id"], "erlaubt": pr.erlaubt, "gruende": pr.gruende, "hinweise": pr.hinweise,
                    "lizenz": licenses.kurzlabel(it)})
        if not pr.erlaubt:
            rc = 3
    if a.json:
        _p(json.dumps({"profil": profil, "ergebnisse": res, "nicht_gefunden": missing}, ensure_ascii=False, indent=2))
    else:
        for r in res:
            _p(f"{'OK  ' if r['erlaubt'] else 'NEIN'} {r['id']} – {r['lizenz']}")
            for g in r["gruende"]:
                _p(f"      ✗ {g}")
            for h in r["hinweise"]:
                _p(f"      • {h}")
        for m in missing:
            _p(f"???  {m}: nicht gefunden")
    return rc or (1 if missing else 0)


def cmd_export(a) -> int:
    from medialib.credits import medienverzeichnis

    items, missing = _load_items(a.ids)
    profil = a.profil or licenses.standardprofil()
    ok, abgelehnt = [], []
    for it in items:
        pr = licenses.pruefe_nutzung(it, profil)
        if pr.erlaubt and it.get("speicherung") == "lokal" and it.get("pfad"):
            ok.append(it)
        else:
            gr = pr.gruende or ["keine lokale Datei (nur externer Verweis)"]
            abgelehnt.append((it["id"], gr))
    if abgelehnt and not a.nur_zulaessige:
        _p(f"Export abgebrochen – im Profil '{profil}' nicht exportierbar:", file=sys.stderr)
        for mid, gr in abgelehnt:
            _p(f"  {mid}: {'; '.join(gr)}", file=sys.stderr)
        _p("(Mit --nur-zulaessige werden nur die zulässigen Medien exportiert.)", file=sys.stderr)
        return 3
    ziel = Path(a.ziel).expanduser()
    ziel.mkdir(parents=True, exist_ok=True)
    for n, it in enumerate(ok, 1):
        src = config.ROOT / it["pfad"]
        dst = ziel / f"abb-{n:02d}__{it['id']}{src.suffix}"
        shutil.copy2(src, dst)
    text, _ = medienverzeichnis(ok, "markdown", profil)
    (ziel / "BILDNACHWEISE.md").write_text(
        text + f"\n\n_Exportiert am {today()} mit Profil '{profil}' aus der Medienbibliothek Mathematik/Physik._\n", encoding="utf-8")
    meta = [{k: it.get(k) for k in ("id", "titel", "originaltitel", "urheber", "quelle_url", "lizenz", "lizenz_name",
                                    "lizenz_url", "pruefdatum", "alt_text")} for it in ok]
    (ziel / "medien.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    _p(f"{len(ok)} Medien nach {ziel} exportiert (inkl. BILDNACHWEISE.md, medien.json).")
    if abgelehnt:
        _p(f"Übersprungen: {', '.join(m for m, _ in abgelehnt)}")
    return 1 if missing else 0


# ---------------------------------------------------------------- Pflege
def cmd_add(a) -> int:
    from medialib import media_files as mf
    from medialib.importer import ZWECK
    from medialib.search import parse_stufe
    from medialib.taxonomy import load as load_tax

    src = Path(a.datei).expanduser().resolve()
    if not src.exists():
        _p(f"Datei nicht gefunden: {src}", file=sys.stderr)
        return 2
    tax = load_tax()
    kn = tax.get(a.thema)
    if not kn:
        _p(f"Unbekanntes Thema '{a.thema}'. Liste: media topics", file=sys.stderr)
        return 2
    if not a.eigen and not (a.lizenz and a.urheber and a.quelle_url):
        _p("Fremdmedien brauchen --lizenz, --urheber und --quelle-url (und möglichst --nachweis-url). "
           "Für selbst erstellte Grafiken --eigen angeben.", file=sys.stderr)
        return 2
    sha = mf.sha256_file(src)
    db = DB()
    dup = db.find_by_hash(sha256=sha)
    if dup:
        _p(f"Bereits vorhanden als {dup['id']} ({dup.get('titel')})")
        return 0
    ext = src.suffix.lower().lstrip(".").replace("jpeg", "jpg")
    prefix = "eig" if a.eigen else "man"
    mid = f"{prefix}-{sha[:8]}"
    fach = kn.fach
    rel_dir = Path("assets") / fach / ("eigene" if a.eigen else "manuell")
    dest = config.ROOT / rel_dir / f"{mid}__{mf.slugify(a.titel)}.{ext}"
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dest)
    info: dict = {}
    thumb_rel = ""
    if ext == "svg":
        ok, why, w, h = mf.svg_check(dest)
        if not ok:
            dest.unlink()
            _p(f"Abgelehnt: {why}", file=sys.stderr)
            return 2
        info.update(breite=w, hoehe=h)
    elif ext in ("png", "jpg", "gif", "webp"):
        pi = mf.process_raster(dest, ext)
        dest = pi.pop("pfad")
        flat = pi.pop("flat")
        info.update(pi)
        mf.make_thumb(flat, config.THUMBS_DIR / f"{mid}.webp")
        thumb_rel = f"thumbnails/{mid}.webp"
    st = parse_stufe(a.stufe) if a.stufe else kn.stufe
    if a.eigen:
        lid, kat, status = "Eigenproduktion", "E", "eigen"
    else:
        lid, detail = licenses.normalize(a.lizenz, a.lizenz_url)
        kat = licenses.get(lid).kategorie
        status = "verifiziert" if a.nachweis_url else "ungeprueft"
    liz = licenses.get(lid)
    mtyp = a.typ or ("diagramm" if ext == "svg" else ("animation" if info.get("animiert") else "grafik"))
    w, h = info.get("breite") or 0, info.get("hoehe") or 0
    item = {
        "id": mid, "titel": a.titel, "beschreibung": a.beschreibung or "", "originaltitel": a.titel,
        "fach": fach, "hauptthema": a.thema, "unterthemen": [t for t in (a.unterthemen or "").split(",") if t],
        "schlagworte": [s.strip() for s in (a.schlagworte or "").split(",") if s.strip()],
        "schlagworte_en": [s.strip() for s in (a.schlagworte_en or "").split(",") if s.strip()],
        "medientyp": mtyp, "format": dest.suffix.lstrip("."), "stufe_min": st[0], "stufe_max": st[1],
        "schwierigkeit": "grundlegend" if st[1] <= 8 else ("mittel" if st[0] <= 10 else "erhoeht"),
        "einsatzzweck": ZWECK.get(mtyp, ["arbeitsblatt"]),
        "fachlich": "sichtgeprueft" if a.eigen else "ungeprueft",
        "fachlich_hinweis": a.fachlich_hinweis or "",
        "beschriftung": a.beschriftung or ("de" if a.eigen else "unbekannt"),
        "breite": w, "hoehe": h, "seitenverhaeltnis": round(w / h, 3) if w and h else None,
        "transparent": info.get("transparent"), "sw_geeignet": info.get("sw_geeignet"),
        "druck_geeignet": 1 if ext == "svg" or max(w, h) >= 1200 else 0,
        "dateigroesse": dest.stat().st_size,
        "urheber": "Eigenproduktion (erstellt mit Claude)" if a.eigen else a.urheber,
        "quelle": "Eigenproduktion" if a.eigen else (a.quelle or a.quelle_url),
        "quelle_url": "" if a.eigen else a.quelle_url,
        "lizenz": lid, "lizenz_name": liz.name, "lizenz_url": a.lizenz_url or liz.url,
        "lizenz_nachweis_url": a.nachweis_url or "", "lizenz_detail": "",
        "lizenz_kategorie": kat, "lizenz_status": status, "pruefdatum": today(),
        "namensnennung_pflicht": 1 if liz.namensnennung else 0, "einschraenkungen": [],
        "speicherung": "lokal", "pfad": str(dest.relative_to(config.ROOT)), "thumbnail": thumb_rel,
        "alt_text": a.alt or "", "qualitaet": a.qualitaet, "sha256": mf.sha256_file(dest), "phash": info.get("phash"),
        "herkunft": "eigen" if a.eigen else "manuell", "quelle_id": sha, "importiert_am": now(), "kuratiert": 1,
        "notizen": ("Entstehung: " + a.entstehung) if a.entstehung else ("Eigenproduktion" if a.eigen else ""),
    }
    db.upsert(item)
    if ext == "svg":
        from medialib.importer import svg_vorschauen

        svg_vorschauen(db, [mid], out=open("/dev/null", "w") if sys.platform != "win32" else sys.stderr)
    _p(f"Aufgenommen: {mid} → {dest}")
    if status == "ungeprueft":
        _p("Hinweis: Lizenzstatus 'ungeprueft' (kein --nachweis-url) – wird von keinem Materialprofil zugelassen.")
    return 0


def cmd_topics(a) -> int:
    from medialib.taxonomy import fold, load as load_tax

    tax = load_tax()
    for kid, kn in sorted(tax.knoten.items()):
        if a.fach and kn.fach != a.fach:
            continue
        if a.suche and fold(a.suche) not in fold(" ".join(kn.begriffe()) + " " + kid):
            continue
        tiefe = kid.count(".")
        db_n = ""
        _p(f"{'  ' * tiefe}{kid:45s} {kn.label} (Kl. {kn.stufe[0]}-{kn.stufe[1]}){db_n}")
    return 0


def statistik(db: DB) -> dict:
    def grp(col, where="1=1"):
        return {r[0] or "?": r[1] for r in db.con.execute(f"SELECT {col}, COUNT(*) FROM medien WHERE {where} GROUP BY 1 ORDER BY 2 DESC")}

    st = {
        "gesamt": db.con.execute("SELECT COUNT(*) FROM medien").fetchone()[0],
        "fach": grp("fach"), "medientyp": grp("medientyp"), "format": grp("format"),
        "lizenz": grp("lizenz"), "lizenz_kategorie": grp("lizenz_kategorie"), "lizenz_status": grp("lizenz_status"),
        "speicherung": grp("speicherung"), "herkunft": grp("quelle"), "beschriftung": grp("beschriftung"),
        "fachlich": grp("fachlich"),
        "stufen": {"Sek I (5-10)": db.con.execute("SELECT COUNT(*) FROM medien WHERE stufe_min<=10").fetchone()[0],
                   "Sek II (11-13)": db.con.execute("SELECT COUNT(*) FROM medien WHERE stufe_max>=11").fetchone()[0]},
        "bereich": {r[0]: r[1] for r in db.con.execute(
            "SELECT substr(hauptthema,1,instr(substr(hauptthema,4),'.')+2) AS b, COUNT(*) FROM medien GROUP BY b ORDER BY 2 DESC")},
        "speicher_mb": round((db.con.execute("SELECT SUM(dateigroesse) FROM medien WHERE speicherung='lokal'").fetchone()[0] or 0) / 1e6, 1),
        "kandidaten": {r[0]: r[1] for r in db.con.execute("SELECT status, COUNT(*) FROM kandidaten GROUP BY 1 ORDER BY 2 DESC")},
    }
    return st


def cmd_stats(a) -> int:
    st = statistik(DB())
    if a.json:
        _p(json.dumps(st, ensure_ascii=False, indent=2))
        return 0
    _p(f"Medien gesamt: {st['gesamt']}  (lokal: {st['speicherung'].get('lokal', 0)}, extern: {st['speicherung'].get('extern', 0)}, Speicher lokal: {st['speicher_mb']} MB)")
    for k in ("fach", "bereich", "medientyp", "format", "lizenz_kategorie", "lizenz", "herkunft", "beschriftung", "fachlich", "stufen", "kandidaten"):
        _p(f"\n{k}:")
        for kk, v in st[k].items():
            _p(f"  {kk:40s} {v}")
    return 0


def cmd_import(a) -> int:
    from medialib import importer as I

    db = DB()
    plan = I.load_plan()
    if a.phase in ("entdecken", "alle"):
        I.entdecken(db, plan, nur=a.nur, erneut=a.erneut)
    if a.phase in ("auswaehlen", "alle"):
        I.auswaehlen(db, plan, nur=a.nur)
    if a.phase in ("laden", "alle"):
        I.herunterladen(db, plan, limit=a.limit)
    if a.phase in ("vorschau", "alle"):
        I.svg_vorschauen(db)
    if a.phase == "extern":
        from medialib import extern

        extern.importieren(db)
    if a.phase == "openmoji":
        from medialib import extern

        extern.openmoji(db)
    if a.phase == "kuration":
        from medialib import kuration

        kuration.anwenden(db)
    from medialib.webexport import export_web

    export_web(db)
    return 0


def cmd_verify(a) -> int:
    from medialib import verify

    db = DB()
    return verify.pruefen(db, ids=a.ids or None, aelter_als=a.aelter_als, nur_links=a.nur_links)


def cmd_backup(a) -> int:
    config.EXPORTS_DIR.mkdir(parents=True, exist_ok=True)
    name = config.EXPORTS_DIR / f"backup-{time.strftime('%Y%m%d-%H%M%S')}{'-metadaten' if a.nur_metadaten else ''}.tar.gz"
    teile = ["metadata", "config"] + ([] if a.nur_metadaten else ["assets", "thumbnails"])
    with tarfile.open(name, "w:gz") as tar:
        for t in teile:
            p = config.ROOT / t
            if p.exists():
                tar.add(p, arcname=t)
    _p(f"Sicherung erstellt: {name} ({name.stat().st_size // 1024} KB)")
    return 0


def cmd_restore(a) -> int:
    arch = Path(a.archiv).expanduser()
    if not a.ja:
        _p(f"Wiederherstellung aus {arch} überschreibt metadata/, config/ (und ggf. assets/, thumbnails/) in {config.ROOT}. "
           "Zum Bestätigen --ja angeben.", file=sys.stderr)
        return 2
    with tarfile.open(arch, "r:gz") as tar:
        for m in tar.getmembers():
            if m.name.startswith("/") or ".." in Path(m.name).parts or not m.name.split("/")[0] in ("metadata", "config", "assets", "thumbnails"):
                _p(f"Unzulässiger Pfad im Archiv: {m.name}", file=sys.stderr)
                return 2
        tar.extractall(config.ROOT, filter="data")
    n = DB().rebuild_from_jsonl()
    _p(f"Wiederhergestellt; Index neu aufgebaut ({n} Medien).")
    return 0


def cmd_rebuild(a) -> int:
    n = DB().rebuild_from_jsonl()
    _p(f"Index neu aufgebaut: {n} Medien")
    return 0


def cmd_web(a) -> int:
    from medialib.webexport import export_web

    n = export_web(DB())
    _p(f"Weboberfläche aktualisiert ({n} Medien): {config.ROOT / 'index.html'}")
    return 0


def cmd_serve(a) -> int:
    import functools
    import http.server

    from medialib.webexport import export_web

    export_web(DB())
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(config.ROOT))
    with http.server.ThreadingHTTPServer(("127.0.0.1", a.port), handler) as srv:
        _p(f"Medienübersicht: http://127.0.0.1:{a.port}/index.html  (Strg+C beendet)")
        try:
            srv.serve_forever()
        except KeyboardInterrupt:
            pass
    return 0


def cmd_kontaktbogen(a) -> int:
    from medialib.kuration import kontaktbogen

    db = DB()
    if a.ids:
        items = [db.get(i) for i in a.ids if db.get(i)]
    else:
        where, params = "1=1", []
        if a.thema:
            where += " AND hauptthema LIKE ?"
            params.append(a.thema + "%")
        if a.unkuratiert:
            where += " AND (kuratiert IS NULL OR kuratiert=0)"
        items = db.all(where, tuple(params))
    files = kontaktbogen(items, a.name, spalten=a.spalten, zeilen=a.zeilen)
    for f in files:
        _p(f)
    return 0


def cmd_original(a) -> int:
    """Lädt für ein Commons-Medium das Original (z. B. SVG-Vektorgrafik) einzeln nach.

    Wikimedia drosselt Originaldownloads von gemeinsam genutzten IP-Adressen stark;
    auf einem eigenen Rechner funktioniert ein einzelner Abruf in der Regel.
    """
    from medialib import media_files as mf
    from medialib.net import Client, HttpError

    db = DB()
    it = db.get(a.id)
    if not it or it.get("herkunft") != "commons" or not it.get("medien_url"):
        _p("Nur für Commons-Medien mit Original-URL.", file=sys.stderr)
        return 2
    url = it["medien_url"].split("?")[0]
    ext = url.rsplit(".", 1)[-1].lower().replace("jpeg", "jpg")
    alt = config.ROOT / it["pfad"]
    dest = alt.with_suffix("." + ext)
    try:
        Client(max_retries=2).download(url, dest)
    except HttpError as exc:
        _p(f"Nicht möglich: {exc}", file=sys.stderr)
        return 4
    if ext == "svg":
        ok, why, w, h = mf.svg_check(dest)
        if not ok:
            dest.unlink()
            _p(f"Abgelehnt: {why}", file=sys.stderr)
            return 2
        it.update(breite=w or it.get("breite"), hoehe=h or it.get("hoehe"))
    if dest != alt and alt.exists() and not a.behalten:
        alt.unlink()
    it.update(pfad=str(dest.relative_to(config.ROOT)), format=ext, sha256=mf.sha256_file(dest),
              dateigroesse=dest.stat().st_size, druck_geeignet=1)
    it["notizen"] = (it.get("notizen") or "") + f"; {today()}: Original nachgeladen"
    db.upsert(it)
    _p(f"Original gespeichert: {dest}")
    return 0


def cmd_pfad(a) -> int:
    _p(config.ROOT)
    return 0


# ---------------------------------------------------------------- Parser
def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="media", description="Medienbibliothek Mathematik/Physik")
    sub = p.add_subparsers(dest="cmd", required=True)

    s = sub.add_parser("search", aliases=["suche"], help="Medien suchen")
    s.add_argument("query", nargs="?", default="")
    s.add_argument("--fach", help="mathematik|physik")
    s.add_argument("--typ", help="svg, foto, diagramm, cartoon, comic, animation, video, simulation, historisch, symbol, 3d …")
    s.add_argument("--stufe", help="z. B. 8, 8-10, sek1, ef, q1")
    s.add_argument("--profil", help="offen (Standard) | unterricht | extern | recherche")
    s.add_argument("--thema", help="Taxonomie-ID als Präfix, z. B. ph.optik")
    s.add_argument("--lizenz", help="Lizenzpräfix, z. B. CC0, CC-BY-SA")
    s.add_argument("--lokal", action="store_true", help="nur lokal gespeicherte Dateien")
    s.add_argument("--limit", type=int, default=10)
    s.add_argument("--json", action="store_true")
    s.add_argument("--mit-nd", action="store_true", help="ND-lizenzierte Medien (unverändert) zulassen")
    s.add_argument("--bearbeitung", action="store_true", help="Medium soll bearbeitet werden (schließt ND aus)")
    s.set_defaults(fn=cmd_search)

    s = sub.add_parser("show", aliases=["zeige"], help="Details zu Medien")
    s.add_argument("ids", nargs="+")
    s.add_argument("--json", action="store_true")
    s.set_defaults(fn=cmd_show)

    s = sub.add_parser("credit", aliases=["nachweis"], help="Bildnachweis erzeugen")
    s.add_argument("ids", nargs="+")
    s.add_argument("--format", default="text", choices=["text", "markdown", "html", "latex"])
    s.add_argument("--bearbeitung", help="eigene Änderung, z. B. 'zugeschnitten, beschriftet'")
    s.set_defaults(fn=cmd_credit)

    s = sub.add_parser("verzeichnis", help="Medienverzeichnis für ein Dokument (mit Profilprüfung)")
    s.add_argument("ids", nargs="+")
    s.add_argument("--format", default="markdown", choices=["text", "markdown", "html", "latex"])
    s.add_argument("--profil")
    s.add_argument("--bearbeitet", nargs="*", help="ID=Beschreibung der Bearbeitung")
    s.add_argument("--titel", default="Bildnachweise")
    s.set_defaults(fn=cmd_verzeichnis)

    s = sub.add_parser("check", aliases=["pruefe"], help="Nutzung im Einsatzprofil prüfen (Exit 3 = unzulässig)")
    s.add_argument("ids", nargs="+")
    s.add_argument("--profil")
    s.add_argument("--bearbeitung", action="store_true")
    s.add_argument("--mit-nd", action="store_true")
    s.add_argument("--json", action="store_true")
    s.set_defaults(fn=cmd_check)

    s = sub.add_parser("export", help="Dateien + Bildnachweise rechtekonform exportieren")
    s.add_argument("ids", nargs="+")
    s.add_argument("--ziel", required=True)
    s.add_argument("--profil")
    s.add_argument("--nur-zulaessige", action="store_true")
    s.set_defaults(fn=cmd_export)

    s = sub.add_parser("add", aliases=["hinzufuegen"], help="Eigene oder einzeln geprüfte Datei aufnehmen")
    s.add_argument("datei")
    s.add_argument("--titel", required=True)
    s.add_argument("--thema", required=True, help="Taxonomie-ID (media topics)")
    s.add_argument("--eigen", action="store_true", help="Eigenproduktion (z. B. von Claude erstellt)")
    s.add_argument("--typ")
    s.add_argument("--stufe")
    s.add_argument("--beschreibung")
    s.add_argument("--alt", help="Alternativtext")
    s.add_argument("--schlagworte", help="kommagetrennt")
    s.add_argument("--schlagworte-en", help="kommagetrennt")
    s.add_argument("--unterthemen", help="kommagetrennte Taxonomie-IDs")
    s.add_argument("--beschriftung", help="de|en|ohne")
    s.add_argument("--qualitaet", type=int, default=4)
    s.add_argument("--fachlich-hinweis")
    s.add_argument("--entstehung", help="Entstehung/Rechtebasis, z. B. 'mit Claude als SVG gezeichnet für AB Stromkreise'")
    s.add_argument("--lizenz")
    s.add_argument("--lizenz-url")
    s.add_argument("--urheber")
    s.add_argument("--quelle")
    s.add_argument("--quelle-url")
    s.add_argument("--nachweis-url")
    s.set_defaults(fn=cmd_add)

    s = sub.add_parser("topics", aliases=["themen"], help="Taxonomie anzeigen")
    s.add_argument("--fach", choices=["mathematik", "physik"])
    s.add_argument("--suche")
    s.set_defaults(fn=cmd_topics)

    s = sub.add_parser("stats", aliases=["statistik"], help="Bestandsstatistik")
    s.add_argument("--json", action="store_true")
    s.set_defaults(fn=cmd_stats)

    s = sub.add_parser("import", help="Import (entdecken|auswaehlen|laden|vorschau|alle|extern|openmoji|kuration)")
    s.add_argument("phase", choices=["entdecken", "auswaehlen", "laden", "vorschau", "alle", "extern", "openmoji", "kuration"])
    s.add_argument("--nur", help="Regex auf Planeintrag-IDs")
    s.add_argument("--limit", type=int)
    s.add_argument("--erneut", action="store_true", help="bereits entdeckte Planeinträge erneut abfragen")
    s.set_defaults(fn=cmd_import)

    s = sub.add_parser("verify", aliases=["nachpruefen"], help="Lizenzen/Links erneut prüfen")
    s.add_argument("ids", nargs="*")
    s.add_argument("--aelter-als", type=int, help="nur Medien, deren Prüfung älter als N Tage ist")
    s.add_argument("--nur-links", action="store_true", help="nur Erreichbarkeit prüfen")
    s.set_defaults(fn=cmd_verify)

    s = sub.add_parser("backup", help="Sicherung nach exports/")
    s.add_argument("--nur-metadaten", action="store_true")
    s.set_defaults(fn=cmd_backup)

    s = sub.add_parser("restore", help="Sicherung zurückspielen")
    s.add_argument("archiv")
    s.add_argument("--ja", action="store_true")
    s.set_defaults(fn=cmd_restore)

    s = sub.add_parser("rebuild", help="Suchindex aus metadata/katalog.jsonl neu aufbauen")
    s.set_defaults(fn=cmd_rebuild)

    s = sub.add_parser("web", help="Daten der Weboberfläche aktualisieren")
    s.set_defaults(fn=cmd_web)

    s = sub.add_parser("serve", help="Lokale Weboberfläche starten")
    s.add_argument("--port", type=int, default=8765)
    s.set_defaults(fn=cmd_serve)

    s = sub.add_parser("kontaktbogen", help="Kontaktbögen (PNG) zur Sichtprüfung erzeugen")
    s.add_argument("ids", nargs="*")
    s.add_argument("--thema")
    s.add_argument("--unkuratiert", action="store_true")
    s.add_argument("--name", default="kontaktbogen")
    s.add_argument("--spalten", type=int, default=6)
    s.add_argument("--zeilen", type=int, default=5)
    s.set_defaults(fn=cmd_kontaktbogen)

    s = sub.add_parser("original", help="Original (z. B. SVG) eines Commons-Mediums einzeln nachladen")
    s.add_argument("id")
    s.add_argument("--behalten", action="store_true", help="bisherige PNG-Vorschau zusätzlich behalten")
    s.set_defaults(fn=cmd_original)

    s = sub.add_parser("pfad", help="Wurzelverzeichnis der Bibliothek ausgeben")
    s.set_defaults(fn=cmd_pfad)
    return p


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        return args.fn(args) or 0
    except BrokenPipeError:  # z. B. `media stats | head`
        try:
            sys.stdout = open("/dev/null", "w")
        except OSError:
            pass
        return 0


if __name__ == "__main__":
    sys.exit(main())
