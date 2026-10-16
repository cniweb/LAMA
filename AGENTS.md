# AGENTS.md – LAMA Online Engineering Playbook & Guidelines

Dieses Dokument definiert die verbindlichen Architektur-Vorgaben, Konventionen und Entwicklungs-Richtlinien für autonome KI-Agenten und menschliche Entwickler in diesem Repository.

---

## 1. Projekt-Überblick & Architektur

LAMA ist ein webbasiertes Echtzeit-Kartenspiel (2–6 Spieler) im Monorepo-Design:
* `shared/`: Plattformunabhängige TypeScript-Engine (Spielregeln, Deck, Validierung, Rundenabrechnung, WebSocket-Typen).
* `worker/`: Cloudflare Worker mit **Durable Objects (SQLite-backed)** und **WebSocket Hibernation API**.
* `frontend/`: React 19 + Vite + Tailwind CSS Client.

---

## 2. Cloudflare Free Tier & Durable Object Regeln

1. **SQLite-backed Storage (`this.ctx.storage.sql`):**
   * Durable Objects müssen SQLite als Storage-Backend nutzen (KV-Storage ist im Free Tier nicht zulässig).
   * Der Spielzustand wird atomar nach jeder Zustandsänderung persistiert.
2. **WebSocket Hibernation API:**
   * Verbindungen **müssen** über `this.ctx.acceptWebSocket(serverWs)` angenommen werden.
   * Niemals Standard-Node.js `ws` oder veraltetes `ws.accept()` nutzen.
   * Das DO hiberniert bei Inaktivität und verbraucht 0 GB-s Compute, wacht bei eingehenden Frames automatisch auf.
3. **Autoritativer Server & Anti-Cheat:**
   * Niemals Karten anderer Spieler an den Client senden (`filterStateForClient`).
   * Verdeckt abgelegte Handkarten ausgestiegener Spieler bleiben unenthüllt bis zur offiziellen Rundenabrechnung.
4. **Git-Integration (CI/CD):**
   * Das Repository wird via Cloudflare GitHub App angebunden.
   * `npm run build` im Root muss ohne Fehler durchlaufen.

---

## 3. Entwicklungs- & Testmandate

1. **Test-First für Spiellogik (`shared/`):**
   * Jede Änderung an den Spielregeln muss durch automatisierte Unit-Tests in `shared/tests/` abgesichert sein.
   * Test-Framework: Vitest.
   * Alle Sonderregeln (Solo-Endspurt, Lama auf 6, 1 auf Lama, Einmaligkeitsprinzip bei Minuspunkten, Chip-Rückgabe) müssen getestet sein.
2. **TypeScript Strict Mode:**
   * Keine `any`-Casts ohne zwingende Begründung.
   * Shared Types in `shared/src/types.ts` sind die Single Source of Truth für Frontend und Backend.
3. **Session-Resilienz:**
   * Spieler-Identifikation erfolgt über eine vom Client erzeugte `sessionId` (im `localStorage`).
   * Verbindungsabbrüche führen zu Status `DISCONNECTED`. Bei Reconnect wird der bestehende Spieler-Slot wiederbelebt.
4. **Responsive Design ist Pflicht (Mobile + Desktop):**
   * Jeder Frontend-/Design-Fix UND jedes neue Feature MUSS für **Mobile und Desktop** funktionieren und geprüft werden – nicht nur für eine Breite.
   * Verbindliche Prüfbreiten: mindestens **320px** (Ultra-schmal), **390px** (Mobile) und **1280px** (Desktop). Kein horizontaler Overflow, kein Abschneiden, keine springenden/variablen Elementhöhen zwischen Zuständen.
   * Mobile-First mit Tailwind-Breakpoints (`sm:` etc.); Touch-Ziele ≥ 44px. UI-Elemente, die je nach Zustand erscheinen/verschwinden (Buttons, Badges), dürfen die Layout-Höhe nicht springen lassen – feste Höhe statt inhaltsgetriebenem Wachstum (siehe §6.23).
   * Verifikation: UI-Änderungen mit Playwright gegen den gebauten Stack auf mehreren Viewports prüfen (Höhe/Overflow messen + Screenshot ansehen), siehe §6.21/§6.23. Reine Code-Review genügt für UI NICHT.

---

## 4. Befehle & Workflows

* `npm run build`: Baut alle Workspaces (`shared`, `frontend`, `worker`).
* `npm test`: Führt alle Unit-Tests aus.
* `npm run lint`: Prüft Lint, Format und Import-Sortierung mit Biome (`biome ci .`).
* `npm run lint:fix`: Wendet sichere Biome-Autofixes an (`biome check --write .`).
* `npm run format` / `npm run format:check`: Formatiert bzw. prüft die Formatierung.
* `npm run dev:frontend`: Startet den Vite-Dev-Server mit lokalem Worker-Proxy.
* `npm run dev:worker`: Startet Wrangler im lokalen Modus (`wrangler dev`).
* `npm run deploy --workspace=worker`: Deployed den Worker (läuft mit cwd `worker/`, damit `wrangler.jsonc` gefunden wird).
* **CI (`.github/workflows/ci.yml`):** Läuft bei jedem Push auf `main` und jedem Pull Request mit den Jobs `lint`, `test` und `build` (inkl. `npm audit --audit-level=high`). Der `build`-Job wartet auf `lint` und `test`.

---

## 5. Relevante Spezifikationen & Dokumente
* Technische Spezifikation: `docs/superpowers/specs/2026-09-17-lama-online-design.md`
* Spieler-Dokumentation & Spielregeln: `README.md`

---

## 6. Stolpersteine, Wichtige Erkenntnisse & Lessons Learned

### 6.1 Package Dependencies & Security Audit
* **Wrangler v3 vs. v4:**
  * *Stolperstein:* `wrangler@^3` zog über `@esbuild-plugins/node-modules-polyfill` alte Abhängigkeiten wie `sourcemap-codec@1.4.8` und `rollup-plugin-inject@3.0.2` an (Deprecation-Warnungen), sowie veraltete Versionen von `esbuild`, `miniflare`, `undici` und `ws` mit High/Moderate-Vulnerabilities.
  * *Erkenntnis & Lösung:* Ein Upgrade auf `wrangler@^4.133.0` modernisiert den Bundler-Stack vollständig. 0 Vulnerabilities, 0 Deprecations, volle Kompatibilität mit Durable Objects und Worker Static Assets.
* **Vitest Security (GHSA-82fw-gwwq-j7x9):**
  * *Stolperstein:* Vitest 3.x wies eine Schwachstelle in `@vitest/mocker` auf.
  * *Erkenntnis & Lösung:* Upgrade auf `vitest@^5.0.1` in `shared/package.json` schließt die Lücke vollständig. Alle Test-Suiten bleiben 100% kompatibel.

### 6.2 Cloudflare Workers & Durable Objects Typisierung
* **Generisches `DurableObject<Env>`:**
  * *Stolperstein:* `constructor(ctx: DurableObjectState, env: unknown)` wirft in TypeScript Strict Mode einen TS2345 Fehler (`Argument of type 'unknown' is not assignable to parameter of type 'Env'`).
  * *Best Practice:* Immer das interfacespezifische `Env` importieren und die Klasse als `class GameRoom extends DurableObject<Env>` mit `constructor(ctx: DurableObjectState, env: Env)` deklarieren.

### 6.3 macOS Toolchain & Git Execution
* **Xcode Command Line Tools vs. Xcode.app:**
  * *Stolperstein:* Wenn `xcode-select` auf `/Applications/Xcode.app` zeigt, aber die Lizenz noch nicht akzeptiert wurde (`sudo xcodebuild -license`), bricht `/usr/bin/git` mit einem Lizenzfehler ab.
  * *Lösung:* Ausführung mit `DEVELOPER_DIR=/Library/Developer/CommandLineTools git` greift direkt auf die lizenzfreien Command Line Tools zu.

### 6.4 Build-Reihenfolge im Monorepo
* **Asset-Bindeglied:**
  * `worker/wrangler.jsonc` bindet `../frontend/dist` ein.
  * *Erkenntnis:* Im Root-Build-Script (`package.json`) muss die Reihenfolge zwingend eingehalten werden:
    `npm run build --workspace=shared && npm run build --workspace=frontend && npm run build --workspace=worker`
  * Erst wenn `frontend/dist` existiert, kann Wrangler die Assets validieren und deployen.

### 6.5 Dependabot-Interdependenzen (Vite 8 & @vitejs/plugin-react 6)
* **Breaking Change bei isoliertem Merge:**
  * *Stolperstein:* `@vitejs/plugin-react@6.x` besitzt eine strikte PeerDependency auf `vite@^8.0.0`. Wird der Plugin-React-PR isoliert auf einem Vite-6-Stand gemergt, schlägt der Build mit `ERR_PACKAGE_PATH_NOT_EXPORTED` ('./internal') fehl.
  * *Lösung:* Vite-Major-Updates (PR 1) immer vor oder gemeinsam mit abhängigen Plugins (PR 3) mergen. In Kombination baut Vite 8 mit Rolldown-Integration in Rekordzeit (~260 ms) und ohne Warnungen.

### 6.6 TypeScript 7 Side-Effect Asset Imports (TS2882)
* **Striktere CSS/Asset-Typisierung:**
  * *Stolperstein:* TypeScript 7 verlangt Typdeklarationen für Side-Effect-CSS-Imports (`import './index.css'`). Fehlen diese, bricht `tsc -b` mit `error TS2882: Cannot find module or type declarations for side-effect import of './index.css'` ab.
  * *Best Practice:* In jedem Vite-Projekt zwingend `frontend/src/vite-env.d.ts` mit `/// <reference types="vite/client" />` anlegen, damit TypeScript 7 alle Vite-Asset-Typen standardkonform auflöst.

### 6.7 Linter-Wahl bei TypeScript 7 (Biome statt ESLint)
* **Stolperstein:** `typescript-eslint@8` deklariert eine Peer-Dependency `typescript@>=4.8.4 <6.1.0` und lässt sich unter TypeScript 7 nicht installieren (`ERESOLVE unable to resolve dependency tree`).
* **Erkenntnis & Lösung:** Biome (`@biomejs/biome`) als Single-Tool für Lint + Format + Import-Sortierung einsetzen – es parst TS eigenständig und ist versionsunabhängig. Konfiguration in `biome.json` (Schema 2.x: `assist.actions.source.organizeImports`, keine `recommended`-Flags). `npm run lint` nutzt `biome ci .` (strikter CI-Modus ohne Änderungen).
* **Beim Einführen auf Bestand anwenden:** `biome check --write .` einmalig laufen lassen, danach gezielt nacharbeiten (z. B. `noNonNullAssertion` durch explizite `undefined`-Checks ersetzen, `a11y/noLabelWithoutControl` via `htmlFor`/`id` beheben). Vorsicht bei blinden `replaceAll`-Fixes: Array-Literale wie `['p1']` können versehentlich mit umgeschrieben werden – danach immer `npm test` + `npm run build` verifizieren.

### 6.8 Lockfile-Konflikte & plattformspezifische optionale Dependencies
* **Stolperstein:** Beim Auflösen eines `package-lock.json`-Merge-Konflikts (Dependabot-Rebase) hat ein manuelles `npm install` auf macOS unbemerkt ~123 plattformspezifische optionale Pakete aus dem Lockfile entfernt (`@rollup/rollup-*`, `@esbuild/*`, `lightningcss-*`, `@tailwindcss/oxide-*`, `@img/sharp-*`, `@cloudflare/workerd-*`). Lokal (darwin-arm64) lief alles, aber die GitHub-Action (ubuntu-x64) schlug fehl: `Cannot find module '@rollup/rollup-linux-x64-gnu'` beim Start von Vitest.
* **Lösung:** Fehlende Einträge aus dem letzten intakten Lockfile-Stand (gleiche Parent-Versionen vorausgesetzt) gezielt zurückführen und per `npm ci` verifizieren. Generell nach Lockfile-Konflikten prüfen, ob alle Plattform-Einträge noch vorhanden sind.
* **Leitplanke:** Die CI läuft bewusst auf `ubuntu-latest` mit `npm ci` (exakt nach Lockfile) – sie erkennt fehlende Linux-Bindings sofort. Lockfile nach manuellen `npm install`-Läufen per `git diff --stat package-lock.json` auf unerwartetes Schrumpfen kontrollieren.
* **Nachtrag (verifiziert, 2026-10, wrangler-Bump auf ^4.149.0 für sharp-CVE-Fix):** Nicht jedes Lockfile-Schrumpfen bricht die CI. Beim transitiven `sharp`-Patch regenerierte ein macOS-`npm install` das Lockfile und entfernte u. a. **alle 25 `@rollup/rollup-*`-Plattform-Einträge** (`git diff --stat` zeigte −2753/+1856 Zeilen). Diese Einträge waren jedoch **verwaist**: Kein Paket im aktuellen Baum referenziert sie als (optional)Dependency – unter **Vite 8 mit Rolldown** wird das klassische `@rollup/rollup-*`-Binary nicht mehr gebraucht (anders als zur Zeit des ursprünglichen §6.8-Vorfalls mit Vite 6). Die CI auf ubuntu-x64 (`npm ci` → Build → Vitest → Playwright-E2E) lief vollständig grün. **Vorgehen:** Vor dem manuellen Zurückführen fehlender Plattform-Pakete erst prüfen, ob sie im Baum überhaupt referenziert werden (`optionalDependencies`/`dependencies`), und die CI als Prüfinstanz nutzen – nur echte, referenzierte Bindings zurückführen. Weiterhin kritisch bleiben die wrangler-internen `@esbuild/*`-Pakete; die änderten sich beim Bump legitim (wrangler 4.149 nutzt top-level `esbuild@0.28.2` statt genestetem `0.28.1`), was ebenfalls Zeilen entfernt, aber korrekt ist.

### 6.9 Playwright E2E-Tests (kompletter Spielablauf)
* **Setup:** `@playwright/test` als `frontend`-DevDependency, Config in `frontend/playwright.config.ts`, Specs in `frontend/e2e/`. Getestet wird gegen den produktionsnahen Single-Server-Stack: `wrangler dev --port 8787` (Worker-API + WebSockets + gebautes Frontend aus `frontend/dist`) via Playwright-`webServer` (mit `cwd: worker/`). Voraussetzung lokal: erst `npm run build`, dann `npm run test:e2e`; Browser einmalig via `npx playwright install chromium` (im `frontend/`-Verzeichnis) bereitstellen. CI-Job `e2e` (nach `build`): `npm ci` → `npx playwright install --with-deps chromium` → `npm run build` → `npm run test:e2e`.
* **Teststrategie (`frontend/e2e/round-flow.spec.ts`):** Zwei getrennte Browser-Kontexte (= zwei Spieler mit eigener `sessionId`): Raum erstellen, beitreten, starten, adaptive Züge (spielbare Karte legen, sonst ziehen, sonst aussteigen), danach erzwungenes Aussteigen beider Spieler → Rundenende. Geprüft werden: Lobby-Sync, 6 Handkarten pro Spieler, Abrechnungs-Modal auf beiden Seiten, Punkte-Mathematik aus dem UI gelesen (Summe Gesamtpunkte = Summe Rundenpunkte − Bonus-Chip), optionaler Chip-Rückgabe-Dialog sowie Neustart in Durchgang 2 mit vollen Händen. Exakte Regel-Mathematik bleibt Sache der Vitest-Unit-Tests in `shared/`.
* **Stolpersteine & Patterns für stabile E2E-Tests gegen Echtzeit-State:**
  * *Globale Endzustände zuerst prüfen:* Ist die Abrechnung auf irgendeiner Seite sichtbar, ist die Runde beendet – veraltete Turn-Indikatoren auf der langsameren Seite dürfen dann nie mehr zu einer Aktion führen (`activePageOrNull` prüft Summary vor Indikator).
  * *Nie unbegrenzt auf UI-Elemente klicken:* Klicks auf Buttons, die zwischen Beobachtung und Klick demontiert werden können (State-Update im Flug), mit explizitem Timeout (`tryClick`, 5 s) absichern und bei Timeout neu beobachten (`continue`) statt zu sterben.
  * *Nach jeder Aktion die Weitergabe des Zugs abwarten* (`waitForTurnPassed`: eigener Indikator weg oder Abrechnung da), bevor neu beobachtet wird – sonst agiert der Test auf stale State und klickt auf gerade deaktivierte Buttons (Playwright wartet dann ewig auf Actionability → Test-Timeout statt klarer Fehlermeldung).
  * *Aussagekräftige Timeouts:* Kritische Klicks/Expects mit explizitem Timeout versehen, damit Fehler schnell und lokalisierbar scheitern; zusätzlich kompakte `[e2e]`-Step-Logs mit Zeitstempeln für die CI-Diagnose.
* **Node-Typen in der Playwright-Config:** Das Frontend nutzt eine Browser-tsconfig ohne Node-Typen; `@types/node` wird für `playwright.config.ts` per `/// <reference types="node" />` eingebunden (statt globalem `types`-Feld). Die Config ist in `frontend/tsconfig.json` (`include`) enthalten, damit `tsc -b` sie mitprüft.
* **Nach jedem Spec-Edit `npm run build` laufen lassen:** Playwright transpiliert Specs ohne Typprüfung – fehlende Typ-Imports (z. B. `Locator`) fallen lokal im E2E-Lauf nicht auf, lassen aber den CI-Build (`tsc -b`) rot werden. Verifikations-Reihenfolge vor Push: `npm run lint` → `npm run build` → `npm test` → `npm run test:e2e`.
* **Artefakte fernhalten:** Playwright-Outputs (`test-results/`, `playwright-report/`, `blob-report/`) sind in `.gitignore` und aus `biome.json` (`files.includes`) ausgeschlossen – sonst lässt `biome ci` die CI rot werden.

### 6.13 Barrierefreiheit & UX (Phase 3)
* **Zoom-Sperre entfernt:** `maximum-scale=1.0, user-scalable=no` aus dem Viewport-Meta in `index.html` gestrichen (WCAG-Verstoß, hilft allen Mobilspielern).
* **Reduced Motion zweigleisig:** CSS (`@media (prefers-reduced-motion: reduce)` killt Animation-/Transition-Dauern – bewusst ohne `!important`, Unlayered-CSS schlägt Tailwind-Layer von sich aus; Biome `noImportantStyles` bleibt grün) plus JS-Guard (`matchMedia`-Check vor `canvas-confetti` in `RoundSummaryModal`).
* **Modal-A11y via `useModalDialog`-Hook** (`frontend/src/hooks/useModalDialog.ts`): Initialfokus in den Dialog (`tabIndex={-1}` + `ref.focus()`), Tab-Fokus-Falle, Esc-Schließen nur mit `onClose` (blockierendes `RoundSummaryModal` ohne, schließbares `RulesModal` mit). Dialoge brauchen `role="dialog"`, `aria-modal="true"` und `aria-labelledby` auf die Überschrift.
* **Live-Region in `App.tsx`:** Ein `sr-only`-Div mit `aria-live="polite" role="status"` meldet Zugwechsel („Du bist am Zug!" / „X ist am Zug.") sowie Notifications. E2E-Coverage in `frontend/e2e/accessibility.spec.ts` (Esc-Close, Fokus-Falle via `activeElement.closest('[role=dialog]')`, Live-Region-Text nach Spielstart, Reduced-Motion-Smoke).

### 6.10 Cloudflare Workers Builds im Monorepo (Deploy-Verzeichnis)* **Stolperstein:** Der Cloudflare-Build (`npm run build`) lief fehlerfrei durch, aber `npx wrangler deploy` als Deploy-Command schlug fehl: `The Cloudflare application detection logic has been run in the root of a workspace instead of targeting a specific project.` Ursache: `wrangler.jsonc` liegt in `worker/`, der Deploy lief aber im Repo-Root ohne Config.
* **Lösung (Dashboard-Einstellungen unter Workers Builds):** Root-Verzeichnis = Repo-Root belassen, Build-Command `npm run build`, aber **Deploy-Command auf `npm run deploy --workspace=worker` ändern**. npm setzt dabei cwd auf `worker/`, sodass Wrangler `wrangler.jsonc` sowie die relativen Pfade (`src/index.ts`, `../frontend/dist`) exakt wie lokal auflöst.
* **Verifikation lokal:** `npm run deploy --workspace=worker -- --dry-run` muss Config, Assets (4 Dateien aus `frontend/dist`) und Bindings (`GAME_ROOM`, `ASSETS`) fehlerfrei auflisten.

### 6.11 Backend-Robustheit & Free-Tier-Schutz (Phase 1)
* **Raum-TTL via `storage.setAlarm()`:** Jeder `saveState`-Aufruf plant den Alarm auf `now + ROOM_TTL_MS` (24 h) neu. Der `alarm()`-Handler löscht `game_store`-Zeile + `rate_limits` und schließt Sockets, wenn seit `updated_at` mehr als die TTL vergangen ist – sonst plant er neu. So wachsen keine verwaisten Räume ins Storage-Kontingent. Ablaufdatum-Logik (`isRoomExpired`) liegt als reine Funktion in `shared/src/room-limits.ts` und ist unit-getestet.
* **Rate-Limit pro Spieler:** Token-Bucket (20 Burst, 10/s Refill) in der `rate_limits`-Tabelle – damit hibernationssicher. Bei Überschreitung nur `ERROR` an den Sender, kein State-Change, kein Broadcast. Reine Bucket-Mathematik (`consumeRateLimitToken`) in `shared/`, unit-getestet.
* **Payload-Cap:** Nachrichten > `MAX_MESSAGE_BYTES` (4 KB, alle legalen Züge sind < 200 B) werden vor `JSON.parse` abgewiesen.
* **Reconnect mit Backoff:** `useGameSocket` nutzt exponentiellen Backoff (1s→30s, +Jitter), Reset bei `onopen`, Pause bei `document.hidden` (Reconnect via `visibilitychange`). Gegenseitige `useCallback`-Referenzen (`connect` ↔ `scheduleReconnect`) unbedingt über ein `connectRef` entkoppeln – sonst schlägt Biome mit `noInvalidUseBeforeDeclaration` fehl.
* **Async-Falle im DO:** Sobald `saveState` ein `await` (hier: `setAlarm`) enthält, müssen `saveState`, `loadState` und alle Aufrufer (`fetch`, `webSocketMessage`, `webSocketClose`) auf `async`/`await` umgestellt werden.

### 6.12 Frontend-Performance & PWA (Phase 2)
* **Code-Splitting via `React.lazy`:** `RoundSummaryModal` (zieht `canvas-confetti` mit) und `RulesModal` werden erst bei Bedarf geladen – dafür brauchen die Komponenten einen Default-Export, die Verwendung in `App.tsx` je ein `Suspense fallback={null}`. Ergebnis: Initial-Chunk 273 → 255 KB (gzip 84 → 79 KB), Confetti-Chunk (17 KB) erst zum Rundenende. Kein `manualChunks`-Eingriff nötig, Vite/Rolldown splittet Lazy-Imports automatisch.
* **Memo nur bei stabilen Props:** `Card` nutzt `memo` + `onPlay(card)`-Prop (stabiler Callback aus dem Hook statt Inline-Closure in `PlayerHand`). `Opponent`/`ChipDisplay` bewusst NICHT memoisiert – ihre Objekt-Props (`opponent`, `chips`) bekommen pro `STATE_UPDATE` neue Identitäten, Shallow-Memo wäre wirkungslos. Nebeneffekt: fremde Züge dimmen die eigene Hand (disabled statt wirkungslos klickbar).
* **PWA-Grundausstattung (ohne Offline-SW – Echtzeitspiel!):** `frontend/public/` (wird von Vite nach `dist/` kopiert) mit `manifest.webmanifest` + `icon.svg` (🦙 auf Theme-Hintergrund, `<title>` wegen Biome `a11y/noSvgWithoutTitle`), dazu `theme-color`- und Mobile-Web-App-Metas in `index.html`. E2E-Assert in `frontend/e2e/pwa.spec.ts` (Manifest-JSON + Icon erreichbar).

### 6.14 Party Edition als Raum-Variante (Classic + Party)
* **Variantenmodell:** `GameVariant = 'classic' | 'party'`, fix bei Raum-Erstellung (`POST /api/room/create {variant}`, WS-Query `&variant=` für DO-Init). Kein Lobby-Umschalter – erster Creator gewinnt, alte States migrieren via `migrateGameState` (Default `classic`, `pink: 0`).
* **Kartentypen als String-Union:** `CardValue` = `1..6 | 'L' | '1+'..'6+' | 'PL'`. Plus zählt regeltechnisch als Basiswert (`isPlusCard`/`plusBaseValue`), `PL` ist Joker beim Ablegen (`canPlayCard` → immer `true`) und verhält sich obenauf wie `L`. Solo-Einmaligkeit vergleicht `soloKey` (Plus→Zahl, PL→Lama-Gruppe).
* **Plus-Extra-Zug:** `playCard` schaltet `turnIndex` bei Pluskarten nicht weiter (außer Hand leer → `settleRound`). Frontend braucht dafür keine Sonderlogik – `STATE_UPDATE` mit gleichbleibendem `isTurn` genügt.
* **Chips pink:** `ChipCount {white, black, pink}`, `pointsToChips(p, variant)` greedy (party: 20/10/1), `totalChipScore` inkl. pink. `EXCHANGE_CHIPS {from}` ersetzt parameterloses `exchangeWhiteForBlack` (Kompatibilitäts-Wrapper bleibt): `white` = 10→1, `black` = 2×10→20 (nur party). `DISCARD_CHIP` akzeptiert `pink`.
* **Biome-Falle Radio-Buttons:** `role="radio"` auf `<button>` verletzt `a11y/useSemanticElements` – Variantenwahl als `<fieldset>` + `<label><input type="radio" className="sr-only">` bauen.
* **Tests:** `shared/tests/party.test.ts` (Deck-Zählung, Extra-Zug, Joker, Wertung L+PL=20, pink-Bonus, Tausch, Solo+Plus). Achtung: Zahlen als Zahlen schreiben (`['4+', 4, 4]`, nicht `['4+','4','4']` – sonst String-Concat in `calculateUniquePoints`). E2E `frontend/e2e/party-flow.spec.ts` prüft nur Lobby-Badge/Varianten-Badge + 6 Karten; Regel-Mathematik bleibt in Vitest.

### 6.15 Leave-Semantik & Rundenstarter (Fix)
* **Explizit vs. ungewollt:** `LEAVE_ROOM` (Button) entfernt den Slot hart in jeder Phase (`removePlayerFromGame`), `webSocketClose` (Tab zu/Netz weg) markiert nur `DISCONNECTED` für Reconnect. Reihenfolge im Handler wichtig: erst Name für Notification lesen, dann entfernen.
* **Starter-Prio in `settleRound`:** `finisherPlayerId ?? firstRoundExiterId ?? lastFolderId` – wer leer wurde, beginnt; sonst Erst-Aussteiger.
* **`removePlayerFromGame`-Kanten:** Zugindex nachführen (Entfernter am Zug → Nachrücker), Host-Transfer, Referenzen (`firstRoundExiterId`, `lastRoundFinisherId`, `winners`, `lastRoundSummary`) bereinigen, `pendingChipDiscardPlayerId` des Entfernten auflösen (→ `ROUND_SUMMARY`/`GAME_OVER`), bei `< 2` Spielern zurück nach `LOBBY` (Chips behalten, Hände leer), bei 0 AKTIVEN aber ≥ 2 Slots → `settleRound`. Tests in `shared/tests/leave-and-starter.test.ts`.

### 6.16 Responsive Header trotz wachsender Icon-Leiste (5+ Buttons)
* **Stolperstein:** Nach Ergänzung von Install (`Download`), Push-Glocke (`Bell/BellOff`) und Info (`(i)`/Version) zwischen Online-Indikator und `?` wuchs die rechte Icon-Leiste von 2 auf 5 Buttons (+ Wifi). Auf 320–375px führte `px-4` + `gap-3` + `5×44px` (`min-w-11`) + `Raum: XXXX` + Badges zu horizontalem Overflow/Überlappung statt Wrap.
* **Lösung (mobil-first, skalierbar):**
  * Header: `px-3 sm:px-4`, `gap-2` am Container, links `flex-1 min-w-0` mit `gap-2 sm:gap-3`, rechts `gap-1 sm:gap-3 shrink-0`.
  * Linke Info-Zeile: `flex-wrap gap-1 sm:gap-2`, `whitespace-nowrap` nur beim Raum-Code, Badges (`Durchgang`, `Party`) `shrink-0` – Badges brechen auf Ultra-Schmal in die 2. Zeile statt den Header zu sprengen.
  * Alle Icon-Buttons einheitlich `p-1 sm:p-1.5 min-w-8 min-h-8 sm:min-w-11 sm:min-h-11` (32px mobil vs. 44px ab `sm`, spart ~8px je Button, ~40px bei 5 Buttons) + `shrink-0`. Komponenten `InstallButton` (icon) und `NotificationButton` tragen die gleichen Klassen – Änderung an einer Stelle wirkt überall.
  * **Leitplanke für weitere Buttons:** Bei >5 Icons nicht weiter schrumpfen – stattdessen primäre Aktionen sichtbar lassen und Rest in ein `...`-Overflow-Menü (oder zweite Reihe via `flex-wrap` rechts) verlagern. Header nie `overflow-x-auto` – lieber Höhe wachsen lassen als horizontal scrollen. Vor jedem neuen Header-Button auf 320px testen (`px-3` + 5×32px + Wifi + Badges muss in 320px passen).
* **Verifikation:** `vite build` CSS-Delta nur +1.6 kB, visuell geprüft auf 320/375/640px, `npm run lint`/`build` grün.

### 6.17 PWA Install & Push-Benachrichtigungen (VAPID ohne Offline-Cache)
* **Install-Button:** `beforeinstallprompt` (mit `preventDefault` + `deferredPrompt`), iOS-Fallback »Teilen → Zum Home-Bildschirm«, `isInstalled` via `matchMedia(standalone)` + `navigator.standalone`, verbirgt sich im Standalone-Modus. Varianten: `icon` (Header 32/44px) und `full` (Startseite `w-full` über Regeln). Modal nutzt `useModalDialog` wie `RulesModal`.
* **Minimaler Service Worker (`/sw.js`):** Nur `skipWaiting`/`clients.claim` + `push`/`notificationclick`, kein Offline-Cache (Echtzeitspiel soll frisch bleiben). Registrierung nur im `isSecureContext` nach `load` (`main.tsx`). Manifest/Ikonen bleiben allein als PWA-Grundausstattung installierbar – SW macht es nur zuverlässiger.
* **Benachrichtigungen zweistufig:** Lokal sofort wenn `state.myPlayer.isTurn` von `false→true` und `document.hidden||!hasFocus` (`useTurnNotifications`, `new Notification` mit `tag`), Push wenn Browser geschlossen: `NotificationButton` subscribt `pushManager` mit VAPID-Public-Key (`GET /api/push/vapidPublicKey`), POST an `POST /api/room/:code/push/subscribe` (SQLite `push_subscriptions` im DO), `maybeNotifyNextPlayer` prüft `getWebSockets(nextId).length===0` und sendet via `sendPush` (VAPID-JWT `ECDSA P-256` via WebCrypto, `Authorization: vapid t=JWT,k=pub`, leerer Body für generische `LAMA – Du bist am Zug!`-Notifikation, `404/410` → Subscription löschen via `waitUntil`).
* **VAPID-Keys:** In `worker/wrangler.jsonc` `vars` (`VAPID_PUBLIC_KEY` 65B uncompressed base64url, `VAPID_PRIVATE_KEY` 32B, `VAPID_SUBJECT` `mailto:`). Für Prod via `wrangler secret` ersetzen. `GET /api/push/vapidPublicKey` liefert nur Public Key ans Frontend.

### 6.18 Version als Single Source of Truth (Start + Raum)
* **Anforderung:** Versionsnummer an zwei Stellen (Startseite unten nach Regeln, Raum-Header `(i)`-Modal) identisch aus `package.json` auslesen, Link zu `CHANGELOG.md` auf GitHub im neuen Fenster.
* **Umsetzung:** `tsconfig.base.json` `resolveJsonModule: true`, in `App.tsx` und `VersionInfoModal.tsx` `import pkg from '../package.json'` bzw. `../../package.json` (je nach Tiefe) → `v{pkg.version}` live zur Build-Zeit. Startseite: `mt-5 flex justify-center gap-1.5 text-[11px] text-slate-500` mit `Info`-Icon + `a href="https://github.com/cniweb/LAMA/blob/main/CHANGELOG.md" target="_blank" rel="noopener noreferrer"`. Raum: neuer `(i)`-Button zwischen Wifi und `?` (`Info`, `data-testid="version-info-button"`), öffnet `VersionInfoModal` (lazy, `Info` + `vX.Y.Z` + externer Link mit `ExternalLink`-Icon). So bleibt die Version bei jedem `npm version` Bump automatisch synchron.

### 6.19 Crazy Edition als dritte Raum-Variante (Classic + Party + Crazy)
* **Variantenmodell:** `GameVariant = 'classic' | 'party' | 'crazy'`, fix bei Raum-Erstellung (identischer Weg wie Party §6.14). Worker: `parseVariant` in `worker/src/index.ts` akzeptiert zusätzlich `'crazy'`; WS-Query-Init in `worker/src/game-room.ts` analog (`=== 'party' ? 'party' : === 'crazy' ? 'crazy' : 'classic'`). Keine neue Wire-Message nötig (Gift ist serverseitig automatisch).
* **Deck (65 Karten):** `createDeck('crazy')` = Party-Basis (56, via extrahiertem Helper `createPartyBaseDeck`) + 1× `GL` + 2× `SK` + 4× `D2` + 2× `GF` (`CRAZY_ACTION_COPIES = 2`, `CRAZY_DRAW_TWO_COPIES = 4`). Verifiziert per `shared/tests/crazy.test.ts`.
* **Kartentypen:** `CardValue` erweitert um `'GL'` (goldenes Lama) und `ActionCardValue = 'SK' | 'D2' | 'GF'`. Prädikate `isGoldenLlama`/`isSkipCard`/`isDrawTwoCard`/`isGiftCard`/`isActionCard` in `game-engine.ts`.
* **Legeregeln (`canPlayCard`):** `GL` und `SK`/`D2`/`GF` sind als `candidate` immer legbar; liegt eine davon oben (`topCard`), ist jede Folgekarte erlaubt (Reset/zahllos). Die bestehende PL/L/Zahl-Logik bleibt unberührt – neue Zweige stehen davor.
* **Wertung (`calculateUniquePoints`):** Lama-Gruppe zählt nur die höchste Stufe einmal: `GL`=30 > `PL`=20 > `L`=10 (nicht additiv). `SK`/`D2`/`GF` zählen 0 Punkte. Chips: `pointsToChips` und `exchangeChipsUp` aktivieren den pink-Zweig auch für `crazy` (Werte bis 30 → pinke 20er nötig). Classic bleibt ohne pink.
* **playCard-Effekte (nach gültigem Ablegen, Hand nicht leer; Reihenfolge wichtig):** Hand leer → `settleRound`; Pluskarte → Extra-Zug (turnIndex bleibt); **Gift** → höchste Handkarte (`highestHandCard`, Rang GL>PL>L>6..1, Aktionskarten=0) an aktiven Spieler mit wenigsten Karten (`fewestCardsActivePlayerId`, Gleichstand = nächster in Zugreihenfolge), dann normaler Zugwechsel; **Skip** → 2× `getNextActiveTurnIndex` (bei nur 2 Aktiven landet der Zug wieder beim Ableger – gewollt); **Draw-Two** → im Solo-Endspurt normaler Zugwechsel (verpufft), sonst nächster aktiver zieht best-effort bis zu 2 Karten vom `drawPile` und setzt aus (vom Opfer-Index 1× weiter). Immutability via Spreads; `soloDiscardedValues`/Plus-Zug nicht brechen.
* **Client-View/Sortierung:** `cardSortKey` hat Plätze für `GL`/`SK`/`D2`/`GF` (sonst NaN beim Hand-Sort). `soloKey` gruppiert `GL` mit `PL`/`L` als `'L'`. Anti-Cheat unverändert: Draw-Two/Gift ändern fremde Hände nur serverseitig, Gegner sehen weiter nur `cardCount`.
* **Frontend:** Variantenwahl in `App.tsx` auf 3 Optionen (`grid-cols-3`, `🦙✨ Crazy`), Header- und Lobby-Badge (goldenes Theme) ergänzt. `Card.tsx`: `CARD_STYLES` MUSS alle neuen `CardValue` abdecken (sonst TS2741) – `GL` gold, `SK`/`D2`/`GF` eigene Farben + Center-Label (SKIP/ZIEH 2/GIFT) + `title`-Tooltips. `PlayerHand`-Prop `isParty` → `hasPinkChips` umbenannt (Party **und** Crazy zeigen den 2×10→20-Tausch). `RulesModal` hat `isCrazy`-Zweig; `hasPartyBase = isParty || isCrazy` steuert die geteilten Party-Basis-Texte. `useGameSocket`-Signatur nutzt jetzt `GameVariant` statt des hartkodierten `'classic' | 'party'`.
* **Tests:** `shared/tests/crazy.test.ts` (Deck, Prädikate, Legeregeln inkl. Regression, Wertung, Chips, Skip/Draw-Two/Gift inkl. Solo-/Best-Effort-/Gleichstand-Kanten, Client-View + kein Hand-Leak). E2E `frontend/e2e/crazy-flow.spec.ts` prüft nur Lobby-/Varianten-Badge + 6 Karten; Regel-Mathematik bleibt in Vitest.

### 6.20 Rundenende sperrt Weiterspielen (Bonus-Chip-Dialog)
* **Stolperstein:** Legt ein Spieler die letzte Karte ab, ruft `playCard` sofort `settleRound(..., finisherPlayerId)` – korrekt. Hat der Finisher aber noch Chips, öffnet `settleRound` den Bonus-Chip-Dialog und lässt die `phase` **bewusst auf `IN_ROUND`** (mit gesetztem `pendingChipDiscardPlayerId`). Die Zug-Handler `playCard`/`drawCard`/`foldPlayer` prüften nur `phase !== 'IN_ROUND'` – nicht den offenen Bonus-Dialog. Dadurch konnte ein anderer Spieler (laut `turnIndex`) im Zwischenzustand weiterspielen (fälschliches „Solo"-Weiterspielen, obwohl die Runde für alle beendet sein muss).
* **Lösung:** In allen drei Zug-Handlern direkt nach dem `phase`-Check ein Guard `if (state.pendingChipDiscardPlayerId !== null) throw` (Meldung „Die Runde ist beendet …") – **vor** dem turnIndex-Check, damit die Rundenende-Meldung Vorrang hat. Zusätzlich in `filterStateForClient` während des Bonus-Dialogs niemand „am Zug" (`isMyTurn=false`, keine `validPlays`/`canDraw`/`canFold`), damit die UI konsistent zum Server ist. Gilt variantenübergreifend. Tests: `shared/tests/round-end.test.ts`.
* **Testfalle (RED aus dem richtigen Grund):** Ein naiver Test „anderer Spieler ruft playCard → wirft" ist **falsch grün**, weil er ohnehin an „Du bist nicht an der Reihe" scheitert (turnIndex zeigt noch auf den Finisher). Der Test muss gezielt die **Rundenende-Fehlermeldung** matchen (`/Runde ist beendet/`) und auch den Spieler am `turnIndex` prüfen – sonst verifiziert er den Guard nicht.

### 6.21 Mini-Karten in der Rundenabrechnung (kein Overflow)
* **Stolperstein:** `RoundSummaryModal` zwang die Restkarten per `!important`-Overrides auf `size='sm'` in eine ~40px-Minibox (`!w-7 !h-10 !text-xs !p-0.5`). Sonderkarten (L/PL/GL + Aktionskarten SK/D2/GF) rendern aber ein großes Emoji (`text-2xl sm:text-4xl`) **plus** ein Textlabel darunter (LAMA/GOLD/PINK/SKIP…). Ohne `overflow`-Clipping quoll dieser für große Karten gedachte Inhalt über die Box und ragte über den Spieler-Kasten hinaus.
* **Lösung:** Echte Kartengröße `xxs` in `Card.tsx` statt `!important`-Hacks, `overflow-hidden` auf der Karten-Wurzel als Clipping-Sicherheitsnetz, und ein Kompaktmodus (`isCompact = size === 'xxs'`), der Eck-Marker und Sonderkarten-Textlabel ausblendet und das Emoji verkleinert. `RoundSummaryModal` nutzt `size='xxs'`.
* **Leitplanke:** Keine Kartengröße über `!important`-Breiten/Höhen „faken" – stattdessen eine echte `size`-Stufe definieren, deren Center-/Label-Rendering zur Boxgröße passt. Neue Sonderkarten müssen in `CARD_STYLES` (sonst TS2741) UND im Kompaktmodus gedacht werden.
* **Visuelle Verifikation:** UI-Fixes mit einem Playwright-Screenshot gegen den gebauten Stack prüfen (temporären Spec in `e2e/` ablegen, per `-g` ausführen, Screenshot via `read_file` ansehen, danach Spec + PNG wieder löschen – nicht committen). Die Crazy-Variante eignet sich am besten (höchste Sonderkartendichte in der Resthand).

### 6.22 Terminal-Fallstrick: mehrzeilige git/gh-Texte
* **Stolperstein:** `git commit -m "zeile1\nzeile2"` mit echten Zeilenumbrüchen bzw. `gh pr create --body "…langer mehrzeiliger Text…"` wurden in dieser Umgebung abgeschnitten (Tool-Exit -1, Commit/PR kam nicht zustande), obwohl die Syntax gültig ist.
* **Lösung:** Commit-Message einzeilig halten (ein `-m`), ausführlichen Kontext in die **PR-Beschreibung** legen – und diese über `gh pr create --body-file <datei>` statt `--body "…"` übergeben (temporäre Markdown-Datei schreiben, danach löschen). Nach `-1`-Abbrüchen immer den tatsächlichen Zustand prüfen (`git log -1`, `gh pr list --head <branch>`), nicht blind erneut committen/pushen.

### 6.23 Konstante Höhe der Spieler-Steuerzeile (PlayerHand)
* **Stolperstein:** Die Steuerzeile unter der Hand (Chips + Aktionen) war mal ein-, mal zweizeilig. Ursachen: `flex-col` stapelte auf Mobile Chips- und Aktionsblock untereinander; die Kinder hatten uneinheitliche Höhen (Buttons `min-h-[44px]` vs. kleine Status-Texte); beim Erscheinen der Tausch-Buttons (`10→1`, `2×10→20`) wuchs die Zeile und sprang.
* **Lösung:** Container mit **fester** Höhe `h-[60px]` (nicht nur `min-h`, sonst treibt der Inhalt die Höhe über die Vorgabe – gemessen: Buttons `h-11`=44px + `py-2`=16px = 60px), immer `flex-row` + `items-center justify-between`. Alle interaktiven Elemente und Status-Texte teilen `h-11` und sind vertikal zentriert. Statt vertikalem Umbruch `overflow-x-auto overflow-y-hidden` + `whitespace-nowrap`: bei Extrembreiten horizontaler Scroll statt Höhenänderung/Clipping. `data-testid="controls-bar"` zum Messen ergänzt.
* **Verifikationsmethode (wiederverwendbar für Höhen-/Overflow-Bugs):** Temporärer Playwright-Spec, der die `boundingBox().height` des Elements über mehrere Viewports (390px/1280px) und Zustände (am Zug / wartend / mit injizierten Zusatz-Buttons) vergleicht und `scrollHeight <= clientHeight` prüft (kein vertikaler Überlauf). Ergebnis muss in allen Fällen identisch sein (hier: konstant 60). Spec + Screenshots danach löschen, nicht committen.
* **Leitplanke (Responsive, siehe §3.4):** `min-h` fixiert eine Mindest-, keine Maximalhöhe – für „springt nicht" braucht es eine feste Höhe ODER eine `min-h`, die ≥ der maximal möglichen Inhaltshöhe liegt. Immer den Zustand mit den MEISTEN sichtbaren Elementen gegen den mit den WENIGSTEN messen.

### 6.24 Chip-Tausch-Buttons auf Mobile klickbar (Folgefix zu §6.23)
* **Stolperstein:** Der Konstante-Höhe-Fix (§6.23) legte `overflow-x-auto` auf den **äußeren** `controls-bar`-Container und zog den rechten Status-Block per `justify-between` + `shrink-0` an den Rand. Der linke Block (Chips + Tausch-Buttons) hatte nur `min-w-0` ohne eigenen Scroll-Kontext. Auf schmalen Mobilbreiten (360–390px) wurde der linke Block komprimiert, seine `shrink-0`-Tausch-Buttons (`10→1`, `2×10→20`) überlappten mit dem Status-Block und waren nicht mehr klickbar (am Rundenende der häufigste Chip-Tausch-Moment).
* **Lösung:** Horizontalen Scroll vom äußeren Container auf den **linken Block** verlagern: `flex-1 min-w-0 overflow-x-auto overflow-y-hidden`. Dadurch belegen linker (scrollbarer) Chip-/Tausch-Block und rechter `shrink-0`-Status-Block disjunkte Bereiche – die Buttons bleiben in ihrem eigenen Scroll-Bereich voll klickbar. Feste Höhe `h-[60px]` aus §6.23 bleibt unverändert erhalten.
* **Leitplanke:** Bei `justify-between` + einem `shrink-0`-Nachbarn darf der konkurrierende Block nicht nur `min-w-0` haben – er braucht `flex-1` **und** seinen eigenen `overflow-x-auto`, sonst werden seine `shrink-0`-Kinder unter den Nachbarn geschoben. Overflow gehört auf den Block, der tatsächlich überläuft, nicht auf den gemeinsamen Eltern-Container. Interaktive Elemente, die je nach Zustand erscheinen (Tausch-Buttons), immer im Zustand mit den MEISTEN sichtbaren Nachbarn auf 360px auf Klickbarkeit (nicht nur Sichtbarkeit) prüfen.
