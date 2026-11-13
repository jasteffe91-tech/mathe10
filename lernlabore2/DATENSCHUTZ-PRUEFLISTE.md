# Datenschutz-Prüfliste

Diese Liste unterstützt die Prüfung **vor** dem Einsatz mit echten Schülerdaten. Sie ersetzt keine rechtliche Beratung.
Die Architektur ist auf Datensparsamkeit ausgelegt – sie macht den Einsatz aber **nicht automatisch DSGVO-konform**.
Verantwortlich im Sinne der DSGVO ist in der Regel die **Schule** (Schulleitung); einzubeziehen ist die bzw. der
**behördliche Datenschutzbeauftragte**.

## 1. Rechtliche Einordnung in Kürze

- **Pseudonymisierung, keine Anonymisierung:** Die Online-Daten (Kennung `P-8F2A`, Antworten, Zeitstempel) sind
  pseudonymisiert im Sinne von Art. 4 Nr. 5 DSGVO. Weil die Schule über den lokalen Tresor die Zuordnung zu Namen
  herstellen kann, bleiben sie für die Schule **personenbezogene Daten** (vgl. Erwägungsgrund 26 DSGVO).
- **Rechtsgrundlage:** im Unterricht in der Regel die schulrechtliche Aufgabenerfüllung (Art. 6 Abs. 1 lit. e DSGVO
  i. V. m. dem Schulgesetz des Landes und ggf. Verordnungen über zugelassene Daten, in NRW z. B. §§ 120 ff. SchulG, VO-DV I).
  Ob das Werkzeug davon gedeckt ist oder eine Einwilligung nötig ist, entscheidet die Schule.
- **Gastmodus:** Es werden keine Namen erhoben. Die Gastdaten sind für die Schule praktisch nicht zuordenbar,
  sofern niemand notiert, welches Kind welche Karte erhielt. Technisch fallen trotzdem IP-Adressen bei den Dienstleistern an
  → Informationsaushang für Besucher empfohlen.

## 2. Welche Daten werden wo gespeichert – und warum?

### Online (Supabase, Region Frankfurt)

| Daten | Zweck | Personenbezug | Löschung |
|---|---|---|---|
| Lerngruppe: Bezeichnung (z. B. „7a Physik“), Art, Gültigkeit, Löschdatum | Zuordnung von Laboren und Zugängen | gering (keine Namen in Bezeichnungen eintragen!) | automatisch am Löschdatum (Standard: Klasse 1 Jahr, Veranstaltung 30 Tage nach Ende) bzw. manuell |
| Teilnehmer: zufällige UUID, Kennung `P-xxxx`, Status (aktiv/gesperrt) | Pseudonyme Identität für Lernstände | pseudonym | mit der Gruppe bzw. „Entfernen“ |
| Zugangscode: **nur HMAC-SHA-256** mit serverseitigem Geheimnis, Gültigkeit, Sperrvermerk | Anmeldung prüfen | kein Klartext | mit Teilnehmer/Gruppe |
| Sitzungen: SHA-256 des Sitzungstokens, Ablaufzeit (max. 12 h) | angemeldet bleiben | pseudonym | 1 Tag nach Ablauf |
| Fehlgeschlagene Anmeldungen: HMAC der IP-Adresse + Zeitpunkt | Schutz vor Rateversuchen | keine IP im Klartext | nach 24 h |
| Ergebnisse je Aufgabe: Antwort, Simulations-/Messwerte, Status, richtig/falsch, Revision, Zeitstempel | Lernstand, Fortsetzen, Auswertung | pseudonym | mit Gruppe, „Ergebnisse löschen“, „Lernstand zurücksetzen“ |
| Fortschritt je Labor: erledigte Aufgaben, Prozent, Fortsetzungspunkt, Start-/letzte Speicherung | Übersicht, Fortsetzen | pseudonym | wie Ergebnisse |
| Idempotenz-Einträge (zufällige Vorgangs-ID + Zeit) | keine doppelten Speicherungen | pseudonym | nach 60 Tagen |
| Protokoll administrativer Aktionen (wer/was/wann, Anzahlen – keine Codes, keine Namen) | Nachvollziehbarkeit | Lehrkraft-ID | nach ca. 13 Monaten |
| Lehrkraft-Konto (Supabase Auth): E-Mail, Passwort-Hash, Anmeldezeitpunkte | Zugang zum Dashboard | personenbezogen (Lehrkraft) | Konto löschen |
| Plattform-Logs des Anbieters (Request-Logs inkl. IP, Browser) | Betrieb/Sicherheit beim Anbieter | personenbezogen | nach Tarif des Anbieters (kurz) – prüfen |

**Nicht gespeichert:** Namen, E-Mail-Adressen oder Geburtsdaten von Schülerinnen/Schülern, Codes im Klartext,
Mausbewegungen, Tastendrücke, Verweildauer je Seite, Gerätekennungen, Standortdaten, Tracking- oder Werbedaten.
Gespeichert wird nur nach **abgeschlossenen Arbeitsschritten**.

### Im Browser der Lernenden

| Daten | Ort | Löschung |
|---|---|---|
| Sitzungstoken, Kennung, Gruppenbezeichnung | `sessionStorage` (Standard: endet mit dem Tab) | beim Schließen des Tabs bzw. „Abmelden“ |
| noch nicht übertragene Antworten (Offline-Warteschlange) | IndexedDB | nach erfolgreicher Übertragung |
| Kopie des zuletzt geladenen Lernstands (für Neuladen ohne Netz) | IndexedDB | beim Abmelden, spätestens nach 24 h |

Auf **geteilten Schulgeräten**: Kinder sollen sich abmelden. Ausstehende Antworten bleiben bis zur nächsten Anmeldung
derselben Person auf dem Gerät (pseudonym, für andere nicht sichtbar). Das Abmelden warnt, wenn noch etwas aussteht.

### Auf dem Rechner der Lehrkraft (lokal)

| Daten | Ort | Schutz |
|---|---|---|
| Namen, Kennungen, Codes, Teilnehmer-IDs, abgerufene Ergebnisse | Tresor `%APPDATA%\Lernlabore2\tresor.llv` | AES-256-GCM, Schlüssel per Argon2id (64 MiB) aus Passwort ≥ 10 Zeichen; Manipulationsschutz |
| Erneuerungstoken der Supabase-Anmeldung | Windows-Anmeldeinformationsverwaltung (sonst verschlüsselt im Tresor) | Betriebssystem |
| Einstellungen (URL, öffentlicher Schlüssel, E-Mail, Pfade) | `einstellungen.json` | keine Geheimnisse enthalten |
| Berichte (PDF/XLSX/CSV) mit Namen, Zugangskarten | gewählter Ordner | **unverschlüsselte Dateien** – Verantwortung der Lehrkraft: Geräteverschlüsselung (BitLocker), nicht in Cloud-Ordnern, nach Gebrauch löschen |

## 3. Beteiligte Dienstleister

| Dienst | Rolle | Sitz | Zu prüfen |
|---|---|---|---|
| **Supabase** | Datenbank, Anmeldung der Lehrkräfte, Server-Funktionen | Unternehmen USA; Datenregion Frankfurt (eu-central-1, Infrastruktur AWS) | **AV-Vertrag (DPA)** abschließen; Liste der Unterauftragnehmer; Supportzugriffe; Drittlandübermittlung (Standardvertragsklauseln / EU-US Data Privacy Framework); Backups und deren Standort; Log-Aufbewahrung |
| **GitHub Pages** (Variante A) | Auslieferung der statischen Webseiten | Microsoft, USA | Zugriffsprotokolle mit IP-Adressen; Einordnung (AV oder nicht) mit DSB klären; Repository öffentlich → keine personenbezogenen Daten einchecken |
| **Cloudflare Pages** (Variante B) | Auslieferung der statischen Webseiten | USA | DPA; Analytics deaktiviert lassen |
| **GitHub Actions** (optional) | Bau der EXE, Tests, Migrationen | USA | verarbeitet keine Schülerdaten (nur Code; Testdaten fiktiv) |

## 4. Technische Schutzmaßnahmen (umgesetzt)

- [x] Keine Klarnamen auf dem Server; Zuordnung nur lokal (automatisch geprüft: Datenbank-Dump enthält keinen Namen)
- [x] Zugangscodes kryptografisch zufällig, nur als HMAC mit serverseitigem Geheimnis gespeichert
- [x] Serverseitige Codeprüfung, Begrenzung fehlgeschlagener Versuche (60 je Anschluss / 5000 gesamt in 10 Min.)
- [x] Sitzungstoken 256 Bit, nur als Hash gespeichert, max. 12 h, beim Sperren/Neuausstellen sofort ungültig
- [x] Row-Level-Security auf allen Tabellen; Tabellen nicht über die REST-API erreichbar; nur geprüfte Funktionen
- [x] Lehrkräfte sehen nur eigene bzw. geteilte Gruppen (getestet); Lernende nur ihren eigenen Stand (getestet)
- [x] Kein geheimer Schlüssel im Frontend; nur öffentlicher Schlüssel; Lehrerprogramm lehnt Geheimschlüssel ab
- [x] HTTPS; Content-Security-Policy; keine externen Skripte, keine Tracking- oder Analysedienste, keine Cookies
- [x] Schutz vor XSS (Inhalte werden nur als Text eingefügt), Schutz vor Formel-Injektion in CSV/XLSX
- [x] Codes nicht in URL-Parametern; QR-Code nutzt das nicht übertragene #-Fragment, das sofort entfernt wird
- [x] Keine Codes/Passwörter in Protokollen (Audit-Protokoll nur mit Anzahlen; getestet)
- [x] Definierte Löschfristen, automatische Löschung, manuelle Lösch- und Archivfunktionen
- [x] Verschlüsselter Tresor mit verschlüsselter Sicherung/Wiederherstellung

## 5. Organisatorische Prüfpunkte – vor der Nutzung mit echten Schülerdaten

- [ ] Schulleitung über das Verfahren informiert; Freigabe für den Einsatz erteilt
- [ ] Behördliche/r Datenschutzbeauftragte/r beteiligt; Stellungnahme liegt vor
- [ ] Eintrag im **Verzeichnis von Verarbeitungstätigkeiten** (Art. 30 DSGVO) der Schule
- [ ] Prüfung, ob eine **Datenschutz-Folgenabschätzung** (Art. 35) nötig ist (bei Pseudonymisierung und geringem Umfang oft nicht, Entscheidung dokumentieren)
- [ ] **Auftragsverarbeitungsvertrag** mit Supabase abgeschlossen (über Schulträger/Schule, nicht privat) – ggf. auch für Hosting
- [ ] Drittlandbezug (USA) bewertet und dokumentiert (Standardvertragsklauseln/DPF, Supportzugriffe)
- [ ] **Information** der Schülerinnen, Schüler und Eltern nach Art. 13 DSGVO (Zweck, Daten, Dienstleister, Speicherdauer, Rechte)
- [ ] Ggf. landesrechtliche Vorgaben zu digitalen Lernmitteln geprüft (z. B. Positivlisten, Genehmigungspflichten)
- [ ] **Verarbeitung auf dem Rechner der Lehrkraft** genehmigt, falls ein privates Gerät genutzt wird (in mehreren Ländern genehmigungspflichtig, in NRW u. a. nach VO-DV I); Gerät mit Festplattenverschlüsselung und Bildschirmsperre
- [ ] Supabase-Konto **dienstlich** (Schulträger/Schule), nicht privat; Zwei-Faktor-Anmeldung im Supabase-Dashboard aktiviert
- [ ] Selbstregistrierung in Supabase Auth deaktiviert; Lehrkraft-Konten nur auf Anlage
- [ ] Zugangskarten werden persönlich ausgegeben; verlorene Karten → Code neu ausstellen
- [ ] Löschfristen für jede Gruppe festgelegt (Ende Schuljahr + Puffer) und für Berichte (PDF/Excel) geregelt
- [ ] Vorgehen bei Datenpannen bekannt (Meldung an Schulleitung/DSB; Codes sperren; Art. 33/34 DSGVO)
- [ ] Kinder angewiesen, **keine Namen** in Freitextfelder zu schreiben (Physik-Entdecker hat keine Freitextfelder)
- [ ] Bei Veranstaltungen: Aushang/Information für Besucher; keine Zuordnung Karte ↔ Kind notieren

## 6. Wie werden Daten gelöscht?

| Was | Wie |
|---|---|
| Einzelne Person | Lehrerprogramm → Entfernen → synchronisieren (online gelöscht) |
| Lernstand einer Person | Dashboard → Verwaltung → „Lernstand zurücksetzen“ |
| Ergebnisse eines Labors in einer Gruppe | Dashboard → Verwaltung → „Ergebnisse löschen“ |
| Ganze Gruppe | Dashboard → Verwaltung → „Gruppe endgültig löschen“ (Bestätigung durch Eintippen) – oder automatisch am Löschdatum |
| Veranstaltung (Gastmodus) | automatisch 30 Tage nach Ende (änderbar) |
| Lokal | Lehrerprogramm → „Lerngruppe lokal löschen“; Berichte im Dateisystem löschen |
| Alles | Supabase-Projekt löschen; Tresordatei und Sicherungen löschen |

Hinweis: Backups des Anbieters können gelöschte Daten noch für die dort festgelegte Frist enthalten – beim AV-Vertrag prüfen.

## 7. Schutz des lokalen Zuordnungsschlüssels

- Tresor-Passwort ≥ 10 Zeichen (besser Passphrase aus mehreren Wörtern), nicht wiederverwenden, nicht auf dem Gerät notieren.
- Argon2id macht Passwort-Rateversuche teuer; AES-256-GCM erkennt Manipulationen der Datei.
- Sicherungen sind ebenfalls verschlüsselt (optional mit eigenem Passwort); Aufbewahrung getrennt vom Rechner (USB-Stick im Schrank).
- Programm sperren: Programm schließen (der Tresor ist dann wieder verschlüsselt); Windows-Bildschirmsperre nutzen.
- Bei Verdacht auf Verlust des Tresors: alle Codes der betroffenen Gruppen neu ausstellen (alte werden sofort ungültig).
