# Fortbildung „Online-Lernlabore 2.0“ – Dienstag, 17. November 2026

## Die Idee in drei Sätzen

Kinder öffnen ein Lernlabor, geben **nur einen Zugangscode** ein und arbeiten los – nach jeder Aufgabe wird
automatisch gespeichert, auch Unterbrechungen und Funklöcher sind kein Problem. Die Lehrkraft sieht online,
**pseudonym**, wer wie weit ist. Erst auf dem eigenen Rechner ordnet ein verschlüsseltes Lehrerprogramm die
Kennungen den echten Namen zu und erstellt mit einem Klick die PDF-Auswertung.

## Architektur (für die Folie)

```
 Kind (Tablet)              Server (Supabase, Frankfurt)              Lehrkraft
 ─────────────              ────────────────────────────              ─────────
 Code eingeben ──HTTPS──▶   prüft Code (nur HMAC gespeichert)
 Aufgabe lösen ──────────▶  speichert Antwort unter „P-8F2A“  ──▶   Dashboard (pseudonym, alle 15 s)
                                                              ──▶   Lehrerprogramm: Abruf
                                                                    + Tresor (Name ↔ P-8F2A) → PDF
```
**Namen verlassen nie den Rechner der Lehrkraft. Der Server kennt nur Kennungen und Antworten.**

## 15-Minuten-Ablauf

| Min. | Was | Zeigt |
|---|---|---|
| 0–2 | Problem: bisher PDF-Abgabe, Export/Import von Zwischenständen | Motivation |
| 2–4 | **Lehrerprogramm:** Schülerliste (fiktive CSV) importieren → Codes erstellen → Zugangskarten-PDF öffnen | Schritte 1–2 |
| 4–5 | Synchronisieren → Statusleiste „vom Server bestätigt“; Schülerliste: Namen + Kennung, Code verdeckt | Pseudonymisierung |
| 5–9 | **Tablet/Beamer:** Physik-Entdecker öffnen, Code einscannen (QR) oder eintippen → Vermutung wählen → „Gespeichert“ → Rampenversuch | Schritte 3–5 |
| 9–10 | Tab schließen, erneut mit demselben Code anmelden → genau dort weiter | Fortsetzen |
| 10–12 | **Dashboard:** Fortschritt erscheint (≤ 15 s), Reiter „Aufgaben“: Antwortverteilung, „häufig falsch“ | Schritt 6 |
| 12–14 | **Lehrerprogramm:** Lernstände abrufen → Name erscheint → PDF-Auswertung erstellen | Schritte 7–9 |
| 14–15 | Datenschutz-Folie, Fragen | |

## Schritt für Schritt – Live-Demonstration

**Vorbereitung (am Vortag):**
1. Lehrerprogramm: *Demo-Klasse (fiktiv) anlegen* → *Mit Online-Datenbank synchronisieren*
   (10 fiktive Personen erhalten fiktive Lernstände; „Max Mustermann“ und „Erika Musterfrau“ bleiben leer).
2. *Codes anzeigen* → Code von **Max Mustermann** notieren; *Zugangskarten drucken* (2–3 Karten ausdrucken).
3. Eine zweite Lerngruppe „Fortbildung Live“ anlegen und `tests/fixtures/klasse-7a-fiktiv.csv` bereitlegen (30 fiktive Namen).
4. Dashboard im Browser öffnen, anmelden, Gruppe „DEMO – Fortbildung (fiktiv)“ wählen, Tab offen lassen.
5. Supabase-Projekt einmal aufrufen (kostenlose Projekte pausieren nach Inaktivität).

**Live:**
1. *Schülerliste importieren* → `klasse-7a-fiktiv.csv` → Vorschau zeigt 30 Namen, Umlaute korrekt → *Übernehmen*.
2. *Zugangscodes erstellen* → 30 Codes. *Zugangskarten drucken* → PDF zeigen (QR-Code, Code in Vierergruppen).
3. *Mit Online-Datenbank synchronisieren* → „Vom Server bestätigt: 30 neu registriert“.
4. Auf dem Tablet den QR-Code von Max Mustermanns Karte scannen (oder `…/labore/physik-entdecker/` öffnen und Code tippen).
5. „Los geht’s!“ → Vermutung „steile Rampe“ → unten **„Gespeichert“** (erst nach Serverbestätigung).
6. Dashboard: Zeile `D-…` von Max springt auf 17 % (spätestens nach 15 Sekunden).
7. Optional: WLAN am Tablet aus → Antwort geben → „Offline – wird später synchronisiert“ → WLAN an → „Gespeichert“.
8. Lehrerprogramm: Demo-Gruppe wählen → *Lernstände jetzt abrufen* → Auswertung zeigt **„Max Mustermann“**.
9. *PDF-Auswertung erstellen* → Klassenübersicht + Einzelauswertung öffnen.

## Benötigte Zugangsdaten und Geräte

| Was | Hinweis |
|---|---|
| Laptop mit Lehrerprogramm (EXE) | Tresor-Passwort, eingerichtete Server-Verbindung |
| Supabase-Lehrkraft-Konto (E-Mail + Passwort) | für Dashboard; im Lehrerprogramm ist die Anmeldung gespeichert |
| Tablet (oder zweiter Browser) | für die Schülerperspektive; Kamera für QR-Code |
| Beamer + Adapter | Laptop spiegeln; Tablet ggf. per Kamera/Screen-Mirroring |
| Internet | WLAN der Schule **und** Smartphone-Hotspot als Reserve |
| Ausgedruckte Zugangskarten (fiktiv) | 3 Stück |
| USB-Stick | mit `klasse-7a-fiktiv.csv`, Demo-Export (JSON) und PDF-Beispielberichten |

## Technische Checkliste für den Veranstaltungstag

- [ ] Supabase-Projekt erreichbar (Dashboard lädt, keine Pausierung)
- [ ] `site/config.js` enthält URL + öffentlichen Schlüssel; Labor zeigt **kein** Demo-Banner
- [ ] Lehrerprogramm startet, Tresor entsperrt, „Angemeldet: …“ in der Statusleiste
- [ ] Demo-Gruppe synchronisiert, Code von Max Mustermann funktioniert (vorher einmal testen, dann Lernstand im Dashboard zurücksetzen)
- [ ] Dashboard angemeldet, Gruppe gewählt, Auto-Aktualisierung läuft („Aktualisiert um …“)
- [ ] Tablet: Browser aktuell, Labor-Adresse als Lesezeichen, Bildschirmsperre aus, Ton aus
- [ ] Hotspot getestet; Laptop-Akku/Netzteil
- [ ] Notfall-Tab mit Demo-Modus vorbereitet (`…/labore/physik-entdecker/?demo=1` und `…/lehrkraft/?demo=1`)
- [ ] Keine echten Schülerdaten auf dem Präsentationsrechner geöffnet

## Notfallplan bei Internetausfall

1. **Hotspot** des Smartphones verwenden (alles funktioniert gleich).
2. Geht gar nichts: auf den **Demo-Modus** wechseln (vorher im Browser geöffnet, Seiten sind dann geladen):
   - Labor `…/labore/physik-entdecker/?demo=1` und Dashboard `…/lehrkraft/?demo=1` **im selben Browser** (zwei Tabs).
   - Gelbes Banner erklärt: fiktive Daten, nur im Browser gespeichert. „Offline simulieren“ zeigt die Warteschlange.
   - Lehrerprogramm: *Datei → Pseudonymen Export (JSON) einlesen* mit dem vorbereiteten Export vom USB-Stick
     (Dashboard-Demo → *Antworten* → „Pseudonymer Gesamtexport“) → Namen werden lokal zugeordnet → PDF.
   - Ehrlich ansagen: „Das ist jetzt eine Simulation im Browser, keine Online-Speicherung.“
3. Letzte Rückfallebene: Screenshots/PDF-Beispielberichte vom USB-Stick zeigen.

## Datenschutzarchitektur (Kurzfassung für Kolleginnen und Kollegen)

- Kinder geben **keinen Namen** ein – nur einen zufälligen Code (z. B. `K7QP-M4XR-9TBA`).
- Der Server speichert Antworten unter einer Kennung wie `P-8F2A`; Codes nur als nicht umkehrbaren Prüfwert.
- Die Liste „Name ↔ Kennung ↔ Code“ liegt **verschlüsselt** (AES-256, Argon2id) nur auf dem Rechner der Lehrkraft.
- Datenbankregeln (Row-Level-Security) verhindern, dass Kinder andere Ergebnisse sehen oder Lehrkräfte fremde Klassen.
- Keine Werbung, kein Tracking, Speicherung nur nach abgeschlossenen Arbeitsschritten, automatische Löschfristen.
- Rechtlich ist das eine **Pseudonymisierung** – also weiterhin personenbezogen. Vor dem Echtbetrieb: Freigabe durch
  Schulleitung, Datenschutzbeauftragte/n, AV-Vertrag mit Supabase (siehe DATENSCHUTZ-PRUEFLISTE.md).

## Drei typische Fragen – und Antworten

**1. „Ist das jetzt DSGVO-konform, weil der Server in Frankfurt steht?“**
Nein, der Standort allein reicht nicht. Supabase ist ein US-Unternehmen; nötig sind u. a. ein Auftragsverarbeitungsvertrag,
die Bewertung möglicher Drittlandzugriffe, ein Eintrag im Verarbeitungsverzeichnis und die Information der Familien.
Die Architektur hilft stark (keine Namen, nur Kennungen, kurze Löschfristen), ersetzt aber diese Prüfung nicht.

**2. „Was passiert, wenn ein Kind seinen Code verliert oder weitergibt?“**
Im Lehrerprogramm „Neuen Code ausstellen“ und synchronisieren: Der alte Code und alle laufenden Anmeldungen sind sofort
ungültig, der Lernstand bleibt erhalten. Rateversuche fremder Codes sind praktisch aussichtslos (≈ 59 Bit Zufall) und
werden serverseitig begrenzt.

**3. „Muss ich meine bisherigen Lernlabore neu programmieren?“**
Nein. Bestehende Labore binden ein kleines Skript (SDK) ein und rufen nach abgeschlossenen Aufgaben z. B.
`lab.completeTask('aufgabe-1', { choice: 'b' })` auf; Anmeldung, Speichern, Offline-Puffer und Fortsetzen übernimmt das SDK.
Die bisherige PDF-Funktion kann als freiwilliger Export erhalten bleiben. Anleitung: docs/INTEGRATION-10-SCHRITTE.md.
