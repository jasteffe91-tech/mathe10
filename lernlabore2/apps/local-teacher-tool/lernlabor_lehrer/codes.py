"""Zugangscodes und Pseudonyme – kryptografisch zufällig (Modul ``secrets``)."""
from __future__ import annotations

import re
import secrets
import uuid

# ohne leicht verwechselbare Zeichen I, L, O, 0, 1
ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
_VALID = re.compile(r"^[A-HJKMNP-Z2-9]+$")


def random_chars(n: int) -> str:
    return "".join(secrets.choice(ALPHABET) for _ in range(n))


def format_code(raw: str) -> str:
    n = normalize(raw)
    return "-".join(n[i:i + 4] for i in range(0, len(n), 4))


def normalize(code: str) -> str:
    return re.sub(r"[^A-Z0-9]", "", (code or "").upper())


def is_valid(code: str, min_len: int = 8) -> bool:
    n = normalize(code)
    return min_len <= len(n) <= 16 and bool(_VALID.match(n))


def generate_code(length: int = 12) -> str:
    """Zugangscode, z. B. ``K7QP-M4XR-9TBA`` (12 Zeichen ≈ 59 Bit Zufall)."""
    return format_code(random_chars(length))


def generate_pseudonym(prefix: str = "P", taken: set[str] | None = None) -> str:
    """Nicht sprechende Teilnehmerkennung, z. B. ``P-8F2A`` (eindeutig innerhalb der Gruppe)."""
    taken = taken or set()
    for _ in range(10_000):
        p = f"{prefix}-{random_chars(4)}"
        if p not in taken:
            return p
    raise RuntimeError("Kein freies Pseudonym gefunden")


def new_id() -> str:
    """Zufällige Teilnehmer-ID (UUID v4)."""
    return str(uuid.uuid4())
