# Synchronisierter Start des nächsten Durchgangs

## Problem

Nach einer Rundenabrechnung soll nicht der erste Klick eines Spielers sofort
einen neuen Durchgang für den gesamten Raum starten. Jeder Spieler soll wählen
können, ob er den nächsten Durchgang mitspielen möchte oder den Raum verlässt.
Bis alle verbleibenden Spieler entschieden haben, bleibt die Abrechnung sichtbar.

Zusätzlich verschwinden derzeit während einer ausstehenden Bonus-Chip-Rückgabe
die Aktionen zum nächsten Durchgang, zum neuen Spiel und zum Verlassen für alle
Spieler. Die Auswahl muss auch in diesem Zwischenzustand erreichbar sein.

## Verhalten

- In der Abrechnung kann jeder Spieler unabhängig „Nächsten Durchgang starten“
  auswählen. Die Auswahl markiert ausschließlich diesen Spieler als bereit.
- Ein bereits bereiter Spieler sieht einen Wartezustand; die Abrechnung und
  „Neues Spiel“ sowie „Raum verlassen“ bleiben sichtbar.
- Der nächste Durchgang beginnt erst, wenn alle aktuell im Raum befindlichen
  Spieler bereit sind und keine Bonus-Chip-Rückgabe mehr aussteht.
- Spieler dürfen während des Wartens den Raum verlassen. Ihre Bereitschaft wird
  mit dem Slot entfernt. Bleiben danach weniger als zwei Spieler übrig, fällt
  der Raum wie bisher in die Lobby zurück und bewahrt die erspielten Chips.
- Ist der letzte benötigte Spieler ausgestiegen, startet der Durchgang für die
  verbleibenden mindestens zwei bereiten Spieler automatisch.
- Ist ein Bonus-Chip noch offen, bleibt die Abrechnung für alle sichtbar und
  die Synchronisierung wartet auf die Rückgabe. Die berechtigte Person kann
  parallel den Durchgang bestätigen. Nach der Rückgabe startet der Durchgang,
  falls dann alle verbleibenden Spieler bereit sind.
- „Neues Spiel“ bleibt eine sofortige, separate Aktion und setzt die
  Bereitschaften zurück.
- Die Bereitschaft ist Teil des autoritativen, persistierten Spielzustands,
  wird an alle Clients übertragen und bei einem Reconnect wiederhergestellt.
- Beim Start des nächsten Durchgangs werden alle Bereitschaften zurückgesetzt.

## Architektur

`GameState` erhält eine Liste bereiter Spieler; `ClientRoomView` überträgt sie
für die UI. Eine gemeinsame Engine-Transition markiert einen Spieler bereit und
startet nur bei erfüllter Barriere. Der Worker akzeptiert die Bestätigung nach
dem Rundenende einschließlich der offenen Bonus-Chip-Phase und wendet dieselbe
Barrierenlogik nach Chip-Rückgabe und Raumverlassen an. Das Abrechnungsmodal
zeigt Bereitschaft bzw. Warten pro Client an, ohne die anderen Abschlussaktionen
auszublenden.

## Tests und Abnahmekriterien

- Ein 3-Spieler-Test bestätigt: ein bzw. zwei Bestätigungen starten noch keine
  Runde; die dritte Bestätigung startet den nächsten Durchgang genau einmal.
- Ein Leave-Test bestätigt, dass der verlassende Slot aus der Barriere entfernt
  wird und verbleibende bereite Spieler bei mindestens zwei Slots starten.
- Ein Test bestätigt, dass eine offene Bonus-Chip-Rückgabe den Start blockiert,
  aber nach Rückgabe bei vollständig bereiter Gruppe den Durchgang startet.
- Ein Frontend-E2E-Test durchläuft Rundenende mit drei Spielern und prüft, dass
  Bestätigungen gesammelt werden, bevor alle drei Clients die neue Runde sehen.
- Bestehende Regeln für `NEW_GAME`, Lobby-Rückfall und Spielende bleiben
  erhalten.

## Grenzen

Die Bereitschaft gilt nur für den nächsten Durchgang und wird weder über ein
„Neues Spiel“ noch über einen erfolgten Rundenstart hinweg übernommen. Ein
disconnect allein gilt nicht als Verlassen; der Spieler bleibt bis zum
expliziten Raumverlassen Teil der Barriere und kann nach Reconnect fortfahren.
