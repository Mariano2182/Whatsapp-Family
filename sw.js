const CACHE_NAME = 'chat-familiar-v4';

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (e) => {
  const url = e.request.url;
  
  // NUNCA INTERCEPTAR FIREBASE
  if (url.includes('firestore.googleapis.com') || url.includes('googleapis.com')) {
      return; 
  }

  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});

// Manejo de clicks en notificaciones nativas
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('index.html') && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow('./index.html');
    })
  );
});
