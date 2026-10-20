# Stadtfuchs – Stadtrallyes für jeden Anlass

Web-App (PWA) für Stadtrallyes und Schnitzeljagden: JGA, Schulklasse, Kita, Kindergeburtstag,
Kneipentour, Firmenevent oder einfach ein Tag in einer neuen Stadt. Läuft komplett im Browser,
ohne Server und ohne Konto. Fotos und Spielstand bleiben auf dem Gerät.

Aufruf (GitHub Pages): `https://jasteffe91-tech.github.io/mathe10/stadtrallye/`

## So funktioniert eine Rallye

1. **Stadt** wählen
2. **Anlass** (wer spielt?) – steuert Schwierigkeit, Länge, Tempo, erlaubte Orte und die Missionen
3. **Thema** – Bunte Mischung, Geschichte, Kurioses, Kulinarisch, Kneipentour (nur Erwachsene),
   Spaß & Action, Kinder & Spielplätze, Parks & Wasser
4. **Spielart**
   - *Quiz mit Lösungswort*: jede Antwort liefert einen Buchstaben; am Ende wird das Wort eingegeben
   - *Punkte-Challenge* (für Kinder: *Sterne-Rallye*): Quiz, Schätzfrage, Foto, Mission, Suchen, Bewegen
   - *Foto- & Selfie-Rallye*: eine Fotoaufgabe je Station, am Ende eine Collage
   - *Geführter Spaziergang*: nur Infos, Fun-Facts und Vorlesefunktion
5. **Länge** und **Startpunkt** (Stadtzentrum oder eigener Standort)

Die Route wird automatisch berechnet (nächster Nachbar + 2-opt, gewichtet nach Thema und Bekanntheit).
„Andere Route“ würfelt neu. Eine Rallye ist durch Stadt, Einstellungen, Orte und eine Zufallszahl
vollständig bestimmt – deshalb lässt sie sich als **Link/QR-Code** an andere Teams weitergeben.
Bei mehreren Teams startet jedes an einer anderen Station.

**JGA-Frechheitsstufen:** Bei JGA Männer/Frauen wählt die Gruppe Harmlos, Frech, Wild oder Teuflisch.
Die Missionen der gewählten Stufe kommen zuerst, mildere füllen auf. Aufgaben mit Fremden verlangen immer deren Einverständnis.

**Prüfmodus** (`#pruefen-<stadt>`, Knopf „Alle Stationen ansehen & prüfen“ im Planer): Alle Stationen mit Lösungen,
je „Passt“ / „Stimmt nicht“ plus Notiz und ein Feld für fehlende Orte. „Prüfbericht kopieren“ erzeugt einen Text
zum Weitergeben. Städte mit `"entwurf": true` tragen auf der Startseite das Etikett „Testphase“.

**Zu Fuß oder mit dem Rad:** Mit dem Fahrrad dürfen Etappen viermal so lang sein – wichtig für kleinere Orte.

Weitere Funktionen: Karte (Leaflet + OpenStreetMap), Richtungspfeil und Entfernung per GPS,
optionale GPS-Pflicht für die Ankunft, Vorlesen (Sprachausgabe), Laufzettel und Lösungsblatt zum
Drucken, Urkunde, Foto-Collage, Offline-Betrieb über Service Worker.

## Dateien

| Datei | Inhalt |
|---|---|
| `index.html` | Oberfläche und Gestaltung |
| `app.js` | Logik: Routenplanung, Spielablauf, Fotos, Teilen, Druck |
| `daten/grundlagen.json` | Anlässe, Themen, Spielarten, Punkte, allgemeine Aufgaben, Lösungswörter |
| `daten/staedte.json` | Städteverzeichnis (wird vom Werkzeug erzeugt) |
| `daten/staedte/<stadt>.json` | Orte und Aufgaben einer Stadt |
| `werkzeuge/pruefen.mjs` | Prüft die Daten und holt Koordinaten aus Wikipedia/OpenStreetMap |
| `werkzeuge/kandidaten.mjs` | Schlägt neue Stationen vor (Wikidata nach Bekanntheit, Wikivoyage inkl. Gastronomie) |
| `QUELLEN.md` | Welche Quellen es gibt und was davon genutzt werden darf |
| `sw.js` | Service Worker (Offline) |

## Neue Stadt hinzufügen

1. Kandidaten sammeln: `node stadtrallye/werkzeuge/kandidaten.mjs <id>` (siehe [QUELLEN.md](QUELLEN.md)).
1. `daten/staedte/<id>.json` anlegen (Vorlage: eine bestehende Stadt kopieren).
2. Für jeden Ort `wiki` (exakter Titel des deutschen Wikipedia-Artikels) **oder** `suche`
   (Adresse/Suchtext für OpenStreetMap) angeben. Bei Lokalen und Firmen besser `suche` –
   deren Wikipedia-Koordinate ist oft die Firmenzentrale.
3. `node stadtrallye/werkzeuge/pruefen.mjs <id> --fakten` ausführen. Das Werkzeug
   - ergänzt fehlende Koordinaten (`lage`),
   - meldet nicht existierende Wikipedia-Artikel mit Vorschlägen,
   - meldet Orte, die über 12 km vom Zentrum liegen (meist falsche Treffer),
   - prüft, ob Schätzwerte im Wikipedia-Text vorkommen (`--fakten`).
4. `node stadtrallye/werkzeuge/pruefen.mjs` (ohne Stadt) schreibt `daten/staedte.json` neu.
5. Die neue Datei in `sw.js` in die Liste `STAEDTE` eintragen und die Cache-Version erhöhen.

### Aufbau eines Orts

```json
{
  "id": "dom",                         // eindeutig innerhalb der Stadt, nur a–z, 0–9, _
  "name": "Kölner Dom",
  "wiki": "Kölner Dom",                // oder "suche": "Adresse, Stadt"
  "themen": ["highlights", "historie"], // erstes Thema = Hauptthema
  "prio": 3,                           // 1 = Geheimtipp, 2 = sehenswert, 3 = Wahrzeichen
  "ab18": false,                       // nur für JGA/Kneipentour (z. B. Reeperbahn)
  "respekt": false,                    // Gedenkort: keine Spiele/Selfies, nicht für JGA/Kita
  "kosten": "Eintritt",                // optional
  "hinweis": "Öffnungszeiten prüfen",  // optional
  "info": "2–3 Sätze, erscheinen nach dem Raten",
  "fakt": "Ein Fun-Fact",              // optional
  "aufgaben": [
    { "typ": "quiz", "niveau": "kind|erw", "frage": "…", "richtig": "…", "falsch": ["…", "…"] },
    { "typ": "schaetzen", "frage": "…", "wert": 157, "einheit": "m" },
    { "typ": "foto|mission|suchen|bewegen", "text": "…" }
  ]
}
```

Regeln für gute Daten: Jeder Ort braucht mindestens ein Quiz (sonst fällt er im Lösungswort-Modus
weg), idealerweise eines für Kinder und eines für Erwachsene. Die Antwort sollte **nicht** wörtlich
im `info`-Text stehen, oder die Frage zielt auf etwas, das man vor Ort sieht. Fakten mit Zahlen gegen
Wikipedia prüfen. Kneipen bekommen `"hinweis": "Öffnungszeiten vorab prüfen"`.

## Ideen für den Ausbau

Ausbauplan, Alpetour-Recherche und Finanzierung: siehe [STRATEGIE.md](STRATEGIE.md).


- **Live-Wettkampf**: Teams auf verschiedenen Handys mit gemeinsamer Bestenliste (braucht Server,
  z. B. Supabase/Firebase)
- **Rallye-Baukasten**: Veranstalter (Lehrkräfte, Trauzeugen) stellen Stationen selbst zusammen
  und schreiben eigene Fragen, z. B. über das Brautpaar
- **Weitere Aufgabentypen**: Rätsel mit Hinweis-Stufen, Reihenfolge sortieren, Bilderrätsel
  (Detailfoto finden), QR-Code an der Station scannen, Audio-Guide, AR-Fundstücke
- **Mehr Städte und Orte**: mittelgroße Städte, Urlaubsorte; pro Stadt 40+ Orte, damit Themen wie
  „Kinder“ oder „Kulinarisch“ ohne ergänzte Stationen auskommen
- **Mehrsprachigkeit** (Englisch für Touristen)
- **Monetarisierung**: Freemium (kurze Rallye gratis, Premium-Themen/JGA-Pakete kostenpflichtig),
  Schul- und Kita-Lizenzen, Firmen-Teamevents, Partner-Gastronomie (Freigetränk an der Station),
  White-Label für Stadtmarketing und Tourist-Infos
- Vor dem großen Start: eigener Kartenanbieter statt der freien OSM-Kacheln (Nutzungsrichtlinie),
  Impressum/Datenschutzerklärung, Markenrecherche für den Namen
