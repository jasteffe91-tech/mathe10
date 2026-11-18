# Hosting-Vergleich

Das System trennt strikt zwischen
1. **statischem Webhosting** der Lernlabore, der Startseite und des Dashboards (nur HTML/JS/CSS, keine Daten) und
2. **Datenspeicherung** in Supabase (PostgreSQL mit Row-Level-Security, Anmeldung, Server-Funktionen).

Die Webseiten sprechen die Datenbank ausschließlich über HTTPS-Aufrufe an `https://<projekt>.supabase.co/rest/v1/rpc/…`
und `…/auth/v1/…` an. Deshalb lässt sich das Webhosting **ohne Änderung der Datenbanklogik** wechseln – es muss nur
`site/config.js` mitgenommen werden.

> **Preise und Grenzen sind zeitabhängig.** Die Angaben unten stammen aus den Anbieterdokumentationen bzw.
> Tarifübersichten mit Stand **November 2026** und wurden nicht vertraglich geprüft. Vor einer Entscheidung bitte die
> verlinkten Seiten aufrufen. Quellen am Ende.

## Überblick

| | **A: GitHub Pages + Supabase** | **B: Cloudflare Pages + Supabase** | **C: Firebase (nur Vergleich)** |
|---|---|---|---|
| Aufwand | sehr gering – bereits im Einsatz | gering – einmal Repository verbinden | hoch – zweite Backend-Implementierung nötig |
| Veröffentlichung | automatisch aus dem Branch (Ordner `lernlabore2/site/`) | automatisch bei jedem Push, Vorschau-Adressen je Branch | Firebase Hosting + Cloud Functions |
| Kosten Webhosting | kostenlos für öffentliche Repositories | kostenloser Tarif ausreichend | kostenloser Spark-Tarif, darüber nutzungsabhängig |
| Grenzen Webhosting | Seite max. ca. 1 GB, Bandbreite „weiches“ Limit 100 GB/Monat, 10 Builds/Std. (weich) | 500 Builds/Monat, 20 000 Dateien, max. 25 MiB je Datei, Bandbreite laut Drittquellen unbegrenzt | Tageskontingente für Lesen/Schreiben |
| Eigene Domain + HTTPS | ja, automatisch (Let’s Encrypt) | ja, automatisch | ja |
| Eigene HTTP-Header (z. B. CSP) | **nein** (nur `<meta>`-CSP möglich – so umgesetzt) | ja (`_headers`-Datei) | ja |
| Vorschau/Test-Umgebungen | nur über separate Repos/Forks | ja, pro Branch automatisch | ja (Channels) |
| Datenbank | Supabase (PostgreSQL, Region Frankfurt wählbar) | Supabase | Firestore (NoSQL), Region `europe-west3` (Frankfurt) wählbar |
| Anbieter (Sitz) | GitHub (Microsoft, USA) | Cloudflare (USA) | Google (USA) |

**Empfehlung:** Variante A für den Start (bereits vorhanden, null Zusatzaufwand). Variante B, wenn eigene
Sicherheits-Header, Vorschau-Umgebungen für ein Testsystem oder eine Schul-Domain gewünscht sind.
Variante C nur, wenn die Schule bereits Google/Firebase einsetzt – dann müssten die Datenbankfunktionen
(Anmeldung, RLS-Regeln, Idempotenz) in Cloud Functions + Security Rules nachgebaut werden.

## Supabase (Datenspeicherung, beide Varianten A und B)

| Tarif | Preis (Stand 11/2026) | Wichtigste Grenzen / Hinweise |
|---|---|---|
| Free | 0 € | 500 MB Datenbank, 2 Projekte, Projekte werden nach ca. **7 Tagen Inaktivität pausiert** (vor Vorführungen aufrufen!), Bandbreite je nach Quelle 5–10 GB/Monat, kein SLA, kurze Log-Aufbewahrung |
| Pro | ab 25 US-$/Monat je Organisation | kein Pausieren, mehr Speicher/Bandbreite (nutzungsabhängige Zusatzkosten), tägliche Backups |
| Team/Enterprise | deutlich höher | u. a. erweiterte Compliance-Funktionen |

**Bedarf dieses Systems:** sehr gering. Ein Lernstand ist wenige KB groß; 100 gleichzeitig arbeitende Kinder erzeugen
nur einige Speicheraufrufe pro Minute (gespeichert wird nach abgeschlossenen Arbeitsschritten, nicht sekündlich),
das Dashboard fragt alle 15 Sekunden ab. Auch mehrere Klassen über ein Schuljahr bleiben weit unter 500 MB.
**Für den Regelbetrieb empfohlen:** Pro-Tarif oder regelmäßige Nutzung, damit das Projekt nicht pausiert, sowie Backups.

## Variante A – GitHub Pages + Supabase (Schritt für Schritt)

1. Repository-Einstellung *Settings → Pages*: „Deploy from a branch“, `main`, `/ (root)` (ist bei `mathe10` bereits aktiv).
2. `lernlabore2/site/config.js` mit Supabase-URL und **öffentlichem** Schlüssel füllen (siehe INSTALLATION.md, Schritt 4).
3. Änderungen am Quellcode: lokal `npm run build`, dann `site/` mit einchecken (die gebauten Dateien werden direkt ausgeliefert).
4. Adresse: `https://<benutzer>.github.io/mathe10/lernlabore2/site/…`

Besonderheiten:
- GitHub Pages führt **keinen Servercode** aus – deshalb laufen Codeprüfung und Datenzugriff vollständig in Supabase.
- Sicherheits-Header können nicht gesetzt werden; die Seiten enthalten daher eine Content-Security-Policy als `<meta>`-Tag
  (verbietet fremde Skripte, erlaubt Verbindungen nur zu `*.supabase.co`). Bei eigener Supabase-Domain die CSP anpassen.
- Repository ist öffentlich: **nie** Schülerlisten, Tresordateien, Exporte oder geheime Schlüssel einchecken
  (`.gitignore` schließt `*.llv` und `schuelerliste*.csv` aus).

## Variante B – Cloudflare Pages + Supabase

1. Cloudflare-Konto → *Workers & Pages* → *Create* → *Pages* → *Connect to Git* → Repository `mathe10`.
2. Build-Einstellungen: Build command **leer**, Output directory **`lernlabore2/site`** (alternativ mit Build:
   Root directory `lernlabore2`, Build command `npm ci && npm run build`, Output `site`).
3. *Production branch* `main`; jeder andere Branch erhält eine Vorschau-Adresse (ideal als **Testsystem** mit eigener `config.js`).
4. Optional zusätzliche Sicherheits-Header über eine Datei `site/_headers`, z. B.:
   ```
   /*
     X-Content-Type-Options: nosniff
     Referrer-Policy: no-referrer
     X-Frame-Options: DENY
     Permissions-Policy: camera=(), microphone=(), geolocation=()
   ```
5. Cloudflare Web Analytics **nicht** aktivieren (kein Tracking gewünscht).

## Variante C – Firebase (Vergleichsdokumentation)

| Aspekt | Supabase-Lösung (umgesetzt) | Firebase-Entsprechung |
|---|---|---|
| Codeprüfung mit Geheimnis | SQL-Funktion `student_login` (HMAC in der DB) | Cloud Function (Blaze-Tarif nötig), Secret Manager |
| Sitzungen | eigene Sitzungstabelle, Token-Hash | Custom Tokens über Firebase Auth |
| Zugriffsschutz | Row-Level-Security + geprüfte Funktionen | Firestore Security Rules + Functions |
| Idempotenz/Konflikte | Transaktion + `applied_ops`, Revisionszähler | Firestore-Transaktionen, eigene Implementierung |
| Abfragen fürs Dashboard | SQL (Aggregationen) | begrenzte Aggregationen, ggf. Functions |
| Migrationen | versionierte SQL-Dateien | Rules/Indizes deployen, Datenmodell-Migrationen manuell |

Fazit: Machbar, aber deutlich mehr Eigenentwicklung und eine zweite Sicherheitslogik. Keine Implementierung in diesem Projekt.

## Eigene Domain, HTTPS und CORS

- **Eigene Domain/Subdomain** (z. B. `labor.meine-schule.de`): bei der Schul-IT einen DNS-Eintrag (CNAME) anlegen lassen –
  GitHub Pages: auf `<benutzer>.github.io`, Domain unter *Settings → Pages → Custom domain*; Cloudflare Pages: *Custom domains*.
  HTTPS-Zertifikate erzeugen beide Dienste automatisch. „Enforce HTTPS“ aktivieren.
- **Supabase-Adresse:** standardmäßig `https://<ref>.supabase.co`. Eine eigene Domain für Supabase ist ein kostenpflichtiges Add-on;
  dann `config.js` und die CSP in den HTML-Dateien (`connect-src`) anpassen.
- **CORS:** Supabase erlaubt Aufrufe aus dem Browser von beliebigen Ursprüngen. Das ist hier unkritisch, weil
  ohne gültigen Code bzw. gültige Lehrkraft-Anmeldung keine Daten zurückkommen (RLS und Funktionsprüfungen).
  Sitzungstoken stehen nicht in Cookies (kein CSRF-Risiko).
- **API-Endpunkte:** ausschließlich `POST /rest/v1/rpc/student_*` (Lernende, öffentlicher Schlüssel),
  `POST /rest/v1/rpc/teacher_*` (Lehrkraft-Token) und `/auth/v1/token`. Siehe [docs/API.md](docs/API.md).

## Sichere Umgebungsvariablen und Geheimnisse

| Wert | geheim? | Wo |
|---|---|---|
| Supabase-URL | nein | `site/config.js`, Lehrerprogramm-Einstellungen |
| öffentlicher Schlüssel (anon/publishable) | nein (darf öffentlich sein) | `site/config.js`, Lehrerprogramm |
| service_role-/Secret-Schlüssel | **JA** | wird von diesem System **nicht benötigt** – nirgends eintragen |
| Datenbank-Passwort / Verbindungszeichenkette | **JA** | nur Passwortmanager bzw. GitHub-Environment-Secret `SUPABASE_DB_URL` |
| Code-Geheimnis (Pepper) | **JA** | wird in der Datenbank erzeugt (`lernlabor_private.settings`), verlässt sie nie |
| Lehrkraft-Passwort | **JA** | nirgends gespeichert; Erneuerungstoken im Windows-Anmeldespeicher |
| Tresor-Passwort | **JA** | nur im Kopf/Passwortmanager der Lehrkraft |

## Datenbankmigrationen und Deployment des Dashboards

- Migrationen: `supabase/migrations/` (versioniert, in einer Transaktion je Datei). Erstinstallation per SQL Editor,
  Updates per `scripts/migrate.mjs` bzw. GitHub-Workflow „Datenbank-Migrationen“ (Umgebungen `test`/`produktiv`, Freigabe möglich).
- Dashboard, Startseite und Labore sind Teil von `site/` und werden mit der Webseite zusammen veröffentlicht.
  Ein Deployment der Webseite verändert **keine** Daten (automatisch getestet: Test 16).

## Datenschutzbezogene Prüfpunkte je Anbieter

| Prüfpunkt | GitHub Pages | Cloudflare Pages | Supabase |
|---|---|---|---|
| Welche Daten sieht der Dienst? | Zugriffe auf statische Dateien inkl. IP-Adresse (Server-Logs) | wie GitHub | alle pseudonymen Lerndaten, IP-Adressen in Request-Logs, Lehrkraft-E-Mail |
| Auftragsverarbeitungsvertrag (Art. 28 DSGVO) | prüfen (GitHub DPA; für reines Hosting öffentlicher Seiten ggf. nicht als AV einzuordnen – mit DSB klären) | Cloudflare DPA | **erforderlich** – Supabase DPA abschließen |
| Drittland/USA | ja (Microsoft) | ja | Unternehmen USA, Datenhaltung Frankfurt; Support-/Unterauftragnehmer-Zugriffe prüfen |
| Tracking/Cookies | keine durch dieses System | keine (Web Analytics nicht aktivieren) | keine |

## Quellen (abgerufen 11/2026, Angaben zeitabhängig)

- GitHub Pages limits: <https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits>
- Cloudflare Pages limits: <https://developers.cloudflare.com/pages/platform/limits>
- Supabase Pricing: <https://supabase.com/pricing> (Drittquellen-Zusammenfassungen u. a. <https://schematichq.com/blog/supabase-pricing>, <https://automationatlas.io/answers/supabase-free-tier-limits-2026/>)
- Firebase Pricing: <https://firebase.google.com/pricing>
