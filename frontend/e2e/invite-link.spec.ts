import { type Browser, expect, type Page, test } from '@playwright/test';

const ROOM_CODE_PATTERN = /^[A-HJ-NP-Z2-9]{4}$/;

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

test('Einladungslink führt mit gespeichertem Namen direkt in die Lobby', async ({
  browser,
}: {
  browser: Browser;
}) => {
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  // Rückkehrender Spieler: Name bereits im localStorage.
  await ctxB.addInitScript(() => {
    window.localStorage.setItem('lama_player_name', 'Invite-B');
  });
  const alice = await ctxA.newPage();
  const bob = await ctxB.newPage();
  try {
    const code = await createRoomAs(alice, 'Invite-A');
    await bob.goto(`/?room=${code}`);
    await expect(bob.getByTestId('room-code')).toHaveText(code);
  } finally {
    await ctxA.close();
    await ctxB.close();
  }
});

test('Einladungslink füllt ohne gespeicherten Namen das Beitrittsformular vor', async ({
  browser,
}: {
  browser: Browser;
}) => {
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const alice = await ctxA.newPage();
  const bob = await ctxB.newPage();
  try {
    const code = await createRoomAs(alice, 'Invite-A');
    await bob.goto(`/?room=${code}`);
    await expect(bob.getByLabel('Raum-Code')).toHaveValue(code);
    await expect(bob.getByRole('button', { name: 'Neues Spiel erstellen' })).toBeHidden();
    await expect(bob.getByText('Einladung zum Raum')).toBeVisible();
    await bob.getByLabel('Dein Spielername').fill('Invite-B');
    await bob.getByRole('button', { name: 'Raum beitreten' }).click();
    await expect(bob.getByTestId('room-code')).toHaveText(code);
  } finally {
    await ctxA.close();
    await ctxB.close();
  }
});
