"""Kommandozeile: python -m spx bericht [--cron "0 12 * * 1-5"] [--ausgabe berichte/]"""

from __future__ import annotations

import argparse
import logging
import os
import sys
from datetime import datetime
from pathlib import Path

from . import bericht, config, pipeline
from .kalender import BERLIN, UTC, BoersenKalender, cron_slot_passt


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="spx", description="S&P-500-Analyse (ohne Brokerzugriff)")
    sub = ap.add_subparsers(dest="befehl", required=True)
    b = sub.add_parser("bericht", help="Tagesbericht erzeugen")
    b.add_argument("--config", help="zusätzliche YAML-Konfiguration")
    b.add_argument("--cron", help="geplanter UTC-Cron-Slot; der Lauf endet, wenn er nicht der Berichtszeit entspricht")
    b.add_argument("--ausgabe", default="berichte", help="Ausgabeverzeichnis")
    b.add_argument("--tagesergebnis", type=float, default=float(os.environ.get("SPX_TAGESERGEBNIS_EUR", 0) or 0))
    b.add_argument("--offenes-risiko", type=float, default=float(os.environ.get("SPX_OFFENES_RISIKO_EUR", 0) or 0))
    b.add_argument("--zeitpunkt", help="Simulation: ISO-Zeitpunkt, z. B. 2026-10-23T14:00+02:00 (nur Test)")
    sub.add_parser("kalender", help="Handelszeiten der nächsten Tage anzeigen")
    args = ap.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    cfg = config.laden(getattr(args, "config", None))
    jetzt = datetime.now(UTC)

    if args.befehl == "kalender":
        kal = BoersenKalender(cfg["kalender"].get("sonderschliessungen"))
        d = jetzt.date()
        for _ in range(10):
            s = kal.sitzung(d)
            zeiten = (f"{s.eroeffnung_et.astimezone(BERLIN):%H:%M}–{s.schluss_et.astimezone(BERLIN):%H:%M} Berlin"
                      if s.offen else "")
            print(f"{d:%a %d.%m.%Y}  {s.grund:<40} {zeiten}")
            d = d.fromordinal(d.toordinal() + 1)
        return 0

    z = cfg["zeitplan"]
    if args.cron and not cron_slot_passt(args.cron, jetzt, z["bericht_uhrzeit"], z["zeitzone"]):
        print(f"Cron-Slot '{args.cron}' entspricht heute nicht {z['bericht_uhrzeit']} {z['zeitzone']} – kein Lauf.")
        return 0
    simuliert = bool(args.zeitpunkt)
    if simuliert:
        jetzt = datetime.fromisoformat(args.zeitpunkt).astimezone(UTC)
    lauf = pipeline.ausfuehren(cfg, jetzt, tagesergebnis_eur=args.tagesergebnis,
                               offenes_risiko_eur=args.offenes_risiko, simuliert=simuliert)
    text = bericht.erstellen(lauf)
    ziel = Path(args.ausgabe)
    ziel.mkdir(parents=True, exist_ok=True)
    datei = ziel / f"bericht_{lauf.handelstag:%Y-%m-%d}_{jetzt.astimezone(BERLIN):%H%M}.md"
    datei.write_text(text, encoding="utf-8")
    print(f"Bericht geschrieben: {datei}")
    if os.environ.get("GITHUB_OUTPUT"):
        with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as f:
            f.write(f"bericht={datei}\nabbruch={'ja' if lauf.abbruch else 'nein'}\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
