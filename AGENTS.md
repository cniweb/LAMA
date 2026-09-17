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

### 6.10 Cloudflare Workers Builds im Monorepo (Deploy-Verzeichnis)
* **Stolperstein:** Der Cloudflare-Build (`npm run build`) lief fehlerfrei durch, aber `npx wrangler deploy` als Deploy-Command schlug fehl: `The Cloudflare application detection logic has been run in the root of a workspace instead of targeting a specific project.` Ursache: `wrangler.jsonc` liegt in `worker/`, der Deploy lief aber im Repo-Root ohne Config.
* **Lösung (Dashboard-Einstellungen unter Workers Builds):** Root-Verzeichnis = Repo-Root belassen, Build-Command `npm run build`, aber **Deploy-Command auf `npm run deploy --workspace=worker` ändern**. npm setzt dabei cwd auf `worker/`, sodass Wrangler `wrangler.jsonc` sowie die relativen Pfade (`src/index.ts`, `../frontend/dist`) exakt wie lokal auflöst.
* **Verifikation lokal:** `npm run deploy --workspace=worker -- --dry-run` muss Config, Assets (4 Dateien aus `frontend/dist`) und Bindings (`GAME_ROOM`, `ASSETS`) fehlerfrei auflisten.

### 6.11 Backend-Robustheit & Free-Tier-Schutz (Phase 1)
* **Raum-TTL via `storage.setAlarm()`:** Jeder `saveState`-Aufruf plant den Alarm auf `now + ROOM_TTL_MS` (24 h) neu. Der `alarm()`-Handler löscht `game_store`-Zeile + `rate_limits` und schließt Sockets, wenn seit `updated_at` mehr als die TTL vergangen ist – sonst plant er neu. So wachsen keine verwaisten Räume ins Storage-Kontingent. Ablaufdatum-Logik (`isRoomExpired`) liegt als reine Funktion in `shared/src/room-limits.ts` und ist unit-getestet.
* **Rate-Limit pro Spieler:** Token-Bucket (20 Burst, 10/s Refill) in der `rate_limits`-Tabelle – damit hibernationssicher. Bei Überschreitung nur `ERROR` an den Sender, kein State-Change, kein Broadcast. Reine Bucket-Mathematik (`consumeRateLimitToken`) in `shared/`, unit-getestet.
* **Payload-Cap:** Nachrichten > `MAX_MESSAGE_BYTES` (4 KB, alle legalen Züge sind < 200 B) werden vor `JSON.parse` abgewiesen.
* **Reconnect mit Backoff:** `useGameSocket` nutzt exponentiellen Backoff (1s→30s, +Jitter), Reset bei `onopen`, Pause bei `document.hidden` (Reconnect via `visibilitychange`). Gegenseitige `useCallback`-Referenzen (`connect` ↔ `scheduleReconnect`) unbedingt über ein `connectRef` entkoppeln – sonst schlägt Biome mit `noInvalidUseBeforeDeclaration` fehl.
* **Async-Falle im DO:** Sobald `saveState` ein `await` (hier: `setAlarm`) enthält, müssen `saveState`, `loadState` und alle Aufrufer (`fetch`, `webSocketMessage`, `webSocketClose`) auf `async`/`await` umgestellt werden.
