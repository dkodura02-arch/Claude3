# Kochplaner 🍲🎲

Unser Wochen-Kochplaner: Rezepte mit Bild und Zutaten, Saisonkalender, Shuffle-Modus und Einkaufsliste – als Web-App fürs Handy, gespeichert in unserem Google Drive.

**App:** https://dkodura02-arch.github.io/Claude3/ (nach der Einrichtung unten)

## Was die App kann

- **Woche würfeln:** Pro Woche ein **Big Batch** (Meal-Prep für Mo–Fr) und ein **Small Batch** (Wochenende).
  - Big Batch wiederholt sich nicht: Was kürzlich gekocht wurde, ist gesperrt. Was am längsten nicht dran war, kommt am ehesten.
  - Small Batch darf jederzeit wieder vorkommen.
  - Kohlenhydrate wechseln sich ab: Big und Small Batch einer Woche haben verschiedene Beilagen, und der Big Batch eine andere als in der Vorwoche. Kartoffeln, Reis und Nudeln sind die Hauptrotation; Bulgur, Couscous, Quinoa und Linsen werden einfach mitgemischt.
  - Saisonzutaten bekommen einen Bonus. Rezepte mit Spargel, Bärlauch & Co. kommen nur in ihrer Saison.
  - Die beiden Gerichte einer Woche haben möglichst nicht dasselbe Hauptgemüse.
  - **„Was haben wir da?“:** Rezepte mit Zutaten aus dem Kühlschrank werden bevorzugt. Rezepte mit **flexiblem Gemüse** passen zu jedem Gemüse.
  - Einzeln neu würfeln, festhalten oder selbst wählen. Filter für Aufwand und Preis.
- **Rezepte:** per Link (Chefkoch, KptnCook, Lecker, Blogs …), als **PDF** (z. B. Export aus einer Kochbuch-App – auch mehrere Dateien oder Rezepte auf einmal), als eingefügter Text oder von Hand mit Foto. Jedes Rezept hat **Typ** (Big/Small Batch), **Aufwand** (leicht/mittel/aufwendig), **Preis** (1–5 €), **Kohlenhydrat** und optional **flexibles Gemüse**.
- **Rezeptsammlung:** gut 40 einfache, günstige Gerichte ohne Fleisch zum Starten – einzeln löschbar, gelöschte kommen nicht wieder.
- **Favoriten (♥):** kommen beim Würfeln doppelt so oft dran.
- **Schriftgröße:** Normal, Groß (Standard) oder Sehr groß – pro Gerät in den Einstellungen.
- **Einkaufsliste:** entsteht automatisch aus dem Wochenplan, gleiche Zutaten werden zusammengefasst und nach Supermarkt-Bereichen sortiert. Ihr könnt abhaken, eigene Einträge ergänzen und die Liste teilen. Was im Vorrat ist, fliegt raus.
- **Saison:** Saisonkalender für Deutschland, Monat für Monat, mit euren passenden Rezepten.
- **Gemeinsam:** Beide Handys sehen dieselben Daten. Der Speicher liegt im Google-Drive-Ordner „Kochplaner“, mit täglicher Sicherung. Offline geht alles weiter und wird später abgeglichen.

## Einrichtung (einmalig)

### 1. App veröffentlichen (GitHub Pages)

1. Im Repository auf **Settings → Pages** gehen.
2. Bei **Source** „**GitHub Actions**“ auswählen.
3. Unter **Actions** den Workflow „Testen & Veröffentlichen“ öffnen und **Run workflow** klicken (oder einfach etwas pushen).
4. Nach 1–2 Minuten ist die App unter `https://dkodura02-arch.github.io/Claude3/` erreichbar.

Aufs Handy: Link öffnen. Auf dem iPhone in Safari **Teilen → Zum Home-Bildschirm**, bei Android in Chrome **⋮ → App installieren**.

### 2. Google Drive verbinden

Die Schritt-für-Schritt-Anleitung steht in der App unter **Einstellungen** (Zahnrad oben rechts). Dort gibt es auch einen Button, der den Script-Code kopiert. Kurzfassung:

1. Auf [script.google.com](https://script.google.com/home/projects/create) ein neues Projekt „Kochplaner“ anlegen und den Inhalt von [`apps-script/Code.gs`](apps-script/Code.gs) einfügen.
2. **Projekteinstellungen → Script-Property** `PASSWORT` mit eurem Haushalts-Passwort anlegen.
3. Die Funktion `einrichten` einmal ausführen und den Zugriff erlauben.
4. **Bereitstellen → Neue Bereitstellung → Web-App** (Ausführen als: Ich, Zugriff: Jeder) und die URL kopieren.
5. In der App unter Einstellungen die URL und das Passwort eintragen. Auf dem zweiten Handy genauso.

Ohne Drive-Verbindung funktioniert die App auch, speichert dann aber nur auf dem einen Gerät.

## Datenschutz

Der Code in diesem Repository ist öffentlich, eure Daten sind es nicht. Rezepte, Pläne und Einkaufslisten liegen nur in eurem Google Drive und auf euren Geräten. Das Passwort steht nirgends im Code.

Hochgeladene Fotos werden in Drive „für alle mit dem Link“ freigegeben, damit sie in der App angezeigt werden können. Der Link ist zufällig und nicht auffindbar.

## Entwicklung

```bash
npm install
npm run dev      # lokaler Server
npm test         # Tests (Shuffle-Regeln, Import, Saison, Sync, Google-Script)
npm run build    # Produktions-Build nach dist/
```

Aufbau:

- `src/lib/shuffle.ts`: Würfel-Logik (Regeln siehe oben)
- `src/lib/season.ts`: Saisonkalender
- `src/lib/importer.ts`: Rezept-Import (schema.org/JSON-LD, Microdata, Freitext)
- `src/lib/ingredients.ts`: Zutaten erkennen, zusammenfassen, Supermarkt-Bereiche
- `src/lib/store.ts`: lokaler Speicher (IndexedDB) und Abgleich mit Drive
- `apps-script/Code.gs`: Google-Script (Speicher in Drive, Bilder, Seitenabruf für den Import)
