# Quellen für Stationen, Insider-Tipps und Highlights

Stand: Oktober 2026. Ziel: Die Auswahl soll nicht nur auf Wikipedia beruhen, sondern echte Top-Ziele und
Geheimtipps enthalten – und trotzdem rechtlich sauber und dauerhaft kostenlos bleiben.

## Grundregel

**Fakten darf man übernehmen, Texte nicht.** Dass das Glockenspiel am Dorstener Markt hängt, ist eine Tatsache.
Die Beschreibung eines Reiseführers ist dagegen urheberrechtlich geschützt, und ganze Datenbanken (Bewertungen,
Ranglisten) sind zusätzlich als Datenbank geschützt. Deshalb: Ideen und Fakten aus vielen Quellen sammeln,
Texte immer selbst schreiben, und automatisch nur Quellen abfragen, deren Lizenz das erlaubt.

## 1. Offene Daten – automatisch nutzbar

| Quelle | Was sie liefert | Lizenz / Bedingungen | Status in Stadtfuchs |
|---|---|---|---|
| **Wikipedia** | Hintergründe, Jahreszahlen, Koordinaten | CC BY-SA (Texte), Fakten frei | genutzt (`pruefen.mjs`) |
| **Wikidata** | Alle Orte mit Koordinate im Umkreis; Anzahl der Sprachversionen als Maß für Bekanntheit | CC0 | **neu:** `kandidaten.mjs` |
| **Wikivoyage** | Reiseführer-Einträge mit Lage: Sehenswürdigkeiten, Aktivitäten, Restaurants, Cafés, Nachtleben, Geheimtipps von Einheimischen | CC BY-SA | **neu:** `kandidaten.mjs` |
| **OpenStreetMap** | Kneipen, Eiscafés, Spielplätze, Bäder, Freizeitparks, Aussichtspunkte | ODbL, Nutzungsregeln für den Suchdienst | genutzt (Koordinaten, Lokale) |
| **Touristischer Data Hub NRW** (Tourismus NRW, Open.NRW) | Offizielle Datensätze der Tourismusregionen: Sehenswürdigkeiten, Gastronomie, Touren, Veranstaltungen, als JSON/GeoJSON | CC0, CC BY oder CC BY-SA je Datensatz; kostenlos, Registrierung nötig | **Empfehlung:** registrieren und anbinden |
| **DZT Knowledge Graph** (open-data-germany.org) | Über 200.000 offizielle Datensätze aller 16 Bundesländer (Sehenswürdigkeiten, Touren, Gastronomie, Hotels) | offen, Zugang über Oberfläche, Programmierschnittstelle und MCP-Server | **Empfehlung:** für neue Städte prüfen |
| **OpenTripMap** | Über 10 Mio. Sehenswürdigkeiten weltweit, aus OSM und Wikidata, mit Bewertung | ODbL, kostenloser API-Schlüssel | optional |

Die beiden Tourismus-Datenbanken (Data Hub NRW und DZT) sind der größte Hebel: Das sind die Daten, mit denen auch
die offiziellen Stadtportale arbeiten – inklusive Ausflugszielen, Bädern und Freizeitparks. Die Registrierung beim
Data Hub NRW muss eine Person mit Kontaktdaten vornehmen, das kann ich nicht für dich erledigen.

## 2. Offizielle Tourismusseiten – lesen, Fakten übernehmen

| Quelle | Wofür gut |
|---|---|
| Ruhr Tourismus / **mein-ruhrgebiet.blog** | Eigene Rubriken für Geheimtipps, Fotospots, Picknickplätze, Szeneviertel |
| **RUHR.TOPCARD** (ruhrtopcard.de) | Über 150 Ausflugsziele, sortiert nach Kategorien (Erlebnis & Action, Schifffahrt & Bäder, Industriekultur, Museen, Achterbahn & Co.), mit Karte |
| Route der Industriekultur | Zechen, Halden, Landmarken im Ruhrgebiet |
| Stadtportale, z. B. **haltern-tourismus.de**, Stadtagentur Dorsten (Imagebroschüre) | Die besten lokalen Tipps: Waldspielplätze, Badeseen, Führungen, Feste |
| Naturpark Hohe Mark, Tourismus NRW (dein-nrw.de), Niederrhein Tourismus | Rad- und Wanderrouten, Naturziele |

## 3. Bewertungs- und Buchungsportale – nur über offizielle Schnittstellen

| Dienst | Zugang | Kosten | Einschätzung |
|---|---|---|---|
| **Tripadvisor** | Content API nach Freigabe (laufende Website und hinterlegte Karte nötig); automatisches Auslesen der Website ist verboten | laut Drittquellen rund 5.000 Abrufe/Monat frei, danach nutzungsabhängig | später sinnvoll für „Beliebt bei Reisenden“-Hinweise mit Bewertungen; Anzeigeregeln beachten |
| **Google Places** | API-Schlüssel | Freikontingente je Datenart (seit März 2025), danach kostenpflichtig | gut für Öffnungszeiten und „heute geöffnet“, Speichern der Daten ist eingeschränkt |
| **Foursquare Places** | API-Schlüssel | kostenlose Testumgebung | Alternative zu Google |
| **Yelp Fusion** | nur noch bezahlt (seit 2024) | ab ca. 229 $/Monat | nicht empfehlenswert |
| **GetYourGuide, Tiqets** | Partnerprogramm | kostenlos, Provision für dich | passt zur Finanzierung (Tickets für Museen, Touren) |
| **Komoot, Outdooractive** | Partnerprogramme | individuell | Inspiration für Rad- und Wanderziele; Outdooractive nutzen viele Tourismusregionen |

## 4. Social Media und Trends

| Plattform | Möglichkeit | Grenze |
|---|---|---|
| **Instagram / Facebook** | Graph API mit Business-Konto: Hashtag-Suche | nur 30 Hashtags pro Woche, höchstens 50 Beiträge je Abfrage, keine Nutzernamen; automatisches Auslesen ist laut Nutzungsbedingungen nicht erlaubt |
| **TikTok** | Research API | nur für Forschungseinrichtungen |

Empfehlung: Trends von Hand beobachten (z. B. regionale Hashtags wie #dorsten, #halternamsee, #ruhrpott), auffällige
Orte über Wikidata, OSM oder die Stadtseite prüfen und dann als Station anlegen. Langfristig sind die eigenen
Nutzer die beste Trendquelle: Im Prüfmodus gibt es schon das Feld „Fehlt etwas?“ für Orte und Geheimtipps.

## 5. Reiseführer, Ratgeber, Restaurant- und Hotelführer – Inspiration

| Art | Beispiele | Nutzung |
|---|---|---|
| Reiseführer | Marco Polo, Lonely Planet, Merian, DuMont | Ideen für Highlights; nichts übernehmen |
| Rankings und Ratgeber | tourispo.de (beliebteste und günstigste Ziele im Ruhrgebiet), ADAC (Freizeitparks NRW 2026) | Top-Ziele abgleichen |
| Familienportale | familienreisefieber.de, familie.de, freizeitmonster.de, kribbelbunt.de | Spielplätze, Bäder, Kindergeburtstag; Angaben oft ungeprüft, immer gegenprüfen |
| Wander- und Radportale | ich-geh-wandern.de, visorando, AllTrails, Hohe-Mark-Steig | Naturziele wie Hervester Bruch oder Wacholderheide |
| Restaurantführer | Guide Michelin (Sterne, Bib Gourmand), Gault&Millau, Der Feinschmecker, Varta, Falstaff | Auszeichnungen als Fakt nennen, jährlich prüfen |
| Unterkünfte | DJH-Jugendherbergen, Hotelportale | wichtig für Klassenfahrten: Rallye-Start an der Jugendherberge |

## 6. Ablauf für jede neue Stadt

1. `node stadtrallye/werkzeuge/kandidaten.mjs <stadt> [km]` – Kandidaten aus Wikidata (nach Bekanntheit) und
   Wikivoyage (inklusive Gastronomie und Nachtleben) auflisten; vorhandene Stationen sind markiert.
2. Offizielle Stadt- und Regionsseite sowie RUHR.TOPCARD/Data Hub abgleichen – was fehlt an Top-Zielen und Geheimtipps?
3. Stationen anlegen, Texte selbst schreiben, Feld `quelle` ausfüllen, bei unsicherer Lage `"lageUngefaehr": true` setzen.
4. `node stadtrallye/werkzeuge/pruefen.mjs <stadt> --fakten` – Koordinaten und Zahlen prüfen.
5. Vor Ort mit dem Prüfmodus kontrollieren (zeigt Quelle und unsichere Lagen an).

## 7. Was die Recherche für die Testregion gebracht hat

| Ort | Neue Stationen | Quelle |
|---|---|---|
| Dorsten | Cornelia Funke Baumhaus, Glockenspiel am Markt, Spikerhaus & Erinnerungsgarten für Tisa, Lippefähre Baldur (Fähre mit Muskelkraft), Storchennester im Hervester Bruch, Jägerhof Einhaus, Pommes Funke, Blauer See, Dorstener Aak („kleinstes Museum“); CreativQuartier Fürst Leopold ergänzt | Wikivoyage, Imagebroschüre der Stadt, Wikidata |
| Haltern am See | Waldspielplatz Dachsberg, Silbersee III mit Deutschlands größter schwimmender Solaranlage, Silbersee II, Hullerner Stausee, Holtwicker Wacholderheide, Weinladen WuGaT, Tanzcafé Die Stadtmühle | haltern-tourismus.de, Wikivoyage, Familien- und Wanderportale |
| Schermbeck | Ameisenpfad (Barfußpfad) | Familienportal, OpenStreetMap |
| Voerde | Falknerei Grieblinger | Familienportal |

Noch offen für die Region (zu weit für eine Fußrallye, aber gut für Rad-Rallyes oder eine eigene „Ausflugsziele“-Liste):
Movie Park Germany und Schloss Beck (Bottrop-Kirchhellen), Pankok Museum in Hünxe-Drevenack, Schloss Gartrop,
Kohlenmeiler in der Haard, Rhader Wassermühle, Barkenberger See, Deutener Moor.

## 8. Highlights, Essen & Trinken, neue Städte (Oktober 2026)

Jede Station und jeder Tipp trägt im Feld `quelle`, woher die Angabe stammt. Übernommen wurden nur Fakten
(dass es den Ort gibt, was ihn ausmacht, Zahlen), keine Texte, Bewertungen oder Ranglisten.

| Zweck | Portale |
|---|---|
| Welche Städte gefragt sind | weddingstyle.de und junggesellenabschied.net (JGA-Städte), cts-reisen.de und jugendtours.de (Klassenfahrt-Städte), Alpetour |
| Berlin | visitBerlin, tipBerlin, top10berlin, 1000things, Berliner Kurier (Imbisse), kindaling |
| Hamburg | hamburg-tourism.de, hamburg.de, Stadtmagazine, kindaling |
| Köln | koeln.de, KölnTourismus, Mit Vergnügen Köln, Kneipenführer von Accor |
| Düsseldorf | visitduesseldorf, Time Out, freizeitinsider, kindaling |
| München, Stuttgart | Stadtführer, t-online, Stadtmagazine |
| Ruhrgebiet (Essen, Bochum, Dortmund) | ruhr-tourismus.de, nrw-tourism.com, mvp.de (Brauereiführung Fiege), In Your Pocket, budgettraveller.org, ADAC Maps |
| Neue Lokale | Meininger (Gastronomie-Fachmedium) |
| Lage, Existenz, Grunddaten | OpenStreetMap (Lokale, Eisdielen, Spielplätze), Wikivoyage, Wikipedia |

**Nicht aufgenommen, weil geschlossen:** Odysseum Köln (2025), Brauhaus „Zum Schiffchen“ in Düsseldorf
(seit Herbst 2024), Museum für Antike Schifffahrt in Mainz (seit 2022), Buddenbrookhaus in Lübeck (Umbau, voraussichtlich
bis 2029).

**Mit Hinweis aufgenommen:** Gutenberg-Museum Mainz (Ausstellung „MOVED“ im Ausweichquartier Reichklarastraße),
Valentin-Musäum München (Sanierung des Isartors), Florianturm Dortmund (Restaurant seit November 2025 als „Turm137“
wieder offen). Solche Angaben ändern sich schnell – vor jeder Saison im Prüfmodus kontrollieren.
