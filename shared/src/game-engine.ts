import { createDeck, shuffleDeck } from './deck.js';
import type {
  CardValue,
  ChipCount,
  ChipType,
  ClientOpponentView,
  ClientRoomView,
  GameState,
  GameVariant,
  Player,
  RoundPlayerScore,
} from './types.js';

export type PlayableBase = number | 'L';

/** Pluskarte? (z. B. '3+') */
export function isPlusCard(card: CardValue): boolean {
  return typeof card === 'string' && card.endsWith('+');
}

/** Zahlenwert einer Pluskarte (1+ -> 1). */
export function plusBaseValue(card: CardValue): number | null {
  if (!isPlusCard(card)) return null;
  return Number((card as string)[0]);
}

/**
 * Basiswert für Legeregeln: Pluskarten zählen als ihre Zahl,
 * das pinke Lama (PL) als Sonderkarte (Joker beim Ablegen).
 */
function normalizedTop(topCard: CardValue): PlayableBase | 'PL' {
  if (topCard === 'PL') return 'PL';
  if (isPlusCard(topCard)) {
    const base = plusBaseValue(topCard);
    if (base !== null) return base as PlayableBase;
  }
  return topCard as PlayableBase;
}

function normalizedCandidate(candidate: CardValue): PlayableBase | 'PL' {
  if (candidate === 'PL') return 'PL';
  if (isPlusCard(candidate)) {
    const base = plusBaseValue(candidate);
    if (base !== null) return base as PlayableBase;
  }
  return candidate as PlayableBase;
}

export function canPlayCard(topCard: CardValue, candidate: CardValue): boolean {
  // Pinkes Lama passt immer (Joker).
  if (candidate === 'PL') return true;

  const top = normalizedTop(topCard);
  const cand = normalizedCandidate(candidate);

  // Auf pinkes Lama nur Lama oder 1 (Plus-1 zählt als 1).
  if (top === 'PL') {
    return cand === 'L' || cand === 1;
  }
  if (cand === 'PL') return true;
  if (top === 'L') {
    return cand === 'L' || cand === 1;
  }
  if (top === 6) {
    return cand === 6 || cand === 'L';
  }
  if (cand === 'L') return false;
  return cand === top || (typeof top === 'number' && cand === top + 1);
}

/** Basiswert für Solo-Einmaligkeit: Plus -> Zahl, PL -> 'L' (Lama-Gruppe). */
function soloKey(card: CardValue): number | 'L' {
  if (card === 'PL') return 'L';
  if (isPlusCard(card)) {
    return plusBaseValue(card) ?? (card as unknown as number);
  }
  return card as number | 'L';
}

function soloAlreadyPlayed(values: CardValue[] | null | undefined, card: CardValue): boolean {
  if (!values) return false;
  const key = soloKey(card);
  return values.some((v) => soloKey(v) === key);
}

/** Sortierschlüssel für Client-Hand (1..6, Plus direkt nach Basis, L, PL zuletzt). */
function cardSortKey(card: CardValue): number {
  if (card === 'L') return 100;
  if (card === 'PL') return 101;
  if (isPlusCard(card)) {
    return (plusBaseValue(card) ?? 0) + 0.5;
  }
  return card as number;
}

export function calculateUniquePoints(cards: CardValue[]): number {
  const seenNumbers = new Set<number>();
  let hasLlama = false;
  let hasPinkLlama = false;
  for (const card of cards) {
    if (card === 'PL') {
      hasPinkLlama = true;
    } else if (card === 'L') {
      hasLlama = true;
    } else if (isPlusCard(card)) {
      const base = plusBaseValue(card);
      if (base !== null) seenNumbers.add(base);
    } else {
      seenNumbers.add(card as number);
    }
  }
  let total = 0;
  for (const n of seenNumbers) total += n;
  if (hasPinkLlama) {
    total += 20;
  } else if (hasLlama) {
    total += 10;
  }
  return total;
}

export function pointsToChips(points: number, variant: GameVariant = 'classic'): ChipCount {
  if (variant === 'party') {
    const pink = Math.floor(points / 20);
    const rest = points % 20;
    const black = Math.floor(rest / 10);
    const white = rest % 10;
    return { white, black, pink };
  }
  const black = Math.floor(points / 10);
  const white = points % 10;
  return { white, black, pink: 0 };
}

export function totalChipScore(chips: ChipCount): number {
  return chips.white * 1 + chips.black * 10 + (chips.pink ?? 0) * 20;
}

export function normalizeChips(chips: Partial<ChipCount> | undefined): ChipCount {
  return { white: chips?.white ?? 0, black: chips?.black ?? 0, pink: chips?.pink ?? 0 };
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

export function createInitialGameState(
  roomCode: string,
  hostId: string,
  variant: GameVariant = 'classic'
): GameState {
  return {
    roomCode,
    hostId,
    variant,
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

/** Migration alter States (ohne Variante / ohne pinke Chips). */
export function migrateGameState(state: GameState): GameState {
  const variant: GameVariant = state.variant ?? 'classic';
  const players: Record<string, Player> = {};
  for (const [pid, p] of Object.entries(state.players)) {
    players[pid] = { ...p, chips: normalizeChips(p.chips) };
  }
  return { ...state, variant, players };
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
          chips: normalizeChips(existing.chips),
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
    chips: { white: 0, black: 0, pink: 0 },
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

  const deck = shuffleDeck(createDeck(state.variant ?? 'classic'));
  const updatedPlayers: Record<string, Player> = {};

  // Deal 6 cards to each player
  for (const pid of state.playerOrder) {
    const hand = deck.splice(0, 6);
    updatedPlayers[pid] = {
      ...state.players[pid],
      chips: normalizeChips(state.players[pid]?.chips),
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
  if (topCard === undefined || !canPlayCard(topCard, card)) {
    throw new Error(`Karte ${card} kann nicht auf ${topCard} gelegt werden.`);
  }

  // Solo-Endspurt: nur eine Karte pro Wert ablegbar (Plus zählt als Basiswert, PL als Lama).
  if (isSoloEndspurt(state) && soloAlreadyPlayed(state.soloDiscardedValues, card)) {
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

  // Party Edition: Pluskarte -> derselbe Spieler ist sofort nochmal an der Reihe.
  if (isPlusCard(card)) {
    return {
      ...state,
      discardPile: updatedDiscardPile,
      soloDiscardedValues: soloValues,
      players: {
        ...state.players,
        [playerId]: updatedPlayer,
      },
      turnIndex: state.turnIndex,
    };
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
  const variant = state.variant ?? 'classic';

  const endingPlayerId =
    state.firstRoundExiterId ??
    finisherPlayerId ??
    lastFolderId ??
    state.playerOrder[state.turnIndex];

  for (const pid of state.playerOrder) {
    const p = state.players[pid];
    const remainingCards = p.hand.length > 0 ? p.hand : p.foldedHand;
    const points = calculateUniquePoints(remainingCards);
    const addedChips = pointsToChips(points, variant);
    const baseChips = normalizeChips(p.chips);

    const newWhite = baseChips.white + addedChips.white;
    const newBlack = baseChips.black + addedChips.black;
    const newPink = baseChips.pink + addedChips.pink;
    const newTotal = newWhite * 1 + newBlack * 10 + newPink * 20;

    updatedPlayers[pid] = {
      ...p,
      chips: { white: newWhite, black: newBlack, pink: newPink },
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
    if (
      finisher &&
      (finisher.chips.white > 0 || finisher.chips.black > 0 || finisher.chips.pink > 0)
    ) {
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
  return exchangeChipsUp(state, playerId, 'white');
}

/** Tausch aufwärts: 10 weiß -> 1 schwarz, 2 schwarz -> 1 pink (nur Party). */
export function exchangeChipsUp(
  state: GameState,
  playerId: string,
  from: 'white' | 'black' = 'white'
): GameState {
  const player = state.players[playerId];
  if (!player) {
    throw new Error('Spieler nicht gefunden.');
  }
  const chips = normalizeChips(player.chips);
  if (from === 'white') {
    if (chips.white < 10) {
      throw new Error('Mindestens 10 weiße Chips für den Tausch erforderlich.');
    }
    const updated: ChipCount = {
      white: chips.white - 10,
      black: chips.black + 1,
      pink: chips.pink,
    };
    const updatedPlayer: Player = {
      ...player,
      chips: updated,
      totalScore: totalChipScore(updated),
    };
    return {
      ...state,
      players: { ...state.players, [playerId]: updatedPlayer },
    };
  }
  if ((state.variant ?? 'classic') !== 'party') {
    throw new Error('Pinke Chips gibt es nur in der Party Edition.');
  }
  if (chips.black < 2) {
    throw new Error('Mindestens 2 schwarze Chips für den Tausch in pink erforderlich.');
  }
  const updated: ChipCount = {
    white: chips.white,
    black: chips.black - 2,
    pink: chips.pink + 1,
  };
  const updatedPlayer: Player = {
    ...player,
    chips: updated,
    totalScore: totalChipScore(updated),
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
      chips: { white: 0, black: 0, pink: 0 },
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
  chipType: ChipType
): GameState {
  if (state.pendingChipDiscardPlayerId !== playerId) {
    throw new Error('Du bist nicht berechtigt, einen Bonus-Chip abzugeben.');
  }

  const player = state.players[playerId];
  if (!player) {
    throw new Error('Spieler nicht gefunden.');
  }
  const chips = normalizeChips(player.chips);

  if (chipType === 'white' && chips.white <= 0) {
    throw new Error('Du hast keinen weißen Chip zum Abgeben.');
  }
  if (chipType === 'black' && chips.black <= 0) {
    throw new Error('Du hast keinen schwarzen Chip zum Abgeben.');
  }
  if (chipType === 'pink' && chips.pink <= 0) {
    throw new Error('Du hast keinen pinken Chip zum Abgeben.');
  }

  const updated: ChipCount = {
    white: chipType === 'white' ? chips.white - 1 : chips.white,
    black: chipType === 'black' ? chips.black - 1 : chips.black,
    pink: chipType === 'pink' ? chips.pink - 1 : chips.pink,
  };
  const newTotal = totalChipScore(updated);

  const updatedPlayer: Player = {
    ...player,
    chips: updated,
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
  const migrated = state.variant ? state : migrateGameState(state);
  const viewer = migrated.players[viewerSessionId] || {
    id: viewerSessionId,
    name: 'Zuschauer',
    chips: { white: 0, black: 0, pink: 0 },
    totalScore: 0,
    hand: [],
    foldedHand: [],
    status: 'ACTIVE' as const,
    connected: true,
  };

  const currentTurnPlayerId = migrated.playerOrder[migrated.turnIndex];
  const isMyTurn = migrated.phase === 'IN_ROUND' && currentTurnPlayerId === viewerSessionId;
  const topDiscardCard =
    migrated.discardPile.length > 0 ? migrated.discardPile[migrated.discardPile.length - 1] : null;

  const validPlays: CardValue[] = [];
  const solo = isSoloEndspurt(migrated);
  if (isMyTurn && topDiscardCard !== null && viewer.status === 'ACTIVE') {
    const uniqueCardsInHand = Array.from(new Set(viewer.hand));
    for (const card of uniqueCardsInHand) {
      if (topDiscardCard === undefined || !canPlayCard(topDiscardCard, card)) continue;
      if (solo && soloAlreadyPlayed(migrated.soloDiscardedValues, card)) continue;
      validPlays.push(card);
    }
  }

  const canDraw = isMyTurn && viewer.status === 'ACTIVE' && migrated.drawPile.length > 0 && !solo;
  const canFold = isMyTurn && viewer.status === 'ACTIVE';

  const opponents: ClientOpponentView[] = migrated.playerOrder
    .filter((id) => id !== viewerSessionId)
    .map((id) => {
      const opp = migrated.players[id];
      const cardCount = opp.hand.length > 0 ? opp.hand.length : opp.foldedHand.length;
      return {
        id: opp.id,
        name: opp.name,
        chips: normalizeChips(opp.chips),
        totalScore: opp.totalScore,
        cardCount,
        status: opp.status,
        connected: opp.connected,
        isTurn: migrated.phase === 'IN_ROUND' && currentTurnPlayerId === opp.id,
      };
    });

  let winnersFormatted: { id: string; name: string; score: number }[] | null = null;
  if (migrated.winners) {
    winnersFormatted = migrated.winners.map((wid) => ({
      id: wid,
      name: migrated.players[wid]?.name || 'Unbekannt',
      score: migrated.players[wid]?.totalScore ?? 0,
    }));
  }

  return {
    roomCode: migrated.roomCode,
    hostId: migrated.hostId,
    variant: migrated.variant ?? 'classic',
    isHost: migrated.hostId === viewerSessionId,
    phase: migrated.phase,
    roundNumber: migrated.roundNumber,
    myPlayer: {
      id: viewer.id,
      name: viewer.name,
      chips: normalizeChips(viewer.chips),
      totalScore: viewer.totalScore,
      hand: [...viewer.hand].sort((a, b) => cardSortKey(a) - cardSortKey(b)),
      status: viewer.status,
      isTurn: isMyTurn,
      validPlays,
      canDraw,
      canFold,
    },
    opponents,
    topDiscardCard: topDiscardCard ?? null,
    discardPileCount: migrated.discardPile.length,
    drawPileCount: migrated.drawPile.length,
    isSoloEndspurt: solo,
    soloDiscardedValues: migrated.soloDiscardedValues,
    pendingChipDiscardPlayerId: migrated.pendingChipDiscardPlayerId,
    lastRoundSummary: migrated.lastRoundSummary,
    winners: winnersFormatted,
  };
}
