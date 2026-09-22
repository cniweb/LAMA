self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', () => {});

self.addEventListener('push', (event) => {
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
  const title = data.title || 'LAMA \u2013 Du bist am Zug!';
  const body = data.body || 'Dein Zug wartet. Tippe um direkt zum Spiel zu springen.';
  const url = data.url || (data.roomCode ? `/?room=${data.roomCode}` : '/');
  const roomCode = data.roomCode || null;
  const tag = roomCode ? `lama-turn-${roomCode}` : 'lama-turn';

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icon.svg',
      badge: '/icon.svg',
      data: { url, roomCode },
      vibrate: [100, 50, 100],
      tag,
      renotify: true,
      requireInteraction: false,
    })
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
