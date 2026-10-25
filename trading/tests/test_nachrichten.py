from datetime import datetime, timedelta

import pandas as pd

from spx import nachrichten as n
from spx.kalender import UTC

RSS = b"""<?xml version="1.0"?><rss version="2.0"><channel>
<item><title>Acme Corp beats estimates, raises guidance</title><link>https://example.com/a</link>
<pubDate>Fri, 23 Oct 2026 11:05:00 GMT</pubDate></item>
<item><title>Acme Corp beats estimates and raises its guidance</title><link>https://example.org/b</link>
<pubDate>Fri, 23 Oct 2026 11:20:00 GMT</pubDate></item>
<item><title>Widget Inc reportedly in talks to buy rival</title><link>https://example.com/c</link>
<pubDate>Fri, 23 Oct 2026 10:00:00 GMT</pubDate></item>
</channel></rss>"""

ATOM = b"""<?xml version="1.0" encoding="ISO-8859-1" ?><feed xmlns="http://www.w3.org/2005/Atom">
<entry><title>8-K - ACME CORP (0000000042) (Filer)</title>
<link rel="alternate" type="text/html" href="https://www.sec.gov/Archives/x-index.htm"/>
<summary type="html"> &lt;b&gt;Filed:&lt;/b&gt; 2026-10-23 &lt;br&gt;Item 2.02: Results of Operations
&lt;br&gt;Item 9.01: Financial Statements</summary>
<updated>2026-10-23T07:30:15-04:00</updated></entry></feed>"""

UNIVERSUM = pd.DataFrame({"ticker": ["ACME", "WDGT", "TGT"], "name": ["ACME CORP", "WIDGET INC", "TARGET CORP"]})


def test_rss_parsen_zeit_und_einordnung():
    ms = n.parse_feed(RSS, "Testmedium", "medien")
    assert len(ms) == 3
    assert ms[0].zeit_utc == datetime(2026, 10, 23, 11, 5, tzinfo=UTC)
    assert ms[0].zeit_berlin.hour == 13  # CEST
    z = n.Zuordnung(UNIVERSUM)
    for m in ms:
        z.zuordnen(m)
        n.einordnen(m)
    assert ms[0].tickers == ["ACME"] and ms[0].art == "Quartalszahlen"
    assert ms[0].tendenz.startswith("eher positiv")
    assert ms[2].status == "Gerücht / unbestätigt"


def test_sec_8k_cik_und_items():
    m = n.parse_feed(ATOM, "SEC EDGAR 8-K", "primaer")[0]
    n.Zuordnung(UNIVERSUM, {42: "ACME"}).zuordnen(m)
    n.einordnen(m)
    assert m.tickers == ["ACME"] and m.zuordnung == "SEC-CIK"
    assert "Quartalszahlen" in m.art
    assert m.status.startswith("Fakt")
    assert m.zeit_utc == datetime(2026, 10, 23, 11, 30, 15, tzinfo=UTC)


def test_deduplizieren_mit_bestaetigung():
    a = n.parse_feed(RSS, "Medium A", "medien")[:1]
    b = n.parse_feed(RSS, "Medium B", "medien")[1:2]
    erg = n.deduplizieren(a + b)
    assert len(erg) == 1
    assert erg[0].bestaetigt_durch == ["Medium B"]
    assert erg[0].quelle == "Medium A"  # früheste Meldung bleibt


def test_mehrdeutige_namen_werden_nicht_zugeordnet():
    m = n.Meldung("Target hit for oil prices", "u", "x", "medien", None)
    n.Zuordnung(UNIVERSUM).zuordnen(m)
    assert m.tickers == []


def test_ticker_feed_muss_firma_nennen():
    z = n.Zuordnung(UNIVERSUM)
    assert z.nennt("Acme shares jump", "ACME")
    assert z.nennt("Why ACME is moving", "ACME")
    assert not z.nennt("Top 3 dividend stocks", "ACME")
