import { db } from "./firebase.js";
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, deleteDoc, where, getDocs, updateDoc } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { loginUser, verificarYCrearUsuarioDefecto, registrarNuevoUsuario, actualizarNombreUsuario, eliminarUsuario, cambiarPasswordUsuario } from "./auth.js";

let currentUser = null;
let activeChatId = null; 

// Desuscriptores en tiempo real
let unsubscribeChatsList = null;
let unsubscribeChatMessages = null;
let unsubscribeUsuariosAdmin = null; 

let listaIniciada = false; 
let replyTarget = null; 
const IMGBB_API_KEY = "4a52316c7553d2229d68717ee77998fa";

// 🔊 FUNCIÓN SINTETIZADORA DE SONIDO (Estilo Notificación Móvil)
function reproducirSonidoNotificacion() {
    try {
        const context = new (window.AudioContext || window.webkitAudioContext)();
        
        // Tono 1
        const osc1 = context.createOscillator();
        const gain1 = context.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(587.33, context.currentTime); 
        gain1.gain.setValueAtTime(0.06, context.currentTime);
        gain1.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.08);
        osc1.connect(gain1);
        gain1.connect(context.destination);
        osc1.start();
        osc1.stop(context.currentTime + 0.08);
        
        // Tono 2
        setTimeout(() => {
            const osc2 = context.createOscillator();
            const gain2 = context.createGain();
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(880, context.currentTime); 
            gain2.gain.setValueAtTime(0.06, context.currentTime);
            gain2.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.12);
            osc2.connect(gain2);
            gain2.connect(context.destination);
            osc2.start();
            osc2.stop(context.currentTime + 0.12);
        }, 70);
    } catch (e) {
        console.log("Audio bloqueado temporalmente por el navegador.");
    }
}

function mostrarPantallaSegunRol(user) {
    document.getElementById("login-container").classList.add("hidden");
    document.getElementById("admin-panel").classList.add("hidden");
    document.getElementById("chat-room-view").classList.add("hidden");
    document.getElementById("chats-list-view").classList.remove("hidden");

    document.getElementById("chats-user-info").innerText = `${user.usuario} (${user.rol})`;

    const btnCrearGrupo = document.getElementById("btn-crear-grupo-view");
    if (user.rol === "superadmin" || user.rol === "admin") {
        btnCrearGrupo.classList.remove("hidden");
    } else {
        btnCrearGrupo.classList.add("hidden");
    }

    const adminBtn = document.getElementById("admin-btn");
    if (user.rol === "superadmin") {
        adminBtn.classList.remove("hidden");
    } else {
        adminBtn.classList.add("hidden");
    }

    escucharListaDeChats();
}
function escucharListaDeChats() {
    if (unsubscribeChatsList) unsubscribeChatsList();
    listaIniciada = false; 

    const q = query(collection(db, "chats"), where("participantes", "array-contains", currentUser.usuario));

    unsubscribeChatsList = onSnapshot(q, (snapshot) => {
        const chatsArr = [];
        snapshot.forEach((docSnap) => {
            chatsArr.push({ id: docSnap.id, ...docSnap.data() });
        });

        chatsArr.sort((a, b) => {
            const tiempoA = a.ultimaFecha?.toDate ? a.ultimaFecha.toDate().getTime() : 0;
            const tiempoB = b.ultimaFecha?.toDate ? b.ultimaFecha.toDate().getTime() : 0;
            return tiempoB - tiempoA;
        });

        const listaBox = document.getElementById("lista-chats-items");
        listaBox.innerHTML = "";

        if (chatsArr.length === 0) {
            listaBox.innerHTML = `<div style="text-align:center; color:#667781; margin-top:30px; font-size:0.9rem; padding: 20px;">No tienes chats activos.<br>¡Crea un grupo o inicia un chat individual arriba!</div>`;
            listaIniciada = true;
            return;
        }

        chatsArr.forEach((chat) => {
            const divRow = document.createElement("div");
            divRow.className = "chat-item-row";

            let nombreMostrar = chat.nombre;
            let icono = "👥";
            let subetiqueta = "Grupo familiar";

            if (chat.tipo === "individual") {
                nombreMostrar = chat.participantes.find(p => p !== currentUser.usuario) || currentUser.usuario;
                icono = "👤";
                subetiqueta = "Chat privado";
            }

            divRow.onclick = () => abrirSalaChat(chat.id, nombreMostrar, subetiqueta);
            
            divRow.innerHTML = `
                <div class="chat-avatar">${icono}</div>
                <div class="chat-row-details">
                    <span class="chat-row-title">${nombreMostrar}</span>
                    <span class="chat-row-meta">${subetiqueta}</span>
                </div>
            `;
            listaBox.appendChild(divRow);
        });

        // ... (todo el código anterior de escucharListaDeChats queda igual)
        if (listaIniciada) {
            snapshot.docChanges().forEach(change => {
                if (change.type === "modified" || change.type === "added") {
                    const chatData = change.doc.data();
                    if (chatData.ultimoRemitente && chatData.ultimoRemitente !== currentUser.usuario) {
                        
                        // 🔊 Reproduce el sonido de notificación que ya tenías
                        reproducirSonidoNotificacion();
                        
                        // 📳 Vibración estilo WhatsApp (Pulso de 100ms, pausa de 50ms, pulso de 100ms)
                        if ('vibrate' in navigator) {
                            navigator.vibrate([100, 50, 100]);
                        }
                        
                    }
                }
            });
        }
        listaIniciada = true;
    });
}
async function abrirSalaChat(chatId, nombreChat, subetiqueta) {
    activeChatId = chatId;
    cancelarRespuesta();

    document.getElementById("chats-list-view").classList.add("hidden");
    document.getElementById("chat-room-view").classList.remove("hidden");
    
    document.getElementById("active-chat-title").innerText = nombreChat;
    document.getElementById("active-chat-status").innerText = `• ${subetiqueta}`;

    if (unsubscribeChatMessages) unsubscribeChatMessages();

    const q = query(collection(db, "chats", chatId, "mensajes"), orderBy("fecha", "asc"));
    const chatBox = document.getElementById("chat-box");

    unsubscribeChatMessages = onSnapshot(q, (snapshot) => {
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

            let fechaMensaje = datos.fecha?.toDate ? datos.fecha.toDate() : new Date();
            const horas = String(fechaMensaje.getHours()).padStart(2, '0');
            const minutos = String(fechaMensaje.getMinutes()).padStart(2, '0');
            let horaFormateada = `${horas}:${minutos}`;

            const esMio = datos.remitente === currentUser.usuario;
            const esSuperAdmin = currentUser.rol === "superadmin";

            let botonBorrar = "";
            if (esMio || esSuperAdmin) {
                botonBorrar = `<span class="delete-btn" onclick="eliminarMensaje('${idDoc}')" title="Eliminar mensaje">🗑️</span>`;
            }

            let textoPreview = "📝 Mensaje";
            if (datos.texto) {
                textoPreview = datos.texto.replace(/'/g, "\\'").replace(/"/g, '&quot;');
            } else if (datos.imagenUrl) {
                textoPreview = "📷 Imagen";
            }

            let botonResponder = `<span class="reply-btn" onclick="seleccionarRespuesta('${idDoc}', '${textoPreview}', '${datos.remitente}')" title="Responder">↩️</span>`;

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
                contenidoMensaje = `<img src="${datos.imagenUrl}" style="max-width: 100%; max-height: 220px; border-radius: 6px; display: block; margin-top: 5px; cursor: pointer; box-shadow: 0 1px 3px rgba(0,0,0,0.15);" onclick="window.open('${datos.imagenUrl}', '_blank')">`;
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
async function login() {
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
}

async function enviarMensaje() {
    const input = document.getElementById("msg-input");
    const texto = input.value.trim();
    if (!texto || !activeChatId) return;

    try {
        const nuevoMensaje = {
            texto: texto,
            remitente: currentUser.usuario,
            fecha: serverTimestamp()
        };

        if (replyTarget) nuevoMensaje.replyTo = replyTarget;

        input.value = "";
        cancelarRespuesta();

        await addDoc(collection(db, "chats", activeChatId, "mensajes"), nuevoMensaje);
        await updateDoc(doc(db, "chats", activeChatId), { 
            ultimaFecha: serverTimestamp(),
            ultimoRemitente: currentUser.usuario 
        });
    } catch (e) {
        console.error("Error enviando texto:", e);
    }
}

// Vinculación global para que responda el HTML tradicional
window.login = login;
window.enviarMensaje = enviarMensaje;

window.logout = function(){
    if (unsubscribeChatsList) unsubscribeChatsList();
    if (unsubscribeChatMessages) unsubscribeChatMessages();
    if (unsubscribeUsuariosAdmin) unsubscribeUsuariosAdmin(); 
    localStorage.removeItem("user");
    location.reload();
};

window.volverAListaChats = function() {
    if (unsubscribeChatMessages) unsubscribeChatMessages();
    activeChatId = null;
    document.getElementById("chat-room-view").classList.add("hidden");
    document.getElementById("chats-list-view").classList.remove("hidden");
    escucharListaDeChats();
};

window.abrirModalGrupo = async function() {
    const listContainer = document.getElementById("group-users-list");
    listContainer.innerHTML = "<p style='padding:10px;'>Cargando red familiar...</p>";
    document.getElementById("modal-grupo").classList.remove("hidden");

    try {
        const snap = await getDocs(collection(db, "usuarios"));
        listContainer.innerHTML = "";
        snap.forEach(docSnap => {
            const u = docSnap.data().usuario;
            if (u !== currentUser.usuario) {
                const item = document.createElement("label");
                item.className = "checklist-item";
                item.innerHTML = `<input type="checkbox" class="group-user-checkbox" value="${u}"> <span>${u}</span>`;
                listContainer.appendChild(item);
            }
        });
    } catch(e) {
        console.error(e);
    }
};
window.cerrarModalGrupo = function() {
    document.getElementById("modal-grupo").classList.add("hidden");
    document.getElementById("group-name-input").value = "";
};

window.crearGrupoConfirmar = async function() {
    const nameInput = document.getElementById("group-name-input").value.trim();
    if (!nameInput) return alert("Por favor, escribe un nombre para el grupo.");

    const checkboxes = document.querySelectorAll(".group-user-checkbox:checked");
    const participantes = [currentUser.usuario];
    checkboxes.forEach(cb => participantes.push(cb.value));

    if (participantes.length < 2) return alert("Selecciona al menos a un integrante para armar el grupo.");

    try {
        const nuevoGrupo = {
            tipo: "grupo",
            nombre: nameInput,
            participantes: participantes,
            creador: currentUser.usuario,
            ultimaFecha: serverTimestamp(),
            ultimoRemitente: currentUser.usuario
        };

        const docRef = await addDoc(collection(db, "chats"), nuevoGrupo);
        cerrarModalGrupo();
        abrirSalaChat(docRef.id, nameInput, "Grupo familiar");
    } catch(e) {
        alert("Error al crear el grupo.");
    }
};

window.abrirModalDM = async function() {
    const listContainer = document.getElementById("dm-users-list");
    listContainer.innerHTML = "<p style='padding:10px;'>Cargando familiares...</p>";
    document.getElementById("modal-dm").classList.remove("hidden");

    try {
        const snap = await getDocs(collection(db, "usuarios"));
        listContainer.innerHTML = "";
        snap.forEach(docSnap => {
            const u = docSnap.data().usuario;
            if (u !== currentUser.usuario) {
                const item = document.createElement("div");
                item.className = "checklist-item";
                item.style.fontWeight = "600";
                item.innerText = `👤 ${u}`;
                item.onclick = () => iniciarChatIndividual(u);
                listContainer.appendChild(item);
            }
        });
    } catch(e) {
        console.error(e);
    }
};

window.cerrarModalDM = function() {
    document.getElementById("modal-dm").classList.add("hidden");
};

async function iniciarChatIndividual(otroUsuario) {
    cerrarModalDM();
    try {
        const q = query(collection(db, "chats"), where("tipo", "==", "individual"), where("participantes", "array-contains", currentUser.usuario));
        const snapshot = await getDocs(q);
        let chatExistenteId = null;

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            if (data.participantes.includes(otroUsuario)) {
                chatExistenteId = docSnap.id;
            }
        });

        if (chatExistenteId) {
            abrirSalaChat(chatExistenteId, otroUsuario, "Chat privado");
        } else {
            const nuevoChatPrivado = {
                tipo: "individual",
                nombre: "",
                participantes: [currentUser.usuario, otroUsuario],
                ultimaFecha: serverTimestamp(),
                ultimoRemitente: currentUser.usuario
            };
            const docRef = await addDoc(collection(db, "chats"), nuevoChatPrivado);
            abrirSalaChat(docRef.id, otroUsuario, "Chat privado");
        }
    } catch(e) {
        console.error(e);
    }
}
window.abrirGaleria = function() { document.getElementById("gallery-input").click(); };
window.abrirCamara = function() { document.getElementById("camera-input").click(); };

window.subirFoto = async function(elementoInput) {
    const archivo = elementoInput.files[0];
    if (!archivo || !activeChatId) return;

    if (!archivo.type.startsWith("image/")) {
        alert("Por favor, selecciona únicamente archivos de imagen.");
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

            if (replyTarget) nuevoMensaje.replyTo = replyTarget;

            cancelarRespuesta();
            await addDoc(collection(db, "chats", activeChatId, "mensajes"), nuevoMensaje);
            await updateDoc(doc(db, "chats", activeChatId), { 
                ultimaFecha: serverTimestamp(),
                ultimoRemitente: currentUser.usuario 
            });
        } else {
            throw new Error();
        }
    } catch (e) {
        alert("Hubo un problema al subir la foto.");
    } finally {
        msgInput.disabled = false;
        msgInput.placeholder = placeholderOriginal;
        elementoInput.value = ""; 
    }
};

window.eliminarMensaje = async function(idDoc) {
    if (!confirm("¿Quieres eliminar este mensaje para todos?")) return;
    try {
        await deleteDoc(doc(db, "chats", activeChatId, "mensajes", idDoc));
    } catch (e) {
        console.error(e);
    }
};
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

function escucharUsuariosAdmin() {
    if (unsubscribeUsuariosAdmin) unsubscribeUsuariosAdmin();
    const listaBox = document.getElementById("lista-usuarios");

    unsubscribeUsuariosAdmin = onSnapshot(collection(db, "usuarios"), (snapshot) => {
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

window.crearNuevoUsuarioAdmin = async function() {
    const usuario = document.getElementById("reg-usuario").value.trim();
    const password = document.getElementById("reg-password").value.trim();
    const rol = document.getElementById("reg-rol").value;
    const adminRegMsg = document.getElementById("admin-reg-msg");

    adminRegMsg.innerText = "";

    if (!usuario || !password) {
        adminRegMsg.style.color = "red";
        adminRegMsg.innerText = "Por favor, completa el nombre de usuario y la contraseña.";
        return;
    }

    try {
        await registrarNuevoUsuario(usuario, password, rol);
        adminRegMsg.style.color = "green";
        adminRegMsg.innerText = `¡Familiar '${usuario}' registrado con éxito como ${rol}!`;
        
        document.getElementById("reg-usuario").value = "";
        document.getElementById("reg-password").value = "";
    } catch (e) {
        adminRegMsg.style.color = "red";
        adminRegMsg.innerText = e.message;
    }
};

window.panelDarBaja = async function(usuario) {
    if (!confirm(`¿Estás seguro de dar de BAJA a '${usuario}'?`)) return;
    try { await eliminarUsuario(usuario); alert("Usuario eliminado."); } catch(e) { alert(e.message); }
};

window.panelCambiarClave = async function(usuario) {
    const nuevaClave = prompt(`Nueva contraseña para '${usuario}':`);
    if (!nuevaClave || !nuevaClave.trim()) return;
    try { await cambiarPasswordUsuario(usuario, nuevaClave); alert("Contraseña actualizada."); } catch(e) { alert(e.message); }
};
window.cambiarNombreFamiliar = async function() {
    const actual = document.getElementById("edit-usuario-actual").value;
    const nuevo = document.getElementById("edit-usuario-nuevo").value;
    const adminMsg = document.getElementById("admin-msg");
    adminMsg.innerText = "";

    try {
        const nombreFinal = await actualizarNombreUsuario(actual, nuevo);
        adminMsg.style.color = "green";
        adminMsg.innerText = `¡Cambiado con éxito!`;

        if (currentUser.usuario === actual.trim().toLowerCase()) {
            currentUser.usuario = nombreFinal;
            localStorage.setItem("user", JSON.stringify(currentUser));
        }
        document.getElementById("edit-usuario-actual").value = "";
        document.getElementById("edit-usuario-nuevo").value = "";
    } catch (e) {
        adminMsg.style.color = "red";
        adminMsg.innerText = e.message;
    }
};

window.abrirPanelAdmin = function() {
    document.getElementById("chats-list-view").classList.add("hidden");
    document.getElementById("admin-panel").classList.remove("hidden");
    escucharUsuariosAdmin(); 
};

window.volverAlAppDesdeAdmin = function() {
    if (unsubscribeUsuariosAdmin) unsubscribeUsuariosAdmin(); 
    document.getElementById("admin-panel").classList.add("hidden");
    document.getElementById("chats-list-view").classList.remove("hidden");
};

// ⌨️ ATAJOS DE TECLADO (Enter para mandar mensajes o loguear)
document.addEventListener("keypress", function(e) {
    if (e.key === "Enter") {
        if (document.activeElement === document.getElementById("msg-input")) {
            enviarMensaje();
        } else if (document.activeElement === document.getElementById("password") || document.activeElement === document.getElementById("usuario")) {
            login();
        }
    }
});

// ⚡ INICIALIZACIÓN INMUNE A ERRORES (Actualizada para pedir Notificaciones)
async function inicializarApp() {
    try { await verificarYCrearUsuarioDefecto(); } catch (err) {}
    
    // 🔔 SOLICITUD DE PERMISO PARA ALERTAS FLOTANTES
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
    
    try {
        const saved = localStorage.getItem("user");
        if (saved && saved !== "undefined") {
            currentUser = JSON.parse(saved);
            if (currentUser && currentUser.usuario) {
                mostrarPantallaSegunRol(currentUser);
            }
        }
    } catch(e) {
        console.error("Error cargando sesión anterior:", e);
        localStorage.removeItem("user");
    }
}
inicializarApp();
