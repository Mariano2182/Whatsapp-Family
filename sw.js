const CACHE_NAME = 'chat-familiar-v5';

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

// 📳 RECEPCIÓN DE NOTIFICACIONES Y VIBRACIÓN EN SEGUNDO PLANO / APP CERRADA
self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: "Chat Familiar", body: event.data.text() };
    }
  }

  const title = data.title || "Nuevo mensaje familiar 💬";
  const options = {
    body: data.body || "Tienes un mensaje nuevo sin leer.",
    icon: "https://cdn-icons-png.flaticon.com/512/5968/5968771.png",
    badge: "https://cdn-icons-png.flaticon.com/512/5968/5968771.png",
    
    // 📳 PATRÓN DE VIBRACIÓN NATIVA DE ANDROID (vibrar, pausa, vibrar, pausa, vibrar)
    vibrate: [200, 100, 200, 100, 200],
    
    tag: data.chatId || 'chat-familiar-notification',
    renotify: true,
    data: {
      url: './index.html'
    }
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Manejo de clicks en notificaciones nativas
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('index.html') && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow('./index.html');
    })
  );
});
