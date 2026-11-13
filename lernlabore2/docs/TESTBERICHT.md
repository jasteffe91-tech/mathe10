# Testbericht

**Stand:** 13.11.2026 · **Umgebung:** Linux-Container, Node.js 22, PostgreSQL 16 (lokal, mit Supabase-Nachbildung),
Chromium (Playwright 1.63), Python 3.12, Xvfb.
**Wichtig:** Alle automatischen Tests liefen gegen eine **lokale** PostgreSQL-Datenbank mit **denselben Migrationen** wie
für Supabase und einen lokalen Testserver, der die Supabase-Schnittstellen (PostgREST-RPC, Auth) nachbildet. Ein echtes
Supabase-Projekt, ein echter Windows-PC und echte Tablets standen nicht zur Verfügung – die entsprechenden Prüfungen sind
unten als **manuell** markiert. Es wurden keine Ergebnisse erfunden.

## Zusammenfassung der automatischen Läufe

| Suite | Befehl | Ergebnis |
|---|---|---|
| TypeScript-Typprüfung | `npm run typecheck` | ✅ fehlerfrei |
| SDK- und Modell-Unit-Tests (Vitest) | `npm run test:unit` | ✅ 15 / 15 |
| Datenbanktests (echte SQL-Funktionen, Rollen, RLS) | `npm run test:db` | ✅ 34 / 34 |
| Browser-Ende-zu-Ende (Chromium) | `npm run test:e2e` | ✅ 11 / 11 |
| Lehrerprogramm inkl. GUI und Online-Ablauf (pytest, Xvfb) | `npm run test:python` mit Testserver | ✅ 19 / 19 |
| Lasttest (Skript, lokal): 100 gleichzeitige Lernende × Anmeldung + Laden + 6 Speicherungen | einmalig | ✅ 600/600 gespeichert, 0 Fehler, Median 93 ms, max. 147 ms (nur lokal aussagekräftig) |
| Windows-EXE-Bauplan (PyInstaller) unter Linux gebaut und gestartet | `pyinstaller lernlabor-lehrerprogramm.spec` | ✅ startet (zeigt Tresor-Dialog); unter Windows: manuell |
| SQL-Gesamtdatei und Migrationsskript auf leerer Datenbank | `bundle-sql.mjs`, `migrate.mjs` | ✅ eingespielt, zweiter Lauf erkennt „bereits angewendet“ |
| Adapter für bestehende Stationen-Labore (temporäre Kopie von „Arbeit und Leistung“, Demo-Modus) | Playwright-Skript | ✅ Name ausgeblendet, Antwort gespeichert und wiederhergestellt |

Während der Entwicklung gefundene und behobene Fehler (Auszug): zu frühe Neuzeichnung nach Auswahl (Weiter blieb grau),
ungültige CSS-Schriftangaben, Demo-Banner überdeckte Kopfzeile, Abschlusstext behauptete Speicherung unabhängig vom
Serverstatus, instabile Warteschlangenverarbeitung bei parallelen Aufrufen, CSV mit einer Namensspalte, fehlende
ReportLab-Module in der EXE, Demo-Freihaltung der Vorführpersonen.

## Die 16 Pflicht-Testszenarien

| # | Szenario | Status | Nachweis |
|---|---|---|---|
| 1 | CSV mit 30 fiktiven Schülern importieren | ✅ automatisch | `test_import_30_fiktive_schueler_utf8`, `test_gui_import_codes_karten` (GUI: 30 Zeilen), Windows-1252/Komma/Dubletten: `test_import_excel_windows1252_komma_und_dubletten` |
| 2 | eindeutiger, sicherer Code je Schüler | ✅ automatisch | 5 000 Codes eindeutig + Format (Python), 2 000 (SDK), 30 eindeutige Codes/Kennungen/IDs je Klasse |
| 3 | Codes ohne Klarnamen registriert | ✅ automatisch | gesendete Nutzdaten enthalten nur `id/pseudonym/code`; **`pg_dump` der gesamten Datenbank nach echter Synchronisierung enthält keinen Namen und keinen Rohcode**; Datenbank speichert nur HMAC (kein ungesalzener SHA-256) |
| 4 | Anmeldung mit Code am Lernlabor | ✅ automatisch | E2E „Test 4 + 5“ (keine Namens-/E-Mail-Felder vorhanden), DB-Tests (tolerante Eingabe) |
| 5 | Vermutung beantworten → gespeichert | ✅ automatisch | E2E: Anzeige „Gespeichert“ erst nach Serverbestätigung, Datensatz in der DB geprüft |
| 6 | Browser schließen, neu anmelden → Stand wiederhergestellt | ✅ automatisch | E2E (neuer Browserkontext ohne Sitzung): Aufgabe, Antwort, Fortschritt, „Willkommen zurück“; SDK-Unit-Test |
| 7 | offline weiterarbeiten → später übertragen | ✅ automatisch | E2E „Test 7“ (Offline, Neuaufruf nach Verbindungsrückkehr, IndexedDB) und „Test 7b“ (3 Versuchsläufe offline, automatische Übertragung); SDK: Browser-Neustart mit IndexedDB |
| 8 | Fortschritt im Dashboard innerhalb des Intervalls | ✅ automatisch | E2E: Lehrkraft meldet sich im Dashboard an, Fortschritt erscheint ≤ 16 s nach dem Speichern |
| 9 | Lehrerprogramm ruft ab und ordnet offline Namen zu | ✅ automatisch | GUI-Online-Test: Abruf über HTTP, „Erika Musterfrau“ erscheint; Tresor ohne Server erneut geöffnet → Auswertung vorhanden |
| 10 | Zugriff auf fremde Teilnehmer-ID verweigert | ✅ automatisch | `anon` kann keine Tabelle lesen; Lernfunktionen haben keinen Parameter für fremde IDs (zusätzliche Parameter → 404); fremde Lehrkraft: RLS liefert 0 Zeilen, Funktionen → 403; HMAC-Spalte nicht lesbar |
| 11 | falscher/gesperrter Code abgelehnt | ✅ automatisch | DB- und E2E-Tests inkl. verständlicher Meldungen; Neuausstellung macht alten Code und Sitzungen ungültig; Rateversuchsgrenze |
| 12 | doppelte Speicherversuche ohne Doppelabschluss | ✅ automatisch | DB: gleiche `op_id` → „duplicate“, eine Zeile; SDK: verlorene Serverantwort → 2 Sendungen, Revision 1; Konfliktschutz |
| 13 | Gastcode bearbeitet Labor ohne personenbezogene Angaben | ✅ automatisch | E2E: 20 Gastzugänge im Dashboard erzeugt, Gast per QR-Fragment (iPad-Emulation) bis zur Urkunde, 100 %; Code aus der Adresse entfernt; „Veranstaltung beenden“ sperrt (DB) |
| 14 | Lehrerprogramm erzeugt PDF-Auswertung | ✅ automatisch | alle PDF-Arten, XLSX, CSV erzeugt und als gültige Dateien geprüft; anonymer Bericht ohne Namen. *Optische Prüfung der PDFs: manuell* |
| 15 | Testlabor auf Smartphone, Tablet, Desktop | ✅ automatisch (Emulation) / ⏳ manuell (echte Geräte) | Chromium mit iPhone-13-, iPad- und Desktop-Profil: kein seitliches Scrollen, Bedienelemente ≥ 44 px; **echte Geräte und Safari/iPadOS noch manuell** |
| 16 | Daten bleiben nach regulärem Deployment erhalten | ✅ automatisch (lokal) | Webseite neu gebaut, Server neu gestartet, gleiche DB → Stand vorhanden. *Mit echtem GitHub-Pages-Deployment: manuell* |

## Weitere automatisch geprüfte Punkte

- Sperren beendet laufende Sitzungen sofort; Abmelden widerruft die Sitzung serverseitig.
- IP-Adressen werden nicht im Klartext gespeichert; Audit-Protokoll enthält keine Codes.
- Größenlimits, unbekannte Aufgaben, nicht zugewiesene/archivierte Labore werden abgelehnt.
- „Abgeschlossen“ bleibt abgeschlossen; „beim ersten Versuch richtig“ wird getrennt festgehalten.
- Lösungen werden nicht an Lernende ausgeliefert.
- Teilen einer Gruppe mit einer Kollegin; nur die Besitzerin darf löschen.
- Löschfristen: abgelaufene Gruppen werden mit allen Daten gelöscht; gezieltes Löschen je Labor.
- Demo-Daten nur in Demo-Gruppen, als fiktiv gekennzeichnet; Vorführpersonen bleiben leer.
- Tresor: falsches Passwort, Manipulation des Dateikopfs, Sicherung/Wiederherstellung mit eigenem Passwort, Mindestlänge.
- Synchronisierung markiert erst nach Serverbestätigung; bei Serverfehler kein „synchronisiert“-Stempel.
- Lehrerprogramm lehnt geheime Schlüssel und unverschlüsselte Server-Adressen ab; CSV/XLSX gegen Formel-Injektion geschützt.
- Benutzerwechsel auf geteiltem Gerät: fremde ausstehende Daten werden weder angezeigt noch unter falscher Person übertragen.

## Manuell durchzuführende Tests

Diese Punkte benötigen externe Zugänge oder Geräte und sind **noch offen**:

| # | Prüfung | Warum offen | Letzter notwendiger Schritt |
|---|---|---|---|
| M1 | Kompletter Ablauf gegen **echtes Supabase-Projekt** (Login, Speichern, Dashboard, Abruf) | kein Supabase-Zugang in der Entwicklungsumgebung | INSTALLATION.md Schritte 1–7 durchführen |
| M2 | Rate-Limit hinter Supabase-Gateway (Header `cf-connecting-ip`/`x-forwarded-for`) | Gateway nur nachgebildet | 61 falsche Codes von einem Gerät eingeben → „Zu viele Versuche“; anderes Netz (Hotspot) funktioniert |
| M3 | Publishable-Key (`sb_publishable_…`) und Legacy-anon-Key mit echtem Gateway | nur nachgebildet | Schritt 4 der Installation, dann M1 |
| M4 | Windows-EXE bauen und auf Windows 10/11 starten; Anmeldespeicher (Credential Manager); SmartScreen-Verhalten | kein Windows-System | Workflow „Lehrerprogramm (Windows-EXE)“ starten, EXE testen |
| M5 | Echte Tablets/Smartphones (iPadOS-Safari, Android-Chrome), QR-Code mit Kamera scannen | keine Geräte | Zugangskarten drucken, mit iPad scannen |
| M6 | Ausdruck Zugangskarten (Schnittlinien, Lesbarkeit) und Urkunde | kein Drucker | je ein Probedruck |
| M7 | Veröffentlichung über GitHub Pages / Cloudflare Pages inkl. CSP im echten Browser | Deployment erst nach Merge | Branch nach `main` übernehmen, Seiten aufrufen, Browser-Konsole auf CSP-Fehler prüfen |
| M8 | GitHub-Actions-Workflows (Tests, EXE, Migrationen) | laufen erst im Repository | Tab „Actions“ prüfen |
| M9 | pg_cron-Löschlauf in Supabase | Erweiterung nur in Supabase | optional, siehe INSTALLATION.md |
| M10 | Last mit echten Netzwerkbedingungen (30–100 Geräte im Schul-WLAN) | nur lokal getestet | Probelauf mit einer Klasse |

## Tests selbst ausführen

```bash
cd lernlabore2
npm ci && npm test                              # Typen, Unit, Datenbank, Build, Browser
npm run db:reset && npm run dev -- --seed &     # Testserver für den Python-Online-Test
cd apps/local-teacher-tool
LERNLABOR_TEST_SERVER=http://localhost:8787 LERNLABOR_TEST_DB_URL=postgres://postgres@127.0.0.1:54329/lernlabore_test \
  xvfb-run -a ../../.venv/bin/python -m pytest -v tests
```
