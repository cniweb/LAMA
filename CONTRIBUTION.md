# Contributing to LAMA Online

Willkommen im Team! Diese Datei dient als Leitfaden für neue Entwickler, um schnell produktiv zu werden und die Qualitätsstandards des Projekts einzuhalten.

## 🚀 Quick Start

### 1. Voraussetzungen
Stelle sicher, dass du folgende Tools installiert hast:
- **Node.js** (LTS empfohlen)
- **npm**
- **Cloudflare Wrangler** (`npm install -g wrangler`)
- **Playwright Browser** (`npx playwright install chromium`)

### 2. Installation & Setup
```bash
# Repository klonen
git clone <repo-url>
cd LAMA

# Alle Abhängigkeiten installieren
npm install
```

### 3. Lokaler Start
Die Build-Reihenfolge ist im Monorepo kritisch, da der Worker die Assets des Frontends benötigt:

```bash
# 1. Alles einmal bauen
npm run build

# 2. Frontend Dev-Server starten (Terminal 1)
npm run dev:frontend

# 3. Worker Dev-Server starten (Terminal 2)
npm run dev:worker
```

---

## 🛠 Entwicklungs-Richtlinien

### 1. Architektur-Prinzipien
- **Shared First**: Alle Geschäftsregeln, Typen und Validierungen gehören in `shared/`. Weder das Frontend noch der Worker sollten eigene Kopien der Spiellogik implementieren.
- **Durable Objects**: State-Änderungen im Backend erfolgen ausschließlich innerhalb der Durable Objects. Nutze `this.ctx.storage.sql` für die Persistenz.
- **Type Safety**: Wir nutzen TypeScript im Strict Mode. Vermeide `any` um jeden Preis.

### 2. Workflow für neue Features/Bugfixes
1. **Branch**: Erstelle einen Feature-Branch (`feat/...`) oder Fix-Branch (`fix/...`).
2. **Tests**: 
   - Bei Änderungen an der Engine: Schreibe erst einen failing Test in `shared/tests/`.
   - Bei UI-Änderungen: Erstelle eine entsprechende E2E-Spec in `frontend/e2e/`.
3. **Implementierung**: Setze die Logik um und bringe die Tests auf "Grün".
4. **Qualitäts-Check**:
   - `npm run lint` (Biome)
   - `npm run build` (Gesamtprojekt)
   - `npm test` (Alle Unit-Tests)
5. **PR**: Erstelle einen Pull Request gegen `main`.

### 3. Coding Standards
- **Linting**: Wir nutzen **Biome** für Linting und Formatting. Führe `npm run lint:fix` aus, bevor du commitest.
- **Commits**: Nutze Conventional Commits (z.B. `feat: add party edition`, `fix: resolve starter priority`).
- **Dateigröße**: Halte Module klein. Wenn eine Datei 250 Zeilen Logik überschreitet, prüfe, ob eine Aufteilung in kleinere Helfer sinnvoll ist.

---

## 🧪 Test-Strategie

| Ebene | Tool | Fokus | Ort |
| :--- | :--- | :--- | :--- |
| **Unit** | Vitest | Spielregeln, Mathematische Korrektheit, Engine-Edge-Cases | `shared/tests/` |
| **E2E** | Playwright | User-Flows, WebSocket-Sync, Responsiveness, A11y | `frontend/e2e/` |
| **Lint** | Biome | Syntax, Style, Type-Safety | Projektweit |

---

## 📖 Weitere Ressourcen
- **Technische Spezifikation**: `docs/superpowers/specs/2026-09-17-lama-online-design.md`
- **Tech Stack**: `docs/tech-stack.md`
- **Spielregeln**: `README.md`
- **Agent-Guidelines**: `AGENTS.md` (Besonders wichtig, wenn du mit KI-Agenten zusammenarbeitest)

Viel Erfolg beim Coden! 🦙
