"""Verschlüsselter Tresor für die lokale Zuordnung Name ↔ Teilnehmer-ID ↔ Zugangscode.

Format (Datei ``*.llv``)::

    {"format": "LLV1", "kdf": {"name": "argon2id", "t": 3, "m": 65536, "p": 4, "salt": "<b64>"},
     "nonce": "<b64>", "ciphertext": "<b64>"}

* Schlüsselableitung: Argon2id (64 MiB, 3 Durchläufe, 4 Threads) aus dem Tresor-Passwort
* Verschlüsselung: AES-256-GCM (authentifiziert – Manipulationen werden erkannt)
* Der Dateikopf (ohne Chiffrat) ist als „associated data“ mit authentifiziert.
* Speichern erfolgt atomar (temporäre Datei + Umbenennen) mit Sicherungskopie ``.bak``.
"""
from __future__ import annotations

import base64
import json
import os
import secrets
import shutil
import tempfile
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.exceptions import InvalidTag

try:  # Argon2id bevorzugt
    from argon2.low_level import Type as _Argon2Type, hash_secret_raw as _argon2_raw
    HAVE_ARGON2 = True
except Exception:  # pragma: no cover - nur falls argon2-cffi fehlt
    HAVE_ARGON2 = False

FORMAT = "LLV1"
MIN_PASSWORD_LENGTH = 10
DEFAULT_KDF = {"name": "argon2id", "t": 3, "m": 65536, "p": 4}


class TresorFehler(Exception):
    """Allgemeiner Fehler beim Öffnen/Speichern des Tresors."""


class FalschesPasswort(TresorFehler):
    pass


def _b64e(b: bytes) -> str:
    return base64.b64encode(b).decode("ascii")


def _b64d(s: str) -> bytes:
    return base64.b64decode(s.encode("ascii"))


def _derive_key(password: str, kdf: dict[str, Any]) -> bytes:
    salt = _b64d(kdf["salt"])
    pw = password.encode("utf-8")
    if kdf["name"] == "argon2id":
        if not HAVE_ARGON2:
            raise TresorFehler("Argon2id ist nicht installiert (Paket argon2-cffi).")
        return _argon2_raw(pw, salt, time_cost=int(kdf["t"]), memory_cost=int(kdf["m"]),
                           parallelism=int(kdf["p"]), hash_len=32, type=_Argon2Type.ID)
    if kdf["name"] == "scrypt":
        from cryptography.hazmat.primitives.kdf.scrypt import Scrypt
        return Scrypt(salt=salt, length=32, n=int(kdf["n"]), r=int(kdf["r"]), p=int(kdf["p"])).derive(pw)
    raise TresorFehler(f"Unbekanntes Schlüsselverfahren: {kdf['name']}")


def _header_aad(header: dict[str, Any]) -> bytes:
    return json.dumps({"format": header["format"], "kdf": header["kdf"]}, sort_keys=True).encode("utf-8")


def encrypt_document(data: dict[str, Any], password: str, kdf: dict[str, Any] | None = None) -> dict[str, Any]:
    if kdf is None:
        kdf = dict(DEFAULT_KDF) if HAVE_ARGON2 else {"name": "scrypt", "n": 2 ** 17, "r": 8, "p": 1}
        kdf["salt"] = _b64e(secrets.token_bytes(16))
    header = {"format": FORMAT, "kdf": kdf}
    key = _derive_key(password, kdf)
    nonce = secrets.token_bytes(12)
    plaintext = json.dumps(data, ensure_ascii=False).encode("utf-8")
    ct = AESGCM(key).encrypt(nonce, plaintext, _header_aad(header))
    return {**header, "nonce": _b64e(nonce), "ciphertext": _b64e(ct)}


def decrypt_document(doc: dict[str, Any], password: str) -> dict[str, Any]:
    if doc.get("format") != FORMAT:
        raise TresorFehler("Unbekanntes Dateiformat – ist das eine Tresordatei der Lernlabore 2.0?")
    key = _derive_key(password, doc["kdf"])
    try:
        plaintext = AESGCM(key).decrypt(_b64d(doc["nonce"]), _b64d(doc["ciphertext"]), _header_aad(doc))
    except InvalidTag as e:
        raise FalschesPasswort("Das Passwort ist falsch oder die Datei wurde verändert.") from e
    return json.loads(plaintext.decode("utf-8"))


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def empty_vault() -> dict[str, Any]:
    return {"format": "lernlabore2-tresor", "version": 1, "created_at": _now(), "updated_at": _now(), "groups": [], "session": None}


@dataclass
class Tresor:
    """Geöffneter Tresor. ``data`` enthält Gruppen, Teilnehmende (mit Namen) und abgerufene Ergebnisse."""

    path: Path
    _password: str = field(repr=False)
    data: dict[str, Any] = field(default_factory=empty_vault)
    _kdf: dict[str, Any] | None = field(default=None, repr=False)

    # ------------------------------------------------------------ Anlegen/Öffnen
    @classmethod
    def create(cls, path: str | os.PathLike, password: str) -> "Tresor":
        path = Path(path)
        if path.exists():
            raise TresorFehler(f"Die Datei {path} existiert bereits.")
        check_password_strength(password)
        t = cls(path=path, _password=password, data=empty_vault())
        t.save()
        return t

    @classmethod
    def open(cls, path: str | os.PathLike, password: str) -> "Tresor":
        path = Path(path)
        try:
            doc = json.loads(path.read_text(encoding="utf-8"))
        except FileNotFoundError as e:
            raise TresorFehler(f"Tresordatei nicht gefunden: {path}") from e
        except json.JSONDecodeError as e:
            raise TresorFehler("Die Tresordatei ist beschädigt. Bitte eine Sicherung wiederherstellen.") from e
        data = decrypt_document(doc, password)
        if data.get("format") != "lernlabore2-tresor":
            raise TresorFehler("Die Datei enthält keinen gültigen Tresor.")
        return cls(path=path, _password=password, data=data, _kdf=doc["kdf"])

    # ------------------------------------------------------------ Speichern
    def save(self) -> None:
        self.data["updated_at"] = _now()
        doc = encrypt_document(self.data, self._password, self._kdf)
        self._kdf = doc["kdf"]
        self.path.parent.mkdir(parents=True, exist_ok=True)
        fd, tmp = tempfile.mkstemp(prefix=".tresor-", suffix=".tmp", dir=str(self.path.parent))
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as f:
                json.dump(doc, f)
                f.flush()
                os.fsync(f.fileno())
            if self.path.exists():
                shutil.copy2(self.path, self.path.with_suffix(self.path.suffix + ".bak"))
            os.replace(tmp, self.path)
        finally:
            if os.path.exists(tmp):
                os.unlink(tmp)

    def change_password(self, new_password: str) -> None:
        check_password_strength(new_password)
        self._password = new_password
        self._kdf = None  # neues Salz
        self.save()

    # ------------------------------------------------------------ Sicherungen
    def backup(self, target: str | os.PathLike, password: str | None = None) -> Path:
        """Verschlüsselte Sicherungskopie (optional mit eigenem Sicherungspasswort)."""
        target = Path(target)
        if password:
            check_password_strength(password)
        doc = encrypt_document(self.data, password or self._password)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(json.dumps(doc), encoding="utf-8")
        return target

    @staticmethod
    def read_backup(source: str | os.PathLike, password: str) -> dict[str, Any]:
        doc = json.loads(Path(source).read_text(encoding="utf-8"))
        data = decrypt_document(doc, password)
        if data.get("format") != "lernlabore2-tresor":
            raise TresorFehler("Die Sicherung enthält keinen gültigen Tresor.")
        return data

    def restore_from(self, source: str | os.PathLike, password: str) -> None:
        """Ersetzt den aktuellen Inhalt durch eine Sicherung (der bisherige Stand bleibt als .bak erhalten)."""
        self.data = self.read_backup(source, password)
        self.save()


def check_password_strength(password: str) -> None:
    if len(password or "") < MIN_PASSWORD_LENGTH:
        raise TresorFehler(f"Das Passwort muss mindestens {MIN_PASSWORD_LENGTH} Zeichen lang sein.")
    if password.lower() in {"passwort123", "1234567890", "lernlabore", "schule12345"}:
        raise TresorFehler("Dieses Passwort ist zu leicht zu erraten.")
