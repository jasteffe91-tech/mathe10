# Installation – Schritt für Schritt

Diese Anleitung richtet das System **einmalig** ein. Rechne mit etwa 45 Minuten.
Du brauchst keine Programmierkenntnisse; an einigen Stellen kopierst du nur Text.

> **Vor dem Einsatz mit echten Schülerdaten:** zuerst die
> [DATENSCHUTZ-PRUEFLISTE.md](DATENSCHUTZ-PRUEFLISTE.md) mit Schulleitung und
> Datenschutzbeauftragter/m durchgehen. Bis dahin nur mit fiktiven Daten oder im Demo-Modus arbeiten.

Bildschirmbeschriftungen von Supabase, GitHub und Cloudflare ändern sich gelegentlich.
Stand dieser Anleitung: **November 2026**. Wenn ein Menüpunkt anders heißt, hilft die Suche im jeweiligen Dienst.

---

## Überblick

| Schritt | Was | Wo | Dauer |
|---|---|---|---|
| 1 | Supabase-Projekt anlegen (Region Frankfurt) | supabase.com | 10 min |
| 2 | Datenbank einrichten (eine SQL-Datei einfügen) | Supabase → SQL Editor | 5 min |
| 3 | Lehrkraft-Konto anlegen und freischalten | Supabase → Authentication | 5 min |
| 4 | Webseite mit dem Server verbinden (`config.js`) | GitHub | 5 min |
| 5 | Webseite veröffentlichen (GitHub Pages **oder** Cloudflare Pages) | GitHub / Cloudflare | 5 min |
| 6 | Lehrerprogramm installieren und einrichten | Windows-PC | 10 min |
| 7 | Funktionstest | Browser + Lehrerprogramm | 5 min |

---

## Schritt 1 – Supabase-Projekt anlegen

1. Auf <https://supabase.com> ein Konto anlegen (am besten mit einer dienstlichen E-Mail-Adresse).
2. **New project** wählen.
   - *Name*: z. B. `lernlabore-produktiv` (für Tests ein zweites Projekt `lernlabore-test`, siehe [Test- und Produktivsystem](#test--und-produktivsystem-trennen)).
   - *Database Password*: langes, zufälliges Passwort erzeugen und **sicher notieren** (Passwortmanager). Es wird nur für Wartung/Migrationen gebraucht.
   - *Region*: **Central EU (Frankfurt)** (`eu-central-1`).
   - Tarif: Für den Start genügt meist der kostenlose Tarif (Grenzen siehe [HOSTING-VERGLEICH.md](HOSTING-VERGLEICH.md)). Kostenlose Projekte werden nach längerer Inaktivität pausiert – vor einer Vorführung einmal aufrufen.
3. Warten, bis das Projekt bereit ist (1–2 Minuten).

> Der Standort Frankfurt allein macht den Dienst **nicht automatisch DSGVO-konform**. Supabase ist ein US-Unternehmen;
> Auftragsverarbeitungsvertrag, Unterauftragnehmer und mögliche Supportzugriffe müssen geprüft werden (siehe Datenschutz-Prüfliste).

## Schritt 2 – Datenbank einrichten

1. In Supabase links **SQL Editor** öffnen → **New query**.
2. Die Datei [`supabase/einspielen/ERSTINSTALLATION.sql`](supabase/einspielen/ERSTINSTALLATION.sql) öffnen
   (auf GitHub: Datei anklicken → Symbol „Copy raw file“), den **gesamten Inhalt** einfügen.
3. **Run** klicken. Es sollte „Success. No rows returned“ erscheinen.

Was dabei passiert: Es werden die Tabellen im nicht öffentlichen Schema `lernlabor` angelegt, Row-Level-Security
aktiviert, alle Server-Funktionen erstellt, das Testlabor „Physik-Entdecker“ registriert und ein zufälliges
serverseitiges Geheimnis für die Zugangscodes **in der Datenbank selbst** erzeugt (es verlässt die Datenbank nie).

> Die Datei nur **einmal** auf einer leeren Datenbank ausführen. Spätere Aktualisierungen: siehe [Updates](#updates-einspielen).

## Schritt 3 – Lehrkraft-Konto anlegen

1. Supabase → **Authentication** → **Users** → **Add user** → **Create new user**.
   E-Mail und ein sicheres Passwort eingeben, „Auto Confirm User“ aktivieren.
2. Das Konto als Lehrkraft (mit Verwaltungsrechten) freischalten: **SQL Editor** → New query:
   ```sql
   select lernlabor_private.bootstrap_teacher('deine.adresse@schule.de', 'Hr. S.', true);
   ```
   (E-Mail anpassen. Der zweite Wert ist ein Anzeigename, der dritte bedeutet „Administrator/in“.)
3. **Selbstregistrierung abschalten:** Authentication → *Sign In / Providers* (bzw. *Settings*) →
   „**Allow new users to sign up**“ ausschalten. So können nur von dir angelegte Konten existieren.
   (Selbst wenn sich jemand registrieren könnte: Ohne Freischaltung als Lehrkraft sieht das Konto keinerlei Daten.)
4. Weitere Kolleginnen/Kollegen: wie in 1. anlegen, dann im SQL Editor
   `select lernlabor_private.bootstrap_teacher('kollegin@schule.de', 'Fr. M.', false);`

## Schritt 4 – Webseite mit dem Server verbinden

1. Supabase → **Project Settings** → **API Keys** (bzw. **Data API**):
   - **Project URL** kopieren (z. B. `https://abcdefghijklmnop.supabase.co`),
   - den **öffentlichen** Schlüssel kopieren: „**Publishable key**“ (`sb_publishable_…`) oder – bei älteren Projekten – „**anon public**“.
2. **Niemals** den „Secret key“ (`sb_secret_…`) bzw. „service_role“-Schlüssel verwenden – er umgeht alle Sicherheitsregeln.
   Das Lehrerprogramm lehnt ihn ab, falls er versehentlich eingetragen wird.
3. In GitHub im Repository die Datei `lernlabore2/site/config.js` öffnen → Stift-Symbol (bearbeiten) und eintragen:
   ```js
   supabaseUrl: 'https://abcdefghijklmnop.supabase.co',
   supabaseAnonKey: 'sb_publishable_...',
   ```
   Unten „Commit changes“. Der öffentliche Schlüssel **darf** öffentlich sein – die Sicherheit liegt in den
   Datenbankregeln (Row-Level-Security und geprüfte Funktionen).
4. Solange die Werte leer sind, laufen alle Seiten im gekennzeichneten **Demo-Modus** (fiktive Daten, nichts wird online gespeichert).

## Schritt 5 – Webseite veröffentlichen

### Variante A: GitHub Pages (empfohlen, da bereits genutzt)

Das Repository wird bereits über GitHub Pages veröffentlicht. Der Ordner `lernlabore2/site/` enthält die fertig
gebauten Seiten und wird automatisch mit ausgeliefert, sobald er im veröffentlichten Branch (meist `main`) liegt:

- Startseite für Lernende: `https://<benutzername>.github.io/mathe10/lernlabore2/site/`
- Testlabor: `…/lernlabore2/site/labore/physik-entdecker/`
- Lehrkraft-Dashboard: `…/lernlabore2/site/lehrkraft/`

Prüfen unter GitHub → *Settings* → *Pages*: „Deploy from a branch“, Branch `main`, Ordner `/ (root)`.
HTTPS ist bei GitHub Pages automatisch aktiv („Enforce HTTPS“ angehakt lassen).

### Variante B: Cloudflare Pages

1. <https://dash.cloudflare.com> → *Workers & Pages* → *Create* → *Pages* → *Connect to Git* → Repository wählen.
2. Einstellungen: *Framework preset*: None · *Build command*: leer lassen (die Seiten sind schon gebaut) ·
   *Build output directory*: `lernlabore2/site`.
3. *Save and Deploy*. Jede Änderung im Branch wird automatisch veröffentlicht; andere Branches erhalten Vorschau-Adressen.
   Adresse z. B. `https://lernlabore.pages.dev/labore/physik-entdecker/`.

Eigene Domain (z. B. `labor.meine-schule.de`), Subdomains, HTTPS und CORS: siehe [HOSTING-VERGLEICH.md](HOSTING-VERGLEICH.md#eigene-domain-https-und-cors).

## Schritt 6 – Lehrerprogramm installieren

**Variante 1 – fertige EXE (empfohlen):**
1. GitHub → *Actions* → „**Lernlabore 2.0 – Lehrerprogramm (Windows-EXE)**“ → *Run workflow*.
2. Nach ca. 5 Minuten im Lauf unter *Artifacts* „Lernlabor-Lehrerprogramm-Windows“ herunterladen und entpacken.
3. Die Datei `SHA256.txt` enthält die Prüfsumme. Kontrolle in PowerShell: `Get-FileHash .\Lernlabor-Lehrerprogramm.exe`.
4. Beim ersten Start zeigt Windows SmartScreen bei **nicht signierten** Programmen eine Warnung
   („Der Computer wurde durch Windows geschützt“). Das ist bei selbst gebauter Software normal und kein Hinweis auf Schadsoftware.
   Sauberer Weg: Prüfsumme vergleichen und die EXE von der Schul-IT freigeben lassen; dauerhaft lässt sich die Warnung nur mit
   einem Code-Signing-Zertifikat vermeiden. Auf Dienstgeräten mit Richtlinien bitte die IT einbeziehen und keine Schutzfunktionen abschalten.

**Variante 2 – ohne EXE:** Python 3.12 von python.org installieren, dann im Ordner `apps/local-teacher-tool` die Datei
`start_ohne_exe.bat` doppelklicken (installiert beim ersten Mal die Abhängigkeiten).

**Selbst bauen:** `apps/local-teacher-tool/build_windows.bat` (erzeugt `dist\Lernlabor-Lehrerprogramm.exe`).

**Ersteinrichtung im Programm:**
1. Beim ersten Start einen **Tresor** anlegen: Passwort mit mindestens 10 Zeichen, gut merken/notieren.
   Ohne dieses Passwort sind die Namen nicht wiederherstellbar.
2. Menü *Einstellungen → Server-Verbindung*: Supabase-URL, **öffentlicher** Schlüssel, deine E-Mail,
   Adresse der Lernlabore (z. B. `https://<benutzername>.github.io/mathe10/lernlabore2/site/`) und einen **lokalen** Ordner für Berichte.
3. Beim ersten Synchronisieren fragt das Programm nach deinem Supabase-Passwort. Danach wird nur ein
   Erneuerungstoken im Windows-Anmeldespeicher (Anmeldeinformationsverwaltung) abgelegt – das Passwort selbst nie.
4. Speicherorte: Tresor `%APPDATA%\Lernlabore2\tresor.llv`, Einstellungen `%APPDATA%\Lernlabore2\einstellungen.json`
   (enthält keine Geheimnisse). Regelmäßig über *Datei → Verschlüsselte Sicherung erstellen* sichern (z. B. auf einen USB-Stick).

## Schritt 7 – Funktionstest (mit fiktiven Daten)

1. Lehrerprogramm: **Demo-Klasse (fiktiv) anlegen** → **Mit Online-Datenbank synchronisieren**.
2. Schülerliste anzeigen, **Codes anzeigen** anhaken, einen Code (z. B. von „Max Mustermann“) notieren.
3. Testlabor im Browser öffnen, Code eingeben, eine Vermutung wählen → unten erscheint „Gespeichert“.
4. Dashboard öffnen und anmelden → die Demo-Gruppe zeigt den neuen Fortschritt (spätestens nach 15 Sekunden).
5. Lehrerprogramm: **Lernstände jetzt abrufen** → in der Auswertung steht „Max Mustermann“ mit Fortschritt.
6. **PDF-Auswertung erstellen**.

Wenn alles klappt, ist das System betriebsbereit. Eine detaillierte Liste der manuellen Prüfungen steht in
[docs/TESTBERICHT.md](docs/TESTBERICHT.md#manuell-durchzuführende-tests).

---

## Löschfristen automatisch anwenden (optional, empfohlen)

Abgelaufene Gruppen werden beim Öffnen des Dashboards automatisch gelöscht. Zusätzlich kann die Datenbank das
täglich selbst tun: Supabase → *Database* → *Extensions* → `pg_cron` aktivieren, dann
[`supabase/optional/pg_cron_loeschlauf.sql`](supabase/optional/pg_cron_loeschlauf.sql) im SQL Editor ausführen.

## Updates einspielen

Neue Datenbank-Migrationen (Dateien in `supabase/migrations/`) werden **nicht** automatisch eingespielt.

- **Einfach:** den Inhalt der neuen Migrationsdatei im SQL Editor ausführen und danach
  `insert into lernlabor_private.angewendete_migrationen (version) values ('<Dateiname ohne .sql>');`
- **Automatisiert:** GitHub → *Settings* → *Environments* → `test` und `produktiv` anlegen, jeweils das Secret
  `SUPABASE_DB_URL` (Supabase → *Connect* → Connection string, mit Datenbank-Passwort) hinterlegen.
  Dann *Actions* → „Lernlabore 2.0 – Datenbank-Migrationen“ → Umgebung wählen → erst mit „Nur anzeigen“, dann ohne.
  Für `produktiv` unter *Environments* „Required reviewers“ aktivieren.

## Test- und Produktivsystem trennen

| | Testsystem | Produktivsystem |
|---|---|---|
| Supabase-Projekt | `lernlabore-test` (nur fiktive Daten) | `lernlabore-produktiv` |
| Webseite | Cloudflare-Vorschau eines Test-Branches **oder** Kopie von `site/` mit eigener `config.js` | GitHub Pages / Cloudflare (Branch `main`) |
| `config.js` | `environmentLabel: 'TESTSYSTEM – keine echten Schülerdaten'` (wird als Banner angezeigt) | Label leer |
| GitHub-Environment | `test` | `produktiv` (mit Freigabe) |
| Lehrerprogramm | eigener Tresor (*Einstellungen*: anderer Pfad) | Standard-Tresor |

## Neues Lernlabor registrieren

```bash
node scripts/manifest-to-sql.mjs labs/mein-labor/lab.manifest.json > mein-labor.sql
```
Den Inhalt von `mein-labor.sql` im SQL Editor ausführen und das Labor im Dashboard (Verwaltung) einer Gruppe zuweisen.
Details: [docs/INTEGRATION-10-SCHRITTE.md](docs/INTEGRATION-10-SCHRITTE.md).

## Für Entwicklung und Tests (optional)

Voraussetzungen: Node.js 20+, PostgreSQL 15+ (nur Programme, kein laufender Dienst nötig), Python 3.12.

```bash
cd lernlabore2
npm ci
npm run db:reset          # lokale Testdatenbank auf Port 54329 inkl. Supabase-Nachbildung
npm run dev -- --seed     # http://localhost:8787 – Testlehrkraft lehrkraft@test.local / test-passwort-123
npm test                  # alle automatischen Tests
python3.12 -m venv .venv && .venv/bin/pip install -r apps/local-teacher-tool/requirements-dev.txt
npm run test:python
```
Der lokale Testserver bildet nur die benötigten Supabase-Schnittstellen nach und ist **nicht** für den Unterrichtsbetrieb gedacht.
