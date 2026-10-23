# Zweizeilige Spieler-Steuerleiste Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep chip counts, exchanges and turn/status information visible in a stable two-row control area on mobile and desktop.

**Architecture:** Extract the chip display and conditional exchange buttons into a reusable frontend control. `PlayerHand` uses it in its first fixed row, and `RoundSummaryModal` uses it while the modal blocks the underlying controls. `App` passes a single permission flag derived from turn and round-settlement state.

**Tech Stack:** React 19, TypeScript 7, Tailwind CSS, Playwright E2E.

**Spec:** `docs/superpowers/specs/2026-10-23-two-row-player-controls-design.md`

## Global Constraints

- Responsive UI must be verified at 320px, 390px and 1280px.
- No horizontal overflow, clipping, or state-dependent control-bar height; touch targets are at least 44px.
- The 360×640px mobile game screen must remain free of vertical scroll after a turn.
- Run Playwright against the built frontend + local Worker stack.
- No game-rule or server behavior changes.

## Review Focus

- At 320px, both exchange buttons plus all chip counts remain visible without horizontal scrolling — test with the two eligible exchanges present.
- Waiting, turn, and folded statuses preserve identical row heights — test each state at 320px/390px/1280px.
- Exchange buttons are hidden when it is not the player's turn, but available during scoring and the current finisher's pending bonus dialog — test the summary and pending-bonus cases.
- The summary modal does not block scoring-time exchanges — test through the visible dialog controls.
- Party/Crazy pink exchange remains absent in Classic — test eligibility across variants.

---

### Task 1: Responsive two-row controls and scoring-time exchanges

**Files:**
- Create: `frontend/src/components/ChipExchangeControls.tsx`
- Modify: `frontend/src/components/PlayerHand.tsx`
- Modify: `frontend/src/components/RoundSummaryModal.tsx`
- Modify: `frontend/src/App.tsx`
- Create: `frontend/e2e/player-controls-responsive.spec.ts`

**Interfaces:**
- `ChipExchangeControls` consumes `chips`, `totalScore`, `hasPinkChips`, `exchangeAllowed`, and `onExchangeChips`; it renders the compact chip display and eligible exchange buttons.
- `PlayerHand` consumes `exchangeAllowed: boolean` and keeps the controls bar at a fixed two-row height.
- `RoundSummaryModal` consumes `exchangeAllowed` and `onExchangeChips` to expose exchanges above its modal backdrop.

- [x] **Step 1: Add E2E coverage first** for the two row regions, stable 44px row heights, no horizontal overflow at 320px/390px/1280px, turn/wait status, and scoring-modal exchange access.
- [x] **Step 2: Run the new spec before implementation** with `npm run build && npm run test:e2e --workspace=frontend -- player-controls-responsive.spec.ts`; expect the new row selectors and summary exchange controls to be absent.
- [x] **Step 3: Implement the reusable exchange control and permission calculation** in the files listed above. Permit exchange while `myPlayer.isTurn`, during `ROUND_SUMMARY`/`GAME_OVER`, and for `pendingChipDiscardPlayerId === myPlayer.id`; render the same exchange actions inside the summary modal because it covers `PlayerHand`.
- [x] **Step 4: Run the targeted E2E spec** and verify all assertions pass at 320px, 390px and 1280px, including no bar-level horizontal scroll and fixed row heights.
- [x] **Step 5: Run repository verification:** `npm run lint`, `npm run build`, `npm test`, and `npm run test:e2e`.
- [x] **Step 6: Review `git diff` and branch status**; do not commit or push unless requested.
