import { createDeck, shuffleDeck } from './deck.js';
import type {
  CardValue,
  ChipCount,
  ClientOpponentView,
  ClientRoomView,
  GameState,
  Player,
  RoundPlayerScore,
} from './types.js';

export function canPlayCard(topCard: CardValue, candidate: CardValue): boolean {
  if (topCard === 'L') {
    return candidate === 'L' || candidate === 1;
  }
  if (topCard === 6) {
    return candidate === 6 || candidate === 'L';
  }
  return candidate === topCard || candidate === topCard + 1;
}

export function calculateUniquePoints(cards: CardValue[]): number {
  const uniqueSet = new Set<CardValue>(cards);
  let total = 0;
  for (const card of uniqueSet) {
    if (card === 'L') {
      total += 10;
    } else {
      total += card;
    }
  }
  return total;
}

export function pointsToChips(points: number): ChipCount {
  const black = Math.floor(points / 10);
  const white = points % 10;
  return { white, black };
}

export function totalChipScore(chips: ChipCount): number {
  return chips.white * 1 + chips.black * 10;
}

export function isSoloEndspurt(state: GameState): boolean {
  const activeCount = state.playerOrder.filter(
    (id) => state.players[id]?.status === 'ACTIVE'
  ).length;
  return activeCount === 1 && state.playerOrder.length > 1;
}

export function getActivePlayerCount(state: GameState): number {
  return state.playerOrder.filter((id) => state.players[id]?.status === 'ACTIVE').length;
}

export function getNextActiveTurnIndex(
  playerOrder: string[],
  players: Record<string, Player>,
  currentIndex: number
): number {
  const total = playerOrder.length;
  for (let i = 1; i <= total; i++) {
    const nextIdx = (currentIndex + i) % total;
    const nextId = playerOrder[nextIdx];
    if (players[nextId]?.status === 'ACTIVE') {
      return nextIdx;
    }
  }
  return currentIndex;
}

export function createInitialGameState(roomCode: string, hostId: string): GameState {
  return {
    roomCode,
    hostId,
    phase: 'LOBBY',
    roundNumber: 0,
    players: {},
    playerOrder: [],
    turnIndex: 0,
    drawPile: [],
    discardPile: [],
    lastRoundFinisherId: null,
    firstRoundExiterId: null,
    soloDiscardedValues: null,
    pendingChipDiscardPlayerId: null,
    lastRoundSummary: null,
    winners: null,
  };
}

export function addPlayerToRoom(state: GameState, id: string, name: string): GameState {
  if (state.players[id]) {
    // Reconnection of existing player
    const existing = state.players[id];
    return {
      ...state,
      players: {
        ...state.players,
        [id]: {
          ...existing,
          name: name.trim() || existing.name,
          connected: true,
          status: existing.status === 'DISCONNECTED' ? 'ACTIVE' : existing.status,
        },
      },
    };
  }

  if (state.phase !== 'LOBBY') {
    throw new Error('Das Spiel hat bereits begonnen.');
  }

  if (state.playerOrder.length >= 6) {
    throw new Error('Der Raum ist mit 6 Spielern voll.');
  }

  const newPlayer: Player = {
    id,
    name: name.trim() || `Spieler ${state.playerOrder.length + 1}`,
    chips: { white: 0, black: 0 },
    totalScore: 0,
    hand: [],
    foldedHand: [],
    status: 'ACTIVE',
    connected: true,
  };

  return {
    ...state,
    players: {
      ...state.players,
      [id]: newPlayer,
    },
    playerOrder: [...state.playerOrder, id],
  };
}

export function startRound(state: GameState, starterPlayerId?: string): GameState {
  if (state.playerOrder.length < 2) {
    throw new Error('Es werden mindestens 2 Spieler benötigt.');
  }

  const deck = shuffleDeck(createDeck());
  const updatedPlayers: Record<string, Player> = {};

  // Deal 6 cards to each player
  for (const pid of state.playerOrder) {
    const hand = deck.splice(0, 6);
    updatedPlayers[pid] = {
      ...state.players[pid],
      hand,
      foldedHand: [],
      status: 'ACTIVE',
    };
  }

  // 1 card to discard pile
  const topDiscard = deck.pop();
  if (topDiscard === undefined) {
    throw new Error('Das Deck ist leer, es kann kein Ablagestapel gebildet werden.');
  }
  const discardPile = [topDiscard];
  const drawPile = deck;

  // Determine starting player
  let turnIndex = 0;
  if (starterPlayerId && state.playerOrder.includes(starterPlayerId)) {
    turnIndex = state.playerOrder.indexOf(starterPlayerId);
  } else if (state.lastRoundFinisherId && state.playerOrder.includes(state.lastRoundFinisherId)) {
    turnIndex = state.playerOrder.indexOf(state.lastRoundFinisherId);
  } else {
    turnIndex = Math.floor(Math.random() * state.playerOrder.length);
  }

  return {
    ...state,
    phase: 'IN_ROUND',
    roundNumber: state.roundNumber + 1,
    players: updatedPlayers,
    turnIndex,
    drawPile,
    discardPile,
    firstRoundExiterId: null,
    soloDiscardedValues: null,
    pendingChipDiscardPlayerId: null,
    lastRoundSummary: null,
    winners: null,
  };
}

export function playCard(state: GameState, playerId: string, card: CardValue): GameState {
  if (state.phase !== 'IN_ROUND') {
    throw new Error('Kein Durchgang aktiv.');
  }

  const currentTurnPlayerId = state.playerOrder[state.turnIndex];
  if (currentTurnPlayerId !== playerId) {
    throw new Error('Du bist nicht an der Reihe.');
  }

  const player = state.players[playerId];
  if (player?.status !== 'ACTIVE') {
    throw new Error('Spieler ist nicht aktiv.');
  }

  const cardIndex = player.hand.indexOf(card);
  if (cardIndex === -1) {
    throw new Error('Diese Karte befindet sich nicht auf deiner Hand.');
  }

  const topCard = state.discardPile[state.discardPile.length - 1];
  if (!canPlayCard(topCard, card)) {
    throw new Error(`Karte ${card} kann nicht auf ${topCard} gelegt werden.`);
  }

  // Solo-Endspurt: nur eine Karte pro Wert ablegbar.
  if (isSoloEndspurt(state) && state.soloDiscardedValues?.includes(card)) {
    throw new Error('Im Solo-Endspurt wurde dieser Kartenwert bereits abgelegt.');
  }

  // Remove card from hand
  const newHand = [...player.hand];
  newHand.splice(cardIndex, 1);

  const updatedPlayer: Player = {
    ...player,
    hand: newHand,
  };

  const updatedDiscardPile = [...state.discardPile, card];
  const soloValues =
    isSoloEndspurt(state) || getActivePlayerCount(state) === 1
      ? [...(state.soloDiscardedValues ?? []), card]
      : state.soloDiscardedValues;

  // Did the player discard their last card?
  if (newHand.length === 0) {
    return settleRound(
      {
        ...state,
        discardPile: updatedDiscardPile,
        soloDiscardedValues: soloValues,
        firstRoundExiterId: state.firstRoundExiterId ?? playerId,
        players: {
          ...state.players,
          [playerId]: updatedPlayer,
        },
      },
      playerId
    );
  }

  // Next player's turn
  const nextTurnIndex = getNextActiveTurnIndex(
    state.playerOrder,
    { ...state.players, [playerId]: updatedPlayer },
    state.turnIndex
  );

  return {
    ...state,
    discardPile: updatedDiscardPile,
    soloDiscardedValues: soloValues,
    players: {
      ...state.players,
      [playerId]: updatedPlayer,
    },
    turnIndex: nextTurnIndex,
  };
}

export function drawCard(state: GameState, playerId: string): GameState {
  if (state.phase !== 'IN_ROUND') {
    throw new Error('Kein Durchgang aktiv.');
  }

  const currentTurnPlayerId = state.playerOrder[state.turnIndex];
  if (currentTurnPlayerId !== playerId) {
    throw new Error('Du bist nicht an der Reihe.');
  }

  const player = state.players[playerId];
  if (player?.status !== 'ACTIVE') {
    throw new Error('Spieler ist nicht aktiv.');
  }

  if (isSoloEndspurt(state)) {
    throw new Error('Im Solo-Endspurt darf keine Karte mehr gezogen werden.');
  }

  const newDrawPile = [...state.drawPile];
  const drawnCard = newDrawPile.pop();
  if (drawnCard === undefined) {
    throw new Error('Der Nachziehstapel ist leer. Du musst ablegen oder aussteigen.');
  }

  const updatedPlayer: Player = {
    ...player,
    hand: [...player.hand, drawnCard],
  };

  const nextTurnIndex = getNextActiveTurnIndex(
    state.playerOrder,
    { ...state.players, [playerId]: updatedPlayer },
    state.turnIndex
  );

  return {
    ...state,
    drawPile: newDrawPile,
    players: {
      ...state.players,
      [playerId]: updatedPlayer,
    },
    turnIndex: nextTurnIndex,
  };
}

export function foldPlayer(state: GameState, playerId: string): GameState {
  if (state.phase !== 'IN_ROUND') {
    throw new Error('Kein Durchgang aktiv.');
  }

  const currentTurnPlayerId = state.playerOrder[state.turnIndex];
  if (currentTurnPlayerId !== playerId) {
    throw new Error('Du bist nicht an der Reihe.');
  }

  const player = state.players[playerId];
  if (player?.status !== 'ACTIVE') {
    throw new Error('Spieler ist nicht aktiv.');
  }

  const updatedPlayer: Player = {
    ...player,
    foldedHand: [...player.hand],
    hand: [],
    status: 'FOLDED',
  };

  const updatedPlayers = {
    ...state.players,
    [playerId]: updatedPlayer,
  };

  // Check if ALL players are now folded
  const remainingActive = state.playerOrder.filter(
    (id) => updatedPlayers[id]?.status === 'ACTIVE'
  ).length;

  const firstExiter = state.firstRoundExiterId ?? playerId;
  const soloStarted = remainingActive === 1;

  if (remainingActive === 0) {
    // Round ends because all players folded — starter next round is the FIRST exiter.
    return settleRound(
      {
        ...state,
        players: updatedPlayers,
        firstRoundExiterId: firstExiter,
      },
      null, // No one discarded all cards
      playerId // last folder, only fallback
    );
  }

  // Next active player
  const nextTurnIndex = getNextActiveTurnIndex(state.playerOrder, updatedPlayers, state.turnIndex);

  return {
    ...state,
    players: updatedPlayers,
    firstRoundExiterId: firstExiter,
    soloDiscardedValues: soloStarted
      ? (state.soloDiscardedValues ?? [])
      : state.soloDiscardedValues,
    turnIndex: nextTurnIndex,
  };
}

export function settleRound(
  state: GameState,
  finisherPlayerId: string | null,
  lastFolderId?: string
): GameState {
  const roundSummary: RoundPlayerScore[] = [];
  const updatedPlayers: Record<string, Player> = {};

  const endingPlayerId =
    state.firstRoundExiterId ??
    finisherPlayerId ??
    lastFolderId ??
    state.playerOrder[state.turnIndex];

  for (const pid of state.playerOrder) {
    const p = state.players[pid];
    const remainingCards = p.hand.length > 0 ? p.hand : p.foldedHand;
    const points = calculateUniquePoints(remainingCards);
    const addedChips = pointsToChips(points);

    const newWhite = p.chips.white + addedChips.white;
    const newBlack = p.chips.black + addedChips.black;
    const newTotal = newWhite * 1 + newBlack * 10;

    updatedPlayers[pid] = {
      ...p,
      chips: { white: newWhite, black: newBlack },
      totalScore: newTotal,
      hand: [],
      foldedHand: remainingCards, // kept for summary
      status: 'ACTIVE',
    };

    roundSummary.push({
      playerId: pid,
      playerName: p.name,
      cards: remainingCards,
      uniquePoints: points,
      chipsAdded: addedChips,
      totalScoreAfterRound: newTotal,
    });
  }

  // Can finisher discard a chip? (Only if finisher emptied hand and has chips)
  let pendingChipDiscardPlayerId: string | null = null;
  if (finisherPlayerId) {
    const finisher = updatedPlayers[finisherPlayerId];
    if (finisher && (finisher.chips.white > 0 || finisher.chips.black > 0)) {
      pendingChipDiscardPlayerId = finisherPlayerId;
    }
  }

  // Check if game is over (any player has >= 40 total points)
  // Note: if there is a pending chip discard, we can still allow them to discard first, or evaluate game over after
  const someoneReached40 = Object.values(updatedPlayers).some((p) => p.totalScore >= 40);

  return {
    ...state,
    phase: pendingChipDiscardPlayerId
      ? 'IN_ROUND'
      : someoneReached40
        ? 'GAME_OVER'
        : 'ROUND_SUMMARY',
    players: updatedPlayers,
    lastRoundFinisherId: endingPlayerId,
    soloDiscardedValues: null,
    pendingChipDiscardPlayerId,
    lastRoundSummary: roundSummary,
    winners:
      someoneReached40 && !pendingChipDiscardPlayerId ? determineWinners(updatedPlayers) : null,
  };
}

export function exchangeWhiteForBlack(state: GameState, playerId: string): GameState {
  const player = state.players[playerId];
  if (!player) {
    throw new Error('Spieler nicht gefunden.');
  }
  if (player.chips.white < 10) {
    throw new Error('Mindestens 10 weiße Chips für den Tausch erforderlich.');
  }
  const updatedPlayer: Player = {
    ...player,
    chips: { white: player.chips.white - 10, black: player.chips.black + 1 },
    totalScore: player.chips.white - 10 + (player.chips.black + 1) * 10,
  };
  return {
    ...state,
    players: { ...state.players, [playerId]: updatedPlayer },
  };
}

export function resetGameForNewMatch(state: GameState): GameState {
  const updatedPlayers: Record<string, Player> = {};
  for (const pid of state.playerOrder) {
    const p = state.players[pid];
    if (!p) continue;
    updatedPlayers[pid] = {
      ...p,
      chips: { white: 0, black: 0 },
      totalScore: 0,
      hand: [],
      foldedHand: [],
      status: 'ACTIVE',
    };
  }
  return {
    ...state,
    phase: 'LOBBY',
    roundNumber: 0,
    players: updatedPlayers,
    turnIndex: 0,
    drawPile: [],
    discardPile: [],
    lastRoundFinisherId: null,
    firstRoundExiterId: null,
    soloDiscardedValues: null,
    pendingChipDiscardPlayerId: null,
    lastRoundSummary: null,
    winners: null,
  };
}

export function removePlayerFromLobby(state: GameState, playerId: string): GameState {
  if (state.phase !== 'LOBBY') {
    throw new Error('Spieler kann nur in der Lobby entfernt werden.');
  }
  if (!state.players[playerId]) {
    return state;
  }
  const { [playerId]: _removed, ...rest } = state.players;
  const order = state.playerOrder.filter((id) => id !== playerId);
  let hostId = state.hostId;
  if (hostId === playerId) {
    hostId = order[0] ?? '';
  }
  return {
    ...state,
    players: rest,
    playerOrder: order,
    hostId,
    turnIndex: 0,
  };
}

export function discardBonusChip(
  state: GameState,
  playerId: string,
  chipType: 'white' | 'black'
): GameState {
  if (state.pendingChipDiscardPlayerId !== playerId) {
    throw new Error('Du bist nicht berechtigt, einen Bonus-Chip abzugeben.');
  }

  const player = state.players[playerId];
  if (!player) {
    throw new Error('Spieler nicht gefunden.');
  }

  if (chipType === 'white' && player.chips.white <= 0) {
    throw new Error('Du hast keinen weißen Chip zum Abgeben.');
  }
  if (chipType === 'black' && player.chips.black <= 0) {
    throw new Error('Du hast keinen schwarzen Chip zum Abgeben.');
  }

  const newWhite = chipType === 'white' ? player.chips.white - 1 : player.chips.white;
  const newBlack = chipType === 'black' ? player.chips.black - 1 : player.chips.black;
  const newTotal = newWhite * 1 + newBlack * 10;

  const updatedPlayer: Player = {
    ...player,
    chips: { white: newWhite, black: newBlack },
    totalScore: newTotal,
  };

  const updatedPlayers = {
    ...state.players,
    [playerId]: updatedPlayer,
  };

  // Update roundSummary with returned chip
  const updatedSummary =
    state.lastRoundSummary?.map((s) => {
      if (s.playerId === playerId) {
        return {
          ...s,
          bonusChipReturned: chipType,
          totalScoreAfterRound: newTotal,
        };
      }
      return s;
    }) ?? null;

  const someoneReached40 = Object.values(updatedPlayers).some((p) => p.totalScore >= 40);

  return {
    ...state,
    phase: someoneReached40 ? 'GAME_OVER' : 'ROUND_SUMMARY',
    players: updatedPlayers,
    pendingChipDiscardPlayerId: null,
    lastRoundSummary: updatedSummary,
    winners: someoneReached40 ? determineWinners(updatedPlayers) : null,
  };
}

export function determineWinners(players: Record<string, Player>): string[] {
  const playerList = Object.values(players);
  if (playerList.length === 0) return [];

  let minScore = Infinity;
  for (const p of playerList) {
    if (p.totalScore < minScore) {
      minScore = p.totalScore;
    }
  }

  return playerList.filter((p) => p.totalScore === minScore).map((p) => p.id);
}

export function filterStateForClient(state: GameState, viewerSessionId: string): ClientRoomView {
  const viewer = state.players[viewerSessionId] || {
    id: viewerSessionId,
    name: 'Zuschauer',
    chips: { white: 0, black: 0 },
    totalScore: 0,
    hand: [],
    foldedHand: [],
    status: 'ACTIVE' as const,
    connected: true,
  };

  const currentTurnPlayerId = state.playerOrder[state.turnIndex];
  const isMyTurn = state.phase === 'IN_ROUND' && currentTurnPlayerId === viewerSessionId;
  const topDiscardCard =
    state.discardPile.length > 0 ? state.discardPile[state.discardPile.length - 1] : null;

  const validPlays: CardValue[] = [];
  const solo = isSoloEndspurt(state);
  if (isMyTurn && topDiscardCard !== null && viewer.status === 'ACTIVE') {
    const uniqueCardsInHand = Array.from(new Set(viewer.hand));
    for (const card of uniqueCardsInHand) {
      if (!canPlayCard(topDiscardCard, card)) continue;
      if (solo && state.soloDiscardedValues?.includes(card)) continue;
      validPlays.push(card);
    }
  }

  const canDraw = isMyTurn && viewer.status === 'ACTIVE' && state.drawPile.length > 0 && !solo;
  const canFold = isMyTurn && viewer.status === 'ACTIVE';

  const opponents: ClientOpponentView[] = state.playerOrder
    .filter((id) => id !== viewerSessionId)
    .map((id) => {
      const opp = state.players[id];
      const cardCount = opp.hand.length > 0 ? opp.hand.length : opp.foldedHand.length;
      return {
        id: opp.id,
        name: opp.name,
        chips: opp.chips,
        totalScore: opp.totalScore,
        cardCount,
        status: opp.status,
        connected: opp.connected,
        isTurn: state.phase === 'IN_ROUND' && currentTurnPlayerId === opp.id,
      };
    });

  let winnersFormatted: { id: string; name: string; score: number }[] | null = null;
  if (state.winners) {
    winnersFormatted = state.winners.map((wid) => ({
      id: wid,
      name: state.players[wid]?.name || 'Unbekannt',
      score: state.players[wid]?.totalScore ?? 0,
    }));
  }

  return {
    roomCode: state.roomCode,
    hostId: state.hostId,
    isHost: state.hostId === viewerSessionId,
    phase: state.phase,
    roundNumber: state.roundNumber,
    myPlayer: {
      id: viewer.id,
      name: viewer.name,
      chips: viewer.chips,
      totalScore: viewer.totalScore,
      hand: [...viewer.hand].sort((a, b) => {
        if (a === 'L') return 1;
        if (b === 'L') return -1;
        return a - b;
      }),
      status: viewer.status,
      isTurn: isMyTurn,
      validPlays,
      canDraw,
      canFold,
    },
    opponents,
    topDiscardCard,
    discardPileCount: state.discardPile.length,
    drawPileCount: state.drawPile.length,
    isSoloEndspurt: solo,
    soloDiscardedValues: state.soloDiscardedValues,
    pendingChipDiscardPlayerId: state.pendingChipDiscardPlayerId,
    lastRoundSummary: state.lastRoundSummary,
    winners: winnersFormatted,
  };
}
