export type GameVariant = 'classic' | 'party';

export type BaseCardValue = 1 | 2 | 3 | 4 | 5 | 6 | 'L';
export type PlusCardValue = '1+' | '2+' | '3+' | '4+' | '5+' | '6+';
export type CardValue = BaseCardValue | PlusCardValue | 'PL';

export type ChipType = 'white' | 'black' | 'pink';

export interface ChipCount {
  white: number; // 1 point each
  black: number; // 10 points each
  pink: number; // 20 points each (Party Edition)
}

export type PlayerStatus = 'ACTIVE' | 'FOLDED' | 'DISCONNECTED';

export type GamePhase = 'LOBBY' | 'IN_ROUND' | 'ROUND_SUMMARY' | 'GAME_OVER';

export interface Player {
  id: string; // sessionId
  name: string;
  chips: ChipCount;
  totalScore: number;
  hand: CardValue[];
  foldedHand: CardValue[];
  status: PlayerStatus;
  connected: boolean;
}

export interface RoundPlayerScore {
  playerId: string;
  playerName: string;
  cards: CardValue[];
  uniquePoints: number;
  chipsAdded: ChipCount;
  totalScoreAfterRound: number;
  bonusChipReturned?: ChipType;
}

export interface GameState {
  roomCode: string;
  hostId: string;
  variant: GameVariant;
  phase: GamePhase;
  roundNumber: number;
  players: Record<string, Player>;
  playerOrder: string[]; // list of sessionIds in turn order
  turnIndex: number;
  drawPile: CardValue[];
  discardPile: CardValue[];
  lastRoundFinisherId: string | null;
  firstRoundExiterId: string | null;
  soloDiscardedValues: CardValue[] | null;
  pendingChipDiscardPlayerId: string | null;
  lastRoundSummary: RoundPlayerScore[] | null;
  winners: string[] | null;
}

export interface ClientOpponentView {
  id: string;
  name: string;
  chips: ChipCount;
  totalScore: number;
  cardCount: number;
  status: PlayerStatus;
  connected: boolean;
  isTurn: boolean;
}

export interface ClientRoomView {
  roomCode: string;
  hostId: string;
  variant: GameVariant;
  isHost: boolean;
  phase: GamePhase;
  roundNumber: number;
  myPlayer: {
    id: string;
    name: string;
    chips: ChipCount;
    totalScore: number;
    hand: CardValue[];
    status: PlayerStatus;
    isTurn: boolean;
    validPlays: CardValue[];
    canDraw: boolean;
    canFold: boolean;
  };
  opponents: ClientOpponentView[];
  topDiscardCard: CardValue | null;
  discardPileCount: number;
  drawPileCount: number;
  isSoloEndspurt: boolean;
  soloDiscardedValues: CardValue[] | null;
  pendingChipDiscardPlayerId: string | null;
  lastRoundSummary: RoundPlayerScore[] | null;
  winners: { id: string; name: string; score: number }[] | null;
}

export interface PushSubscriptionPayload {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  roomCode: string;
}

export type ClientMessage =
  | { type: 'JOIN_ROOM'; roomCode: string; playerName: string; sessionId: string }
  | { type: 'START_GAME' }
  | { type: 'PLAY_CARD'; card: CardValue }
  | { type: 'DRAW_CARD' }
  | { type: 'FOLD' }
  | { type: 'DISCARD_CHIP'; chipType: ChipType }
  | { type: 'NEXT_ROUND' }
  | { type: 'EXCHANGE_CHIPS'; from?: 'white' | 'black' }
  | { type: 'NEW_GAME' }
  | { type: 'LEAVE_ROOM' }
  | { type: 'REGISTER_PUSH'; subscription: PushSubscriptionPayload }
  | { type: 'UNREGISTER_PUSH'; endpoint?: string };

export type ServerMessage =
  | { type: 'STATE_UPDATE'; state: ClientRoomView }
  | { type: 'ERROR'; message: string }
  | { type: 'NOTIFICATION'; text: string; tone: 'info' | 'success' | 'alert' };
