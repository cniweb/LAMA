import { expect, type Locator, type Page, test } from '@playwright/test';

const ROOM_CODE_PATTERN = /^[A-HJ-NP-Z2-9]{4}$/;
const MAX_TURNS = 30;
const ADAPTIVE_TURNS = 8;

type Action = 'play' | 'draw' | 'fold';

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

function isSummaryVisible(page: Page): Promise<boolean> {
  return page.getByTestId('round-summary').isVisible();
}

/**
 * Seite des Spielers zurückgeben, der gerade am Zug ist (oder null bei Rundenende).
 * Die Abrechnung wird ZUERST geprüft: Ist die Runde irgendwo bereits beendet,
 * sind veraltete Turn-Indikatoren auf der langsameren Seite irrelevant.
 */
async function activePageOrNull(
  alice: Page,
  bob: Page,
  log: (msg: string) => void
): Promise<Page | null> {
  for (let i = 0; i < 200; i++) {
    const t0 = Date.now();
    const sum = (await isSummaryVisible(alice)) || (await isSummaryVisible(bob));
    if (sum) {
      return null;
    }
    const aTurn = await alice.getByTestId('turn-indicator').isVisible();
    if (aTurn) {
      return alice;
    }
    const bTurn = await bob.getByTestId('turn-indicator').isVisible();
    if (bTurn) {
      return bob;
    }
    if (i % 20 === 0) {
      log(`activePageOrNull: Iter ${i} wartet (${Date.now() - t0}ms Messung)`);
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Timeout: kein Spieler am Zug und keine Abrechnung sichtbar.');
}

/**
 * Wartet, bis der eigene Zug weitergegeben wurde (eigener Indikator weg oder
 * Abrechnung sichtbar). Verhindert Aktionen auf veraltetem UI-State, deren
 * Klicks sonst ewig auf einen inzwischen deaktivierten Button warten würden.
 */
async function waitForTurnPassed(
  page: Page,
  alice: Page,
  bob: Page,
  log: (msg: string) => void
): Promise<void> {
  for (let i = 0; i < 100; i++) {
    const t0 = Date.now();
    const sumA = await isSummaryVisible(alice);
    const sumB = await isSummaryVisible(bob);
    if (sumA || sumB) {
      log(`waitForTurnPassed: Abrechnung sichtbar (Iter ${i})`);
      return;
    }
    const ind = await page.getByTestId('turn-indicator').isVisible();
    if (!ind) {
      log(`waitForTurnPassed: Indikator weg (Iter ${i})`);
      return;
    }
    log(`waitForTurnPassed: Iter ${i} wartet (${Date.now() - t0}ms Messung)`);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Timeout: Zug wurde nicht weitergegeben.');
}

/**
 * Klick mit ablaufendem Timeout: Gibt false zurück, wenn das Element nicht
 * (mehr) klickbar ist — typischerweise weil der beobachtete UI-State bereits
 * veraltet ist. Der Aufrufer beobachtet dann neu, statt ewig zu warten.
 */
async function tryClick(target: Locator): Promise<boolean> {
  try {
    await target.click({ timeout: 5_000 });
    return true;
  } catch {
    return false;
  }
}

/** Spielt auf der übergebenen Seite: passende Karte legen, sonst ziehen, sonst aussteigen. */
async function tryAdaptiveTurn(page: Page): Promise<Action | null> {
  const playable = page.getByTestId('player-hand').locator('button.card-playable');
  if ((await playable.count()) > 0) {
    return (await tryClick(playable.first())) ? 'play' : null;
  }
  if (await page.getByTestId('draw-button').isVisible()) {
    return (await tryClick(page.getByTestId('draw-button'))) ? 'draw' : null;
  }
  if (await page.getByTestId('fold-button').isVisible()) {
    return (await tryClick(page.getByTestId('fold-button'))) ? 'fold' : null;
  }
  return null;
}

function extractPoints(text: string, pattern: RegExp): number[] {
  return [...text.matchAll(pattern)].map((m) => Number(m[1]));
}

test('kompletter Spielablauf: Lobby, Runde, Rundenende und Punkteabrechnung', async ({
  browser,
}) => {
  // Zwei getrennte Kontexte = zwei Spieler (eigene localStorage/sessionId).
  const aliceCtx = await browser.newContext();
  const bobCtx = await browser.newContext();
  const alice = await aliceCtx.newPage();
  const bob = await bobCtx.newPage();

  try {
    // --- Lobby: Raum erstellen & beitreten ---
    const roomCode = await createRoomAs(alice, 'Alice');
    await joinRoomAs(bob, 'Bob', roomCode);

    // Host sieht den Mitspieler und startet die Partie (mind. 2 Spieler nötig).
    await expect(alice.getByText('Bob')).toBeVisible();
    await alice.getByTestId('start-game-button').click();

    // --- Runde 1 beginnt auf beiden Seiten, je 6 Handkarten ---
    for (const p of [alice, bob]) {
      await expect(p.getByTestId('round-badge')).toHaveText('Durchgang 1');
      await expect(p.getByTestId('player-hand').locator('button')).toHaveCount(6);
    }

    // --- Spielphase: erst Karten legen/ziehen, dann aussteigen lassen ---
    // Die Runde kann auf zwei Wegen enden: Alle steigen aus, oder ein Spieler
    // legt alle Karten ab (dann folgt der Chip-Rückgabe-Bonus). Beides wird
    // unten abgearbeitet.
    const actions: Action[] = [];
    const started = Date.now();
    const log = (msg: string) => console.log(`[e2e +${Date.now() - started}ms] ${msg}`);
    for (let turn = 0; turn < MAX_TURNS; turn++) {
      const active = await activePageOrNull(alice, bob, log);
      if (active === null) {
        log(`Zug ${turn}: Rundenende erkannt`);
        break;
      }
      const name = active === alice ? 'Alice' : 'Bob';
      let action: Action | null;
      if (actions.length < ADAPTIVE_TURNS) {
        action = await tryAdaptiveTurn(active);
      } else if (await active.getByTestId('fold-button').isVisible()) {
        action = (await tryClick(active.getByTestId('fold-button'))) ? 'fold' : null;
      } else {
        action = null;
      }
      if (action === null) {
        log(`Zug ${turn}: veralteter State bei ${name}, beobachte neu`);
        continue;
      }
      actions.push(action);
      log(`Zug ${turn}: ${name} -> ${action}`);
      await waitForTurnPassed(active, alice, bob, log);
    }
    expect(actions).toContain('fold');

    // --- Rundenende: Abrechnung für beide sichtbar ---
    const summary = alice.getByTestId('round-summary');
    await expect(summary).toBeVisible({ timeout: 15_000 });
    log('Abrechnung auf Alice Seite sichtbar');
    await expect(bob.getByTestId('round-summary')).toBeVisible();
    await expect(summary.getByText('Durchgang 1 beendet')).toBeVisible();
    await expect(summary.getByText('Alice')).toBeVisible();
    await expect(summary.getByText('Bob')).toBeVisible();
    log('Abrechnungs-Header geprüft');

    // Chip-Rückgabe, falls jemand alle Karten abgelegt hat (Bonus-Flow).
    // Der Dialog erscheint nur auf der Seite des Spielers, der leer gespielt
    // hat und noch Chips besitzt.
    let bonusReturned = 0;
    for (const [page, name] of [
      [alice, 'Alice'],
      [bob, 'Bob'],
    ] as const) {
      const modal = page.getByTestId('round-summary');
      if (await modal.getByTestId('discard-black-chip').isVisible()) {
        await modal.getByTestId('discard-black-chip').click({ timeout: 15_000 });
        bonusReturned = 10;
        log(`${name} gibt schwarzen Chip zurück (-10)`);
        break;
      }
      if (await modal.getByTestId('discard-white-chip').isVisible()) {
        await modal.getByTestId('discard-white-chip').click({ timeout: 15_000 });
        bonusReturned = 1;
        log(`${name} gibt weißen Chip zurück (-1)`);
        break;
      }
    }

    // Punkteabrechnung prüfen: In Runde 1 starten alle bei 0 Chips, daher
    // entspricht die Summe der Gesamtpunkte exakt der Summe der Rundenpunkte
    // minus einem eventuell zurückgegebenen Bonus-Chip.
    const summaryText = (await summary.textContent()) ?? '';
    const gained = extractPoints(summaryText, /\+(\d+) Pkt\./g);
    const totals = extractPoints(summaryText, /Gesamt: (\d+) Pkt\./g);
    expect(gained).toHaveLength(2);
    expect(totals).toHaveLength(2);
    const sum = (ns: number[]) => ns.reduce((a, b) => a + b, 0);
    expect(sum(totals)).toBe(sum(gained) - bonusReturned);
    for (const total of totals) {
      expect(total).toBeGreaterThanOrEqual(0);
    }
    expect(gained.some((g) => g > 0)).toBe(true);
    if (bonusReturned > 0) {
      await expect(summary.getByText(`-${bonusReturned} Chip-Bonus!`)).toBeVisible();
    }
    log(`Abrechnung geprüft: +${gained.join('/+')} => ${totals.join('/')}, Bonus ${bonusReturned}`);

    // --- Nächster Durchgang startet auf beiden Seiten mit vollen Händen ---
    await summary.getByTestId('next-round-button').click({ timeout: 15_000 });
    log('Nächsten Durchgang gestartet');
    for (const p of [alice, bob]) {
      await expect(p.getByTestId('round-badge')).toHaveText('Durchgang 2');
      await expect(p.getByTestId('player-hand').locator('button')).toHaveCount(6);
      await expect(p.getByTestId('round-summary')).toHaveCount(0);
    }
  } finally {
    await aliceCtx.close();
    await bobCtx.close();
  }
});
