const CACHE_NAME = 'chat-familiar-v1';

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(['./', './index.html']))
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});

// 🔔 Esto maneja qué pasa cuando el usuario hace CLIC en la alerta flotante
self.addEventListener('notificationclick', (event) => {
  event.notification.close(); // Cierra la alerta
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Si la app ya está abierta, la enfoca. Si no, la abre.
      if (clientList.length > 0) {
        return clientList[0].focus();
      }
      return clients.openWindow('./index.html');
    })
  );
});
