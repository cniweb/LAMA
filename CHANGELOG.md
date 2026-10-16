# Changelog

Alle relevanten Änderungen an LAMA Online werden in dieser Datei dokumentiert.
Bei jeder neuen Version einen Eintrag im Format unten ergänzen
(`## [x.y.z] – Titel – YYYY-MM-DD`, neueste Version oben).

## [Unreleased]

## [2.5.0] – Crazy: mehr „Zieh 2“ – 2026-10-16

### Geändert
- **Crazy Edition – häufigere „Zieh 2“-Karte:** Die Draw-Two-Karte (`D2`) kommt
  im Crazy-Deck jetzt **4× statt 2×** vor, damit die Aktion öfter auftritt. Das
  Deck wächst dadurch von 63 auf **65 Karten** (Party-Basis + 1× `GL` + 2× `SK`
  + 4× `D2` + 2× `GF`). Skip (`SK`) und Gift (`GF`) bleiben unverändert bei je 2×.
  Die Spiellogik der Karte (Zugwechsel, Best-Effort-Ziehen, Verpuffen im
  Solo-Endspurt) ist unverändert – es ändert sich nur die Häufigkeit im Stapel.
  Abgesichert durch angepasste Unit-Tests (`shared/tests/crazy.test.ts`).

## [2.4.4] – Mobile-Chip-Tausch klickbar – 2026-10-16

### Behoben
- **Chip-Tausch-Button auf Mobile nicht klickbar:** Durch den Fix für die
  konstante Höhe der Steuerzeile (v2.4.3) lag der horizontale Scroll auf dem
  äußeren Container, während der rechte Status-Block (`shrink-0`) per
  `justify-between` an den Rand gezogen wurde. Auf schmalen Mobilbreiten
  (360–390px) wurde der linke Block mit den Tausch-Buttons (`min-w-0`) dadurch
  so komprimiert, dass die Buttons in den Bereich des Status-Blocks gedrängt und
  nicht mehr erreichbar/klickbar waren. Der horizontale Scroll liegt nun auf dem
  linken Block selbst (`flex-1 overflow-x-auto`), sodass Tausch-Buttons und
  Status-Block disjunkte Bereiche haben und die Buttons wieder voll klickbar
  sind. Die konstante Zeilenhöhe (`h-[60px]`) bleibt erhalten.

## [2.4.3] – Steuerzeile mit konstanter Höhe – 2026-10-12

### Behoben
- **Steuerzeile sprang in der Höhe:** Die Zeile mit Chips und Aktionen unter der
  Hand war je nach Zustand mal ein-, mal zweizeilig – besonders wenn die
  Chip-Tausch-Buttons erschienen, wuchs sie und wirkte unruhig. Sie hat jetzt eine
  **konstante Höhe** (responsive für Mobile und Desktop), unabhängig davon, ob der
  Spieler am Zug ist oder Tausch-Optionen sichtbar sind: feste Höhe statt
  inhaltsgetriebenem Wachstum, einheitliche Button-/Element-Höhen und horizontaler
  Scroll statt Umbruch bei Extrembreiten (kein Abschneiden). Geprüft auf 390px und
  1280px.

## [2.4.2] – Abrechnungs-Darstellung – 2026-10-12

### Behoben
- **Karten in der Rundenabrechnung liefen über:** In der Abrechnung
  (`RoundSummaryModal`) wurden die Restkarten per `!important`-Overrides in eine
  Minigröße gezwängt. Sonderkarten (Lama, pinkes/goldenes Lama, Aktionskarten)
  rendern aber ein großes Emoji samt Textlabel darunter und ragten dadurch über
  den Kasten des jeweiligen Spielers hinaus. Neu gibt es eine echte, kompakte
  Kartengröße `xxs` mit `overflow`-Clipping, die bei Sonderkarten das Textlabel
  ausblendet und das Emoji verkleinert – die Karten bleiben jetzt vollständig in
  ihrer Box.

## [2.4.1] – Rundenende-Fix – 2026-10-12

### Behoben
- **Rundenende sperrt Weiterspielen:** Legt ein Spieler seine letzte Handkarte ab,
  endet der Durchgang jetzt zuverlässig für **alle** – kein nachträgliches
  „Solo"-Weiterspielen mehr. Ursache war, dass `settleRound` nach dem Leerspielen
  den Bonus-Chip-Dialog öffnet und die Phase bewusst auf `IN_ROUND` lässt, die
  Zug-Handler (`playCard`/`drawCard`/`foldPlayer`) aber nur die Phase prüften und
  nicht den offenen Bonus-Dialog (`pendingChipDiscardPlayerId`). Dadurch konnte
  ein anderer Spieler im Zwischenzustand weiter Karten ablegen. Die Handler lehnen
  solche Züge nun mit einer klaren Meldung ab, und `filterStateForClient` bietet
  während des Bonus-Dialogs keine Aktionen mehr an (UI konsistent zum Server).
  Gilt für alle Varianten (Klassik/Party/Crazy); die Bonus-Chip-Belohnung des
  Finishers funktioniert unverändert. Abgesichert durch `shared/tests/round-end.test.ts`.

## [2.4.0] – Crazy Edition & Security-/Dependency-Pflege – 2026-10-12

### Hinzugefügt
- **🦙✨ Crazy Edition – dritte Spielvariante:** Wählbar bei der Raum-Erstellung
  neben Klassik und Party (gleiches Variantenmodell wie Party, fix bei Erstellung).
  - **Goldenes Lama (`GL`):** Joker beim Ablegen (passt auf jede Karte) und
    **Reset** als oberste Karte (die nächste Karte darf beliebig sein). In der
    Wertung **30 Minuspunkte**; innerhalb der Lama-Gruppe zählt nur die höchste
    Stufe einmal (`GL` 30 > `PL` 20 > `L` 10, nicht additiv).
  - **Aktionskarten (zahllos, immer legbar, 0 Minuspunkte, Folgekarte beliebig):**
    **Skip (`SK`)** überspringt den nächsten aktiven Spieler; **Draw-Two (`D2`)**
    lässt den nächsten aktiven Spieler bis zu 2 Karten ziehen (best effort bei
    knappem Stapel) und aussetzen – im Solo-Endspurt verpufft die Aktion;
    **Gift (`GF`)** gibt automatisch die höchste Handkarte an den aktiven Spieler
    mit den wenigsten Karten (kein Wartezustand, keine UI-Auswahl).
  - **Deck:** 63 Karten (Party-Basis + 1× `GL` + je 2× `SK`/`D2`/`GF`). Crazy erbt
    die pinken 20er-Chips der Party Edition (Werte bis 30 Punkte möglich).
  - **Frontend:** 3-fache Variantenwahl in der Lobby, Karten-Rendering für die
    neuen Typen, Lobby- und Raum-Header-Badge, variantenabhängiger `?`-Regel-Dialog.
  - Abgesichert durch Unit-Tests (`shared/tests/crazy.test.ts`, inkl. Edge Cases)
    und E2E-Smoke (`frontend/e2e/crazy-flow.spec.ts`); Klassik/Party unverändert.

### Behoben
- **Security (High, CVE-2026-96889):** `sharp` kam transitiv über
  `wrangler → miniflare` in Version < 0.35.5 (librsvg-Schwachstelle). `wrangler`
  auf `^4.149.0` angehoben → zieht `miniflare@5.20261006.1-alpha` mit `sharp@0.35.5`.
  `npm audit` meldet nun 0 Vulnerabilities (Dependabot-Alert #12 geschlossen).
- **Service Worker:** Optional-Chaining im Push-Handler (`pending?.roomCode`),
  behebt die letzte Biome-Warnung – `npm run lint` ist jetzt komplett warnungsfrei.

### Geändert
- **Dependencies:** `@biomejs/biome` 2.5.14 → 2.5.15, `@vitejs/plugin-react`
  6.1.1 → 6.1.2 (Vite-8-Peer erfüllt), sowie vorangegangene Bumps (u. a. `vite`
  8.3.0 → 8.3.2, `vitest` 5.0.1 → 5.0.3, `@types/node`, `lucide-react`,
  `@cloudflare/workers-types`, `undici`, `source-map-js`).
- **CI:** Security-Audit report-only, damit Dependency-PRs nicht blockiert werden;
  `softprops/action-gh-release` 1 → 3. Lokale AI-Tooling-Caches (`.serena`, `.omo`)
  werden ignoriert.
- **AGENTS.md:** Lessons Learned 6.19 (Crazy Edition als dritte Raum-Variante) und
  Nachtrag zu 6.8 (verwaiste `@rollup/rollup-*`-Bindings unter Vite 8/Rolldown
  sind unkritisch, per CI verifiziert).

## [2.3.1] – Varianten-Regeln & Doku-Konsistenz – 2026-09-22

### Geändert
- **Regeln (?) variantenabhängig:** `RulesModal` zeigt jetzt immer die **vollständigen
  Regeln der gewählten Variante** – Badge `Klassik`/`Party`, Utensilien (Klassik:
  56× 8×1–6/8×Lama, 70 Chips; Party: 7×1–6/6×Plus/7×L/1×PL + pink 20er), Sonderfälle
  PL als Joker/Extra-Zug (Plus), Abrechnung (Lama 10 vs. 20 mit PL, Plus= Basiswert)
  und Bonus (Party auch pink). `App.tsx` reicht `variant` (Lobby-Auswahl) bzw.
  `state.variant` (im Raum) an `RulesModal` weiter.
- **Doku konsistent:** `docs/tech-stack.md` PWA/Push/VAPID (`push_subscriptions`,
  `pending_push`, `maybeNotifyNextPlayer`, `VAPID_*`) + Frontend-Hooks/Modals
  beschrieben; `README.md` Techn. Hinweise ergänzt (variantenabhängiger `?`-Dialog,
  `(i)`-Version, Install/Push).

## [2.3.0] – Punkte-Reset & Push-Fix – 2026-09-22

### Behoben
- **Punkte-Reset beim Verlassen / neuer Spieler:** Verlässt jemand den Raum,
  werden bei allen Verbleibenden Punkte/Chips auf 0 und Durchgänge auf 1
  zurückgesetzt (`resetGameForNewMatch` nach `removePlayerFromGame` im
  `LEAVE_ROOM`-Handler sowie nach `addPlayerToRoom` im WS-Upgrade/`JOIN_ROOM`
  wenn bereits Scores/Runden existieren). Betritt ein neuer Spieler die Lobby
  mit bestehendem Fortschritt, ebenfalls Reset – faire Basis für alle.
- **Push-Benachrichtigungen auch bei verlassenem Tab / geschlossenem Browser / App-Wechsel:**
  `maybeNotifyNextPlayer` sendet jetzt immer (auch wenn WS noch offen ist,
  SW unterdrückt Duplikat wenn Fenster sichtbar). `pending_push`-Tabelle +
  `GET /api/room/:code/push/pending?endpoint=...` + `caches('lama-room')`
  für `roomCode` (via `postMessage LAMA_SET_ROOM` aus `usePushSubscription`);
  SW `push`-Handler holt erst Cache, dann Pending und zeigt `LAMA – Du bist
  am Zug!` mit `url=/?room=CODE` – Klick fokussiert/öffnet Raum und ermöglicht
  direkt das Fortsetzen des Zuges. `notificationclick` + `tag` + `vibrate`.

## [2.2.3] – Version im Raum & Responsive-Refine – 2026-09-22

### Hinzugefügt
- **Raum-Header (i):** Zwischen Online-Icon und (?) ein neuer `(i)`-Button
  (`Info`, `data-testid="version-info-button"`, `p-1 sm:p-1.5 min-w-8 sm:min-w-11`)
  öffnet `VersionInfoModal` (lazy, wie `RulesModal`, `useModalDialog`, `Info` +
  `vX.Y.Z` aus `frontend/package.json` + Link mit `ExternalLink` →
  `https://github.com/cniweb/LAMA/blob/main/CHANGELOG.md` im neuen Fenster).

### Behoben
- **Header-Responsive mit 5 Buttons:** Trotz neuem `(i)`-Button kein Overflow auf
  320px. Alle Icon-Buttons jetzt einheitlich `min-w-8/min-h-8 sm:min-w-11/min-h-11`
  (32px mobil spart ~40px), Header `px-3 sm:px-4` + `gap-1 sm:gap-3` + `flex-1 min-w-0`
  + `flex-wrap` für Badges. Leitplanke: >5 Icons → `...`-Menü statt weiter schrumpfen.

### Geändert
- **AGENTS.md:** Lessons Learned 6.16–6.18 dokumentiert (Responsive Header,
  PWA Install & Push mit VAPID ohne Offline-Cache, Version Single Source of Truth).

## [2.2.2] – Versionshinweis auf Startseite – 2026-09-22

### Hinzugefügt
- **Startseite unten:** Nach den Regeln ein kleiner Hinweis `(i) vX.Y.Z` mit
  Versionsnummer live aus `frontend/package.json` (`resolveJsonModule` in
  `tsconfig.base.json`, `import pkg from '../package.json'`) plus Link
  `Changelog` → `https://github.com/cniweb/LAMA/blob/main/CHANGELOG.md`
  (`target="_blank" rel="noopener noreferrer"`, `Info`-Icon, `text-[11px]`).

## [2.2.1] – Responsive Header-Fix – 2026-09-22

### Behoben
- **Navigation oben:** Header passte nach den neuen Buttons (Install, Glocke) nicht mehr
  auf schmale Viewports. Jetzt `px-3 sm:px-4`, `gap-1 sm:gap-3`, Buttons
  `p-1 sm:p-1.5 min-w-9 sm:min-w-11` (36px statt 44px auf Mobil), linke Seite
  `flex-1 min-w-0` mit `flex-wrap` für Badges, alle Buttons `shrink-0` –
  kein horizontaler Overflow mehr auf 320–375px, ab `sm` wieder volle 44px-Touch-Targets.

## [2.2.0] – PWA Install & Push-Benachrichtigungen – 2026-09-22

### Hinzugefügt
- **PWA Install-Button:** Zwischen Hilfe (?) und Verlassen im Header (Icon-Variante)
  sowie prominent auf der Startseite direkt über den Regeln (Full-Variante, `variant='full'`).
  Nutzt `beforeinstallprompt` (mit iOS-Fallback »Teilen → Zum Home-Bildschirm«),
  versteckt sich automatisch im `standalone`-Modus, minimaler Service Worker
  (`/sw.js` mit `skipWaiting`/`clients.claim`, `push` + `notificationclick`).
  SW wird nur im `isSecureContext` registriert (`frontend/src/main.tsx`).
- **Browser-Benachrichtigung bei eigenem Zug:** Zweistufig – lokal via
  `Notification` API wenn der Tab im Hintergrund ist (`useTurnNotifications`,
  `document.hidden`/`hasFocus`, `tag: lama-turn-<room>`), und Push via Service
  Worker wenn der Browser/App geschlossen ist. Neue Glocke im Header
  (`NotificationButton`, `Bell`/`BellOff`) für Opt-in, Permission-Handling,
  `pushManager.subscribe` mit VAPID-Key (`GET /api/push/vapidPublicKey`).
  Worker speichert Subscriptions in `push_subscriptions` (SQLite im DO) und
  versendet per VAPID-JWT (`ECDSA P-256` via WebCrypto) an den nächsten
  Spieler, wenn dessen WS nicht verbunden ist (`maybeNotifyNextPlayer` via
  `ctx.waitUntil`). REST-Endpunkte `POST /api/room/:code/push/subscribe|unsubscribe`
  plus WebSocket-Messages `REGISTER_PUSH`/`UNREGISTER_PUSH`. VAPID-Keys in
  `worker/wrangler.jsonc` (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`).
- **Service Worker erweitert:** `push`-Event zeigt »LAMA – Du bist am Zug!« mit
  Raum/Runde (`/?room=<code>` als `data.url`), `notificationclick` fokussiert
  bestehenden Client oder öffnet neues Fenster.

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
