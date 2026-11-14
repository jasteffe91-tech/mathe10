"""Demonstrationsmodus mit vollständig fiktiven Teilnehmenden (keine echten Personen)."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from . import modell

DATASET = Path(__file__).with_name("demo_datensatz.json")


def dataset() -> dict[str, Any]:
    return json.loads(DATASET.read_text(encoding="utf-8"))


def create_online_demo_group(data: dict[str, Any], label: str = "DEMO – Fortbildung (fiktiv)") -> dict[str, Any]:
    """Demo-Klasse für die Vorführung MIT Server: fiktive Namen, aber frische zufällige IDs und Codes
    (damit mehrere Lehrkräfte die Demo auf demselben Server nutzen können)."""
    g = modell.new_group(data, label, kind="demo")
    modell.add_people(g, [(p["name"].split(" ", 1)[0], p["name"].split(" ", 1)[1]) for p in dataset()["participants"]])
    g["demo"] = True
    return g


def browser_demo_group(data: dict[str, Any]) -> dict[str, Any]:
    """Demo-Klasse passend zum Demo-Modus im Browser (feste IDs/Codes aus dem Datensatz).
    Dient zum Einlesen eines Demo-Exports aus dem Dashboard ohne Server."""
    ds = dataset()
    gid = ds["group"]["id"]
    for g in data.get("groups", []):
        if g["id"] == gid:
            return g
    g = modell.new_group(data, ds["group"]["label"] + " · Browser-Demo", kind="demo")
    g["id"] = gid
    g["demo"] = True
    g["offline_demo"] = True
    for p in ds["participants"]:
        first, last = p["name"].split(" ", 1)
        g["participants"].append({"id": p["id"], "pseudonym": p["pseudonym"], "first_name": first, "last_name": last,
                                  "code": p["code"], "code_created_at": modell.now_iso(), "status": "active",
                                  "server_code": p["code"], "server_status": "active"})
    return g
