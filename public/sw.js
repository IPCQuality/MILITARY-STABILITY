// Kill-switch untuk menghapus seluruh Service Worker & cache PWA lama
self.addEventListener('install', () => {
  self.skipWaiting();
});

async function purgeWorkboxIndexedDb() {
  try {
    if (typeof indexedDB === 'undefined' || typeof indexedDB.databases !== 'function') {
      return;
    }
    const dbs = await indexedDB.databases();
    await Promise.allSettled(
      dbs
        .map((db) => db && db.name)
        .filter(
          (name) =>
            typeof name === 'string' &&
            (name.startsWith('workbox') || name === 'keyval-store')
        )
        .map(
          (name) =>
            new Promise((resolve) => {
              const req = indexedDB.deleteDatabase(name);
              req.onsuccess = () => resolve();
              req.onerror = () => resolve();
              req.onblocked = () => resolve();
            })
        )
    );
  } catch {
    // Abaikan jika browser membatasi akses indexedDB.databases()
  }
}

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        if (typeof caches !== 'undefined') {
          const cacheNames = await caches.keys();
          await Promise.allSettled(cacheNames.map((name) => caches.delete(name)));
        }
      } catch {
        // Abaikan error penghapusan cache
      }

      await purgeWorkboxIndexedDb();

      try {
        if (self.clients && typeof self.clients.claim === 'function') {
          await self.clients.claim();
        }
      } catch {
        // Abaikan jika claim gagal
      }

      let windowClients = [];
      try {
        windowClients = await self.clients.matchAll({
          type: 'window',
          includeUncontrolled: true,
        });
      } catch {
        windowClients = [];
      }

      try {
        await self.registration.unregister();
      } catch {
        // Abaikan error unregister
      }

      try {
        await Promise.allSettled(
          windowClients.map((client) =>
            'navigate' in client && typeof client.navigate === 'function'
              ? client.navigate(client.url)
              : Promise.resolve()
          )
        );
      } catch {
        // Abaikan error navigasi ulang client
      }
    })()
  );
});
