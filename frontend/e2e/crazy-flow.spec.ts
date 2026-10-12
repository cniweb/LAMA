import { expect, type Page, test } from '@playwright/test';

/**
 * Crazy Edition: Variante bei Raum-Erstellung wählen, Lobby-Badge prüfen,
 * Partie starten und je 6 Handkarten + Crazy-Badge im Spiel prüfen.
 * Die exakte Regel-Mathematik (goldenes Lama, Skip/Draw-Two/Gift, Wertung)
 * ist durch Vitest-Unit-Tests in shared/tests/crazy.test.ts abgedeckt.
 */

async function createCrazyRoomAs(page: Page, playerName: string): Promise<string> {
  await page.goto('/');
  await page.getByLabel('Dein Spielername').fill(playerName);
  await page.getByTestId('variant-option-crazy').click({ force: true });
  await page.getByRole('button', { name: 'Neues Spiel erstellen' }).click();
  const roomCode = page.getByTestId('room-code');
  await expect(roomCode).toBeVisible();
  const code = ((await roomCode.textContent()) ?? '').trim();
  expect(code).toMatch(/^[A-HJ-NP-Z2-9]{4}$/);
  // Lobby zeigt die Crazy-Variante an
  await expect(page.getByText('Crazy Edition', { exact: false }).first()).toBeVisible();
  return code;
}

async function joinRoomAs(page: Page, playerName: string, roomCode: string): Promise<void> {
  await page.goto('/');
  await page.getByLabel('Dein Spielername').fill(playerName);
  await page.getByLabel('Raum-Code').fill(roomCode);
  await page.getByRole('button', { name: 'Raum beitreten' }).click();
  await expect(page.getByTestId('room-code')).toHaveText(roomCode);
}

test('crazy edition: raum erstellen, lobby-badge und rundenstart', async ({ browser }) => {
  const aliceCtx = await browser.newContext();
  const bobCtx = await browser.newContext();
  const alice = await aliceCtx.newPage();
  const bob = await bobCtx.newPage();

  try {
    const roomCode = await createCrazyRoomAs(alice, 'Alice');
    await joinRoomAs(bob, 'Bob', roomCode);

    await expect(alice.getByText('Bob')).toBeVisible();
    await alice.getByTestId('start-game-button').click();

    for (const p of [alice, bob]) {
      await expect(p.getByTestId('round-badge')).toHaveText('Durchgang 1');
      await expect(p.getByTestId('variant-badge')).toHaveText('🦙✨ Crazy');
      await expect(p.getByTestId('player-hand').locator('button')).toHaveCount(6);
    }
  } finally {
    await aliceCtx.close();
    await bobCtx.close();
  }
});
