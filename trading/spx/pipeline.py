"""Täglicher Ablauf: Daten holen, prüfen, filtern, analysieren, Risiko rechnen, Bericht erzeugen."""

from __future__ import annotations

import logging
import os
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from datetime import date, datetime, time, timedelta
from pathlib import Path

import pandas as pd

from . import indikatoren as ind
from . import nachrichten, setups, termine, umfeld, ziel
from .daten import kurse, markt, universum
from .kalender import BERLIN, ET, UTC, WOCHENTAGE, BoersenKalender, marktphase, zeitversatz_hinweis
from .risiko import Kostenmodell, korrelationen, risikostatus

log = logging.getLogger("spx.pipeline")


@dataclass
class Lauf:
    cfg: dict
    jetzt: datetime
    handelstag: date
    phase: str
    sitzung: object
    hinweise: list[str] = field(default_factory=list)
    datenfehler: list[str] = field(default_factory=list)
    quellen: list[str] = field(default_factory=list)
    universum: object = None
    eurusd: tuple[float, date, str] | None = None
    umfeld: object = None
    nachrichten: object = None
    termine: object = None
    setups: list = field(default_factory=list)
    aussortiert: dict[str, int] = field(default_factory=dict)
    gaps: list[dict] = field(default_factory=list)
    korrelationen: list = field(default_factory=list)
    risiko: object = None
    zielpruefung: object = None
    statistik: dict = field(default_factory=dict)
    abbruch: str | None = None


def _parallel(funktion, eingaben, threads):
    with ThreadPoolExecutor(max_workers=threads) as pool:
        return dict(zip(eingaben, pool.map(_sicher(funktion), eingaben)))


def _sicher(funktion):
    def inner(x):
        try:
            return funktion(x)
        except Exception as e:  # noqa: BLE001 – Fehler wird als Datenlücke protokolliert
            return e
    return inner


def _wechselkurs(lauf: Lauf, quelle) -> None:
    try:
        kurs, tag = markt.ezb_eurusd()
        lauf.eurusd = (kurs, tag, "EZB-Referenzkurs")
    except Exception as e:  # noqa: BLE001
        lauf.datenfehler.append(f"EZB-Wechselkurs: {e}")
        try:
            df = quelle.tagesdaten("EURUSD=X", "5d")
            lauf.eurusd = (float(df["close"].iloc[-1]), df.index[-1], "Yahoo EURUSD=X (Ersatz)")
        except Exception as e2:  # noqa: BLE001
            lauf.datenfehler.append(f"Ersatz-Wechselkurs: {e2}")


def _bis_vortag(df: pd.DataFrame, letzter: date) -> pd.DataFrame:
    return df[df.index <= letzter]


def ausfuehren(cfg: dict, jetzt: datetime | None = None, cache_dir: Path | None = None,
               tagesergebnis_eur: float = 0.0, offenes_risiko_eur: float = 0.0, simuliert: bool = False) -> Lauf:
    jetzt = (jetzt or datetime.now(UTC)).astimezone(UTC)
    cache_dir = cache_dir or Path(__file__).resolve().parent.parent / ".cache"
    kal = BoersenKalender(cfg["kalender"].get("sonderschliessungen"))
    phase, sitzung = marktphase(jetzt, kal)
    heute_et = jetzt.astimezone(ET).date()
    lauf = Lauf(cfg, jetzt, heute_et, phase, sitzung)
    if simuliert:
        lauf.hinweise.append(
            "SIMULIERTER ZEITPUNKT: Der Lauf verwendet heute abgerufene Daten. Stunden- und Nachrichtendaten können "
            "Informationen enthalten, die zum simulierten Zeitpunkt noch nicht bekannt waren. Nur zum Testen.")
    if h := zeitversatz_hinweis(heute_et):
        lauf.hinweise.append(h)
    lauf.zielpruefung = ziel.pruefen(cfg)
    lauf.risiko = risikostatus(cfg, tagesergebnis_eur, offenes_risiko_eur)
    if not sitzung.offen:
        lauf.abbruch = f"Heute ({heute_et:%d.%m.%Y}) findet kein regulärer US-Handel statt: {sitzung.grund}."
        naechster = kal.sitzung(kal.naechster_handelstag(heute_et))
        lauf.hinweise.append(
            f"Nächster Handelstag: {WOCHENTAGE[naechster.datum.weekday()]}, {naechster.datum:%d.%m.%Y} – Eröffnung "
            f"{naechster.eroeffnung_et.astimezone(BERLIN):%H:%M} Uhr deutscher Zeit")
        return lauf
    if phase not in ("vor_vorboerse", "vorboerse"):
        lauf.hinweise.append(
            f"Lauf außerhalb der Vorbörse (Phase: {phase}). Vorbörsliche Szenarien sind nicht mehr aktuell; "
            "Daytrading-Szenarien werden nicht erzeugt.")
    letzter_tag = kal.vorheriger_handelstag(heute_et)
    if phase in ("nachboerse", "nach_handelsschluss"):
        letzter_tag = heute_et

    quelle = kurse.kursquelle(cfg)
    lauf.quellen.append(f"Kurse: {quelle.name}" + ("" if quelle.offiziell else " – inoffiziell, nur Entwicklung"))
    try:
        lauf.universum = universum.laden(cfg, cache_dir)
    except Exception as e:  # noqa: BLE001
        lauf.abbruch = f"S&P-500-Bestand nicht ermittelbar: {e}"
        return lauf
    lauf.hinweise += lauf.universum.hinweise
    lauf.quellen.append(f"Universum: {lauf.universum.quelle}; Sektoren: Wikipedia (Sekundärquelle)")
    _wechselkurs(lauf, quelle)
    if lauf.eurusd is None:
        lauf.abbruch = "Kein EUR/USD-Kurs verfügbar – Positionsgrößen nicht berechenbar."
        return lauf

    threads = cfg["daten"]["parallel"]
    mcfg = cfg["markt"]
    extra = list(mcfg["indizes"]) + list(mcfg["sektoren"]) + ["SPY"]
    alle = lauf.universum.ticker
    roh = _parallel(lambda t: quelle.tagesdaten(t, "2y"), alle + extra, threads)
    tages: dict[str, pd.DataFrame] = {}
    veraltet, fehlend = [], []
    for t, df in roh.items():
        if isinstance(df, Exception) or df is None or df.empty:
            fehlend.append(t)
            continue
        df = _bis_vortag(df, letzter_tag)
        if df.empty or df.index[-1] != letzter_tag:
            veraltet.append(t)
            continue
        tages[t] = df
    if fehlend:
        lauf.datenfehler.append(f"Keine Tagesdaten für {len(fehlend)} Titel: {', '.join(fehlend[:15])}")
    if veraltet:
        lauf.datenfehler.append(f"Veraltete Tagesdaten (letzte Kerze ≠ {letzter_tag:%d.%m.}) für {len(veraltet)} Titel: "
                                f"{', '.join(veraltet[:15])} – ausgeschlossen")
    aktien = {t: tages[t] for t in alle if t in tages}
    lauf.statistik.update(universum=len(alle), mit_daten=len(aktien), letzter_tag=letzter_tag)
    if len(aktien) < 0.8 * len(alle) or "SPY" not in tages:
        lauf.abbruch = (f"Datenlage unzureichend: nur {len(aktien)} von {len(alle)} Titeln mit aktuellen Tagesdaten "
                        f"(Stand {letzter_tag:%d.%m.%Y}).")
        return lauf

    # Liquiditätsfilter
    ucfg = cfg["universum"]
    kennz = {t: ind.kennzahlen_tag(df) for t, df in aktien.items() if len(df) >= 60}
    liquide = [t for t, k in kennz.items()
               if k["kurs"] >= ucfg["min_preis_usd"] and k["dollarvolumen_20"] >= ucfg["min_dollarvolumen_mio_usd"] * 1e6]
    lauf.aussortiert["Liquidität/Preis unter Mindestwert"] = len(kennz) - len(liquide)
    lauf.statistik["liquide"] = len(liquide)

    # Vorbörse und Futures
    vorboerse_aktiv = phase in ("vor_vorboerse", "vorboerse")
    vb: dict[str, setups.Vorboerse | None] = {}
    if vorboerse_aktiv:
        intr = _parallel(lambda t: quelle.intraday(t, "5m", "1d", True), liquide, threads)
        for t, df in intr.items():
            vb[t] = None if isinstance(df, Exception) else setups.vorboerse_auswerten(df, heute_et, jetzt)
        ohne = [t for t in liquide if vb.get(t) is None]
        if len(ohne) > 0.5 * max(len(liquide), 1):
            lauf.datenfehler.append(f"Für {len(ohne)} von {len(liquide)} Titeln keine vorbörslichen Kurse "
                                    "(zu früh, Quelle ohne Vorbörse oder Abruffehler)")
    futures = []
    for sym, name in mcfg["futures"].items():
        try:
            f = quelle.intraday(sym, "5m", "5d", True)
            f = f[f.index <= jetzt]
            letzter = float(f["close"].iloc[-1])
            ref = tages.get("^GSPC" if sym == "ES=F" else "^NDX")
            # Veränderung gegenüber dem Future-Stand zum Kassaschluss des Vortags (16:00 ET)
            schluss = f[f.index <= datetime.combine(letzter_tag, time(16, 0), ET)]
            basis = float(schluss["close"].iloc[-1]) if len(schluss) else None
            alter = (jetzt - f.index[-1].to_pydatetime()).total_seconds() / 60
            futures.append({"symbol": sym, "name": name, "kurs": letzter, "zeit": f.index[-1],
                            "pct": (letzter / basis - 1) * 100 if basis else float("nan"),
                            "aktuell": alter <= cfg["daten"]["max_alter_vorboerse_min"] and basis is not None,
                            "alter_min": alter, "kassa": ref["close"].iloc[-1] if ref is not None else None})
        except Exception as e:  # noqa: BLE001
            lauf.datenfehler.append(f"Future {sym}: {e}")

    vix = None
    try:
        reihe = markt.fred_reihe("VIXCLS")
        vix = {"wert": float(reihe.iloc[-1]), "datum": reihe.index[-1], "vortag": float(reihe.iloc[-2]),
               "quelle": "FRED VIXCLS (CBOE, Schlusskurs)"}
    except Exception as e:  # noqa: BLE001
        lauf.datenfehler.append(f"VIX (FRED): {e}")
        if "^VIX" in tages:
            v = tages["^VIX"]["close"]
            vix = {"wert": float(v.iloc[-1]), "datum": v.index[-1], "vortag": float(v.iloc[-2]), "quelle": quelle.name}

    lauf.umfeld = umfeld.bewerten(
        {s: (n, tages.get(s)) for s, n in mcfg["indizes"].items() if s != "^VIX"},
        futures, vix, aktien, {s: (n, tages.get(s)) for s, n in mcfg["sektoren"].items()})

    # Vorauswahl
    titel = lauf.universum.titel.set_index("ticker")
    name_von = lambda t: str(titel.loc[t, "name"]) if t in titel.index else t  # noqa: E731
    sektor_von = lambda t: (titel.loc[t, "sektor"] if t in titel.index and pd.notna(titel.loc[t, "sektor"]) else None)  # noqa: E731
    gap_kandidaten = []
    for t in liquide:
        v = vb.get(t)
        if v is None:
            continue
        gap = (v.letzter / kennz[t]["kurs"] - 1) * 100
        lauf.gaps.append({"ticker": t, "gap_pct": gap, "vb_kurs": v.letzter, "zeit": v.zeit_et})
        if abs(gap) >= max(1.5, 0.5 * kennz[t]["atr_pct"]):
            gap_kandidaten.append(t)
    lauf.gaps.sort(key=lambda g: -abs(g["gap_pct"]))
    swing_basis = [t for t in liquide if kennz[t]["trend"] == "Aufwärtstrend"
                   or (cfg["konto"]["short_erlaubt"] and kennz[t]["trend"] == "Abwärtstrend")]
    lauf.aussortiert["ohne klaren Tagestrend (Swing)"] = len(liquide) - len(swing_basis)

    kal_voraus = []
    d = heute_et - timedelta(days=1)
    while len(kal_voraus) < 15:
        d = kal.naechster_handelstag(d)
        kal_voraus.append(d)
    lauf.termine = termine.laden(cfg, heute_et)
    lauf.datenfehler += lauf.termine.fehler

    def berlin_zeit(hhmm: str) -> str:
        h, m = (int(x) for x in hhmm.split(":"))
        return datetime.combine(heute_et, time(h, m), ET).astimezone(BERLIN).strftime("%H:%M")

    ctx = setups.Kontext(
        cfg=cfg, eurusd=lauf.eurusd[0], kosten=Kostenmodell.aus_config(cfg),
        restbudget_eur=lauf.risiko.restbudget_eur, heute=heute_et, benchmark=tages["SPY"]["close"],
        sektoren={s: tages[s]["close"] for s in mcfg["sektoren"] if s in tages},
        umfeld=lauf.umfeld.einstufung, termine=lauf.termine, handelstage_voraus=kal_voraus,
        berlin_zeit=berlin_zeit,
        vortag_schluss=datetime.combine(letzter_tag, kal.sitzung(letzter_tag).schluss_et.time(), ET).astimezone(UTC),
    )

    # Swing-Rohsetups (ohne Stundendaten) zur Vorauswahl
    roh_swing = {t: setups.swing_setups(t, name_von(t), sektor_von(t), aktien[t], kennz[t], None, [], ctx)
                 for t in swing_basis}
    swing_kandidaten = [t for t, s in roh_swing.items() if s]
    lauf.aussortiert["Trend ohne Pullback-/Ausbruchsmuster"] = len(swing_basis) - len(swing_kandidaten)

    def prio(t):
        g = next((abs(x["gap_pct"]) for x in lauf.gaps if x["ticker"] == t), 0)
        return -(g + kennz[t]["dollarvolumen_20"] / 1e10)
    detail = sorted(set(gap_kandidaten) | set(swing_kandidaten), key=prio)[: ucfg["max_detailkandidaten"]]
    lauf.aussortiert["über der Detail-Obergrenze (nicht vertieft)"] = max(
        0, len(set(gap_kandidaten) | set(swing_kandidaten)) - len(detail))
    lauf.statistik.update(gap_kandidaten=len(gap_kandidaten), swing_kandidaten=len(swing_kandidaten), detail=len(detail))

    lauf.nachrichten = nachrichten.sammeln(cfg, lauf.universum.titel, jetzt, detail, os.environ.get("SEC_USER_AGENT"))
    lauf.datenfehler += lauf.nachrichten.fehler
    lauf.quellen.append("Nachrichten: " + ", ".join(lauf.nachrichten.quellen))

    stunden = _parallel(lambda t: quelle.intraday(t, "60m", "1mo", False), [t for t in detail if t in swing_kandidaten], threads)
    alle_setups = []
    for t in detail:
        meld = lauf.nachrichten.zu(t)
        if t in swing_kandidaten:
            h = stunden.get(t)
            alle_setups += setups.swing_setups(t, name_von(t), sektor_von(t), aktien[t], kennz[t],
                                               None if isinstance(h, Exception) else h, meld, ctx)
        if t in gap_kandidaten and vorboerse_aktiv:
            s, _ = setups.day_setups(t, name_von(t), sektor_von(t), aktien[t], kennz[t], vb.get(t), meld, ctx)
            alle_setups += s
    for s in alle_setups:
        s.entscheidung = setups.entscheiden(s, cfg, lauf.risiko.gesperrt)
    for s in alle_setups:
        if s.entscheidung == "NO TRADE":
            if lauf.risiko.gesperrt:
                g = "Tagesverlust-/Gesamtrisikolimit erreicht"
            elif s.plan and not s.plan.machbar:
                g = s.plan.kategorie
            else:
                g = "zu wenige Kriterien erfüllt"
            lauf.aussortiert[f"Setup verworfen: {g}"] = lauf.aussortiert.get(f"Setup verworfen: {g}", 0) + 1
    lauf.setups = sorted(alle_setups, key=lambda s: (s.entscheidung == "NO TRADE", -s.erfuellt[0] / max(s.erfuellt[1], 1),
                                                    -(s.plan.crv_netto or 0) if s.plan else 0))
    aktiv = [s.ticker for s in lauf.setups if s.entscheidung != "NO TRADE"]
    if len(aktiv) > 1:
        ren = pd.DataFrame({t: aktien[t]["close"].pct_change() for t in dict.fromkeys(aktiv)})
        lauf.korrelationen = korrelationen(ren, cfg["risiko"]["korrelation_warnschwelle"])
    return lauf
