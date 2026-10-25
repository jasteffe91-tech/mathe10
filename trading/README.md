# S&P-500-Analyse – Day- und Swingtrading (Prototyp)

Erstellt an jedem US-Handelstag um 14:00 Uhr (Berlin) einen vorbörslichen Bericht: Marktüberblick,
regelbasierte Setups mit Einstiegsbedingung, Stop, Kurszielen, Positionsgröße und Risiko – oder ausdrücklich
**KEIN TRADE**. Reiner Analysebetrieb: kein Brokerzugriff, keine Orders.

> Die Regeln sind **nicht validiert**. Bis Backtests und Paper-Trading vorliegen, gibt das System höchstens
> WATCHLIST aus. Keine Anlageberatung.

Architektur, Datenquellen, Kosten und Phasenplan: [docs/PHASE1_ARCHITEKTUR.md](docs/PHASE1_ARCHITEKTUR.md)

## Schnellstart

```bash
cd trading
pip install -r requirements.txt
python -m pytest -q                       # Tests (offline)
python -m spx kalender                    # NYSE-Handelszeiten der nächsten Tage in Berliner Zeit
python -m spx bericht                     # Bericht für jetzt -> berichte/
python -m spx bericht --zeitpunkt 2026-10-23T14:00+02:00   # Testlauf mit simuliertem Zeitpunkt
```

An Wochenenden, Feiertagen oder bei unzureichender Datenlage schreibt das Programm einen kurzen Bericht
„Kein Bericht“ mit Begründung, statt eine Analyse vorzutäuschen.

## Konfiguration

- `config/default.yaml` – alle Parameter (Risiko, Kosten, Filter, Feeds, FOMC-Termine, Sonderschließungen).
- `config/lokal.yaml` – persönliche Überschreibungen, wird nicht eingecheckt.
- Umgebungsvariablen / GitHub-Secrets:

| Variable | Zweck | Pflicht |
|---|---|---|
| `SPX_KAPITAL_EUR` | Handelskapital (sonst Annahme 10.000 €) | empfohlen |
| `SPX_TAGESERGEBNIS_EUR`, `SPX_OFFENES_RISIKO_EUR` | heutiges Ergebnis / offenes Risiko für das Tageslimit | optional |
| `SEC_USER_AGENT` | „Name E-Mail“ – von der SEC verlangt | empfohlen |
| `FINNHUB_API_KEY` | Quartalszahlen-Termine (sonst „ungeprüft“) | empfohlen |
| `ALPACA_API_KEY_ID`, `ALPACA_API_SECRET_KEY` | offizielle Kursdaten (`daten.kursquelle: alpaca`) | optional |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORT`, `BERICHT_EMPFAENGER` | Versand per E-Mail | optional |

## Zeitplan (GitHub Actions)

`.github/workflows/sp500-bericht.yml` plant zwei UTC-Läufe (12:00 und 13:00 UTC, Mo–Fr). Das Programm prüft,
welcher davon heute 14:00 Uhr Berlin entspricht, und ob die NYSE handelt. Zeitpläne laufen nur auf dem
Standardbranch. In einem **öffentlichen** Repository wird der Berichtsinhalt nicht in Logs oder Artefakten
abgelegt, sondern nur per E-Mail versendet.

## Aufbau

```
spx/
  kalender.py      NYSE-Kalender, Zeitzonen, Marktphase
  daten/           Kurse (Yahoo dev, Alpaca), Universum (SPY-Bestand), EZB, FRED
  nachrichten.py   RSS/Atom, Tickerzuordnung, Einordnung, Deduplizierung
  termine.py       Quartalszahlen (Finnhub), FOMC
  indikatoren.py   SMA/EMA/RSI/MACD/ATR/VWAP/RVOL/RS, Umkehrpunkte, Kerzen
  umfeld.py        Marktumfeld
  setups.py        Swing- und Day-Regeln
  risiko.py        Kosten, Positionsgröße, Limits, Korrelation
  ziel.py          Realitätsprüfung des Tagesziels
  bericht.py       Markdown-Bericht A–E
  pipeline.py      Ablauf
tests/             Offline-Tests inkl. Ende-zu-Ende mit synthetischen Daten
```
