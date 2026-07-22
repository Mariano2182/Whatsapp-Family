importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

// ⚙️ PEGA AQUÍ TU CONFIGURACIÓN DE FIREBASE (La misma que usas en firebase.js)
firebase.initializeApp({
    apiKey: "TU_API_KEY",
    authDomain: "tu-app.firebaseapp.com",
    projectId: "chat-familiar-app",
    storageBucket: "tu-app.appspot.com",
    messagingSenderId: "NUMERO_SENDER_ID",
    appId: "TU_APP_ID"
});

const messaging = firebase.messaging();

// 📳 EVENTO QUE SE DISPARA CON LA APP COMPLETAMENTE CERRADA
messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Mensaje recibido en segundo plano:', payload);

    const notificationTitle = payload.notification?.title || "Nuevo mensaje familiar 💬";
    const notificationOptions = {
        body: payload.notification?.body || "Tienes un mensaje sin leer.",
        icon: "https://cdn-icons-png.flaticon.com/512/5968/5968771.png",
        badge: "https://cdn-icons-png.flaticon.com/512/5968/5968771.png",
        
        // 📳 PATRÓN DE VIBRACIÓN NATIVA PARA CELULARES
        vibrate: [200, 100, 200, 100, 200],
        
        tag: 'chat-notification',
        renotify: true,
        data: {
            url: './index.html'
        }
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});

// Al hacer clic en la notificación, abre la aplicación
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if ('focus' in client) return client.focus();
            }
            if (clients.openWindow) return clients.openWindow('./index.html');
        })
    );
});
