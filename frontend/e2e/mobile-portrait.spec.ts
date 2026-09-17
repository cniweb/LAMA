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
