"""The Metropolitan Museum of Art – Open Access API (ohne Schlüssel, CC0 für isPublicDomain).

Hinweis: /v1/search wurde am 2026-10-01 abgeschaltet; verwendet wird /v1.1/search.
"""

from __future__ import annotations

from medialib import licenses
from medialib.db import today

BASE = "https://collectionapi.metmuseum.org/public/collection"


def search(client, query: str, limit: int = 20, typ: str = "") -> list[dict]:
    data = client.json(f"{BASE}/v1.1/search", params={"q": query, "hasImages": "true", "limit": str(min(limit * 3, 60))})
    ids = (data.get("objectIDs") or [])[: limit * 3]
    out = []
    liz = licenses.get("CC0-1.0")
    for oid in ids:
        if len(out) >= limit:
            break
        o = client.json(f"{BASE}/v1/objects/{oid}")
        if not o.get("isPublicDomain") or not o.get("primaryImage"):
            continue
        out.append({
            "herkunft": "met",
            "quelle_id": str(oid),
            "originaltitel": (o.get("title") or "")[:300],
            "originalbeschreibung": " | ".join(filter(None, [o.get("objectName"), o.get("objectDate"), o.get("culture"),
                                                           o.get("medium"), o.get("classification")]))[:1500],
            "quelle": "The Metropolitan Museum of Art",
            "quelle_url": o.get("objectURL") or f"https://www.metmuseum.org/art/collection/search/{oid}",
            "medien_url": o.get("primaryImage"),
            "download_url": o.get("primaryImageSmall") or o.get("primaryImage"),
            "mime": "image/jpeg", "format": "jpg", "breite": 0, "hoehe": 0, "groesse": 0,
            "lizenz": "CC0-1.0", "lizenz_name": liz.name,
            "lizenz_detail": "Met Open Access: isPublicDomain = true",
            "lizenz_url": liz.url,
            "lizenz_nachweis_url": f"{BASE}/v1/objects/{oid}",
            "lizenz_kategorie": "A",
            "urheber": o.get("artistDisplayName") or "unbekannt",
            "urheber_url": "",
            "credit_vorgabe": f"The Metropolitan Museum of Art, {o.get('creditLine') or ''}".strip(", "),
            "einschraenkungen": [],
            "kategorien": [t.get("term", "") for t in (o.get("tags") or []) if isinstance(t, dict)],
            "verwerfen": [],
            "pruefdatum": today(),
        })
    return out
