// 1. Instalar la base de OneSignal
importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");

const CACHE_NAME = 'chat-familiar-v2'; // Cambié la versión para forzar actualización

// 2. Tu caché offline
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(['./', './index.html']))
  );
  self.skipWaiting(); // Fuerza a que el celular tome esta versión YA MISMO
});

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});

// 3. Tu lógica personalizada de notificaciones Push de Firebase
self.addEventListener('push', function(event) {
    // Si la alerta viene de OneSignal, lo dejamos pasar, no interferimos.
    if (event.data && event.data.text().includes("onesignal")) return;

    let datos = {
        titulo: "Chat Familiar",
        texto: "Tienes mensajes nuevos sin leer.",
        url: "./index.html"
    };

    if (event.data) {
        try {
            const dataExtra = event.data.json();
            if (dataExtra.notification) {
                datos.titulo = dataExtra.notification.title || datos.titulo;
                datos.texto = dataExtra.notification.body || datos.texto;
            } else {
                datos.titulo = dataExtra.titulo || datos.titulo;
                datos.texto = dataExtra.texto || datos.texto;
            }
        } catch(e) {
            datos.texto = event.data.text();
        }
    }

    const opciones = {
        body: datos.texto,
        icon: 'https://cdn-icons-png.flaticon.com/512/5968/5968771.png',
        badge: 'https://cdn-icons-png.flaticon.com/512/5968/5968771.png',
        vibrate: [200, 100, 200, 100, 200],
        data: { url: datos.url }
    };

    event.waitUntil(
        self.registration.showNotification(datos.titulo, opciones)
    );
});

self.addEventListener('notificationclick', (event) => {
  // Solo interceptamos si no es de OneSignal
  if (event.notification.data && event.notification.data.onesignal) return;
  
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      if (clientList.length > 0) {
        return clientList[0].focus();
      }
      return clients.openWindow('./index.html');
    })
  );
});
