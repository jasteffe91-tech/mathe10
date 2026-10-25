from datetime import date, datetime, timedelta

import numpy as np
import pandas as pd
import pytest

from spx import indikatoren as ind
from spx import setups
from spx.kalender import ET, UTC
from spx.nachrichten import Meldung
from spx.risiko import Kostenmodell
from spx.termine import Termine


def pullback_kerzen(n=260):
    i = np.arange(n)
    close = 100 + 0.3 * i + np.sin(i / 3) * 2
    close[-3:] = close[-4] - np.array([0.5, 1.0, 1.4])  # Rücksetzer bis an die EMA21/SMA20
    tage = pd.bdate_range(end="2026-10-22", periods=n).date
    vol = np.r_[np.full(n - 3, 5e6), np.full(3, 3e6)]
    return pd.DataFrame({"open": close + 0.2, "high": close + 1.0, "low": close - 1.0, "close": close, "volume": vol},
                        index=tage)


def kontext(cfg, df, umfeld="uneinheitlich", termine=None):
    heute = date(2026, 10, 23)
    voraus = list(pd.bdate_range(heute, periods=15).date)
    return setups.Kontext(
        cfg=cfg, eurusd=1.10, kosten=Kostenmodell.aus_config(cfg), restbudget_eur=100.0, heute=heute,
        benchmark=df["close"] * 0.5, sektoren={}, umfeld=umfeld,
        termine=termine or Termine(fomc=[(date(2026, 10, 27), date(2026, 10, 28))]),
        handelstage_voraus=voraus, berlin_zeit=lambda hhmm: hhmm,
        vortag_schluss=datetime(2026, 10, 22, 16, 0, tzinfo=ET).astimezone(UTC),
    )


def test_pullback_setup_regeln(cfg):
    df = pullback_kerzen()
    k = ind.kennzahlen_tag(df)
    ss = setups.swing_setups("ACME", "ACME CORP", "Industrials", df, k, None, [], kontext(cfg, df))
    pb = [s for s in ss if s.muster == "Pullback im Aufwärtstrend"]
    assert pb, "Pullback-Setup erwartet"
    s = pb[0]
    assert s.richtung == "long" and s.strategie == setups.SWING
    assert s.stop < s.kurs < s.einstieg
    assert s.einstieg == pytest.approx(k["vortageshoch"] + 0.05 * k["atr14"], abs=0.01)
    assert s.stop == pytest.approx(df["low"].tail(3).min() - 0.25 * k["atr14"], abs=0.01)
    # ohne Termindaten bleibt das Quartalszahlen-Kriterium ungeprüft
    assert ("keine Quartalszahlen in den nächsten 10 Handelstagen", None) in s.kriterien
    assert any("ungeprüft" in e for e in s.ereignisrisiken)
    assert any("FOMC" in e for e in s.ereignisrisiken)


def test_entscheidung_ohne_validierung_hoechstens_watchlist(cfg):
    df = pullback_kerzen()
    s = setups.swing_setups("ACME", "ACME CORP", None, df, ind.kennzahlen_tag(df), None, [], kontext(cfg, df))[0]
    s.plan.machbar = True
    s.kriterien = [(n, True) for n, _ in s.kriterien]
    assert setups.entscheiden(s, cfg, gesperrt=False) == "WATCHLIST"
    assert setups.entscheiden(s, cfg, gesperrt=True) == "NO TRADE"
    cfg["validierung"]["strategien_validiert"] = True
    assert setups.entscheiden(s, cfg, gesperrt=False) == "LONG"
    s.plan.machbar = False
    assert setups.entscheiden(s, cfg, gesperrt=False) == "NO TRADE"


def test_quartalszahlen_in_haltedauer(cfg):
    df = pullback_kerzen()
    t = Termine(quartalszahlen={"ACME": [(date(2026, 10, 28), "nach US-Schluss")]}, quartalszahlen_quelle="Test")
    s = setups.swing_setups("ACME", "ACME CORP", None, df, ind.kennzahlen_tag(df), None, [], kontext(cfg, df, termine=t))[0]
    assert ("keine Quartalszahlen in den nächsten 10 Handelstagen", False) in s.kriterien
    assert any("28.10.2026" in e for e in s.ereignisrisiken)


def _vorboerse(kurs, volumen=50_000.0):
    zeit = datetime(2026, 10, 23, 7, 55, tzinfo=ET)
    return setups.Vorboerse(letzter=kurs, hoch=kurs + 0.3, tief=kurs - 0.5, volumen=volumen, zeit_et=zeit, alter_min=5)


def test_day_setup_gap_mit_katalysator(cfg):
    df = pullback_kerzen()
    k = ind.kennzahlen_tag(df)
    neu = Meldung("ACME beats estimates", "u", "X", "medien", datetime(2026, 10, 23, 11, 0, tzinfo=UTC))
    alt = Meldung("ACME old news", "u2", "X", "medien", datetime(2026, 10, 22, 15, 0, tzinfo=UTC))
    ss, info = setups.day_setups("ACME", "ACME CORP", None, df, k, _vorboerse(k["kurs"] * 1.03), [alt, neu],
                                 kontext(cfg, df))
    assert info["gap_pct"] == pytest.approx(3.0, abs=0.01)
    s = ss[0]
    assert s.vorlaeufig and s.strategie == setups.DAY
    assert ("Katalysator (aktuelle Meldung) vorhanden", True) in s.kriterien
    assert s.meldungen[0] is neu
    assert setups.entscheiden(s, cfg, gesperrt=False) in ("WATCHLIST", "NO TRADE")
    cfg["validierung"]["strategien_validiert"] = True
    assert setups.entscheiden(s, cfg, gesperrt=False) != "LONG"  # vorbörslich nie bestätigt


def test_day_setup_alte_meldung_kein_katalysator_und_volumen_unbekannt(cfg):
    df = pullback_kerzen()
    k = ind.kennzahlen_tag(df)
    alt = Meldung("ACME old news", "u2", "X", "medien", datetime(2026, 10, 22, 15, 0, tzinfo=UTC))
    s = setups.day_setups("ACME", "ACME CORP", None, df, k, _vorboerse(k["kurs"] * 1.03, 0.0), [alt], kontext(cfg, df))[0][0]
    assert ("Katalysator (aktuelle Meldung) vorhanden", False) in s.kriterien
    assert ("vorbörsliches Volumen ≥ 1,5 % des Tagesdurchschnitts", None) in s.kriterien


def test_kein_gap_kein_daysetup_und_short_gesperrt(cfg):
    df = pullback_kerzen()
    k = ind.kennzahlen_tag(df)
    assert setups.day_setups("ACME", "A", None, df, k, _vorboerse(k["kurs"] * 1.002), [], kontext(cfg, df))[0] == []
    assert setups.day_setups("ACME", "A", None, df, k, _vorboerse(k["kurs"] * 0.95), [], kontext(cfg, df))[0] == []


def test_vorboerse_ignoriert_kerzen_nach_jetzt():
    idx = pd.date_range("2026-10-23 07:00", "2026-10-23 09:25", freq="5min", tz=ET)
    df = pd.DataFrame({"open": 1.0, "high": 1.0, "low": 1.0, "close": np.arange(len(idx), dtype=float),
                       "volume": 0.0, "phase": "vorboerse"}, index=idx)
    vb = setups.vorboerse_auswerten(df, date(2026, 10, 23), datetime(2026, 10, 23, 8, 0, tzinfo=ET))
    assert vb.zeit_et.hour == 8 and vb.zeit_et.minute == 0
