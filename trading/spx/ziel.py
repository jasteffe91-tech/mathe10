"""Realitätsprüfung des Tagesziels (200–300 €) gegen Kapital und Risikoregeln.

Ohne Backtest- oder Paper-Trading-Ergebnisse beruhen Trefferquote und CRV auf ANNAHMEN.
"""

from __future__ import annotations

import math
from dataclasses import dataclass


def _de(x: float, nachkomma: int = 2) -> str:
    return f"{x:.{nachkomma}f}".replace(".", ",")


@dataclass
class Zielpruefung:
    kapital_eur: float
    ziel_eur: float
    tagesrendite_pct: float
    jahresrendite_einfach_pct: float
    risiko_je_trade_eur: float
    erwartung_je_trade_eur: float
    trades_pro_tag_noetig: float | None
    kapital_noetig_1_trade_eur: float | None
    tageslimit_eur: float
    bewertung: str
    annahmen: str


def pruefen(cfg: dict, kosten_je_trade_r: float = 0.1, kapital_eur: float | None = None) -> Zielpruefung:
    kapital = kapital_eur if kapital_eur is not None else cfg["konto"]["kapital_eur"]
    z = cfg["ziel"]
    ziel = (z["tagesziel_eur_min"] + z["tagesziel_eur_max"]) / 2
    p, crv = z["annahme_trefferquote"], z["annahme_crv"]
    r_pct = cfg["risiko"]["risiko_je_trade_pct"]
    r_eur = kapital * r_pct / 100
    erwartung_r = p * crv - (1 - p) - kosten_je_trade_r      # in R je Trade
    erwartung = erwartung_r * r_eur
    trades = ziel / erwartung if erwartung > 0 else None
    kap_1 = ziel / (erwartung_r * r_pct / 100) if erwartung_r > 0 else None
    tagesrendite = ziel / kapital * 100
    limit = kapital * cfg["risiko"]["tagesverlust_limit_pct"] / 100
    if erwartung <= 0:
        bewertung = "Unter den Annahmen ist der Erwartungswert je Trade nicht positiv – Ziel nicht erreichbar."
    elif tagesrendite > 1:
        bewertung = (
            f"Das Ziel entspricht {_de(tagesrendite)} % pro Tag. Das ist mehr als das Tagesverlustlimit "
            f"({_de(cfg['risiko']['tagesverlust_limit_pct'], 1)} %) und nur mit unverhältnismäßig hohem Risiko "
            f"oder deutlich mehr Kapital erreichbar. Nicht realistisch mit den aktuellen Regeln."
        )
    elif trades and trades > 3:
        bewertung = (f"Rechnerisch wären ~{math.ceil(trades)} Trades pro Tag mit positivem Erwartungswert nötig. "
                     "Das ist mit validierten, selektiven Setups unwahrscheinlich.")
    else:
        bewertung = ("Rechnerisch nicht ausgeschlossen – muss durch Backtests und Paper-Trading belegt werden. "
                     "Tage ohne Trade und Verlustserien senken den Durchschnitt.")
    return Zielpruefung(
        kapital_eur=kapital, ziel_eur=ziel, tagesrendite_pct=tagesrendite,
        jahresrendite_einfach_pct=tagesrendite * z["handelstage_jahr"], risiko_je_trade_eur=r_eur,
        erwartung_je_trade_eur=erwartung, trades_pro_tag_noetig=trades, kapital_noetig_1_trade_eur=kap_1,
        tageslimit_eur=limit, bewertung=bewertung,
        annahmen=(f"ANNAHMEN (nicht validiert): Trefferquote {p * 100:.0f} %, CRV {_de(crv, 1)} : 1, Kosten "
                  f"{_de(kosten_je_trade_r, 1)} R je Trade, Risiko {_de(r_pct)} % je Trade, "
                  f"{z['handelstage_jahr']} Handelstage"),
    )
