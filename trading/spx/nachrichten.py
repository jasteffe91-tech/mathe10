"""Nachrichten-Pipeline: Abruf (RSS/Atom), Zeitstempel, Tickerzuordnung, Einordnung, Deduplizierung.

Alle Einordnungen (Art, Tendenz, Horizont) sind regelbasierte Heuristiken und werden im
Bericht ausdrücklich als Interpretation mit niedrigem Vertrauensgrad gekennzeichnet.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from difflib import SequenceMatcher
from email.utils import parsedate_to_datetime

from lxml import etree

from .daten.http import holen, sitzung
from .kalender import BERLIN, ET, UTC

log = logging.getLogger("spx.nachrichten")

SEC_TICKER_URL = "https://www.sec.gov/files/company_tickers.json"
YAHOO_FEED = "https://feeds.finance.yahoo.com/rss/2.0/headline?s={sym}&region=US&lang=en-US"

SEC_ITEMS = {
    "1.01": ("Wesentlicher Vertrag", "unklar"),
    "1.02": ("Vertragsbeendigung", "negativ"),
    "1.03": ("Insolvenz", "negativ"),
    "2.01": ("Übernahme/Verkauf abgeschlossen", "unklar"),
    "2.02": ("Quartalszahlen", "unklar"),
    "2.05": ("Restrukturierung", "unklar"),
    "2.06": ("Wertminderung", "negativ"),
    "3.01": ("Börsennotierung gefährdet", "negativ"),
    "4.02": ("Bilanzkorrektur", "negativ"),
    "5.02": ("Wechsel in Vorstand/Aufsicht", "unklar"),
    "7.01": ("Reg-FD-Mitteilung", "unklar"),
    "8.01": ("Sonstige Ereignisse", "unklar"),
}

ARTEN = [
    ("Quartalszahlen", r"\b(earnings|quarterly results|q[1-4] results|eps|revenue|profit|beats|misses)\b"),
    ("Prognose", r"\b(guidance|outlook|forecast)\b"),
    ("Übernahme/Fusion", r"\b(acquir\w*|merger|takeover|buyout|to buy|deal to)\b"),
    ("Analystenurteil", r"\b(upgrade[sd]?|downgrade[sd]?|price target|initiat\w+ coverage|rating)\b"),
    ("Recht/Regulierung", r"\b(lawsuit|sues?|probe|investigation|antitrust|fda|approval|recall|fine[sd]?|settlement)\b"),
    ("Rückkauf/Dividende", r"\b(buyback|repurchase|dividend)\b"),
    ("Insider/Beteiligung", r"\b(insider|stake)\b"),
    ("Makro/Notenbank", r"\b(fed|fomc|inflation|cpi|pce|payrolls|jobs report|gdp|interest rates?|tariffs?|treasury yields?)\b"),
]
GERUECHT = r"\b(reportedly|sources say|people familiar|in talks|considering|exploring|weighs|mulls|rumou?r)\b"
POSITIV = r"\b(beats?|tops|raises?|upgrade[sd]?|approval|approved|record|surges?|jumps?|soars?|buyback|outperform)\b"
NEGATIV = r"\b(miss(es)?|cuts?|downgrade[sd]?|lawsuit|probe|recall|plunges?|tumbles?|falls?|warns?|layoffs?|delay\w*|halt\w*)\b"
HORIZONT = {
    "Quartalszahlen": "1–3 Handelstage",
    "Prognose": "Tage bis Wochen",
    "Übernahme/Fusion": "Tage bis Wochen",
    "Analystenurteil": "intraday bis 2 Tage",
    "Recht/Regulierung": "unklar",
    "Makro/Notenbank": "intraday bis Tage",
}
NAMENSZUSAETZE = r"\b(inc|incorporated|corp|corporation|co|company|plc|ltd|limited|holdings?|group|class [abc]|the|n\.?v|s\.?a|lp|trust)\b\.?"
MEHRDEUTIGE_NAMEN = {"target", "ball", "news", "fox", "general", "global", "best", "apple hospitality", "match",
                     "public", "southern", "first", "united", "american", "international", "national", "progressive",
                     "visa", "gap", "corning", "waters", "united rentals", "regions", "state street", "loews"}


@dataclass
class Meldung:
    titel: str
    url: str
    quelle: str
    quellentyp: str               # primaer | medien
    zeit_utc: datetime | None
    tickers: list[str] = field(default_factory=list)
    zuordnung: str = ""           # wie der Ticker ermittelt wurde
    art: str = "Sonstiges"
    status: str = ""
    tendenz: str = "unklar"
    horizont: str = "unklar"
    bestaetigt_durch: list[str] = field(default_factory=list)
    zusatz: str = ""

    @property
    def zeit_et(self):
        return self.zeit_utc.astimezone(ET) if self.zeit_utc else None

    @property
    def zeit_berlin(self):
        return self.zeit_utc.astimezone(BERLIN) if self.zeit_utc else None

    @property
    def vertrauen(self) -> str:
        if self.quellentyp == "primaer":
            return "hoch (Primärquelle); Kurswirkung: niedrig (Heuristik)"
        if self.bestaetigt_durch:
            return "mittel (mehrere Quellen); Kurswirkung: niedrig (Heuristik)"
        return "niedrig (eine Sekundärquelle, Heuristik)"


def _zeit(text: str | None) -> datetime | None:
    if not text:
        return None
    text = text.strip()
    try:
        d = parsedate_to_datetime(text)
    except (TypeError, ValueError):
        try:
            d = datetime.fromisoformat(text.replace("Z", "+00:00"))
        except ValueError:
            return None
    return (d if d.tzinfo else d.replace(tzinfo=UTC)).astimezone(UTC)


def parse_feed(xml: bytes, quelle: str, quellentyp: str) -> list[Meldung]:
    wurzel = etree.fromstring(xml, etree.XMLParser(recover=True, resolve_entities=False, no_network=True))
    if wurzel is None:
        return []
    meldungen = []
    for el in wurzel.iter():
        if not isinstance(el.tag, str):
            continue
        tag = etree.QName(el).localname
        if tag not in ("item", "entry"):
            continue
        felder = {etree.QName(k).localname: k for k in el if isinstance(k.tag, str)}

        def text(name: str) -> str:
            k = felder.get(name)
            return "".join(k.itertext()).strip() if k is not None else ""

        link = text("link")
        if not link and "link" in felder:
            link = felder["link"].get("href", "")
        meldungen.append(Meldung(
            titel=re.sub(r"\s+", " ", text("title")),
            url=link,
            quelle=quelle,
            quellentyp=quellentyp,
            zeit_utc=_zeit(text("pubDate") or text("updated") or text("published")),
            zusatz=text("summary") or text("description"),
        ))
    return meldungen


def _normname(name: str) -> str:
    n = re.sub(NAMENSZUSAETZE, " ", name.lower().replace("&", " and "))
    return re.sub(r"[^a-z0-9 ]", " ", re.sub(r"\s+", " ", n)).strip()


class Zuordnung:
    """Ordnet Meldungen Tickern des Universums zu."""

    def __init__(self, universum_titel, sec_cik: dict[int, str] | None = None):
        self.ticker = set(universum_titel["ticker"])
        self.namen = {}
        self.name_von = {}
        for t, n in zip(universum_titel["ticker"], universum_titel["name"]):
            norm = _normname(n)
            self.name_von[t] = norm
            if len(norm) >= 4 and norm not in MEHRDEUTIGE_NAMEN:
                self.namen[norm] = t
        self.sec_cik = sec_cik or {}

    def nennt(self, titel: str, ticker: str) -> bool:
        """True, wenn der Titel den Ticker oder den Firmennamen erwähnt (Ticker-Feeds sind unscharf)."""
        if re.search(rf"(?<![A-Za-z]){re.escape(ticker)}(?![A-Za-z])", titel):
            return True
        norm = " " + _normname(titel) + " "
        name = self.name_von.get(ticker, "")
        return bool(name) and f" {name.split()[0]} " in norm and len(name.split()[0]) >= 3

    def zuordnen(self, m: Meldung) -> None:
        if m.tickers:
            return
        cik = re.search(r"\((\d{10})\)", m.titel)
        if cik and int(cik.group(1)) in self.sec_cik:
            t = self.sec_cik[int(cik.group(1))]
            if t in self.ticker:
                m.tickers, m.zuordnung = [t], "SEC-CIK"
            return
        gefunden = {t for t in re.findall(r"\((?:NYSE|NASDAQ|Nasdaq|NYSE American)\s*:\s*([A-Z.]{1,6})\)", m.titel)
                    if t in self.ticker}
        if gefunden:
            m.tickers, m.zuordnung = sorted(gefunden), "Börsenkürzel im Titel"
            return
        titel = " " + _normname(m.titel) + " "
        treffer = {t for n, t in self.namen.items() if f" {n} " in titel}
        if treffer:
            m.tickers, m.zuordnung = sorted(treffer), "Firmenname im Titel (heuristisch)"


def einordnen(m: Meldung) -> None:
    text = m.titel.lower()
    if m.quelle.startswith("SEC"):
        items = re.findall(r"Item (\d\.\d\d)", m.zusatz)
        arten = [SEC_ITEMS[i] for i in items if i in SEC_ITEMS]
        m.art = "8-K: " + ", ".join(a for a, _ in arten) if arten else "8-K"
        if any(t == "negativ" for _, t in arten):
            m.tendenz = "eher negativ (Meldungsart)"
        if "2.02" in items:
            m.horizont = HORIZONT["Quartalszahlen"]
        m.status = "Fakt (Pflichtmitteilung, Inhalt prüfen)"
        return
    for art, muster in ARTEN:
        if re.search(muster, text):
            m.art = art
            m.horizont = HORIZONT.get(art, "unklar")
            break
    if m.quellentyp == "primaer":
        m.status = "Fakt (Primärquelle)"
    elif re.search(GERUECHT, text):
        m.status = "Gerücht / unbestätigt"
    elif m.art == "Analystenurteil":
        m.status = "Analystenmeinung"
    else:
        m.status = "Medienbericht (Sekundärquelle)"
    pos, neg = bool(re.search(POSITIV, text)), bool(re.search(NEGATIV, text))
    if pos != neg:
        m.tendenz = "eher positiv (Heuristik)" if pos else "eher negativ (Heuristik)"


def _schluessel(titel: str) -> str:
    return re.sub(r"[^a-z0-9 ]", "", titel.lower())


def deduplizieren(meldungen: list[Meldung], schwelle: float = 0.8) -> list[Meldung]:
    """Fasst gleiche URLs und sehr ähnliche Titel zusammen; behält die früheste Meldung."""
    geordnet = sorted(meldungen, key=lambda m: m.zeit_utc or datetime.max.replace(tzinfo=UTC))
    behalten: list[Meldung] = []
    urls: dict[str, Meldung] = {}
    for m in geordnet:
        if m.url and m.url in urls:
            continue
        doppelt = None
        k = _schluessel(m.titel)
        for b in behalten:
            if SequenceMatcher(None, k, _schluessel(b.titel)).ratio() >= schwelle:
                doppelt = b
                break
        if doppelt:
            if m.quelle != doppelt.quelle and m.quelle not in doppelt.bestaetigt_durch:
                doppelt.bestaetigt_durch.append(m.quelle)
            doppelt.tickers = sorted(set(doppelt.tickers) | set(m.tickers))
            continue
        behalten.append(m)
        if m.url:
            urls[m.url] = m
    return behalten


def sec_cik_tabelle(user_agent: str) -> dict[int, str]:
    daten = holen(sitzung(user_agent), SEC_TICKER_URL).json()
    return {int(v["cik_str"]): v["ticker"].replace("-", ".") for v in daten.values()}


@dataclass
class NachrichtenLage:
    meldungen: list[Meldung]
    fehler: list[str]
    quellen: list[str]

    def zu(self, ticker: str) -> list[Meldung]:
        return [m for m in self.meldungen if ticker in m.tickers]


def sammeln(cfg: dict, universum_titel, jetzt_utc: datetime, ticker_feeds: list[str] = (),
            sec_user_agent: str | None = None) -> NachrichtenLage:
    ncfg = cfg["nachrichten"]
    grenze = jetzt_utc - timedelta(hours=ncfg["max_alter_stunden"])
    fehler, quellen, roh = [], [], []
    sec_ua = sec_user_agent or "spx-analyse kontakt-fehlt@example.invalid"
    if not sec_user_agent:
        fehler.append("SEC_USER_AGENT nicht gesetzt (SEC verlangt Name + E-Mail); Platzhalter verwendet")
    cik = {}
    try:
        cik = sec_cik_tabelle(sec_ua)
    except Exception as e:  # noqa: BLE001
        fehler.append(f"SEC-Tickertabelle: {e}")
    zuordnung = Zuordnung(universum_titel, cik)
    for feed in ncfg["feeds"]:
        ua = sec_ua if "sec.gov" in feed["url"] else "Mozilla/5.0 spx-analyse/0.1"
        try:
            roh += parse_feed(holen(sitzung(ua), feed["url"]).content, feed["name"], feed["typ"])
            quellen.append(feed["name"])
        except Exception as e:  # noqa: BLE001
            fehler.append(f"{feed['name']}: {e}")
    if ncfg.get("yahoo_ticker_feed"):
        s = sitzung("Mozilla/5.0 spx-analyse/0.1")
        for t in ticker_feeds:
            try:
                neu = parse_feed(holen(s, YAHOO_FEED.format(sym=t.replace(".", "-"))).content,
                                 "Yahoo Finance", "medien")
                for m in neu:
                    if zuordnung.nennt(m.titel, t):
                        m.tickers, m.zuordnung = [t], "Ticker-Feed, Firma im Titel"
                        roh.append(m)
            except Exception as e:  # noqa: BLE001
                fehler.append(f"Yahoo-Feed {t}: {e}")
        if ticker_feeds:
            quellen.append("Yahoo Finance (Ticker-Feeds)")
    aktuell = []
    for m in roh:
        if m.zeit_utc is None or m.zeit_utc < grenze or m.zeit_utc > jetzt_utc + timedelta(minutes=5):
            continue
        zuordnung.zuordnen(m)
        einordnen(m)
        aktuell.append(m)
    return NachrichtenLage(deduplizieren(aktuell), fehler, quellen)
