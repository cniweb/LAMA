/**
 * Betriebsgrenzen für Spielräume (Free-Tier-Schutz & Robustheit).
 * Reine Funktionen, damit sie per Unit-Test abgedeckt werden können;
 * die Persistenz (SQLite) lebt im Durable Object (`worker/src/game-room.ts`).
 */

/** Inaktivitäts-Timeout, nach dem ein Raum gelöscht wird (24 Stunden). */
export const ROOM_TTL_MS = 24 * 60 * 60 * 1000;

/** Maximale Größe einer Client-Nachricht (4 KB deckt alle legalen Züge ab). */
export const MAX_MESSAGE_BYTES = 4 * 1024;

/** Token-Bucket-Parameter für das Nachrichten-Rate-Limit pro Spieler. */
export const RATE_LIMIT_CAPACITY = 20;
export const RATE_LIMIT_REFILL_PER_SEC = 10;

export interface TokenBucket {
  tokens: number;
  updatedAt: number;
}

/** True, wenn der Raum seit `ttlMs` nicht mehr angerührt wurde. */
export function isRoomExpired(
  updatedAtMs: number,
  nowMs: number,
  ttlMs: number = ROOM_TTL_MS
): boolean {
  return nowMs - updatedAtMs >= ttlMs;
}

/**
 * Verbraucht ein Token aus dem Bucket (Auffüllung proportional zur
 * verstrichenen Zeit, gedeckelt auf `capacity`). Gibt zurück, ob die
 * Nachricht verarbeitet werden darf, plus den fortgeschriebenen Bucket.
 */
export function consumeRateLimitToken(
  bucket: TokenBucket | null,
  nowMs: number,
  capacity: number = RATE_LIMIT_CAPACITY,
  refillPerSec: number = RATE_LIMIT_REFILL_PER_SEC
): { allowed: boolean; bucket: TokenBucket } {
  const current = bucket ?? { tokens: capacity, updatedAt: nowMs };
  const elapsedSec = Math.max(0, (nowMs - current.updatedAt) / 1000);
  const refilled = Math.min(capacity, current.tokens + elapsedSec * refillPerSec);
  if (refilled < 1) {
    return { allowed: false, bucket: { tokens: refilled, updatedAt: nowMs } };
  }
  return { allowed: true, bucket: { tokens: refilled - 1, updatedAt: nowMs } };
}
