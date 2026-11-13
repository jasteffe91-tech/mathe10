"""Pfade und Grundeinstellungen der Medienbibliothek."""

from __future__ import annotations

import json
import os
from functools import lru_cache
from pathlib import Path


def library_root() -> Path:
    """Wurzelverzeichnis der Bibliothek.

    Reihenfolge: Umgebungsvariable MEDIA_LIB_ROOT, ~/Unterrichtsmedien/Mathe-Physik
    (falls vorhanden), sonst das Verzeichnis dieses Pakets.
    """
    env = os.environ.get("MEDIA_LIB_ROOT")
    if env:
        return Path(env).expanduser().resolve()
    default = Path.home() / "Unterrichtsmedien" / "Mathe-Physik"
    if (default / "config" / "taxonomie.json").exists():
        return default.resolve()
    return Path(__file__).resolve().parent.parent


ROOT = library_root()
CONFIG_DIR = ROOT / "config"
METADATA_DIR = ROOT / "metadata"
DATABASE_DIR = ROOT / "database"
DB_PATH = DATABASE_DIR / "media.sqlite"
ASSETS_DIR = ROOT / "assets"
THUMBS_DIR = ROOT / "thumbnails"
PREVIEWS_DIR = ROOT / "previews"
REPORTS_DIR = ROOT / "reports"
EXPORTS_DIR = ROOT / "exports"
KATALOG_JSONL = METADATA_DIR / "katalog.jsonl"
KANDIDATEN_JSONL = METADATA_DIR / "gepruefte_kandidaten.jsonl"
KURATION_JSON = METADATA_DIR / "kuration.json"
WEB_KATALOG_JS = METADATA_DIR / "katalog.js"


@lru_cache(maxsize=None)
def load_json(name: str) -> dict:
    with open(CONFIG_DIR / name, encoding="utf-8") as fh:
        return json.load(fh)


def settings() -> dict:
    path = CONFIG_DIR / "einstellungen.json"
    if path.exists():
        return load_json("einstellungen.json")
    return {}


def user_agent() -> str:
    """User-Agent für Importanfragen.

    Wikimedia empfiehlt Kontaktangaben im User-Agent. Diese werden NICHT
    automatisch gesetzt; wer höhere Ratenlimits möchte, trägt eine eigene
    Kontaktadresse in config/einstellungen.json unter "kontakt" ein oder setzt
    MEDIA_LIB_CONTACT.
    """
    contact = os.environ.get("MEDIA_LIB_CONTACT") or settings().get("kontakt") or ""
    base = "OER-Medienbibliothek-Importer/1.0"
    detail = "educational non-commercial school media catalogue; bot"
    if contact:
        detail = f"{contact}; {detail}"
    return f"{base} ({detail}) python-requests"
