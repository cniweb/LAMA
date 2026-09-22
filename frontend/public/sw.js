self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', () => {});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'LAMA_SET_ROOM' && event.data.roomCode) {
    const roomCode = event.data.roomCode.toUpperCase();
    event.waitUntil(
      caches.open('lama-room').then((cache) => cache.put('/last-room', new Response(roomCode)))
    );
  }
});

self.addEventListener('push', (event) => {
  event.waitUntil(
    (async () => {
      let data = {};
      try {
        if (event.data) {
          const text = event.data.text();
          try {
            data = JSON.parse(text);
          } catch {
            if (text) data = { body: text };
          }
        }
      } catch {
        data = {};
      }

      let cachedRoom = null;
      try {
        const cache = await caches.open('lama-room');
        const resp = await cache.match('/last-room');
        if (resp) cachedRoom = (await resp.text()).toUpperCase();
      } catch {}

      if (cachedRoom && !data.roomCode) {
        data.roomCode = cachedRoom;
        data.url = `/?room=${cachedRoom}`;
        if (!data.title) data.title = 'LAMA \u2013 Du bist am Zug!';
        if (!data.body) data.body = `Raum ${cachedRoom} \u2013 du bist dran!`;
      }

      if (data.roomCode) {
        try {
          const sub = await self.registration.pushManager.getSubscription();
          if (sub) {
            const res = await fetch(
              `/api/room/${encodeURIComponent(data.roomCode)}/push/pending?endpoint=${encodeURIComponent(sub.endpoint)}`
            );
            if (res.ok) {
              const pending = await res.json();
              if (pending && pending.roomCode) {
                data = { ...pending, ...data };
                if (!data.url && pending.roomCode) data.url = `/?room=${pending.roomCode}`;
                if (!data.title && pending.title) data.title = pending.title;
                if (!data.body && pending.body) data.body = pending.body;
              }
            }
          }
        } catch {}
      }

      const title = data.title || 'LAMA \u2013 Du bist am Zug!';
      const body = data.body || 'Dein Zug wartet. Tippe um direkt zum Spiel zu springen.';
      const url = data.url || (data.roomCode ? `/?room=${data.roomCode}` : '/');
      const roomCode = data.roomCode || null;
      const tag = roomCode ? `lama-turn-${roomCode}` : 'lama-turn';

      try {
        const allClients = await self.clients.matchAll({
          type: 'window',
          includeUncontrolled: true,
        });
        const hasVisible = allClients.some((c) => {
          try {
            const u = new URL(c.url);
            return (
              c.visibilityState === 'visible' &&
              u.searchParams.get('room')?.toUpperCase() === roomCode
            );
          } catch {
            return false;
          }
        });
        if (hasVisible) return;
      } catch {}

      await self.registration.showNotification(title, {
        body,
        icon: '/icon.svg',
        badge: '/icon.svg',
        data: { url, roomCode },
        vibrate: [100, 50, 100],
        tag,
        renotify: true,
        requireInteraction: false,
      });
    })()
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(url) && 'focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
      return undefined;
    })
  );
});
