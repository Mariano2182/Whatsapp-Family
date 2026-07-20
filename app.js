import { db } from "./firebase.js";
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { loginUser, verificarYCrearUsuarioDefecto } from "./auth.js";

let usuarioActual = null;

// Elementos del DOM
const loginScreen = document.getElementById('login-screen');
const chatScreen = document.getElementById('chat-screen');
const btnLogin = document.getElementById('btn-login');
const inputUser = document.getElementById('username');
const inputPass = document.getElementById('password');
const errorMsg = document.getElementById('error-msg');
const chatBox = document.getElementById('chat-box');
const btnSend = document.getElementById('btn-send');
const msgInput = document.getElementById('msg-input');
const userDisplay = document.getElementById('user-display');

// Al iniciar
window.onload = async () => {
    await verificarYCrearUsuarioDefecto();
    const guardado = localStorage.getItem('chatFamiliarUser');
    if (guardado) {
        usuarioActual = JSON.parse(guardado);
        mostrarChat();
    }
};

// Solicitar permiso para notificaciones
function pedirPermisoNotificaciones() {
    if ("Notification" in window && Notification.permission !== "granted") {
        Notification.requestPermission();
    }
}

// Lógica de Login (SOLUCIONA EL ERROR "login is not defined")
btnLogin.addEventListener('click', async () => {
    const user = inputUser.value;
    const pass = inputPass.value;
    errorMsg.innerText = "Conectando...";
    
    try {
        const data = await loginUser(user, pass);
        usuarioActual = data;
        localStorage.setItem('chatFamiliarUser', JSON.stringify(data));
        pedirPermisoNotificaciones();
        mostrarChat();
    } catch (error) {
        errorMsg.innerText = error.message;
    }
});

function mostrarChat() {
    loginScreen.style.display = 'none';
    chatScreen.style.display = 'flex';
    userDisplay.innerText = usuarioActual.usuario;
    cargarMensajes();
}

// Cargar mensajes en tiempo real
function cargarMensajes() {
    const q = query(collection(db, "mensajes"), orderBy("createdAt"));
    onSnapshot(q, (snapshot) => {
        chatBox.innerHTML = "";
        snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
                const data = change.doc.data();
                
                // NOTIFICACIÓN NATIVA SI LA APP ESTÁ EN SEGUNDO PLANO
                if (document.hidden && data.remitente !== usuarioActual.usuario && Notification.permission === "granted") {
                    navigator.serviceWorker.ready.then(reg => {
                        reg.showNotification(`Mensaje de ${data.remitente}`, {
                            body: data.texto,
                            vibrate: [200, 100, 200]
                        });
                    });
                }
            }
        });

        // Renderizar todos los mensajes
        snapshot.forEach((doc) => {
            const data = doc.data();
            const div = document.createElement('div');
            const esMio = data.remitente === usuarioActual.usuario;
            div.className = `message ${esMio ? 'message-sent' : 'message-received'}`;
            
            const sender = esMio ? '' : `<span class="message-sender">${data.remitente}</span>`;
            div.innerHTML = `${sender}${data.texto}`;
            chatBox.appendChild(div);
        });
        chatBox.scrollTop = chatBox.scrollHeight;
    });
}

// Enviar mensaje
async function enviarMensaje() {
    const texto = msgInput.value.trim();
    if (texto !== "") {
        msgInput.value = ""; // Limpiar rápido
        await addDoc(collection(db, "mensajes"), {
            remitente: usuarioActual.usuario,
            texto: texto,
            createdAt: serverTimestamp()
        });
    }
}

btnSend.addEventListener('click', enviarMensaje);
msgInput.addEventListener('keypress', (e) => { if(e.key === 'Enter') enviarMensaje(); });
