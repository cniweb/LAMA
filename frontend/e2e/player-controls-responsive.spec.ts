import type { ClientRoomView, GameVariant } from '@lama/shared';
import { type Browser, expect, type Page, test } from '@playwright/test';

const ROOM_CODE_PATTERN = /^[A-HJ-NP-Z2-9]{4}$/;
const VIEWPORTS = [320, 390, 1280] as const;

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

async function expectCompactControls(page: Page, label: string): Promise<void> {
  const metrics = await page.getByTestId('controls-bar').evaluate((bar) => {
    const chipsRow = bar.querySelector('[data-testid="chips-status-row"]');
    const statusRow = bar.querySelector('[data-testid="turn-status-row"]');
    if (!(chipsRow instanceof HTMLElement) || !(statusRow instanceof HTMLElement)) {
      throw new Error('Expected two status rows inside controls-bar.');
    }
    return {
      barHeight: bar.getBoundingClientRect().height,
      scrollWidth: bar.scrollWidth,
      clientWidth: bar.clientWidth,
      chipsHeight: chipsRow.getBoundingClientRect().height,
      statusHeight: statusRow.getBoundingClientRect().height,
    };
  });

  expect(metrics.barHeight, `${label}: fixed bar height`).toBe(96);
  expect(metrics.chipsHeight, `${label}: chip row height`).toBe(44);
  expect(metrics.statusHeight, `${label}: status row height`).toBe(44);
  expect(metrics.scrollWidth, `${label}: no horizontal bar overflow`).toBeLessThanOrEqual(
    metrics.clientWidth
  );
  await expect(page.locator('html')).toHaveJSProperty(
    'scrollWidth',
    await page.evaluate(() => innerWidth)
  );
}

function createClientState(
  phase: ClientRoomView['phase'],
  isTurn: boolean,
  pendingChipDiscardPlayerId: string | null = null,
  variant: GameVariant = 'party'
): ClientRoomView {
  return {
    roomCode: 'TEST',
    hostId: 'player-1',
    variant,
    isHost: true,
    phase,
    roundNumber: 3,
    myPlayer: {
      id: 'player-1',
      name: 'Tausch-A',
      chips: { white: 10, black: 2, pink: 1 },
      totalScore: 50,
      hand: [1, 2, 3, 4, 5, 6],
      status: 'ACTIVE',
      isTurn,
      validPlays: [1],
      canDraw: isTurn,
      canFold: isTurn,
    },
    opponents: [
      {
        id: 'player-2',
        name: 'Tausch-B',
        chips: { white: 0, black: 0, pink: 0 },
        totalScore: 0,
        cardCount: 6,
        status: 'ACTIVE',
        connected: true,
        isTurn: false,
      },
    ],
    topDiscardCard: 2,
    discardPileCount: 1,
    drawPileCount: 40,
    isSoloEndspurt: false,
    soloDiscardedValues: null,
    nextRoundReadyPlayerIds: [],
    pendingChipDiscardPlayerId,
    lastRoundSummary: [
      {
        playerId: 'player-1',
        playerName: 'Tausch-A',
        cards: [1, 2, 3],
        uniquePoints: 6,
        chipsAdded: { white: 6, black: 0, pink: 0 },
        totalScoreAfterRound: 50,
      },
    ],
    winners: null,
  };
}

async function openMockRoom(page: Page, state: ClientRoomView): Promise<void> {
  await page.addInitScript((initialState: ClientRoomView) => {
    window.localStorage.setItem('lama_player_name', initialState.myPlayer.name);
    window.localStorage.setItem('lama_session_id', 'controls-test-session');

    class MockWebSocket {
      static readonly CONNECTING = 0;
      static readonly OPEN = 1;
      static readonly CLOSING = 2;
      static readonly CLOSED = 3;

      readonly url: string;
      readyState = MockWebSocket.CONNECTING;
      onopen: ((event: Event) => void) | null = null;
      onmessage: ((event: MessageEvent) => void) | null = null;
      onclose: ((event: CloseEvent) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;
      private currentState = structuredClone(initialState);

      constructor(url: string) {
        this.url = url;
        setTimeout(() => {
          this.readyState = MockWebSocket.OPEN;
          this.onopen?.(new Event('open'));
          this.emitState();
        }, 0);
      }

      send(rawMessage: string): void {
        const message = JSON.parse(rawMessage) as { type: string; from?: string };
        if (message.type !== 'EXCHANGE_CHIPS') return;

        const chips = this.currentState.myPlayer.chips;
        if (message.from === 'white' && chips.white >= 10) {
          chips.white -= 10;
          chips.black += 1;
        } else if (message.from === 'black' && chips.black >= 2) {
          chips.black -= 2;
          chips.pink += 1;
        }
        this.currentState.myPlayer.totalScore = chips.white + chips.black * 10 + chips.pink * 20;
        this.emitState();
      }

      close(): void {
        this.readyState = MockWebSocket.CLOSED;
      }

      private emitState(): void {
        this.onmessage?.({
          data: JSON.stringify({ type: 'STATE_UPDATE', state: this.currentState }),
        } as MessageEvent);
      }
    }

    window.WebSocket = MockWebSocket as unknown as typeof WebSocket;
  }, state);
  await page.goto('/?room=TEST');
  await expect(page.getByTestId('controls-bar')).toBeVisible();
}

test('Spiel-Steuerleiste bleibt zweizeilig und bedienbar bei 320, 390 und 1280px', async ({
  browser,
}: {
  browser: Browser;
}) => {
  const ctxA = await browser.newContext({ viewport: { width: 320, height: 760 } });
  const ctxB = await browser.newContext({ viewport: { width: 320, height: 760 } });
  const alice = await ctxA.newPage();
  const bob = await ctxB.newPage();

  try {
    const roomCode = await createRoomAs(alice, 'Status-A');
    await joinRoomAs(bob, 'Status-B', roomCode);
    await alice.getByTestId('start-game-button').click();
    await expect(alice.getByTestId('player-hand')).toBeVisible();
    await expect(bob.getByTestId('player-hand')).toBeVisible();

    const active = (await alice.getByTestId('turn-indicator').isVisible()) ? alice : bob;
    const waiting = active === alice ? bob : alice;
    await expect(active.getByTestId('fold-button')).toBeVisible();
    await expect(waiting.getByTestId('turn-status-row')).toContainText('Warten auf Mitspieler');

    for (const width of VIEWPORTS) {
      await active.setViewportSize({ width, height: 760 });
      await waiting.setViewportSize({ width, height: 760 });
      await expectCompactControls(active, `am Zug bei ${width}px`);
      await expectCompactControls(waiting, `wartend bei ${width}px`);
    }

    await active.getByTestId('fold-button').click({ timeout: 5_000 });
    await expect(waiting.getByTestId('turn-indicator')).toBeVisible();
    await expect(active.getByTestId('turn-status-row')).toContainText('Du bist ausgestiegen');
    for (const width of VIEWPORTS) {
      await active.setViewportSize({ width, height: 760 });
      await expectCompactControls(active, `ausgestiegen bei ${width}px`);
    }
    await expect(waiting.getByTestId('fold-button')).toBeVisible();
    await waiting.getByTestId('fold-button').click({ timeout: 5_000 });

    const summary = active.getByTestId('round-summary');
    await expect(summary).toBeVisible();
    await expect(summary.getByTestId('round-summary-chip-controls')).toBeVisible();
    for (const page of [active, waiting]) {
      for (const width of VIEWPORTS) {
        await page.setViewportSize({ width, height: 760 });
        await expect(page.getByTestId('round-summary-chip-controls')).toBeVisible();
        const dimensions = await page.evaluate(() => ({
          documentWidth: document.documentElement.scrollWidth,
          viewportWidth: window.innerWidth,
        }));
        expect(dimensions.documentWidth, `summary modal at ${width}px`).toBeLessThanOrEqual(
          dimensions.viewportWidth
        );
      }
    }
  } finally {
    await ctxA.close();
    await ctxB.close();
  }
});

test('Spielende nennt die variantenspezifische Punkteschwelle', async ({ browser }) => {
  for (const [variant, threshold] of [
    ['crazy', 60],
    ['classic', 40],
  ] as const) {
    const page = await browser.newPage();
    try {
      await openMockRoom(page, createClientState('GAME_OVER', false, null, variant));
      const gameOverMessage = page.getByText(
        `Mindestens ein Spieler hat ${threshold} Minuspunkte erreicht.`
      );
      for (const width of VIEWPORTS) {
        await page.setViewportSize({ width, height: 760 });
        await expect(gameOverMessage).toBeVisible();
        const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
        expect(documentWidth, `${variant} Spielende bei ${width}px`).toBeLessThanOrEqual(width);
        await page.screenshot({ path: `test-results/game-over-${variant}-${width}.png` });
      }
    } finally {
      await page.close();
    }
  }
});

test('Chiptausch ist nur am Zug oder während der eigenen Wertung verfügbar', async ({ page }) => {
  await openMockRoom(page, createClientState('IN_ROUND', false));
  const controls = page.getByTestId('controls-bar');
  await expect(controls.getByTestId('exchange-chips-button')).toHaveCount(0);
  await expect(controls.getByTestId('exchange-black-to-pink-button')).toHaveCount(0);
  await expect(page.getByTestId('turn-status-row')).toContainText('Warten auf Mitspieler');
});

test('Classic zeigt auch bei schwarzem Chipbestand keinen Pink-Tausch', async ({ page }) => {
  await openMockRoom(page, createClientState('IN_ROUND', true, null, 'classic'));
  await expect(
    page.getByTestId('controls-bar').getByTestId('exchange-black-to-pink-button')
  ).toHaveCount(0);
});

test('beide Chiptausch-Optionen passen am Zug auf 320, 390 und 1280px', async ({ page }) => {
  await openMockRoom(page, createClientState('IN_ROUND', true));
  const controls = page.getByTestId('controls-bar');

  for (const width of VIEWPORTS) {
    await page.setViewportSize({ width, height: 760 });
    await expectCompactControls(page, `beide Tauschaktionen bei ${width}px`);
    for (const button of [
      controls.getByTestId('exchange-chips-button'),
      controls.getByTestId('exchange-black-to-pink-button'),
    ]) {
      await expect(button).toBeVisible();
      const box = await button.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }
  }
  const whiteCount = controls.getByTestId('chip-count-white');
  await controls.getByTestId('exchange-chips-button').click();
  await expect(whiteCount).toHaveText('×0');
  const blackCount = controls.getByTestId('chip-count-black');
  const pinkCount = controls.getByTestId('chip-count-pink');
  await controls.getByTestId('exchange-black-to-pink-button').click();
  await expect(blackCount).toHaveText('×1');
  await expect(pinkCount).toHaveText('×2');
});

test('Chiptausch ist im Wertungsdialog und im Bonus-Chip-Dialog erreichbar', async ({ page }) => {
  await openMockRoom(page, createClientState('ROUND_SUMMARY', false));
  const summary = page.getByTestId('round-summary');
  const summaryControls = summary.getByTestId('round-summary-chip-controls');
  await expect(summaryControls).toBeVisible();

  for (const width of VIEWPORTS) {
    await page.setViewportSize({ width, height: 760 });
    const dimensions = await summaryControls.evaluate((element) => ({
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
    }));
    expect(dimensions.scrollWidth, `summary chip row at ${width}px`).toBeLessThanOrEqual(
      dimensions.clientWidth
    );
  }
  const whiteCount = summaryControls.getByTestId('chip-count-white');
  await summaryControls.getByTestId('exchange-chips-button').click();
  await expect(whiteCount).toHaveText('×0');

  const pendingPage = await page.context().newPage();
  await openMockRoom(pendingPage, createClientState('IN_ROUND', false, 'player-1'));
  await expect(pendingPage.getByTestId('round-summary')).toBeVisible();
  await expect(
    pendingPage.getByTestId('round-summary-chip-controls').getByTestId('exchange-chips-button')
  ).toBeVisible();
  await pendingPage.close();
});
