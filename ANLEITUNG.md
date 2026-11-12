# Vorratshaltung – Anleitung

Eine App fürs Handy, mit der du deine Lebensmittelvorräte verwaltest: was liegt wo, wie viel ist da, was läuft bald ab, was muss eingekauft werden.

- Die App liegt kostenlos auf **GitHub Pages** und wird im Handy-Browser geöffnet.
- **Deine Vorratsdaten bleiben nur auf deinem Handy.** Sie werden nirgendwohin hochgeladen.
- Nach dem ersten Öffnen funktioniert die App **auch ohne Internet**. Nur das Nachschlagen neuer Barcodes braucht Internet.

---

## 1. App aufs Handy holen

1. Am Handy in **Chrome** die Adresse der App öffnen: **https://bonsai1977.github.io/vorrat/**
2. Chrome-Menü **⋮** → **„Zum Startbildschirm hinzufügen“** (oder „App installieren“) → **Hinzufügen**.
3. Ab jetzt die App über das neue Symbol auf dem Startbildschirm öffnen.

Beim ersten Scannen fragt Chrome, ob die App die Kamera benutzen darf → **Zulassen**.

## 2. So benutzt du die App

| Bereich | Wofür |
|---|---|
| **Übersicht** | Was ist abgelaufen, was läuft bald ab, was ist unter dem Mindestbestand |
| **Vorrat** | Alles, was da ist. Filtern nach Lagerort und Kategorie. Mit **– / +** die Menge ändern, Eintrag antippen zum Bearbeiten oder Verschieben |
| **+ Hinzufügen** | Einkauf einbuchen: **Barcode scannen**, Lagerort und MHD wählen, speichern. Mit „Speichern & nächsten scannen“ geht der ganze Einkauf schnell |
| **Einkauf** | Einkaufsliste. Produkte unter ihrem **Mindestbestand** erscheinen automatisch. Im Laden abhaken, mit dem Kisten-Symbol direkt in den Vorrat buchen |
| **Mehr** | Lagerorte und Kategorien anpassen, Warnzeit fürs MHD, Mindestbestände, Datensicherung |

**Gleicher Artikel an mehreren Orten oder mit verschiedenen MHDs:** Artikel im Vorrat antippen → **„+ Weitere Packung (anderer Ort oder MHD)“**. Dort Menge, Lagerort und MHD wählen → **Einlagern**. Im Bearbeiten-Fenster siehst du oben alle anderen Packungen dieses Artikels.

**Bemerkung:** Jeder Artikel hat ein Feld **„Bemerkung zum Artikel“** (beim Hinzufügen und beim Bearbeiten). Sie erscheint in der Vorratsliste unter dem Artikel, und die Suche findet auch Wörter aus der Bemerkung.

**Bestand als Tabelle:** Unten in der Vorratsliste oder unter **Mehr → Bestandsliste als Tabelle** → **„Tabelle (CSV) erstellen“**. Die Datei enthält den gesamten Vorrat mit Produkt, Marke, Kategorie, Lagerort, Menge, Einheit, MHD, Tagen bis zum MHD, Status, Mindestbestand, Bemerkung und Barcode. Sie öffnet sich in Excel oder Google Tabellen. Am besten in Google Drive speichern oder dir per Mail schicken.

**Entnehmen:** Oben rechts auf **„Entnehmen“** tippen und den Barcode scannen. Die App nimmt automatisch die Packung, die am frühesten abläuft.

**Barcode wird nicht erkannt?** Im Scanner auf „Foto aufnehmen“ tippen oder die Nummer unter dem Strichcode eintippen. Produktnamen holt die App aus der freien Datenbank Open Food Facts. Kennt sie ein Produkt nicht, trägst du den Namen einmal ein, beim nächsten Scan weiß die App ihn.

## 3. Datensicherung – wichtig!

Weil die Daten nur auf dem Handy liegen, sind sie weg, wenn du in Chrome die **Websitedaten löschst**, die App deinstallierst oder das Handy verlierst.

- **Mehr → Sicherung speichern**: Das Teilen-Menü öffnet sich. Am besten **in Google Drive speichern** oder dir per Mail schicken.
- **Mehr → Sicherung einspielen**: stellt einen gespeicherten Stand wieder her (ersetzt die aktuellen Daten). So kommen die Daten auch auf ein neues Handy.
- Die App erinnert dich auf der Übersicht, wenn die letzte Sicherung über einen Monat her ist.

## 4. Probleme?

| Problem | Lösung |
|---|---|
| Kamera geht nicht | Chrome: Schloss-Symbol neben der Adresse → Berechtigungen → Kamera erlauben. Oder im Scanner „Foto aufnehmen“ nutzen |
| Daten sind weg | Mehr → Sicherung einspielen und die letzte Sicherungsdatei wählen |
| Neue App-Version erscheint nicht | App einmal schließen und neu öffnen; Änderungen kommen beim zweiten Start an |

---

## Für später: App ändern und neu veröffentlichen

Die App besteht nur aus den Dateien im Ordner `docs`. Nach Änderungen in `docs/sw.js` die Zeile `VERSION` hochzählen (z. B. `vorrat-v3`), damit Handys die neue Version laden. Danach die Änderungen zu GitHub hochladen; GitHub Pages aktualisiert die App nach etwa einer Minute.
