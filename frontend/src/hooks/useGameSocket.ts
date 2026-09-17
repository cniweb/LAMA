import type { CardValue, ClientMessage, ClientRoomView, ServerMessage } from '@lama/shared';
import { useCallback, useEffect, useRef, useState } from 'react';

const SESSION_KEY = 'lama_session_id';
const NAME_KEY = 'lama_player_name';

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
  const sessionIdRef = useRef<string>(getOrCreateSessionId());

  const sendMessage = useCallback((msg: ClientMessage) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const connect = useCallback(() => {
    if (!roomCode || !playerName) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const url = `${protocol}//${host}/api/room/${roomCode}/ws?sessionId=${encodeURIComponent(
      sessionIdRef.current
    )}&playerName=${encodeURIComponent(playerName)}&roomCode=${encodeURIComponent(roomCode)}`;

    const ws = new WebSocket(url);
    socketRef.current = ws;

    ws.onopen = () => {
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
      // Auto-reconnect after 2 seconds
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, 2000);
    };

    ws.onerror = () => {
      setError('Verbindung zum Server unterbrochen.');
    };
  }, [roomCode, playerName]);

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
    },
  };
}
