import { db } from "./firebase.js";
// MODIFICADO: Se agregan 'doc' y 'deleteDoc' a las herramientas de Firestore
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { loginUser, verificarYCrearUsuarioDefecto, registrarNuevoUsuario } from "./auth.js";

let currentUser = null;
let unsubscribeChat = null;

function mostrarPantallaSegunRol(user) {
    document.getElementById("login-container").classList.add("hidden");
    document.getElementById("admin-panel").classList.add("hidden");
    document.getElementById("app").classList.remove("hidden");

    document.getElementById("user-info").innerText = `Usuario: ${user.usuario} | Rol: ${user.rol}`;

    const adminBtn = document.getElementById("admin-btn");
    if (user.rol === "superadmin") {
        adminBtn.classList.remove("hidden");
    } else {
        adminBtn.classList.add("hidden");
    }

    cargarChatEnTiempoReal();
}

function cargarChatEnTiempoReal() {
    if (unsubscribeChat) unsubscribeChat();

    const q = query(collection(db, "mensajes"), orderBy("fecha", "asc"));
    const chatBox = document.getElementById("chat-box");

    unsubscribeChat = onSnapshot(q, (snapshot) => {
        chatBox.innerHTML = ""; 

        // Renombramos la variable a docSnap para evitar conflicto con la función doc() de Firebase
        snapshot.forEach((docSnap) => {
            const datos = docSnap.data();
            const idDoc = docSnap.id; // Obtenemos el ID único del mensaje
            const divMensaje = document.createElement("div");

            if (datos.remitente === currentUser.usuario) {
                divMensaje.className = "msg msg-envio";
            } else {
                divMensaje.className = "msg msg-recepcion";
            }

            // REGLA DE BORRADO: ¿Es mi mensaje o soy el superadmin de la red?
            const esMio = datos.remitente === currentUser.usuario;
            const esSuperAdmin = currentUser.rol === "superadmin";

            let botonBorrar = "";
            if (esMio || esSuperAdmin) {
                // Si cumple la condición, le inyectamos la papelera vinculada al ID del mensaje
                botonBorrar = `<span class="delete-btn" onclick="eliminarMensaje('${idDoc}')" title="Eliminar para todos">🗑️</span>`;
            }

            divMensaje.innerHTML = `<span class="msg-meta">${datos.remitente}</span> ${datos.texto} ${botonBorrar}`;
            chatBox.appendChild(divMensaje);
        });

        chatBox.scrollTop = chatBox.scrollHeight;
    });
}

// NUEVA FUNCIÓN GLOBAL: Elimina el mensaje físicamente de la base de datos
window.eliminarMensaje = async function(idDoc) {
    const confirmar = confirm("¿Estás seguro de que quieres eliminar este mensaje para todos?");
    if (!confirmar) return;

    try {
        // Ejecuta el borrado directo en la colección 'mensajes' apuntando al idDoc
        await deleteDoc(doc(db, "mensajes", idDoc));
    } catch (e) {
        console.error("Error al eliminar el mensaje:", e);
        alert("No se pudo eliminar el mensaje. Revisa los permisos.");
    }
};

window.enviarMensaje = async function() {
    const input = document.getElementById("msg-input");
    const texto = input.value.trim();

    if (!texto) return;

    try {
        await addDoc(collection(db, "mensajes"), {
            texto: texto,
            remitente: currentUser.usuario,
            fecha: serverTimestamp()
        });
        input.value = "";
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
    if (unsubscribeChat) unsubscribeChat();
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
