import { describe, expect, it } from 'vitest';
import {
  addPlayerToRoom,
  createInitialGameState,
  discardBonusChip,
  drawCard,
  filterStateForClient,
  foldPlayer,
  type GameVariant,
  playCard,
  startRound,
} from '../src/game-engine.js';

/**
 * Regel: Legt ein Spieler seine letzte Handkarte ab, endet der Durchgang
 * SOFORT für alle. Niemand darf danach noch weiterspielen (kein nachträgliches
 * "Solo"-Weiterspielen). Der Finisher wird über den Bonus-Chip belohnt – während
 * dieses Bonus-Dialogs (phase bleibt IN_ROUND, pendingChipDiscardPlayerId gesetzt)
 * dürfen die Zug-Handler keine weiteren Züge zulassen.
 *
 * Der Guard muss über pendingChipDiscardPlayerId greifen – NICHT nur über den
 * turnIndex: Deshalb prüfen die Tests gezielt die Rundenende-Fehlermeldung und
 * zusätzlich den Spieler, der laut turnIndex am Zug ist.
 */

const ROUND_LOCKED = /Runde ist beendet/;

function setupRoundWithFinisherHoldingChips(variant: GameVariant): ReturnType<typeof startRound> {
  let state = createInitialGameState('ROOM', 'p1', variant);
  state = addPlayerToRoom(state, 'p1', 'Alice');
  state = addPlayerToRoom(state, 'p2', 'Bob');
  state = addPlayerToRoom(state, 'p3', 'Carol');
  state = startRound(state, 'p1');

  // Deterministisches Setup: p1 am Zug, legt gleich die letzte Karte ab.
  state.turnIndex = 0;
  state.discardPile = [3];
  state.players.p1.hand = [4]; // einzige Karte -> leer nach dem Zug
  state.players.p2.hand = [1, 2];
  state.players.p3.hand = [5, 6];
  // Finisher hat bereits Chips -> Bonus-Chip-Dialog wird geöffnet.
  state.players.p1.chips = { white: 3, black: 0, pink: 0 };
  state.players.p1.totalScore = 3;
  return state;
}

for (const variant of ['classic', 'party', 'crazy'] as const) {
  describe(`Rundenende sperrt Weiterspielen (${variant})`, () => {
    it('öffnet nach dem Leerspielen den Bonus-Chip-Dialog (phase IN_ROUND)', () => {
      let state = setupRoundWithFinisherHoldingChips(variant);
      state = playCard(state, 'p1', 4);
      expect(state.players.p1.hand).toEqual([]);
      expect(state.pendingChipDiscardPlayerId).toBe('p1');
      // Phase bleibt bewusst IN_ROUND, bis der Bonus-Chip gewählt wurde.
      expect(state.phase).toBe('IN_ROUND');
    });

    it('blockiert playCard mit Rundenende-Fehler – auch für den Spieler am turnIndex', () => {
      let state = setupRoundWithFinisherHoldingChips(variant);
      state = playCard(state, 'p1', 4);

      // Spieler, der laut turnIndex "am Zug" wäre: muss mit Rundenende-Fehler
      // scheitern (nicht mit "nicht an der Reihe") – das belegt den Guard.
      const turnPlayerId = state.playerOrder[state.turnIndex];
      const turnPlayerCard = state.players[turnPlayerId].hand[0];
      if (turnPlayerId !== 'p1') {
        expect(() => playCard(state, turnPlayerId, turnPlayerCard)).toThrow(ROUND_LOCKED);
      }

      // Und generell jeder andere aktive Spieler.
      expect(() => playCard(state, 'p2', 1)).toThrow(ROUND_LOCKED);
      expect(() => playCard(state, 'p3', 5)).toThrow(ROUND_LOCKED);
    });

    it('blockiert drawCard und foldPlayer mit Rundenende-Fehler', () => {
      let state = setupRoundWithFinisherHoldingChips(variant);
      state = playCard(state, 'p1', 4);
      expect(() => drawCard(state, 'p2')).toThrow(ROUND_LOCKED);
      expect(() => foldPlayer(state, 'p3')).toThrow(ROUND_LOCKED);
    });

    it('erlaubt dem Finisher weiterhin die Bonus-Chip-Abgabe (Belohnung)', () => {
      let state = setupRoundWithFinisherHoldingChips(variant);
      state = playCard(state, 'p1', 4);
      state = discardBonusChip(state, 'p1', 'white');
      // Nach der Abgabe ist der Dialog aufgelöst und die Runde abgerechnet.
      expect(state.pendingChipDiscardPlayerId).toBeNull();
      expect(['ROUND_SUMMARY', 'GAME_OVER']).toContain(state.phase);
      // Bonus: ein weißer Chip wurde zurückgegeben.
      expect(state.players.p1.chips.white).toBe(2);
    });

    it('Client-View bietet während des Bonus-Dialogs keine Aktionen an', () => {
      let state = setupRoundWithFinisherHoldingChips(variant);
      state = playCard(state, 'p1', 4);

      // Weder Finisher noch irgendein anderer Spieler ist "am Zug".
      for (const pid of ['p1', 'p2', 'p3']) {
        const view = filterStateForClient(state, pid);
        expect(view.myPlayer.isTurn).toBe(false);
        expect(view.myPlayer.validPlays).toEqual([]);
        expect(view.myPlayer.canDraw).toBe(false);
        expect(view.myPlayer.canFold).toBe(false);
      }
      // Der Bonus-Chip-Empfänger ist im View markiert.
      const finisherView = filterStateForClient(state, 'p1');
      expect(finisherView.pendingChipDiscardPlayerId).toBe('p1');
    });
  });
}
