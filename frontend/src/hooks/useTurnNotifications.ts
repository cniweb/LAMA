import type { ClientRoomView } from '@lama/shared';
import { useEffect, useRef } from 'react';

function canNotify(): boolean {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    Notification.permission === 'granted'
  );
}

function triggerLocalNotification(roomCode: string, roundNumber: number) {
  if (!canNotify()) return;
  if (!document.hidden && document.hasFocus()) return;
  try {
    const n = new Notification('LAMA \u2013 Du bist am Zug!', {
      body: `Raum ${roomCode} \u00b7 Durchgang ${roundNumber} \u2013 du bist dran!`,
      icon: '/icon.svg',
      badge: '/icon.svg',
      tag: `lama-turn-${roomCode}`,
    });
    n.onclick = () => {
      window.focus();
      n.close();
      const url = `/?room=${roomCode}`;
      window.history.replaceState({}, '', url);
      window.location.href = url;
    };
    setTimeout(() => n.close(), 8000);
  } catch {
    // Notification blocked or not allowed
  }
}

export function useTurnNotifications(state: ClientRoomView | null) {
  const prevIsTurnRef = useRef<boolean>(false);

  useEffect(() => {
    if (!state) {
      prevIsTurnRef.current = false;
      return;
    }
    const isTurn = state.myPlayer.isTurn && state.phase === 'IN_ROUND';
    const wasNotTurn = !prevIsTurnRef.current;
    if (isTurn && wasNotTurn) {
      triggerLocalNotification(state.roomCode, state.roundNumber);
    }
    prevIsTurnRef.current = isTurn;
  }, [state]);
}
