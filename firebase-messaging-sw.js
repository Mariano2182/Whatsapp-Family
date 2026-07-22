importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

// ⚙️ PEGA AQUÍ TU CONFIGURACIÓN DE FIREBASE (La misma que usas en firebase.js)
firebase.initializeApp({
    apiKey: "AIzaSyALKug8P2-KqgL8xfKj16So4MgRysmGVV4",
    authDomain: "chat-familiar-app.firebaseapp.com",
    projectId: "chat-familiar-app",
    storageBucket: "chat-familiar-app.firebasestorage.app",
    messagingSenderId: "638014957754",
    appId: "1:638014957754:web:c3437cf4310050bfbb7a83"
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
