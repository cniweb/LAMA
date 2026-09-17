import { expect, type Page, test } from '@playwright/test';

async function activeElementInDialog(page: Page): Promise<boolean> {
  return page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'));
}

test('Regel-Dialog: Fokus-Falle und Schließen per Escape', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Dein Spielername').fill('A11y');
  await page.getByRole('button', { name: 'Wie funktioniert das Spiel? (Regeln)' }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  // Initialfokus liegt im Dialog, Tab verlässt ihn nicht (Fokus-Falle).
  expect(await activeElementInDialog(page)).toBe(true);
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('Tab');
    expect(await activeElementInDialog(page)).toBe(true);
  }

  // Escape schließt den Dialog.
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
});

test('Live-Region kündigt den Spielzug an', async ({ browser }) => {
  const aliceCtx = await browser.newContext();
  const bobCtx = await browser.newContext();
  const alice = await aliceCtx.newPage();
  const bob = await bobCtx.newPage();

  try {
    await alice.goto('/');
    await alice.getByLabel('Dein Spielername').fill('Alice');
    await alice.getByRole('button', { name: 'Neues Spiel erstellen' }).click();
    const code = ((await alice.getByTestId('room-code').textContent()) ?? '').trim();

    await bob.goto('/');
    await bob.getByLabel('Dein Spielername').fill('Bob');
    await bob.getByLabel('Raum-Code').fill(code);
    await bob.getByRole('button', { name: 'Raum beitreten' }).click();

    await expect(alice.getByText('Bob')).toBeVisible();
    await alice.getByTestId('start-game-button').click();
    await expect(alice.getByTestId('round-badge')).toHaveText('Durchgang 1');

    const live = alice.locator('[aria-live="polite"]');
    await expect(live).not.toBeEmpty();
    await expect(live).toHaveText(/am Zug|Warte/);
  } finally {
    await aliceCtx.close();
    await bobCtx.close();
  }
});

test('Regel-Dialog funktioniert mit Reduced Motion', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  try {
    await page.goto('/');
    await page.getByLabel('Dein Spielername').fill('Motion');
    await page.getByRole('button', { name: 'Wie funktioniert das Spiel? (Regeln)' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  } finally {
    await ctx.close();
  }
});
