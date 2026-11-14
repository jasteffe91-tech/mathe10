"""Nicht geheime Einstellungen (Server-Adresse, öffentlicher Schlüssel, E-Mail, Pfade)."""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any

DEFAULTS: dict[str, Any] = {
    "supabase_url": "",
    "supabase_anon_key": "",
    "email": "",
    "lab_base_url": "",   # z. B. https://name.github.io/mathe10/lernlabore2/site/
    "vault_path": "",
    "export_dir": "",
}


def app_dir() -> Path:
    if sys.platform == "win32":
        base = Path(os.environ.get("APPDATA", Path.home() / "AppData" / "Roaming"))
        return base / "Lernlabore2"
    return Path.home() / ".lernlabore2"


def documents_dir() -> Path:
    d = Path.home() / "Documents"
    return (d if d.exists() else Path.home()) / "Lernlabore2-Auswertungen"


class Einstellungen:
    def __init__(self, path: Path | None = None):
        self.path = path or app_dir() / "einstellungen.json"
        self.data: dict[str, Any] = dict(DEFAULTS)
        if self.path.exists():
            try:
                self.data.update(json.loads(self.path.read_text(encoding="utf-8")))
            except (ValueError, OSError):
                pass
        if not self.data["vault_path"]:
            self.data["vault_path"] = str(app_dir() / "tresor.llv")
        if not self.data["export_dir"]:
            self.data["export_dir"] = str(documents_dir())

    def __getitem__(self, k: str) -> Any:
        return self.data.get(k, DEFAULTS.get(k))

    def __setitem__(self, k: str, v: Any) -> None:
        self.data[k] = v

    def save(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self.path.with_suffix(".tmp")
        tmp.write_text(json.dumps(self.data, indent=2, ensure_ascii=False), encoding="utf-8")
        os.replace(tmp, self.path)

    @property
    def online_configured(self) -> bool:
        return bool(self["supabase_url"] and self["supabase_anon_key"])
