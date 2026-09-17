import { describe, it, expect } from 'vitest';
import { calculateUniquePoints, pointsToChips, totalChipScore } from '../src/game-engine.js';

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
    expect(pointsToChips(0)).toEqual({ white: 0, black: 0 });
    expect(pointsToChips(4)).toEqual({ white: 4, black: 0 });
    expect(pointsToChips(10)).toEqual({ white: 0, black: 1 });
    expect(pointsToChips(14)).toEqual({ white: 4, black: 1 });
    expect(pointsToChips(29)).toEqual({ white: 9, black: 2 });
  });

  it('calculates total chip score properly', () => {
    expect(totalChipScore({ white: 4, black: 1 })).toBe(14);
    expect(totalChipScore({ white: 8, black: 3 })).toBe(38);
  });
});
