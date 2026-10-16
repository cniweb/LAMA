import { describe, expect, it } from 'vitest';
import { CRAZY_ACTION_COPIES, CRAZY_DRAW_TWO_COPIES, createDeck } from '../src/deck.js';
import {
  addPlayerToRoom,
  calculateUniquePoints,
  canPlayCard,
  createInitialGameState,
  exchangeChipsUp,
  fewestCardsActivePlayerId,
  filterStateForClient,
  highestHandCard,
  isActionCard,
  isDrawTwoCard,
  isGiftCard,
  isGoldenLlama,
  isSkipCard,
  playCard,
  pointsToChips,
  startRound,
} from '../src/game-engine.js';

function setupCrazyRound(playerIds: string[] = ['p1', 'p2']): ReturnType<typeof startRound> {
  let state = createInitialGameState('CRZY', playerIds[0], 'crazy');
  for (const [i, id] of playerIds.entries()) {
    state = addPlayerToRoom(state, id, `Spieler ${i + 1}`);
  }
  state = startRound(state, playerIds[0]);
  return state;
}

describe('Crazy Edition – Deck', () => {
  it('erzeugt 65 Karten: Party-Basis + 1x GL + 2x SK + 4x D2 + 2x GF', () => {
    const deck = createDeck('crazy');
    expect(deck.length).toBe(65);
    for (let v = 1; v <= 6; v++) {
      expect(deck.filter((c) => c === v).length).toBe(7);
    }
    expect(deck.filter((c) => typeof c === 'string' && c.endsWith('+')).length).toBe(6);
    expect(deck.filter((c) => c === 'L').length).toBe(7);
    expect(deck.filter((c) => c === 'PL').length).toBe(1);
    expect(deck.filter((c) => c === 'GL').length).toBe(1);
    expect(deck.filter((c) => c === 'SK').length).toBe(CRAZY_ACTION_COPIES);
    expect(deck.filter((c) => c === 'D2').length).toBe(CRAZY_DRAW_TWO_COPIES);
    expect(deck.filter((c) => c === 'GF').length).toBe(CRAZY_ACTION_COPIES);
  });

  it('Classic/Party-Decks bleiben unverändert', () => {
    expect(createDeck('classic').length).toBe(56);
    expect(createDeck('party').length).toBe(56);
  });
});

describe('Crazy Edition – Prädikate', () => {
  it('erkennt goldenes Lama und Aktionskarten', () => {
    expect(isGoldenLlama('GL')).toBe(true);
    expect(isSkipCard('SK')).toBe(true);
    expect(isDrawTwoCard('D2')).toBe(true);
    expect(isGiftCard('GF')).toBe(true);
    expect(isActionCard('SK')).toBe(true);
    expect(isActionCard('D2')).toBe(true);
    expect(isActionCard('GF')).toBe(true);
    expect(isActionCard('GL')).toBe(false);
    expect(isActionCard('L')).toBe(false);
  });
});

describe('Crazy Edition – Legeregeln', () => {
  it('goldenes Lama ist immer legbar und als Reset-Top beliebig überlegbar', () => {
    expect(canPlayCard(3, 'GL')).toBe(true);
    expect(canPlayCard('L', 'GL')).toBe(true);
    expect(canPlayCard('PL', 'GL')).toBe(true);
    // Auf GL (Reset) darf eine beliebige Karte folgen.
    expect(canPlayCard('GL', 1)).toBe(true);
    expect(canPlayCard('GL', 6)).toBe(true);
    expect(canPlayCard('GL', 'L')).toBe(true);
    expect(canPlayCard('GL', 'SK')).toBe(true);
  });

  it('Aktionskarten SK/D2/GF immer legbar und als Top beliebig überlegbar', () => {
    for (const action of ['SK', 'D2', 'GF'] as const) {
      expect(canPlayCard(4, action)).toBe(true);
      expect(canPlayCard('L', action)).toBe(true);
      // Als oberste Karte ist die Folgekarte beliebig (zahllos).
      expect(canPlayCard(action, 2)).toBe(true);
      expect(canPlayCard(action, 6)).toBe(true);
      expect(canPlayCard(action, 'L')).toBe(true);
    }
  });

  it('Classic/Party-Legeregeln bleiben unverändert (Regression)', () => {
    expect(canPlayCard(3, 4)).toBe(true);
    expect(canPlayCard(3, 5)).toBe(false);
    expect(canPlayCard(6, 'L')).toBe(true);
    expect(canPlayCard('L', 1)).toBe(true);
    expect(canPlayCard(1, 'PL')).toBe(true);
    expect(canPlayCard('PL', 2)).toBe(false);
  });
});

describe('Crazy Edition – Wertung', () => {
  it('Lama-Gruppe zählt nur die höchste Stufe: GL=30 > PL=20 > L=10', () => {
    expect(calculateUniquePoints(['GL', 'L', 'PL'])).toBe(30);
    expect(calculateUniquePoints(['PL', 'L'])).toBe(20);
    expect(calculateUniquePoints(['L', 'L'])).toBe(10);
    expect(calculateUniquePoints(['GL', 2, 3])).toBe(35);
  });

  it('Aktionskarten SK/D2/GF zählen 0 Punkte', () => {
    expect(calculateUniquePoints(['SK', 'D2', 'GF', 4])).toBe(4);
    expect(calculateUniquePoints(['SK', 'D2', 'GF'])).toBe(0);
  });

  it('pointsToChips/exchange: crazy nutzt pinke 20er-Chips', () => {
    expect(pointsToChips(30, 'crazy')).toEqual({ white: 0, black: 1, pink: 1 });
    expect(pointsToChips(20, 'crazy')).toEqual({ white: 0, black: 0, pink: 1 });

    let state = setupCrazyRound();
    state.players.p1.chips = { white: 0, black: 2, pink: 0 };
    state = exchangeChipsUp(state, 'p1', 'black');
    expect(state.players.p1.chips).toEqual({ white: 0, black: 0, pink: 1 });

    // Classic verweigert pink-Tausch weiterhin.
    let classic = createInitialGameState('LAMA', 'p1', 'classic');
    classic = addPlayerToRoom(classic, 'p1', 'Alice');
    classic = addPlayerToRoom(classic, 'p2', 'Bob');
    classic.players.p1.chips = { white: 0, black: 2, pink: 0 };
    expect(() => exchangeChipsUp(classic, 'p1', 'black')).toThrow();
  });
});

describe('Crazy Edition – Skip & Draw-Two', () => {
  it('Skip überspringt den nächsten aktiven Spieler (3 Spieler)', () => {
    let state = setupCrazyRound(['p1', 'p2', 'p3']);
    state.turnIndex = 0;
    state.discardPile = [3];
    state.players.p1.hand = ['SK', 2];
    state.players.p2.hand = [1];
    state.players.p3.hand = [4];

    state = playCard(state, 'p1', 'SK');
    // p2 wird übersprungen -> p3 ist am Zug.
    expect(state.playerOrder[state.turnIndex]).toBe('p3');
  });

  it('Draw-Two gibt dem nächsten Spieler 2 Karten und setzt ihn aus', () => {
    let state = setupCrazyRound(['p1', 'p2', 'p3']);
    state.turnIndex = 0;
    state.discardPile = [3];
    state.players.p1.hand = ['D2', 2];
    state.players.p2.hand = [1];
    state.players.p3.hand = [4];
    const before = state.players.p2.hand.length;
    const pileBefore = state.drawPile.length;

    state = playCard(state, 'p1', 'D2');
    expect(state.players.p2.hand.length).toBe(before + 2);
    expect(state.drawPile.length).toBe(pileBefore - 2);
    // p2 setzt aus -> p3 ist am Zug.
    expect(state.playerOrder[state.turnIndex]).toBe('p3');
  });

  it('Draw-Two zieht best effort bei knappem Stapel (nur 1 Karte)', () => {
    let state = setupCrazyRound(['p1', 'p2', 'p3']);
    state.turnIndex = 0;
    state.discardPile = [3];
    state.drawPile = [5]; // nur 1 Karte verfügbar
    state.players.p1.hand = ['D2', 2];
    state.players.p2.hand = [1];
    state.players.p3.hand = [4];

    state = playCard(state, 'p1', 'D2');
    expect(state.players.p2.hand.length).toBe(2); // 1 + 1 gezogen
    expect(state.drawPile.length).toBe(0);
    expect(state.playerOrder[state.turnIndex]).toBe('p3');
  });

  it('Draw-Two im Solo-Endspurt verpufft (keine fremde Hand verändert)', () => {
    let state = setupCrazyRound(['p1', 'p2']);
    state.turnIndex = 0;
    state.discardPile = [3];
    // p2 ist ausgestiegen -> p1 im Solo-Endspurt.
    state.players.p2.status = 'FOLDED';
    state.players.p2.foldedHand = [1];
    state.players.p2.hand = [];
    state.firstRoundExiterId = 'p2';
    state.soloDiscardedValues = [];
    state.players.p1.hand = ['D2', 2];
    const pileBefore = state.drawPile.length;

    state = playCard(state, 'p1', 'D2');
    expect(state.drawPile.length).toBe(pileBefore); // nichts gezogen
    expect(state.players.p2.foldedHand).toEqual([1]); // fremde Hand unverändert
  });
});

describe('Crazy Edition – Gift', () => {
  it('Gift gibt die höchste Karte an den Spieler mit den wenigsten Karten', () => {
    let state = setupCrazyRound(['p1', 'p2', 'p3']);
    state.turnIndex = 0;
    state.discardPile = [3];
    state.players.p1.hand = ['GF', 'L', 2]; // höchste (ohne GF): L
    state.players.p2.hand = [1, 1, 1]; // 3 Karten
    state.players.p3.hand = [4]; // wenigste: 1 Karte

    state = playCard(state, 'p1', 'GF');
    // L wandert zu p3 (wenigste Karten).
    expect(state.players.p3.hand).toContain('L');
    expect(state.players.p1.hand).not.toContain('L');
    expect(state.players.p1.hand.length).toBe(1); // nur noch die 2
  });

  it('Gleichstand: nächster in Zugreihenfolge erhält die Karte', () => {
    let state = setupCrazyRound(['p1', 'p2', 'p3']);
    state.turnIndex = 0;
    state.discardPile = [3];
    state.players.p1.hand = ['GF', 5];
    state.players.p2.hand = [1]; // gleich wenige wie p3
    state.players.p3.hand = [4]; // gleich wenige wie p2

    state = playCard(state, 'p1', 'GF');
    // Ab p1 nächster -> p2 gewinnt den Gleichstand.
    expect(state.players.p2.hand.length).toBe(2);
    expect(state.players.p3.hand.length).toBe(1);
  });

  it('Gift im Solo verpufft (kein anderer aktiver Spieler)', () => {
    let state = setupCrazyRound(['p1', 'p2']);
    state.turnIndex = 0;
    state.discardPile = [3];
    state.players.p2.status = 'FOLDED';
    state.players.p2.foldedHand = [1];
    state.players.p2.hand = [];
    state.firstRoundExiterId = 'p2';
    state.soloDiscardedValues = [];
    state.players.p1.hand = ['GF', 5];

    state = playCard(state, 'p1', 'GF');
    expect(state.players.p1.hand).toEqual([5]); // nur GF abgelegt, nichts verschenkt
    expect(state.players.p2.foldedHand).toEqual([1]);
  });

  it('highestHandCard & fewestCardsActivePlayerId arbeiten korrekt', () => {
    expect(highestHandCard([2, 'L', 'GL', 4])).toBe('GL');
    expect(highestHandCard([2, 'L', 4])).toBe('L');
    expect(highestHandCard(['SK', 3])).toBe(3);
    expect(highestHandCard([])).toBeNull();

    const state = setupCrazyRound(['p1', 'p2', 'p3']);
    state.players.p2.hand = [1, 1];
    state.players.p3.hand = [4];
    expect(fewestCardsActivePlayerId(state, 'p1')).toBe('p3');
  });
});

describe('Crazy Edition – Client-View', () => {
  it('filterStateForClient zeigt crazy-Variante und legbare Aktionskarten', () => {
    const state = setupCrazyRound(['p1', 'p2']);
    state.turnIndex = 0;
    state.discardPile = [3];
    state.players.p1.hand = ['SK', 'GL', 5];

    const view = filterStateForClient(state, 'p1');
    expect(view.variant).toBe('crazy');
    expect(view.myPlayer.validPlays).toContain('SK');
    expect(view.myPlayer.validPlays).toContain('GL');
  });

  it('leakt keine fremden Hände', () => {
    const state = setupCrazyRound(['p1', 'p2']);
    const view = filterStateForClient(state, 'p1');
    for (const opp of view.opponents) {
      expect(opp).not.toHaveProperty('hand');
      expect(typeof opp.cardCount).toBe('number');
    }
  });
});
