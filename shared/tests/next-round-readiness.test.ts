import { describe, expect, it } from 'vitest';
import {
  addPlayerToRoom,
  createInitialGameState,
  discardBonusChip,
  foldPlayer,
  markNextRoundReady,
  playCard,
  removePlayerFromGame,
  startRound,
} from '../src/game-engine.js';

function completedThreePlayerRound() {
  let state = createInitialGameState('LAMA', 'p1');
  state = addPlayerToRoom(state, 'p1', 'Alice');
  state = addPlayerToRoom(state, 'p2', 'Bob');
  state = addPlayerToRoom(state, 'p3', 'Cara');
  state = startRound(state, 'p1');

  state.players.p1.hand = [1];
  state.players.p2.hand = [2];
  state.players.p3.hand = [3];
  state = foldPlayer(state, 'p1');
  state = foldPlayer(state, 'p2');
  return foldPlayer(state, 'p3');
}

describe('synchronisierter Start des nächsten Durchgangs', () => {
  it('starts only after every player in a three-player room is ready', () => {
    let state = completedThreePlayerRound();

    state = markNextRoundReady(state, 'p1');
    expect(state.phase).toBe('ROUND_SUMMARY');
    expect(state.roundNumber).toBe(1);

    state = markNextRoundReady(state, 'p2');
    expect(state.phase).toBe('ROUND_SUMMARY');
    expect(state.roundNumber).toBe(1);

    state = markNextRoundReady(state, 'p3');
    expect(state.phase).toBe('IN_ROUND');
    expect(state.roundNumber).toBe(2);
    expect(state.nextRoundReadyPlayerIds).toEqual([]);
  });

  it('removes a leaving player from the barrier and starts for ready players', () => {
    let state = completedThreePlayerRound();
    state = markNextRoundReady(state, 'p1');
    state = markNextRoundReady(state, 'p2');

    state = removePlayerFromGame(state, 'p3');

    expect(state.players.p3).toBeUndefined();
    expect(state.phase).toBe('IN_ROUND');
    expect(state.roundNumber).toBe(2);
    expect(state.nextRoundReadyPlayerIds).toEqual([]);
  });

  it('returns to the lobby with chips if fewer than two players remain', () => {
    let state = completedThreePlayerRound();
    state.players.p1.chips = { white: 2, black: 1, pink: 0 };
    state.players.p1.totalScore = 12;
    state = markNextRoundReady(state, 'p1');

    state = removePlayerFromGame(state, 'p2');
    state = removePlayerFromGame(state, 'p3');

    expect(state.phase).toBe('LOBBY');
    expect(state.playerOrder).toEqual(['p1']);
    expect(state.players.p1.chips).toEqual({ white: 2, black: 1, pink: 0 });
    expect(state.nextRoundReadyPlayerIds).toEqual([]);
  });

  it('remains in the lobby if the pending-bonus player leaves with one player left', () => {
    let state = createInitialGameState('LAMA', 'p1');
    state = addPlayerToRoom(state, 'p1', 'Alice');
    state = addPlayerToRoom(state, 'p2', 'Bob');
    state = startRound(state, 'p1');
    state.players.p1.chips = { white: 1, black: 0, pink: 0 };
    state.players.p1.totalScore = 1;
    state.players.p1.hand = [3];
    state.players.p2.hand = [4];
    state.discardPile = [2];
    state.turnIndex = 0;
    state = playCard(state, 'p1', 3);
    state = markNextRoundReady(state, 'p1');

    state = removePlayerFromGame(state, 'p1');

    expect(state.phase).toBe('LOBBY');
    expect(state.playerOrder).toEqual(['p2']);
    expect(state.pendingChipDiscardPlayerId).toBeNull();
  });

  it('waits for a pending bonus-chip return before starting a fully ready room', () => {
    let state = createInitialGameState('LAMA', 'p1');
    state = addPlayerToRoom(state, 'p1', 'Alice');
    state = addPlayerToRoom(state, 'p2', 'Bob');
    state = addPlayerToRoom(state, 'p3', 'Cara');
    state = startRound(state, 'p1');
    state.players.p1.chips = { white: 1, black: 0, pink: 0 };
    state.players.p1.totalScore = 1;
    state.players.p1.hand = [3];
    state.players.p2.hand = [4];
    state.players.p3.hand = [5];
    state.discardPile = [2];
    state.turnIndex = 0;
    state = playCard(state, 'p1', 3);

    expect(state.pendingChipDiscardPlayerId).toBe('p1');
    state = markNextRoundReady(state, 'p1');
    state = markNextRoundReady(state, 'p2');
    state = markNextRoundReady(state, 'p3');

    expect(state.phase).toBe('IN_ROUND');
    expect(state.roundNumber).toBe(1);

    state = discardBonusChip(state, 'p1', 'white');

    expect(state.phase).toBe('IN_ROUND');
    expect(state.roundNumber).toBe(2);
    expect(state.pendingChipDiscardPlayerId).toBeNull();
    expect(state.nextRoundReadyPlayerIds).toEqual([]);
  });
});
