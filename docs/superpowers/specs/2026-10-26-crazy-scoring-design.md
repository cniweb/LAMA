# Crazy-Sonderkartenwertung und Spielende

## Ziel

Die Crazy-Edition soll Aktionskarten als echte Minuspunkte werten und einen längeren Spielverlauf erlauben, ohne Klassik oder Party zu verändern.

## Umfang und Verhalten

- Jede abgelegte `SK`, `D2` oder `GF` zählt **15 Minuspunkte pro Karte**. Doppelte und mehrfache Exemplare werden jeweils addiert.
- Zahlen- und Pluskarten behalten das bestehende Einmaligkeitsprinzip.
- Das goldene Lama `GL` bleibt bei **30 Minuspunkten** als höchste Stufe der Lama-Gruppe (`GL > PL > L`); es wird nicht zusätzlich als Aktionskarte gewertet.
- Ein Spiel endet ab **60 Gesamt-Minuspunkten** in Crazy. Klassik und Party enden weiterhin ab **40**.
- Die Grenzprüfung gilt überall gleich, einschließlich normaler Rundenabrechnung, Bonus-Chip-Abgabe und Spielerentfernung während der Wertung. Die Regelanzeige nennt den variantenspezifischen Wert.

## Ansätze

- **Gewählt: direkte Addition und zentrale Grenzfunktion.** `calculateUniquePoints` addiert pro Crazy-Aktionskarte 15, während normale Karten weiterhin dedupliziert werden. Eine gemeinsame Funktion liefert die Spielende-Schwelle für alle Abrechnungspfade.
- Variante durch `calculateUniquePoints` durchreichen: verworfen, weil die Aktionskartenwerte nur in Crazy vorkommen und damit keine Variantenverzweigung für die Punkteberechnung nötig ist.

## Grenzen

- Keine Änderung an Karteneffekten, Deckzusammensetzung, Chipwerten oder Bonus-Chip-Regeln.
- Keine Änderung der 40-Punkte-Grenze für Klassik und Party.
- Regressionstests decken Mehrfachzählung der Aktionskarten sowie 40/60-Grenzen über die relevanten Abrechnungspfade ab.
