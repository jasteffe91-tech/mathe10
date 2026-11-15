# Evaluation des Präventionsangebots – Jugendhilfe der Stadt Voerde

Webanwendung zur anonymen Evaluation des Präventionsangebots durch die Klassenleitungen des 8. Jahrgangs
der **Comenius-Gesamtschule Voerde, Abteilung II** – mit geschütztem Auswertungsbereich und automatisch
erzeugtem PDF-Bericht für **WIDE (BL Abt. II)**.

> **Wichtig:** Die Anwendung braucht einen Server mit Node.js und dauerhaftem Speicher.
> Sie läuft **nicht** auf GitHub Pages (dort gibt es nur statische Seiten, keine Datenspeicherung).
> Eine öffentliche Adresse existiert erst, wenn die Anwendung wie unten beschrieben bereitgestellt wurde.

---

## 1. Was die Anwendung kann

**Für die Klassenleitungen** (Adresse `/`)
- Aufruf über einen gemeinsamen Link, ohne Registrierung, ohne Cookies, ohne Tracking
- 14 Fragen in fünf Bereichen (A–E), Fortschrittsanzeige, große Antwortflächen für Smartphone/Tablet
- Pflichtfragen mit `*` gekennzeichnet, Freitextfelder freiwillig, optionale Klassenangabe
- Zwischenstand bleibt beim Neuladen erhalten (nur lokal im Browser)
- Übersicht zur Kontrolle aller Antworten vor dem Absenden, danach Bestätigungsseite
- Schutz vor Doppelspeicherung: Absende-Knopf wird gesperrt **und** der Server erkennt jede Abgabe an
  einem einmaligen Zufalls-Token (Doppelklick oder Netzwerk-Wiederholung erzeugen keinen zweiten Eintrag)

**Für WIDE** (Adresse `/admin`, passwortgeschützt)
- Anzahl der Rückmeldungen, Rücklaufquote (nach Eingabe der erwarteten Anzahl)
- Balkendiagramme mit Anzahl und Prozent je Antwort, „nicht beurteilbar“ gesondert ausgewiesen
- Entscheidungsrelevante Fragen 2, 3, 5 und 12 hervorgehoben
- Alle Freitexte vollständig und wörtlich, plus gekennzeichnete automatische Themenbündelung
- Regelbasierte Gesamteinschätzung mit offengelegten Regeln
- PDF-Gesamtbericht (DIN A4), CSV-Rohdaten (Excel-tauglich), JSON-Datensicherung
- Evaluation schließen/wieder öffnen, einzelne Abgaben löschen (z. B. Tests), alle Daten löschen

## 2. Datenschutz und Anonymität

- Gespeichert werden nur: die Antworten, die freiwillige Klassenangabe, das **Abgabedatum ohne Uhrzeit**
  und ein Zufalls-Token gegen Doppelspeicherung. **Keine** IP-Adressen, Namen, E-Mail-Adressen oder Gerätedaten.
- Keine externen Dienste: keine Schriftarten von Google, keine CDNs, keine Analysewerkzeuge.
  Strenge Content-Security-Policy, Seiten sind für Suchmaschinen gesperrt (`noindex`).
- Freitexte und Antwortlisten werden in zufälliger, nicht chronologischer Reihenfolge angezeigt.
- Die Klassenangabe wird in Admin-Ansicht und PDF **nicht** mit einzelnen Antworten verknüpft.
  Ausnahme: CSV-Rohdaten und JSON-Sicherung enthalten sie (nur bei Bedarf herunterladen, geschützt speichern).
- Im Fragebogen werden die Lehrkräfte gebeten, keine Namen von Schülerinnen und Schülern zu nennen.
- Löschung: im Admin-Bereich unter „Verwaltung → Alle Daten löschen“ (die Datenbankdatei wird dabei
  zusätzlich bereinigt, `VACUUM`). Vollständige Entfernung: Server stoppen und den Ordner `data/` löschen.

**Vor dem Einsatz bitte klären:** Abstimmung mit dem/der schulischen Datenschutzbeauftragten; beim Einsatz
eines externen Hosting-Anbieters ist in der Regel ein Auftragsverarbeitungsvertrag (AVV) erforderlich.
Ein Server-Standort in der EU/Deutschland wird empfohlen.

## 3. Lokal starten (Test auf dem eigenen Rechner)

Voraussetzung: [Node.js](https://nodejs.org) ab Version 20 (empfohlen 22 LTS).

```bash
cd praevention-evaluation
npm install
npm run set-password      # Admin-Passwort festlegen (mind. 10 Zeichen)
npm start                 # → http://localhost:3000  und  http://localhost:3000/admin
```

Mit fiktiven Beispieldaten ausprobieren (getrennter Ordner, berührt keine echten Daten):

```bash
DATA_DIR=./demo-data npm run demo
DATA_DIR=./demo-data ADMIN_PASSWORD=Demo-Passwort-123 npm start
```

## 4. Veröffentlichen (Bereitstellung)

Die Anwendung ist ein einzelner Node.js-Prozess mit einer SQLite-Datei. Benötigt werden:

1. ein Server oder Hosting-Angebot mit **Node.js 20+** (oder Docker) und **dauerhaftem Speicher** für `DATA_DIR`,
2. **HTTPS** (Zertifikat, z. B. automatisch über Let's Encrypt),
3. ein Admin-Passwort (siehe unten).

### Konfiguration (Umgebungsvariablen oder Datei `.env`, Vorlage: `.env.example`)

| Variable | Bedeutung |
|---|---|
| `PORT` | Port des Servers (Standard 3000) |
| `DATA_DIR` | Ordner für Datenbank und Passwort-Hash (Standard `./data`) – **muss gesichert werden** |
| `ADMIN_PASSWORD_HASH` | Passwort-Hash, erzeugen mit `npm run set-password -- --print` |
| `TRUST_PROXY` | `1`, wenn ein Reverse-Proxy (HTTPS) vorgeschaltet ist |
| `COOKIE_SECURE` | `true` bei HTTPS (Anmelde-Cookie nur verschlüsselt) |

Alternativ zu `ADMIN_PASSWORD_HASH`: `npm run set-password` auf dem Server ausführen – der Hash wird dann in
`DATA_DIR/admin-password.hash` gespeichert. Das Klartext-Passwort wird nirgends abgelegt.

### Variante A: Schul-/Trägerserver oder eigener Server mit Docker (empfohlen)

```bash
cd praevention-evaluation
docker compose build
docker compose run --rm evaluation node scripts/set-password.js   # Passwort festlegen (liegt im Daten-Volume)
docker compose up -d
```

Der Container lauscht nur lokal auf Port 3000. Davor wird ein Webserver mit HTTPS geschaltet, z. B. Caddy:

```
evaluation.example-schule.de {
    reverse_proxy 127.0.0.1:3000
}
```

### Variante B: Webhosting mit Node.js-Unterstützung (z. B. Uberspace)

Projektordner hochladen, `npm ci --omit=dev`, `npm run set-password`, dann die Anwendung als dauerhaften
Dienst starten und die Webadresse auf den Port weiterleiten (Anleitung des jeweiligen Anbieters, bei
Uberspace: „web backends“ und „supervisord“). `TRUST_PROXY=1` und `COOKIE_SECURE=true` setzen.

### Variante C: Cloud-Plattform (PaaS)

Möglich bei Anbietern, die Node.js-Apps **mit persistentem Volume** betreiben (Region EU wählen).
Startbefehl `npm start`, Volume auf `DATA_DIR` einhängen, `ADMIN_PASSWORD_HASH`, `TRUST_PROXY=1`,
`COOKIE_SECURE=true` setzen. **Ohne persistentes Volume gehen Antworten bei jedem Neustart verloren.**

Nach der Bereitstellung: `/healthz` muss `{"ok":true}` liefern; einmal eine Testabgabe machen und im
Admin-Bereich wieder löschen.

## 5. Ablauf der Evaluation

1. In `/admin` anmelden → **Verwaltung**: erwartete Anzahl der Klassenleitungen eintragen (für die Rücklaufquote).
2. Link zum Fragebogen kopieren (Knopf „Kopieren“) und an die Klassenleitungen des 8. Jahrgangs senden.
3. Eingänge im **Überblick** verfolgen.
4. Nach Ablauf der Frist **Evaluation schließen** (jederzeit wieder zu öffnen).
5. **PDF-Bericht herunterladen** – er wird immer aus dem aktuellen Datenstand erzeugt.
6. Auf der letzten Seite des Berichts die eigene Entscheidung handschriftlich festhalten.
7. Nach Abschluss: Sicherung ablegen (falls nötig) und **alle Daten löschen**.

## 6. Aufbau des PDF-Berichts

1. Deckblatt (Titel, Schule, Abteilung, WIDE, Auswertungsdatum, Datengrundlage)
2. Zielsetzung der Evaluation und Lesehinweise
3. Teilnahme und Rücklaufquote
4. Zusammenfassung der wichtigsten Ergebnisse
5. Quantitative Auswertung aller geschlossenen Fragen mit Balkendiagrammen
6. Qualitative Auswertung der Freitexte (Übersicht, Fragen 2, 5, 14)
7. Stärken des Angebots (quantitativ + Frage 13)
8. Verbesserungsmöglichkeiten für die Jugendhilfe (Frage 10 + auffällige Werte)
9. Organisatorische Hinweise für die Abteilungsleitung (Frage 11)
10. Entscheidungsgrundlage: Kennzahlen und offengelegte Regeln
- Hervorgehobene Seite **„Fazit und Entscheidung zur zukünftigen Durchführung“**
- Leeres Feld **„Abschließende Bewertung und Entscheidung der Abteilungsleitung – WIDE“** (Ankreuzfelder,
  Linien für die Stellungnahme, Datum, Unterschrift)

Aussagen der Lehrkräfte (wörtliche Zitate, grün nummeriert) und automatisch erstellte Inhalte
(sandfarbene Kästen „Automatische Auswertung“) sind optisch klar getrennt.

## 7. Wie die automatische Auswertung arbeitet

**Prozentwerte** beziehen sich auf inhaltlich gültige Antworten. „Nicht beurteilbar“ / „Kann ich (derzeit)
nicht beurteilen“ wird gesondert gezählt und als Anteil an allen Antworten ausgewiesen.

**Themenbündelung der Freitexte:** festgelegter Stichwortabgleich (z. B. „Zeitlicher Rahmen und Dauer“,
„Methoden und Interaktivität“, „Vor- und Nachbereitung“). Ausgewiesen werden nur Themen mit mindestens zwei
Nennungen, jeweils mit Verweis auf die Nummern der zugrunde liegenden Aussagen. Das Verfahren erkennt, *dass*
ein Thema angesprochen wird, nicht *wie* es bewertet wird – es erfindet keine Aussagen. Die Stichwortlisten
stehen in `src/analysis.js` (`THEMES`) und können angepasst werden.

**Entscheidungsregeln** (Prüfung in dieser Reihenfolge, die erste zutreffende gilt; keine Durchschnittswerte):

| # | Einschätzung | Bedingung |
|---|---|---|
| 1 | Keine belastbare Empfehlung möglich | < 3 Rückmeldungen, oder < 3 inhaltliche Antworten bei Frage 2 bzw. 12, oder Rücklauf < 33 % |
| 2 | Keine Fortführung empfohlen | ≥ 50 % „Nein“ bei Frage 12, oder ≥ 50 % „Nein“ bei Frage 2, oder ≥ 50 % negative Gesamtbewertung (Frage 1) |
| 3 | Grundlegende Überarbeitung | ≥ 40 % „Überarbeitung/Nein“ (F12), oder ≥ 40 % negativ (F1), oder ≥ 50 % „nur bedingt/Nein“ (F2), oder < 40 % „genau angemessen“ (F3) |
| 4 | Fortführung ohne wesentliche Veränderungen | ≥ 60 % „Ja, unbedingt“ (F12) **und** ≥ 60 % „uneingeschränkt“ (F2) **und** ≥ 70 % „angemessen“ (F3) **und** ≥ 75 % positiv (F1) **und** ≤ 10 % negativ (F1) **und** ≤ 10 % „Überarbeitung/Nein“ (F12) **und** kein widersprüchliches Bild |
| 5 | Fortführung mit gezielten Anpassungen | ≥ 50 % Etablierung befürwortet (F12) **und** ≥ 50 % Weiterempfehlung (F2) **und** ≥ 50 % positiv (F1) |
| 6 | Auffangregel: Grundlegende Überarbeitung | uneinheitliches Bild ohne klare befürwortende Mehrheit |

Zusätzlich: **Widersprüchliches Bild**, wenn bei Frage 1, 2 oder 12 jeweils ≥ 30 % zustimmen und ≥ 30 %
kritisch antworten. **Belastbarkeit** „gut“ nur bei ≥ 5 Rückmeldungen, Rücklauf ≥ 67 % und ohne
Widersprüche; sonst „eingeschränkt“. Hinweise (unbekannte Rücklaufquote, kleine Fallzahl, Abweichung zwischen
Weiterempfehlung und Etablierung, hoher Anteil „nicht beurteilbar“) werden im Bericht genannt.
Die Schwellen stehen zentral in `src/analysis.js` (`THRESHOLDS`, `decisionRules`).

Die endgültige Entscheidung liegt ausdrücklich bei der Abteilungsleitung.

## 8. Datensicherung und Wiederherstellung

- **Im Browser:** Admin → Verwaltung → „Datensicherung (JSON)“.
- **Auf dem Server:** `npm run backup` erstellt eine konsistente Kopie der Datenbank in `backups/`
  (auch im laufenden Betrieb). Bei Docker: das Volume `evaluation-data` sichern.
- **Wiederherstellen:** `npm run restore -- evaluation-sicherung-JJJJ-MM-TT.json`
  (bereits vorhandene Abgaben werden nicht doppelt angelegt).
- Sicherungen enthalten alle Antworten – verschlüsselt bzw. auf dienstlichen Geräten aufbewahren und nach
  Abschluss der Evaluation löschen.

## 9. Tests

```bash
npm test
```

Geprüft werden u. a.: Pflichtfeld-Validierung, Doppelklick-Schutz, Sperrung des Admin-Bereichs ohne Anmeldung,
Schutz gegen fremde Anfragen, Schließen/Öffnen, CSV (inkl. Schutz vor Formel-Injektion), PDF-Erzeugung mit
Prüfung der Pflichtüberschriften, Löschfunktionen sowie alle Entscheidungsregeln an konstruierten Datensätzen.

## 10. Projektstruktur

```
server.js              Start des Servers
src/questions.js       Fragebogen (einzige Quelle für Formular, Auswertung und PDF)
src/analysis.js        Statistik, Themenbündelung, Entscheidungsregeln
src/report.js          PDF-Bericht (PDFKit, eingebettete Schrift Inter mit Umlauten)
src/app.js             Routen, Sicherheits-Header, Admin-API
src/auth.js            Passwort-Hash (scrypt), Sitzungen, Anmeldebegrenzung
src/db.js              SQLite-Speicherung
public/                Fragebogen (index.html, form.js) und Admin-Oberfläche (admin.html, admin.js)
scripts/               Passwort, Sicherung, Wiederherstellung, Beispieldaten
fonts/                 Schriftart Inter (SIL Open Font License, siehe LICENSE-Inter-OFL.txt)
test/                  Automatische Tests
```

Textänderungen am Fragebogen erfolgen ausschließlich in `src/questions.js`. Werden Antwortoptionen umbenannt,
bitte die internen `value`-Kennungen beibehalten, da Auswertung und Regeln darauf beruhen.
