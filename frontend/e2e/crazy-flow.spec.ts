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

    await alice.getByTitle('Spielregeln ansehen').click();
    const rules = alice.getByRole('dialog');
    await expect(rules).toContainText('zählen je 15 Minuspunkte pro Karte');
    await expect(rules).toContainText('Jeder normale Kartenwert zählt nur einmal');
    await expect(rules).toContainText('60 Minuspunkte');
    const crazyBadge = rules.getByText('🦙✨ Crazy', { exact: true });
    const rulesTitle = rules.getByRole('heading', { name: 'LAMA Spielregeln' });
    const headerIcon = rules.locator('svg').first();
    const closeButton = rules.getByRole('button', { name: 'Regeln schließen' });
    for (const width of [320, 390, 1280]) {
      await alice.setViewportSize({ width, height: 800 });
      await expect(rules).toBeVisible();
      const documentWidth = await alice.evaluate(() => document.documentElement.scrollWidth);
      expect(documentWidth, `Crazy-Regeln bei ${width}px`).toBeLessThanOrEqual(width);

      const badgeBox = await crazyBadge.boundingBox();
      const closeBox = await closeButton.boundingBox();
      if (!badgeBox || !closeBox) {
        throw new Error(`Expected visible badge and close button at ${width}px.`);
      }
      const titleBox = await rulesTitle.boundingBox();
      const iconBox = await headerIcon.boundingBox();
      if (!titleBox || !iconBox) {
        throw new Error(`Expected visible title and icon at ${width}px.`);
      }
      const iconAndTitleShareRow =
        titleBox.y < iconBox.y + iconBox.height && titleBox.y + titleBox.height > iconBox.y;
      expect(iconAndTitleShareRow, `Titel-Icon-Zeile bei ${width}px`).toBe(true);

      const overlaps =
        badgeBox.x < closeBox.x + closeBox.width &&
        badgeBox.x + badgeBox.width > closeBox.x &&
        badgeBox.y < closeBox.y + closeBox.height &&
        badgeBox.y + badgeBox.height > closeBox.y;
      expect(overlaps, `Crazy-Badge überlappt den Schließen-Button bei ${width}px`).toBe(false);

      await alice.screenshot({ path: `test-results/crazy-rules-${width}.png` });
    }
  } finally {
    await aliceCtx.close();
    await bobCtx.close();
  }
});
