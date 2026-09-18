import { describe, expect, it } from 'vitest';
import { createDeck } from '../src/deck.js';
import {
  addPlayerToRoom,
  calculateUniquePoints,
  canPlayCard,
  createInitialGameState,
  discardBonusChip,
  exchangeChipsUp,
  filterStateForClient,
  isPlusCard,
  playCard,
  pointsToChips,
  startRound,
  totalChipScore,
} from '../src/game-engine.js';

function setupPartyRound(): ReturnType<typeof startRound> {
  let state = createInitialGameState('PARTY', 'p1', 'party');
  state = addPlayerToRoom(state, 'p1', 'Alice');
  state = addPlayerToRoom(state, 'p2', 'Bob');
  state = startRound(state, 'p1');
  return state;
}

describe('Party Edition', () => {
  it('erzeugt 56 Karten: 7x 1-6, 6 Pluskarten, 7 Lamas, 1 pinkes Lama', () => {
    const deck = createDeck('party');
    expect(deck.length).toBe(56);
    for (let v = 1; v <= 6; v++) {
      expect(deck.filter((c) => c === v).length).toBe(7);
    }
    expect(deck.filter((c) => isPlusCard(c)).length).toBe(6);
    expect(deck.filter((c) => c === 'L').length).toBe(7);
    expect(deck.filter((c) => c === 'PL').length).toBe(1);
  });

  it('Pluskarte wird wie ihr Wert gelegt und gibt Extra-Zug', () => {
    expect(canPlayCard(2, '3+')).toBe(true);
    expect(canPlayCard(2, '2+')).toBe(true);
    expect(canPlayCard(2, '4+')).toBe(false);
    expect(canPlayCard('3+', 4)).toBe(true);
    expect(canPlayCard('3+', 3)).toBe(true);

    let state = setupPartyRound();
    state.discardPile = [2];
    state.players.p1.hand = ['3+', 5];
    state.players.p2.hand = [1, 2];
    state.turnIndex = 0;

    state = playCard(state, 'p1', '3+');
    // Gleicher Spieler nochmal am Zug (Extra-Zug), kein Rundenende
    expect(state.turnIndex).toBe(0);
    expect(state.discardPile[state.discardPile.length - 1]).toBe('3+');
    expect(state.players.p1.hand).toEqual([5]);
    expect(state.phase).toBe('IN_ROUND');
  });

  it('pinkes Lama passt überall; darauf nur Lama oder 1', () => {
    expect(canPlayCard(1, 'PL')).toBe(true);
    expect(canPlayCard(4, 'PL')).toBe(true);
    expect(canPlayCard('L', 'PL')).toBe(true);
    expect(canPlayCard('PL', 'L')).toBe(true);
    expect(canPlayCard('PL', 1)).toBe(true);
    expect(canPlayCard('PL', '1+')).toBe(true);
    expect(canPlayCard('PL', 2)).toBe(false);
    expect(canPlayCard('PL', 6)).toBe(false);
    expect(canPlayCard('PL', 'PL')).toBe(true);
  });

  it('Wertung: Plus zählt als Basiswert, PL macht Lama-Gruppe zu 20', () => {
    expect(calculateUniquePoints(['4+', 4, 4])).toBe(4);
    expect(calculateUniquePoints(['L', 'L'])).toBe(10);
    expect(calculateUniquePoints(['L', 'PL'])).toBe(20);
    expect(calculateUniquePoints(['L', 'L', 'PL', 2])).toBe(22);
    expect(calculateUniquePoints(['PL'])).toBe(20);
    expect(calculateUniquePoints(['1+', 2, 'L'])).toBe(13);
  });

  it('pointsToChips party: greedy pink/schwarz/weiß', () => {
    expect(pointsToChips(11, 'party')).toEqual({ white: 1, black: 1, pink: 0 });
    expect(pointsToChips(20, 'party')).toEqual({ white: 0, black: 0, pink: 1 });
    expect(pointsToChips(21, 'party')).toEqual({ white: 1, black: 0, pink: 1 });
    expect(pointsToChips(31, 'party')).toEqual({ white: 1, black: 1, pink: 1 });
    expect(totalChipScore({ white: 1, black: 1, pink: 1 })).toBe(31);
  });

  it('Bonus: pinker 20er-Chip kann zurückgegeben werden', () => {
    let state = setupPartyRound();
    state.players.p1.chips = { white: 0, black: 0, pink: 1 };
    state.players.p1.totalScore = 20;
    state.players.p1.hand = [3];
    state.players.p2.hand = [4];
    state.discardPile = [2];
    state.turnIndex = 0;

    state = playCard(state, 'p1', 3);
    expect(state.pendingChipDiscardPlayerId).toBe('p1');

    state = discardBonusChip(state, 'p1', 'pink');
    expect(state.players.p1.chips).toEqual({ white: 0, black: 0, pink: 0 });
    expect(state.players.p1.totalScore).toBe(0);
  });

  it('Tausch: 10 weiß -> schwarz, 2 schwarz -> pink (nur party)', () => {
    let state = setupPartyRound();
    state.players.p1.chips = { white: 10, black: 2, pink: 0 };
    state.players.p1.totalScore = 30;

    state = exchangeChipsUp(state, 'p1', 'white');
    expect(state.players.p1.chips).toEqual({ white: 0, black: 3, pink: 0 });

    state = exchangeChipsUp(state, 'p1', 'black');
    expect(state.players.p1.chips).toEqual({ white: 0, black: 1, pink: 1 });
    expect(state.players.p1.totalScore).toBe(30);

    // Classic verweigert pink-Tausch
    let classic = createInitialGameState('LAMA', 'p1', 'classic');
    classic = addPlayerToRoom(classic, 'p1', 'Alice');
    classic = addPlayerToRoom(classic, 'p2', 'Bob');
    classic.players.p1.chips = { white: 0, black: 2, pink: 0 };
    expect(() => exchangeChipsUp(classic, 'p1', 'black')).toThrow(/Party/);
  });

  it('startRound nutzt Party-Deck und erhält Variante', () => {
    const state = setupPartyRound();
    expect(state.variant).toBe('party');
    expect(state.drawPile.length).toBe(43);
    const view = filterStateForClient(state, 'p1');
    expect(view.variant).toBe('party');
  });

  it('Solo-Endspurt: Plus zählt als Basiswert (kein Doppel)', () => {
    let state = setupPartyRound();
    state.turnIndex = 0;
    state.players.p1.hand = [1];
    // p1 aussteigen lassen -> manuell falten via Engine
    state.players.p1.foldedHand = [1];
    state.players.p1.hand = [];
    state.players.p1.status = 'FOLDED';
    state.firstRoundExiterId = 'p1';
    state.soloDiscardedValues = [];
    state.turnIndex = 1;

    state.players.p2.hand = ['3+', 3, 4];
    state.discardPile = [2];
    state = playCard(state, 'p2', '3+');
    // Extra-Zug nach Plus bleibt bei p2 (Solo + Plus kombiniert)
    expect(state.turnIndex).toBe(1);
    // Normale 3 danach im Solo blockiert (gleicher Basiswert)
    expect(() => playCard(state, 'p2', 3)).toThrow(/bereits abgelegt/);
  });
});
