"""Sichere Ablage des Erneuerungstokens der Lehrkraft-Anmeldung.

1. Bevorzugt im Anmeldespeicher des Betriebssystems (Windows: Anmeldeinformationsverwaltung,
   macOS: Schlüsselbund) über das Paket ``keyring``.
2. Falls nicht verfügbar: verschlüsselt im Tresor (AES-256-GCM).
Das Passwort selbst wird nie gespeichert.
"""
from __future__ import annotations

from typing import Any

SERVICE = "Lernlabore2-Lehrerprogramm"


def _keyring():
    """Liefert das keyring-Modul, wenn ein echter Anmeldespeicher verfügbar ist, sonst None."""
    try:
        import keyring
        kr = keyring.get_keyring()
        name = f"{type(kr).__module__}.{type(kr).__name__}".lower()
        if "fail" in name or "null" in name:
            return None
        if type(kr).__name__ == "ChainerBackend" and not getattr(kr, "backends", None):
            return None
        return keyring
    except Exception:
        return None


def save_token(email: str, token: str | None, vault_data: dict[str, Any]) -> str:
    kr = _keyring()
    if kr is not None:
        try:
            if token:
                kr.set_password(SERVICE, email, token)
            else:
                try:
                    kr.delete_password(SERVICE, email)
                except Exception:
                    pass
            vault_data["session"] = None
            return "Anmeldespeicher des Betriebssystems"
        except Exception:
            pass
    vault_data["session"] = {"email": email, "refresh_token": token} if token else None
    return "verschlüsselter Tresor"


def load_token(email: str, vault_data: dict[str, Any]) -> str | None:
    kr = _keyring()
    if kr is not None:
        try:
            t = kr.get_password(SERVICE, email)
            if t:
                return t
        except Exception:
            pass
    s = vault_data.get("session") or {}
    return s.get("refresh_token") if s.get("email") == email else None
