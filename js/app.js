import { db } from "./firebase.js";
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { loginUser, verificarYCrearUsuarioDefecto, registrarNuevoUsuario, actualizarNombreUsuario, eliminarUsuario, cambiarPasswordUsuario } from "./auth.js";

let currentUser = null;
let unsubscribeChat = null;
let unsubscribeUsuarios = null; 
let replyTarget = null; // Guardará el mensaje al que se está respondiendo

const IMGBB_API_KEY = "4a52316c7553d2229d68717ee77998fa";

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
                botonBorrar = `<span class="delete-btn" onclick="eliminarMensaje('${idDoc}')" title="Eliminar mensaje">🗑️</span>`;
            }

            // Sanitizar texto para evitar que rompa los atributos HTML de las funciones onclick
            const textoLimpio = datos.texto ? datos.texto.replace(/'/g, "\\'").replace(/"/g, '&quot;') : "📷 Imagen";
            let botonResponder = `<span class="reply-btn" onclick="seleccionarRespuesta('${idDoc}', '${textoLimpio}', '${datos.remitente}')" title="Responder">↩️</span>`;

            // Construcción del bloque de respuesta (si el mensaje responde a otro)
            let bloqueCita = "";
            if (datos.replyTo) {
                bloqueCita = `
                    <div class="msg-quote">
                        <span class="msg-quote-user">${datos.replyTo.remitente}</span>
                        <span>${datos.replyTo.texto}</span>
                    </div>
                `;
            }

            let contenidoMensaje = "";
            if (datos.imagenUrl) {
                contenidoMensaje = `<img src="${datos.imagenUrl}" style="max-width: 100%; max-height: 220px; border-radius: 6px; display: block; margin-top: 5px; cursor: pointer; box-shadow: 0 1px 3px rgba(0,0,0,0.15);" onclick="window.open('${datos.imagenUrl}', '_blank')" title="Ver en tamaño completo">`;
            } else {
                contenidoMensaje = `<span style="display:block;">${datos.texto}</span>`;
            }

            divMensaje.innerHTML = `
                <span class="msg-meta">${datos.remitente}</span> 
                ${bloqueCita}
                ${contenidoMensaje}
                <span class="msg-time">${horaFormateada}</span>
                ${botonResponder}
                ${botonBorrar}
            `;
            chatBox.appendChild(divMensaje);
        });

        chatBox.scrollTop = chatBox.scrollHeight;
    });
}

// Funciones para manejar el estado de las respuestas
window.seleccionarRespuesta = function(id, texto, remitente) {
    replyTarget = { msgId: id, texto: texto, remitente: remitente };
    document.getElementById("reply-preview-user").innerText = `Respondiendo a ${remitente}`;
    document.getElementById("reply-preview-text").innerText = texto;
    document.getElementById("reply-preview-box").classList.remove("hidden");
    document.getElementById("msg-input").focus();
};

window.cancelarRespuesta = function() {
    replyTarget = null;
    document.getElementById("reply-preview-box").classList.add("hidden");
};

window.seleccionarFoto = function() {
    document.getElementById("file-input").click();
};

window.subirFoto = async function(elementoInput) {
    const archivo = elementoInput.files[0];
    if (!archivo) return;

    if (!archivo.type.startsWith("image/")) {
        alert("Por favor, selecciona únicamente archivos de imagen (PNG, JPG, GIF).");
        return;
    }

    const msgInput = document.getElementById("msg-input");
    const placeholderOriginal = msgInput.placeholder;
    
    msgInput.disabled = true;
    msgInput.placeholder = "Subiendo imagen familiar... ⏳";

    try {
        const formData = new FormData();
        formData.append("image", archivo);

        const respuesta = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
            method: "POST",
            body: formData
        });

        const resultado = await respuesta.json();

        if (resultado.success) {
            const URLPublica = resultado.data.url;

            const nuevoMensaje = {
                texto: "",
                imagenUrl: URLPublica,
                remitente: currentUser.usuario,
                fecha: serverTimestamp()
            };

            if (replyTarget) {
                nuevoMensaje.replyTo = replyTarget;
            }

            await addDoc(collection(db, "mensajes"), nuevoMensaje);
            cancelarRespuesta();
        } else {
            throw new Error("El servidor de ImgBB rechazó la imagen.");
        }

    } catch (e) {
        console.error("Error en el envío hacia ImgBB:", e);
        alert("Hubo un problema al subir la foto de forma remota.");
    } finally {
        msgInput.disabled = false;
        msgInput.placeholder = placeholderOriginal;
        elementoInput.value = ""; 
    }
};

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
    const confirmar = confirm(`¿Estás seguro de dar de BAJA a '${usuario}'? No podrá volver a ingresar.`);
    if (!confirmar) return;

    try {
        await eliminarUsuario(usuario);
        alert(`La cuenta de '${usuario}' fue removida del sistema.`);
    } catch(e) {
        alert(e.message);
    }
};

window.panelCambiarClave = async function(usuario) {
    const nuevaClave = prompt(`Escribe la nueva contraseña para '${usuario}':`);
    if (nuevaClave === null) return;
    
    if (!nuevaClave.trim()) {
        alert("La contraseña no puede estar vacía.");
        return;
    }

    try {
        await cambiarPasswordUsuario(usuario, nuevaClave);
        alert(`¡Contraseña de '${usuario}' cambiada con éxito!`);
    } catch(e) {
        alert(e.message);
    }
};

window.eliminarMensaje = async function(idDoc) {
    const confirmar = confirm("¿Quieres eliminar este mensaje para todos?");
    if (!confirmar) return;

    try {
        await deleteDoc(doc(db, "mensajes", idDoc));
    } catch (e) {
        console.error("Error al borrar el documento:", e);
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
        adminMsg.innerText = `¡Cambiado con éxito de '${actual}' a '${nombreFinal}'!`;

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
        const nuevoMensaje = {
            texto: texto,
            remitente: currentUser.usuario,
            fecha: serverTimestamp()
        };

        // Si hay una respuesta activa, la metemos al documento
        if (replyTarget) {
            nuevoMensaje.replyTo = replyTarget;
        }

        await addDoc(collection(db, "mensajes"), nuevoMensaje);
        input.value = "";
        cancelarRespuesta(); // Cierra el preview flotante
    } catch (e) {
        console.error("Error enviando texto:", e);
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
