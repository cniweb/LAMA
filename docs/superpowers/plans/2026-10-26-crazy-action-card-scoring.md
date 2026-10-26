# Crazy-Aktionskartenwertung Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Count every Crazy action card as 15 penalty points and raise Crazy's game-over threshold to 60 while keeping Golden Lama at 30 and all other variants at 40.

**Architecture:** `calculateUniquePoints` will add 15 for each `SK`, `D2`, and `GF` occurrence while retaining unique-value scoring for ordinary cards and the existing 30-point Golden Lama group. A shared `getGameOverThreshold(variant)` helper will drive every engine threshold check and both game-over messages.

**Tech Stack:** TypeScript 7, Vitest, React 19, Playwright E2E, Markdown.

**Spec:** `docs/superpowers/specs/2026-10-26-crazy-scoring-design.md`

## Global Constraints

- Each `SK`, `D2`, and `GF` card is worth 15 points per occurrence, including duplicates.
- `GL` remains 30 points and the highest one-time value in the Lama group (`GL > PL > L`).
- Normal number/Plus/Lama scoring keeps its existing unique-value rules.
- The game ends at 60 points in Crazy and 40 points in Classic and Party.
- Threshold checks must agree after round settlement, bonus-chip discard, and removal of a pending finisher.
- No card effects, deck counts, or chip denominations change.

## Review Focus

- Repeated action-card values must each add 15 while repeated ordinary values still count once — unit test with duplicated `SK`/`GF` plus a duplicated number.
- `GL` must remain 30 and must not be added to the 15-point action-card total — unit test a mixed Lama/action hand.
- Crazy must continue below 60 and end at exactly 60, while Classic and Party still end at 40 — boundary tests for round settlement.
- The threshold must also apply after a bonus-chip discard and when the pending finisher leaves — tests exercise both resolution paths.
- User-facing rules and game-over text must show 15-per-action-card and variant-specific 60/40 limits — Playwright checks Crazy help and summary copy.

---

### Task 1: Crazy scoring, threshold logic, and rule copy

**Files:**
- Modify: `shared/src/game-engine.ts`
- Test: `shared/tests/crazy.test.ts`
- Test: `shared/tests/game-engine.test.ts`
- Test: `shared/tests/leave-and-starter.test.ts`
- Modify: `frontend/src/components/RulesModal.tsx`
- Modify: `frontend/src/components/RoundSummaryModal.tsx`
- Test: `frontend/e2e/crazy-flow.spec.ts`
- Test: `frontend/e2e/player-controls-responsive.spec.ts`
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `AGENTS.md`

**Interfaces:**
- Produces: `getGameOverThreshold(variant: GameVariant): number` in `shared/src/game-engine.ts`; returns `60` for `crazy` and `40` otherwise.
- Consumes: `calculateUniquePoints(cards: CardValue[]): number` remains the shared scoring entry point; engine threshold call sites and frontend copy consume `getGameOverThreshold`.

- [x] **Step 1: Write the scoring regression test first.** In `shared/tests/crazy.test.ts`, add `it('zählt jede Aktionskarte einzeln und lässt GL bei 30')`: assert `calculateUniquePoints(['SK', 'SK', 'D2', 'GF', 'GF', 4, 4, 'GL']) === 109` and `calculateUniquePoints(['GL', 'PL', 'L']) === 30`.
- [x] **Step 2: Write game-over boundary tests.** In `shared/tests/crazy.test.ts`, add `it('beendet Crazy bei 60, aber nicht bei 59')` through `settleRound` and assert `ROUND_SUMMARY` at 59 versus `GAME_OVER` at 60. Add `it('beendet Classic und Party weiterhin bei 40')` for both variants. Also add `it('prüft die Crazy-60-Grenze nach Bonus-Chip-Abgabe')` and `it('prüft die Crazy-60-Grenze nach Entfernen des Bonus-Finishers')`; each must assert `phase === 'GAME_OVER'` when a remaining player has exactly 60. Keep the existing Classic 40-point test in `shared/tests/game-engine.test.ts` as a separate regression check.
- [x] **Step 3: Run the shared tests and verify RED.** Ran `npm run test --workspace=shared -- tests/crazy.test.ts tests/game-engine.test.ts tests/leave-and-starter.test.ts`; expected scoring and 59-boundary assertions failed, while Classic/Party regressions passed.
- [x] **Step 4: Add UI regression tests before UI changes.** In `frontend/e2e/crazy-flow.spec.ts`, assert the Crazy Rules dialog says action cards count 15 each and the game ends at 60. In `frontend/e2e/player-controls-responsive.spec.ts`, add a mocked game-over view and assert Crazy shows 60 while Classic shows 40. Check horizontal overflow and save screenshots at 320, 390, and 1280px.
- [x] **Step 5: Run the targeted E2E tests and verify RED.** Ran `npm run build && npm run test:e2e --workspace=frontend -- crazy-flow.spec.ts player-controls-responsive.spec.ts`; build passed and the old scoring/rule copy assertions failed as expected.
- [x] **Step 6: Implement the minimal engine change.** Export `getGameOverThreshold(variant: GameVariant): number`; increment an action-card subtotal by 15 for every `isActionCard(card)` occurrence in `calculateUniquePoints`; initialize the score total from that subtotal; replace the three literal 40-point engine checks in `settleRound`, `discardBonusChip`, and `removePlayerFromGame` with the helper.
- [x] **Step 7: Update user-facing copy.** Use the shared threshold helper in `RulesModal` and `RoundSummaryModal`; describe `SK`/`D2`/`GF` as 15 points each while keeping `GL` at 30. Update the Crazy section and game-end limits in `README.md`, add the change under `## [Unreleased]` in `CHANGELOG.md`, and record the verified scoring/threshold rule in `AGENTS.md`.
- [x] **Step 8: Run targeted tests to verify GREEN.** The shared test command and targeted Playwright command passed.
- [x] **Step 9: Run full verification:** `npm run lint`, `npm run build`, `npm test`, `npm run test:e2e`, and `npm audit --audit-level=high`. Audit ran but still reports existing Wrangler/Miniflare/Undici advisories; see the SDD ledger ruling.
- [x] **Step 10: Review the diff and branch status.** Reviewed the working-tree diff on the feature branch; no commit, push, or release performed.
