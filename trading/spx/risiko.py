"""Risiko- und Positionsgrößenmodul. Wird vor jeder Handelsidee ausgeführt.

Grundsätze: Positionsgröße folgt aus dem erlaubten Geldrisiko und dem Stop-Abstand,
Kosten werden eingerechnet, kein Hebel, keine Verbilligung, kein Martingale.
Ein Stop garantiert bei Kurslücken KEINEN maximalen Verlust.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
import pandas as pd


def _de(x: float, nachkomma: int = 2) -> str:
    return f"{x:.{nachkomma}f}".replace(".", ",")


@dataclass(frozen=True)
class Kostenmodell:
    modell: str = "pro_aktie"
    gebuehr_pro_aktie_usd: float = 0.005
    min_gebuehr_usd: float = 1.0
    max_gebuehr_pct_ordervolumen: float = 1.0
    gebuehr_fix_eur: float = 0.0
    spread_bps: float = 3
    slippage_bps: float = 5
    fx_kosten_bps: float = 2

    @classmethod
    def aus_config(cls, cfg: dict) -> "Kostenmodell":
        k = cfg["kosten"]
        return cls(**{f: k[f] for f in cls.__dataclass_fields__ if f in k})

    def gebuehr_usd(self, stueck: int, kurs: float, eurusd: float) -> float:
        """Ordergebühr für EINE Seite in USD."""
        if self.modell == "fix":
            return self.gebuehr_fix_eur * eurusd
        roh = max(self.min_gebuehr_usd, stueck * self.gebuehr_pro_aktie_usd)
        deckel = stueck * kurs * self.max_gebuehr_pct_ordervolumen / 100
        return min(roh, deckel) + self.gebuehr_fix_eur * eurusd

    def markt_kosten_je_aktie(self, kurs: float, stop_ausfuehrung: bool = False) -> float:
        """Halber Spread + Slippage + FX-Kosten für eine Seite, in USD je Aktie."""
        slip = self.slippage_bps * (2 if stop_ausfuehrung else 1)
        return kurs * (self.spread_bps / 2 + slip + self.fx_kosten_bps) / 10_000

    def rundreise_usd(self, stueck: int, einstieg: float, ausstieg: float, eurusd: float,
                      stop_ausfuehrung: bool = False) -> float:
        return (
            self.gebuehr_usd(stueck, einstieg, eurusd)
            + self.gebuehr_usd(stueck, ausstieg, eurusd)
            + stueck * (self.markt_kosten_je_aktie(einstieg) + self.markt_kosten_je_aktie(ausstieg, stop_ausfuehrung))
        )


@dataclass
class Positionsplan:
    machbar: bool
    grund: str
    richtung: str
    einstieg: float
    stop: float
    ziel1: float | None
    ziel2: float | None = None
    stueck: int = 0
    positionswert_eur: float = 0.0
    verlust_am_stop_eur: float = 0.0
    kosten_rundreise_eur: float = 0.0
    gewinn_ziel1_eur: float = 0.0
    crv_brutto: float | None = None
    crv_netto: float | None = None
    risiko_budget_eur: float = 0.0
    kategorie: str = ""
    hinweise: list[str] = field(default_factory=list)


def positionsgroesse(
    *,
    richtung: str,
    einstieg: float,
    stop: float,
    ziel1: float | None,
    ziel2: float | None = None,
    kapital_eur: float,
    risiko_pct: float,
    eurusd: float,
    kosten: Kostenmodell,
    max_positionswert_pct: float = 25,
    min_crv: float = 2.0,
    restbudget_eur: float | None = None,
) -> Positionsplan:
    """Berechnet Stückzahl, Verlust am Stop (inkl. Kosten) und Netto-CRV.

    `eurusd` ist der Kurs USD je 1 EUR (EZB-Notation, z. B. 1.08).
    """
    vorzeichen = 1 if richtung == "long" else -1
    plan = Positionsplan(False, "", richtung, einstieg, stop, ziel1, ziel2)
    abstand = (einstieg - stop) * vorzeichen
    if abstand <= 0:
        plan.grund = plan.kategorie = "Stop liegt auf der falschen Seite des Einstiegs"
        return plan
    budget = kapital_eur * risiko_pct / 100
    if restbudget_eur is not None and restbudget_eur < budget:
        budget = max(restbudget_eur, 0.0)
        plan.hinweise.append(f"Risikobudget durch Tages-/Gesamtlimit auf {budget:.2f} € begrenzt")
    plan.risiko_budget_eur = budget
    if budget <= 0:
        plan.grund = plan.kategorie = "Kein Risikobudget mehr frei (Tagesverlust- oder Gesamtrisikolimit erreicht)"
        return plan

    def verlust_eur(n: int) -> float:
        return (n * abstand + kosten.rundreise_usd(n, einstieg, stop, eurusd, stop_ausfuehrung=True)) / eurusd

    max_wert_usd = kapital_eur * eurusd * max_positionswert_pct / 100
    nach_risiko, nach_wert = budget * eurusd / abstand, max_wert_usd / einstieg
    n = int(min(nach_risiko, nach_wert))
    while n > 0 and verlust_eur(n) > budget:
        n -= 1
    if n < 1:
        plan.kategorie = "Risikobudget reicht nicht für 1 Aktie"
        plan.grund = (
            f"Risikobudget {_de(budget)} € reicht nicht für 1 Aktie "
            f"(Stop-Abstand {_de(abstand)} USD zzgl. Kosten)"
        )
        return plan
    if nach_wert < nach_risiko:
        plan.hinweise.append(f"Stückzahl durch maximalen Positionswert ({max_positionswert_pct:g} % des Kapitals) begrenzt")

    plan.stueck = n
    plan.positionswert_eur = n * einstieg / eurusd
    plan.verlust_am_stop_eur = verlust_eur(n)
    if ziel1 is not None:
        chance = (ziel1 - einstieg) * vorzeichen
        if chance <= 0:
            plan.grund = plan.kategorie = "Kursziel liegt nicht in Handelsrichtung"
            return plan
        kosten_ziel = kosten.rundreise_usd(n, einstieg, ziel1, eurusd)
        plan.kosten_rundreise_eur = kosten_ziel / eurusd
        plan.gewinn_ziel1_eur = (n * chance - kosten_ziel) / eurusd
        plan.crv_brutto = chance / abstand
        plan.crv_netto = plan.gewinn_ziel1_eur / plan.verlust_am_stop_eur
        if plan.crv_netto < min_crv:
            plan.kategorie = "Chance-Risiko nach Kosten zu niedrig"
            plan.grund = f"Chance-Risiko nach Kosten {_de(plan.crv_netto)} < Mindestwert {_de(min_crv, 1)}"
            return plan
    else:
        plan.grund = plan.kategorie = "Kein Kursziel bestimmbar"
        return plan
    plan.machbar = True
    plan.grund = "Risikoregeln erfüllt"
    return plan


def gap_verlust_eur(plan: Positionsplan, gap_atr: float, atr: float, eurusd: float) -> float:
    """Verlust, wenn der Kurs `gap_atr` ATR jenseits des Stops eröffnet (Übernacht-/Wochenendrisiko)."""
    return plan.verlust_am_stop_eur + plan.stueck * gap_atr * atr / eurusd


@dataclass
class Risikostatus:
    kapital_eur: float
    tagesergebnis_eur: float
    offenes_risiko_eur: float
    tageslimit_eur: float
    gesamtlimit_eur: float

    @property
    def abstand_tageslimit_eur(self) -> float:
        # Realisierter Verlust plus offenes Risiko zählen gegen das Tageslimit.
        return self.tageslimit_eur + min(self.tagesergebnis_eur, 0) - self.offenes_risiko_eur

    @property
    def restbudget_eur(self) -> float:
        return max(0.0, min(self.abstand_tageslimit_eur, self.gesamtlimit_eur - self.offenes_risiko_eur))

    @property
    def gesperrt(self) -> bool:
        return self.tagesergebnis_eur <= -self.tageslimit_eur or self.restbudget_eur <= 0


def risikostatus(cfg: dict, tagesergebnis_eur: float = 0.0, offenes_risiko_eur: float = 0.0) -> Risikostatus:
    kapital = cfg["konto"]["kapital_eur"]
    r = cfg["risiko"]
    return Risikostatus(
        kapital_eur=kapital,
        tagesergebnis_eur=tagesergebnis_eur,
        offenes_risiko_eur=offenes_risiko_eur,
        tageslimit_eur=kapital * r["tagesverlust_limit_pct"] / 100,
        gesamtlimit_eur=kapital * r["max_offenes_risiko_pct"] / 100,
    )


def korrelationen(renditen: pd.DataFrame, schwelle: float = 0.7) -> list[tuple[str, str, float]]:
    """Paare mit Korrelation der Tagesrenditen (60 Tage) oberhalb der Schwelle."""
    if renditen.shape[1] < 2:
        return []
    k = renditen.tail(60).corr()
    paare = []
    spalten = list(k.columns)
    for i, a in enumerate(spalten):
        for b in spalten[i + 1:]:
            wert = k.loc[a, b]
            if not np.isnan(wert) and wert >= schwelle:
                paare.append((a, b, float(wert)))
    return sorted(paare, key=lambda x: -x[2])
