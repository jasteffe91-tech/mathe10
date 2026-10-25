"""Kursquellen. Einheitliches Format: DataFrame mit open, high, low, close, volume.

- Tagesdaten: Index = Handelsdatum (datetime.date, US-Ostküste)
- Intraday: Index = tz-aware Zeitstempel in America/New_York, Spalte `phase`
  (vorboerse / regulaer / nachboerse)
"""

from __future__ import annotations

import os
from datetime import datetime, time, timedelta

import pandas as pd

from ..kalender import ET, UTC
from .http import DatenFehler, holen, sitzung

SPALTEN = ["open", "high", "low", "close", "volume"]


def _phase(index: pd.DatetimeIndex) -> list[str]:
    t = index.time
    return ["vorboerse" if x < time(9, 30) else "regulaer" if x < time(16, 0) else "nachboerse" for x in t]


class YahooQuelle:
    """Inoffizieller Yahoo-Finance-Chart-Endpunkt.

    Nur für Entwicklung und privaten Gebrauch. Keine Verfügbarkeitszusage, Nutzungsbedingungen
    von Yahoo beachten. Für den Dauerbetrieb eine lizenzierte Quelle (z. B. Alpaca) verwenden.
    """

    name = "Yahoo Finance (inoffiziell)"
    offiziell = False
    URL = "https://query1.finance.yahoo.com/v8/finance/chart/{sym}"

    def __init__(self):
        self.s = sitzung("Mozilla/5.0 (X11; Linux x86_64) spx-analyse/0.1")

    @staticmethod
    def symbol(ticker: str) -> str:
        return ticker.replace(".", "-")

    def _chart(self, ticker: str, **params) -> dict:
        r = holen(self.s, self.URL.format(sym=self.symbol(ticker)), params=params)
        daten = r.json().get("chart", {})
        if daten.get("error") or not daten.get("result"):
            raise DatenFehler(f"{ticker}: {daten.get('error')}")
        return daten["result"][0]

    @staticmethod
    def _rahmen(res: dict) -> pd.DataFrame:
        ts = res.get("timestamp") or []
        q = (res.get("indicators", {}).get("quote") or [{}])[0]
        df = pd.DataFrame({k: q.get(k, [None] * len(ts)) for k in SPALTEN},
                          index=pd.to_datetime(ts, unit="s", utc=True).tz_convert(ET))
        return df.dropna(subset=["open", "high", "low", "close"]).astype(float)

    def tagesdaten(self, ticker: str, spanne: str = "2y") -> pd.DataFrame:
        df = self._rahmen(self._chart(ticker, range=spanne, interval="1d"))
        df.index = df.index.date
        df = df[~df.index.duplicated(keep="last")]
        df.attrs["quelle"] = self.name
        return df

    def intraday(self, ticker: str, intervall: str = "15m", spanne: str = "5d",
                 vorboerse: bool = True) -> pd.DataFrame:
        res = self._chart(ticker, range=spanne, interval=intervall, includePrePost=str(vorboerse).lower())
        df = self._rahmen(res)
        df["phase"] = _phase(df.index)
        df.attrs["quelle"] = self.name
        df.attrs["abgerufen"] = datetime.now(UTC)
        return df


class AlpacaQuelle:
    """Alpaca Market Data API v2 (offiziell, kostenloser Zugang mit API-Schlüssel).

    Free-Plan: Echtzeit nur IEX-Feed (Volumen = Anteil der IEX, nicht Gesamtmarkt);
    historische Gesamtmarktdaten (SIP) mit mindestens 15 Minuten Verzögerung.
    """

    name = "Alpaca Market Data"
    offiziell = True
    URL = "https://data.alpaca.markets/v2/stocks/bars"

    def __init__(self, feed: str = "iex"):
        key, secret = os.environ.get("ALPACA_API_KEY_ID"), os.environ.get("ALPACA_API_SECRET_KEY")
        if not key or not secret:
            raise DatenFehler("ALPACA_API_KEY_ID / ALPACA_API_SECRET_KEY fehlen")
        self.s = sitzung()
        self.s.headers.update({"APCA-API-KEY-ID": key, "APCA-API-SECRET-KEY": secret})
        self.feed = feed
        self.name = f"Alpaca Market Data ({feed.upper()}-Feed)"

    def _bars(self, ticker: str, timeframe: str, start: datetime) -> pd.DataFrame:
        params = {"symbols": ticker, "timeframe": timeframe, "start": start.isoformat(),
                  "limit": 10000, "adjustment": "split", "feed": self.feed}
        zeilen = []
        while True:
            daten = holen(self.s, self.URL, params=params).json()
            zeilen += (daten.get("bars") or {}).get(ticker, [])
            token = daten.get("next_page_token")
            if not token:
                break
            params["page_token"] = token
        if not zeilen:
            raise DatenFehler(f"{ticker}: keine Kerzen von Alpaca")
        df = pd.DataFrame(zeilen)
        df.index = pd.to_datetime(df["t"], utc=True).dt.tz_convert(ET)
        df = df.rename(columns={"o": "open", "h": "high", "l": "low", "c": "close", "v": "volume"})
        return df[SPALTEN].astype(float)

    def tagesdaten(self, ticker: str, spanne: str = "2y") -> pd.DataFrame:
        jahre = int(spanne.rstrip("y")) if spanne.endswith("y") else 2
        df = self._bars(ticker, "1Day", datetime.now(UTC) - timedelta(days=366 * jahre))
        df.index = df.index.date
        df.attrs["quelle"] = self.name
        return df

    def intraday(self, ticker: str, intervall: str = "15m", spanne: str = "5d",
                 vorboerse: bool = True) -> pd.DataFrame:
        tf = {"5m": "5Min", "15m": "15Min", "60m": "1Hour", "1h": "1Hour"}[intervall]
        tage = int(spanne.rstrip("d")) if spanne.endswith("d") else 30
        df = self._bars(ticker, tf, datetime.now(UTC) - timedelta(days=tage + 3))
        df["phase"] = _phase(df.index)
        if not vorboerse:
            df = df[df["phase"] == "regulaer"]
        df.attrs["quelle"] = self.name
        df.attrs["abgerufen"] = datetime.now(UTC)
        return df


def kursquelle(cfg: dict):
    name = cfg["daten"]["kursquelle"]
    if name == "alpaca":
        return AlpacaQuelle(cfg["daten"].get("alpaca_feed", "iex"))
    if name == "yahoo":
        return YahooQuelle()
    raise ValueError(f"Unbekannte Kursquelle: {name}")
