import { expect, type Page, test } from '@playwright/test';

/**
 * Party Edition: Variante bei Raum-Erstellung wählen, Lobby-Badge prüfen,
 * Partie starten und je 6 Handkarten + Party-Badge im Spiel prüfen.
 * Die exakte Regel-Mathematik (Plus-Extra-Zug, PL-Joker, 20er-Wertung)
 * ist durch Vitest-Unit-Tests in shared/tests/party.test.ts abgedeckt.
 */

async function createPartyRoomAs(page: Page, playerName: string): Promise<string> {
  await page.goto('/');
  await page.getByLabel('Dein Spielername').fill(playerName);
  await page.getByText('🎉 Party Edition').click();
  await page.getByRole('button', { name: 'Neues Spiel erstellen' }).click();
  const roomCode = page.getByTestId('room-code');
  await expect(roomCode).toBeVisible();
  const code = ((await roomCode.textContent()) ?? '').trim();
  expect(code).toMatch(/^[A-HJ-NP-Z2-9]{4}$/);
  // Lobby zeigt die Party-Variante an
  await expect(page.getByText('Party Edition', { exact: false }).first()).toBeVisible();
  return code;
}

async function joinRoomAs(page: Page, playerName: string, roomCode: string): Promise<void> {
  await page.goto('/');
  await page.getByLabel('Dein Spielername').fill(playerName);
  await page.getByLabel('Raum-Code').fill(roomCode);
  await page.getByRole('button', { name: 'Raum beitreten' }).click();
  await expect(page.getByTestId('room-code')).toHaveText(roomCode);
}

test('party edition: raum erstellen, lobby-badge und rundenstart', async ({ browser }) => {
  const aliceCtx = await browser.newContext();
  const bobCtx = await browser.newContext();
  const alice = await aliceCtx.newPage();
  const bob = await bobCtx.newPage();

  try {
    const roomCode = await createPartyRoomAs(alice, 'Alice');
    await joinRoomAs(bob, 'Bob', roomCode);

    await expect(alice.getByText('Bob')).toBeVisible();
    await alice.getByTestId('start-game-button').click();

    for (const p of [alice, bob]) {
      await expect(p.getByTestId('round-badge')).toHaveText('Durchgang 1');
      await expect(p.getByTestId('variant-badge')).toHaveText('🎉 Party');
      await expect(p.getByTestId('player-hand').locator('button')).toHaveCount(6);
    }
  } finally {
    await aliceCtx.close();
    await bobCtx.close();
  }
});
