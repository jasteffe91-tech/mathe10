"""Abgleich mit der Online-Datenbank.

Grundregel: Ein Schritt gilt erst dann als synchronisiert, wenn der Server ihn
BESTÄTIGT hat. Erst danach werden server_code / server_status / synced_at gesetzt.
An den Server gehen nur: Gruppen-ID, Bezeichnung, Art, Teilnehmer-ID, Pseudonym,
Zugangscode (nur zur HMAC-Berechnung, wird dort nicht gespeichert). KEINE Namen.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from .api import SupabaseClient
from .modell import now_iso

BATCH = 200


@dataclass
class SyncErgebnis:
    created: int = 0
    reissued: int = 0
    unchanged: int = 0
    status_changed: int = 0
    removed: int = 0
    labs_assigned: list[str] = field(default_factory=list)

    def text(self) -> str:
        teile = [f"{self.created} neu registriert", f"{self.reissued} Codes erneuert"]
        if self.status_changed:
            teile.append(f"{self.status_changed} Sperrstatus geändert")
        if self.removed:
            teile.append(f"{self.removed} entfernt")
        return ", ".join(teile)


def payload_for(p: dict[str, Any]) -> dict[str, Any]:
    """Was über eine Person an den Server geht – bewusst ohne Namen."""
    return {"id": p["id"], "pseudonym": p["pseudonym"], "code": p["code"]}


def sync_group(client: SupabaseClient, group: dict[str, Any], assign_labs: bool = True) -> SyncErgebnis:
    res = SyncErgebnis()
    client.rpc("teacher_create_group", {
        "p_label": group["label"], "p_kind": group["kind"], "p_group_id": group["id"],
        "p_retention_until": group.get("retention_until"),
    })
    group["server"]["created"] = True

    if assign_labs:
        for lab in group.get("lab_ids") or []:
            client.rpc("teacher_set_lab_assignment", {"p_group_id": group["id"], "p_lab_id": lab, "p_state": "active"})
            res.labs_assigned.append(lab)

    todo = [p for p in group["participants"] if p["status"] != "removed" and p.get("code") and p.get("server_code") != p["code"]]
    for i in range(0, len(todo), BATCH):
        batch = todo[i:i + BATCH]
        r = client.rpc("teacher_register_participants", {
            "p_group_id": group["id"], "p_participants": [payload_for(p) for p in batch],
            "p_code_valid_until": group.get("code_valid_until"),
        })
        if not r or not r.get("ok"):
            raise RuntimeError("Der Server hat die Registrierung nicht bestätigt.")
        res.created += r.get("created", 0)
        res.reissued += r.get("reissued", 0)
        res.unchanged += r.get("unchanged", 0)
        for p in batch:  # erst NACH Bestätigung
            p["server_code"] = p["code"]
            if p.get("server_status") is None:
                p["server_status"] = "active"

    for wanted in ("blocked", "active"):
        ids = [p["id"] for p in group["participants"]
               if p["status"] == wanted and p.get("server_code") and (p.get("server_status") or "active") != wanted]
        if ids:
            client.rpc("teacher_set_participant_status", {"p_participant_ids": ids, "p_status": wanted})
            for p in group["participants"]:
                if p["id"] in ids:
                    p["server_status"] = wanted
            res.status_changed += len(ids)

    removed = [p for p in group["participants"] if p["status"] == "removed"]
    if removed:
        client.rpc("teacher_remove_participants", {"p_participant_ids": [p["id"] for p in removed]})
        group["participants"] = [p for p in group["participants"] if p["status"] != "removed"]
        res.removed = len(removed)

    group["server"]["synced_at"] = now_iso()
    return res


def fetch_results(client: SupabaseClient, group: dict[str, Any]) -> dict[str, Any]:
    """Pseudonyme Ergebnisse abrufen und lokal (im Tresor) zwischenspeichern."""
    export = client.rpc("teacher_export_group", {"p_group_id": group["id"]})
    if not export or export.get("format") != "lernlabore2-export":
        raise RuntimeError("Unerwartete Antwort des Servers.")
    group["results"] = {"fetched_at": now_iso(), "export": export}
    return export


def import_export_file(group: dict[str, Any], export: dict[str, Any]) -> None:
    """Pseudonymen Export (JSON-Datei, z. B. aus dem Demo-Dashboard) einlesen."""
    if export.get("format") != "lernlabore2-export":
        raise ValueError("Die Datei ist kein Export der Lernlabore 2.0.")
    group["results"] = {"fetched_at": now_iso(), "export": export, "quelle": "Datei"}
