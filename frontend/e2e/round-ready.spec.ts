import { expect, type Page, test } from '@playwright/test';

const ROOM_CODE_PATTERN = /^[A-HJ-NP-Z2-9]{4}$/;

async function createRoomAs(page: Page): Promise<string> {
  await page.goto('/');
  await page.getByLabel('Dein Spielername').fill('Alice');
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

async function foldActivePlayerUntilSummary(pages: Page[]): Promise<void> {
  for (let turn = 0; turn < 10; turn++) {
    for (const page of pages) {
      if (await page.getByTestId('round-summary').isVisible()) return;
    }

    let activePage: Page | null = null;
    for (const page of pages) {
      if (await page.getByTestId('turn-indicator').isVisible()) {
        activePage = page;
        break;
      }
    }
    if (!activePage) {
      await expect
        .poll(async () => {
          for (const page of pages) {
            if (await page.getByTestId('round-summary').isVisible()) return true;
          }
          return false;
        })
        .toBe(true);
      return;
    }

    await activePage.getByTestId('fold-button').click({ timeout: 5_000 });
    await expect
      .poll(async () => {
        for (const page of pages) {
          if (await page.getByTestId('round-summary').isVisible()) return true;
        }
        return !(await activePage?.getByTestId('turn-indicator').isVisible());
      })
      .toBe(true);
  }
  await expect
    .poll(async () => {
      for (const page of pages) {
        if (await page.getByTestId('round-summary').isVisible()) return true;
      }
      return false;
    })
    .toBe(true);
}

test('three-player room waits for every player to confirm the next round', async ({ browser }) => {
  const contexts = await Promise.all([
    browser.newContext(),
    browser.newContext(),
    browser.newContext(),
  ]);
  const pages = await Promise.all(contexts.map((context) => context.newPage()));

  try {
    const roomCode = await createRoomAs(pages[0]);
    await joinRoomAs(pages[1], 'Bob', roomCode);
    await joinRoomAs(pages[2], 'Cara', roomCode);
    await expect(pages[0].getByText('Bob')).toBeVisible();
    await expect(pages[0].getByText('Cara')).toBeVisible();
    await pages[0].getByTestId('start-game-button').click();

    for (const page of pages) {
      await expect(page.getByTestId('round-badge')).toHaveText('Durchgang 1');
    }
    await foldActivePlayerUntilSummary(pages);
    for (const page of pages) await expect(page.getByTestId('round-summary')).toBeVisible();

    await pages[0].getByTestId('next-round-button').click();
    await expect(pages[0].getByTestId('next-round-waiting')).toContainText('1 von 3 bereit');
    for (const page of pages) {
      await expect(page.getByTestId('round-badge')).toHaveText('Durchgang 1');
      await expect(page.getByTestId('round-summary')).toBeVisible();
    }

    await pages[1].getByTestId('next-round-button').click();
    await expect(pages[1].getByTestId('next-round-waiting')).toContainText('2 von 3 bereit');
    for (const page of pages) {
      await expect(page.getByTestId('round-badge')).toHaveText('Durchgang 1');
      await expect(page.getByTestId('round-summary')).toBeVisible();
    }

    await pages[2].getByTestId('next-round-button').click();
    for (const page of pages) {
      await expect(page.getByTestId('round-badge')).toHaveText('Durchgang 2');
      await expect(page.getByTestId('player-hand').locator('button')).toHaveCount(6);
      await expect(page.getByTestId('round-summary')).toHaveCount(0);
    }
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});
