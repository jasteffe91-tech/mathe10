# Architektur und Entscheidungen

## Komponenten

```
lernlabore2/
├── supabase/
│   ├── migrations/            versionierte SQL-Migrationen (Schema, RLS, Funktionen, Testlabor)
│   ├── einspielen/            ERSTINSTALLATION.sql (alle Migrationen für den SQL-Editor)
│   ├── optional/              pg_cron-Löschlauf, Beispiel-Labor-Registrierung
│   └── tests/local/           Supabase-Nachbildung NUR für lokale Tests
├── packages/lab-sdk/          Lernlabor-SDK (TypeScript) → site/sdk/lernlabor-sdk.js (+ .mjs)
├── labs/physik-entdecker/     Testlabor (TypeScript, SVG) → site/labore/physik-entdecker/
├── labs/beispiel-labor/       Minimalvorlage ohne Build (klassisches Skript)
├── apps/student-portal/       Startseite für Lernende → site/index.html
├── apps/teacher-dashboard/    Lehrkraft-Dashboard → site/lehrkraft/
├── apps/local-teacher-tool/   Lehrerprogramm (Python 3.12, Tkinter, PyInstaller)
├── site/                      gebaute, veröffentlichte Webseiten (+ config.js)
├── tools/                     lokale Test-DB, lokaler Testserver (Supabase-Nachbildung)
├── tests/                     Datenbank- und Browser-Tests, Testdaten (fiktiv)
├── scripts/                   Build, Migration, SQL-Bündel, Manifest → SQL
└── docs/                      Architektur, API, Integration, Testbericht
```

## Datenmodell (Schema `lernlabor`, nicht über REST erreichbar)

```
teachers ─┐                        labs ── lab_versions ── lab_tasks
          │                          │
groups ── group_teachers           group_labs (Zuweisung/Durchgang, archivierbar)
   │
participants (UUID, Pseudonym, Status)
   ├── access_codes (HMAC, Gültigkeit, Sperre)
   ├── student_sessions (Token-Hash, Ablauf)
   ├── task_results (Antwort, Daten, Status, richtig, Revision)   ← je (Person, Labor, Aufgabe) genau eine Zeile
   ├── lab_progress (erledigt/gesamt/%, Fortsetzungspunkt)
   └── applied_ops (Idempotenz)
login_failures (HMAC der IP, 24 h)     audit_log (Aktionen ohne Codes/Namen)
lernlabor_private.settings (Code-Pepper, IP-Pepper – nur für Funktionen)
```

## Wesentliche Entscheidungen

### E1 – Webhosting und Datenspeicherung strikt getrennt
Statische Seiten (GitHub Pages/Cloudflare Pages) enthalten keine Daten und keine Geheimnisse. Alle Daten liegen in
Supabase/PostgreSQL. Ein Hosting-Wechsel betrifft nur `config.js`. *Begründung:* GitHub Pages kann keinen Servercode
ausführen; die Trennung macht Wechsel und Tests einfach (Test 16).

### E2 – Schmale RPC-Schnittstelle statt direkter Tabellenzugriffe
Tabellen liegen im Schema `lernlabor`, das PostgREST **nicht** veröffentlicht. Erreichbar sind nur Funktionen in `public`
(`student_*`, `teacher_*`, `admin_*`). *Begründung:* kleine, prüfbare Angriffsfläche; mehrstufige Vorgänge (z. B. Code
neu ausstellen + Sitzungen beenden) laufen atomar in einer Transaktion; Client-Code braucht keine Supabase-Bibliothek
(nur `fetch`), was SDK, Dashboard und Python-Programm schlank hält.

### E3 – Row-Level-Security als zweite Verteidigungslinie
RLS ist auf **allen** Tabellen aktiv. Lehrkraft-Lesefunktionen laufen als `SECURITY INVOKER` – die RLS-Regeln filtern also
tatsächlich auf eigene/geteilte Gruppen. Schreibende Funktionen sind `SECURITY DEFINER` mit expliziter Berechtigungsprüfung,
festem `search_path = ''` und Protokolleintrag. Lernende (Rolle `anon`) haben **keinerlei** Tabellenrechte.

### E4 – Eigene Schülersitzungen statt Supabase-Auth-Konten für Kinder
Kinder sollen keine Konten, E-Mails oder Passwörter haben. `student_login` prüft den Code (HMAC-SHA-256 mit Pepper),
zählt Fehlversuche, und gibt ein 256-Bit-Sitzungstoken aus (gespeichert nur als SHA-256). *Alternativen verworfen:*
anonyme Supabase-Anmeldungen (erzeugen bei jeder Anmeldung neue Auth-Nutzer, Missbrauchsschutz aufwendig);
Code-Vergleich im Browser (unsicher, ausdrücklich ausgeschlossen). Vorteil: Sperren wirkt sofort (Sitzungen werden widerrufen).

### E5 – Codes lokal erzeugen, serverseitig nur HMAC
Das Lehrerprogramm erzeugt Codes mit `secrets` (bzw. das Dashboard mit `crypto.getRandomValues`, Ablehnungsverfahren gegen
Verzerrung). Zur Registrierung wird der Code einmalig über HTTPS im Request-Body gesendet; die Datenbank berechnet
`HMAC(pepper, code)` und verwirft den Klartext. Der Pepper wird **in** der Datenbank erzeugt und verlässt sie nie.
Deterministischer HMAC erlaubt die Suche per Index; die hohe Entropie (59 Bit bei 12 Zeichen) plus Fehlversuchsbegrenzung
macht Raten aussichtslos. Gastcodes haben 8 Zeichen (≈ 40 Bit) und sind zeitlich eng begrenzt.

### E6 – Offline-Warteschlange mit Idempotenz und optimistischer Sperre
Jede Änderung wird **zuerst** in IndexedDB geschrieben, dann nacheinander übertragen. Jede Operation trägt eine zufällige
`op_id` (Wiederholung ⇒ „duplicate“, keine Doppelung) und die zuletzt bestätigte `revision` (veraltet ⇒ „conflict“,
Serverstand gewinnt, Ereignis an das Labor). Noch nicht gesendete Änderungen derselben Aufgabe werden zusammengefasst.
„Abgeschlossen“ bleibt abgeschlossen. Die Anzeige unterscheidet strikt *gespeichert* (Server bestätigt) von *ausstehend*.

### E7 – Sitzung standardmäßig nur im Tab
`sessionStorage` statt `localStorage`: Auf geteilten Schulgeräten ist nach dem Schließen des Browsers niemand mehr angemeldet.
Neuanmeldung mit demselben Code stellt alles wieder her. Ausstehende Änderungen bleiben in IndexedDB und werden bei der
nächsten Anmeldung **derselben** Person übertragen (Zuordnung über einen stabilen, nicht sprechenden Schlüssel).
Konfigurierbar (`sessionPersistence: 'device'`).

### E8 – Polling statt Echtzeit-Kanal im Dashboard
Alle 15 Sekunden (pausiert bei verborgenem Tab). Einfach, robust hinter Schul-Proxys, ausreichend laut Anforderung,
keine zusätzliche Realtime-Konfiguration für RLS nötig.

### E9 – Schlanke Technik ohne Framework
TypeScript ohne UI-Framework, gebaut mit esbuild; Ausgabe sind wenige statische Dateien. Bestehende Labore (klassisches
JavaScript in einer HTML-Datei) können das SDK per `<script>` einbinden – ohne Build-Schritt. Einzige Laufzeitbibliothek:
`qrcode-generator` (MIT) im Dashboard.

### E10 – Lehrerprogramm in Python/Tkinter
Tkinter ist in Python enthalten (keine GUI-Abhängigkeit), PyInstaller erzeugt eine einzelne EXE. Kryptografie über
`cryptography` (AES-256-GCM) und `argon2-cffi` (Argon2id, 64 MiB, t=3, p=4); PDF über ReportLab (inkl. QR-Codes),
Excel über openpyxl, Anmeldespeicher über `keyring`. Netzwerk nur über die Standardbibliothek.

### E11 – Demo-Modus als eigenständiges Backend im Browser
`DemoTransport` implementiert dieselben RPC-Funktionen auf `localStorage` – klar gekennzeichnet, ohne Server.
Dient als Notfallplan für Vorführungen und als schnelle Testumgebung für SDK-Logik.

### E12 – Lokaler Testserver mit echter Datenbanklogik
Für automatische Tests wird nicht gemockt: Der Testserver ruft die **echten** SQL-Funktionen in PostgreSQL mit denselben
Rollen (`anon`/`authenticated`), JWT-Claims und Request-Headern auf wie PostgREST. Damit sind RLS, Rechte und
Transaktionen real getestet. Abweichungen zum echten Supabase-Gateway (z. B. Header wie `cf-connecting-ip`) sind im
Testbericht als manuell zu prüfen vermerkt.

## Sicherheitsrelevante Abläufe

**Anmeldung:** Code normalisieren → Fehlversuche je HMAC(IP) und global zählen → Format prüfen → HMAC → Zeile suchen →
gesperrt/abgelaufen/noch nicht gültig? → Token (32 Byte Zufall) erzeugen, Hash speichern, Ablauf ≤ 12 h und ≤ Code-/Gruppengültigkeit.

**Speichern:** Sitzung prüfen (Token-Hash, nicht widerrufen/abgelaufen, Person aktiv, Code gültig, Gruppe aktiv) →
`op_id` schon verarbeitet? → Labor der Gruppe zugewiesen? → Aufgabe existiert in dieser Version? → Größenlimits (16/32 KB) →
Zeile sperren (`FOR UPDATE`) → Revision vergleichen → schreiben → Fortschritt neu berechnen → Antwort.

**Code neu ausstellen:** alte Codes widerrufen + deren Sitzungen widerrufen + neuen HMAC speichern – in einer Transaktion.

## Skalierung

Erwartet: 30–100 gleichzeitig arbeitende Kinder. Gespeichert wird nur nach abgeschlossenen Schritten (ca. 6–10 Anfragen je
Kind und Labor), das Dashboard fragt alle 15 s ab. Lokaler Lasttest: 100 gleichzeitige Lernende × 6 Speicherungen ohne
Fehler (Median 93 ms, lokal). Fehlversuchsgrenze 60/10 min je Anschluss berücksichtigt, dass ganze Schulen über eine IP ins
Internet gehen – erfolgreiche Anmeldungen zählen nicht mit.
