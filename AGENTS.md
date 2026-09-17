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
* `npm run lint`: Prüft Code-Qualität und Formatierung.
* `npm run dev:frontend`: Startet den Vite-Dev-Server mit lokalem Worker-Proxy.
* `npm run dev:worker`: Startet Wrangler im lokalen Modus (`wrangler dev`).

---

## 5. Relevante Spezifikationen & Dokumente
* Spielregeln (Original-PDF): `01907-DE-AmigoRule.pdf`
* Technische Spezifikation: `docs/superpowers/specs/2026-09-17-lama-online-design.md`
* Spieler-Dokumentation: `README.md`
