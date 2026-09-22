import { useCallback, useEffect, useState } from 'react';
import { getOrCreateSessionId } from './useGameSocket.js';

type PermissionState = NotificationPermission | 'unsupported';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
  return out;
}

function arrayBufferToBase64Url(buffer: ArrayBuffer | null): string {
  if (!buffer) return '';
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function fetchVapidPublicKey(): Promise<string | null> {
  try {
    const res = await fetch('/api/push/vapidPublicKey');
    if (!res.ok) return null;
    const data = (await res.json()) as { publicKey?: string };
    return data.publicKey || null;
  } catch {
    return null;
  }
}

export function usePushSubscription(roomCode: string | null) {
  const [permission, setPermission] = useState<PermissionState>(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
    return Notification.permission;
  });
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [vapidKey, setVapidKey] = useState<string | null>(null);

  const isSupported =
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window;

  useEffect(() => {
    if (!isSupported) return;
    fetchVapidPublicKey().then((k) => setVapidKey(k));

    const check = async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        setIsSubscribed(!!sub);
      } catch {
        setIsSubscribed(false);
      }
    };
    check();

    // Listen for permission changes via visibility
    const onFocus = async () => {
      if ('Notification' in window) setPermission(Notification.permission);
      await check();
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [isSupported]);

  useEffect(() => {
    if (!isSupported || !roomCode || !isSubscribed) return;
    navigator.serviceWorker.ready
      .then((reg) => {
        const sw = reg.active || navigator.serviceWorker.controller;
        sw?.postMessage({ type: 'LAMA_SET_ROOM', roomCode });
      })
      .catch(() => {});
  }, [roomCode, isSubscribed, isSupported]);

  const subscribe = useCallback(async () => {
    if (!isSupported || !roomCode) return false;
    if (Notification.permission === 'denied') return false;

    let perm: NotificationPermission = Notification.permission;
    if (perm !== 'granted') {
      perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') return false;
    }

    const publicKey = vapidKey || (await fetchVapidPublicKey());
    if (!publicKey) {
      console.warn('VAPID public key not available');
      return false;
    }

    setIsBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
        });
      }
      const p256dh = arrayBufferToBase64Url(sub.getKey('p256dh'));
      const auth = arrayBufferToBase64Url(sub.getKey('auth'));
      const sessionId = getOrCreateSessionId();
      const payload = {
        endpoint: sub.endpoint,
        keys: { p256dh, auth },
        roomCode,
        sessionId,
      };
      const res = await fetch(`/api/room/${encodeURIComponent(roomCode)}/push/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-session-id': sessionId },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Subscribe failed');
      setIsSubscribed(true);
      try {
        const reg = await navigator.serviceWorker.ready;
        const sw = reg.active || navigator.serviceWorker.controller;
        sw?.postMessage({ type: 'LAMA_SET_ROOM', roomCode });
      } catch {}
      return true;
    } catch (e) {
      console.error('Push subscribe failed', e);
      return false;
    } finally {
      setIsBusy(false);
    }
  }, [isSupported, roomCode, vapidKey]);

  const unsubscribe = useCallback(async () => {
    if (!isSupported || !roomCode) return false;
    setIsBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const sessionId = getOrCreateSessionId();
        await fetch(`/api/room/${encodeURIComponent(roomCode)}/push/unsubscribe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-session-id': sessionId },
          body: JSON.stringify({ endpoint: sub.endpoint, sessionId }),
        });
        await sub.unsubscribe();
      }
      setIsSubscribed(false);
      return true;
    } catch (e) {
      console.error('Push unsubscribe failed', e);
      return false;
    } finally {
      setIsBusy(false);
    }
  }, [isSupported, roomCode]);

  return { permission, isSupported, isSubscribed, isBusy, subscribe, unsubscribe };
}
