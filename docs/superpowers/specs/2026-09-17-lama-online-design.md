# Spezifikation: LAMA Online Kartenspiel (Cloudflare Workers + React)

## 1. Übersicht & Ziel
Entwicklung einer modernen, webbasierten Multiplayer-Version des Kartenspiels **LAMA (Leg alle Minuspunkte ab!)** von Reiner Knizia (AMIGO).
* **Fokus:** Freunde-Lobby (2–6 Spieler) über private Raum-Codes oder Direktlinks.
* **Infrastruktur:** Cloudflare Workers Free Tier mit **Durable Objects (SQLite-backed)** und **WebSocket Hibernation API**.
* **Deployment:** Automatisches Git-basiertes Deployment über die Cloudflare GitHub Integration.

---

## 2. Offizielle Spielregeln (LAMA Engine)

### 2.1 Spielmaterial & Vorbereitung
* **56 Spielkarten:**
  * Je 8x die Werte 1 bis 6
  * 8x Lamas (Kartenwert `'L'` bzw. 10 Minuspunkte)
* **70 Chips:**
  * 50 weiße 1er-Chips (je 1 Minuspunkt)
  * 20 schwarze 10er-Chips (je 10 Minuspunkte)
  * Beliebiger 10:1-Tausch zwischen Spielern und Vorrat jederzeit zulässig.
* **Vorbereitung pro Durchgang:**
  * Alle Karten werden gemischt.
  * Jeder Spieler erhält verdeckt 6 Handkarten.
  * Der Rest bildet den verdeckten Nachziehstapel.
  * Die oberste Karte wird offen daneben gelegt und bildet den Ablagestapel.

### 2.2 Zugoptionen (im Uhrzeigersinn)
Wer am Zug ist, wählt genau eine der drei Aktionen:
1. **Karte ablegen:**
   * Eine Karte mit demselben Wert oder einem um genau 1 höheren Wert.
   * Auf eine 6 darf eine 6 oder ein Lama gelegt werden.
   * Auf ein Lama darf ein weiteres Lama oder eine 1 gelegt werden.
2. **Karte nachziehen:**
   * 1 Karte vom Nachziehstapel ziehen. Der Zug endet sofort (in diesem Zug darf keine Karte gelegt werden).
   * **Wichtig:** Ist der Nachziehstapel leer, entfällt diese Option.
3. **Aussteigen (Passen):**
   * Der Spieler steigt für den laufenden Durchgang aus.
   * Seine verbleibenden Handkarten werden für den Rest des Durchgangs verdeckt abgelegt.

### 2.3 Sonderregel: Solo-Endspurt
* Wenn alle anderen Mitspieler ausgestiegen sind, spielt der letzte verbliebene Spieler alleine weiter.
* **Einschränkung:** Er darf **nicht mehr nachziehen**. Er kann nur noch passende Karten ablegen, solange er kann und möchte. Sobald er nicht mehr legen kann oder freiwillig aufhört, endet der Durchgang.

### 2.4 Rundenende & Abrechnung
* Ein Durchgang endet sofort, wenn:
  * Ein Spieler seine letzte Handkarte abgelegt hat, ODER
  * Alle Spieler ausgestiegen sind.
* **Punkteberechnung (Einmaligkeitsprinzip):**
  * Für verbliebene Karten (auf der Hand oder verdeckt abgelegt) gibt es Minuspunkte.
  * Jeder Kartenwert zählt nur **einmalig**:
    * Z. B. drei 4er = 4 Minuspunkte.
    * Mehrere Lamas = 10 Minuspunkte.
    * Beispiel: Eine 1, zwei 3er, ein Lama = $1 + 3 + 10 = 14$ Minuspunkte.
* **Chip-Vergabe:**
  * Spieler nehmen sich entsprechende Minuspunkte in Chips (optimiert mit 10ern und 1ern).
* **Bonus für vollständiges Ablegen:**
  * Wer alle Handkarten losgeworden ist, darf **einen beliebigen Chip (1er oder 10er)** zurück in den Vorrat geben.
* **Nächster Durchgang:**
  * Wer den vorherigen Durchgang beendet hat (auch durch Aussteigen), beginnt den nächsten.

### 2.5 Spielende
* Sobald nach einer Durchgangsabrechnung mindestens ein Spieler **40 oder mehr Minuspunkte** gesammelt hat, endet das Spiel.
* Es gewinnt, wer die **wenigsten Minuspunkte** hat. Bei Gleichstand gibt es mehrere Sieger.

---

## 3. Systemarchitektur & Monorepo

```
LAMA/
├── docs/superpowers/specs/      # Spezifikationen & Architektur
├── package.json                 # Monorepo Workspaces & Root-Befehle
├── tsconfig.base.json           # Shared TypeScript Config
├── shared/                      # Plattformunabhängige Game Engine & Typen
│   ├── src/
│   │   ├── types.ts             # Kartentypen, Spielzustand, Events
│   │   ├── deck.ts              # 56 Karten, Mischen, Deal
│   │   ├── game-engine.ts       # Pure State Machine (Turns, Scoring, Validation)
│   │   └── index.ts
│   └── tests/
│       ├── game-engine.test.ts  # Testabdeckung aller Regeln & Sonderfälle
│       └── scoring.test.ts
├── worker/                      # Cloudflare Worker Backend
│   ├── src/
│   │   ├── index.ts             # HTTP Router, Assets-Proxy & WS-Upgrade
│   │   └── game-room.ts         # Durable Object (SQLite Storage + Hibernation)
│   ├── wrangler.jsonc           # Cloudflare Worker & DO Konfiguration
│   └── tsconfig.json
└── frontend/                    # React 19 + Vite Frontend
    ├── src/
    │   ├── components/
    │   │   ├── Card.tsx         # Karten 1-6 & Lama mit Icons
    │   │   ├── DiscardPile.tsx  # Ablage- & Nachziehstapel
    │   │   ├── PlayerHand.tsx   # Eigene Handkarten (klickbar & hervorgehoben)
    │   │   ├── Opponent.tsx     # Gegenspieler-Karten & Status
    │   │   ├── ChipDisplay.tsx  # Visualisierung von 1er- und 10er-Chips
    │   │   ├── LobbyView.tsx    # Warteraum & Raum-Link
    │   │   └── RoundSummaryModal.tsx # Abrechnung & Chip-Abgabe-Dialog
    │   ├── hooks/
    │   │   └── useGameSocket.ts # WebSocket Lifecycle, Auto-Reconnect & State
    │   ├── App.tsx
    │   ├── main.tsx
    │   └── index.css            # Tailwind CSS
    └── vite.config.ts
```

---

## 4. Cloudflare Free-Tier & Durable Objects

### 4.1 SQLite-backed Durable Object
* Jedes Spielzimmer ist ein Durable Object mit persistentem SQLite-Speicher (`this.ctx.storage.sql`).
* Tabellen:
  * `room_meta` (room_code, host_id, created_at, phase)
  * `game_state` (autoritativer JSON-Snapshot der State Machine)
  * `players` (session_id, name, chips_white, chips_black, status)

### 4.2 WebSocket Hibernation API
* Verbindungen werden mit `this.ctx.acceptWebSocket(serverWs)` registriert.
* Während Denkpausen der Spieler wechselt das Durable Object in den Ruhezustand (0 GB-s Compute).
* Eingehende WebSocket-Nachrichten oder Ping-Frames wecken das DO automatisch auf.

### 4.3 Anti-Cheat & Datenmaskierung
* Das Backend sendet jedem Client eine gefilterte `ClientRoomView`:
  * Handkarten anderer Spieler werden durch deren Anzahl (`cardCount`) ersetzt.
  * Verdeckt abgelegte Karten ausgestiegener Spieler sind für andere unsichtbar.
  * Der Nachziehstapel wird verdeckt gehalten (nur Restkartenanzahl sichtbar).

---

## 5. WebSocket Protokoll (JSON RPC)

### 5.1 Client $\rightarrow$ Server (`ClientMessage`)
```typescript
export type ClientMessage =
  | { type: 'JOIN_ROOM'; roomCode: string; playerName: string; sessionId: string }
  | { type: 'START_GAME' }
  | { type: 'PLAY_CARD'; card: CardValue }
  | { type: 'DRAW_CARD' }
  | { type: 'FOLD' }
  | { type: 'DISCARD_CHIP'; chipType: 'white' | 'black' }
  | { type: 'NEXT_ROUND' };
```

### 5.2 Server $\rightarrow$ Client (`ServerMessage`)
```typescript
export type ServerMessage =
  | { type: 'STATE_UPDATE'; state: ClientRoomView }
  | { type: 'ERROR'; message: string }
  | { type: 'NOTIFICATION'; text: string; tone: 'info' | 'success' | 'alert' };
```

---

## 6. Cloudflare Git-Integration (CI/CD)
* Repository ist via Cloudflare GitHub App angebunden.
* Build-Kommando: `npm run build`
* Build-Artefakte:
  * Frontend: `frontend/dist`
  * Worker: kompiliert durch Wrangler mit Assets-Binding `assets: { directory: "../frontend/dist" }`.
* Vollautomatisches Deployment auf `workers.dev` oder Custom Domain.
