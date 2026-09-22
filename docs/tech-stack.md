# Technischer Stack & Infrastruktur

Diese Dokumentation beschreibt die Architektur, den Technologie-Stack und den Deployment-Prozess von LAMA Online, um neuen Entwicklern den Einstieg und die lokale Einrichtung zu erleichtern.

## 1. Architektur-Überblick

LAMA ist als Monorepo konzipiert, bestehend aus drei Kern-Komponenten, die eng über TypeScript-Typen verzahnt sind.

### Architektur-Diagramm (Konzeptuell)
`Frontend (React)` $\rightarrow$ `Cloudflare Worker (Gateway)` $\rightarrow$ `Durable Object (Game Room)` $\rightarrow$ `SQLite Storage`

### Komponenten
- **`shared/`**: Die „Single Source of Truth“. Enthält die gesamte Spiellogik (Engine), Validierungen, Typdefinitionen für WebSockets und die Spielregeln. Wird sowohl vom Worker als auch vom Frontend importiert.
- **`worker/`**: Ein Cloudflare Worker, der als API-Gateway fungiert und die Kommunikation zwischen Clients und den Spielräumen steuert.
- **`frontend/`**: Eine moderne Single Page Application (SPA), die den Spielzustand in Echtzeit visualisiert.

---

## 2. Technologie-Stack

### Frontend
- **Framework**: React 19 + Vite
- **Styling**: Tailwind CSS
- **State/API**: WebSocket-basierte Echtzeitkommunikation (über `useGameSocket` Hook)
- **PWA**: `manifest.webmanifest` + `icon.svg` + minimaler Service Worker (`frontend/public/sw.js` mit `skipWaiting`/`clients.claim`, `push` + `notificationclick`, kein Offline-Cache) — Registrierung nur im `isSecureContext` (`frontend/src/main.tsx`). `InstallButton` (Icon im Header `p-1 sm:p-1.5 min-w-8 sm:min-w-11` + Full-Variante über Regeln auf der Startseite) nutzt `beforeinstallprompt` + iOS-Fallback, `NotificationButton` (Glocke) + Hooks `useTurnNotifications` (lokal `new Notification` bei `hidden||!hasFocus`) und `usePushSubscription` (VAPID `GET /api/push/vapidPublicKey`, `pushManager.subscribe`). `VersionInfoModal` + Startseiten-Footer lesen Version live aus `frontend/package.json` (`resolveJsonModule`), `RulesModal` zeigt variantenabhängig Klassik vs. Party (Badge, Utensilien, Joker/Extra-Zug, Wertung).

### Backend (Cloudflare Ecosystem)
- **Runtime**: Cloudflare Workers (V8-Isolate, `compatibility_flags: ["nodejs_compat"]`)
- **State Management**: **Durable Objects (DO)**. Jeder Spielraum ist ein eigenes DO-Instanz, das den Zustand konsistent hält.
- **Persistence**: **SQLite-backed Storage** innerhalb der Durable Objects. Tabellen: `game_store`, `rate_limits` (Token-Bucket) und `push_subscriptions` + `pending_push` für Web Push. Der Spielzustand wird atomar nach jeder Zustandsänderung persistiert.
- **Communication**: **WebSocket Hibernation API**. Erlaubt es dem DO, bei Inaktivität zu hibernieren (0 GB-s Compute) und bei eingehenden Frames automatisch aufzuwachen.
- **Push-Benachrichtigungen**: VAPID (`VAPID_PUBLIC_KEY` 65B base64url, `VAPID_PRIVATE_KEY` 32B, `VAPID_SUBJECT` `mailto:` in `worker/wrangler.jsonc`/`secret`) → `GET /api/push/vapidPublicKey` + `POST /api/room/:code/push/subscribe|unsubscribe|pending` → `worker/src/push.ts` (VAPID-JWT `ECDSA P-256` via WebCrypto, `Authorization: vapid`, `pending_push` Fallback für unverschlüsselte `push`-Events, `maybeNotifyNextPlayer` via `ctx.waitUntil` + `404/410`-Cleanup). Punkte-Reset bei Verlassen/Neubeitritt via `resetGameForNewMatch` nach `removePlayerFromGame`/`addPlayerToRoom`.

### Tooling & Qualitätssicherung
- **Sprache**: TypeScript (Strict Mode)
- **Linting & Formatting**: Biome (Ersatz für ESLint/Prettier)
- **Testing**: Vitest (Unit-Tests für Engine), Playwright (E2E-Tests)
- **CI/CD**: GitHub Actions $\rightarrow$ Cloudflare Workers GitHub App (Automatischer Deploy bei Push auf `main`)

---

## 3. Cloudflare Konfiguration für Entwickler

Um das Projekt lokal oder in der Cloud zu betreiben, sind folgende Einstellungen in Cloudflare erforderlich:

### Durable Object Bindings
In der `wrangler.jsonc` (oder im Cloudflare Dashboard) muss ein Binding für die Spielräume definiert sein:
- **Binding Name**: `GAME_ROOM`
- **Class Name**: `GameRoom`

### Static Assets
Das Frontend wird in `frontend/dist` gebaut. Der Worker ist so konfiguriert, dass er diese Assets als statische Dateien ausliefert (via `assets` Binding in `wrangler.jsonc`).

### Lokale Entwicklung
1. **Frontend starten**: `npm run dev:frontend` (startet Vite).
2. **Worker starten**: `npm run dev:worker` (startet `wrangler dev` mit lokaler DO-Simulation).
3. **Build-Reihenfolge**: Da der Worker die Assets des Frontends benötigt, ist die Reihenfolge zwingend:
   `shared` $\rightarrow$ `frontend` $\rightarrow$ `worker`.

---

## 4. Deployment-Prozess

Das Deployment erfolgt über die Cloudflare GitHub App:

1. **Build**: `npm run build` im Root (baut alle Workspaces sequenziell).
2. **Push**: Code wird auf den `main` Branch gepusht.
3. **GitHub Action**: Die CI prüft Linting, Tests und Build.
4. **Deployment**: Bei Erfolg deployt Cloudflare den Worker automatisch.

**Wichtiger Hinweis zum Deploy-Kommando**:
Im Cloudflare Dashboard muss der Deploy-Command auf `npm run deploy --workspace=worker` gesetzt sein, damit das Working Directory korrekt auf den `worker/`-Ordner gesetzt wird und `wrangler.jsonc` gefunden wird.
