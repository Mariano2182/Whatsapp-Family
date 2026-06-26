import { db } from "./firebase.js";
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { loginUser, verificarYCrearUsuarioDefecto, registrarNuevoUsuario, actualizarNombreUsuario, eliminarUsuario, cambiarPasswordUsuario } from "./auth.js";

let currentUser = null;
let unsubscribeChat = null;
let unsubscribeUsuarios = null; 

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

        snapshot.forEach((docSnap) => {
            const datos = docSnap.data();
            const idDoc = docSnap.id; 
            const divMensaje = document.createElement("div");

            if (datos.remitente === currentUser.usuario) {
                divMensaje.className = "msg msg-envio";
            } else {
                divMensaje.className = "msg msg-recepcion";
            }

            let horaFormateada = "";
            let fechaMensaje = null;

            if (datos.fecha && typeof datos.fecha.toDate === "function") {
                fechaMensaje = datos.fecha.toDate();
            } else {
                fechaMensaje = new Date();
            }

            const horas = String(fechaMensaje.getHours()).padStart(2, '0');
            const minutos = String(fechaMensaje.getMinutes()).padStart(2, '0');
            horaFormateada = `${horas}:${minutos}`;

            const esMio = datos.remitente === currentUser.usuario;
            const esSuperAdmin = currentUser.rol === "superadmin";

            let botonBorrar = "";
            if (esMio || esSuperAdmin) {
                botonBorrar = `<span class="delete-btn" onclick="eliminarMensaje('${idDoc}')" title="Eliminar para todos">🗑️</span>`;
            }

            divMensaje.innerHTML = `
                <span class="msg-meta">${datos.remitente}</span> 
                <span style="display:block;">${datos.texto}</span>
                <span class="msg-time">${horaFormateada}</span>
                ${botonBorrar}
            `;
            chatBox.appendChild(divMensaje);
        });

        chatBox.scrollTop = chatBox.scrollHeight;
    });
}

// MODIFICADO: Aplica el escudo visual a 'marian' en la lista en tiempo real
function escucharUsuariosAdmin() {
    if (unsubscribeUsuarios) unsubscribeUsuarios();
    const listaBox = document.getElementById("lista-usuarios");

    unsubscribeUsuarios = onSnapshot(collection(db, "usuarios"), (snapshot) => {
        listaBox.innerHTML = "";

        snapshot.forEach((docSnap) => {
            const u = docSnap.data();
            const divItem = document.createElement("div");
            divItem.className = "user-item";

            let botonesAccion = "";
            
            // MODIFICADO: El escudo ahora protege a 'marian'
            if (u.usuario !== "marian") {
                botonesAccion = `
                    <div>
                        <button onclick="panelCambiarClave('${u.usuario}')" style="background:#34b7f1; color:white; border:none; padding:5px 8px; border-radius:3px; cursor:pointer; font-size:0.8em; font-weight:bold; margin-right:4px;">🔑 Clave</button>
                        <button onclick="panelDarBaja('${u.usuario}')" style="background:#ff3b30; color:white; border:none; padding:5px 8px; border-radius:3px; cursor:pointer; font-size:0.8em; font-weight:bold;">🗑️ Baja</button>
                    </div>
                `;
            } else {
                botonesAccion = `<span style="color:#00a884; font-size:0.8em; font-weight:bold; font-style:italic;">👑 Creador</span>`;
            }

            divItem.innerHTML = `<span><strong>${u.usuario}</strong> (${u.rol})</span> ${botonesAccion}`;
            listaBox.appendChild(divItem);
        });
    });
}

window.panelDarBaja = async function(usuario) {
    const confirmar = confirm(`¿Estás completamente seguro de dar de BAJA la cuenta de '${usuario}'? No podrá volver a loguearse.`);
    if (!confirmar) return;

    try {
        await eliminarUsuario(usuario);
        alert(`La cuenta de '${usuario}' fue eliminada del sistema con éxito.`);
    } catch(e) {
        alert(e.message);
    }
};

window.panelCambiarClave = async function(usuario) {
    const nuevaClave = prompt(`Escribe la NUEVA CONTRASEÑA para el familiar '${usuario}':`);
    if (nuevaClave === null) return;
    
    if (!nuevaClave.trim()) {
        alert("Error: La contraseña no puede estar en blanco.");
        return;
    }

    try {
        await cambiarPasswordUsuario(usuario, nuevaClave);
        alert(`¡Contraseña de '${usuario}' actualizada e encriptada correctamente!`);
    } catch(e) {
        alert(e.message);
    }
};

window.eliminarMensaje = async function(idDoc) {
    const confirmar = confirm("¿Estás seguro de que quieres eliminar este mensaje para todos?");
    if (!confirmar) return;

    try {
        await deleteDoc(doc(db, "mensajes", idDoc));
    } catch (e) {
        console.error("Error al eliminar el mensaje:", e);
    }
};

window.cambiarNombreFamiliar = async function() {
    const actual = document.getElementById("edit-usuario-actual").value;
    const nuevo = document.getElementById("edit-usuario-nuevo").value;
    const adminMsg = document.getElementById("admin-msg");

    adminMsg.innerText = "";

    try {
        const nombreFinal = await actualizarNombreUsuario(actual, nuevo);
        adminMsg.style.color = "green";
        adminMsg.innerText = `¡Éxito! Se cambió el nombre de '${actual}' a '${nombreFinal}'.`;

        if (currentUser.usuario === actual.trim().toLowerCase()) {
            currentUser.usuario = nombreFinal;
            localStorage.setItem("user", JSON.stringify(currentUser));
            document.getElementById("user-info").innerText = `Usuario: ${currentUser.usuario} | Rol: ${currentUser.rol}`;
        }

        document.getElementById("edit-usuario-actual").value = "";
        document.getElementById("edit-usuario-nuevo").value = "";
    } catch (e) {
        adminMsg.style.color = "red";
        adminMsg.innerText = e.message;
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
    if (unsubscribeUsuarios) unsubscribeUsuarios(); 
    localStorage.removeItem("user");
    location.reload();
};

window.abrirPanelAdmin = function() {
    document.getElementById("app").classList.add("hidden");
    document.getElementById("admin-panel").classList.remove("hidden");
    document.getElementById("admin-msg").innerText = "";
    escucharUsuariosAdmin(); 
};

window.volverAlApp = function() {
    if (unsubscribeUsuarios) unsubscribeUsuarios(); 
    document.getElementById("admin-panel").classList.add("hidden");
    document.getElementById("app").classList.remove("hidden");
    const chatBox = document.getElementById("chat-box");
    chatBox.scrollTop = chatBox.scrollHeight;
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
