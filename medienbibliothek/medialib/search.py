"""Suche: Taxonomie-Erweiterung + FTS5 (Wörter, Präfixe) + Trigramm (Teilwörter) + Qualität.

Ranking-Bestandteile (gewichtet, 0..1):
- thema:   Übereinstimmung mit erkannten Taxonomiethemen (direkt > Unterthema > verwandt)
- fts:     BM25 über Titel, Beschreibung, Schlagworte, Themenbegriffe, Original, Englisch
- abdeckung: Anteil der Suchwörter, die im Medium vorkommen
- trigramm: Teilwort-Treffer (Komposita wie "Kreisfläche" ↔ "Fläche des Kreises")
- qualitaet: kuratierte Qualitätsnote
Lizenz-/Profilfilter werden hart angewendet (nicht nur gewichtet).
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from medialib import config, licenses
from medialib.db import DB, row_to_dict
from medialib.taxonomy import fold, load as load_tax, tokens

TYP_ALIASE = {
    "svg": ("format", ["svg"]), "vektor": ("format", ["svg"]), "vektorgrafik": ("format", ["svg"]),
    "png": ("format", ["png"]), "jpg": ("format", ["jpg"]), "gif": ("format", ["gif"]),
    "foto": ("medientyp", ["foto"]), "photo": ("medientyp", ["foto"]), "fotografie": ("medientyp", ["foto"]),
    "diagramm": ("medientyp", ["diagramm", "grafik"]), "grafik": ("medientyp", ["diagramm", "grafik"]),
    "schema": ("medientyp", ["diagramm"]), "zeichnung": ("medientyp", ["diagramm", "grafik", "illustration"]),
    "cartoon": ("medientyp", ["cartoon", "comic"]), "comic": ("medientyp", ["comic", "cartoon"]),
    "humor": ("medientyp", ["cartoon", "comic"]), "karikatur": ("medientyp", ["cartoon"]),
    "animation": ("medientyp", ["animation"]), "video": ("medientyp", ["video"]),
    "simulation": ("medientyp", ["simulation"]), "interaktiv": ("medientyp", ["simulation"]),
    "historisch": ("medientyp", ["historisch"]), "illustration": ("medientyp", ["illustration", "symbol"]),
    "symbol": ("medientyp", ["symbol"]), "icon": ("medientyp", ["symbol"]), "3d": ("medientyp", ["3d-modell"]),
    "3d-modell": ("medientyp", ["3d-modell"]),
}
STUFE_ALIASE = {"sek1": (5, 10), "sek2": (11, 13), "sek i": (5, 10), "sek ii": (11, 13), "ef": (11, 11),
                "q1": (12, 12), "q2": (13, 13), "oberstufe": (11, 13), "unterstufe": (5, 7), "mittelstufe": (8, 10)}
FACH_ALIASE = {"mathe": "mathematik", "ma": "mathematik", "mathematik": "mathematik", "math": "mathematik",
               "physik": "physik", "ph": "physik", "phy": "physik"}


def parse_stufe(s: str | None) -> tuple[int, int] | None:
    if not s:
        return None
    s = s.strip().lower()
    if s in STUFE_ALIASE:
        return STUFE_ALIASE[s]
    m = re.match(r"^(\d{1,2})\s*(?:-|–|bis)\s*(\d{1,2})$", s)
    if m:
        return int(m.group(1)), int(m.group(2))
    if s.isdigit():
        return int(s), int(s)
    raise ValueError(f"Klassenstufe '{s}' nicht verstanden (Beispiele: 8, 8-10, sek1, ef, q1)")


@dataclass
class Ergebnis:
    item: dict
    score: float
    gruende: list = field(default_factory=list)
    pruefung: licenses.Pruefung | None = None
    nur_verwandt: bool = False


def _fts_query(toks: list[str]) -> str:
    parts = []
    for t in toks:
        if len(t) >= 4:
            parts.append(f'"{t}"*')
        elif len(t) >= 2:
            parts.append(f'"{t}"')
    return " OR ".join(parts)


def suche(
    query: str,
    fach: str | None = None,
    typ: str | None = None,
    stufe: str | None = None,
    profil: str | None = None,
    thema: str | None = None,
    lizenz: str | None = None,
    nur_lokal: bool = False,
    limit: int = 10,
    mit_nd: bool = False,
    bearbeitung: bool = False,
    db: DB | None = None,
) -> tuple[list[Ergebnis], dict]:
    db = db or DB()
    tax = load_tax()
    profil = profil or licenses.standardprofil()
    licenses.profil(profil)  # validiert
    info: dict = {"profil": profil, "themen": [], "ausgeschlossen_lizenz": 0}

    qtoks = tokens(query)
    treffer = tax.erkenne(query) if query.strip() else []
    if thema:
        treffer = [t for t in treffer if t.thema.startswith(thema)] or []
    themen = {t.thema: t for t in treffer}
    info["themen"] = [(t.thema, tax.label(t.thema), t.score, t.art) for t in treffer[:8]]

    # ---------- Kandidatenmenge
    scores: dict[str, dict] = {}

    def bucket(mid):
        return scores.setdefault(mid, {"thema": 0.0, "fts": 0.0, "tri": 0.0, "thema_art": "", "thema_id": ""})

    if qtoks:
        fq = _fts_query(qtoks)
        if fq:
            rows = db.con.execute(
                "SELECT id, bm25(medien_fts, 0, 6.0, 2.0, 4.0, 3.0, 1.0, 2.0) AS r FROM medien_fts WHERE medien_fts MATCH ? ORDER BY r LIMIT 400",
                (fq,),
            ).fetchall()
            if rows:
                best = max(-r["r"] for r in rows) or 1.0
                for r in rows:
                    bucket(r["id"])["fts"] = max(0.0, -r["r"]) / best
        tri_toks = [t for t in qtoks if len(t) >= 4]
        for t in tri_toks:
            for r in db.con.execute("SELECT id FROM medien_tri WHERE medien_tri MATCH ? LIMIT 400", (f'"{t}"',)):
                bucket(r["id"])["tri"] += 1 / len(tri_toks)

    if themen:
        ids = list(themen)
        qs = ",".join("?" for _ in ids)
        for r in db.con.execute(f"SELECT id, hauptthema, unterthemen FROM medien WHERE hauptthema IN ({qs})", ids):
            t = themen[r["hauptthema"]]
            b = bucket(r["id"])
            if t.score > b["thema"]:
                b.update(thema=t.score, thema_art=t.art, thema_id=t.thema)
        like = " OR ".join("unterthemen LIKE ?" for _ in ids)
        for r in db.con.execute(f"SELECT id, unterthemen FROM medien WHERE {like}", [f'%"{i}"%' for i in ids]):
            for i in ids:
                if f'"{i}"' in (r["unterthemen"] or ""):
                    t = themen[i]
                    b = bucket(r["id"])
                    if t.score * 0.85 > b["thema"]:
                        b.update(thema=t.score * 0.85, thema_art=t.art, thema_id=i)

    if not qtoks and not themen:
        for r in db.con.execute("SELECT id FROM medien"):
            bucket(r["id"])

    # ---------- Filter + Ranking
    tf = TYP_ALIASE.get((typ or "").lower()) if typ else None
    if typ and not tf:
        raise ValueError(f"Medientyp '{typ}' unbekannt. Möglich: {', '.join(sorted(TYP_ALIASE))}")
    st = parse_stufe(stufe)
    fach_n = FACH_ALIASE.get((fach or "").lower(), fach) if fach else None

    out: list[Ergebnis] = []
    if not scores:
        return out, info
    ids = list(scores)
    rows = {}
    for i in range(0, len(ids), 500):
        chunk = ids[i:i + 500]
        for r in db.con.execute(f"SELECT * FROM medien WHERE id IN ({','.join('?' for _ in chunk)})", chunk):
            rows[r["id"]] = row_to_dict(r)

    for mid, sc in scores.items():
        it = rows.get(mid)
        if not it:
            continue
        if fach_n and it.get("fach") not in (fach_n, "beide"):
            continue
        if thema and not ((it.get("hauptthema") or "").startswith(thema) or any(u.startswith(thema) for u in it.get("unterthemen") or [])):
            continue
        if tf and it.get(tf[0]) not in tf[1]:
            # SVG-Filter: auch Medien mit Vektor-Original an der Quelle (lokal als PNG-Vorschau)
            if not (tf[1] == ["svg"] and it.get("mime") == "image/svg+xml"):
                continue
        if st and not ((it.get("stufe_min") or 5) <= st[1] and (it.get("stufe_max") or 13) >= st[0]):
            continue
        if lizenz and not (it.get("lizenz") or "").lower().startswith(lizenz.lower()):
            continue
        if nur_lokal and it.get("speicherung") != "lokal":
            continue
        pr = licenses.pruefe_nutzung(it, profil, bearbeitung=bearbeitung, mit_nd=mit_nd)
        if not pr.erlaubt:
            info["ausgeschlossen_lizenz"] += 1
            continue
        # Abdeckung der Suchwörter
        blob = fold(" ".join([it.get("titel") or "", it.get("beschreibung") or "", " ".join(it.get("schlagworte") or []),
                              " ".join(it.get("schlagworte_en") or []), it.get("originaltitel") or "",
                              tax.suchtext(it.get("hauptthema") or "")]))
        cov = sum(1 for t in qtoks if t in blob or (len(t) >= 6 and t[:6] in blob)) / len(qtoks) if qtoks else 1.0
        q = ((it.get("qualitaet") or 3) - 1) / 4
        score = 0.42 * sc["thema"] + 0.25 * sc["fts"] + 0.18 * cov + 0.05 * min(sc["tri"], 1) + 0.10 * q
        if it.get("fachlich") == "maengel":
            score -= 0.15
        if it.get("kuratiert"):
            score += 0.02
        if qtoks and cov == 0 and sc["thema"] < 0.3:
            continue
        if score < 0.15:
            continue
        gr = []
        if sc["thema_id"]:
            art = {"direkt": "Thema", "unterthema": "Unterthema", "verwandt": "verwandtes Thema (keine Gleichsetzung)"}[sc["thema_art"] or "direkt"]
            gr.append(f"{art}: {tax.label(sc['thema_id'])}")
        if sc["fts"] > 0.3:
            gr.append("Volltext")
        if cov and qtoks:
            gr.append(f"Suchwörter {round(cov * 100)} %")
        out.append(Ergebnis(item=it, score=round(min(score, 1.0), 3), gruende=gr, pruefung=pr,
                            nur_verwandt=sc["thema_art"] == "verwandt" and sc["fts"] < 0.3))
    out.sort(key=lambda e: (-e.score, e.item["id"]))
    info["gesamt"] = len(out)
    return out[:limit], info


def ergebnis_dict(e: Ergebnis, mit_nachweis: bool = True) -> dict:
    from medialib.credits import bildnachweis

    it = e.item
    pfad = str(config.ROOT / it["pfad"]) if it.get("pfad") else None
    d = {
        "id": it["id"],
        "score": e.score,
        "titel": it.get("titel"),
        "beschreibung": it.get("beschreibung"),
        "fach": it.get("fach"),
        "thema": it.get("hauptthema"),
        "thema_label": load_tax().label(it.get("hauptthema") or ""),
        "medientyp": it.get("medientyp"),
        "format": it.get("format"),
        "stufe": f"{it.get('stufe_min')}-{it.get('stufe_max')}",
        "beschriftung": it.get("beschriftung"),
        "breite": it.get("breite"), "hoehe": it.get("hoehe"),
        "transparent": it.get("transparent"), "sw_geeignet": it.get("sw_geeignet"), "druck_geeignet": it.get("druck_geeignet"),
        "speicherung": it.get("speicherung"),
        "pfad": pfad,
        "thumbnail": str(config.ROOT / it["thumbnail"]) if it.get("thumbnail") else None,
        "url": it.get("quelle_url"),
        "lizenz": it.get("lizenz"), "lizenz_name": it.get("lizenz_name"), "lizenz_kategorie": it.get("lizenz_kategorie"),
        "lizenz_status": it.get("lizenz_status"), "pruefdatum": it.get("pruefdatum"),
        "alt_text": it.get("alt_text"),
        "qualitaet": it.get("qualitaet"),
        "fachlich": it.get("fachlich"), "fachlich_hinweis": it.get("fachlich_hinweis"),
        "treffergrund": e.gruende,
        "nur_verwandt": e.nur_verwandt,
        "hinweise": e.pruefung.hinweise if e.pruefung else [],
    }
    if mit_nachweis:
        d["bildnachweis"] = bildnachweis(it, "text")
    return d
