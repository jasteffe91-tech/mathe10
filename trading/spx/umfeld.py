"""Gesamtmarkt: Indizes, Futures, VIX, Marktbreite, Sektoren. Regelbasierte Einstufung."""

from __future__ import annotations

from dataclasses import dataclass, field

import pandas as pd

from . import indikatoren as ind


@dataclass
class Marktumfeld:
    einstufung: str                       # positiv | negativ | uneinheitlich | unbekannt
    gruende: list[str]
    indizes: list[dict] = field(default_factory=list)
    futures: list[dict] = field(default_factory=list)
    vix: dict | None = None
    breite_sma50: float | None = None
    breite_sma200: float | None = None
    sektoren: list[dict] = field(default_factory=list)


def _zeile(name: str, df: pd.DataFrame) -> dict:
    c = df["close"]
    return {
        "name": name, "kurs": float(c.iloc[-1]), "datum": df.index[-1],
        "tag_pct": float((c.iloc[-1] / c.iloc[-2] - 1) * 100),
        "woche_pct": float((c.iloc[-1] / c.iloc[-6] - 1) * 100) if len(c) > 6 else None,
        "ueber_sma50": bool(c.iloc[-1] > ind.sma(c, 50).iloc[-1]),
        "ueber_sma200": bool(c.iloc[-1] > ind.sma(c, 200).iloc[-1]),
        "trend": ind.trendstruktur(df),
    }


def bewerten(indizes: dict[str, tuple[str, pd.DataFrame]], futures: list[dict], vix: dict | None,
             tagesdaten: dict[str, pd.DataFrame], sektoren: dict[str, tuple[str, pd.DataFrame]]) -> Marktumfeld:
    zeilen = [_zeile(n, df) for n, df in indizes.values() if df is not None and len(df) > 200]
    ueber50 = [df["close"].iloc[-1] > ind.sma(df["close"], 50).iloc[-1] for df in tagesdaten.values() if len(df) > 50]
    ueber200 = [df["close"].iloc[-1] > ind.sma(df["close"], 200).iloc[-1] for df in tagesdaten.values() if len(df) > 200]
    b50 = sum(ueber50) / len(ueber50) * 100 if ueber50 else None
    b200 = sum(ueber200) / len(ueber200) * 100 if ueber200 else None
    sek = sorted((_zeile(f"{t} {n}", df) for t, (n, df) in sektoren.items() if df is not None and len(df) > 200),
                 key=lambda z: -(z["woche_pct"] or 0))
    spx = next((z for z in zeilen if z["name"] == "S&P 500"), None)
    if spx is None:
        return Marktumfeld("unbekannt", ["S&P-500-Daten fehlen"], zeilen, futures, vix, b50, b200, sek)
    plus, minus, gruende = 0, 0, []
    if spx["trend"] == "Aufwärtstrend":
        plus += 1; gruende.append("S&P 500 im Aufwärtstrend (über SMA50 und SMA200)")
    elif not spx["ueber_sma50"]:
        minus += 1; gruende.append("S&P 500 unter SMA50")
    if b50 is not None:
        if b50 >= 60:
            plus += 1; gruende.append(f"breite Beteiligung: {b50:.0f} % der Titel über SMA50")
        elif b50 <= 40:
            minus += 1; gruende.append(f"schwache Marktbreite: nur {b50:.0f} % über SMA50")
    if vix:
        if vix["wert"] >= 25:
            minus += 1; gruende.append(f"VIX erhöht ({vix['wert']:.1f})")
        elif vix["wert"] < 18:
            plus += 1; gruende.append(f"VIX niedrig ({vix['wert']:.1f})")
    es = next((f for f in futures if f["symbol"] == "ES=F" and f.get("aktuell")), None)
    if es:
        if es["pct"] <= -0.7:
            minus += 1; gruende.append(f"S&P-Future vorbörslich {es['pct']:+.2f} %")
        elif es["pct"] >= 0.5:
            plus += 1; gruende.append(f"S&P-Future vorbörslich {es['pct']:+.2f} %")
    einstufung = "positiv" if plus >= 2 and minus == 0 else "negativ" if minus >= 2 and plus == 0 else "uneinheitlich"
    return Marktumfeld(einstufung, gruende or ["keine eindeutigen Signale"], zeilen, futures, vix, b50, b200, sek)
