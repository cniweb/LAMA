import { DurableObject } from 'cloudflare:workers';
import {
  addPlayerToRoom,
  type ClientMessage,
  createInitialGameState,
  discardBonusChip,
  drawCard,
  filterStateForClient,
  foldPlayer,
  type GameState,
  playCard,
  type ServerMessage,
  startRound,
} from '@lama/shared';
import type { Env } from './index.js';

interface WebSocketAttachment {
  sessionId: string;
  playerName: string;
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
  }

  private loadState(roomCode: string, hostId: string): GameState {
    if (this.stateCache) {
      return this.stateCache;
    }

    const cursor = this.ctx.storage.sql.exec("SELECT data FROM game_store WHERE id = 'state'");
    const rows = [...cursor];
    if (rows.length > 0 && rows[0].data) {
      try {
        this.stateCache = JSON.parse(rows[0].data as string) as GameState;
        return this.stateCache;
      } catch (e) {
        console.error('Failed to parse saved game state', e);
      }
    }

    const newState = createInitialGameState(roomCode, hostId);
    this.saveState(newState);
    return newState;
  }

  private saveState(state: GameState): void {
    this.stateCache = state;
    this.ctx.storage.sql.exec(
      "INSERT OR REPLACE INTO game_store (id, data, updated_at) VALUES ('state', ?, ?)",
      JSON.stringify(state),
      Date.now()
    );
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

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

      // Load or initialize room state
      const state = this.loadState(roomCode, sessionId);

      // Add/Re-add player to room state
      try {
        const updatedState = addPlayerToRoom(state, sessionId, playerName);
        this.saveState(updatedState);
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

    let clientMsg: ClientMessage;
    try {
      clientMsg = JSON.parse(rawData);
    } catch {
      this.sendError(ws, 'Ungültiges JSON-Format');
      return;
    }

    const state = this.loadState('LAMA', sessionId);

    try {
      let nextState = state;

      switch (clientMsg.type) {
        case 'JOIN_ROOM': {
          nextState = addPlayerToRoom(state, clientMsg.sessionId, clientMsg.playerName);
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
          const chipLabel = clientMsg.chipType === 'black' ? 'schwarzen 10er' : 'weißen 1er';
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

        default:
          throw new Error('Unbekannte Aktion.');
      }

      this.saveState(nextState);
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
        this.saveState(this.stateCache);
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
