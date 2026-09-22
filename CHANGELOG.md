# Changelog

Alle relevanten Änderungen an LAMA Online werden in dieser Datei dokumentiert.
Bei jeder neuen Version einen Eintrag im Format unten ergänzen
(`## [x.y.z] – Titel – YYYY-MM-DD`, neueste Version oben).

## [Unreleased]

## [2.1.0] – Leave-Fix und Rundenstarter – 2026-09-18

### Behoben
- **Raum verlassen:** Explizites Verlassen entfernt den Spieler-Slot hart in jeder
  Phase (`removePlayerFromGame`) – die übrigen Spieler können weiterspielen
  (Zugnachführung, Host-Transfer, Bonus-Auflösung, Lobby-Rückfall bei < 2 Spielern).
  Reconnect bei ungewolltem Verbindungsabbruch funktioniert weiterhin.
- **Rundenstarter:** Wer alle Karten loswurde, beginnt die nächste Runde –
  sonst der Erst-Aussteiger (Prio in `settleRound` korrigiert).

## [2.0.0] – Party Edition – 2026-09-18

### Hinzugefügt
- **Neue Spielvariante „Party Edition“** (wählbar beim Erstellen des Raumes,
  Klassik bleibt Default) nach AMIGO-Regeln (02008-DE):
  - Deck (56): 7× 1–6, 6× Pluskarten (`1+`–`6+`), 7× Lama, 1× pinkes Lama (Joker).
  - Pluskarte gibt einen Extra-Zug; pinkes Lama passt überall, darauf nur Lama/1.
  - Wertung: Plus zählt als Basiswert, Lamas mit pinkem Lama = 20 statt 10.
  - Pinke 20er-Chips (greedy 20/10/1), Tausch 10 weiß→schwarz und 2× schwarz→pink,
    Bonus-Abgabe inkl. 20er.
- E2E-Spec `party-flow.spec.ts`, Unit-Tests `party.test.ts`, Doku in README/AGENTS.md.

## [1.1.0] – Versions-Bump – 2026-09-18

### Geändert
- Version in allen `package.json`-Dateien auf 1.1.0 angehoben (keine
  funktionalen Änderungen gegenüber 1.0.0).

## [1.0.0] – Erst-Release (Klassik) – 2026-09-17

### Hinzugefügt
- LAMA Online (Klassik-Variante): Echtzeit-Multiplayer für 2–6 Spieler via
  Cloudflare Workers (Durable Objects, SQLite-Storage, WebSocket Hibernation).
- Vollständige Klassik-Regeln: Solo-Endspurt, Einmaligkeitsprinzip, Chip-Bonus,
  40-Punkte-Spielende; Session-Resilienz via Reconnect.
- React-19-/Vite-/Tailwind-Frontend mit PWA-Grundausstattung, Barrierefreiheit
  (Modal-A11y, Live-Region, Reduced Motion) und Mobile-Portrait-Support.
