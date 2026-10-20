# Synchronisierter Start des nächsten Durchgangs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Synchronize next-round start so the room waits for every remaining player to confirm, while preserving the round summary and leave/new-game choices.

**Architecture:** Store ready player IDs in the authoritative shared game state and expose that list in each client view. A shared transition records readiness and starts only when all current players are ready and any bonus-chip discard is complete; the same barrier is re-evaluated after a player leaves or returns a bonus chip. The worker accepts readiness during the round-summary/bonus-discard phase, and the summary modal shows a per-player waiting state while retaining leave and new-game actions.

**Tech Stack:** TypeScript 7 strict mode, Vitest, Cloudflare Durable Objects with SQLite-backed persisted `GameState`, React 19, Playwright E2E, Biome.

**Spec:** `docs/superpowers/specs/2026-10-20-synchronized-next-round-design.md`

## Global Constraints

- Persist authoritative state after every state-changing Durable Object action.
- `shared/src/types.ts` remains the single source of truth for shared state and WebSocket types.
- Preserve server-authoritative play and never expose other players' hands.
- Keep a disconnect in the readiness barrier; only explicit `LEAVE_ROOM` removes a player.
- Keep strict TypeScript and add Vitest coverage for game-state transitions.
- Do not add dependencies.

---

## File Structure

- Modify `shared/src/types.ts`: add the ready-player IDs to `GameState` and `ClientRoomView`.
- Modify `shared/src/game-engine.ts`: implement readiness, barrier evaluation, reset/migration, leave and bonus-discard transitions.
- Modify `shared/tests/leave-and-starter.test.ts` or add `shared/tests/next-round-readiness.test.ts`: test barrier behavior, leave, and bonus-discard release.
- Modify `worker/src/game-room.ts`: route `NEXT_ROUND` to the readiness transition; preserve the round-summary flow on explicit leave; persist and broadcast the result.
- Modify `frontend/src/components/RoundSummaryModal.tsx`: show each client's ready/waiting state and keep leave/new-game actions available while the chip bonus is pending.
- Modify `frontend/e2e/round-flow.spec.ts` and add `frontend/e2e/round-ready.spec.ts`: update the existing two-player flow and cover the confirmed three-player barrier.
- Modify `docs/superpowers/specs/2026-10-20-synchronized-next-round-design.md` only if implementation discovery requires an approved design correction.

## Interfaces

- Add `nextRoundReadyPlayerIds: string[]` to `GameState` and `ClientRoomView`.
- Add `markNextRoundReady(state: GameState, playerId: string): GameState` in `game-engine.ts`. It rejects calls outside `ROUND_SUMMARY`, ignores duplicate readiness, and starts the next round only if all current players are ready and no chip discard is pending.
- Add an internal `startNextRoundIfReady(state: GameState): GameState` helper used by readiness, bonus-chip return, and explicit player removal. It returns the same state unless the barrier is fulfilled; on fulfillment it calls `startRound` and clears the readiness list.
- `discardBonusChip(state, playerId, chipType)` clears the pending chip and re-evaluates the barrier.
- `removePlayerFromGame(state, playerId)` removes that ID from readiness. When the round is awaiting readiness, it re-evaluates the barrier for the remaining roster; fewer than two players retains the existing lobby fallback.
- `filterStateForClient` copies the ready-player IDs into the client view.
- Worker `NEXT_ROUND` invokes `markNextRoundReady(state, sessionId)`; it must not call `startRound` directly.

---

### Task 1: Shared readiness barrier

**Files:**
- Modify: `shared/src/types.ts`
- Modify: `shared/src/game-engine.ts`
- Create: `shared/tests/next-round-readiness.test.ts`

**Interfaces:**
- Consumes: existing `startRound`, `discardBonusChip`, and `removePlayerFromGame` transitions.
- Produces: `markNextRoundReady(state, playerId)`, with readiness tracked in state and client-safe projection.

- [ ] **Step 1: Write failing tests for three-player readiness**

```typescript
it('starts only after every player in a three-player room is ready', () => {
  let state = completedThreePlayerRound();

  state = markNextRoundReady(state, 'p1');
  expect(state.phase).toBe('ROUND_SUMMARY');
  expect(state.roundNumber).toBe(1);

  state = markNextRoundReady(state, 'p2');
  expect(state.phase).toBe('ROUND_SUMMARY');
  expect(state.roundNumber).toBe(1);

  state = markNextRoundReady(state, 'p3');
  expect(state.phase).toBe('IN_ROUND');
  expect(state.roundNumber).toBe(2);
  expect(state.nextRoundReadyPlayerIds).toEqual([]);
});
```

Create `completedThreePlayerRound()` in the test file using real engine transitions: create three players, start a round, set each hand to one card, then fold each player in turn until `ROUND_SUMMARY`. Do not mock readiness or the engine.

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `npm test --workspace=shared -- next-round-readiness.test.ts`

Expected: FAIL because the readiness field/transition is missing; the failure must be an assertion or missing export, not a Vitest setup error.

- [ ] **Step 3: Add readiness state and minimal barrier transition**

Initialize `nextRoundReadyPlayerIds` to `[]` in initial state and legacy migration. Add `markNextRoundReady` and an internal `startNextRoundIfReady`. Ensure `startRound` clears readiness and `filterStateForClient` returns a copied list. Reject a player ID not present in `playerOrder` and reject the action unless the phase is `ROUND_SUMMARY`.

- [ ] **Step 4: Verify the focused test is GREEN**

Run: `npm test --workspace=shared -- next-round-readiness.test.ts`

Expected: PASS; first and second confirmations leave the summary visible, third confirmation starts round 2 and clears readiness.

- [ ] **Step 5: Add and verify leave-barrier test**

Add a test where `p1` and `p2` are ready in the three-player summary, then `p3` leaves via `removePlayerFromGame`. Assert that at least two remaining players start round 2 automatically, `p3` is removed, and readiness is cleared. Add a companion assertion that a roster falling below two players returns to `LOBBY` without clearing retained chips.

Run: `npm test --workspace=shared -- next-round-readiness.test.ts`

Expected: PASS for both leave outcomes.

- [ ] **Step 6: Add and verify pending-bonus test**

Create a real round where the finisher has at least one chip and empties their hand. Confirm that `markNextRoundReady` is accepted while `pendingChipDiscardPlayerId` is set but does not start the round. Confirm the remaining players can also become ready; then call `discardBonusChip` and assert it clears the pending player and starts the next round only after every roster member is ready.

Run: `npm test --workspace=shared -- next-round-readiness.test.ts`

Expected: PASS; pending bonus blocks the transition but does not block readiness.

---

### Task 2: Worker transitions and persistence

**Files:**
- Modify: `worker/src/game-room.ts`
- Modify: `shared/tests/next-round-readiness.test.ts` if a shared transition edge case is discovered.

**Interfaces:**
- Consumes: `markNextRoundReady(state, sessionId)` and the updated engine state.
- Produces: persisted/broadcast state after readiness, chip discard, and leave; no immediate room-wide start on the first `NEXT_ROUND`.

- [ ] **Step 1: Replace immediate `NEXT_ROUND` start with readiness**

In the `NEXT_ROUND` switch case, call `markNextRoundReady(state, sessionId)` instead of `startRound(...)`. Keep the worker's common `saveState`, `maybeNotifyNextPlayer`, and `broadcastState` path so every confirmation is persisted and visible to all connected clients.

- [ ] **Step 2: Preserve round summary when a player leaves while waiting**

For `LEAVE_ROOM` received in `ROUND_SUMMARY`, do not call `resetGameForNewMatch` after `removePlayerFromGame`. Use the engine's re-evaluated state so the leave removes that player from the readiness barrier, starts if every remaining player is ready and at least two remain, or returns to the lobby if fewer than two remain. Preserve the existing reset-on-leave behavior in other phases and the existing push-subscription cleanup.

- [ ] **Step 3: Verify Worker TypeScript build**

Run: `npm run build --workspace=shared && npm run build --workspace=frontend && npm run build --workspace=worker`

Expected: PASS with the new shared client/state fields and worker handler types.

---

### Task 3: Summary modal choices and waiting state

**Files:**
- Modify: `frontend/src/components/RoundSummaryModal.tsx`

**Interfaces:**
- Consumes: `state.nextRoundReadyPlayerIds`, `state.opponents`, and `state.myPlayer.id`.
- Produces: a ready button before confirmation; a waiting indicator after confirmation; persistent new-game and leave buttons during a pending chip discard.

- [ ] **Step 1: Adjust modal conditions**

Keep the modal visible in `ROUND_SUMMARY` while `pendingChipDiscardPlayerId` is set. The bonus discard controls remain visible only for the eligible player. Render the next-round button only when the local player is not ready; after readiness, render clear text such as `Du bist bereit. Warte auf die anderen Spieler.` Render readiness counts from `nextRoundReadyPlayerIds.length` and the current player count (`opponents.length + 1`). Keep `Neues Spiel` and `Raum verlassen` visible to all clients during a pending chip discard and while waiting.

- [ ] **Step 2: Run frontend lint and build**

Run: `npm run lint --workspace=frontend && npm run build --workspace=frontend`

Expected: PASS without a11y or TypeScript errors.

---

### Task 4: End-to-end synchronized round flow

**Files:**
- Modify: `frontend/e2e/round-flow.spec.ts`
- Create: `frontend/e2e/round-ready.spec.ts`

**Interfaces:**
- Consumes: rendered ready/waiting state and synchronized worker behavior.
- Produces: browser-level proof that two- and three-player confirmations are collected before a new round appears to anyone.

- [ ] **Step 1: Update the existing two-player flow**

After summary math is verified, click `next-round-button` from Alice only. Assert Alice's waiting message, assert both clients still show round 1 and the summary, then click Bob's next-round button. Assert both clients now show round 2, six cards each, and no summary.

- [ ] **Step 2: Add a three-player E2E regression flow**

Create three isolated browser contexts, have all three join one room, start the game, then repeatedly find the page with the visible turn indicator and fold that player until all three see the round summary. Confirm readiness from the first page and assert all three still show the summary and round 1; confirm readiness from the second and assert the same; confirm the final player's readiness and assert all three see round 2 with six cards and no summary. Close all contexts in `finally`.

- [ ] **Step 3: Run the focused E2E specs**

Run: `npm run build && npm run test:e2e --workspace=frontend -- round-flow.spec.ts round-ready.spec.ts`

Expected: PASS with Wrangler's local production-like stack and the installed Chromium browser. If Chromium is not installed, run `npx playwright install chromium` from `frontend/` and repeat.

---

### Task 5: Full verification

**Files:**
- No additional code unless a prior verification step exposes a defect.

- [ ] **Step 1: Run shared unit tests**

Run: `npm test --workspace=shared`

Expected: PASS, including all existing game, scoring, party, room-limit, and leave tests.

- [ ] **Step 2: Run repository lint**

Run: `npm run lint`

Expected: PASS with no formatting, import-order, or accessibility violations.

- [ ] **Step 3: Run full monorepo build**

Run: `npm run build`

Expected: PASS in shared → frontend → worker order.

- [ ] **Step 4: Run all frontend E2E tests**

Run: `npm run test:e2e`

Expected: PASS for round flow, readiness, party flow, accessibility, and PWA specs.

## Plan Self-Review

- Spec coverage: synchronization and idempotent confirmation (Task 1); explicit leave and under-two lobby fallback (Tasks 1–2); bonus-chip barrier release (Task 1); persistent state/client projection (Tasks 1–2); waiting UI and retained actions (Task 3); two- and three-player end-to-end coverage (Task 4); `NEW_GAME` and unaffected flows (Tasks 2 and 5).
- Placeholder scan: no TBD/TODO items or unspecified test/build commands; all new behavior is tied to named files, interfaces, and expected assertions.
- Type consistency: `nextRoundReadyPlayerIds` is the exact state/client field throughout; `markNextRoundReady(state, playerId)` is the exact transition consumed by the worker; the internal barrier evaluator is shared by readiness, leave, and bonus-discard paths.
