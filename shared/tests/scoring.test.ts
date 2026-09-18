import { describe, expect, it } from 'vitest';
import {
  addPlayerToRoom,
  calculateUniquePoints,
  createInitialGameState,
  exchangeWhiteForBlack,
  pointsToChips,
  resetGameForNewMatch,
  totalChipScore,
} from '../src/game-engine.js';

describe('LAMA Scoring & Chips', () => {
  it('calculates points according to the uniqueness principle (Einmaligkeitsprinzip)', () => {
    // Three 4s should count as only 4 points
    expect(calculateUniquePoints([4, 4, 4])).toBe(4);

    // Multiple Lamas count as only 10 points
    expect(calculateUniquePoints(['L', 'L'])).toBe(10);

    // Mixed hand: [1, 3, 3, 5, 'L'] -> 1 + 3 + 5 + 10 = 19
    expect(calculateUniquePoints([1, 3, 3, 5, 'L'])).toBe(19);

    // Empty hand -> 0 points
    expect(calculateUniquePoints([])).toBe(0);

    // All card values 1-6 + L -> 1 + 2 + 3 + 4 + 5 + 6 + 10 = 31
    expect(calculateUniquePoints([1, 2, 3, 4, 5, 6, 'L'])).toBe(31);
  });

  it('converts points to black (10) and white (1) chips correctly', () => {
    expect(pointsToChips(0)).toEqual({ white: 0, black: 0, pink: 0 });
    expect(pointsToChips(4)).toEqual({ white: 4, black: 0, pink: 0 });
    expect(pointsToChips(10)).toEqual({ white: 0, black: 1, pink: 0 });
    expect(pointsToChips(14)).toEqual({ white: 4, black: 1, pink: 0 });
    expect(pointsToChips(29)).toEqual({ white: 9, black: 2, pink: 0 });
  });

  it('calculates total chip score properly', () => {
    expect(totalChipScore({ white: 4, black: 1, pink: 0 })).toBe(14);
    expect(totalChipScore({ white: 8, black: 3, pink: 0 })).toBe(38);
  });

  it('tauscht manuell 10 weiße gegen 1 schwarzen (total invariant)', () => {
    let state = createInitialGameState('LAMA', 'p1');
    state = addPlayerToRoom(state, 'p1', 'Alice');
    state = addPlayerToRoom(state, 'p2', 'Bob');
    state.players.p1.chips = { white: 12, black: 0, pink: 0 };
    state.players.p1.totalScore = 12;

    state = exchangeWhiteForBlack(state, 'p1');
    expect(state.players.p1.chips).toEqual({ white: 2, black: 1, pink: 0 });
    expect(state.players.p1.totalScore).toBe(12);
  });

  it('verweigert Tausch bei weniger als 10 weißen', () => {
    let state = createInitialGameState('LAMA', 'p1');
    state = addPlayerToRoom(state, 'p1', 'Alice');
    state = addPlayerToRoom(state, 'p2', 'Bob');
    state.players.p1.chips = { white: 9, black: 0, pink: 0 };
    expect(() => exchangeWhiteForBlack(state, 'p1')).toThrow(/10 weiße/);
  });

  it('resetGameForNewMatch setzt Scores zurück und behält Raum/Order', () => {
    let state = createInitialGameState('LAMA', 'p1');
    state = addPlayerToRoom(state, 'p1', 'Alice');
    state = addPlayerToRoom(state, 'p2', 'Bob');
    state.players.p1.chips = { white: 3, black: 1, pink: 0 };
    state.players.p1.totalScore = 13;
    state.roundNumber = 2;

    state = resetGameForNewMatch(state);
    expect(state.phase).toBe('LOBBY');
    expect(state.roundNumber).toBe(0);
    expect(state.playerOrder).toEqual(['p1', 'p2']);
    expect(state.players.p1.chips).toEqual({ white: 0, black: 0, pink: 0 });
    expect(state.players.p1.totalScore).toBe(0);
    expect(state.lastRoundSummary).toBeNull();
    expect(state.winners).toBeNull();
  });
});
