"""Aktuelles S&P-500-Universum.

Primär: tägliche Bestandsliste des SPY-ETF (State Street, mit Stichtag).
Sekundär: Wikipedia-Liste für GICS-Sektoren und als Abgleich.
Die offizielle Indexzusammensetzung von S&P Dow Jones Indices ist lizenzpflichtig.
"""

from __future__ import annotations

import io
import json
import re
from dataclasses import dataclass, field
from datetime import date, datetime
from pathlib import Path

import pandas as pd

from ..kalender import UTC
from .http import holen, sitzung

SPY_URL = "https://www.ssga.com/us/en/intermediary/library-content/products/fund-data/etfs/us/holdings-daily-us-en-spy.xlsx"
WIKI_URL = "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies"


@dataclass
class Universum:
    titel: pd.DataFrame            # Spalten: ticker, name, gewicht, sektor
    stichtag: date | None
    quelle: str
    abgerufen: datetime
    hinweise: list[str] = field(default_factory=list)

    @property
    def ticker(self) -> list[str]:
        return list(self.titel["ticker"])


def spy_bestand(inhalt: bytes) -> tuple[pd.DataFrame, date | None]:
    roh = pd.read_excel(io.BytesIO(inhalt), header=None)
    stichtag = None
    for wert in roh.iloc[:6, 1]:
        m = re.search(r"As of (\d{1,2}-[A-Za-z]{3}-\d{4})", str(wert))
        if m:
            stichtag = datetime.strptime(m.group(1), "%d-%b-%Y").date()
    kopf = roh.index[roh.iloc[:, 0].map(lambda x: str(x).strip()) == "Name"][0]
    df = roh.iloc[kopf + 1:].copy()
    df.columns = [str(c).strip() for c in roh.iloc[kopf]]
    df = df[df["Ticker"].notna() & df["Weight"].notna()]
    df = df[df["Ticker"].map(lambda x: re.fullmatch(r"[A-Z]{1,5}(\.[A-Z])?", str(x).strip()) is not None)]
    # Barbestände/Futures haben keinen gültigen Ticker und fallen oben heraus.
    out = pd.DataFrame({
        "ticker": df["Ticker"].astype(str).str.strip(),
        "name": df["Name"].astype(str).str.strip(),
        "gewicht": pd.to_numeric(df["Weight"], errors="coerce"),
    }).dropna()
    return out.reset_index(drop=True), stichtag


def wiki_sektoren(html: str) -> pd.DataFrame:
    tab = pd.read_html(io.StringIO(html), attrs={"id": "constituents"})[0]
    return pd.DataFrame({"ticker": tab["Symbol"].astype(str).str.strip(),
                         "sektor": tab["GICS Sector"], "branche": tab["GICS Sub-Industry"]})


def laden(cfg: dict, cache_dir: Path) -> Universum:
    cache_dir.mkdir(parents=True, exist_ok=True)
    cache = cache_dir / "universum.json"
    s = sitzung("Mozilla/5.0 spx-analyse/0.1")
    hinweise: list[str] = []
    try:
        titel, stichtag = spy_bestand(holen(s, SPY_URL, timeout=40).content)
        quelle = f"SPDR S&P 500 ETF (SPY) Bestandsliste, Stichtag {stichtag:%d.%m.%Y}" if stichtag else "SPY-Bestandsliste"
    except Exception as e:  # noqa: BLE001 – Fallback auf Cache, Fehler wird gemeldet
        if not cache.exists():
            raise
        alt = json.loads(cache.read_text())
        titel, stichtag = pd.DataFrame(alt["titel"]), date.fromisoformat(alt["stichtag"]) if alt["stichtag"] else None
        quelle = f"Zwischenspeicher ({alt['quelle']})"
        hinweise.append(f"SPY-Bestandsliste nicht abrufbar ({e}); Zwischenspeicher verwendet")
    try:
        sek = wiki_sektoren(holen(s, WIKI_URL).text)
        nur_spy = sorted(set(titel["ticker"]) - set(sek["ticker"]))
        nur_wiki = sorted(set(sek["ticker"]) - set(titel["ticker"]))
        if nur_spy or nur_wiki:
            hinweise.append(f"Abweichung SPY ↔ Wikipedia: nur SPY {nur_spy[:8]}, nur Wikipedia {nur_wiki[:8]}")
        titel = titel.drop(columns=[c for c in ("sektor", "branche") if c in titel]).merge(sek, on="ticker", how="left")
    except Exception as e:  # noqa: BLE001
        hinweise.append(f"Sektorzuordnung (Wikipedia) nicht abrufbar: {e}")
        if "sektor" not in titel:
            titel["sektor"] = None
    if stichtag and (date.today() - stichtag).days > cfg["universum"]["max_alter_tage"]:
        hinweise.append(f"Bestandsliste ist älter als {cfg['universum']['max_alter_tage']} Tage")
    cache.write_text(json.dumps({"titel": titel.to_dict("records"), "quelle": quelle,
                                 "stichtag": stichtag.isoformat() if stichtag else None}, default=str))
    return Universum(titel, stichtag, quelle, datetime.now(UTC), hinweise)
