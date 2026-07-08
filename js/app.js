import { db } from "./firebase.js";
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { loginUser, verificarYCrearUsuarioDefecto, registrarNuevoUsuario } from "./auth.js";

let currentUser = null;
let unsubscribeChat = null; // Guardará el escuchador activo del chat

// Controla qué elementos gráficos mostrar basados en los permisos y activa el chat
function mostrarPantallaSegunRol(user) {
    document.getElementById("login-container").classList.add("hidden");
    document.getElementById("admin-panel").classList.add("hidden");
    document.getElementById("app").classList.remove("hidden");

    document.getElementById("user-info").innerText = `Usuario: ${user.usuario} | Rol: ${user.rol}`;

    // FILTRO DE SEGURIDAD: Revelar el botón secreto si eres superadmin
    const adminBtn = document.getElementById("admin-btn");
    if (user.rol === "superadmin") {
        adminBtn.classList.remove("hidden");
    } else {
        adminBtn.classList.add("hidden");
    }

    // ACTIVAR EL CHAT EN TIEMPO REAL
    cargarChatEnTiempoReal();
}

// ESCUCHADOR ACTIVO: Trae los mensajes de Firebase ordenados por tiempo
function cargarChatEnTiempoReal() {
    // Si ya había un escuchador prendido, lo apagamos para no duplicar
    if (unsubscribeChat) unsubscribeChat();

    const q = query(collection(db, "mensajes"), orderBy("fecha", "asc"));
    const chatBox = document.getElementById("chat-box");

    unsubscribeChat = onSnapshot(q, (snapshot) => {
        chatBox.innerHTML = ""; // Limpiamos la caja para refrescar los datos

        snapshot.forEach((doc) => {
            const datos = doc.data();
            const divMensaje = document.createElement("div");

            // Si el mensaje lo envió el usuario actual, va a la derecha (verde), si no a la izquierda (blanco)
            if (datos.remitente === currentUser.usuario) {
                divMensaje.className = "msg msg-envio";
            } else {
                divMensaje.className = "msg msg-recepcion";
            }

            // Estructura interna de la burbuja (Nombre arriba y texto abajo)
            divMensaje.innerHTML = `<span class="msg-meta">${datos.remitente}</span> ${datos.texto}`;
            chatBox.appendChild(divMensaje);
        });

        // Auto-scroll hacia abajo para ver el último mensaje enviado
        chatBox.scrollTop = chatBox.scrollHeight;
    });
}

// FUNCIÓN PARA ENVIAR MENSAJE A FIREBASE
window.enviarMensaje = async function() {
    const input = document.getElementById("msg-input");
    const texto = input.value.trim();

    if (!texto) return; // Evita enviar mensajes vacíos

    try {
        await addDoc(collection(db, "mensajes"), {
            texto: texto,
            remitente: currentUser.usuario,
            fecha: serverTimestamp() // Hora exacta del servidor de Firebase
        });
        input.value = ""; // Limpiamos el input de texto
    } catch (e) {
        console.error("Error al enviar mensaje:", e);
    }
};

window.login = async function(){
    const usuario = document.getElementById("usuario").value;
    const password = document.getElementById("password").value;
    const error = document.getElementById("error");
    error.innerText = "";

    try {
        const user = await loginUser(usuario, password);
        currentUser = user;
        localStorage.setItem("user", JSON.stringify(user));
        mostrarPantallaSegunRol(user);
    } catch(e) {
        error.innerText = e.message;
    }
};

window.logout = function(){
    if (unsubscribeChat) unsubscribeChat(); // Apaga el chat antes de salir
    localStorage.removeItem("user");
    location.reload();
};

window.abrirPanelAdmin = function() {
    document.getElementById("app").classList.add("hidden");
    document.getElementById("admin-panel").classList.remove("hidden");
    document.getElementById("admin-msg").innerText = "";
};

window.volverAlApp = function() {
    document.getElementById("admin-panel").classList.add("hidden");
    document.getElementById("app").classList.remove("hidden");
    // Al volver, recalculamos el scroll del chat
    const chatBox = document.getElementById("chat-box");
    chatBox.scrollTop = chatBox.scrollHeight;
};

window.crearFamiliar = async function() {
    const nuevoUser = document.getElementById("nuevo-usuario").value;
    const nuevaPass = document.getElementById("nueva-password").value;
    const nuevoRol = document.getElementById("nuevo-rol").value;
    const adminMsg = document.getElementById("admin-msg");

    adminMsg.innerText = "";

    try {
        await registrarNuevoUsuario(nuevoUser, nuevaPass, nuevoRol);
        adminMsg.style.color = "green";
        adminMsg.innerText = `¡Éxito! Cuenta de '${nuevoUser}' creada.`;
        document.getElementById("nuevo-usuario").value = "";
        document.getElementById("nueva-password").value = "";
    } catch (e) {
        adminMsg.style.color = "red";
        adminMsg.innerText = e.message;
    }
};

// Permitir enviar el mensaje también apretando la tecla "Enter"
document.addEventListener("keypress", function(e) {
    if (e.key === "Enter" && document.activeElement === document.getElementById("msg-input")) {
        enviarMensaje();
    }
});

window.onload = async function(){
    try {
        await verificarYCrearUsuarioDefecto();
    } catch (err) {
        console.error("Error al inicializar datos:", err);
    }

    const saved = localStorage.getItem("user");
    if (saved) {
        const user = JSON.parse(saved);
        currentUser = user;
        mostrarPantallaSegunRol(user);
    }
};
