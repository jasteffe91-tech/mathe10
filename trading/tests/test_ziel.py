import pytest

from spx import ziel


def test_tagesziel_bei_10000_unrealistisch(cfg):
    z = ziel.pruefen(cfg)
    assert z.tagesrendite_pct == pytest.approx(2.5)
    # 0,45 × 2 − 0,55 − 0,1 = 0,25 R; R = 25 €
    assert z.erwartung_je_trade_eur == pytest.approx(6.25)
    assert z.trades_pro_tag_noetig == pytest.approx(40)
    assert "Nicht realistisch" in z.bewertung


def test_negativer_erwartungswert(cfg):
    cfg["ziel"]["annahme_trefferquote"] = 0.3
    z = ziel.pruefen(cfg)
    assert z.trades_pro_tag_noetig is None
    assert "nicht positiv" in z.bewertung
