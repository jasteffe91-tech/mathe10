"""Ende-zu-Ende-Test ohne Netzwerk: alle Datenquellen werden durch synthetische Daten ersetzt."""

from datetime import date, datetime

import numpy as np
import pandas as pd
import pytest

from spx import __main__ as cli
from spx import bericht, pipeline
from spx.daten import universum as uni
from spx.kalender import ET, UTC
from spx.nachrichten import NachrichtenLage
from tests.conftest import tageskerzen

TICKER = [f"T{i:02d}" for i in range(30)]


class FakeQuelle:
    name, offiziell = "Testdaten", False

    def tagesdaten(self, t, spanne="2y"):
        seed = abs(hash(t)) % 1000
        return tageskerzen(n=300, trend=0.25 if seed % 2 else -0.1, seed=seed, start=200)

    def intraday(self, t, intervall="5m", spanne="1d", vorboerse=True):
        if intervall == "60m":
            idx = pd.date_range("2026-09-23 09:30", periods=150, freq="60min", tz=ET)
            idx = idx[(idx.time >= pd.Timestamp("09:30").time()) & (idx.time < pd.Timestamp("16:00").time())]
            c = np.linspace(100, 110, len(idx))
            return pd.DataFrame({"open": c, "high": c + 1, "low": c - 1, "close": c, "volume": 1e5,
                                 "phase": "regulaer"}, index=idx)
        idx = pd.date_range("2026-10-22 15:00", "2026-10-23 08:00", freq="5min", tz=ET)
        basis = self.tagesdaten(t)["close"].iloc[-2] if not t.endswith("=F") else 7000.0
        faktor = 1.04 if t == "T01" else 1.0
        c = np.full(len(idx), basis * faktor)
        phase = ["vorboerse" if x.time() < pd.Timestamp("09:30").time() else "regulaer" for x in idx]
        return pd.DataFrame({"open": c, "high": c * 1.001, "low": c * 0.999, "close": c, "volume": 1000.0,
                             "phase": phase}, index=idx)


@pytest.fixture
def offline(monkeypatch, tmp_path):
    titel = pd.DataFrame({"ticker": TICKER, "name": [f"FIRMA {t}" for t in TICKER], "gewicht": 1.0,
                          "sektor": "Industrials", "branche": "x"})
    monkeypatch.setattr(pipeline.kurse, "kursquelle", lambda cfg: FakeQuelle())
    monkeypatch.setattr(pipeline.universum, "laden",
                        lambda cfg, d: uni.Universum(titel, date(2026, 10, 22), "Test", datetime.now(UTC)))
    monkeypatch.setattr(pipeline.markt, "ezb_eurusd", lambda: (1.10, date(2026, 10, 22)))
    monkeypatch.setattr(pipeline.markt, "fred_reihe", lambda s: (_ for _ in ()).throw(RuntimeError("offline")))
    monkeypatch.setattr(pipeline.nachrichten, "sammeln", lambda *a, **k: NachrichtenLage([], [], ["Test"]))
    monkeypatch.delenv("FINNHUB_API_KEY", raising=False)
    return tmp_path


def test_ende_zu_ende_bericht(cfg, offline):
    jetzt = datetime(2026, 10, 23, 8, 0, tzinfo=ET)
    lauf = pipeline.ausfuehren(cfg, jetzt, cache_dir=offline)
    assert lauf.abbruch is None
    assert lauf.statistik["mit_daten"] == len(TICKER)
    text = bericht.erstellen(lauf)
    for teil in ("## A. Marktüberblick", "## B. Top-Setups", "## C. Begründung", "## D. Risikoübersicht",
                 "## E. Abschließende Entscheidung", "Realitätsprüfung", "NICHT validiert"):
        assert teil in text
    assert "UNGEPRÜFT" in text  # fehlende Quartalszahlen-Quelle wird gemeldet
    assert not any(s.entscheidung in ("LONG", "SHORT") for s in lauf.setups)
    for s in lauf.setups:
        if s.entscheidung == "WATCHLIST":
            assert s.plan.verlust_am_stop_eur <= cfg["konto"]["kapital_eur"] * cfg["risiko"]["risiko_je_trade_pct"] / 100


def test_wochenende_kein_bericht(cfg, offline):
    lauf = pipeline.ausfuehren(cfg, datetime(2026, 10, 24, 8, 0, tzinfo=ET), cache_dir=offline)
    assert lauf.abbruch and "Wochenende" in lauf.abbruch
    assert "Kein Bericht" in bericht.erstellen(lauf)


def test_veraltete_daten_fuehren_zum_abbruch(cfg, offline):
    # Simulierter Montag: die Testdaten enden am Donnerstag -> veraltet
    lauf = pipeline.ausfuehren(cfg, datetime(2026, 10, 27, 8, 0, tzinfo=ET), cache_dir=offline)
    assert lauf.abbruch and "Datenlage unzureichend" in lauf.abbruch


def test_tageslimit_sperrt_neue_trades(cfg, offline):
    lauf = pipeline.ausfuehren(cfg, datetime(2026, 10, 23, 8, 0, tzinfo=ET), cache_dir=offline, tagesergebnis_eur=-100)
    assert lauf.risiko.gesperrt
    assert all(s.entscheidung == "NO TRADE" for s in lauf.setups)
    assert "Heute kein Trade" in bericht.erstellen(lauf)


def test_cli_cron_slot_ueberspringt(cfg, capsys, monkeypatch):
    class Fest(datetime):
        @classmethod
        def now(cls, tz=None):
            return datetime(2026, 12, 15, 12, 5, tzinfo=UTC)  # Winter: 12 UTC = 13 Uhr Berlin
    monkeypatch.setattr(cli, "datetime", Fest)
    assert cli.main(["bericht", "--cron", "0 12 * * 1-5"]) == 0
    assert "kein Lauf" in capsys.readouterr().out
