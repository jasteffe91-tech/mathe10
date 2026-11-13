"""Quellenadapter. Jeder Adapter liefert normalisierte Kandidaten-Dicts.

Pflichtfelder eines Kandidaten:
  herkunft, quelle_id, originaltitel, originalbeschreibung, quelle, quelle_url,
  medien_url, download_url, mime, format, breite, hoehe, groesse,
  lizenz, lizenz_detail, lizenz_url, lizenz_nachweis_url, lizenz_kategorie,
  urheber, urheber_url, credit_vorgabe, einschraenkungen, kategorien, schlagworte_quelle
"""

import html
import re


def html_to_text(s: str | None) -> str:
    if not s:
        return ""
    s = re.sub(r"<br\s*/?>", " ", s, flags=re.I)
    s = re.sub(r"<[^>]+>", " ", s)
    s = html.unescape(s)
    return re.sub(r"\s+", " ", s).strip()


def first_href(s: str | None) -> str:
    if not s:
        return ""
    m = re.search(r'href="([^"]+)"', s)
    if not m:
        return ""
    u = html.unescape(m.group(1))
    if u.startswith("//"):
        u = "https:" + u
    return u


def mime_to_format(mime: str, url: str = "") -> str:
    m = (mime or "").lower()
    table = {
        "image/svg+xml": "svg", "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif",
        "image/webp": "webp", "image/tiff": "tif", "video/webm": "webm", "video/ogg": "ogv",
        "application/ogg": "ogv", "video/mp4": "mp4", "application/sla": "stl", "model/stl": "stl",
        "text/html": "html", "application/pdf": "pdf",
    }
    if m in table:
        return table[m]
    ext = url.rsplit(".", 1)[-1].lower() if "." in url else ""
    return {"jpeg": "jpg"}.get(ext, ext or "bin")
