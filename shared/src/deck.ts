import { CardValue } from './types.js';

export const CARD_VALUES: CardValue[] = [1, 2, 3, 4, 5, 6, 'L'];
export const COPIES_PER_CARD = 8;
export const TOTAL_CARDS = 56;

export function createDeck(): CardValue[] {
  const deck: CardValue[] = [];
  for (const val of CARD_VALUES) {
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
