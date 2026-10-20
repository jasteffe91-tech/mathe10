# Stadtfuchs – Ausbau und Finanzierung

Stand: Oktober 2026. Ziel: viele zufriedene Nutzer zuerst, Einnahmen später, langsam und dauerhaft.
Laufende Kosten so nah wie möglich an null.

## 1. Klassenfahrt-Ziele bei Alpetour

Quelle: Zielübersicht auf alpetour.de (abgerufen Oktober 2026). Wie oft Schulen welches Ziel buchen,
veröffentlicht Alpetour nicht. Die Priorisierung unten stützt sich deshalb auf die typischen
Klassenfahrtziele und darauf, wie gut sich ein Ziel für eine Stadtrallye eignet.

| Bereich | Städte | Anzahl |
|---|---|---|
| Deutschland Nord | Bremen, Hamburg, Kiel, Papenburg, Rostock, Schwerin | 6 |
| Deutschland Mitte | Aachen, Berlin, Chemnitz, Dresden, Eisenach, Erfurt, Frankfurt, Köln, Leipzig, Magdeburg, Mainz, Naumburg, Potsdam, Saarbrücken, Weimar | 15 |
| Deutschland Süd | Freiburg, Heidelberg, München, Nürnberg, Stuttgart | 5 |
| Europa | Amsterdam, Antwerpen, Athen, Barcelona, Bratislava, Breslau, Brüssel, Budapest, Danzig, Den Haag, Dublin, Edinburgh, Eindhoven, Florenz, Genf, Graz, Kopenhagen, Krakau, Lille, Lissabon, Liverpool, Ljubljana, London, Luxemburg, Lyon, Madrid, Maastricht, Mailand, Manchester, Maribor, Marseille, Paris, Prag, Riga, Rom, Rotterdam, Salzburg, Stettin, Stockholm, Straßburg, Utrecht, Valencia, Venedig, Warschau, Wien, Zürich, Alicante, Helsinki | 48 |
| **Städte gesamt** | | **74** |
| Regionen (Inseln, Seen, Mittelgebirge, Küsten) | z. B. Sylt, Rügen, Harz, Sauerland, Bodensee, Gardasee | rund 60 |

**Schon in Stadtfuchs:** Berlin, Bremen, Frankfurt, Hamburg, Köln, München, Stuttgart (7 von 26 deutschen
Alpetour-Städten). Dazu Düsseldorf und die Testregion Dorsten, Haltern am See, Schermbeck und Voerde.

### Empfohlene Reihenfolge für Schulen

1. **Deutsche Klassiker:** Dresden, Leipzig, Weimar, Potsdam, Nürnberg, Heidelberg, Erfurt
2. **Ausland mit Sprachbezug:** London, Paris, Amsterdam, Prag, Wien, Rom. Hier liegt ein echtes Alleinstellungsmerkmal:
   eine **Englisch-Rallye in London** oder eine **Französisch-Rallye in Paris**, deren Fragen auf Englisch oder
   Französisch gestellt sind. Damit wird die Rallye zur Unterrichtsaufgabe, und Lehrkräfte empfehlen sie weiter.
3. **Gedenkstättenfahrten** (Krakau/Auschwitz, Weimar/Buchenwald, Berlin) nur als ruhige, geführte Touren ohne Spielaufgaben.
   Die App hat dafür schon die Markierung „Gedenkort“.
4. **Regionen:** Ortsrallyes für die Orte, in denen Klassen übernachten (Westerland, Binz, Lüneburg, Winterberg).

Aufwand je Stadt: rund 25 bis 35 Stationen. Mit dem Prüfwerkzeug sind Koordinaten und Wikipedia-Abgleich
automatisiert. Pro Stadt bleiben Texte, Fragen und die Prüfung vor Ort, im besten Fall durch Lehrkräfte,
die mit dem eingebauten Prüfmodus Rückmeldung geben.

## 2. Fast kostenlos betreiben

| Posten | Heute | Bei Wachstum | Kosten |
|---|---|---|---|
| Hosting | GitHub Pages | Cloudflare Pages oder Netlify (statisch, skaliert fast unbegrenzt) | 0 € |
| Domain | – | eigene Domain, z. B. stadtfuchs-rallye.de (Verfügbarkeit prüfen) | ca. 10–15 €/Jahr |
| Karten | freie OpenStreetMap-Kacheln (nur für geringe Last erlaubt) | eigene Vektorkarte als PMTiles-Datei (Protomaps) auf Cloudflare R2 oder Freikontingent eines Kartenanbieters | 0–5 €/Monat |
| Navigation | Link in Google Maps / Apple Karten | unverändert | 0 € |
| Fotos | bleiben auf dem Handy | unverändert (spart Speicher und Datenschutz-Aufwand) | 0 € |
| Live-Wettkampf mehrerer Teams | – | Cloudflare Workers + D1 oder Supabase im Gratis-Kontingent | 0 € bis viele tausend Nutzer |

Die App braucht keinen eigenen Server. Das ist der wichtigste Kostenhebel und sollte so bleiben, solange es geht.

## 3. Einnahmen: langsam, passend, dauerhaft

Grundsatz: **Für Schulen, Kitas und Familien bleibt Stadtfuchs kostenlos und werbefrei.** Das schafft
Vertrauen und Empfehlungen in Kollegien und Elterngruppen. Geld kommt aus Bereichen, in denen es niemanden stört.

| Phase | Einnahmequelle | Warum sie passt | Größenordnung |
|---|---|---|---|
| ab sofort | Unterstützen-Knopf (z. B. Ko-fi) | Zufriedene Nutzer geben gern etwas zurück | klein, aber sofort |
| ab ca. 1.000 Rallyes/Monat | Affiliate-Links zu Tickets (Museen, Seilbahn, Hafenrundfahrt) und Unterkünften, klar als Werbung gekennzeichnet, nur bei Erwachsenen-Rallyes | Passt zum Inhalt, der Nutzer bucht sowieso | wächst mit der Nutzung |
| ab ca. 5.000 Rallyes/Monat | **JGA-Paket** (einmalig 2,99–4,99 €): eigene Fragen über das Brautpaar, Bonus-Missionen, Urkunde und Fotobuch-Vorlage | JGA-Gruppen geben ohnehin Geld aus, der Preis ist pro Person minimal | Hauptsäule für Endkunden |
| lokal testen | **Partner-Stationen**: Eiscafé, Kneipe, Bäckerei als Station mit kleinem Vorteil für Rallye-Teams, 10–30 €/Monat | Bringt den Läden Laufkundschaft; in der Testregion Dorsten/Haltern einfach selbst anzusprechen | planbare Monatsbeträge |
| später | **Rallye-Baukasten** für Lehrkräfte, Vereine, Firmen (eigene Stationen und Fragen) – Basis gratis, Firmen zahlen | Wiederkehrender Bedarf | Abo |
| später | **Kooperationen**: Klassenfahrt-Veranstalter (z. B. Alpetour), Jugendherbergen, Tourist-Infos und Stadtmarketing lizenzieren Rallyes als Programmpunkt oder eigene Version | Wenige Partner, dafür regelmäßige Zahlungen | größter Hebel |

Bewusst nicht: Bannerwerbung in Kinder-Rallyes, Abo-Zwang, Bezahlschranke für Schulen.

### Kennzahlen, die zählen

- gestartete und beendete Rallyes pro Monat (ohne Tracking-Dienst, z. B. mit einem datensparsamen Zähler)
- geteilte Rallye-Links (jeder geteilte Link ist eine Empfehlung)
- Rückmeldungen aus dem Prüfmodus

## 4. Fahrplan

| Zeitraum | Schritte |
|---|---|
| jetzt | Testregion Dorsten, Haltern, Schermbeck, Voerde vor Ort prüfen (Prüfmodus), Fehler korrigieren |
| 1–3 Monate | 6 deutsche Klassiker ergänzen (Dresden, Leipzig, Weimar, Potsdam, Nürnberg, Heidelberg); Impressum und Datenschutzerklärung; eigene Domain |
| 3–6 Monate | London und Paris mit Sprach-Rallye; Lehrkräfte aus dem Umfeld testen lassen; Unterstützen-Knopf |
| 6–12 Monate | Live-Wettkampf für Klassen; JGA-Paket; erste Partner-Stationen in der Testregion |
| ab 12 Monaten | Baukasten und Kooperationen mit Veranstaltern und Städten |

## 5. Rechtliches vor dem öffentlichen Start

- Impressum und Datenschutzerklärung (auch wenn keine Daten gesammelt werden)
- Affiliate-Links sichtbar als Werbung kennzeichnen
- JGA- und Kneipen-Rallyes nur für Erwachsene; Aufgaben verlangen immer das Einverständnis fremder Personen
- Markenrecherche für den Namen „Stadtfuchs“ beim DPMA, bevor Geld in Logo und Domain fließt
- Kartenkacheln: Nutzungsbedingungen des Anbieters einhalten (siehe Abschnitt 2)
