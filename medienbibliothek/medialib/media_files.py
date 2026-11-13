"""Dateiverarbeitung: Prüfsummen, Wahrnehmungs-Hash, Bildeigenschaften, Thumbnails.

Benötigt Pillow (lazy import). SVG-Rasterung (für Vorschaubilder) erfolgt über
scripts/render_svg.mjs mit Playwright/Chromium, falls verfügbar; sonst zeigt die
Weboberfläche die SVG-Datei direkt an.
"""

from __future__ import annotations

import hashlib
import json
import re
import shutil
import subprocess
from pathlib import Path

from medialib import config

THUMB_MAX = 360
RASTER_MAX = 1600


def sha256_file(p: Path) -> str:
    h = hashlib.sha256()
    with open(p, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def slugify(text: str, maxlen: int = 50) -> str:
    import unicodedata

    t = (text or "").replace("ß", "ss").replace("ä", "ae").replace("ö", "oe").replace("ü", "ue").replace("Ä", "Ae").replace("Ö", "Oe").replace("Ü", "Ue")
    t = unicodedata.normalize("NFKD", t).encode("ascii", "ignore").decode()
    t = re.sub(r"[^A-Za-z0-9]+", "-", t).strip("-").lower()
    return (t[:maxlen].rstrip("-")) or "medium"


SVG_UNSAFE = re.compile(rb"<script|javascript:|\son[a-z]+\s*=|<foreignObject|<iframe|<embed|<object", re.I)


def svg_check(p: Path) -> tuple[bool, str, int, int]:
    """Prüft eine SVG-Datei auf aktive Inhalte und liest die Größe."""
    data = p.read_bytes()
    if SVG_UNSAFE.search(data):
        return False, "SVG enthält Skript/aktive Inhalte", 0, 0
    head = data[:4000].decode("utf-8", "ignore")
    w = h = 0
    mw = re.search(r'<svg[^>]*?\swidth="([\d.]+)', head)
    mh = re.search(r'<svg[^>]*?\sheight="([\d.]+)', head)
    mv = re.search(r'viewBox="\s*[-\d.]+[ ,]+[-\d.]+[ ,]+([\d.]+)[ ,]+([\d.]+)', head)
    if mw and mh:
        w, h = int(float(mw.group(1))), int(float(mh.group(1)))
    elif mv:
        w, h = int(float(mv.group(1))), int(float(mv.group(2)))
    return True, "", w, h


def dhash(img, size: int = 8) -> str:
    from PIL import Image

    g = img.convert("L").resize((size + 1, size), Image.LANCZOS)
    px = list(g.getdata())
    bits = 0
    for row in range(size):
        for col in range(size):
            left = px[row * (size + 1) + col]
            right = px[row * (size + 1) + col + 1]
            bits = (bits << 1) | (1 if left > right else 0)
    return f"{bits:016x}"


def hamming(a: str, b: str) -> int:
    try:
        return bin(int(a, 16) ^ int(b, 16)).count("1")
    except (TypeError, ValueError):
        return 64


def analyse_image(img) -> dict:
    """Transparenz, Farbigkeit (S/W-Eignung) und pHash eines Pillow-Bildes."""
    from PIL import Image

    out = {}
    rgba = img.convert("RGBA")
    alpha = rgba.getchannel("A")
    lo, _ = alpha.getextrema()
    out["transparent"] = 1 if lo < 250 else 0
    bg = Image.new("RGBA", rgba.size, (255, 255, 255, 255))
    flat = Image.alpha_composite(bg, rgba).convert("RGB")
    small = flat.copy()
    small.thumbnail((200, 200))
    hsv = small.convert("HSV")
    sat = list(hsv.getchannel("S").getdata())
    mean_sat = sum(sat) / max(len(sat), 1) / 255
    colored = sum(1 for s in sat if s > 80) / max(len(sat), 1)
    # S/W-geeignet: kaum Sättigung oder nur sehr wenige farbige Pixel
    out["sw_geeignet"] = 1 if (mean_sat < 0.08 or colored < 0.02) else 0
    out["phash"] = dhash(flat)
    return out, flat


def make_thumb(flat_rgb, dest: Path) -> None:
    im = flat_rgb.copy()
    im.thumbnail((THUMB_MAX, THUMB_MAX))
    dest.parent.mkdir(parents=True, exist_ok=True)
    im.save(dest, "WEBP", quality=80, method=6)


def process_raster(path: Path, fmt: str) -> dict:
    """Verkleinert große Rasterbilder auf RASTER_MAX, analysiert sie und gibt Metadaten zurück."""
    from PIL import Image, ImageSequence

    info: dict = {}
    with Image.open(path) as im:
        frames = getattr(im, "n_frames", 1)
        info["animiert"] = frames > 1
        info["frames"] = frames
        w, h = im.size
        if fmt in ("jpg", "png", "webp", "tif") and max(w, h) > RASTER_MAX:
            im2 = im.copy()
            im2.thumbnail((RASTER_MAX, RASTER_MAX), Image.LANCZOS)
            if fmt in ("jpg", "tif"):
                newp = path.with_suffix(".jpg")
                im2.convert("RGB").save(newp, "JPEG", quality=88, optimize=True, progressive=True)
            else:
                newp = path
                im2.save(newp, "PNG", optimize=True) if fmt == "png" else im2.save(newp, "WEBP", quality=88)
            if newp != path:
                path.unlink()
                path = newp
            info["skaliert"] = f"{w}x{h} -> {im2.size[0]}x{im2.size[1]}"
            w, h = im2.size
        elif fmt == "tif":
            newp = path.with_suffix(".jpg")
            im.convert("RGB").save(newp, "JPEG", quality=90, optimize=True)
            path.unlink()
            path = newp
        first = next(iter(ImageSequence.Iterator(im))) if frames > 1 else im
        a, flat = analyse_image(first if frames > 1 else Image.open(path))
    info.update(a)
    info.update({"pfad": path, "breite": w, "hoehe": h, "flat": flat})
    return info


def render_svgs(svg_paths: list[Path], out_dir: Path, width: int = 720) -> dict:
    """Rastert SVGs per Playwright (Node). Gibt {svg: png} für erfolgreiche Renderings zurück."""
    script = config.ROOT / "scripts" / "render_svg.mjs"
    node = shutil.which("node")
    if not node or not script.exists() or not svg_paths:
        return {}
    out_dir.mkdir(parents=True, exist_ok=True)
    jobs = [{"svg": str(p), "png": str(out_dir / (p.stem + ".png"))} for p in svg_paths]
    job_file = out_dir / "jobs.json"
    job_file.write_text(json.dumps({"width": width, "jobs": jobs}))
    try:
        subprocess.run([node, str(script), str(job_file)], check=True, timeout=1800,
                       capture_output=True)
    except (subprocess.SubprocessError, OSError):
        return {}
    return {Path(j["svg"]): Path(j["png"]) for j in jobs if Path(j["png"]).exists()}


def placeholder_thumb(dest: Path, label: str) -> None:
    from PIL import Image, ImageDraw

    im = Image.new("RGB", (THUMB_MAX, int(THUMB_MAX * 0.66)), (236, 240, 245))
    d = ImageDraw.Draw(im)
    d.rectangle([4, 4, im.width - 5, im.height - 5], outline=(120, 130, 150), width=2)
    d.text((20, im.height // 2 - 10), label[:40], fill=(40, 50, 70))
    dest.parent.mkdir(parents=True, exist_ok=True)
    im.save(dest, "WEBP", quality=80)
