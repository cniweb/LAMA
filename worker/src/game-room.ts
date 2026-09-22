import { DurableObject } from 'cloudflare:workers';
import {
  addPlayerToRoom,
  type ClientMessage,
  consumeRateLimitToken,
  createInitialGameState,
  discardBonusChip,
  drawCard,
  exchangeChipsUp,
  filterStateForClient,
  foldPlayer,
  type GameState,
  type GameVariant,
  isRoomExpired,
  MAX_MESSAGE_BYTES,
  migrateGameState,
  playCard,
  ROOM_TTL_MS,
  removePlayerFromGame,
  resetGameForNewMatch,
  type ServerMessage,
  startRound,
} from '@lama/shared';
import type { Env } from './index.js';
import { sendPush } from './push.js';

interface WebSocketAttachment {
  sessionId: string;
  playerName: string;
}

interface PushSubRow {
  session_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  room_code: string;
  updated_at: number;
}

export class GameRoom extends DurableObject<Env> {
  private stateCache: GameState | null = null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.initDatabase();
  }

  private initDatabase(): void {
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS game_store (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS rate_limits (
        session_id TEXT PRIMARY KEY,
        tokens REAL NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        session_id TEXT PRIMARY KEY,
        endpoint TEXT NOT NULL,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        room_code TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS pending_push (
        endpoint TEXT PRIMARY KEY,
        payload TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )
    `);
  }

  private upsertPushSubscription(
    sessionId: string,
    endpoint: string,
    p256dh: string,
    auth: string,
    roomCode: string
  ): void {
    this.ctx.storage.sql.exec(
      `INSERT OR REPLACE INTO push_subscriptions (session_id, endpoint, p256dh, auth, room_code, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
      sessionId,
      endpoint,
      p256dh,
      auth,
      roomCode.toUpperCase(),
      Date.now()
    );
  }

  private deletePushSubscription(sessionId: string, endpoint?: string): void {
    if (endpoint) {
      this.ctx.storage.sql.exec(
        `DELETE FROM push_subscriptions WHERE session_id = ? AND endpoint = ?`,
        sessionId,
        endpoint
      );
    } else {
      this.ctx.storage.sql.exec(`DELETE FROM push_subscriptions WHERE session_id = ?`, sessionId);
    }
  }

  private getPushSubscription(sessionId: string): PushSubRow | null {
    const cur = this.ctx.storage.sql.exec(
      `SELECT session_id, endpoint, p256dh, auth, room_code, updated_at FROM push_subscriptions WHERE session_id = ?`,
      sessionId
    );
    const rows = [...cur] as unknown as PushSubRow[];
    return rows[0] || null;
  }

  private storePendingPush(endpoint: string, payload: Record<string, unknown>): void {
    this.ctx.storage.sql.exec(
      `INSERT OR REPLACE INTO pending_push (endpoint, payload, created_at) VALUES (?, ?, ?)`,
      endpoint,
      JSON.stringify(payload),
      Date.now()
    );
  }

  private consumePendingPush(endpoint: string): Record<string, unknown> | null {
    const cur = this.ctx.storage.sql.exec(
      `SELECT payload FROM pending_push WHERE endpoint = ?`,
      endpoint
    );
    const rows = [...cur] as unknown as { payload: string }[];
    if (rows.length === 0) return null;
    const payload = JSON.parse(rows[0].payload as string) as Record<string, unknown>;
    this.ctx.storage.sql.exec(`DELETE FROM pending_push WHERE endpoint = ?`, endpoint);
    return payload;
  }

  private maybeNotifyNextPlayer(
    prevState: GameState,
    nextState: GameState,
    actorSessionId: string
  ): void {
    if (nextState.phase !== 'IN_ROUND') return;
    const nextPlayerId = nextState.playerOrder[nextState.turnIndex];
    if (!nextPlayerId) return;
    if (nextPlayerId === actorSessionId) {
      const prevPlayerId = prevState.playerOrder[prevState.turnIndex];
      if (nextPlayerId === prevPlayerId) return;
    }
    const prevTurnId =
      prevState.phase === 'IN_ROUND' ? prevState.playerOrder[prevState.turnIndex] : null;
    if (nextPlayerId === prevTurnId) return;

    const sub = this.getPushSubscription(nextPlayerId);
    if (!sub) return;

    const roomCode = nextState.roomCode;
    const roundNumber = nextState.roundNumber;
    const payload = {
      title: 'LAMA \u2013 Du bist am Zug!',
      body: `Raum ${roomCode} \u00b7 Durchgang ${roundNumber} \u2013 du bist dran!`,
      roomCode,
      url: `/?room=${roomCode}`,
    };
    // Für SW-Fallback ohne verschlüsselte Payload: pending aufbewahren
    // SW holt es via GET /api/push/pending?endpoint=...
    this.storePendingPush(sub.endpoint, payload);
    this.ctx.waitUntil(
      (async () => {
        const result = await sendPush(this.env, { endpoint: sub.endpoint }, payload);
        if (result.shouldDelete) {
          this.deletePushSubscription(nextPlayerId, sub.endpoint);
          this.ctx.storage.sql.exec(`DELETE FROM pending_push WHERE endpoint = ?`, sub.endpoint);
        }
      })()
    );
  }

  private async loadState(
    roomCode: string,
    hostId: string,
    variant: GameVariant = 'classic'
  ): Promise<GameState> {
    if (this.stateCache) {
      return this.stateCache;
    }

    const cursor = this.ctx.storage.sql.exec("SELECT data FROM game_store WHERE id = 'state'");
    const rows = [...cursor];
    if (rows.length > 0 && rows[0].data) {
      try {
        const parsed = JSON.parse(rows[0].data as string) as GameState;
        this.stateCache = migrateGameState(parsed);
        return this.stateCache;
      } catch (e) {
        console.error('Failed to parse saved game state', e);
      }
    }

    const newState = createInitialGameState(roomCode, hostId, variant);
    await this.saveState(newState);
    return newState;
  }

  private async saveState(state: GameState): Promise<void> {
    this.stateCache = state;
    this.ctx.storage.sql.exec(
      "INSERT OR REPLACE INTO game_store (id, data, updated_at) VALUES ('state', ?, ?)",
      JSON.stringify(state),
      Date.now()
    );
    // Inaktivitäts-Timeout neu starten: Der Alarm löscht den Raum, wenn bis
    // dahin keine weitere Aktivität stattgefunden hat.
    await this.ctx.storage.setAlarm(Date.now() + ROOM_TTL_MS);
  }

  /**
   * Löscht den Raum (inkl. Rate-Limit-Zähler), wenn seit der letzten
   * Aktivität mehr als ROOM_TTL_MS vergangen ist. Schützt das
   * Free-Tier-Storage-Kontingent vor verwaisten Räumen.
   */
  async alarm(): Promise<void> {
    const cursor = this.ctx.storage.sql.exec(
      "SELECT updated_at FROM game_store WHERE id = 'state'"
    );
    const rows = [...cursor];
    if (rows.length === 0) {
      return;
    }
    const updatedAt = rows[0].updated_at as number;
    const now = Date.now();
    if (!isRoomExpired(updatedAt, now)) {
      await this.ctx.storage.setAlarm(updatedAt + ROOM_TTL_MS);
      return;
    }
    this.ctx.storage.sql.exec("DELETE FROM game_store WHERE id = 'state'");
    this.ctx.storage.sql.exec('DELETE FROM rate_limits');
    this.ctx.storage.sql.exec('DELETE FROM push_subscriptions');
    this.ctx.storage.sql.exec('DELETE FROM pending_push');
    this.stateCache = null;
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.close(1000, 'Der Raum wurde wegen Inaktivität geschlossen.');
      } catch {
        // Bereits geschlossene Sockets ignorieren.
      }
    }
  }

  /** Token-Bucket-Limit pro Spieler (hibernationssicher in SQLite). */
  private checkRateLimit(sessionId: string): boolean {
    const now = Date.now();
    const cursor = this.ctx.storage.sql.exec(
      'SELECT tokens, updated_at FROM rate_limits WHERE session_id = ?',
      sessionId
    );
    const rows = [...cursor];
    const stored =
      rows.length > 0
        ? { tokens: rows[0].tokens as number, updatedAt: rows[0].updated_at as number }
        : null;
    const { allowed, bucket } = consumeRateLimitToken(stored, now);
    this.ctx.storage.sql.exec(
      'INSERT OR REPLACE INTO rate_limits (session_id, tokens, updated_at) VALUES (?, ?, ?)',
      sessionId,
      bucket.tokens,
      bucket.updatedAt
    );
    return allowed;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/push/subscribe' && request.method === 'POST') {
      const roomCode = url.searchParams.get('roomCode') || 'LAMA';
      const sessionId =
        url.searchParams.get('sessionId') || request.headers.get('x-session-id') || '';
      try {
        const body = (await request.json()) as {
          endpoint?: string;
          keys?: { p256dh?: string; auth?: string };
          roomCode?: string;
        };
        if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
          return Response.json({ error: 'Invalid subscription' }, { status: 400 });
        }
        const sid = sessionId || (body as unknown as { sessionId?: string }).sessionId || '';
        if (!sid) return Response.json({ error: 'sessionId required' }, { status: 400 });
        this.upsertPushSubscription(sid, body.endpoint, body.keys.p256dh, body.keys.auth, roomCode);
        return Response.json({ ok: true });
      } catch {
        return Response.json({ error: 'Invalid JSON' }, { status: 400 });
      }
    }

    if (url.pathname === '/push/unsubscribe' && request.method === 'POST') {
      const sessionId =
        url.searchParams.get('sessionId') || request.headers.get('x-session-id') || '';
      try {
        const body = (await request.json().catch(() => ({}))) as {
          endpoint?: string;
          sessionId?: string;
        };
        const sid = sessionId || body.sessionId || '';
        if (sid) this.deletePushSubscription(sid, body.endpoint);
        return Response.json({ ok: true });
      } catch {
        return Response.json({ ok: true });
      }
    }

    if (url.pathname === '/push/pending' && request.method === 'GET') {
      const endpoint = url.searchParams.get('endpoint');
      if (!endpoint) return Response.json({ error: 'endpoint required' }, { status: 400 });
      const data = this.consumePendingPush(endpoint);
      if (!data) return Response.json({}, { status: 200 });
      return Response.json(data);
    }

    // WebSocket upgrade handling
    if (request.headers.get('Upgrade')?.toLowerCase() === 'websocket') {
      const roomCode = url.searchParams.get('roomCode') || 'LAMA';
      const sessionId = url.searchParams.get('sessionId');
      const playerName = url.searchParams.get('playerName') || 'Spieler';

      if (!sessionId) {
        return new Response('sessionId query param required', { status: 400 });
      }

      const pair = new WebSocketPair();
      const [clientWs, serverWs] = Object.values(pair);

      // Tag socket with sessionId and accept for hibernation
      this.ctx.acceptWebSocket(serverWs, [sessionId]);
      serverWs.serializeAttachment({ sessionId, playerName });

      // Load or initialize room state (Variante fix bei Erstellung)
      const requestedVariant: GameVariant =
        url.searchParams.get('variant') === 'party' ? 'party' : 'classic';
      const state = await this.loadState(roomCode, sessionId, requestedVariant);

      // Add/Re-add player to room state
      try {
        const isRejoin = !!state.players[sessionId];
        let updatedState = addPlayerToRoom(state, sessionId, playerName);
        // Wenn ein neuer Spieler dazukommt und bereits Punkte/Runden existieren,
        // alles resetten (Punkte + Durchgänge von vorne) – faire Basis für alle.
        if (!isRejoin && updatedState.playerOrder.length > 1) {
          const hasProgress =
            updatedState.roundNumber > 0 ||
            Object.values(updatedState.players).some(
              (p) => p.totalScore > 0 || p.chips.white > 0 || p.chips.black > 0 || p.chips.pink > 0
            );
          if (hasProgress) {
            updatedState = resetGameForNewMatch(updatedState);
          }
        }
        await this.saveState(updatedState);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Fehler beim Beitritt';
        serverWs.send(JSON.stringify({ type: 'ERROR', message: msg } satisfies ServerMessage));
      }

      // Broadcast state update to everyone
      this.broadcastState();

      return new Response(null, {
        status: 101,
        webSocket: clientWs,
      });
    }

    return new Response('Expected WebSocket upgrade', { status: 426 });
  }

  async webSocketMessage(ws: WebSocket, message: ArrayBuffer | string): Promise<void> {
    const rawData = typeof message === 'string' ? message : new TextDecoder().decode(message);
    const attachment = ws.deserializeAttachment() as WebSocketAttachment | null;
    const sessionId = attachment?.sessionId;

    if (!sessionId) {
      this.sendError(ws, 'Nicht authentifiziert (keine Session-ID)');
      return;
    }

    if (rawData.length > MAX_MESSAGE_BYTES) {
      this.sendError(ws, 'Nachricht zu groß.');
      return;
    }

    let clientMsg: ClientMessage;
    try {
      clientMsg = JSON.parse(rawData);
    } catch {
      this.sendError(ws, 'Ungültiges JSON-Format');
      return;
    }

    if (!this.checkRateLimit(sessionId)) {
      this.sendError(ws, 'Zu viele Anfragen – bitte kurz warten.');
      return;
    }

    const state = await this.loadState('LAMA', sessionId);

    try {
      let nextState = state;

      switch (clientMsg.type) {
        case 'JOIN_ROOM': {
          const isRejoin = !!state.players[clientMsg.sessionId];
          let afterAdd = addPlayerToRoom(state, clientMsg.sessionId, clientMsg.playerName);
          if (!isRejoin && afterAdd.playerOrder.length > 1) {
            const hasProgress =
              afterAdd.roundNumber > 0 ||
              Object.values(afterAdd.players).some(
                (p) =>
                  p.totalScore > 0 || p.chips.white > 0 || p.chips.black > 0 || p.chips.pink > 0
              );
            if (hasProgress) afterAdd = resetGameForNewMatch(afterAdd);
          }
          nextState = afterAdd;
          break;
        }

        case 'START_GAME': {
          if (state.hostId !== sessionId) {
            throw new Error('Nur der Host kann das Spiel starten.');
          }
          if (state.playerOrder.length < 2) {
            throw new Error('Mindestens 2 Spieler erforderlich.');
          }
          nextState = startRound(state);
          this.broadcastNotification('Das Spiel wurde gestartet!', 'info');
          break;
        }

        case 'PLAY_CARD': {
          nextState = playCard(state, sessionId, clientMsg.card);
          break;
        }

        case 'DRAW_CARD': {
          nextState = drawCard(state, sessionId);
          break;
        }

        case 'FOLD': {
          nextState = foldPlayer(state, sessionId);
          const pName = state.players[sessionId]?.name || 'Ein Spieler';
          this.broadcastNotification(`${pName} ist aus dem Durchgang ausgestiegen.`, 'info');
          break;
        }

        case 'DISCARD_CHIP': {
          nextState = discardBonusChip(state, sessionId, clientMsg.chipType);
          const pName = state.players[sessionId]?.name || 'Ein Spieler';
          const chipLabel =
            clientMsg.chipType === 'pink'
              ? 'pinken 20er'
              : clientMsg.chipType === 'black'
                ? 'schwarzen 10er'
                : 'weißen 1er';
          this.broadcastNotification(
            `${pName} hat einen ${chipLabel}-Chip abgegeben! 🎉`,
            'success'
          );
          break;
        }

        case 'NEXT_ROUND': {
          if (state.phase !== 'ROUND_SUMMARY') {
            throw new Error('Runde noch nicht abgeschlossen.');
          }
          nextState = startRound(state, state.lastRoundFinisherId || undefined);
          this.broadcastNotification(`Durchgang ${nextState.roundNumber} gestartet!`, 'info');
          break;
        }

        case 'EXCHANGE_CHIPS': {
          nextState = exchangeChipsUp(state, sessionId, clientMsg.from ?? 'white');
          break;
        }

        case 'NEW_GAME': {
          if (state.phase !== 'ROUND_SUMMARY' && state.phase !== 'GAME_OVER') {
            throw new Error('Neues Spiel erst nach Rundenende möglich.');
          }
          // Bewusst kein Host-Check: Button sehen/auslösen dürfen alle.
          nextState = resetGameForNewMatch(state);
          this.broadcastNotification('Neues Spiel! Alle Punkte zurückgesetzt.', 'info');
          break;
        }

        case 'LEAVE_ROOM': {
          const leaverName = state.players[sessionId]?.name || 'Ein Spieler';
          const beforeLen = state.playerOrder.length;
          const afterRemoval = removePlayerFromGame(state, sessionId);
          const leaverSub = this.getPushSubscription(sessionId);
          if (leaverSub) {
            this.ctx.storage.sql.exec(
              'DELETE FROM pending_push WHERE endpoint = ?',
              leaverSub.endpoint
            );
          }
          this.deletePushSubscription(sessionId);
          if (afterRemoval.playerOrder.length === 0) {
            await this.saveState(afterRemoval);
            this.broadcastState();
            return;
          }
          const left = afterRemoval.playerOrder.length !== beforeLen;
          // Punkte und Durchgänge für alle Verbleibenden resetten (faire Basis)
          nextState = resetGameForNewMatch(afterRemoval);
          if (left) {
            this.broadcastNotification(
              `${leaverName} hat den Raum verlassen. Punkte wurden zurückgesetzt.`,
              'info'
            );
          }
          break;
        }

        case 'REGISTER_PUSH': {
          const sub = clientMsg.subscription;
          if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
            throw new Error('Ungültige Push-Subscription');
          }
          this.upsertPushSubscription(
            sessionId,
            sub.endpoint,
            sub.keys.p256dh,
            sub.keys.auth,
            sub.roomCode
          );
          ws.send(
            JSON.stringify({
              type: 'NOTIFICATION',
              text: 'Benachrichtigungen aktiviert',
              tone: 'success',
            } satisfies ServerMessage)
          );
          return;
        }

        case 'UNREGISTER_PUSH': {
          this.deletePushSubscription(sessionId, clientMsg.endpoint);
          ws.send(
            JSON.stringify({
              type: 'NOTIFICATION',
              text: 'Benachrichtigungen deaktiviert',
              tone: 'info',
            } satisfies ServerMessage)
          );
          return;
        }

        default:
          throw new Error('Unbekannte Aktion.');
      }

      await this.saveState(nextState);
      this.maybeNotifyNextPlayer(state, nextState, sessionId);
      this.broadcastState();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Aktion fehlgeschlagen';
      this.sendError(ws, msg);
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    const attachment = ws.deserializeAttachment() as WebSocketAttachment | null;
    const sessionId = attachment?.sessionId;

    if (sessionId && this.stateCache?.players[sessionId]) {
      // Mark as disconnected if no other socket is open with this sessionId
      const activeSockets = this.ctx.getWebSockets(sessionId);
      if (activeSockets.length <= 1) {
        this.stateCache.players[sessionId].connected = false;
        await this.saveState(this.stateCache);
        this.broadcastState();
      }
    }
  }

  async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
    console.error('WebSocket error:', error);
    ws.close(1011, 'Internal Error');
  }

  private broadcastState(): void {
    if (!this.stateCache) return;
    const sockets = this.ctx.getWebSockets();

    for (const ws of sockets) {
      const attachment = ws.deserializeAttachment() as WebSocketAttachment | null;
      const sid = attachment?.sessionId || '';
      const clientView = filterStateForClient(this.stateCache, sid);
      const msg: ServerMessage = {
        type: 'STATE_UPDATE',
        state: clientView,
      };
      ws.send(JSON.stringify(msg));
    }
  }

  private broadcastNotification(text: string, tone: 'info' | 'success' | 'alert'): void {
    const sockets = this.ctx.getWebSockets();
    const msg: ServerMessage = {
      type: 'NOTIFICATION',
      text,
      tone,
    };
    const json = JSON.stringify(msg);
    for (const ws of sockets) {
      ws.send(json);
    }
  }

  private sendError(ws: WebSocket, message: string): void {
    const msg: ServerMessage = {
      type: 'ERROR',
      message,
    };
    ws.send(JSON.stringify(msg));
  }
}
