# Round-End / Solo / Chips / Leave Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 5 LAMA-Regel-/UX-Fixes umsetzen: manueller Chip-Tausch, Solo 1x-pro-Wert, Starter=erster Exiter, Neues-Spiel/Verlassen-Buttons, beforeunload + LEAVE_ROOM-Split.

**Architecture:** Pure Logik in `shared/src/game-engine.ts` (test-first, Vitest), Worker als dünner Handler, Frontend-Buttons + `beforeunload`. Keine Protokoll-Brüche für alte Clients außer 3 neue Nachrichtentypen.

**Tech Stack:** TypeScript strict, Vitest, Cloudflare Durable Objects (SQLite + Hibernation), React 19 + Vite, Biome, Playwright.

## Global Constraints

- TypeScript Strict Mode, keine `any`-Casts ohne Begründung.
- `shared/src/types.ts` ist Single Source of Truth.
- Jede Regeländerung in `shared/` braucht Vitest-Coverage in `shared/tests/`.
- Anti-Cheat: nie fremde Hände senden (`filterStateForClient`).
- Verifikations-Reihenfolge: `npm run lint` → `npm run build` → `npm test` → `npm run test:e2e`.
- Biome `ci` muss grün bleiben; `frontend/dist` vor Worker-Build bauen.

---

### Task 1: Shared Types erweitern

**Files:**
- Modify: `shared/src/types.ts`

**Interfaces:**
- Consumes: bestehende `GameState`, `ClientMessage`.
- Produces: `soloDiscardedValues: CardValue[] | null`, `firstRoundExiterId: string | null`, `EXCHANGE_CHIPS | NEW_GAME | LEAVE_ROOM` für Worker + Frontend.

- [ ] **Step 1: Types ergänzen**

```typescript
export interface GameState {
  // ... bestehend ...
  soloDiscardedValues: CardValue[] | null;
  firstRoundExiterId: string | null;
}

export type ClientMessage =
  | { type: 'JOIN_ROOM'; roomCode: string; playerName: string; sessionId: string }
  | { type: 'START_GAME' }
  | { type: 'PLAY_CARD'; card: CardValue }
  | { type: 'DRAW_CARD' }
  | { type: 'FOLD' }
  | { type: 'DISCARD_CHIP'; chipType: 'white' | 'black' }
  | { type: 'NEXT_ROUND' }
  | { type: 'EXCHANGE_CHIPS' }
  | { type: 'NEW_GAME' }
  | { type: 'LEAVE_ROOM' };
```

- [ ] **Step 2: Build prüfen**

Run: `npm run build --workspace=shared`
Expected: PASS

---

### Task 2: Engine — Chip-Tausch + Reset + Solo + Erster-Exiter

**Files:**
- Modify: `shared/src/game-engine.ts`
- Test: `shared/tests/scoring.test.ts`, `shared/tests/game-engine.test.ts`

**Interfaces:**
- Consumes: `GameState`, `CardValue`.
- Produces: `exchangeWhiteForBlack(state, playerId)`, `resetGameForNewMatch(state)`, Solo-Guard in `playCard`, `firstRoundExiterId`-Tracking.

- [ ] **Step 1: Failing Tests schreiben (scoring + engine)**

```typescript
// scoring.test.ts
it('tauscht 10 weiße gegen 1 schwarzen (manuell)', () => {
  let state = createInitialGameState('LAMA', 'p1');
  state = addPlayerToRoom(state, 'p1', 'Alice');
  state = addPlayerToRoom(state, 'p2', 'Bob');
  state.players['p1'].chips = { white: 12, black: 0 };
  state = exchangeWhiteForBlack(state, 'p1');
  expect(state.players['p1'].chips).toEqual({ white: 2, black: 1 });
});
```

```typescript
// game-engine.test.ts — Solo-Duplikat
it('blockt doppelte Werte im Solo-Endspurt', () => {
  // p1 foldet, p2 im Solo legt 3, zweite 3 wirft, 4 geht
});
```

```typescript
// game-engine.test.ts — erster Exiter startet
it('erster Aussteiger beginnt nächste Runde', () => {
  // A fold, B fold, C fold (alle) → lastRoundFinisherId === A
});
```

- [ ] **Step 2: Tests rot verifizieren**

Run: `npm test --workspace=shared`
Expected: FAIL (Funktionen fehlen)

- [ ] **Step 3: Engine implementieren**

```typescript
export function exchangeWhiteForBlack(state: GameState, playerId: string): GameState {
  const p = state.players[playerId];
  if (!p) throw new Error('Spieler nicht gefunden.');
  if (p.chips.white < 10) throw new Error('Mindestens 10 weiße Chips erforderlich.');
  const updated = { ...p, chips: { white: p.chips.white - 10, black: p.chips.black + 1 } };
  updated.totalScore = updated.chips.white + updated.chips.black * 10;
  return { ...state, players: { ...state.players, [playerId]: updated } };
}

export function resetGameForNewMatch(state: GameState): GameState {
  const players: Record<string, Player> = {};
  for (const pid of state.playerOrder) {
    const p = state.players[pid];
    players[pid] = { ...p, chips: { white: 0, black: 0 }, totalScore: 0, hand: [], foldedHand: [], status: 'ACTIVE', connected: p.connected };
  }
  return { ...state, phase: 'LOBBY', roundNumber: 0, players, turnIndex: 0, drawPile: [], discardPile: [], lastRoundFinisherId: null, firstRoundExiterId: null, soloDiscardedValues: null, pendingChipDiscardPlayerId: null, lastRoundSummary: null, winners: null };
}
```

Solo: `foldPlayer` setzt `soloDiscardedValues=[]` bei Solo-Beginn; `playCard` wirft bei Duplikat im Solo und pusht sonst; `startRound`/`settleRound` resetten Feld + setzen `firstRoundExiterId`.

- [ ] **Step 4: Tests grün verifizieren**

Run: `npm test --workspace=shared`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
DEVELOPER_DIR=/Library/Developer/CommandLineTools git add shared/src/types.ts shared/src/game-engine.ts shared/tests/scoring.test.ts shared/tests/game-engine.test.ts
DEVELOPER_DIR=/Library/Developer/CommandLineTools git commit -m "feat(shared): chip-tausch, solo-einmaligkeit, erster-exiter, reset"
```

---

### Task 3: Worker — NEW_GAME / EXCHANGE / LEAVE_ROOM

**Files:**
- Modify: `worker/src/game-room.ts`

**Interfaces:**
- Consumes: Engine-Funktionen aus Task 2.
- Produces: Broadcast-State nach jedem Handler.

- [ ] **Step 1: Handler einbauen**

```typescript
case 'EXCHANGE_CHIPS': { nextState = exchangeWhiteForBlack(state, sessionId); break; }
case 'NEW_GAME': {
  if (state.phase !== 'ROUND_SUMMARY' && state.phase !== 'GAME_OVER') throw new Error('Neues Spiel erst nach Rundenende.');
  nextState = resetGameForNewMatch(state);
  this.broadcastNotification('Neues Spiel! Alle Punkte zurückgesetzt.', 'info');
  break;
}
case 'LEAVE_ROOM': {
  // LOBBY: hart löschen; sonst nur DISCONNECTED
  if (state.phase === 'LOBBY') { /* order/players filtern, hostId neu, leer → löschen */ }
  else { /* connected=false, status DISCONNECTED, Turn fix falls nötig */ }
  break;
}
```

- [ ] **Step 2: Build prüfen**

Run: `npm run build --workspace=worker`
Expected: PASS (setzt shared + frontend build voraus)

---

### Task 4: Frontend — Socket-Actions + Buttons + beforeunload

**Files:**
- Modify: `frontend/src/hooks/useGameSocket.ts`, `frontend/src/App.tsx`, `frontend/src/components/RoundSummaryModal.tsx`, `frontend/src/components/PlayerHand.tsx`

**Interfaces:**
- Consumes: `EXCHANGE_CHIPS/NEW_GAME/LEAVE_ROOM`.
- Produces: `actions.exchangeChips/newGame/leaveRoom`, `onNewGame/onLeaveRoom`-Props, `beforeunload`-Guard.

- [ ] **Step 1: Socket-Actions**

```typescript
const exchangeChips = useCallback(() => sendMessage({ type: 'EXCHANGE_CHIPS' }), [sendMessage]);
const newGame = useCallback(() => sendMessage({ type: 'NEW_GAME' }), [sendMessage]);
const leaveRoom = useCallback(() => sendMessage({ type: 'LEAVE_ROOM' }), [sendMessage]);
```

Explizites Leave: Reconnect-Timer clearen + Socket schließen (Flag `leftRef`), kein Auto-Reconnect.

- [ ] **Step 2: Modal + Hand-Buttons**

`RoundSummaryModal`: nach `GAME_OVER` (und `ROUND_SUMMARY` ohne pending) „Neues Spiel" + „Raum verlassen". `PlayerHand`: „10→1 tauschen" wenn `chips.white>=10`.

- [ ] **Step 3: App beforeunload + handleLeaveRoom**

```typescript
useEffect(() => {
  if (!hasJoined || state?.phase !== 'IN_ROUND') return;
  const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
  window.addEventListener('beforeunload', h);
  return () => window.removeEventListener('beforeunload', h);
}, [hasJoined, state?.phase]);
```

`handleLeaveRoom`: `actions.leaveRoom()` → Socket-Close → `setHasJoined(false)`.

---

### Task 5: Verifikation + PR

- [ ] **Step 1: lint/build/test**

Run: `npm run lint`, `npm run build`, `npm test`
Expected: PASS

- [ ] **Step 2: e2e (optional lokal)**

Run: `npm run test:e2e` (nach Playwright-Chromium-Install)
Expected: PASS

- [ ] **Step 3: Push + PR**

```bash
DEVELOPER_DIR=/Library/Developer/CommandLineTools git push -u origin feature/round-end-solo-chips-leave
gh pr create --base main --head feature/round-end-solo-chips-leave --title "fix: Rundenende, Solo-Einmaligkeit, Chip-Tausch, Leave" --body "..."
```
