import type { GameVariant } from '@lama/shared';
import { GameRoom } from './game-room.js';

export { GameRoom };

export interface Env {
  GAME_ROOM: DurableObjectNamespace<GameRoom>;
  ASSETS: Fetcher;
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
