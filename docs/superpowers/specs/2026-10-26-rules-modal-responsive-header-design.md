# Rules-Modal-Kopfzeile: Responsive Layout

## Ziel

Die Varianten-Kopfzeile des Regel-Dialogs soll bei 320 px und 390 px nicht mehr mit dem Schließen-Button kollidieren. Titel, Variantenhinweis und Schließen bleiben verständlich und bedienbar; bei 1280 px bleibt die bisherige einzeilige Darstellung erhalten.

## Gewählter Ansatz

Die mobile Kopfzeile darf umbrechen und reserviert rechts genügend Platz für den absolut positionierten Schließen-Button. Hilfe-Symbol und Titel bleiben dabei als Gruppe zusammen; das Varianten-Badge kann bei schmalen Breiten darunter rutschen, statt unter den Button zu geraten. Ab dem Desktop-Breakpoint bleibt die Kopfzeile einzeilig.

Alternative: Das Varianten-Badge mobil ausblenden, da der Untertitel die Variante ebenfalls nennt. Verworfen, weil das Badge auf Mobilgeräten sichtbar bleiben soll.

## Umfang und Grenzen

- Nur Layout und responsive Tests des Regel-Dialogs ändern; keine Textkürzung, Symbole oder Spielregeln ändern.
- Andere Dialog-/Steuerleisten-Layouts nur dann anpassen, wenn die Prüfung denselben reproduzierbaren Overlap zeigt.
- Playwright prüft Badge/Button-Überlappung und horizontalen Overflow bei 320, 390 und 1280 px; Screenshots werden visuell kontrolliert.
