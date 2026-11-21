// Kill-switch untuk menghapus Service Worker dev mode PWA lama dari browser pengguna
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        if (typeof caches !== 'undefined') {
          const cacheNames = await caches.keys();
          await Promise.all(cacheNames.map((name) => caches.delete(name)));
        }
      } catch {
        // Abaikan error penghapusan cache
      }

      try {
        await self.registration.unregister();
      } catch {
        // Abaikan error unregister
      }

      try {
        const windowClients = await self.clients.matchAll({
          type: 'window',
          includeUncontrolled: true,
        });
        for (const client of windowClients) {
          if ('navigate' in client && typeof client.navigate === 'function') {
            client.navigate(client.url);
          }
        }
      } catch {
        // Abaikan error navigasi ulang client
      }
    })()
  );
});
