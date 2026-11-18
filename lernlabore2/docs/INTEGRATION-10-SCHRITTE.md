# Ein bestehendes GitHub-Lernlabor in 10 Schritten integrieren

Ziel: Ein vorhandenes Lernlabor speichert künftig automatisch und pseudonym, ohne dass es neu geschrieben werden muss.
Die alte Funktionalität (inkl. freiwilligem PDF-Export) bleibt erhalten; ohne SDK läuft das Labor wie bisher.

## Bestandsaufnahme der vorhandenen Labore (Repository `mathe10`, Stand 13.11.2026)

| Typ | Labore | Merkmale | Integration |
|---|---|---|---|
| **A – Stationen-Labor** | `labor/physik/arbeit-leistung`, `labor/nw/elektrizitaet`, `labor/mathe/funktionen`, `labor/mathe/stochastik`, `labor/mathe/terme`, `labor/mathe/zins-berichtigung` | Zustand `S` mit Eingaben in `S.d[...]`, Aufgabenliste `AUFG`, `istFertig(a)`, `zaehlt(a)`, `speichern()` (localStorage, max. 3 h), `init()`, Namensfelder, PDF-Abgabe + PDF-Import | **fertiger Adapter** `site/sdk/stationen-labor-adapter.js` – ca. 4 Zeilen Änderung (unten) |
| **B – Schreib-/Abgabelabor** | `labor/deutsch/bildergeschichten`, `labor/deutsch/herbstlyrik`, `labor/physik/weltall-8d` | Namensfeld, Texteingaben, Abgabe über IServ | SDK direkt: je Abschnitt `saveAnswer`/`completeTask` (Muster wie Beispiel-Labor) |
| **C – Simulationswerkzeug** | `labor/physik/energiefluss`, `labor/physik/flaschenzug`, `labor/mathe/pyramide`, `labor/englisch/midwest` | keine Schülerergebnisse, nur Komfort-Einstellungen | optional: Messwerttabellen als `data` speichern |

Die vorhandenen Labore wurden **nicht verändert**. Der Adapter wurde an einer temporären Kopie von
„Arbeit und Leistung“ im Demo-Modus geprüft (Namensfeld ausgeblendet, Antwort gespeichert, in neuem Browser wiederhergestellt).

## Die 10 Schritte

### 1. Kennung und Version festlegen
Eindeutige Labor-ID aus Kleinbuchstaben/Ziffern/Bindestrichen, z. B. `ph10e-arbeit-leistung`, Version `1.0`.
Ändern sich später Aufgaben, die Version erhöhen (alte Ergebnisse behalten ihre Version).

### 2. Aufgabenliste (Manifest) erstellen
Datei `lab.manifest.json` neben das Labor legen (Format: [API.md](API.md#2-lab-manifest-labmanifestjson)).
Jede speicherbare Aufgabe braucht eine stabile `task_id`. Für **Typ A** erzeugt der Adapter das Manifest automatisch aus
`AUFG` (`task_id` = `a.id`, z. B. `a1-2`); zum Registrieren kurz in der Browser-Konsole ausgeben:
`copy(JSON.stringify({id:'ph10e-arbeit-leistung',version:'1.0',title:document.title,tasks:AUFG.filter(zaehlt).map(a=>({task_id:a.id,title:a.nr+' '+(a.titel||a.ph),kind:'other'}))}))`

### 3. Labor in der Datenbank registrieren
```bash
node scripts/manifest-to-sql.mjs pfad/zu/lab.manifest.json > mein-labor.sql
```
Inhalt im Supabase-SQL-Editor ausführen. (Ohne Node.js: das SQL-Muster in `supabase/optional/beispiel-labor.sql` von Hand anpassen.)

### 4. SDK einbinden
Im `<head>` bzw. **vor** dem Labor-Skript (Pfade relativ zum Labor anpassen; Beispiel für `labor/physik/arbeit-leistung/`):
```html
<script src="../../../lernlabore2/site/config.js"></script>
<script src="../../../lernlabore2/site/sdk/lernlabor-sdk.js"></script>
<script src="../../../lernlabore2/site/sdk/stationen-labor-adapter.js"></script>  <!-- nur Typ A -->
```

### 5. Start über das SDK
**Typ A:** am Ende des Labor-Skripts die Zeile `init();` ersetzen durch
```js
LernlaborAdapter.start({ labId: 'ph10e-arbeit-leistung', labVersion: '1.0', title: 'Physik-Labor: Arbeit und Leistung' });
```
**Andere Labore:**
```js
const manifest = await fetch('lab.manifest.json').then((r) => r.json());
const lab = await Lernlabor.initializeLab({ labId: manifest.id, labVersion: manifest.version, manifest });
```
Das SDK zeigt jetzt „Willkommen im Lernlabor! Gib deinen Zugangscode ein.“, die Speicheranzeige und „Abmelden“.

### 6. Namensfelder überflüssig machen
Name, Klasse oder E-Mail werden nicht mehr abgefragt. Der Adapter blendet `#vorname`/`#nachname` aus und setzt die
Kennung (`P-8F2A`) ein, damit vorhandene Prüfungen und der freiwillige PDF-Export weiter funktionieren. Bei anderen Laboren:
Felder ausblenden und `lab.participant.pseudonym` verwenden.

### 7. Nach abgeschlossenen Arbeitsschritten speichern
```js
lab.completeTask('a1', { choice: 'b' });                         // Auswahl
lab.completeTask('a2', { text: textfeld.value.trim() });          // Freitext
lab.saveAnswer('m1', { anzahl: messwerte.length }, { data: { messwerte } });   // Zwischenstand (begonnen)
```
Nicht bei jedem Tastendruck speichern – nach dem Abschluss einer Aufgabe (Knopf „Fertig“, Auswahl getroffen,
Messung hinzugefügt). **Typ A:** erledigt der Adapter automatisch, indem er `speichern()` erweitert und nach jeder
Änderung prüft, welche Aufgaben laut `istFertig(a)` abgeschlossen sind und sich geändert haben.

### 8. Gespeicherten Stand anzeigen (Fortsetzen)
```js
const r = lab.getResult('a1');          // null oder { answer, data, status, pending }
if (r) auswahlMarkieren(r.answer.choice);
lab.on('results', () => alleAnzeigenAktualisieren());   // z. B. nach Konflikt oder Synchronisierung
```
**Typ A:** Der Adapter übernimmt die gespeicherten Eingaben vor `init()` in `S.d` – das Labor zeigt sie wie gewohnt an.
Lokale Altstände anderer Personen auf demselben Gerät werden dabei verworfen.

### 9. PDF-Export und Import beibehalten oder vereinfachen
Der bisherige PDF-Export kann als **freiwillige** Sicherung für die Kinder bleiben (er enthält jetzt die Kennung statt des
Namens). Der PDF-**Import** zum Weiterarbeiten ist nicht mehr nötig; der Hinweistext auf der Startseite des Labors
(„lade die PDF bei IServ hoch …“) sollte angepasst werden: „Deine Antworten werden automatisch gespeichert.“

### 10. Testen – erst Demo, dann Testsystem
1. `…/mein-labor/?demo=1` öffnen, Demo-Code einsetzen, Aufgaben lösen → „Gespeichert (Demo …)“.
2. Dashboard `…/lehrkraft/?demo=1` → das Labor erscheint mit Fortschritt (im Demo-Modus wird es automatisch registriert).
3. Im **Testsystem**: Labor einer Testgruppe zuweisen (Dashboard → Verwaltung), mit einem Testcode durchspielen,
   Offline-Fall prüfen (WLAN aus/an), im Lehrerprogramm „Lernstände abrufen“ und PDF erstellen.

## Beispiel für ein neues Labor

Siehe [`labs/beispiel-labor/index.html`](../labs/beispiel-labor/index.html): ~30 Zeilen JavaScript ohne Build-Schritt –
Manifest laden, `initializeLab`, Stand anzeigen, nach jeder Antwort `completeTask`. Für aufwendige Labore mit
TypeScript dient [`labs/physik-entdecker/src/main.ts`](../labs/physik-entdecker/src/main.ts) als Vorlage.

## Häufige Fehler

| Meldung | Ursache |
|---|---|
| „Dieses Lernlabor ist für deine Gruppe gerade nicht freigeschaltet.“ | Labor nicht registriert (Schritt 3) oder der Gruppe nicht zugewiesen (Dashboard → Verwaltung) |
| „Diese Aufgabe kennt der Server nicht.“ | `task_id` im Labor ≠ Manifest/Datenbank oder falsche `labVersion` |
| Seite bleibt im Demo-Modus | `config.js` nicht gefunden (Pfad prüfen) oder leer |
| „Noch nicht eingerichtet“ | `config.js` enthält eine ungültige Adresse (muss mit `https://` beginnen) |
