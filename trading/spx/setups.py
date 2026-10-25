"""Regelbasierte Setups für Swing- und Daytrading.

Die Regeln sind bewusst einfach, vollständig dokumentiert und konfigurierbar. Sie sind NICHT
validiert, solange `validierung.strategien_validiert` false ist; dann wird höchstens WATCHLIST
ausgegeben. Kursziele sind Schätzungen, keine Vorhersagen.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime

import pandas as pd

from . import indikatoren as ind
from .nachrichten import Meldung
from .risiko import Kostenmodell, Positionsplan, positionsgroesse

def _d(x: float) -> str:
    """Kurs im deutschen Format."""
    return f"{x:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


SWING = "Swingtrading"
DAY = "Daytrading"


@dataclass
class Setup:
    ticker: str
    name: str
    sektor: str | None
    strategie: str
    muster: str
    richtung: str
    kurs: float
    kurs_zeit: str
    einstieg_bedingung: str
    einstieg: float
    stop: float
    ziel1: float | None
    ziel2: float | None
    ziel_herleitung: str
    invalidierung: str
    bestaetigung: list[str]
    verfall: list[str]
    kriterien: list[tuple[str, bool | None]]
    begruendung: list[str]
    gegenargumente: list[str] = field(default_factory=list)
    ereignisrisiken: list[str] = field(default_factory=list)
    meldungen: list[Meldung] = field(default_factory=list)
    plan: Positionsplan | None = None
    entscheidung: str = "WATCHLIST"
    vorlaeufig: bool = False
    atr: float = 0.0

    @property
    def erfuellt(self) -> tuple[int, int]:
        geprueft = [k for k in self.kriterien if k[1] is not None]
        return sum(1 for k in geprueft if k[1]), len(self.kriterien)

    @property
    def qualitaet(self) -> str:
        ja, n = self.erfuellt
        offen = sum(1 for k in self.kriterien if k[1] is None)
        stufe = "A" if ja >= n - 1 and offen == 0 else "B" if ja >= 0.7 * n else "C"
        zusatz = f", {offen} ungeprüft" if offen else ""
        return f"{stufe} ({ja}/{n} Kriterien{zusatz})"

    @property
    def katalysator(self) -> str:
        if self.meldungen:
            m = self.meldungen[0]
            return f"{m.art}: {m.titel[:70]}"
        return self.muster


def _sektor_etf(sektor: str | None) -> str | None:
    zuordnung = {
        "Information Technology": "XLK", "Financials": "XLF", "Health Care": "XLV",
        "Consumer Discretionary": "XLY", "Consumer Staples": "XLP", "Energy": "XLE",
        "Industrials": "XLI", "Materials": "XLB", "Utilities": "XLU", "Real Estate": "XLRE",
        "Communication Services": "XLC",
    }
    return zuordnung.get(sektor or "")


def mtf_trend(stunden: pd.DataFrame | None) -> dict[str, bool | None]:
    """Trendbestätigung auf 1h und 4h (EMA9 über/unter EMA21, nur reguläre Sitzung)."""
    if stunden is None or stunden.empty:
        return {"1h": None, "4h": None}
    reg = stunden[stunden["phase"] == "regulaer"] if "phase" in stunden else stunden
    erg: dict[str, bool | None] = {}
    for name, df in (("1h", reg), ("4h", ind.resample_ohlcv(reg, "4h"))):
        if len(df) < 30:
            erg[name] = None
            continue
        e9, e21 = ind.ema(df["close"], 9).iloc[-1], ind.ema(df["close"], 21).iloc[-1]
        erg[name] = bool(e9 > e21)
    return erg


@dataclass
class Kontext:
    cfg: dict
    eurusd: float
    kosten: Kostenmodell
    restbudget_eur: float
    heute: date
    benchmark: pd.Series             # SPY-Schlusskurse
    sektoren: dict[str, pd.Series]   # Sektor-ETF-Schlusskurse
    umfeld: str
    termine: object                  # termine.Termine
    handelstage_voraus: list[date]   # nächste ~15 Handelstage
    berlin_zeit: callable            # ET-Uhrzeit -> Berlin-String
    vortag_schluss: datetime | None = None  # 16:00 ET des letzten Handelstags (für Katalysatoren)

    def plan(self, richtung, einstieg, stop, ziel1, ziel2=None) -> Positionsplan:
        r = self.cfg["risiko"]
        return positionsgroesse(
            richtung=richtung, einstieg=einstieg, stop=stop, ziel1=ziel1, ziel2=ziel2,
            kapital_eur=self.cfg["konto"]["kapital_eur"], risiko_pct=r["risiko_je_trade_pct"],
            eurusd=self.eurusd, kosten=self.kosten, max_positionswert_pct=r["max_positionswert_pct"],
            min_crv=r["min_crv"], restbudget_eur=self.restbudget_eur,
        )


def _ziel(df: pd.DataFrame, richtung: str, einstieg: float, risiko: float) -> tuple[float, str]:
    unter, ueber = ind.unterstuetzung_widerstand(df.tail(250), einstieg)
    if richtung == "long" and ueber is not None:
        return ueber, f"nächster Widerstand (Umkehrpunkt) bei {ueber:.2f}"
    if richtung == "short" and unter is not None:
        return unter, f"nächste Unterstützung (Umkehrpunkt) bei {unter:.2f}"
    z = einstieg + (2.5 if richtung == "long" else -2.5) * risiko
    return z, "kein Widerstand im 1-Jahres-Chart: Ziel = 2,5 R (reine Schätzung)"


def _ziel2(richtung: str, einstieg: float, risiko: float, ziel1: float) -> float | None:
    """Ziel 2 = 3 R, nur wenn es jenseits von Ziel 1 liegt."""
    z = einstieg + (3 if richtung == "long" else -3) * risiko
    return round(z, 2) if (z - ziel1) * (1 if richtung == "long" else -1) > 0 else None


def _ereignisse(ctx: Kontext, ticker: str, haltetage: int) -> tuple[list[str], bool | None]:
    """Ereignisrisiken in der Haltedauer. Rückgabe: Texte, 'frei von Zahlen' (None = ungeprüft)."""
    texte = []
    ende = ctx.handelstage_voraus[min(haltetage, len(ctx.handelstage_voraus)) - 1]
    frei: bool | None = None
    if ctx.termine.quartalszahlen_quelle:
        z = ctx.termine.naechste_zahlen(ticker, ctx.heute)
        frei = not (z and z[0] <= ende)
        if z and z[0] <= ende:
            texte.append(f"Quartalszahlen am {z[0]:%d.%m.%Y} ({z[1]})")
    else:
        texte.append("Quartalszahlen-Termin ungeprüft (keine Datenquelle)")
    for a, b in ctx.termine.fomc_im_zeitraum(ctx.heute, ende):
        texte.append(f"FOMC-Sitzung {a:%d.%m.}–{b:%d.%m.%Y} (Zinsentscheid am {b:%d.%m.} um 14:00 ET)")
    return texte, frei


def swing_setups(ticker: str, name: str, sektor: str | None, df: pd.DataFrame, k: dict,
                 stunden: pd.DataFrame | None, meldungen: list[Meldung], ctx: Kontext) -> list[Setup]:
    erg: list[Setup] = []
    atr = k["atr14"]
    if not atr or pd.isna(k["sma200"]):
        return erg
    rs_markt = ind.relative_staerke(df["close"], ctx.benchmark)
    etf = _sektor_etf(sektor)
    rs_sektor = ind.relative_staerke(df["close"], ctx.sektoren[etf]) if etf in ctx.sektoren else None
    mtf = mtf_trend(stunden)
    vol3 = df["volume"].tail(3).mean()
    vol20 = df["volume"].iloc[-23:-3].mean()
    tief3, hoch3 = df["low"].tail(3).min(), df["high"].tail(3).max()
    ereignisse, zahlenfrei = _ereignisse(ctx, ticker, 10)
    kurs_zeit = f"Schlusskurs {k['datum']:%d.%m.%Y}"
    r = ctx.cfg["risiko"]

    def bauen(muster, richtung, bedingung, einstieg, stop, kriterien, begruendung, gegen, invalid, bestaetigung):
        risiko = abs(einstieg - stop)
        if not (r["min_stop_atr"] * atr <= risiko <= r["max_stop_atr"] * atr):
            return None
        ziel1, herleitung = _ziel(df, richtung, einstieg, risiko)
        ziel2 = _ziel2(richtung, einstieg, risiko, ziel1)
        s = Setup(
            ticker=ticker, name=name, sektor=sektor, strategie=SWING, muster=muster, richtung=richtung,
            kurs=k["kurs"], kurs_zeit=kurs_zeit, einstieg_bedingung=bedingung, einstieg=round(einstieg, 2),
            stop=round(stop, 2), ziel1=round(ziel1, 2), ziel2=ziel2, ziel_herleitung=herleitung,
            invalidierung=invalid, bestaetigung=bestaetigung,
            verfall=[
                "Einstiegsbedingung nicht innerhalb von 3 Handelstagen erfüllt",
                "Tagesschluss jenseits des Stops vor dem Einstieg",
                "neue wesentliche Unternehmensmeldung oder Quartalszahlen in der Haltedauer",
            ],
            kriterien=kriterien, begruendung=begruendung, gegenargumente=gegen,
            ereignisrisiken=list(ereignisse), meldungen=meldungen, atr=atr,
        )
        s.plan = ctx.plan(richtung, s.einstieg, s.stop, s.ziel1, s.ziel2)
        return s

    gemeinsam = [
        ("Marktumfeld nicht gegenläufig", None if ctx.umfeld == "unbekannt" else ctx.umfeld != "negativ"),
        ("keine Quartalszahlen in den nächsten 10 Handelstagen", zahlenfrei),
    ]
    trend = k["trend"]
    # Pullback im Aufwärtstrend
    if trend == "Aufwärtstrend":
        naehe = min(abs(tief3 - k["ema21"]), abs(tief3 - k["sma20"])) <= 0.5 * atr
        if naehe and k["kurs"] > k["sma50"] and 35 <= k["rsi14"] <= 60:
            einstieg = k["vortageshoch"] + 0.05 * atr
            stop = tief3 - 0.25 * atr
            krit = [
                ("Tagestrend aufwärts (Kurs > SMA50 > SMA200, SMA50 steigend)", True),
                ("Rücksetzer bis EMA21/SMA20 (±0,5 ATR)", True),
                ("RSI 35–60: Rücksetzer ohne Trendbruch", True),
                ("relative Stärke 20 T. > S&P 500", None if rs_markt is None else rs_markt > 0),
                ("relative Stärke 20 T. > Sektor", None if rs_sektor is None else rs_sektor > 0),
                ("4h-Trend intakt (EMA9 > EMA21)", mtf["4h"]),
                ("Volumen im Rücksetzer rückläufig", bool(vol3 < vol20)),
            ] + gemeinsam
            s = bauen(
                "Pullback im Aufwärtstrend", "long",
                f"Kauf-Stop über dem Vortageshoch ({_d(einstieg)} USD), nur nach Eröffnung und wenn der Kurs "
                f"die EMA21 ({_d(k['ema21'])}) hält",
                einstieg, stop, krit,
                [f"Übergeordneter Aufwärtstrend: Kurs {_d(k['kurs'])} über SMA50 {_d(k['sma50'])} und SMA200 {_d(k['sma200'])}",
                 f"Rücksetzer hat EMA21/SMA20 erreicht (3-Tage-Tief {_d(tief3)}), RSI {k['rsi14']:.0f}",
                 f"Relative Stärke 20 T. ggü. S&P 500: {'+' if rs_markt > 0 else ''}{_d(rs_markt)} Pp." if rs_markt is not None else "Relative Stärke: keine Daten"],
                [x for x in [
                    "Rücksetzer kann in eine Trendwende übergehen" ,
                    "Volumen im Rücksetzer nicht rückläufig – möglicher Verkaufsdruck" if vol3 >= vol20 else None,
                    "MACD-Histogramm negativ (Momentum schwach)" if k["macd_hist"] < 0 else None,
                    "schwächer als der Gesamtmarkt" if rs_markt is not None and rs_markt < 0 else None,
                ] if x],
                f"Tagesschluss unter {_d(stop)} USD (unter dem 3-Tage-Tief abzüglich 0,25 ATR)",
                ["Kurs handelt über dem Vortageshoch", "Tagesschluss über EMA21", "Gesamtmarkt (SPY) nicht unter dem Vortagestief"],
            )
            if s:
                erg.append(s)
        # Ausbruch über das 55-Tage-Hoch
        h55 = k["hoch55"]
        if h55 and 0.97 * h55 <= k["kurs"] <= h55:
            einstieg = h55 + 0.1 * atr
            stop = einstieg - 1.5 * atr
            krit = [
                ("Tagestrend aufwärts", True),
                ("Kurs maximal 3 % unter dem 55-Tage-Hoch", True),
                ("relative Stärke 20 T. > S&P 500", None if rs_markt is None else rs_markt > 0),
                ("relative Stärke 20 T. > Sektor", None if rs_sektor is None else rs_sektor > 0),
                ("4h-Trend intakt (EMA9 > EMA21)", mtf["4h"]),
                ("RSI unter 75 (nicht überkauft)", k["rsi14"] < 75),
            ] + gemeinsam
            s = bauen(
                "Ausbruch über 55-Tage-Hoch", "long",
                f"Kauf-Stop bei {_d(einstieg)} USD (55-Tage-Hoch {_d(h55)} + 0,1 ATR); Ausbruch braucht Volumen",
                einstieg, stop, krit,
                [f"Kurs {_d(k['kurs'])} knapp unter dem 55-Tage-Hoch {_d(h55)} im Aufwärtstrend",
                 f"ATR {_d(atr)} USD ({_d(k['atr_pct'])} %)"],
                ["Fehlausbrüche sind häufig: ohne Volumenbestätigung kein Einstieg",
                 "Stop aus ATR (1,5 ATR), nicht aus Chartstruktur"] +
                (["RSI erhöht – Ausbruch könnte bereits ausgereizt sein"] if k["rsi14"] >= 70 else []),
                f"Tagesschluss zurück unter {_d(h55)} (Fehlausbruch) oder Kurs unter {_d(stop)}",
                ["Tagesvolumen ≥ 1,5 × 20-Tage-Durchschnitt am Ausbruchstag",
                 f"Tagesschluss über {_d(h55)}"],
            )
            if s:
                erg.append(s)
    if ctx.cfg["konto"]["short_erlaubt"] and trend == "Abwärtstrend":
        l55 = k["tief55"]
        if l55 and l55 <= k["kurs"] <= 1.03 * l55:
            einstieg = l55 - 0.1 * atr
            stop = einstieg + 1.5 * atr
            krit = [
                ("Tagestrend abwärts", True),
                ("Kurs maximal 3 % über dem 55-Tage-Tief", True),
                ("relative Schwäche 20 T. ggü. S&P 500", None if rs_markt is None else rs_markt < 0),
                ("4h-Trend abwärts (EMA9 < EMA21)", None if mtf["4h"] is None else not mtf["4h"]),
                ("RSI über 25 (nicht überverkauft)", k["rsi14"] > 25),
            ] + gemeinsam
            s = bauen(
                "Abwärtsausbruch unter 55-Tage-Tief", "short",
                f"Verkaufs-Stop (Short) bei {_d(einstieg)} USD; nur wenn leihbar und Broker Short erlaubt",
                einstieg, stop, krit,
                [f"Abwärtstrend, Kurs {_d(k['kurs'])} nahe 55-Tage-Tief {_d(l55)}"],
                ["Short-Squeeze-Risiko, Leihgebühren, unbegrenztes theoretisches Verlustpotenzial"],
                f"Tagesschluss über {_d(l55)} oder Kurs über {_d(stop)}",
                ["Tagesvolumen ≥ 1,5 × Durchschnitt", f"Tagesschluss unter {_d(l55)}"],
            )
            if s:
                erg.append(s)
    return erg


@dataclass
class Vorboerse:
    letzter: float
    hoch: float
    tief: float
    volumen: float
    zeit_et: datetime
    alter_min: float


def vorboerse_auswerten(intraday: pd.DataFrame | None, handelstag: date, jetzt: datetime) -> Vorboerse | None:
    if intraday is None or intraday.empty:
        return None
    heute = intraday[(intraday.index.date == handelstag) & (intraday["phase"] == "vorboerse")
                     & (intraday.index <= jetzt)]
    if heute.empty:
        return None
    zeit = heute.index[-1]
    return Vorboerse(
        letzter=float(heute["close"].iloc[-1]), hoch=float(heute["high"].max()), tief=float(heute["low"].min()),
        volumen=float(heute["volume"].sum()), zeit_et=zeit.to_pydatetime(),
        alter_min=(jetzt - zeit.to_pydatetime()).total_seconds() / 60,
    )


def day_setups(ticker: str, name: str, sektor: str | None, df: pd.DataFrame, k: dict, vb: Vorboerse | None,
               meldungen: list[Meldung], ctx: Kontext) -> tuple[list[Setup], dict | None]:
    """Vorbörsliche Szenarien (Gap mit Katalysator + Opening-Range-Breakout).

    Vor der Eröffnung ist kein Einstieg bestätigbar: Ergebnis ist immer WATCHLIST mit
    vorläufigen Niveaus, die nach Eröffnung anhand der echten Opening Range neu zu berechnen sind.
    """
    if vb is None:
        return [], None
    vortag = k["kurs"]
    gap = (vb.letzter / vortag - 1) * 100
    atr = k["atr14"]
    gap_atr = abs(vb.letzter - vortag) / atr if atr else 0
    adv = df["volume"].tail(20).mean()
    vb_vol_pct = vb.volumen / adv * 100 if adv else 0
    info = {"ticker": ticker, "gap_pct": gap, "gap_atr": gap_atr, "vb_vol_pct": vb_vol_pct,
            "vb_kurs": vb.letzter, "vb_zeit": vb.zeit_et, "alter_min": vb.alter_min}
    schwelle = max(1.5, 0.5 * k["atr_pct"])
    if abs(gap) < schwelle:
        return [], info
    richtung = "long" if gap > 0 else "short"
    if richtung == "short" and not ctx.cfg["konto"]["short_erlaubt"]:
        return [], info
    max_alter = ctx.cfg["daten"]["max_alter_vorboerse_min"]
    vz = 1 if richtung == "long" else -1
    or_schaetzung = 0.35 * atr  # typische Spanne der ersten 15 Min. bei Gap-Titeln, zu validieren
    einstieg = (vb.hoch + 0.05 * atr) if richtung == "long" else (vb.tief - 0.05 * atr)
    stop = einstieg - vz * or_schaetzung
    risiko = abs(einstieg - stop)
    ziel1, herleitung = _ziel(df, richtung, einstieg, risiko)
    if abs(ziel1 - einstieg) < 2 * risiko:
        # Intraday zählt der nächste Widerstand; liegt er zu nah, bleibt das CRV schlecht.
        herleitung += " (liegt näher als 2 R)"
    ereignisse, _ = _ereignisse(ctx, ticker, 1)
    z = ctx.termine.naechste_zahlen(ticker, ctx.heute) if ctx.termine.quartalszahlen_quelle else None
    # Als Katalysator zählt nur, was nach dem Vortagesschluss gemeldet wurde; Älteres ist im Schlusskurs enthalten.
    neu = [m for m in meldungen if ctx.vortag_schluss is None or (m.zeit_utc and m.zeit_utc >= ctx.vortag_schluss)]
    katalysator = bool(neu)
    vol_bekannt = vb.volumen > 0
    eingepreist = gap_atr > 2
    krit = [
        (f"Gap ≥ {_d(schwelle)} % (max(1,5 %, 0,5 ATR))", True),
        ("Katalysator (aktuelle Meldung) vorhanden", katalysator),
        ("vorbörsliches Volumen ≥ 1,5 % des Tagesdurchschnitts", bool(vb_vol_pct >= 1.5) if vol_bekannt else None),
        (f"vorbörslicher Kurs aktuell (≤ {max_alter} Min.)", vb.alter_min <= max_alter),
        ("Gap ≤ 2 ATR (nicht bereits überdehnt)", not eingepreist),
        ("Tagestrend in Gap-Richtung", (k["trend"] == "Aufwärtstrend") if richtung == "long" else (k["trend"] == "Abwärtstrend")),
        ("Marktumfeld nicht gegenläufig", None if ctx.umfeld == "unbekannt" else
         (ctx.umfeld != "negativ") if richtung == "long" else (ctx.umfeld != "positiv")),
    ]
    eroeffnung = ctx.berlin_zeit("09:30")
    s = Setup(
        ticker=ticker, name=name, sektor=sektor, strategie=DAY, muster="Gap + Opening-Range-Breakout (15 Min.)",
        richtung=richtung, kurs=vb.letzter, kurs_zeit=f"vorbörslich {vb.zeit_et:%H:%M} ET ({vb.alter_min:.0f} Min. alt)",
        einstieg_bedingung=(
            f"Erst nach Eröffnung ({eroeffnung} Uhr): 15-Min.-Kerze schließt {'über' if vz > 0 else 'unter'} dem "
            f"Hoch/Tief der ersten 15 Minuten UND Kurs {'über' if vz > 0 else 'unter'} VWAP. "
            f"Vorläufiger Auslöser: {'über' if vz > 0 else 'unter'} {'Vorbörsenhoch' if vz > 0 else 'Vorbörsentief'} {_d(einstieg)}"
        ),
        einstieg=round(einstieg, 2), stop=round(stop, 2), ziel1=round(ziel1, 2),
        ziel2=_ziel2(richtung, einstieg, risiko, ziel1), ziel_herleitung=herleitung,
        invalidierung=(f"Kurs schließt eine 15-Min.-Kerze {'unter' if vz > 0 else 'über'} VWAP bzw. Opening-Range-"
                       f"{'Tief' if vz > 0 else 'Hoch'}; vorläufig {_d(stop)}"),
        bestaetigung=["Opening Range (erste 15 Min.) abwarten und Stop/Größe neu berechnen",
                      "Kurs auf der richtigen Seite des VWAP", "RVOL der ersten 15 Min. ≥ 2",
                      "S&P-500-Future nicht gegenläufig", "Spread < 0,1 % des Kurses"],
        verfall=[f"kein Ausbruch bis 11:00 ET ({ctx.berlin_zeit('11:00')} Uhr)",
                 f"Gap wird geschlossen (Kurs erreicht Vortagesschluss {_d(vortag)})",
                 "Handelsunterbrechung oder neue Meldung", "Tagesverlustlimit erreicht",
                 f"Position spätestens 15:45 ET ({ctx.berlin_zeit('15:45')} Uhr) schließen – kein Übernachtrisiko"],
        kriterien=krit,
        begruendung=[f"Vorbörsliches Gap {'+' if gap > 0 else ''}{_d(gap)} % ({_d(gap_atr)} ATR) – "
                     + (f"Vorbörsenvolumen {_d(vb_vol_pct)} % des üblichen Tagesvolumens"
                        if vol_bekannt else "Vorbörsenvolumen von der Datenquelle nicht geliefert"),
                     f"Tagestrend: {k['trend']}"],
        gegenargumente=[x for x in [
            "Gap kann sich nach Eröffnung schließen (Gap-Fill)",
            "Keine Meldung seit Vortagesschluss gefunden – Ursache des Gaps unklar" if not katalysator else None,
            "Bewegung > 2 ATR: Nachricht möglicherweise bereits eingepreist, Gewinnmitnahmen wahrscheinlicher" if eingepreist else None,
            "Vorbörsliche Kurse sind dünn gehandelt und können täuschen",
        ] if x],
        ereignisrisiken=ereignisse + ([f"Quartalszahlen heute ({z[1]})"] if z and z[0] == ctx.heute else []),
        meldungen=neu + [m for m in meldungen if m not in neu], vorlaeufig=True, atr=atr,
    )
    s.plan = ctx.plan(richtung, s.einstieg, s.stop, s.ziel1, s.ziel2)
    return [s], info


def entscheiden(s: Setup, cfg: dict, gesperrt: bool) -> str:
    if gesperrt or s.plan is None or not s.plan.machbar:
        return "NO TRADE"
    ja, n = s.erfuellt
    if ja < 0.7 * n:
        return "NO TRADE"
    if s.vorlaeufig or not cfg["validierung"]["strategien_validiert"]:
        return "WATCHLIST"
    return "LONG" if s.richtung == "long" else "SHORT"
