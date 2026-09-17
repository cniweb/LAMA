# Mobile-Portrait Responsive (Kompakt-Portrait) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Der LAMA-Spiel-Screen passt im Hochformat auf 360px-Viewporten ohne vertikalen Scroll und ist per Touch bedienbar.

**Architecture:** Rein presentationaler Umbau im Frontend: kompakte Mobile-Basiswerte mit `sm:`-Wiederherstellung der Desktop-Maße (Tailwind v4, keine `!`-Overrides nötig, da Media-Queries Basis-Klassen schlagen). Keine `shared/`-Logikänderung, keine `data-testid`-Änderung.

**Tech Stack:** React 19, Tailwind CSS v4, TypeScript 7 (strict), Playwright (Pixel-7-Device-Descriptor), Biome.

## Global Constraints

- TypeScript strict: keine `any`-Casts.
- Lint/Format: `npm run lint` (`biome ci .`) muss grün sein.
- Vor jedem E2E-Lauf: `npm run build` (Repo-Root), da `tsc -b` Specs typprüft und `wrangler dev` `frontend/dist` serviert.
- `data-testid`-Attribute (`player-hand`, `turn-indicator`, `draw-button`, `fold-button`, `room-code`, `round-summary`, `start-game-button`) dürfen weder umbenannt noch entfernt werden.
- Keine Änderung in `shared/`.
- Nach jedem Task: `npm run lint` + `npm run build --workspace=frontend`.

---

## File Structure

- Modify: `frontend/src/components/Card.tsx` — neue Größe `xs`, wird von der Hand auf Mobile genutzt.
- Modify: `frontend/src/components/PlayerHand.tsx` — `xs`-Hand mit `sm:`-Desktopmaß, zweizeiliger Steuerkopf, 44px-Aktionsbuttons.
- Modify: `frontend/src/components/DiscardPile.tsx` — `md`-Stapel auf Mobile, `lg` erst ab `sm:`.
- Modify: `frontend/src/components/Opponent.tsx` + `frontend/src/index.css` — kompakte Mobile-Card, Fächer-Cap per CSS.
- Modify: `frontend/src/App.tsx` — `min-h-dvh`, Safe-Area-Header, 44px-Header-Buttons.
- Modify: `frontend/src/components/RulesModal.tsx`, `frontend/src/components/RoundSummaryModal.tsx` — 44px-Touch-Targets.
- Create: `frontend/e2e/mobile-portrait.spec.ts` — No-Scroll- + Tap-Test im Pixel-7-Viewport (Regressionsnetz für alle Layout-Tasks).

Task 1 liefert den fehlschlagenden Test (TDD). Die Tasks 2–6 machen ihn Schritt für Schritt grün. Task 7 verifiziert alles.

---

### Task 1: Mobile E2E-Spec (failing test)

**Files:**
- Create: `frontend/e2e/mobile-portrait.spec.ts`
- Test: `frontend/e2e/mobile-portrait.spec.ts`

**Interfaces:**
- Consumes: bestehende `data-testid`-Selektoren aus `App.tsx`/`PlayerHand.tsx` (unverändert).
- Produces: Helper `expectNoVerticalScroll(page, label)` und Flow `startTwoPlayerGame(browser)` — kein anderer Task importiert sie (Spec ist eigenständig).

- [ ] **Step 1: Write the failing test**

Erstelle `frontend/e2e/mobile-portrait.spec.ts` mit exakt diesem Inhalt:

```ts
import { type Browser, devices, expect, type Page, test } from '@playwright/test';

const MOBILE = { ...devices['Pixel 7'], viewport: { width: 360, height: 640 } };
const ROOM_CODE_PATTERN = /^[A-HJ-NP-Z2-9]{4}$/;

async function expectNoVerticalScroll(page: Page, label: string): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollHeight - window.innerHeight
  );
  expect(overflow, `[e2e][mobile] ${label}: overflow=${overflow}px`).toBeLessThanOrEqual(0);
}

async function createRoomAs(page: Page, playerName: string): Promise<string> {
  await page.goto('/');
  await page.getByLabel('Dein Spielername').fill(playerName);
  await page.getByRole('button', { name: 'Neues Spiel erstellen' }).click();
  const roomCode = page.getByTestId('room-code');
  await expect(roomCode).toBeVisible();
  const code = ((await roomCode.textContent()) ?? '').trim();
  expect(code).toMatch(ROOM_CODE_PATTERN);
  return code;
}

async function joinRoomAs(page: Page, playerName: string, roomCode: string): Promise<void> {
  await page.goto('/');
  await page.getByLabel('Dein Spielername').fill(playerName);
  await page.getByLabel('Raum-Code').fill(roomCode);
  await page.getByRole('button', { name: 'Raum beitreten' }).click();
  await expect(page.getByTestId('room-code')).toHaveText(roomCode);
}

test('Spiel-Screen passt ohne Scroll auf 360px-Breite', async ({
  browser,
}: {
  browser: Browser;
}) => {
  const ctxA = await browser.newContext(MOBILE);
  const ctxB = await browser.newContext(MOBILE);
  const alice = await ctxA.newPage();
  const bob = await ctxB.newPage();
  try {
    const code = await createRoomAs(alice, 'Mobil-A');
    await joinRoomAs(bob, 'Mobil-B', code);
    await expectNoVerticalScroll(alice, 'lobby-alice');
    await expectNoVerticalScroll(bob, 'lobby-bob');

    await alice.getByTestId('start-game-button').click();
    await expect(alice.getByTestId('player-hand')).toBeVisible();
    await expect(bob.getByTestId('player-hand')).toBeVisible();
    await expectNoVerticalScroll(alice, 'spiel-alice');
    await expectNoVerticalScroll(bob, 'spiel-bob');

    // Genau ein adaptiver Tap auf der Seite, die am Zug ist.
    const active = (await alice.getByTestId('turn-indicator').isVisible()) ? alice : bob;
    const playable = active.getByTestId('player-hand').locator('button.card-playable');
    if ((await playable.count()) > 0) {
      await playable.first().click({ timeout: 5_000 });
    } else if (await active.getByTestId('draw-button').isVisible()) {
      await active.getByTestId('draw-button').click({ timeout: 5_000 });
    } else {
      await active.getByTestId('fold-button').click({ timeout: 5_000 });
    }
    await active.waitForTimeout(1500);
    await expectNoVerticalScroll(alice, 'nach-zug-alice');
    await expectNoVerticalScroll(bob, 'nach-zug-bob');
  } finally {
    await ctxA.close();
    await ctxB.close();
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run build
npm run test:e2e --workspace=frontend -- mobile-portrait
```

Expected: FAIL — `spiel-alice`/`spiel-bob` melden `overflow > 0` (aktuelles Layout ist höher als der Viewport).

- [ ] **Step 3: Commit**

```bash
DEVELOPER_DIR=/Library/Developer/CommandLineTools git add frontend/e2e/mobile-portrait.spec.ts
DEVELOPER_DIR=/Library/Developer/CommandLineTools git commit -m "test(e2e): mobile portrait no-scroll spec (failing)"
```

---

### Task 2: Karten `xs` + kompakte Hand

**Files:**
- Modify: `frontend/src/components/Card.tsx`
- Modify: `frontend/src/components/PlayerHand.tsx`
- Test: `frontend/e2e/mobile-portrait.spec.ts` (Overflow wird kleiner, noch nicht 0)

**Interfaces:**
- Consumes: nichts aus anderen Tasks.
- Produces: `Card`-Prop `size="xs"` (`w-12 h-[76px]`, 6 Karten + Gaps ≈ 328px → eine Reihe auf 360px).

- [ ] **Step 1: `xs`-Größe in `Card.tsx` ergänzen**

`oldString`:
```ts
  size?: 'sm' | 'md' | 'lg';
```
`newString`:
```ts
  size?: 'xs' | 'sm' | 'md' | 'lg';
```

`oldString`:
```ts
  const sizeClasses = {
    sm: 'w-10 h-16 text-sm rounded-md border-2',
```
`newString`:
```ts
  const sizeClasses = {
    xs: 'w-12 h-[76px] text-lg rounded-lg border-2',
    sm: 'w-10 h-16 text-sm rounded-md border-2',
```

- [ ] **Step 2: `PlayerHand.tsx` nutzt `xs` mit `sm:`-Desktopmaß**

`oldString`:
```tsx
                <Card
                  value={card}
                  playable={isPlayable}
                  disabled={isTurn && !isPlayable}
                  size="md"
                  onPlay={onPlayCard}
                />
```
`newString`:
```tsx
                <Card
                  value={card}
                  playable={isPlayable}
                  disabled={isTurn && !isPlayable}
                  size="xs"
                  onPlay={onPlayCard}
                  className="sm:w-20 sm:h-32 sm:text-2xl sm:rounded-xl sm:border-4"
                />
```

Die `sm:`-Werte entsprechen exakt den alten `md`-Desktopmaßen (`w-20 h-32 text-2xl rounded-xl border-4`), daher ist Desktop pixelidentisch. (`md` wird danach nirgends mehr verwendet — das ist beabsichtigt, der Eintrag bleibt für `DiscardPile`-Fallback bestehen.)

- [ ] **Step 3: Run lint + build**

```bash
npm run lint
npm run build --workspace=frontend
```

Expected: beides grün.

- [ ] **Step 4: Run mobile spec to measure progress**

```bash
npm run test:e2e --workspace=frontend -- mobile-portrait
```

Expected: weiterhin FAIL, aber kleinerer Overflow als in Task 1 (Hand braucht nur noch eine Reihe).

- [ ] **Step 5: Commit**

```bash
DEVELOPER_DIR=/Library/Developer/CommandLineTools git add frontend/src/components/Card.tsx frontend/src/components/PlayerHand.tsx
DEVELOPER_DIR=/Library/Developer/CommandLineTools git commit -m "feat(responsive): xs hand cards on mobile, md restored from sm up"
```

---

### Task 3: Kompakte Stapel in `DiscardPile.tsx`

**Files:**
- Modify: `frontend/src/components/DiscardPile.tsx`
- Test: `frontend/e2e/mobile-portrait.spec.ts` (Overflow sinkt weiter)

**Interfaces:**
- Consumes: `Card`-`size="md"` (`w-16 h-24`, existiert bereits).
- Produces: nichts (rein lokale Änderung).

- [ ] **Step 1: Alle 5 `size="lg"` per ReplaceAll auf `md` + `sm:`-Restore umstellen**

Jedes `size="lg"` in `DiscardPile.tsx` (3× Nachziehstapel inkl. Stack-Effekt, 1× Ablage-Stack, 1× oberste Ablagekarte) wird ersetzt durch:

```tsx
size="md" className="sm:w-28 sm:h-44 sm:text-4xl sm:rounded-2xl"
```

Die `sm:`-Werte entsprechen exakt den alten `lg`-Desktopmaßen (`w-28 h-44 text-4xl rounded-2xl`, `border-4` ist in `md` ab `sm:` bereits enthalten). Beispiel für die oberste Ablagekarte:

`oldString`:
```tsx
          {topDiscardCard !== null ? (
            <Card value={topDiscardCard} size="lg" />
```
`newString`:
```tsx
          {topDiscardCard !== null ? (
            <Card
              value={topDiscardCard}
              size="md"
              className="sm:w-28 sm:h-44 sm:text-4xl sm:rounded-2xl"
            />
```

- [ ] **Step 2: Leere-Platzhalter und Gap verschlanken**

`oldString` (2× identisch — beide Vorkommen ersetzen):
```tsx
<div className="w-24 h-36 sm:w-28 sm:h-44 rounded-2xl border-2 border-dashed border-slate-700/60 flex flex-col items-center justify-center text-slate-500 font-bold text-xs p-2 text-center">
```
Hinweis: Das zweite Vorkommen (Ablagestapel) lautet `... justify-center text-slate-500 font-bold text-xs">` ohne `flex-col`/`p-2`/`text-center`. Beide auf `w-16 h-24 sm:w-28 sm:h-44` umstellen, Rest unverändert lassen.

`oldString`:
```tsx
<div className="flex items-center justify-center gap-6 sm:gap-12 my-auto py-2">
```
`newString`:
```tsx
<div className="flex items-center justify-center gap-4 sm:gap-12 my-auto py-2">
```

- [ ] **Step 3: Run lint + build**

```bash
npm run lint
npm run build --workspace=frontend
```

Expected: beides grün.

- [ ] **Step 4: Run mobile spec to measure progress**

```bash
npm run test:e2e --workspace=frontend -- mobile-portrait
```

Expected: FAIL mit weiter gesunkenem Overflow (Stapel sparen ca. 60px Höhe pro Seite).

- [ ] **Step 5: Commit**

```bash
DEVELOPER_DIR=/Library/Developer/CommandLineTools git add frontend/src/components/DiscardPile.tsx
DEVELOPER_DIR=/Library/Developer/CommandLineTools git commit -m "feat(responsive): compact draw/discard piles on mobile"
```

---

### Task 4: Kompakte Gegner-Zeile

**Files:**
- Modify: `frontend/src/components/Opponent.tsx`
- Modify: `frontend/src/index.css`
- Test: `frontend/e2e/mobile-portrait.spec.ts`

**Interfaces:**
- Consumes: nichts aus anderen Tasks.
- Produces: CSS-Klasse `.opponent-fan` (Fächer-Cap auf Mobile).

- [ ] **Step 1: `Opponent.tsx` straffen**

`oldString`:
```tsx
      className={`relative flex flex-col items-center p-2.5 sm:p-3 rounded-2xl transition-all duration-200 border ${
```
`newString`:
```tsx
      className={`relative flex flex-col items-center p-2 sm:p-3 rounded-2xl transition-all duration-200 border ${
```

`oldString`:
```tsx
        {opponent.cardCount === 0 ? (
          <span className="text-xs text-slate-400 italic">Keine Handkarten</span>
        ) : (
          <div className="flex -space-x-4 sm:-space-x-5">
```
`newString`:
```tsx
        {opponent.cardCount === 0 ? (
          <span className="text-xs text-slate-400 italic">Keine Handkarten</span>
        ) : (
          <div className="opponent-fan flex -space-x-4 sm:-space-x-5">
```

- [ ] **Step 2: Fächer-Cap in `index.css`**

Ans Ende von `frontend/src/index.css` anhängen:

```css
/* Mobile: Gegner-Fächer auf 4 verdeckte Karten begrenzen (Deko only —
   die echte Anzahl steht im Zähler darunter). */
@media (max-width: 639px) {
  .opponent-fan > *:nth-child(n + 5) {
    display: none;
  }
}
```

- [ ] **Step 3: Run lint + build**

```bash
npm run lint
npm run build --workspace=frontend
```

Expected: beides grün.

- [ ] **Step 4: Run mobile spec**

```bash
npm run test:e2e --workspace=frontend -- mobile-portrait
```

Expected: PASS oder minimaler Rest-Overflow (je nach Gegnerzahl im Test: 1 Gegner → sollte bereits passen).

- [ ] **Step 5: Commit**

```bash
DEVELOPER_DIR=/Library/Developer/CommandLineTools git add frontend/src/components/Opponent.tsx frontend/src/index.css
DEVELOPER_DIR=/Library/Developer/CommandLineTools git commit -m "feat(responsive): compact opponent cards with mobile fan cap"
```

---

### Task 5: Zweizeiliger Steuerkopf + 44px-Aktionsbuttons

**Files:**
- Modify: `frontend/src/components/PlayerHand.tsx`
- Test: `frontend/e2e/mobile-portrait.spec.ts`

**Interfaces:**
- Consumes: nichts aus anderen Tasks.
- Produces: nichts (rein lokale Änderung).

- [ ] **Step 1: Steuerkopf auf Mobile zweizeilig**

`oldString`:
```tsx
      <div className="flex items-center justify-between w-full max-w-2xl px-4 py-1.5 rounded-xl bg-slate-900/80 border border-slate-800 backdrop-blur-sm">
```
`newString`:
```tsx
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between w-full max-w-2xl px-3 sm:px-4 py-1.5 rounded-xl bg-slate-900/80 border border-slate-800 backdrop-blur-sm">
```

- [ ] **Step 2: Aktionsbuttons auf 44px Mindesthöhe**

`oldString` (Aussteigen-Button):
```tsx
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600/80 hover:bg-rose-600 text-rose-100 font-bold text-xs shadow-md transition-all cursor-pointer hover:scale-105"
```
`newString`:
```tsx
                className="flex items-center gap-1.5 px-3 py-1.5 min-h-[44px] rounded-lg bg-rose-600/80 hover:bg-rose-600 text-rose-100 font-bold text-xs shadow-md transition-all cursor-pointer hover:scale-105"
```

`oldString` (Ziehen-Button):
```tsx
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600/80 hover:bg-blue-600 text-blue-100 font-bold text-xs shadow-md transition-all cursor-pointer hover:scale-105"
```
`newString`:
```tsx
                className="flex items-center gap-1.5 px-3 py-1.5 min-h-[44px] rounded-lg bg-blue-600/80 hover:bg-blue-600 text-blue-100 font-bold text-xs shadow-md transition-all cursor-pointer hover:scale-105"
```

- [ ] **Step 3: Run lint + build**

```bash
npm run lint
npm run build --workspace=frontend
```

Expected: beides grün.

- [ ] **Step 4: Run mobile spec**

```bash
npm run test:e2e --workspace=frontend -- mobile-portrait
```

Expected: PASS (Steuerkopf läuft nicht mehr über).

- [ ] **Step 5: Commit**

```bash
DEVELOPER_DIR=/Library/Developer/CommandLineTools git add frontend/src/components/PlayerHand.tsx
DEVELOPER_DIR=/Library/Developer/CommandLineTools git commit -m "feat(responsive): two-row controls with 44px action buttons on mobile"
```

---

### Task 6: Viewport, Safe-Area, Touch-Targets (App + Modals)

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/RulesModal.tsx`
- Modify: `frontend/src/components/RoundSummaryModal.tsx`
- Test: `frontend/e2e/mobile-portrait.spec.ts` + bestehende `frontend/e2e/accessibility.spec.ts` (Modal-Fokus/Esc-Verhalten)

**Interfaces:**
- Consumes: nichts aus anderen Tasks.
- Produces: nichts (rein lokale Änderungen).

- [ ] **Step 1: `min-h-screen` → `min-h-dvh` (2 Stellen in `App.tsx`)**

`oldString`:
```tsx
      <main className="min-h-screen w-full flex items-center justify-center p-4 felt-table">
```
`newString`:
```tsx
      <main className="min-h-dvh w-full flex items-center justify-center p-4 felt-table">
```

`oldString`:
```tsx
    <div className="min-h-screen w-full flex flex-col justify-between felt-table">
```
`newString`:
```tsx
    <div className="min-h-dvh w-full flex flex-col justify-between felt-table">
```

- [ ] **Step 2: Safe-Area — Header-Top, Hand-Bottom**

Header (`App.tsx`):

`oldString`:
```tsx
      <header className="w-full px-4 py-2.5 bg-slate-950/80 border-b border-slate-800/80 backdrop-blur-md flex items-center justify-between z-30">
```
`newString`:
```tsx
      <header className="w-full px-4 pt-[max(0.625rem,env(safe-area-inset-top))] pb-2.5 bg-slate-950/80 border-b border-slate-800/80 backdrop-blur-md flex items-center justify-between z-30">
```

Hand-Zone (`PlayerHand.tsx`, Root-Div):

`oldString`:
```tsx
    <div className="w-full flex flex-col items-center gap-3">
```
`newString`:
```tsx
    <div className="w-full flex flex-col items-center gap-3 pb-[env(safe-area-inset-bottom)]">
```

- [ ] **Step 3: Header-Icon-Buttons auf 44px**

Regeln-Button (`App.tsx`):

`oldString`:
```tsx
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-slate-100 transition cursor-pointer"
            title="Spielregeln ansehen"
```
`newString`:
```tsx
            className="p-1.5 min-w-11 min-h-11 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-slate-100 transition cursor-pointer"
            title="Spielregeln ansehen"
```

Verlassen-Button (`App.tsx`):

`oldString`:
```tsx
            className="p-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900 border border-rose-500/30 text-rose-300 transition cursor-pointer"
```
`newString`:
```tsx
            className="p-1.5 min-w-11 min-h-11 flex items-center justify-center rounded-lg bg-rose-950/60 hover:bg-rose-900 border border-rose-500/30 text-rose-300 transition cursor-pointer"
```

Regel-Modal-Close (`RulesModal.tsx`):

`oldString`:
```tsx
          className="absolute top-5 right-5 p-1.5 rounded-full bg-slate-800 text-slate-400 hover:text-slate-100 hover:bg-slate-700 transition cursor-pointer"
```
`newString`:
```tsx
          className="absolute top-5 right-5 p-1.5 min-w-11 min-h-11 flex items-center justify-center rounded-full bg-slate-800 text-slate-400 hover:text-slate-100 hover:bg-slate-700 transition cursor-pointer"
```

- [ ] **Step 4: Chip-Bonus-Buttons auf 44px (`RoundSummaryModal.tsx`)**

Beide Buttons (schwarz: `bg-slate-950 border-2 border-amber-400`, weiß: `bg-slate-100`) erhalten zusätzlich `min-h-[44px]` in ihrer `className` (Muster wie Task 5, Step 2).

- [ ] **Step 5: Run lint + build**

```bash
npm run lint
npm run build --workspace=frontend
```

Expected: beides grün.

- [ ] **Step 6: Run mobile + accessibility specs**

```bash
npm run test:e2e --workspace=frontend -- mobile-portrait
npm run test:e2e --workspace=frontend -- accessibility
```

Expected: beide PASS (Modal-A11y unverändert, Touch-Targets größer).

- [ ] **Step 7: Commit**

```bash
DEVELOPER_DIR=/Library/Developer/CommandLineTools git add frontend/src/App.tsx frontend/src/components/PlayerHand.tsx frontend/src/components/RulesModal.tsx frontend/src/components/RoundSummaryModal.tsx
DEVELOPER_DIR=/Library/Developer/CommandLineTools git commit -m "feat(responsive): dvh viewport, safe-area insets, 44px touch targets"
```

---

### Task 6b: Solo-Endspurt-Reserve (54px)

**Hintergrund:** Im Solo-Endspurt (alle anderen ausgestiegen) kommen auf Mobile
Banner (~30px) + „gesperrt“-Label (~24px) hinzu → `main` 575→629px, Overflow
auf 640px-Screens. Der `mobile-portrait`-Lauf flakt dadurch (adaptiver Tap =
Aussteigen). Das Label dupliziert die Banner-Aussage (gleiche Bedingung
`isMyTurn && isSoloEndspurt`), daher wird es auf Mobile ausgeblendet; der Rest
ist reine Spacing-Reserve — alle Änderungen nur unterhalb `sm:`.

**Files:**
- Modify: `frontend/src/components/DiscardPile.tsx`
- Modify: `frontend/src/components/PlayerHand.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/e2e/mobile-portrait.spec.ts` (deterministischer Solo-Test)
- Delete: `frontend/e2e/debug-heights.spec.ts` (nur Diagnose)
- Test: `frontend/e2e/mobile-portrait.spec.ts` mit `--repeat-each=4`

**Interfaces:**
- Consumes: Klassen aus Tasks 2–6 (exakte oldStrings unten).
- Produces: Solo-State passt auf 360×640.

- [ ] **Step 1: Duplikat-Label auf Mobile ausblenden (`DiscardPile.tsx`)**

`oldString`:
```tsx
            <span className="text-[11px] font-extrabold text-amber-400 bg-amber-950/80 px-2 py-0.5 rounded mt-1">
              Im Solo-Endspurt gesperrt
            </span>
```
`newString`:
```tsx
            <span className="hidden sm:inline text-[11px] font-extrabold text-amber-400 bg-amber-950/80 px-2 py-0.5 rounded mt-1">
              Im Solo-Endspurt gesperrt
            </span>
```

- [ ] **Step 2: Solo-Banner kompakt auf Mobile (`PlayerHand.tsx`)**

`oldString`:
```tsx
        <div className="text-xs font-extrabold px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-bounce">
```
`newString`:
```tsx
        <div className="text-[11px] sm:text-xs font-extrabold px-2 sm:px-3 py-0.5 sm:py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-bounce">
```

- [ ] **Step 3: Spacing-Reserven (jeweils nur Mobile-Basis, `sm:` unverändert)**

`DiscardPile.tsx`:
`oldString`: `<div className="flex items-center justify-center gap-4 sm:gap-12 my-auto py-2">`
`newString`: `<div className="flex items-center justify-center gap-4 sm:gap-12 my-auto py-1 sm:py-2">`

`App.tsx` (Gegner-Zeile):
`oldString`: `<div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6 pt-2">`
`newString`: `<div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6 pt-1 sm:pt-2">`

`App.tsx` (Header):
`oldString`: `pt-[max(0.625rem,env(safe-area-inset-top))] pb-2.5 bg-slate-950/80`
`newString`: `pt-[max(0.625rem,env(safe-area-inset-top))] pb-1.5 sm:pb-2.5 bg-slate-950/80`

`PlayerHand.tsx` (Steuerkopf):
`oldString`: `<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between`
`newString`: `<div className="flex flex-col gap-1 sm:gap-2 sm:flex-row sm:items-center sm:justify-between`

`PlayerHand.tsx` (Hand-Fächer):
`oldString`: `className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 py-2 px-2 max-w-4xl min-h-[110px] sm:min-h-[140px]"`
`newString`: `className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 py-1 sm:py-2 px-2 max-w-4xl min-h-[110px] sm:min-h-[140px]"`
- [ ] **Step 4: Deterministischen Solo-Test anhängen (`mobile-portrait.spec.ts`)**

Ans Dateiende anhängen (bestehende Helper wiederverwenden):

```ts
test('Solo-Endspurt passt ohne Scroll auf 360px-Breite', async ({
  browser,
}: {
  browser: Browser;
}) => {
  const ctxA = await browser.newContext(MOBILE);
  const ctxB = await browser.newContext(MOBILE);
  const alice = await ctxA.newPage();
  const bob = await ctxB.newPage();
  try {
    const code = await createRoomAs(alice, 'Solo-A');
    await joinRoomAs(bob, 'Solo-B', code);
    await alice.getByTestId('start-game-button').click();
    await expect(alice.getByTestId('player-hand')).toBeVisible();
    await expect(bob.getByTestId('player-hand')).toBeVisible();

    // Wer am Zug ist, steigt aus → Gegenseite ist im Solo-Endspurt
    // (Banner + gesperrte Stapel — der höchste Spiel-Screen).
    const active = (await alice.getByTestId('turn-indicator').isVisible()) ? alice : bob;
    const idle = active === alice ? bob : alice;
    await active.getByTestId('fold-button').click({ timeout: 5_000 });
    await active.waitForTimeout(1500);
    await expectNoVerticalScroll(active, 'solo-active');
    await expectNoVerticalScroll(idle, 'solo-idle');
  } finally {
    await ctxA.close();
    await ctxB.close();
  }
});
```

- [ ] **Step 5: Diagnose-Spec löschen**

```bash
rm frontend/e2e/debug-heights.spec.ts
```

- [ ] **Step 6: Run lint + build**

```bash
npm run lint
npm run build --workspace=frontend
```

Expected: beides grün.

- [ ] **Step 7: Run mobile spec mehrfach + Desktop-Parität**

```bash
npm run test:e2e --workspace=frontend -- mobile-portrait --repeat-each=4
npm run test:e2e --workspace=frontend -- round-flow
npm run test:e2e --workspace=frontend -- accessibility
```

Expected: alles PASS (Solo-Test deterministisch grün, adaptiver Test ohne Flake über 4 Läufe).

- [ ] **Step 8: Commit**

```bash
DEVELOPER_DIR=/Library/Developer/CommandLineTools git add frontend/src/components/DiscardPile.tsx frontend/src/components/PlayerHand.tsx frontend/src/App.tsx frontend/e2e/mobile-portrait.spec.ts docs/superpowers/plans/2026-09-17-responsive-mobile-portrait.md
DEVELOPER_DIR=/Library/Developer/CommandLineTools git commit -m "feat(responsive): solo-endspurt fits 360px viewport, deterministic solo e2e"
```

---

### Task 7: Vollverifikation

**Files:**
- Keine Code-Änderung (nur Fixes falls rot).

**Interfaces:**
- Consumes: grüne Tasks 1–6.

- [ ] **Step 1: Lint**

```bash
npm run lint
```

Expected: grün (`biome ci .`).

- [ ] **Step 2: Build**

```bash
npm run build
```

Expected: grün (shared → frontend inkl. `tsc -b` über E2E-Specs → worker).

- [ ] **Step 3: Unit-Tests**

```bash
npm test
```

Expected: grün (keine `shared/`-Änderung, daher keine neuen Fälle nötig).

- [ ] **Step 4: Volle E2E-Suite**

```bash
npm run test:e2e
```

Expected: grün — `round-flow` (Desktop-Regression), `mobile-portrait` (neu, No-Scroll + Tap), `accessibility`, `pwa`.

- [ ] **Step 5: Push**

```bash
DEVELOPER_DIR=/Library/Developer/CommandLineTools git status --short
DEVELOPER_DIR=/Library/Developer/CommandLineTools git push
```

Nur pushen, wenn `git status --short` keine unerwarteten Dateien zeigt. Erwartet: keine offenen Änderungen (jeder Task wurde einzeln committet).

---

## Self-Review

1. **Spec coverage:** §1 Karten/Stapel → Task 2 (xs-Hand) + Task 3 (md-Stapel mit `sm:`-Restore). §2 Gegner/Steuerleiste → Task 4 (kompakte Opponents + Fan-Cap) + Task 5 (zweizeiliger Steuerkopf). §3 Viewport/Safe-Area/Touch → Task 6 (dvh, Safe-Area, 44px) + Task 5 (44px-Aktionsbuttons). §4 Testing → Task 1 (failing Spec) + Task 7 (volle Suite). Nicht-Ziele (Landscape, Fächer, Desktop-Redesign) kommen in keinem Task vor.
2. **Placeholder scan:** keine TBD/TODO-Platzhalter; jede Klassenänderung steht als exaktes old/new-Paar im Plan; jede Test-Erwartung nennt Befehl + erwartetes Ergebnis.
3. **Type consistency:** `size="xs"` wird in Task 2 an der `CardProps`-Union (`'xs' | 'sm' | 'md' | 'lg'`) eingeführt und nur dort/in Task 2 verwendet; Task 3 nutzt das bestehende `size="md"`; Helper-Namen (`expectNoVerticalScroll`, `createRoomAs`, `joinRoomAs`) sind in Task 1 definiert und werden nur innerhalb derselben Datei verwendet.
