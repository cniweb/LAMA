import type { CardValue, ClientMessage, ClientRoomView, ServerMessage } from '@lama/shared';
import { useCallback, useEffect, useRef, useState } from 'react';

const SESSION_KEY = 'lama_session_id';
const NAME_KEY = 'lama_player_name';

const BASE_RECONNECT_MS = 1000;
const MAX_RECONNECT_MS = 30_000;
const RECONNECT_JITTER_MS = 500;

export function getOrCreateSessionId(): string {
  let sid = localStorage.getItem(SESSION_KEY);
  if (!sid) {
    sid = `sid_${Math.random().toString(36).substring(2, 10)}${Date.now().toString(36)}`;
    localStorage.setItem(SESSION_KEY, sid);
  }
  return sid;
}

export function getSavedPlayerName(): string {
  return localStorage.getItem(NAME_KEY) || '';
}

export function savePlayerName(name: string): void {
  localStorage.setItem(NAME_KEY, name.trim());
}

export function useGameSocket(roomCode: string | null, playerName: string) {
  const [state, setState] = useState<ClientRoomView | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ text: string; tone: string } | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const sessionIdRef = useRef<string>(getOrCreateSessionId());
  const connectRef = useRef(() => {});
  const leftRoomRef = useRef(false);

  const sendMessage = useCallback((msg: ClientMessage) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(msg));
    }
  }, []);

  /**
   * Plant einen Reconnect mit exponentiellem Backoff + Jitter (1s, 2s, 4s, …
   * gedeckelt bei 30s). Im Hintergrund-Tab wird nichts geplant – das übernimmt
   * der visibilitychange-Handler bei Rückkehr. Schont Akku und Serverbudget.
   * Der Aufruf läuft über connectRef, damit kein Verwendungs-vor-Deklaration-
   * Zyklus mit `connect` entsteht.
   */
  const scheduleReconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (!roomCode || !playerName || document.hidden || leftRoomRef.current) {
      return;
    }
    const backoff = Math.min(
      MAX_RECONNECT_MS,
      BASE_RECONNECT_MS * 2 ** Math.min(reconnectAttemptRef.current, 5)
    );
    reconnectAttemptRef.current += 1;
    reconnectTimeoutRef.current = setTimeout(
      () => {
        connectRef.current();
      },
      backoff + Math.random() * RECONNECT_JITTER_MS
    );
  }, [roomCode, playerName]);

  const connect = useCallback(() => {
    if (!roomCode || !playerName || leftRoomRef.current) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const url = `${protocol}//${host}/api/room/${roomCode}/ws?sessionId=${encodeURIComponent(
      sessionIdRef.current
    )}&playerName=${encodeURIComponent(playerName)}&roomCode=${encodeURIComponent(roomCode)}`;

    const ws = new WebSocket(url);
    socketRef.current = ws;

    ws.onopen = () => {
      reconnectAttemptRef.current = 0;
      setIsConnected(true);
      setError(null);
    };

    ws.onmessage = (event) => {
      try {
        const msg: ServerMessage = JSON.parse(event.data);
        if (msg.type === 'STATE_UPDATE') {
          setState(msg.state);
        } else if (msg.type === 'ERROR') {
          setError(msg.message);
          setTimeout(() => setError(null), 4000);
        } else if (msg.type === 'NOTIFICATION') {
          setNotification({ text: msg.text, tone: msg.tone });
          setTimeout(() => setNotification(null), 3500);
        }
      } catch (e) {
        console.error('Failed to parse websocket message', e);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      scheduleReconnect();
    };

    ws.onerror = () => {
      setError('Verbindung zum Server unterbrochen.');
    };
  }, [roomCode, playerName, scheduleReconnect]);

  useEffect(() => {
    connectRef.current = connect;
  });

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [connect]);

  connectRef.current = connect;

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.hidden) {
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
        return;
      }
      if (socketRef.current?.readyState !== WebSocket.OPEN) {
        reconnectAttemptRef.current = 0;
        scheduleReconnect();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [scheduleReconnect]);

  // Actions
  const startGame = useCallback(() => sendMessage({ type: 'START_GAME' }), [sendMessage]);
  const playCard = useCallback(
    (card: CardValue) => sendMessage({ type: 'PLAY_CARD', card }),
    [sendMessage]
  );
  const drawCard = useCallback(() => sendMessage({ type: 'DRAW_CARD' }), [sendMessage]);
  const fold = useCallback(() => sendMessage({ type: 'FOLD' }), [sendMessage]);
  const discardChip = useCallback(
    (chipType: 'white' | 'black') => sendMessage({ type: 'DISCARD_CHIP', chipType }),
    [sendMessage]
  );
  const nextRound = useCallback(() => sendMessage({ type: 'NEXT_ROUND' }), [sendMessage]);
  const exchangeChips = useCallback(() => sendMessage({ type: 'EXCHANGE_CHIPS' }), [sendMessage]);
  const newGame = useCallback(() => sendMessage({ type: 'NEW_GAME' }), [sendMessage]);
  const leaveRoom = useCallback(() => {
    leftRoomRef.current = true;
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    sendMessage({ type: 'LEAVE_ROOM' });
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    setState(null);
    setIsConnected(false);
  }, [sendMessage]);

  // Raumwechsel (neuer roomCode): Leave-Flag zurücksetzen.
  useEffect(() => {
    leftRoomRef.current = false;
  }, [roomCode]);

  return {
    state,
    isConnected,
    error,
    notification,
    actions: {
      startGame,
      playCard,
      drawCard,
      fold,
      discardChip,
      nextRound,
      exchangeChips,
      newGame,
      leaveRoom,
    },
  };
}
