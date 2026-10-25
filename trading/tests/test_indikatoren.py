import numpy as np
import pandas as pd
import pytest

from spx import indikatoren as ind

WILDER = [44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.10, 45.42, 45.84, 46.08, 45.89, 46.03, 45.61, 46.28, 46.28, 46.00]


def test_rsi_nach_wilder_handrechnung():
    r = ind.rsi(pd.Series(WILDER))
    assert r.iloc[:14].isna().all()
    # Ø Gewinn 3,34/14, Ø Verlust 1,40/14 -> RSI 70,46; danach rekursiv 66,25
    assert r.iloc[14] == pytest.approx(70.46, abs=0.01)
    assert r.iloc[15] == pytest.approx(66.25, abs=0.01)


def test_rsi_nur_gewinne():
    assert ind.rsi(pd.Series(np.arange(1, 30, dtype=float))).iloc[-1] == 100


def test_sma_ema():
    s = pd.Series([1.0, 2, 3, 4, 5])
    assert ind.sma(s, 5).iloc[-1] == 3
    assert ind.ema(pd.Series([2.0] * 30), 9).iloc[-1] == pytest.approx(2.0)


def test_atr_konstante_spanne():
    n = 30
    df = pd.DataFrame({"open": [10.0] * n, "high": [11.0] * n, "low": [9.0] * n, "close": [10.0] * n, "volume": [1] * n})
    assert ind.atr(df).iloc[-1] == pytest.approx(2.0)


def test_vwap_startet_taeglich_neu():
    idx = pd.to_datetime(["2026-10-22 09:30", "2026-10-22 09:35", "2026-10-23 09:30"]).tz_localize("America/New_York")
    df = pd.DataFrame({"high": [10, 12, 20], "low": [10, 12, 20], "close": [10, 12, 20], "volume": [100, 300, 50]}, index=idx)
    v = ind.vwap(df)
    assert v.iloc[1] == pytest.approx((10 * 100 + 12 * 300) / 400)
    assert v.iloc[2] == 20


def test_relatives_volumen_ohne_heutigen_tag():
    vol = pd.Series([100.0] * 20 + [300.0])
    assert ind.relatives_volumen(vol).iloc[-1] == pytest.approx(3.0)


def test_pivots_und_widerstand():
    hoch = [1, 2, 3, 9, 3, 2, 1, 2, 3, 2, 1]
    df = pd.DataFrame({"high": hoch, "low": [h - 0.5 for h in hoch]}, dtype=float)
    unter, ueber = ind.unterstuetzung_widerstand(df, 5.0)
    assert ueber == 9


def test_trend_und_kennzahlen(kerzen):
    df = kerzen(trend=0.4)
    k = ind.kennzahlen_tag(df)
    assert k["trend"] == "Aufwärtstrend"
    assert k["sma200"] < k["sma50"] < k["kurs"] + 10
    assert k["hoch20"] <= df["high"].iloc[-21:-1].max()
    abw = ind.kennzahlen_tag(kerzen(trend=-0.4, start=300))
    assert abw["trend"] == "Abwärtstrend"


def test_resample_4h_beginnt_mit_eroeffnung():
    idx = pd.date_range("2026-10-22 09:30", "2026-10-22 15:30", freq="60min", tz="America/New_York")
    df = pd.DataFrame({"open": 1.0, "high": 2.0, "low": 0.5, "close": 1.5, "volume": 10.0}, index=idx)
    r = ind.resample_ohlcv(df, "4h")
    assert [t.strftime("%H:%M") for t in r.index] == ["09:30", "13:30"]
    assert r["volume"].tolist() == [40.0, 30.0]
