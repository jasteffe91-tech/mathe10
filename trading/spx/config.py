"""Lädt die Konfiguration: default.yaml < lokal.yaml < Umgebungsvariablen."""

from __future__ import annotations

import copy
import os
from pathlib import Path
from typing import Any

import yaml

BASIS = Path(__file__).resolve().parent.parent
STANDARD = BASIS / "config" / "default.yaml"
LOKAL = BASIS / "config" / "lokal.yaml"

# Umgebungsvariable -> (Pfad in der Konfiguration, Typ)
UMGEBUNG = {
    "SPX_KAPITAL_EUR": (("konto", "kapital_eur"), float),
    "SPX_RISIKO_JE_TRADE_PCT": (("risiko", "risiko_je_trade_pct"), float),
    "SPX_KURSQUELLE": (("daten", "kursquelle"), str),
}


def _verschmelzen(basis: dict, ueber: dict) -> dict:
    erg = copy.deepcopy(basis)
    for k, v in ueber.items():
        if isinstance(v, dict) and isinstance(erg.get(k), dict):
            erg[k] = _verschmelzen(erg[k], v)
        else:
            erg[k] = v
    return erg


def laden(pfad: str | Path | None = None, umgebung: dict[str, str] | None = None) -> dict[str, Any]:
    umgebung = os.environ if umgebung is None else umgebung
    with open(STANDARD, encoding="utf-8") as f:
        cfg = yaml.safe_load(f)
    for zusatz in (LOKAL, Path(pfad) if pfad else None):
        if zusatz and zusatz.exists():
            with open(zusatz, encoding="utf-8") as f:
                cfg = _verschmelzen(cfg, yaml.safe_load(f) or {})
    herkunft = {"kapital_eur": "Konfigurationsdatei (Annahme)"}
    for name, (pfad_cfg, typ) in UMGEBUNG.items():
        wert = umgebung.get(name)
        if wert:
            ziel = cfg
            for teil in pfad_cfg[:-1]:
                ziel = ziel.setdefault(teil, {})
            ziel[pfad_cfg[-1]] = typ(wert)
            if name == "SPX_KAPITAL_EUR":
                herkunft["kapital_eur"] = "Umgebungsvariable SPX_KAPITAL_EUR"
    cfg["_herkunft"] = herkunft
    return cfg
