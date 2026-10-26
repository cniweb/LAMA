# Responsive Rules Modal Header Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent the RulesModal variant badge from overlapping its close button on narrow screens while preserving the badge and one-line layout on desktop.

**Architecture:** Let the modal header wrap on mobile and reserve right-side space for the absolutely positioned close button. Keep the badge visible; at narrow widths it moves below the title. Restore the current single-row layout at the `sm` breakpoint. Playwright will verify geometry at 320/390/1280px.

**Tech Stack:** React 19, Tailwind CSS, Playwright, TypeScript 7.

**Spec:** `docs/superpowers/specs/2026-10-26-rules-modal-responsive-header-design.md`

## Global Constraints

- The Crazy/Party/Classic badge stays visible at every viewport.
- The close button must not overlap the title or badge.
- The help icon stays on the same visual row as the title at 320px.
- The desktop (`1280px`) header remains on one row.
- No horizontal overflow at 320px, 390px, or 1280px.
- Keep the rule text and game behavior unchanged.

## Review Focus

- At 320px the title may wrap and the badge may move below it, but the help icon stays with the title and neither intersects the close button — geometry assertions in the existing Crazy Rules Playwright flow.
- At 390px the badge remains visible without overlap — same geometry assertion.
- At 1280px badge remains visible and the header stays one row — viewport screenshot and geometry assertion.
- Modal content remains horizontally contained at all three widths — existing document overflow assertion.

---

### Task 1: Wrap and reserve space in the RulesModal header

**Files:**
- Modify: `frontend/src/components/RulesModal.tsx`
- Test: `frontend/e2e/crazy-flow.spec.ts`
- Modify: `AGENTS.md`

**Interfaces:**
- Consumes: Existing modal markup (`rules-modal-title`, close button `aria-label="Regeln schließen"`, Crazy badge text `🦙✨ Crazy`) and existing viewport screenshot loop.
- Produces: A mobile-wrapping header that reserves the close-button area; an E2E assertion that the badge and close button have no intersecting bounding boxes.

- [x] **Step 1: Add the overlap regression assertion first.** In `frontend/e2e/crazy-flow.spec.ts`, for each width in `[320, 390, 1280]`, read bounding boxes for the exact `🦙✨ Crazy` badge and the button named `Regeln schließen`; fail if their rectangles intersect. Also assert the first header icon shares a row with the title. Keep the existing no-horizontal-overflow assertion and screenshots.
- [x] **Step 2: Run the targeted E2E spec and verify RED.** The test failed at 320px with `Crazy-Badge überlappt den Schließen-Button`, confirming the reproduced defect.
- [x] **Step 3: Implement the smallest layout change.** In `RulesModal.tsx`, group the help icon with the title, use a mobile title size that fits that group, allow the badge to wrap, and reserve right padding for the 44px close button; restore the current desktop title size, no-wrap, and zero reserved padding at `sm`. Keep the badge visible and do not change the subtitle or rules copy.
- [x] **Step 4: Run the targeted spec and verify GREEN.** Build passed; targeted Playwright passed with no badge/button intersection or horizontal overflow at all three widths.
- [x] **Step 5: Record the verified responsive-modal lesson.** Added §6.29 to `AGENTS.md` with the absolute close-button/mobile-wrap lesson.
- [x] **Step 6: Run full verification.** Lint, build, unit tests, and all E2E tests passed after the final layout adjustment.
- [x] **Step 7: Review the diff and status.** Reviewed the focused diff and kept the pre-existing feature-branch changes intact; no commit or push performed.
