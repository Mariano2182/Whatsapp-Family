const CACHE_NAME = 'chat-familiar-v1';

// 📦 1. INSTALACIÓN Y CACHÉ (Tu código original)
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

// 🚀 2. NUEVO: EL RECEPTOR DE MENSAJES EN SEGUNDO PLANO
self.addEventListener('push', function(event) {
    let datos = {
        titulo: "Chat Familiar",
        texto: "Tienes mensajes nuevos sin leer.",
        url: "./index.html"
    };

    // Intentamos extraer el texto exacto que nos envía Firebase
    if (event.data) {
        try {
            const dataExtra = event.data.json();
            if (dataExtra.notification) {
                datos.titulo = dataExtra.notification.title || datos.titulo;
                datos.texto = dataExtra.notification.body || datos.texto;
            } else {
                // Formato de datos personalizado
                datos.titulo = dataExtra.titulo || datos.titulo;
                datos.texto = dataExtra.texto || datos.texto;
            }
        } catch(e) {
            datos.texto = event.data.text();
        }
    }

    // 📳 ACÁ ESTÁ LA MAGIA: Vibración estilo WhatsApp y diseño de alerta
    const opciones = {
        body: datos.texto,
        icon: 'https://cdn-icons-png.flaticon.com/512/5968/5968771.png', // Reemplaza por el ícono de tu app si lo tienes local
        badge: 'https://cdn-icons-png.flaticon.com/512/5968/5968771.png', // Iconito para la barra de estado superior
        vibrate: [200, 100, 200, 100, 200], // Patrón: Vibra, pausa, vibra, pausa, vibra
        data: { url: datos.url }
    };

    // Le ordena al sistema operativo del celular que despierte y muestre la alerta
    event.waitUntil(
        self.registration.showNotification(datos.titulo, opciones)
    );
});

// 🖱️ 3. CLIC EN LA NOTIFICACIÓN (Tu código original)
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
