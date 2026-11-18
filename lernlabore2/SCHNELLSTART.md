# Schnellstart – die erste Vorführung

## A) Sofort, ohne Server (Demo-Modus, 3 Minuten)

Funktioniert, solange in `site/config.js` noch keine Server-Daten stehen – oder jederzeit mit `?demo=1` an der Adresse.
Alle Daten sind **fiktiv** und bleiben **nur in diesem Browser**. Ein gelbes Banner zeigt das deutlich an.

1. **Labor öffnen:** `…/lernlabore2/site/labore/physik-entdecker/?demo=1`
2. Auf **„Demo-Code einsetzen“** tippen (oder `TEST-HAUS-2345` eingeben) → **Los geht’s!**
3. Eine Vermutung wählen → unten erscheint „Gespeichert (Demo – nur in diesem Browser)“.
4. In einem **zweiten Tab** das Dashboard öffnen: `…/lernlabore2/site/lehrkraft/?demo=1`
   → Gruppe „DEMO – Fortbildung (fiktiv)“: 10 fiktive Personen mit Fortschritt, D-7KQP ist neu dabei.
5. Offline zeigen: im Labor oben **„Offline simulieren“** → eine Antwort geben → Anzeige
   „Offline – wird später synchronisiert“ → Simulation beenden → „Gespeichert“.
6. Lehrerprogramm ohne Server: Dashboard → *Antworten* → **„Pseudonymer Gesamtexport (JSON)“** herunterladen →
   im Lehrerprogramm *Datei → Pseudonymen Export (JSON) einlesen* → die Kennungen werden den fiktiven Namen
   (Max Mustermann, Erika Musterfrau …) zugeordnet → **PDF-Auswertung erstellen**.

Weitere Demo-Codes: `TEST-BAUM-2346`, `TEST-BERG-2347` … (siehe `config/demo-datensatz.json`).
„Demo zurücksetzen“ im Dashboard stellt den Ausgangszustand wieder her.

## B) Mit echtem Server (nach der Installation)

1. Lehrerprogramm starten, Tresor entsperren.
2. **Demo-Klasse (fiktiv) anlegen** → **Mit Online-Datenbank synchronisieren**
   (beim ersten Mal Supabase-Passwort eingeben). Zehn fiktive Personen bekommen automatisch fiktive Lernstände.
3. **Zugangskarten drucken** – oder in der Schülerliste „Codes anzeigen“ und den Code von *Max Mustermann* nehmen.
4. Labor öffnen, Code eingeben, eine Aufgabe lösen → „Gespeichert“.
5. Dashboard: neuer Fortschritt erscheint spätestens nach 15 Sekunden.
6. Lehrerprogramm: **Lernstände jetzt abrufen** → **Auswertung öffnen** → **PDF-Auswertung erstellen**.

Für den 15-Minuten-Ablauf der Fortbildung siehe [FORTBILDUNG.md](FORTBILDUNG.md).
