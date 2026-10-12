import type { CardValue, GameVariant } from './types.js';

export const CLASSIC_CARD_VALUES: CardValue[] = [1, 2, 3, 4, 5, 6, 'L'];
export const COPIES_PER_CARD = 8;
export const TOTAL_CARDS = 56;

/** Party Edition: 7x 1-6, je 1x Pluskarte 1+-6+, 7x Lama, 1x pinkes Lama. */
export const PARTY_BASE_COPIES = 7;
export const PARTY_LLAMA_COPIES = 7;

/** Crazy Edition: Party-Basis + 1x goldenes Lama + je 2x Skip/Draw-Two/Gift. */
export const CRAZY_ACTION_COPIES = 2;

/** Baut die Party-Basis (7x 1-6, 6 Pluskarten, 7x Lama, 1x pinkes Lama). */
function createPartyBaseDeck(): CardValue[] {
  const deck: CardValue[] = [];
  for (let v = 1; v <= 6; v++) {
    const value = v as 1 | 2 | 3 | 4 | 5 | 6;
    for (let i = 0; i < PARTY_BASE_COPIES; i++) {
      deck.push(value);
    }
  }
  const plusCards: CardValue[] = ['1+', '2+', '3+', '4+', '5+', '6+'];
  deck.push(...plusCards);
  for (let i = 0; i < PARTY_LLAMA_COPIES; i++) {
    deck.push('L');
  }
  deck.push('PL');
  return deck;
}

export function createDeck(variant: GameVariant = 'classic'): CardValue[] {
  if (variant === 'party') {
    return createPartyBaseDeck();
  }
  if (variant === 'crazy') {
    // Party-Basis (56) + 1x goldenes Lama + je 2x Skip/Draw-Two/Gift = 63 Karten.
    const deck = createPartyBaseDeck();
    deck.push('GL');
    const actionCards: CardValue[] = ['SK', 'D2', 'GF'];
    for (const action of actionCards) {
      for (let i = 0; i < CRAZY_ACTION_COPIES; i++) {
        deck.push(action);
      }
    }
    return deck;
  }
  const deck: CardValue[] = [];
  for (const val of CLASSIC_CARD_VALUES) {
    for (let i = 0; i < COPIES_PER_CARD; i++) {
      deck.push(val);
    }
  }
  return deck;
}

export function shuffleDeck<T>(deck: T[], rng = Math.random): T[] {
  const result = [...deck];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
