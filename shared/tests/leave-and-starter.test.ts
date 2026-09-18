import { describe, expect, it } from 'vitest';
import {
  addPlayerToRoom,
  createInitialGameState,
  foldPlayer,
  playCard,
  removePlayerFromGame,
  startRound,
} from '../src/game-engine.js';

function setup3PlayerRound() {
  let state = createInitialGameState('LAMA', 'p1');
  state = addPlayerToRoom(state, 'p1', 'Alice');
  state = addPlayerToRoom(state, 'p2', 'Bob');
  state = addPlayerToRoom(state, 'p3', 'Cara');
  state = startRound(state, 'p1');
  return state;
}

describe('Rundenstarter-Regel (Fehler 2)', () => {
  it('Leer-Spieler beginnt nächste Runde, auch wenn vorher jemand ausgestiegen ist', () => {
    let state = setup3PlayerRound();

    // Alice steigt als Erste aus
    state.turnIndex = 0;
    state.players.p1.hand = [1];
    state = foldPlayer(state, 'p1');
    expect(state.firstRoundExiterId).toBe('p1');

    // Bob leert seine Hand und beendet die Runde
    state.turnIndex = state.playerOrder.indexOf('p2');
    state.players.p2.hand = [3];
    state.players.p3.hand = [5];
    state.discardPile = [2];
    state = playCard(state, 'p2', 3);

    // Bob (Leer-Spieler) muss nächste Runde beginnen, nicht Alice
    expect(state.lastRoundFinisherId).toBe('p2');
    const next = startRound(state);
    expect(next.turnIndex).toBe(next.playerOrder.indexOf('p2'));
  });

  it('ohne Leer-Spieler beginnt der Erst-Aussteiger', () => {
    let state = setup3PlayerRound();

    state.turnIndex = 0;
    state.players.p1.hand = [1];
    state = foldPlayer(state, 'p1');

    state.turnIndex = state.playerOrder.indexOf('p2');
    state.players.p2.hand = [2];
    state = foldPlayer(state, 'p2');

    state.turnIndex = state.playerOrder.indexOf('p3');
    state.players.p3.hand = [3];
    state = foldPlayer(state, 'p3');

    expect(state.lastRoundFinisherId).toBe('p1');
    const next = startRound(state);
    expect(next.turnIndex).toBe(next.playerOrder.indexOf('p1'));
  });
});

describe('Raum verlassen (Fehler 1)', () => {
  it('entfernt Spieler mitten im Durchgang hart, Zugfolge bleibt konsistent', () => {
    let state = setup3PlayerRound();
    state.turnIndex = 0; // Alice am Zug
    state.players.p1.hand = [1, 2];
    state.players.p2.hand = [3, 4];
    state.players.p3.hand = [5, 6];

    state = removePlayerFromGame(state, 'p2');

    expect(state.players.p2).toBeUndefined();
    expect(state.playerOrder).toEqual(['p1', 'p3']);
    expect(state.phase).toBe('IN_ROUND');
    // Alice (Index 0) war am Zug und bleibt am Zug
    expect(state.turnIndex).toBe(0);
    expect(state.playerOrder[state.turnIndex]).toBe('p1');
  });

  it('Zug wandert weiter, wenn der verlassende Spieler am Zug war', () => {
    let state = setup3PlayerRound();
    state.turnIndex = 1; // Bob am Zug
    state.players.p1.hand = [1];
    state.players.p2.hand = [2];
    state.players.p3.hand = [3];

    state = removePlayerFromGame(state, 'p2');

    expect(state.playerOrder).toEqual(['p1', 'p3']);
    // Bob (Index 1) war am Zug -> Cara rückt auf Index 1 und ist am Zug
    expect(state.turnIndex).toBe(1);
    expect(state.playerOrder[state.turnIndex]).toBe('p3');
  });

  it('Host-Rechte gehen an den nächsten Spieler über', () => {
    let state = setup3PlayerRound();
    expect(state.hostId).toBe('p1');

    state = removePlayerFromGame(state, 'p1');

    expect(state.hostId).toBe('p2');
    expect(state.playerOrder).toEqual(['p2', 'p3']);
  });

  it('letzter verbleibender Spieler im Durchgang fällt zurück in die Lobby (Chips behalten)', () => {
    let state = setup3PlayerRound();
    state.players.p1.chips = { white: 3, black: 1, pink: 0 };
    state.players.p1.totalScore = 13;

    state = removePlayerFromGame(state, 'p2');
    expect(state.phase).toBe('IN_ROUND');

    state = removePlayerFromGame(state, 'p3');

    expect(state.playerOrder).toEqual(['p1']);
    expect(state.phase).toBe('LOBBY');
    // Verdiente Chips bleiben erhalten
    expect(state.players.p1.chips).toEqual({ white: 3, black: 1, pink: 0 });
    expect(state.players.p1.totalScore).toBe(13);
    expect(state.players.p1.hand).toEqual([]);
  });

  it('ausstehende Chip-Rückgabe des Verlassenden wird aufgelöst', () => {
    let state = setup3PlayerRound();
    state.players.p1.hand = [3];
    state.players.p2.hand = [4, 4];
    state.players.p3.hand = [5];
    state.players.p1.chips = { white: 5, black: 0, pink: 0 };
    state.players.p1.totalScore = 5;
    state.discardPile = [2];
    state.turnIndex = 0;

    // Alice leert die Hand -> Bonus-Phase für Alice
    state = playCard(state, 'p1', 3);
    expect(state.pendingChipDiscardPlayerId).toBe('p1');

    // Alice verlässt -> Bonus verfällt, Abrechnung für den Rest steht
    state = removePlayerFromGame(state, 'p1');

    expect(state.pendingChipDiscardPlayerId).toBeNull();
    expect(state.phase).toBe('ROUND_SUMMARY');
    expect(state.players.p1).toBeUndefined();
    expect(state.lastRoundSummary?.some((s) => s.playerId === 'p1')).toBe(false);
  });

  it('Referenzen auf entfernte Finisher/Exiter werden bereinigt', () => {
    let state = setup3PlayerRound();
    state.turnIndex = 0;
    state.players.p1.hand = [1];
    state = foldPlayer(state, 'p1');
    expect(state.firstRoundExiterId).toBe('p1');

    state = removePlayerFromGame(state, 'p1');
    expect(state.firstRoundExiterId).toBeNull();
  });
});
