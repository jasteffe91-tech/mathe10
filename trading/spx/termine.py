"""Ereignistermine: Quartalszahlen (Finnhub, optional) und FOMC-Sitzungen (Fed-Kalender)."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from datetime import date, timedelta

from .daten.http import holen, sitzung

FINNHUB_URL = "https://finnhub.io/api/v1/calendar/earnings"
ZEITPUNKT = {"bmo": "vor US-Eröffnung", "amc": "nach US-Schluss", "dmh": "während des Handels"}


@dataclass
class Termine:
    quartalszahlen: dict[str, list[tuple[date, str]]] = field(default_factory=dict)
    quartalszahlen_quelle: str | None = None
    fomc: list[tuple[date, date]] = field(default_factory=list)
    fehler: list[str] = field(default_factory=list)

    def naechste_zahlen(self, ticker: str, ab: date) -> tuple[date, str] | None:
        kuenftig = [x for x in self.quartalszahlen.get(ticker, []) if x[0] >= ab]
        return min(kuenftig) if kuenftig else None

    def fomc_im_zeitraum(self, von: date, bis: date) -> list[tuple[date, date]]:
        return [f for f in self.fomc if f[1] >= von and f[0] <= bis]


def laden(cfg: dict, heute: date, tage: int = 21) -> Termine:
    t = Termine(fomc=[(date.fromisoformat(str(a)), date.fromisoformat(str(b))) for a, b in cfg["makro"]["fomc"]])
    if t.fomc and max(b for _, b in t.fomc) < heute + timedelta(days=60):
        t.fehler.append("FOMC-Termine in der Konfiguration laufen bald aus – Fed-Kalender nachtragen")
    key = os.environ.get("FINNHUB_API_KEY")
    if not key:
        t.fehler.append("Kein FINNHUB_API_KEY: Quartalszahlen-Termine UNGEPRÜFT")
        return t
    try:
        r = holen(sitzung(), FINNHUB_URL, params={"from": heute.isoformat(),
                                                  "to": (heute + timedelta(days=tage)).isoformat(), "token": key})
        for e in r.json().get("earningsCalendar", []):
            t.quartalszahlen.setdefault(e["symbol"].replace("-", "."), []).append(
                (date.fromisoformat(e["date"]), ZEITPUNKT.get(e.get("hour") or "", "Zeitpunkt offen")))
        t.quartalszahlen_quelle = "Finnhub Earnings Calendar"
    except Exception as e:  # noqa: BLE001
        t.fehler.append(f"Finnhub-Quartalszahlen: {e} – Termine UNGEPRÜFT")
    return t
