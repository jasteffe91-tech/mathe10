"""Wikimedia Commons über die offizielle MediaWiki Action API.

Lizenzprüfung erfolgt pro Datei aus den strukturierten Metadaten der
Dateibeschreibungsseite (imageinfo/extmetadata). Eine Anfrage liefert bis zu
50 Dateien inklusive Lizenzangaben – das schont das Ratenlimit.
"""

from __future__ import annotations

import re
from urllib.parse import quote

from medialib import licenses
from medialib.db import today
from medialib.sources import first_href, html_to_text, mime_to_format

API = "https://commons.wikimedia.org/w/api.php"
EXTMETA = "|".join([
    "LicenseShortName", "LicenseUrl", "License", "UsageTerms", "AttributionRequired", "Copyrighted",
    "Restrictions", "Artist", "Credit", "ImageDescription", "ObjectName", "Categories", "DateTimeOriginal",
    "Attribution",
])
TYPFILTER = {
    "svg": "filemime:image/svg+xml",
    "bitmap": "filetype:bitmap",
    "foto": "filemime:image/jpeg",
    "png": "filemime:image/png",
    "gif": "filemime:image/gif",
    "video": "filetype:video",
    "3d": "filemime:application/sla",
    "": "",
}


def _params(**kw) -> dict:
    p = dict(action="query", format="json", formatversion="2", maxlag="5",
             prop="imageinfo", iiprop="url|size|mime|sha1|extmetadata", iiurlwidth="1280",
             iiextmetadatafilter=EXTMETA, iiextmetadatalanguage="de")
    p.update(kw)
    return p


def search(client, query: str, limit: int = 30, typ: str = "") -> list[dict]:
    q = query
    if TYPFILTER.get(typ):
        q = f"{query} {TYPFILTER[typ]}"
    data = client.json(API, params=_params(generator="search", gsrsearch=q, gsrnamespace="6", gsrlimit=str(min(limit, 50))))
    pages = (data.get("query") or {}).get("pages") or []
    pages.sort(key=lambda p: p.get("index", 999))
    return [c for c in (from_page(p) for p in pages) if c]


def by_titles(client, titles: list[str]) -> list[dict]:
    out = []
    for i in range(0, len(titles), 50):
        chunk = titles[i:i + 50]
        data = client.json(API, params=_params(titles="|".join(chunk)))
        for p in (data.get("query") or {}).get("pages") or []:
            c = from_page(p)
            if c:
                out.append(c)
            else:
                out.append({"herkunft": "commons", "quelle_id": p.get("title"), "fehlt": True})
    return out


def _em(em: dict, key: str) -> str:
    v = em.get(key) or {}
    return v.get("value") if isinstance(v, dict) else ""


def from_page(p: dict) -> dict | None:
    if p.get("missing") or not p.get("imageinfo"):
        return None
    ii = p["imageinfo"][0]
    em = ii.get("extmetadata") or {}
    title = p["title"]
    short = html_to_text(_em(em, "LicenseShortName"))
    lurl = _em(em, "LicenseUrl") or ""
    cats_raw = _em(em, "Categories") or ""
    cats = [c.strip() for c in cats_raw.split("|") if c.strip()]
    pd_detail = ", ".join(c for c in cats if re.match(r"(PD[- ]|CC-PD|CC-Zero|Public domain|PD$)", c, re.I))[:300]
    lid, detail = licenses.normalize(short, lurl, extra=pd_detail or _em(em, "License"))
    if lid == "PD" and not detail:
        detail = _em(em, "License") or short
    liz = licenses.get(lid)
    restrictions = (_em(em, "Restrictions") or "").lower()
    einschr = []
    if "personality" in restrictions:
        einschr.append("personenrechte")
    if "trademark" in restrictions or "insignia" in restrictions:
        einschr.append("marke")
    if lid == "PD-USGov":
        einschr.append("us-pd")
    artist_html = _em(em, "Artist")
    urheber = html_to_text(artist_html)
    if urheber.lower().startswith("die autorenschaft wurde nicht") or urheber.lower().startswith("the author"):
        urheber = "unbekannt (siehe Dateiseite)"
    mime = ii.get("mime", "")
    url = ii.get("url", "")
    desc_url = ii.get("descriptionurl") or f"https://commons.wikimedia.org/wiki/{quote(title.replace(' ', '_'))}"
    return {
        "herkunft": "commons",
        "quelle_id": title,
        "originaltitel": re.sub(r"^(File|Datei):", "", title).rsplit(".", 1)[0],
        "originalbeschreibung": html_to_text(_em(em, "ImageDescription"))[:1500],
        "quelle": "Wikimedia Commons",
        "quelle_url": desc_url,
        "medien_url": url,
        "thumb_url": ii.get("thumburl", ""),
        "mime": mime,
        "format": mime_to_format(mime, url),
        "breite": ii.get("width") or 0,
        "hoehe": ii.get("height") or 0,
        "groesse": ii.get("size") or 0,
        "quelle_sha1": ii.get("sha1", ""),
        "lizenz": lid,
        "lizenz_name": liz.name,
        "lizenz_detail": (detail or "")[:300],
        "lizenz_url": lurl or liz.url,
        "lizenz_nachweis_url": desc_url,
        "lizenz_kategorie": liz.kategorie,
        "lizenz_roh": short,
        "attribution_required": _em(em, "AttributionRequired"),
        "urheber": urheber[:300],
        "urheber_url": first_href(artist_html),
        "credit_vorgabe": html_to_text(_em(em, "Attribution"))[:300],
        "credit_quelle": html_to_text(_em(em, "Credit"))[:300],
        "einschraenkungen": einschr,
        "kategorien": cats,
        "pruefdatum": today(),
    }
