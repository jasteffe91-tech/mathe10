"""Ergänzende Marktdaten aus offiziellen, frei zugänglichen Quellen."""

from __future__ import annotations

import io
import xml.etree.ElementTree as ET_XML
from datetime import date

import pandas as pd

from .http import holen, sitzung

EZB_URL = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml"
FRED_CSV = "https://fred.stlouisfed.org/graph/fredgraph.csv?id={serie}"


def ezb_eurusd() -> tuple[float, date]:
    """EZB-Referenzkurs: USD je 1 EUR (wird werktags gegen 16:00 MEZ veröffentlicht)."""
    xml = holen(sitzung(), EZB_URL).text
    wurzel = ET_XML.fromstring(xml)
    for el in wurzel.iter():
        if el.get("time"):
            tag = date.fromisoformat(el.get("time"))
        if el.get("currency") == "USD":
            return float(el.get("rate")), tag
    raise ValueError("USD-Kurs nicht im EZB-Datensatz")


def fred_reihe(serie: str) -> pd.Series:
    """Öffentliche FRED-CSV-Reihe (z. B. VIXCLS = VIX-Schlusskurs, Quelle CBOE)."""
    df = pd.read_csv(io.StringIO(holen(sitzung(), FRED_CSV.format(serie=serie), timeout=45, versuche=2).text))
    df.columns = ["datum", "wert"]
    df["wert"] = pd.to_numeric(df["wert"], errors="coerce")
    df = df.dropna()
    return pd.Series(df["wert"].to_numpy(), index=pd.to_datetime(df["datum"]).dt.date, name=serie)
