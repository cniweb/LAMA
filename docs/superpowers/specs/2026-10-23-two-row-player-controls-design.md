# Zweizeilige Statusleiste während der Runde

## Ziel

Die Spieler sollen ihre Chip-Anzahl und die möglichen Züge auf schmalen Displays gleichzeitig sehen können. Die bisherige einzelne, horizontal scrollbare Steuerzeile wird in eine Chips-/Tauschzeile und eine Zug-/Statuszeile aufgeteilt.

## Umfang und Verhalten

- `PlayerHand` zeigt eine feste, zweizeilige Leiste: oben Chips und verfügbare Tauschaktionen, unten Zugaktionen oder den Warte-/Ausgestiegen-Status.
- Tauschaktionen sind während des eigenen Zuges, während der Wertung (`ROUND_SUMMARY`/`GAME_OVER`) und für den Spieler mit offenem Bonus-Chip-Dialog erlaubt. Im Bonus-Dialog ist nur dieser Spieler berechtigt.
- Die Wertung addiert neue Chips bereits zu `myPlayer.chips`; die Anzeige verwendet daher diesen Gesamtbestand.
- Die Rundenabrechnung ist ein modales Overlay und verdeckt `PlayerHand`. Deshalb werden die Chip-Anzeige und die Tauschaktionen während dieses Zustands zusätzlich innerhalb des Abrechnungsdialogs angeboten, damit sie tatsächlich bedienbar sind.
- Auf 320px, 390px und 1280px dürfen Chip- und Zugzeile nicht horizontal überlaufen, sich überdecken oder ihre Höhe abhängig vom Zustand verändern. Interaktive Ziele bleiben mindestens 44px hoch.
- Der mobile Spielbildschirm bleibt bei 360×640px auch nach einem Zug ohne vertikales Scrollen bedienbar.

## Ansätze

- **Empfohlen: zwei feste Zeilen und wiederverwendbare Chip-/Tausch-Steuerung.** Die Rundenabrechnung erhält dieselbe Tauschfunktion im Dialog, weil das bestehende Overlay die darunterliegende Steuerleiste blockiert. Vermeidet versteckte Aktionen und doppelte Tauschlogik.
- Eine einzelne Zeile mit Scrollen wurde verworfen, weil genau dadurch die Chips auf Mobilgeräten verdeckt werden.
- Dynamisches Umbrechen ohne feste Zeilenhöhe wurde verworfen, weil die Steuerleiste dann zwischen Zug- und Wartezustand springt.

## Technische Leitplanken

- Keine Regel-/Serveränderung: der Tausch wird bereits serverseitig in allen relevanten Phasen unterstützt.
- Mobile-first mit Tailwind; Verifikation per Playwright gegen den gebauten Stack.
- UI-Tests decken die festen Zeilen, die Tauschberechtigung und Overflow an den drei verbindlichen Viewports ab.

## Offen für die Umsetzung

Kompakte Labels und Abstände bei 320px sind eine Implementierungsentscheidung, solange Chips vollständig sichtbar bleiben und die Touch-Ziele mindestens 44px hoch sind.
