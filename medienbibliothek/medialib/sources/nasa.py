"""NASA Image and Video Library (images-api.nasa.gov, ohne API-Schlüssel).

Rechtsbasis: NASA Media Usage Guidelines (Prüfung 2026-11-13):
https://www.nasa.gov/nasa-brand-center/images-and-media/ – NASA-Material ist in
den USA i. d. R. nicht urheberrechtlich geschützt, Quellenangabe erbeten,
Logos/Insignien ausgenommen, Material Dritter ist als solches gekennzeichnet.
Konservativ: Einträge mit Hinweisen auf Rechte Dritter werden verworfen.
"""

from __future__ import annotations

import re

from medialib import licenses
from medialib.db import today
from medialib.sources import mime_to_format

API = "https://images-api.nasa.gov/search"
GUIDELINES = "https://www.nasa.gov/nasa-brand-center/images-and-media/"
DRITTE = re.compile(
    r"©|copyright|getty|reuters|associated press|\bap photo|afp|esa/|/esa|\besa\b|stsci|eso\b|\bjaxa\b|roscosmos|"
    r"spacex|boeing|lockheed|northrop|courtesy of|used with permission|all rights reserved",
    re.I,
)
NASA_CREDIT = re.compile(r"^(nasa|jpl|nasa/[\w .,/-]+|[\w .,/-]*nasa[\w .,/-]*)$", re.I)
PERSONEN = re.compile(r"astronaut|crew|portrait|people|students|engineer|administrator|president|spacewalk|eva\b", re.I)
LOGO = re.compile(r"\blogo\b|insignia|meatball|emblem|patch", re.I)


def search(client, query: str, limit: int = 30, typ: str = "") -> list[dict]:
    data = client.json(API, params={"q": query, "media_type": "image", "page_size": str(min(limit, 100))})
    out = []
    for it in (data.get("collection") or {}).get("items", [])[:limit]:
        d = (it.get("data") or [{}])[0]
        nid = d.get("nasa_id")
        if not nid:
            continue
        credit = (d.get("secondary_creator") or d.get("photographer") or d.get("center") or "NASA").strip()
        desc = (d.get("description") or "")[:1500]
        title = d.get("title") or nid
        einschr = ["us-pd", "nasa-logo"]
        text = f"{title} {desc} {' '.join(d.get('keywords') or [])}"
        if PERSONEN.search(text):
            einschr.append("personenrechte")
        verwerfen = []
        if DRITTE.search(f"{desc} {credit} {d.get('photographer') or ''}"):
            verwerfen.append("Hinweis auf Rechte Dritter (z. B. ©, ESA, Agenturfoto)")
        if not NASA_CREDIT.match(credit) and credit.lower() not in ("jsc", "ksc", "msfc", "gsfc", "arc", "grc", "hq", "lrc", "afrc", "ssc", "jpl"):
            verwerfen.append(f"Urheberangabe '{credit}' nicht eindeutig NASA")
        if LOGO.search(title):
            verwerfen.append("Logo/Insignie")
        liz = licenses.get("PD-USGov")
        out.append({
            "herkunft": "nasa",
            "quelle_id": nid,
            "originaltitel": title,
            "originalbeschreibung": desc,
            "quelle": "NASA Image and Video Library",
            "quelle_url": f"https://images.nasa.gov/details/{nid}",
            "medien_url": "",
            "collection_url": it.get("href", ""),
            "mime": "image/jpeg",
            "format": "jpg",
            "breite": 0, "hoehe": 0, "groesse": 0,
            "lizenz": "PD-USGov",
            "lizenz_name": liz.name,
            "lizenz_detail": "NASA Media Usage Guidelines; Werk der US-Bundesregierung",
            "lizenz_url": GUIDELINES,
            "lizenz_nachweis_url": f"https://images.nasa.gov/details/{nid}",
            "lizenz_kategorie": "A",
            "urheber": credit,
            "urheber_url": "",
            "credit_vorgabe": credit,
            "einschraenkungen": einschr,
            "kategorien": d.get("keywords") or [],
            "verwerfen": verwerfen,
            "datum": d.get("date_created", ""),
            "pruefdatum": today(),
        })
    return out


def resolve_asset(client, cand: dict) -> dict:
    """Ermittelt die Bild-URL (bevorzugt ~large, sonst ~orig) und prüft metadata.json auf Rechte Dritter."""
    files = client.json(cand["collection_url"]) if cand.get("collection_url") else []
    files = [f.replace("http://", "https://") for f in files]
    pick = next((f for f in files if "~large." in f), None) or next((f for f in files if "~orig." in f), None) \
        or next((f for f in files if "~medium." in f), None)
    meta_url = next((f for f in files if f.endswith("metadata.json")), None)
    if meta_url:
        meta = client.json(meta_url)
        blob = " ".join(str(v) for k, v in meta.items() if re.search(r"right|copyright|credit|creator|author|usage", k, re.I))
        if DRITTE.search(blob):
            cand.setdefault("verwerfen", []).append(f"metadata.json nennt Rechte Dritter: {blob[:120]}")
        credit = meta.get("XMP:Credit") or meta.get("AVAIL:SecondaryCreator")
        if credit:
            cand["credit_vorgabe"] = str(credit)[:200]
    cand["download_url"] = pick or ""
    cand["medien_url"] = pick or ""
    if pick:
        cand["format"] = mime_to_format("", pick)
    return cand
