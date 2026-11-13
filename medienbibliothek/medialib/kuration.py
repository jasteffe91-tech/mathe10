"""Kuration: manuelle Sichtprüfung festhalten und anwenden.

metadata/kuration.json:
{
  "<medien-id>": {
    "titel": "...", "beschreibung": "...", "alt_text": "...",
    "medientyp": "...", "stufe": [8, 10], "qualitaet": 1-5,
    "fachlich": "sichtgeprueft" | "maengel", "fachlich_hinweis": "...",
    "beschriftung": "de" | "en" | "ohne" | "mehrsprachig" | "andere",
    "hauptthema": "...", "unterthemen": [...], "schlagworte": [...], "schlagworte_en": [...],
    "einschraenkungen": [...], "didaktik": "...",
    "entfernen": "Begründung"   # Medium wird gelöscht und nie wieder importiert
  }
}
"""

from __future__ import annotations

import json
import sys

from medialib import config
from medialib.db import DB, today

FELDER = {"titel", "beschreibung", "alt_text", "medientyp", "qualitaet", "fachlich", "fachlich_hinweis", "beschriftung",
          "hauptthema", "unterthemen", "schlagworte", "schlagworte_en", "didaktik", "schwierigkeit", "einsatzzweck"}


def laden() -> dict:
    if config.KURATION_JSON.exists():
        return json.loads(config.KURATION_JSON.read_text(encoding="utf-8"))
    return {}


def speichern(data: dict) -> None:
    tmp = config.KURATION_JSON.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=1, sort_keys=True) + "\n", encoding="utf-8")
    tmp.replace(config.KURATION_JSON)


def anwenden(db: DB, out=sys.stdout) -> tuple[int, int]:
    from medialib.taxonomy import load as load_tax

    tax = load_tax()
    data = laden()
    geaendert = entfernt = 0
    for mid, k in data.items():
        if mid.startswith("_"):
            continue
        it = db.get(mid)
        if not it:
            continue
        if k.get("entfernen"):
            for rel in (it.get("pfad"), it.get("thumbnail")):
                if rel:
                    p = config.ROOT / rel
                    if p.exists() and p.is_file():
                        p.unlink()
            db.con.execute("UPDATE kandidaten SET status='abgelehnt-kuration', grund=? WHERE medien_id=? OR schluessel=?",
                           (f"Sichtprüfung: {k['entfernen']}", mid, f"{it.get('herkunft')}:{it.get('quelle_id')}"))
            db.delete(mid)
            entfernt += 1
            continue
        neu = dict(it)
        for f in FELDER:
            if f in k:
                neu[f] = k[f]
        if "stufe" in k:
            neu["stufe_min"], neu["stufe_max"] = k["stufe"]
        elif "hauptthema" in k and tax.get(k["hauptthema"]):
            neu["stufe_min"], neu["stufe_max"] = tax.get(k["hauptthema"]).stufe
        if "hauptthema" in k and tax.get(k["hauptthema"]):
            neu["fach"] = tax.get(k["hauptthema"]).fach
        if "einschraenkungen" in k:
            neu["einschraenkungen"] = sorted(set((it.get("einschraenkungen") or []) + k["einschraenkungen"]))
        if not neu.get("alt_text"):
            neu["alt_text"] = auto_alt(neu)
        neu["kuratiert"] = 1
        if neu.get("fachlich") in (None, "", "ungeprueft") and "fachlich" not in k:
            neu["fachlich"] = "sichtgeprueft"
        neu["aktualisiert_am"] = today()
        if neu != it:
            db.upsert(neu, export=False)
            geaendert += 1
    db.export_jsonl()
    db.export_kandidaten()
    print(f"Kuration angewendet: {geaendert} aktualisiert, {entfernt} entfernt", file=out)
    return geaendert, entfernt


TYP_DE = {"diagramm": "Diagramm", "grafik": "Grafik", "foto": "Foto", "animation": "Animation", "video": "Video",
          "cartoon": "Cartoon", "comic": "Comic", "historisch": "Historische Abbildung", "illustration": "Illustration",
          "symbol": "Symbol", "simulation": "Interaktive Simulation", "3d-modell": "3D-Modell"}


def auto_alt(it: dict) -> str:
    from medialib.taxonomy import load as load_tax

    typ = TYP_DE.get(it.get("medientyp"), "Abbildung")
    thema = load_tax().label(it.get("hauptthema") or "")
    titel = it.get("titel") or it.get("originaltitel") or ""
    if titel.lower().startswith(thema.lower()):
        return f"{typ}: {titel}"
    return f"{typ} zum Thema {thema}: {titel}"


def kontaktbogen(items: list[dict], name: str = "kontaktbogen", spalten: int = 6, zeilen: int = 5) -> list[str]:
    """Erzeugt Kontaktbögen (PNG) mit Vorschaubild, ID und Kurztitel für die Sichtprüfung."""
    from PIL import Image, ImageDraw, ImageFont

    cell_w, cell_h, img_h = 240, 230, 180
    per = spalten * zeilen
    files = []
    try:
        font = ImageFont.truetype("DejaVuSans.ttf", 12)
        font_b = ImageFont.truetype("DejaVuSans-Bold.ttf", 12)
    except OSError:
        font = font_b = ImageFont.load_default()
    config.PREVIEWS_DIR.mkdir(parents=True, exist_ok=True)
    for page in range(0, len(items), per):
        chunk = items[page:page + per]
        sheet = Image.new("RGB", (spalten * cell_w, ((len(chunk) - 1) // spalten + 1) * cell_h), "white")
        d = ImageDraw.Draw(sheet)
        for n, it in enumerate(chunk):
            x, y = (n % spalten) * cell_w, (n // spalten) * cell_h
            thumb = config.ROOT / it["thumbnail"] if it.get("thumbnail") else None
            if thumb and thumb.exists():
                with Image.open(thumb) as im:
                    im = im.convert("RGB")
                    im.thumbnail((cell_w - 10, img_h - 6))
                    sheet.paste(im, (x + (cell_w - im.width) // 2, y + 3 + (img_h - 6 - im.height) // 2))
            else:
                d.rectangle([x + 5, y + 5, x + cell_w - 5, y + img_h - 5], outline="gray")
                d.text((x + 20, y + img_h // 2), "keine Vorschau", fill="gray", font=font)
            d.rectangle([x, y, x + cell_w - 1, y + cell_h - 1], outline=(200, 200, 200))
            d.text((x + 4, y + img_h + 2), f"{it['id']} [{it.get('format')}|{it.get('lizenz', '')[:12]}]", fill=(160, 0, 0), font=font_b)
            t = (it.get("originaltitel") or it.get("titel") or "")[:70]
            d.text((x + 4, y + img_h + 18), t[:35], fill="black", font=font)
            d.text((x + 4, y + img_h + 32), t[35:70], fill="black", font=font)
        f = config.PREVIEWS_DIR / f"{name}-{page // per + 1:02d}.png"
        sheet.save(f, optimize=True)
        files.append(str(f))
    return files
