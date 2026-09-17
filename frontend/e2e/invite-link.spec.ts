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

test('Link teilen ruft natives Sharing mit Einladungs-URL auf', async ({
  browser,
}: {
  browser: Browser;
}) => {
  const ctx = await browser.newContext();
  await ctx.addInitScript(() => {
    const w = window as unknown as { __sharedUrls: (string | undefined)[] };
    w.__sharedUrls = [];
    Object.defineProperty(window.navigator, 'share', {
      value: async (data?: ShareData): Promise<void> => {
        w.__sharedUrls.push(data?.url);
      },
      configurable: true,
    });
  });
  const host = await ctx.newPage();
  try {
    const code = await createRoomAs(host, 'Share-A');
    await host.getByRole('button', { name: 'Link teilen' }).click();
    const shared = await host.evaluate(
      () => (window as unknown as { __sharedUrls: string[] }).__sharedUrls
    );
    expect(shared).toHaveLength(1);
    expect(shared[0]).toContain(`?room=${code}`);
    await expect(host.getByRole('button', { name: 'Link kopieren' })).toBeVisible();
  } finally {
    await ctx.close();
  }
});
