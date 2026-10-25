"""NYSE-Börsenkalender und Zeitzonen.

Die Feiertags- und Halbtagsregeln folgen den veröffentlichten NYSE-Regeln
(https://www.nyse.com/markets/hours-calendars). Außerplanmäßige Schließungen
(z. B. nationale Trauertage) kommen aus der Konfiguration.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

ET = ZoneInfo("America/New_York")
BERLIN = ZoneInfo("Europe/Berlin")
UTC = ZoneInfo("UTC")
WOCHENTAGE = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"]

VORBOERSE_BEGINN = time(4, 0)
ERÖFFNUNG = time(9, 30)
SCHLUSS = time(16, 0)
SCHLUSS_VERKUERZT = time(13, 0)
NACHBOERSE_ENDE = time(20, 0)


def ostersonntag(jahr: int) -> date:
    """Gregorianischer Ostersonntag (anonymer Algorithmus nach Gauß/Meeus)."""
    a = jahr % 19
    b, c = divmod(jahr, 100)
    d, e = divmod(b, 4)
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i, k = divmod(c, 4)
    l = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * l) // 451
    monat, tag = divmod(h + l - 7 * m + 114, 31)
    return date(jahr, monat, tag + 1)


def _nter_wochentag(jahr: int, monat: int, wochentag: int, n: int) -> date:
    erster = date(jahr, monat, 1)
    versatz = (wochentag - erster.weekday()) % 7
    return erster + timedelta(days=versatz + 7 * (n - 1))


def _letzter_wochentag(jahr: int, monat: int, wochentag: int) -> date:
    naechster = date(jahr + (monat == 12), monat % 12 + 1, 1)
    letzter = naechster - timedelta(days=1)
    return letzter - timedelta(days=(letzter.weekday() - wochentag) % 7)


def _beobachtet(d: date) -> date:
    """Samstag -> Freitag davor, Sonntag -> Montag danach."""
    if d.weekday() == 5:
        return d - timedelta(days=1)
    if d.weekday() == 6:
        return d + timedelta(days=1)
    return d


def feiertage(jahr: int, sonderschliessungen: dict | None = None) -> dict[date, str]:
    tage: dict[date, str] = {}
    neujahr = date(jahr, 1, 1)
    # Fällt Neujahr auf einen Samstag, schließt die NYSE am Freitag davor NICHT.
    if neujahr.weekday() == 6:
        tage[neujahr + timedelta(days=1)] = "Neujahr (nachgeholt)"
    elif neujahr.weekday() != 5:
        tage[neujahr] = "Neujahr"
    tage[_nter_wochentag(jahr, 1, 0, 3)] = "Martin Luther King Jr. Day"
    tage[_nter_wochentag(jahr, 2, 0, 3)] = "Washington's Birthday"
    tage[ostersonntag(jahr) - timedelta(days=2)] = "Karfreitag"
    tage[_letzter_wochentag(jahr, 5, 0)] = "Memorial Day"
    if jahr >= 2022:
        tage[_beobachtet(date(jahr, 6, 19))] = "Juneteenth"
    tage[_beobachtet(date(jahr, 7, 4))] = "Independence Day"
    tage[_nter_wochentag(jahr, 9, 0, 1)] = "Labor Day"
    tage[_nter_wochentag(jahr, 11, 3, 4)] = "Thanksgiving"
    tage[_beobachtet(date(jahr, 12, 25))] = "Weihnachten"
    for d, grund in (sonderschliessungen or {}).items():
        d = d if isinstance(d, date) else date.fromisoformat(str(d))
        if d.year == jahr:
            tage[d] = str(grund)
    return tage


def verkuerzte_tage(jahr: int, sonderschliessungen: dict | None = None) -> dict[date, str]:
    frei = feiertage(jahr, sonderschliessungen)
    tage: dict[date, str] = {}
    for d, grund in (
        (date(jahr, 7, 3), "Tag vor Independence Day"),
        (_nter_wochentag(jahr, 11, 3, 4) + timedelta(days=1), "Tag nach Thanksgiving"),
        (date(jahr, 12, 24), "Heiligabend"),
    ):
        if d.weekday() < 5 and d not in frei:
            tage[d] = grund
    return tage


@dataclass(frozen=True)
class Sitzung:
    datum: date
    offen: bool
    grund: str
    verkuerzt: bool = False
    vorboerse_et: datetime | None = None
    eroeffnung_et: datetime | None = None
    schluss_et: datetime | None = None

    def berlin(self, zeitpunkt: datetime | None) -> datetime | None:
        return zeitpunkt.astimezone(BERLIN) if zeitpunkt else None


class BoersenKalender:
    def __init__(self, sonderschliessungen: dict | None = None):
        self.sonder = sonderschliessungen or {}
        self._cache: dict[int, tuple[dict, dict]] = {}

    def _jahr(self, jahr: int) -> tuple[dict, dict]:
        if jahr not in self._cache:
            self._cache[jahr] = (feiertage(jahr, self.sonder), verkuerzte_tage(jahr, self.sonder))
        return self._cache[jahr]

    def sitzung(self, d: date) -> Sitzung:
        frei, kurz = self._jahr(d.year)
        if d.weekday() >= 5:
            return Sitzung(d, False, "Wochenende")
        if d in frei:
            return Sitzung(d, False, f"Börsenfeiertag: {frei[d]}")
        schluss = SCHLUSS_VERKUERZT if d in kurz else SCHLUSS
        return Sitzung(
            d,
            True,
            f"verkürzter Handel: {kurz[d]}" if d in kurz else "regulärer Handelstag",
            verkuerzt=d in kurz,
            vorboerse_et=datetime.combine(d, VORBOERSE_BEGINN, ET),
            eroeffnung_et=datetime.combine(d, ERÖFFNUNG, ET),
            schluss_et=datetime.combine(d, schluss, ET),
        )

    def ist_handelstag(self, d: date) -> bool:
        return self.sitzung(d).offen

    def vorheriger_handelstag(self, d: date) -> date:
        d -= timedelta(days=1)
        while not self.ist_handelstag(d):
            d -= timedelta(days=1)
        return d

    def naechster_handelstag(self, d: date) -> date:
        d += timedelta(days=1)
        while not self.ist_handelstag(d):
            d += timedelta(days=1)
        return d

    def handelstage_bis(self, start: date, ende: date) -> list[date]:
        """Handelstage im halboffenen Intervall (start, ende]."""
        tage, d = [], start
        while d < ende:
            d += timedelta(days=1)
            if self.ist_handelstag(d):
                tage.append(d)
        return tage


def zeitversatz_stunden(d: date) -> float:
    """Differenz Berlin minus New York zur Mittagszeit des Tages (regulär 6 h)."""
    mittag = datetime.combine(d, time(12, 0), UTC)
    return (mittag.astimezone(BERLIN).utcoffset() - mittag.astimezone(ET).utcoffset()).total_seconds() / 3600


def zeitversatz_hinweis(d: date) -> str | None:
    versatz = zeitversatz_stunden(d)
    if versatz == 6:
        return None
    eroeffnung = datetime.combine(d, ERÖFFNUNG, ET).astimezone(BERLIN)
    return (
        f"Achtung Zeitumstellung: Deutschland und USA liegen heute nur {versatz:g} h auseinander. "
        f"Die US-Börse öffnet um {eroeffnung:%H:%M} Uhr deutscher Zeit statt um 15:30 Uhr."
    )


def berichtszeitpunkt_utc(d: date, uhrzeit: str, zone: str = "Europe/Berlin") -> datetime:
    std, minute = (int(x) for x in uhrzeit.split(":"))
    return datetime.combine(d, time(std, minute), ZoneInfo(zone)).astimezone(UTC)


def cron_slot_passt(cron: str, jetzt_utc: datetime, uhrzeit: str, zone: str = "Europe/Berlin") -> bool:
    """Prüft, ob ein UTC-Cron-Eintrag ('M H * * …') heute der gewünschten Lokalzeit entspricht.

    GitHub Actions kennt nur UTC. Der Workflow plant deshalb zwei Läufe (Sommer- und Winterzeit);
    nur der passende arbeitet weiter. Eine verspätete Ausführung ändert daran nichts, weil der
    geplante Slot und nicht die tatsächliche Startzeit verglichen wird.
    """
    minute, stunde = (int(x) for x in cron.split()[:2])
    lokal_datum = jetzt_utc.astimezone(ZoneInfo(zone)).date()
    ziel = berichtszeitpunkt_utc(lokal_datum, uhrzeit, zone)
    return (ziel.hour, ziel.minute) == (stunde, minute)


def marktphase(jetzt: datetime, kalender: BoersenKalender) -> tuple[str, Sitzung]:
    """Liefert die US-Marktphase zum Zeitpunkt `jetzt` (beliebige Zeitzone)."""
    et = jetzt.astimezone(ET)
    s = kalender.sitzung(et.date())
    if not s.offen:
        return "geschlossen", s
    if et < s.vorboerse_et:
        return "vor_vorboerse", s
    if et < s.eroeffnung_et:
        return "vorboerse", s
    if et < s.schluss_et:
        return "regulaer", s
    if et < datetime.combine(s.datum, NACHBOERSE_ENDE, ET):
        return "nachboerse", s
    return "nach_handelsschluss", s
