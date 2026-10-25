from datetime import date, datetime

from spx.kalender import (BERLIN, ET, UTC, BoersenKalender, cron_slot_passt, feiertage, marktphase,
                          verkuerzte_tage, zeitversatz_hinweis, zeitversatz_stunden)

# Offizielle NYSE-Liste (nyse.com/markets/hours-calendars, Abruf 25.10.2026)
NYSE = {
    2025: ["2025-01-01", "2025-01-20", "2025-02-17", "2025-04-18", "2025-05-26", "2025-06-19", "2025-07-04",
           "2025-09-01", "2025-11-27", "2025-12-25"],
    2026: ["2026-01-01", "2026-01-19", "2026-02-16", "2026-04-03", "2026-05-25", "2026-06-19", "2026-07-03",
           "2026-09-07", "2026-11-26", "2026-12-25"],
    2027: ["2027-01-01", "2027-01-18", "2027-02-15", "2027-03-26", "2027-05-31", "2027-06-18", "2027-07-05",
           "2027-09-06", "2027-11-25", "2027-12-24"],
}
HALBTAGE = {2025: ["2025-07-03", "2025-11-28", "2025-12-24"], 2026: ["2026-11-27", "2026-12-24"], 2027: ["2027-11-26"]}


def test_feiertage_wie_nyse():
    for jahr, tage in NYSE.items():
        assert sorted(feiertage(jahr)) == [date.fromisoformat(d) for d in tage]


def test_halbtage_wie_nyse():
    for jahr, tage in HALBTAGE.items():
        assert sorted(verkuerzte_tage(jahr)) == [date.fromisoformat(d) for d in tage]


def test_neujahr_samstag_kein_freitag():
    # 01.01.2022 war ein Samstag: NYSE war am 31.12.2021 geöffnet
    assert date(2021, 12, 31) not in feiertage(2021)
    assert date(2022, 1, 1) not in feiertage(2022)


def test_sonderschliessung_aus_config(cfg):
    kal = BoersenKalender(cfg["kalender"]["sonderschliessungen"])
    assert not kal.ist_handelstag(date(2025, 1, 9))
    assert kal.vorheriger_handelstag(date(2025, 1, 10)) == date(2025, 1, 8)


def test_sitzung_zeiten_und_halbtag():
    kal = BoersenKalender()
    s = kal.sitzung(date(2026, 11, 27))
    assert s.offen and s.verkuerzt
    assert s.schluss_et.hour == 13
    assert not kal.sitzung(date(2026, 11, 26)).offen
    assert kal.naechster_handelstag(date(2026, 10, 23)) == date(2026, 10, 26)


def test_zeitumstellung_herbst_2026():
    # EU stellt am 25.10. um, USA erst am 01.11.
    kal = BoersenKalender()
    assert zeitversatz_stunden(date(2026, 10, 23)) == 6
    assert zeitversatz_stunden(date(2026, 10, 26)) == 5
    assert kal.sitzung(date(2026, 10, 26)).eroeffnung_et.astimezone(BERLIN).strftime("%H:%M") == "14:30"
    assert kal.sitzung(date(2026, 11, 2)).eroeffnung_et.astimezone(BERLIN).strftime("%H:%M") == "15:30"
    assert "14:30" in zeitversatz_hinweis(date(2026, 10, 27))
    assert zeitversatz_hinweis(date(2026, 11, 3)) is None


def test_zeitumstellung_fruehjahr_2027():
    # USA: 14.03.2027, EU: 28.03.2027
    assert zeitversatz_stunden(date(2027, 3, 15)) == 5
    assert zeitversatz_stunden(date(2027, 3, 29)) == 6


def test_cron_slot_sommer_und_winter():
    sommer = datetime(2026, 7, 15, 12, 7, tzinfo=UTC)
    winter = datetime(2026, 12, 15, 13, 40, tzinfo=UTC)  # 40 Min. verspätet gestartet
    assert cron_slot_passt("0 12 * * 1-5", sommer, "14:00")
    assert not cron_slot_passt("0 13 * * 1-5", sommer, "14:00")
    assert cron_slot_passt("0 13 * * 1-5", winter, "14:00")
    assert not cron_slot_passt("0 12 * * 1-5", winter, "14:00")


def test_marktphase():
    kal = BoersenKalender()
    assert marktphase(datetime(2026, 10, 23, 8, 0, tzinfo=ET), kal)[0] == "vorboerse"
    assert marktphase(datetime(2026, 10, 23, 10, 0, tzinfo=ET), kal)[0] == "regulaer"
    assert marktphase(datetime(2026, 10, 24, 10, 0, tzinfo=ET), kal)[0] == "geschlossen"
    # 14:00 Berlin in der Umstellungswoche = 09:00 ET -> noch Vorbörse
    assert marktphase(datetime(2026, 10, 26, 14, 0, tzinfo=BERLIN), kal)[0] == "vorboerse"
