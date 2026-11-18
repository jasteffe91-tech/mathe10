# Online-Lernlabore 2.0

Interaktive Lernlabore mit **automatischer, pseudonymer Lernstandsspeicherung**.
Schülerinnen und Schüler melden sich nur mit einem **Zugangscode** an (kein Name, keine E-Mail),
ihre Ergebnisse werden nach jeder Aufgabe gespeichert und sie können jederzeit weitermachen.
Die Lehrkraft sieht den Fortschritt online **pseudonym** und ordnet die Ergebnisse erst
**lokal auf dem eigenen Rechner** den echten Namen zu.

> **Status (13.11.2026):** Kernsystem implementiert und lokal automatisiert getestet
> (Datenbank, SDK, Testlabor, Dashboard, Lehrerprogramm). Für den Echtbetrieb fehlen nur noch
> die Einrichtung eines Supabase-Projekts und die schulischen Freigaben – siehe
> [Was noch zu tun ist](#was-du-noch-selbst-erledigen-musst).

## So funktioniert es

```
 ┌──────────────────────┐   nur pseudonym (Kennung P-8F2A,     ┌───────────────────────────┐
 │ Lernlabor im Browser │   Antworten, Messwerte)              │ Supabase (PostgreSQL, EU) │
 │ (GitHub/Cloudflare   │ ───────────── HTTPS ───────────────▶ │ Row-Level-Security        │
 │  Pages, statisch)    │   Code wird serverseitig geprüft     │ Codes nur als HMAC        │
 └──────────────────────┘                                      └─────────────┬─────────────┘
           ▲  Zugangskarte mit Code/QR                                       │ pseudonym
           │                                                                 ▼
 ┌──────────────────────────────────────────────┐            ┌───────────────────────────┐
 │ Lokales Lehrerprogramm (Windows-EXE)          │ ◀───────── │ Lehrkraft-Dashboard       │
 │ verschlüsselter Tresor: Name ↔ Kennung ↔ Code │  Abruf     │ (Browser, nur Kennungen)  │
 │ → namentliche Auswertung, PDF, Excel          │            └───────────────────────────┘
 └──────────────────────────────────────────────┘
```

**Klarnamen verlassen nie den Rechner der Lehrkraft.** Der Server kennt nur zufällige IDs,
Kennungen wie `P-8F2A` und – statt der Codes – nicht umkehrbare HMAC-Prüfwerte.

## Bestandteile

| Teil | Ort | Zweck |
|---|---|---|
| Datenbank & Sicherheit | `supabase/migrations/` | Tabellen, Row-Level-Security, alle Server-Funktionen (RPC) |
| Lernlabor-SDK | `packages/lab-sdk/` → `site/sdk/` | Anmeldung, Laden, Speichern, Offline-Warteschlange (IndexedDB), Speicheranzeige |
| Testlabor „Physik-Entdecker“ | `labs/physik-entdecker/` → `site/labore/physik-entdecker/` | Klasse 4: rollende Kugel + Stromkreis, 6 Aufgaben, Urkunde |
| Beispiel-Labor | `labs/beispiel-labor/` | minimale Vorlage für neue Labore (ohne Build-Schritt) |
| Startseite für Lernende | `apps/student-portal/` → `site/index.html` | Anmeldung und Liste der freigeschalteten Labore |
| Lehrkraft-Dashboard | `apps/teacher-dashboard/` → `site/lehrkraft/` | Fortschritt, Aufgabenanalyse, Antworten, Gastzugänge, Verwaltung |
| Lokales Lehrerprogramm | `apps/local-teacher-tool/` | CSV-Import, Codes, Karten, Sync, Abruf, Namenszuordnung, PDF/XLSX/CSV |
| Tests | `tests/`, `packages/lab-sdk/tests/`, `apps/local-teacher-tool/tests/` | Datenbank-, Unit-, Browser- und Python-Tests |
| Lokaler Testserver | `tools/` | bildet Supabase (REST/RPC + Auth) für Tests nach – nicht für den Betrieb |

`site/` ist der fertig gebaute, veröffentlichte Teil (wird von GitHub Pages direkt ausgeliefert).

## Dokumentation

| Datei | Inhalt |
|---|---|
| [SCHNELLSTART.md](SCHNELLSTART.md) | In 5 Minuten zur ersten Vorführung (Demo-Modus) |
| [INSTALLATION.md](INSTALLATION.md) | Einrichtung Schritt für Schritt (Supabase, Webseite, Lehrerprogramm) |
| [SCHUELERZUGAENGE.md](SCHUELERZUGAENGE.md) | Klassen importieren, Codes erzeugen, verteilen, sperren; Gastmodus |
| [AUSWERTUNG.md](AUSWERTUNG.md) | Lernstände abrufen, Namen zuordnen, Berichte erstellen |
| [HOSTING-VERGLEICH.md](HOSTING-VERGLEICH.md) | GitHub Pages, Cloudflare Pages, Firebase – Kosten, Grenzen, Datenschutz |
| [DATENSCHUTZ-PRUEFLISTE.md](DATENSCHUTZ-PRUEFLISTE.md) | Technische und organisatorische Prüfpunkte vor dem Echtbetrieb |
| [FORTBILDUNG.md](FORTBILDUNG.md) | 15-Minuten-Vorführung, Checkliste, Notfallplan, FAQ |
| [docs/ARCHITEKTUR.md](docs/ARCHITEKTUR.md) | Architekturentscheidungen und Begründungen |
| [docs/API.md](docs/API.md) | SDK- und Server-Schnittstelle |
| [docs/INTEGRATION-10-SCHRITTE.md](docs/INTEGRATION-10-SCHRITTE.md) | Ein bestehendes GitHub-Lernlabor in 10 Schritten integrieren |
| [docs/TESTBERICHT.md](docs/TESTBERICHT.md) | Welche Tests automatisch liefen – und welche noch manuell nötig sind |

## Was funktioniert (lokal automatisiert getestet)

- Schülerliste aus CSV importieren (UTF-8/Windows-1252, `;` `,` Tab, Dubletten- und Formatprüfung)
- Kryptografisch zufällige, gut lesbare Zugangscodes (`K7QP-M4XR-9TBA`, ohne 0/O/1/I/L), Zugangskarten mit QR-Code
- Verschlüsselter lokaler Tresor (AES-256-GCM, Argon2id), verschlüsselte Sicherung/Wiederherstellung
- Synchronisierung ohne Klarnamen; „synchronisiert“ erst nach Serverbestätigung
- Anmeldung nur mit Code, serverseitig geprüft (HMAC + Geheimnis, Begrenzung von Rateversuchen, Sitzungen)
- Automatisches Speichern nach jeder Aufgabe, ehrliche Anzeige („Gespeichert“ nur nach Serverbestätigung)
- Offline weiterarbeiten (IndexedDB-Warteschlange), automatische Übertragung, keine Doppelungen, Konflikterkennung
- Fortsetzen nach Browser-Neustart am letzten Arbeitsschritt
- Dashboard mit Auto-Aktualisierung (15 s), Aufgabenanalyse (häufig falsch beantwortete Aufgaben), Export, Archiv, Löschen
- Gastmodus für Veranstaltungen (Gastcodes, Gültigkeitszeitraum, sofort beenden, automatische Löschung)
- Lokale Namenszuordnung, PDF-Klassenübersicht, Einzelauswertungen, offene Aufgaben, anonyme Statistik, XLSX, CSV
- Demo-Modus komplett im Browser (ohne Server), Demo-Klasse mit fiktiven Personen auch online

## Was du noch selbst erledigen musst

1. Supabase-Projekt in der Region Frankfurt anlegen und `supabase/einspielen/ERSTINSTALLATION.sql` ausführen ([INSTALLATION.md](INSTALLATION.md), Schritt 1–3).
2. Server-Adresse und **öffentlichen** Schlüssel in `site/config.js` eintragen und hochladen (Schritt 4).
3. Lehrerprogramm als EXE bauen lassen (GitHub Actions) oder lokal starten (Schritt 6).
4. Datenschutzrechtliche Freigaben der Schule einholen ([DATENSCHUTZ-PRUEFLISTE.md](DATENSCHUTZ-PRUEFLISTE.md)) – **vor** der Nutzung mit echten Schülerdaten.
5. Die als „manuell“ markierten Tests aus [docs/TESTBERICHT.md](docs/TESTBERICHT.md) mit dem echten Supabase-Projekt durchführen.

## Für Entwicklerinnen und Entwickler

```bash
cd lernlabore2
npm ci                      # Abhängigkeiten
npm run build               # site/ bauen
npm run db:reset            # lokale PostgreSQL-Testdatenbank (benötigt PostgreSQL 15+)
npm run dev -- --seed       # lokaler Testserver http://localhost:8787 (Lehrkraft: lehrkraft@test.local / test-passwort-123)
npm test                    # Typprüfung, Unit-, Datenbank- und Browser-Tests
```

Lizenz: MIT. Enthält `qrcode-generator` (MIT, Kazuhiko Arase) im gebauten Dashboard.
