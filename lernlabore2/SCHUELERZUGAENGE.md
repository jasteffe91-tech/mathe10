# Schülerzugänge: Klassen, Codes, Karten, Sperren

Alles in diesem Kapitel passiert im **lokalen Lehrerprogramm**. Die Namen bleiben im verschlüsselten Tresor
auf deinem Rechner; an den Server gehen nur zufällige IDs, Kennungen (z. B. `P-8F2A`) und die Codes zur
Berechnung eines Prüfwerts (HMAC) – der Code selbst wird dort **nicht** gespeichert.

## 1. Klasse anlegen und Schülerliste importieren

1. **Neue Lerngruppe …** → Bezeichnung, z. B. `7a Physik` (bitte keine Personennamen in die Bezeichnung).
   Eine Gruppe kann mehrere Lernlabore nutzen.
2. **Schülerliste importieren** → CSV-Datei wählen.

**So sieht eine passende CSV aus** (aus Excel: *Speichern unter → CSV UTF-8* oder *CSV (Trennzeichen-getrennt)*):

```
Nachname;Vorname
Mustermann;Max
Musterfrau;Erika
```

Erkannt werden außerdem: Komma oder Tabulator als Trennzeichen, Windows-1252 und UTF-8 (Umlaute, ß, é …),
Spalten „Vorname“/„Nachname“ in beliebiger Reihenfolge, eine Spalte „Name“ mit „Nachname, Vorname“ oder „Vorname Nachname“.
Eine Beispieldatei mit 30 fiktiven Namen liegt unter `tests/fixtures/klasse-7a-fiktiv.csv`.

Vor der Übernahme zeigt das Programm eine **Vorschau** mit Hinweisen, z. B.:
- mögliche **Dubletten** (gelb markiert; „Dubletten nur einmal übernehmen“ ist voreingestellt),
- Zeilen mit Ziffern, E-Mail-Adressen, nur einem Namensteil oder unlesbaren Zeichen,
- fehlende Spaltenüberschriften (dann wird „1. Spalte Nachname, 2. Spalte Vorname“ angenommen – bitte prüfen).

Einzelne Personen: **Person hinzufügen …** · Entfernen: markieren → **Entfernen** (online wird beim nächsten Synchronisieren gelöscht).

## 2. Zugangscodes erstellen

**Zugangscodes erstellen** erzeugt für alle Personen ohne Code einen neuen:
- 12 Zeichen in drei Vierergruppen, z. B. `K7QP-M4XR-9TBA` (≈ 59 Bit Zufall, kryptografisch sicher erzeugt),
- ohne verwechselbare Zeichen (kein 0/O, 1/I/L), Groß-/Kleinschreibung und Bindestriche egal,
- keine fortlaufenden Codes, keine Ableitung aus Namen.

Jede Person erhält zusätzlich eine zufällige, nicht sprechende **Kennung** (`P-8F2A`), die im Dashboard erscheint.

## 3. Mit der Online-Datenbank synchronisieren

**Mit Online-Datenbank synchronisieren** legt die Gruppe online an, weist das Lernlabor zu und registriert die Codes.
- Erst wenn der Server **bestätigt**, zeigt die Liste „registriert“ und die Statusleiste
  „Letzte erfolgreiche Synchronisierung: … (vom Server bestätigt)“.
- Bricht die Verbindung ab, bleibt der Stand „NOCH NICHT synchronisiert“ – einfach erneut klicken (wiederholbar, ohne Doppelungen).
- Ohne Internet funktioniert alles Lokale weiter; die Statusleiste zeigt, was noch nicht übertragen ist.

## 4. Zugangskarten drucken und verteilen

**Zugangskarten drucken** erzeugt ein PDF (A4, 10 Karten je Seite) mit Name, Code, Kennung, Adresse und QR-Code.
- Der QR-Code enthält die Adresse mit dem Code **hinter dem #-Zeichen** (`…/physik-entdecker/#zugang=K7QP-…`).
  Dieser Teil wird nicht an Server gesendet, taucht also nicht in Server-Protokollen auf; das Labor entfernt ihn
  sofort aus der Adresszeile. Trotzdem gilt: Karten wie Passwörter behandeln.
- Karten mit Namen sind **vertraulich**: nach dem Austeilen nicht offen herumliegen lassen; PDF nicht in Cloud-Ordnern speichern.
- Hinweis für Kinder auf der Karte: „Code geheim halten. Kein Name nötig.“

Anmeldung für Kinder: Lernlabor öffnen → „Gib deinen Zugangscode ein.“ → **Los geht’s!** (oder QR-Code scannen).

## 5. Sperren, neu ausstellen, zurücksetzen

| Situation | Im Lehrerprogramm | Wirkung nach dem Synchronisieren |
|---|---|---|
| Karte verloren / Code weitergegeben | Person markieren → **Neuen Code ausstellen** → synchronisieren → neue Karte drucken | alter Code und alle laufenden Sitzungen sofort ungültig; Lernstand bleibt |
| Zugang vorübergehend sperren | **Sperren / Entsperren** → synchronisieren | Anmeldung abgelehnt, laufende Sitzungen beendet |
| Lernstand neu beginnen | im Dashboard → *Verwaltung* → „Lernstand zurücksetzen“ | Ergebnisse dieser Person im Labor gelöscht |
| Person verlässt die Klasse | **Entfernen** → synchronisieren | Kennung, Code und Ergebnisse online gelöscht |

Im Dashboard (*Verwaltung*) kannst du außerdem sofort sperren oder einen Code ungültig machen – praktisch, wenn das
Lehrerprogramm gerade nicht zur Hand ist. Einen **neuen** Code mit Namen gibt es aber nur im Lehrerprogramm.

**Gültigkeit begrenzen:** Gruppen können ein Ende des Zugangs haben (Dashboard → *Verwaltung*, bzw. bei Veranstaltungen
beim Anlegen). Außerdem hat jede Gruppe ein **Löschdatum** (Standard: Klassen 1 Jahr, Veranstaltungen 30 Tage nach Ende),
danach werden alle Online-Daten der Gruppe automatisch gelöscht.

## 6. Gastmodus (Tag der offenen Tür, Schnupperunterricht)

Für Kinder anderer Schulen werden **keine Namen** erfasst – auch nicht lokal.

1. Dashboard → **Gastzugänge** → Bezeichnung (z. B. „Tag der offenen Tür 2026“), Anzahl (10–80), Lernlabor,
   *gültig ab* / *gültig bis* → **Gastzugänge erzeugen**.
2. Erst nach Serverbestätigung erscheinen die Karten (Gastcode mit 8 Zeichen, Kennung `G-…`, QR-Code).
   **Die Codes werden nur jetzt angezeigt** → sofort **Karten drucken** (10 je A4-Seite).
3. Während der Veranstaltung: Gruppe im Dashboard wählen → Übersicht zeigt, wie viele Gäste begonnen/abgeschlossen haben.
4. Nach Ende: automatisch gesperrt; sofort beenden mit **„Veranstaltung jetzt beenden“**.
   Die Daten werden 30 Tage nach Ende automatisch gelöscht (oder vorher in *Verwaltung* → „Gruppe endgültig löschen“).

Gäste können ebenfalls weitermachen, wenn sie ihre Karte behalten (bis zum Ende der Gültigkeit).

## 7. Datensicherung des Tresors

- *Datei → Verschlüsselte Sicherung erstellen …* (optional mit eigenem Sicherungspasswort) – z. B. nach jedem Import.
- *Datei → Sicherung wiederherstellen …* ersetzt den aktuellen Stand (der vorherige bleibt als `.bak` erhalten).
- Verlorenes Tresor-Passwort lässt sich **nicht** wiederherstellen. Dann: neue Codes ausstellen; die pseudonymen
  Online-Daten bleiben erhalten, können aber keinem Namen mehr zugeordnet werden.
