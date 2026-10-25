"""Technische Indikatoren auf OHLCV-DataFrames (Spalten: open, high, low, close, volume).

Alle Funktionen nutzen nur Daten bis zum jeweiligen Zeitpunkt (kein Blick in die Zukunft).
"""

from __future__ import annotations

import numpy as np
import pandas as pd


def sma(s: pd.Series, n: int) -> pd.Series:
    return s.rolling(n, min_periods=n).mean()


def ema(s: pd.Series, n: int) -> pd.Series:
    return s.ewm(span=n, adjust=False, min_periods=n).mean()


def _wilder(s: pd.Series, n: int) -> pd.Series:
    """Wilder-Glättung: Startwert = einfacher Mittelwert der ersten n Werte, danach rekursiv."""
    werte = s.to_numpy(dtype=float)
    erg = np.full(len(werte), np.nan)
    gueltig = np.flatnonzero(~np.isnan(werte))
    if len(gueltig) < n:
        return pd.Series(erg, index=s.index)
    start = gueltig[0] + n - 1
    erg[start] = werte[gueltig[0]:start + 1].mean()
    for i in range(start + 1, len(werte)):
        erg[i] = erg[i - 1] + (werte[i] - erg[i - 1]) / n
    return pd.Series(erg, index=s.index)


def rsi(close: pd.Series, n: int = 14) -> pd.Series:
    diff = close.diff()
    gewinn = _wilder(diff.clip(lower=0), n)
    verlust = _wilder(-diff.clip(upper=0), n)
    rs = gewinn / verlust.replace(0, np.nan)
    erg = 100 - 100 / (1 + rs)
    return erg.where(verlust != 0, 100.0).where(gewinn.notna())


def macd(close: pd.Series, schnell: int = 12, langsam: int = 26, signal: int = 9) -> pd.DataFrame:
    linie = ema(close, schnell) - ema(close, langsam)
    sig = linie.ewm(span=signal, adjust=False, min_periods=signal).mean()
    return pd.DataFrame({"macd": linie, "signal": sig, "histogramm": linie - sig})


def true_range(df: pd.DataFrame) -> pd.Series:
    vorher = df["close"].shift(1)
    return pd.concat(
        [df["high"] - df["low"], (df["high"] - vorher).abs(), (df["low"] - vorher).abs()], axis=1
    ).max(axis=1)


def atr(df: pd.DataFrame, n: int = 14) -> pd.Series:
    return _wilder(true_range(df), n)


def vwap(intraday: pd.DataFrame) -> pd.Series:
    """Sitzungs-VWAP, täglich neu gestartet (Index: tz-aware Zeitstempel)."""
    typisch = (intraday["high"] + intraday["low"] + intraday["close"]) / 3
    tag = intraday.index.date
    pv = (typisch * intraday["volume"]).groupby(tag).cumsum()
    vol = intraday["volume"].groupby(tag).cumsum()
    return pv / vol.replace(0, np.nan)


def relatives_volumen(volume: pd.Series, n: int = 20) -> pd.Series:
    """Volumen im Verhältnis zum Durchschnitt der n VORHERIGEN Tage."""
    return volume / volume.shift(1).rolling(n, min_periods=n).mean()


def relative_staerke(close: pd.Series, benchmark: pd.Series, n: int = 20) -> float | None:
    """Renditedifferenz über n Perioden in Prozentpunkten (Aktie minus Benchmark)."""
    gemeinsam = pd.concat([close, benchmark], axis=1, join="inner").dropna()
    if len(gemeinsam) <= n:
        return None
    a, b = gemeinsam.iloc[:, 0], gemeinsam.iloc[:, 1]
    return float((a.iloc[-1] / a.iloc[-1 - n] - 1 - (b.iloc[-1] / b.iloc[-1 - n] - 1)) * 100)


def pivots(df: pd.DataFrame, fenster: int = 3) -> tuple[list[float], list[float]]:
    """Bestätigte Umkehrpunkte (Hochs, Tiefs): Extremum mit `fenster` Kerzen auf beiden Seiten."""
    hochs, tiefs = [], []
    h, l = df["high"].to_numpy(), df["low"].to_numpy()
    for i in range(fenster, len(df) - fenster):
        bereich = slice(i - fenster, i + fenster + 1)
        if h[i] == h[bereich].max():
            hochs.append(float(h[i]))
        if l[i] == l[bereich].min():
            tiefs.append(float(l[i]))
    return hochs, tiefs


def unterstuetzung_widerstand(df: pd.DataFrame, kurs: float, fenster: int = 3) -> tuple[float | None, float | None]:
    """Nächstgelegene bestätigte Unterstützung unter und Widerstand über dem Kurs."""
    hochs, tiefs = pivots(df, fenster)
    unter = [x for x in tiefs + hochs if x < kurs]
    ueber = [x for x in hochs + tiefs if x > kurs]
    return (max(unter) if unter else None, min(ueber) if ueber else None)


def trendstruktur(df: pd.DataFrame) -> str:
    c = df["close"]
    s50, s200 = sma(c, 50), sma(c, 200)
    if len(df) < 210 or pd.isna(s200.iloc[-1]):
        return "unbekannt (zu wenig Historie)"
    steigend = s50.iloc[-1] > s50.iloc[-11]
    if c.iloc[-1] > s50.iloc[-1] > s200.iloc[-1] and steigend:
        return "Aufwärtstrend"
    if c.iloc[-1] < s50.iloc[-1] < s200.iloc[-1] and not steigend:
        return "Abwärtstrend"
    return "Seitwärts / uneinheitlich"


def kerzenmuster(df: pd.DataFrame) -> list[str]:
    """Wenige, klar definierte Muster der letzten Kerze. Kein eigenständiges Signal."""
    if len(df) < 2:
        return []
    o, h, l, c = (df[k].iloc[-1] for k in ("open", "high", "low", "close"))
    po, pc = df["open"].iloc[-2], df["close"].iloc[-2]
    spanne = h - l
    if spanne <= 0:
        return []
    koerper = abs(c - o)
    muster = []
    if koerper <= 0.1 * spanne:
        muster.append("Doji")
    if c > o and pc < po and c >= po and o <= pc:
        muster.append("Bullish Engulfing")
    if c < o and pc > po and c <= po and o >= pc:
        muster.append("Bearish Engulfing")
    unterer_docht = min(o, c) - l
    oberer_docht = h - max(o, c)
    if koerper > 0 and unterer_docht >= 2 * koerper and oberer_docht <= 0.3 * koerper:
        muster.append("Hammer")
    if koerper > 0 and oberer_docht >= 2 * koerper and unterer_docht <= 0.3 * koerper:
        muster.append("Shooting Star")
    return muster


def resample_ohlcv(df: pd.DataFrame, regel: str) -> pd.DataFrame:
    """Fasst Intraday-Kerzen zusammen (z. B. '4h'); Start an der Sitzungseröffnung (9:30 ET)."""
    agg = {"open": "first", "high": "max", "low": "min", "close": "last", "volume": "sum"}
    return df.resample(regel, origin="start_day", offset="9h30min").agg(agg).dropna(subset=["close"])


def kennzahlen_tag(df: pd.DataFrame) -> dict:
    """Zusammenfassung der Tagesindikatoren der letzten abgeschlossenen Kerze."""
    c = df["close"]
    m = macd(c)
    a = atr(df)
    rv = relatives_volumen(df["volume"])
    werte = {
        "kurs": float(c.iloc[-1]),
        "datum": df.index[-1],
        "sma20": sma(c, 20).iloc[-1],
        "sma50": sma(c, 50).iloc[-1],
        "sma100": sma(c, 100).iloc[-1],
        "sma200": sma(c, 200).iloc[-1],
        "ema9": ema(c, 9).iloc[-1],
        "ema21": ema(c, 21).iloc[-1],
        "rsi14": rsi(c).iloc[-1],
        "macd": m["macd"].iloc[-1],
        "macd_signal": m["signal"].iloc[-1],
        "macd_hist": m["histogramm"].iloc[-1],
        "atr14": a.iloc[-1],
        "atr_pct": a.iloc[-1] / c.iloc[-1] * 100,
        "rvol": rv.iloc[-1],
        "dollarvolumen_20": float((c * df["volume"]).tail(20).mean()),
        "hoch20": float(df["high"].iloc[-21:-1].max()) if len(df) > 21 else None,
        "hoch55": float(df["high"].iloc[-56:-1].max()) if len(df) > 56 else None,
        "tief20": float(df["low"].iloc[-21:-1].min()) if len(df) > 21 else None,
        "tief55": float(df["low"].iloc[-56:-1].min()) if len(df) > 56 else None,
        "vortageshoch": float(df["high"].iloc[-1]),
        "vortagestief": float(df["low"].iloc[-1]),
        "trend": trendstruktur(df),
        "kerzen": kerzenmuster(df),
    }
    return {k: (float(v) if isinstance(v, (np.floating,)) else v) for k, v in werte.items()}
