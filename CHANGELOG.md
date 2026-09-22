# Changelog

Alle relevanten Änderungen an LAMA Online werden in dieser Datei dokumentiert.
Bei jeder neuen Version einen Eintrag im Format unten ergänzen
(`## [x.y.z] – Titel – YYYY-MM-DD`, neueste Version oben).

## [Unreleased]

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
