import type { GameVariant } from '@lama/shared';
import { GameRoom } from './game-room.js';

export { GameRoom };

export interface Env {
  GAME_ROOM: DurableObjectNamespace<GameRoom>;
  ASSETS: Fetcher;
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
}

const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateRoomCode(): string {
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += ROOM_CODE_CHARS.charAt(Math.floor(Math.random() * ROOM_CODE_CHARS.length));
  }
  return code;
}

function parseVariant(value: unknown): GameVariant {
  return value === 'party' ? 'party' : 'classic';
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // API: Room creation (Variante fix bei Erstellung: 'classic' | 'party')
    if (url.pathname === '/api/room/create' && request.method === 'POST') {
      let variant: GameVariant = 'classic';
      try {
        const body = (await request.json()) as { variant?: unknown };
        variant = parseVariant(body.variant);
      } catch {
        // Kein/ungültiger Body -> Default classic (altes Frontend bleibt kompatibel).
      }
      // Query-Override für einfache E2E-Nutzung (?variant=party)
      const queryVariant = url.searchParams.get('variant');
      if (queryVariant) variant = parseVariant(queryVariant);
      const roomCode = generateRoomCode();
      return Response.json({ roomCode, variant }, { status: 201 });
    }

    // API: VAPID public key for PushManager
    if (url.pathname === '/api/push/vapidPublicKey' && request.method === 'GET') {
      const pub = (env as unknown as Record<string, string | undefined>).VAPID_PUBLIC_KEY;
      if (!pub) return Response.json({ publicKey: null }, { status: 200 });
      return Response.json({ publicKey: pub });
    }

    // API: Push subscription via REST (alternativ zum WebSocket)
    const pushSubMatch = url.pathname.match(/^\/api\/room\/([a-zA-Z0-9]+)\/push\/subscribe$/);
    if (pushSubMatch && request.method === 'POST') {
      const roomCode = pushSubMatch[1].toUpperCase();
      const id = env.GAME_ROOM.idFromName(roomCode);
      const stub = env.GAME_ROOM.get(id);
      const fwd = new URL(request.url);
      fwd.pathname = '/push/subscribe';
      fwd.searchParams.set('roomCode', roomCode);
      const sessionId =
        request.headers.get('x-session-id') ||
        new URL(request.url).searchParams.get('sessionId') ||
        '';
      if (sessionId) fwd.searchParams.set('sessionId', sessionId);
      return stub.fetch(new Request(fwd.toString(), request));
    }

    const pushUnsubMatch = url.pathname.match(/^\/api\/room\/([a-zA-Z0-9]+)\/push\/unsubscribe$/);
    if (pushUnsubMatch && request.method === 'POST') {
      const roomCode = pushUnsubMatch[1].toUpperCase();
      const id = env.GAME_ROOM.idFromName(roomCode);
      const stub = env.GAME_ROOM.get(id);
      const fwd = new URL(request.url);
      fwd.pathname = '/push/unsubscribe';
      fwd.searchParams.set('roomCode', roomCode);
      const sessionId =
        request.headers.get('x-session-id') ||
        new URL(request.url).searchParams.get('sessionId') ||
        '';
      if (sessionId) fwd.searchParams.set('sessionId', sessionId);
      return stub.fetch(new Request(fwd.toString(), request));
    }

    const pendingMatch = url.pathname.match(/^\/api\/room\/([a-zA-Z0-9]+)\/push\/pending$/);
    if (pendingMatch && request.method === 'GET') {
      const roomCode = pendingMatch[1].toUpperCase();
      const id = env.GAME_ROOM.idFromName(roomCode);
      const stub = env.GAME_ROOM.get(id);
      const fwd = new URL(request.url);
      fwd.pathname = '/push/pending';
      fwd.searchParams.set('roomCode', roomCode);
      return stub.fetch(new Request(fwd.toString(), request));
    }

    if (url.pathname === '/api/push/pending' && request.method === 'GET') {
      return Response.json({}, { status: 200 });
    }

    // API: Health check
    if (url.pathname === '/api/health') {
      return Response.json({ status: 'ok', timestamp: Date.now() });
    }

    // API: WebSocket endpoint for rooms (/api/room/:code/ws)
    const match = url.pathname.match(/^\/api\/room\/([a-zA-Z0-9]+)\/ws$/);
    if (match) {
      const roomCode = match[1].toUpperCase();
      const id = env.GAME_ROOM.idFromName(roomCode);
      const stub = env.GAME_ROOM.get(id);

      // Pass request directly to Durable Object
      const forwardUrl = new URL(request.url);
      forwardUrl.searchParams.set('roomCode', roomCode);
      const forwardRequest = new Request(forwardUrl.toString(), request);

      return stub.fetch(forwardRequest);
    }

    // Fallback: Serve static assets via Cloudflare Assets binding
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response('Not Found', { status: 404 });
  },
};
