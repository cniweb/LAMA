import { describe, expect, it } from 'vitest';
import { createDeck } from '../src/deck.js';
import {
  addPlayerToRoom,
  canPlayCard,
  createInitialGameState,
  discardBonusChip,
  drawCard,
  filterStateForClient,
  foldPlayer,
  isSoloEndspurt,
  playCard,
  startRound,
} from '../src/game-engine.js';

describe('LAMA Game Engine Rules', () => {
  describe('Card validity (canPlayCard)', () => {
    it('allows same value or +1 for numbers 1 to 5', () => {
      expect(canPlayCard(1, 1)).toBe(true);
      expect(canPlayCard(1, 2)).toBe(true);
      expect(canPlayCard(1, 3)).toBe(false);

      expect(canPlayCard(3, 3)).toBe(true);
      expect(canPlayCard(3, 4)).toBe(true);
      expect(canPlayCard(3, 2)).toBe(false);
      expect(canPlayCard(3, 5)).toBe(false);
    });

    it('handles special rules for 6 and Lama', () => {
      // On 6: 6 or Lama
      expect(canPlayCard(6, 6)).toBe(true);
      expect(canPlayCard(6, 'L')).toBe(true);
      expect(canPlayCard(6, 1)).toBe(false);
      expect(canPlayCard(6, 5)).toBe(false);

      // On Lama: Lama or 1
      expect(canPlayCard('L', 'L')).toBe(true);
      expect(canPlayCard('L', 1)).toBe(true);
      expect(canPlayCard('L', 2)).toBe(false);
      expect(canPlayCard('L', 6)).toBe(false);
    });
  });

  describe('Deck creation', () => {
    it('creates 56 cards with 8 copies of each value', () => {
      const deck = createDeck();
      expect(deck.length).toBe(56);
      expect(deck.filter((c) => c === 1).length).toBe(8);
      expect(deck.filter((c) => c === 6).length).toBe(8);
      expect(deck.filter((c) => c === 'L').length).toBe(8);
    });
  });

  describe('Lobby & Round Start', () => {
    it('creates room and adds players correctly', () => {
      let state = createInitialGameState('LAMA', 'p1');
      state = addPlayerToRoom(state, 'p1', 'Alice');
      state = addPlayerToRoom(state, 'p2', 'Bob');

      expect(state.playerOrder).toEqual(['p1', 'p2']);
      expect(state.players.p1.name).toBe('Alice');
      expect(state.players.p2.name).toBe('Bob');
      expect(state.phase).toBe('LOBBY');
    });

    it('starts round and deals 6 cards each', () => {
      let state = createInitialGameState('LAMA', 'p1');
      state = addPlayerToRoom(state, 'p1', 'Alice');
      state = addPlayerToRoom(state, 'p2', 'Bob');
      state = startRound(state, 'p1');

      expect(state.phase).toBe('IN_ROUND');
      expect(state.players.p1.hand.length).toBe(6);
      expect(state.players.p2.hand.length).toBe(6);
      expect(state.discardPile.length).toBe(1);
      // 56 total - 12 dealt - 1 discard = 43 in draw pile
      expect(state.drawPile.length).toBe(43);
      expect(state.turnIndex).toBe(0); // p1 starts
    });
  });

  describe('Turns: Play, Draw, Fold', () => {
    it('allows playing a card and advances turn', () => {
      let state = createInitialGameState('LAMA', 'p1');
      state = addPlayerToRoom(state, 'p1', 'Alice');
      state = addPlayerToRoom(state, 'p2', 'Bob');
      state = startRound(state, 'p1');

      // Set explicit cards for deterministic test
      state.discardPile = [2];
      state.players.p1.hand = [2, 4, 5];
      state.turnIndex = 0; // p1's turn

      state = playCard(state, 'p1', 2);
      expect(state.discardPile[state.discardPile.length - 1]).toBe(2);
      expect(state.players.p1.hand).toEqual([4, 5]);
      expect(state.turnIndex).toBe(1); // Now p2's turn
    });

    it('allows drawing a card when not in solo endspurt', () => {
      let state = createInitialGameState('LAMA', 'p1');
      state = addPlayerToRoom(state, 'p1', 'Alice');
      state = addPlayerToRoom(state, 'p2', 'Bob');
      state = startRound(state, 'p1');

      state.players.p1.hand = [1];
      state.turnIndex = 0;
      const initialDrawCount = state.drawPile.length;

      state = drawCard(state, 'p1');
      expect(state.players.p1.hand.length).toBe(2);
      expect(state.drawPile.length).toBe(initialDrawCount - 1);
      expect(state.turnIndex).toBe(1); // Now p2's turn
    });

    it('allows folding and initiates solo endspurt for remaining player', () => {
      let state = createInitialGameState('LAMA', 'p1');
      state = addPlayerToRoom(state, 'p1', 'Alice');
      state = addPlayerToRoom(state, 'p2', 'Bob');
      state = startRound(state, 'p1');

      state.turnIndex = 0;
      state.players.p1.hand = [3, 4];

      state = foldPlayer(state, 'p1');
      expect(state.players.p1.status).toBe('FOLDED');
      expect(state.players.p1.foldedHand).toEqual([3, 4]);
      expect(state.players.p1.hand).toEqual([]);

      // Bob (p2) is now the only active player -> Solo Endspurt!
      expect(isSoloEndspurt(state)).toBe(true);
      expect(state.turnIndex).toBe(1);

      // In Solo Endspurt, drawing is forbidden!
      expect(() => drawCard(state, 'p2')).toThrow(/Solo-Endspurt/);
    });

    it('ends round when player plays last card and awards chip return bonus', () => {
      let state = createInitialGameState('LAMA', 'p1');
      state = addPlayerToRoom(state, 'p1', 'Alice');
      state = addPlayerToRoom(state, 'p2', 'Bob');
      state = startRound(state, 'p1');

      // Alice has previously collected chips
      state.players.p1.chips = { white: 3, black: 1 };
      state.players.p1.totalScore = 13;
      state.players.p1.hand = [3];
      state.discardPile = [2];
      state.turnIndex = 0;

      // Bob has cards that will yield minus points
      state.players.p2.hand = [4, 4, 'L']; // 4 + 10 = 14 points

      state = playCard(state, 'p1', 3);

      // Hand is empty! Alice can return a chip
      expect(state.pendingChipDiscardPlayerId).toBe('p1');
      expect(state.players.p1.hand).toEqual([]);

      // Alice discards her black (10) chip!
      state = discardBonusChip(state, 'p1', 'black');
      expect(state.players.p1.chips).toEqual({ white: 3, black: 0 });
      expect(state.players.p1.totalScore).toBe(3);
      expect(state.pendingChipDiscardPlayerId).toBeNull();
      expect(state.phase).toBe('ROUND_SUMMARY');

      // Bob's points should be 14 (1 black, 4 white)
      expect(state.players.p2.chips).toEqual({ white: 4, black: 1 });
      expect(state.players.p2.totalScore).toBe(14);
    });

    it('ends game when a player reaches 40 minus points', () => {
      let state = createInitialGameState('LAMA', 'p1');
      state = addPlayerToRoom(state, 'p1', 'Alice');
      state = addPlayerToRoom(state, 'p2', 'Bob');
      state = startRound(state, 'p1');

      // Bob already has 35 points
      state.players.p2.chips = { white: 5, black: 3 };
      state.players.p2.totalScore = 35;
      state.players.p2.hand = ['L']; // +10 points -> 45 >= 40

      state.players.p1.hand = [2];
      state.discardPile = [1];
      state.turnIndex = 0;

      state = playCard(state, 'p1', 2);
      expect(state.phase).toBe('GAME_OVER');
      expect(state.winners).toEqual(['p1']);
    });
  });

  describe('Anti-Cheat State Masking (filterStateForClient)', () => {
    it('masks opponent hand cards and draw pile', () => {
      let state = createInitialGameState('LAMA', 'p1');
      state = addPlayerToRoom(state, 'p1', 'Alice');
      state = addPlayerToRoom(state, 'p2', 'Bob');
      state = startRound(state, 'p1');

      state.players.p1.hand = [1, 2];
      state.players.p2.hand = [5, 6, 'L'];

      const view = filterStateForClient(state, 'p1');
      expect(view.myPlayer.hand).toEqual([1, 2]);
      expect(view.opponents[0].cardCount).toBe(3);
      // @ts-expect-error opp should not expose hand
      expect(view.opponents[0].hand).toBeUndefined();
      expect(view.drawPileCount).toBe(state.drawPile.length);
    });
  });
});
