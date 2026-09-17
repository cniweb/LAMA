import { describe, expect, it } from 'vitest';
import {
  consumeRateLimitToken,
  isRoomExpired,
  MAX_MESSAGE_BYTES,
  ROOM_TTL_MS,
  type TokenBucket,
} from '../src/room-limits.js';

describe('Room expiry (isRoomExpired)', () => {
  it('expires rooms untouched for at least the TTL', () => {
    const now = 1_000_000;
    expect(isRoomExpired(now - ROOM_TTL_MS, now)).toBe(true);
    expect(isRoomExpired(now - ROOM_TTL_MS - 1, now)).toBe(true);
  });

  it('keeps recently touched rooms alive', () => {
    const now = 1_000_000;
    expect(isRoomExpired(now, now)).toBe(false);
    expect(isRoomExpired(now - ROOM_TTL_MS + 1, now)).toBe(false);
    expect(isRoomExpired(now + 60_000, now)).toBe(false);
  });

  it('respects a custom TTL', () => {
    expect(isRoomExpired(0, 5_000, 10_000)).toBe(false);
    expect(isRoomExpired(0, 10_000, 10_000)).toBe(true);
  });
});

describe('Rate limiting (consumeRateLimitToken)', () => {
  it('allows a burst up to capacity, then denies', () => {
    const now = 2_000_000;
    let bucket: TokenBucket | null = null;
    for (let i = 0; i < 20; i++) {
      const res = consumeRateLimitToken(bucket, now);
      expect(res.allowed).toBe(true);
      bucket = res.bucket;
    }
    expect(consumeRateLimitToken(bucket, now).allowed).toBe(false);
  });

  it('refills tokens over time and caps at capacity', () => {
    const t0 = 3_000_000;
    // Drain completely.
    let bucket: TokenBucket | null = null;
    for (let i = 0; i < 20; i++) {
      bucket = consumeRateLimitToken(bucket, t0).bucket;
    }
    // After 1s at 10 tokens/s, ~10 tokens are back.
    let res = consumeRateLimitToken(bucket, t0 + 1_000);
    expect(res.allowed).toBe(true);
    expect(res.bucket.tokens).toBeCloseTo(9, 6);
    // After a long idle period the bucket is full again (capped).
    res = consumeRateLimitToken(res.bucket, t0 + 3_600_000);
    expect(res.allowed).toBe(true);
    expect(res.bucket.tokens).toBeCloseTo(19, 6);
  });

  it('never goes negative and tolerates clock skew', () => {
    const res = consumeRateLimitToken({ tokens: 0, updatedAt: 5_000 }, 4_000);
    expect(res.allowed).toBe(false);
    expect(res.bucket.tokens).toBeGreaterThanOrEqual(0);
  });
});

describe('Message size cap (MAX_MESSAGE_BYTES)', () => {
  it('covers the largest legitimate client message with margin', () => {
    const longest = JSON.stringify({
      type: 'JOIN_ROOM',
      roomCode: 'ABCD',
      playerName: 'x'.repeat(16),
      sessionId: 'sid_abcdefghij1234567890',
    });
    expect(longest.length).toBeLessThan(MAX_MESSAGE_BYTES);
  });
});
