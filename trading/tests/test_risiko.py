import pandas as pd
import pytest

from spx.risiko import Kostenmodell, gap_verlust_eur, korrelationen, positionsgroesse, risikostatus

K = Kostenmodell()


def plan(**kw):
    basis = dict(richtung="long", einstieg=100.0, stop=98.0, ziel1=106.0, kapital_eur=10_000, risiko_pct=0.5,
                 eurusd=1.10, kosten=K, max_positionswert_pct=25, min_crv=2.0)
    basis.update(kw)
    return positionsgroesse(**basis)


def test_positionsgroesse_handrechnung():
    p = plan()
    # Budget 50 €; je Aktie 2 USD Abstand + 0,085 (Einstieg) + 0,1323 (Stop) USD Kosten, 2 × 1 USD Mindestgebühr
    assert p.machbar
    assert p.stueck == 23
    assert p.verlust_am_stop_eur == pytest.approx((23 * 2 + 2 + 23 * (0.085 + 0.1323)) / 1.10, rel=1e-6)
    assert p.verlust_am_stop_eur <= 50


def test_verlust_inklusive_kosten_nie_ueber_budget():
    for stop in (99.5, 97, 90):
        p = plan(stop=stop, ziel1=100 + 3 * (100 - stop))
        assert p.verlust_am_stop_eur <= p.risiko_budget_eur + 1e-9


def test_crv_nach_kosten_unter_mindestwert():
    p = plan(ziel1=103.0)  # brutto 1,5 R
    assert not p.machbar and "Chance-Risiko" in p.grund
    assert p.crv_netto < p.crv_brutto


def test_falsche_stopseite_und_ziel():
    assert not plan(stop=101).machbar
    assert not plan(ziel1=99).machbar


def test_short_spiegelbildlich():
    p = plan(richtung="short", einstieg=100, stop=102, ziel1=94)
    assert p.machbar and p.stueck == 23


def test_positionswert_deckel():
    p = plan(stop=99.9, ziel1=101)  # sehr enger Stop -> Deckel greift
    assert p.positionswert_eur <= 10_000 * 0.25 + 1e-6
    assert any("maximalen Positionswert" in h for h in p.hinweise)


def test_restbudget_und_limit(cfg):
    assert not plan(restbudget_eur=0).machbar
    klein = plan(restbudget_eur=20)
    assert klein.verlust_am_stop_eur <= 20
    st = risikostatus(cfg, tagesergebnis_eur=-100)
    assert st.gesperrt
    st2 = risikostatus(cfg, tagesergebnis_eur=-40, offenes_risiko_eur=30)
    assert st2.abstand_tageslimit_eur == pytest.approx(30)
    assert not st2.gesperrt


def test_budget_zu_klein_fuer_eine_aktie():
    p = plan(einstieg=1000, stop=900, ziel1=1300, kapital_eur=1000)
    assert not p.machbar and p.kategorie == "Risikobudget reicht nicht für 1 Aktie"


def test_fixkostenmodell():
    k = Kostenmodell(modell="fix", gebuehr_fix_eur=1.0)
    assert k.gebuehr_usd(10, 100, 1.1) == pytest.approx(1.1)


def test_gap_verlust_groesser_als_stopverlust():
    p = plan()
    assert gap_verlust_eur(p, 1.0, 2.0, 1.1) > p.verlust_am_stop_eur


def test_korrelationen():
    a = pd.Series(range(70), dtype=float).pct_change().fillna(0) + 0.01
    ren = pd.DataFrame({"A": a, "B": a * 2, "C": a[::-1].to_numpy()})
    paare = korrelationen(ren, 0.7)
    assert ("A", "B") in [(x, y) for x, y, _ in paare]
