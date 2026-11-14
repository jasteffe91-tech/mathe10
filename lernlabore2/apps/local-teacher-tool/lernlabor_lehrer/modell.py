"""Lerngruppen und Teilnehmende im Tresor (lokal, mit Klarnamen).

Jede Person hat:
  id          – zufällige Teilnehmer-ID (UUID), geht pseudonym an den Server
  pseudonym   – kurze Kennung wie „P-8F2A“, geht an den Server
  first_name / last_name – NUR lokal
  code        – Zugangscode im Klartext, NUR lokal (Server speichert nur HMAC)
  status      – active | blocked | removed (lokaler Wunschzustand)
  server_code / server_status – zuletzt vom Server BESTÄTIGTER Stand
"""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Any, Iterable

from . import codes

KIND_PREFIX = {"class": "P", "event": "G", "demo": "D"}
KIND_NAME = {"class": "Klasse", "event": "Veranstaltung", "demo": "DEMO (fiktiv)"}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def default_retention(kind: str) -> str:
    """Standard-Löschfrist: Klassen 1 Jahr, Veranstaltungen/Demo 30 Tage."""
    days = 365 if kind == "class" else 30
    return (date.today() + timedelta(days=days)).isoformat()


def new_group(data: dict[str, Any], label: str, kind: str = "class", lab_ids: Iterable[str] = ("physik-entdecker",),
              retention_until: str | None = None, code_valid_until: str | None = None) -> dict[str, Any]:
    label = (label or "").strip()
    if not 1 <= len(label) <= 60:
        raise ValueError("Die Bezeichnung der Lerngruppe muss 1 bis 60 Zeichen lang sein.")
    if kind not in KIND_PREFIX:
        raise ValueError("Unbekannte Gruppenart.")
    g = {
        "id": codes.new_id(), "label": label, "kind": kind, "created_at": now_iso(),
        "lab_ids": list(lab_ids), "retention_until": retention_until or default_retention(kind),
        "code_valid_until": code_valid_until, "participants": [],
        "server": {"created": False, "synced_at": None}, "results": None,
    }
    data.setdefault("groups", []).append(g)
    return g


def find_group(data: dict[str, Any], group_id: str) -> dict[str, Any]:
    for g in data.get("groups", []):
        if g["id"] == group_id:
            return g
    raise KeyError(group_id)


def code_length(kind: str) -> int:
    return 12


def add_people(group: dict[str, Any], people: Iterable[tuple[str, str]], with_codes: bool = True) -> list[dict[str, Any]]:
    """Fügt Personen (Vorname, Nachname) hinzu und erzeugt ID und Pseudonym (und auf Wunsch den Zugangscode)."""
    taken = {p["pseudonym"] for p in group["participants"]}
    added = []
    for first, last in people:
        first, last = (first or "").strip(), (last or "").strip()
        if not first and not last:
            continue
        pseudo = codes.generate_pseudonym(KIND_PREFIX[group["kind"]], taken)
        taken.add(pseudo)
        p = {"id": codes.new_id(), "pseudonym": pseudo, "first_name": first, "last_name": last,
             "code": codes.generate_code(code_length(group["kind"])) if with_codes else None,
             "code_created_at": now_iso() if with_codes else None,
             "status": "active", "server_code": None, "server_status": None}
        group["participants"].append(p)
        added.append(p)
    return added


def person(group: dict[str, Any], pid: str) -> dict[str, Any]:
    for p in group["participants"]:
        if p["id"] == pid:
            return p
    raise KeyError(pid)


def reissue_code(group: dict[str, Any], pid: str) -> dict[str, Any]:
    """Neuen Code erzeugen; der alte wird beim nächsten Synchronisieren serverseitig gesperrt."""
    p = person(group, pid)
    p["code"] = codes.generate_code(code_length(group["kind"]))
    p["code_created_at"] = now_iso()
    return p


def create_missing_codes(group: dict[str, Any]) -> int:
    """Erzeugt Zugangscodes für alle Personen ohne Code. Rückgabe: Anzahl neuer Codes."""
    n = 0
    for p in active_people(group):
        if not p.get("code"):
            p["code"] = codes.generate_code(code_length(group["kind"]))
            p["code_created_at"] = now_iso()
            n += 1
    return n


def set_blocked(group: dict[str, Any], pid: str, blocked: bool) -> None:
    p = person(group, pid)
    if p["status"] != "removed":
        p["status"] = "blocked" if blocked else "active"


def mark_removed(group: dict[str, Any], pid: str) -> None:
    p = person(group, pid)
    if p.get("server_code") is None and p.get("server_status") is None:
        group["participants"].remove(p)  # nie synchronisiert → einfach löschen
    else:
        p["status"] = "removed"


def active_people(group: dict[str, Any]) -> list[dict[str, Any]]:
    return [p for p in group["participants"] if p["status"] != "removed"]


def needs_sync(group: dict[str, Any]) -> dict[str, int]:
    """Was muss noch an den Server übertragen werden?"""
    out = {"codes": 0, "status": 0, "removed": 0, "group": 0 if group["server"].get("created") else 1}
    for p in group["participants"]:
        if p["status"] == "removed":
            out["removed"] += 1
            continue
        if not p.get("code"):
            out.setdefault("ohne_code", 0)
            out["ohne_code"] += 1
        elif p.get("server_code") != p["code"]:
            out["codes"] += 1
        if p["status"] != (p.get("server_status") or "active"):
            out["status"] += 1
    return out


def sorted_people(group: dict[str, Any]) -> list[dict[str, Any]]:
    return sorted(active_people(group), key=lambda p: (p["last_name"].casefold(), p["first_name"].casefold()))


def full_name(p: dict[str, Any]) -> str:
    return f"{p.get('first_name', '')} {p.get('last_name', '')}".strip() or p.get("pseudonym", "?")
