"""Wellcome Collection Catalogue API (ohne Schlüssel).

Lizenz wird pro Bild aus dem Katalog des Anbieters gelesen (locations[].license).
Zugelassen: Public Domain Mark, CC0, CC BY. Alles andere wird verworfen.
"""

from __future__ import annotations

from medialib import licenses
from medialib.db import today

API = "https://api.wellcomecollection.org/catalogue/v2/images"
LIZENZ_MAP = {"pdm": "PDM-1.0", "cc-0": "CC0-1.0", "cc-by": "CC-BY-4.0"}


def search(client, query: str, limit: int = 30, typ: str = "") -> list[dict]:
    data = client.json(API, params={
        "query": query, "pageSize": str(min(limit, 100)), "locations.license": "pdm,cc-by,cc-0",
        "include": "source.contributors",
    })
    out = []
    for r in data.get("results", [])[:limit]:
        loc = next((l for l in r.get("locations", []) if l.get("locationType", {}).get("id") == "iiif-image"), None)
        if not loc:
            continue
        lic = (loc.get("license") or {}).get("id", "")
        lid = LIZENZ_MAP.get(lic, "unbekannt")
        liz = licenses.get(lid)
        src = r.get("source") or {}
        contributors = [c.get("agent", {}).get("label", "") for c in src.get("contributors", []) if c.get("agent")]
        base = loc["url"].rsplit("/info.json", 1)[0]
        image_id = base.rsplit("/", 1)[-1]
        work = src.get("id", "")
        page = f"https://wellcomecollection.org/works/{work}/images?id={r['id']}" if work else "https://wellcomecollection.org/"
        out.append({
            "herkunft": "wellcome",
            "quelle_id": r["id"],
            "originaltitel": (src.get("title") or image_id)[:300],
            "originalbeschreibung": (src.get("title") or "")[:1500],
            "quelle": "Wellcome Collection",
            "quelle_url": page,
            "medien_url": f"{base}/full/max/0/default.jpg",
            "download_url": f"{base}/full/!1600,1600/0/default.jpg",
            "mime": "image/jpeg",
            "format": "jpg",
            "breite": 0, "hoehe": 0, "groesse": 0,
            "lizenz": lid,
            "lizenz_name": liz.name,
            "lizenz_detail": (loc.get("license") or {}).get("label", ""),
            "lizenz_url": (loc.get("license") or {}).get("url", "") or liz.url,
            "lizenz_nachweis_url": f"{API}/{r['id']}",
            "lizenz_kategorie": liz.kategorie,
            "urheber": "; ".join(contributors)[:300] or "unbekannt",
            "urheber_url": "",
            "credit_vorgabe": loc.get("credit") or "Wellcome Collection",
            "einschraenkungen": [],
            "kategorien": [],
            "verwerfen": [] if lid != "unbekannt" else [f"Lizenz '{lic}' nicht zugelassen"],
            "pruefdatum": today(),
        })
    return out
