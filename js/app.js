import { db } from "./firebase.js";
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, deleteDoc, where, getDocs, updateDoc, deleteField, arrayUnion } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { loginUser, verificarYCrearUsuarioDefecto, registrarNuevoUsuario, actualizarNombreUsuario, eliminarUsuario, cambiarPasswordUsuario } from "./auth.js";

// 🚨 DETECTOR DE ERRORES GLOBAL
window.addEventListener('error', function(e) {
    alert("⚠️ Error detectado:\n" + e.message + "\n\nArchivo: " + e.filename + "\nLínea: " + e.lineno);
});

let currentUser = null;
let activeChatId = null; 
let unsubscribeChatsList = null;
let unsubscribeChatMessages = null;
let unsubscribeUsuariosAdmin = null; 
let listaIniciada = false; 
let replyTarget = null; 
const IMGBB_API_KEY = "4a52316c7553d2229d68717ee77998fa";

// 🔊 SINTETIZADOR DE AUDIO
function reproducirSonidoNotificacion() {
    try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;
        const context = new AudioContextClass();
        
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
        
        setTimeout(() => {
            try {
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
            } catch(e2) {}
        }, 70);
    } catch (e) { console.log("Audio retenido."); }
}

function mostrarPantallaSegunRol(user) {
    const alternarOculto = (id, agregar) => {
        const el = document.getElementById(id);
        if (el) {
            if (agregar) el.classList.add("hidden");
            else el.classList.remove("hidden");
        }
    };

    alternarOculto("login-container", true);
    alternarOculto("admin-panel", true);
    alternarOculto("chat-room-view", true);
    alternarOculto("chats-list-view", false);

    const infoUser = document.getElementById("chats-user-info");
    if (infoUser) infoUser.innerText = `${user.usuario} (${user.rol})`;

    const btnCrearGrupo = document.getElementById("btn-crear-grupo-view");
    if (btnCrearGrupo) {
        if (user.rol === "superadmin" || user.rol === "admin") btnCrearGrupo.classList.remove("hidden");
        else btnCrearGrupo.classList.add("hidden");
    }

    const adminBtn = document.getElementById("admin-btn");
    if (adminBtn) {
        if (user.rol === "superadmin") adminBtn.classList.remove("hidden");
        else adminBtn.classList.add("hidden");
    }

    escucharListaDeChats();
}

// 📌 TU FUNCIÓN ESCUCHAR CHATS
function escucharListaDeChats() {
    if (!currentUser) return;
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
        if (listaBox) {
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

                // 🌟 PASANDO LOS PARTICIPANTES A LA FUNCIÓN AL HACER CLIC
                divRow.onclick = () => abrirSalaChat(chat.id, nombreMostrar, subetiqueta, chat.participantes);
                
                divRow.innerHTML = `
                    <div class="chat-avatar">${icono}</div>
                    <div class="chat-row-details">
                        <span class="chat-row-title">${nombreMostrar}</span>
                        <span class="chat-row-meta">${subetiqueta}</span>
                    </div>
                `;
                listaBox.appendChild(divRow);
            });
        }

        if (listaIniciada) {
            snapshot.docChanges().forEach(change => {
                if (change.type === "modified" || change.type === "added") {
                    const chatId = change.doc.id;
                    const chatData = change.doc.data();
                    
                    if (chatData.ultimoRemitente && chatData.ultimoRemitente !== currentUser.usuario && activeChatId !== chatId) {
                        reproducirSonidoNotificacion();
                        
                        if ('vibrate' in navigator) navigator.vibrate([100, 50, 100]);
                        
                        if ('Notification' in window && Notification.permission === 'granted') {
                            let tituloAlerta = `Mensaje de ${chatData.ultimoRemitente}`;
                            if (chatData.tipo === "grupo") {
                                tituloAlerta = `${chatData.ultimoRemitente} en "${chatData.nombre}"`;
                            }

                            if ('serviceWorker' in navigator) {
                                navigator.serviceWorker.ready.then((registration) => {
                                    registration.showNotification(tituloAlerta, {
                                        body: "¡Tienes mensajes nuevos sin leer!",
                                        icon: "https://cdn-icons-png.flaticon.com/512/5968/5968771.png",
                                        tag: chatId,
                                        renovate: true,
                                        vibrate: [100, 50, 100]
                                    });
                                });
                            }
                        }
                    }
                }
            });
        }
        listaIniciada = true;
    });
}

// 📌 TU FUNCIÓN ABRIR SALA CHAT
async function abrirSalaChat(chatId, nombreChat, subetiqueta, participantesArr = []) {
    activeChatId = chatId;
    cancelarRespuesta();

    const btnAgregar = document.getElementById("btn-agregar-integrante");
    if (btnAgregar) {
        if (subetiqueta.includes("Grupo") && currentUser && (currentUser.rol === "admin" || currentUser.rol === "superadmin")) {
            btnAgregar.classList.remove("hidden");
        } else {
            btnAgregar.classList.add("hidden");
        }
    }

    const elLista = document.getElementById("chats-list-view");
    const elSala = document.getElementById("chat-room-view");
    if (elLista) elLista.classList.add("hidden");
    if (elSala) elSala.classList.remove("hidden");
    
    const titleEl = document.getElementById("active-chat-title");
    const statusEl = document.getElementById("active-chat-status");
    if (titleEl) titleEl.innerText = nombreChat;
    
    // 🌟 RENDERIZADO DINÁMICO DEL ENCABEZADO
    if (statusEl) {
        if (subetiqueta.includes("Grupo") && participantesArr && participantesArr.length > 0) {
            statusEl.innerText = `• ${participantesArr.length} integrantes: ${participantesArr.join(", ")}`;
        } else {
            statusEl.innerText = `• ${subetiqueta}`;
        }
    }

    if (unsubscribeChatMessages) unsubscribeChatMessages();

    const q = query(collection(db, "chats", chatId, "mensajes"), orderBy("fecha", "asc"));
    const chatBox = document.getElementById("chat-box");
    if (!chatBox) return;

    unsubscribeChatMessages = onSnapshot(q, (snapshot) => {
        chatBox.innerHTML = "";

        snapshot.forEach((docSnap) => {
            const datos = docSnap.data();
            const idDoc = docSnap.id;
            const docRef = docSnap.ref;

            if (datos.remitente !== currentUser.usuario && datos.leido === false) {
                updateDoc(docRef, { leido: true }).catch(err => 
                    console.error("Error al actualizar estado de lectura:", err)
                );
            }

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

            let deleteButton = "";
            if (esMio || esSuperAdmin) {
                deleteButton = `<span class="delete-btn" onclick="eliminarMensaje('${idDoc}')" title="Eliminar mensaje">🗑️</span>`;
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
                contenidoMensaje = `<span style="display:block;">${datos.texto || ''}</span>`;
            }

            let tildesHtml = "";
            if (datos.remitente === currentUser.usuario) {
                if (datos.leido === true) {
                    tildesHtml = `<span style="color: #53bdeb; margin-left: 5px; font-weight: bold; font-size: 0.9em;">✓✓</span>`;
                } else {
                    tildesHtml = `<span style="color: #8696a0; margin-left: 5px; font-size: 0.9em;">✓</span>`;
                }
            }

            const miReaccionActual = datos.reacciones ? (datos.reacciones[currentUser.usuario] || "") : "";
            let reaccionesHtml = "";
            
            if (datos.reacciones && Object.keys(datos.reacciones).length > 0) {
                reaccionesHtml = `<div class="msg-reactions">`;
                const conteoReacciones = {};
                
                for (const user in datos.reacciones) {
                    const emo = datos.reacciones[user];
                    if (emo) {
                        conteoReacciones[emo] = (conteoReacciones[emo] || 0) + 1;
                    }
                }
                for (const emo in conteoReacciones) {
                    reaccionesHtml += `<span class="reaction-badge">${emo} <small>${conteoReacciones[emo]}</small></span>`;
                }
                reaccionesHtml += `</div>`;
            }

            let botonReaccionar = `<span class="react-btn" onclick="togglePicker('${idDoc}')" title="Reaccionar">😀</span>`;
            
            let pickerHtml = `
                <div class="reactions-picker hidden" id="picker-${idDoc}">
                    <span class="${miReaccionActual === '👍' ? 'active-emo' : ''}" onclick="enviarReaccion('${idDoc}', '👍', '${miReaccionActual}')">👍</span>
                    <span class="${miReaccionActual === '❤️' ? 'active-emo' : ''}" onclick="enviarReaccion('${idDoc}', '❤️', '${miReaccionActual}')">❤️</span>
                    <span class="${miReaccionActual === '😂' ? 'active-emo' : ''}" onclick="enviarReaccion('${idDoc}', '😂', '${miReaccionActual}')">😂</span>
                    <span class="${miReaccionActual === '😮' ? 'active-emo' : ''}" onclick="enviarReaccion('${idDoc}', '😮', '${miReaccionActual}')">😮</span>
                    <span class="${miReaccionActual === '🙏' ? 'active-emo' : ''}" onclick="enviarReaccion('${idDoc}', '🙏', '${miReaccionActual}')">🙏</span>
                </div>
            `;

            divMensaje.innerHTML = `
                <span class="msg-meta">${datos.remitente}</span> 
                ${bloqueCita}
                ${contenidoMensaje}
                ${reaccionesHtml}
                <span class="msg-time">${horaFormateada}${tildesHtml}</span>
                ${botonReaccionar}
                ${botonResponder}
                ${deleteButton}
                ${pickerHtml}
            `;
            chatBox.appendChild(divMensaje);
        });

        chatBox.scrollTop = chatBox.scrollHeight;
    });
}

// --- VINCULACIONES GLOBALES (Solucionan el ReferenceError del Botón) ---
window.login = async function login() {
    const elUser = document.getElementById("usuario");
    const elPass = document.getElementById("password");
    const errorBox = document.getElementById("error") || document.getElementById("login-error");

    if (errorBox) errorBox.innerText = "";
    if (!elUser || !elPass) return;

    const usuario = elUser.value.trim().toLowerCase();
    const password = elPass.value.trim();

    if (!usuario || !password) {
        if (errorBox) errorBox.innerText = "Escribe tu usuario y contraseña.";
        return;
    }

    try {
        const user = await loginUser(usuario, password);
        currentUser = user;
        localStorage.setItem("user", JSON.stringify(user));
        mostrarPantallaSegunRol(user);
    } catch(e) {
        if (errorBox) errorBox.innerText = e.message;
        else alert("Error al ingresar: " + e.message);
    }
};

window.enviarMensaje = async function enviarMensaje() {
    const input = document.getElementById("msg-input");
    if (!input) return;
    const texto = input.value.trim();
    if (!texto || !activeChatId) return;

    try {
        const nuevoMensaje = {
            texto: texto,
            remitente: currentUser.usuario,
            fecha: serverTimestamp(),
            leido: false
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
        console.error("Error sending message:", e);
    }
};

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
    const elSala = document.getElementById("chat-room-view");
    const elLista = document.getElementById("chats-list-view");
    if (elSala) elSala.classList.add("hidden");
    if (elLista) elLista.classList.remove("hidden");
    escucharListaDeChats();
};

window.abrirModalGrupo = async function() {
    const listContainer = document.getElementById("group-users-list");
    if (!listContainer) return;
    listContainer.innerHTML = "<p style='padding:10px;'>Cargando red familiar...</p>";
    
    const mGrupo = document.getElementById("modal-grupo");
    if (mGrupo) mGrupo.classList.remove("hidden");

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
        
    } catch(e) { console.error(e); }
};

window.cerrarModalGrupo = function() {
    const mGrupo = document.getElementById("modal-grupo");
    if (mGrupo) mGrupo.classList.add("hidden");
    const gInput = document.getElementById("group-name-input");
    if (gInput) gInput.value = "";
};

// 📌 TU FUNCIÓN CREAR GRUPO
window.crearGrupoConfirmar = async function() {
    const gInput = document.getElementById("group-name-input");
    const nameInput = gInput ? gInput.value.trim() : "";
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
        // 🌟 PASANDO LOS PARTICIPANTES
        abrirSalaChat(docRef.id, nameInput, "Grupo familiar", participantes);
    } catch(e) { alert("Error al crear el grupo."); }
};
window.abrirModalDM = async function() {
    const listContainer = document.getElementById("dm-users-list");
    if (!listContainer) return;
    listContainer.innerHTML = "<p style='padding:10px;'>Cargando familiares...</p>";
    
    const mDm = document.getElementById("modal-dm");
    if (mDm) mDm.classList.remove("hidden");

    try {
        const snap = await getDocs(collection(db, "usuarios"));
        listContainer.innerHTML = "";
        snap.forEach(docSnap => {
            const u = docSnap.data().usuario;
            if (u !== currentUser.usuario) {
                const item = document.createElement("div");
                item.className = "checklist-item";
                item.style.fontWeight = "600";
                item.style.cursor = "pointer";
                item.innerText = `👤 ${u}`;
                item.onclick = () => iniciarChatIndividual(u);
                listContainer.appendChild(item);
            }
        });
    } catch(e) { console.error(e); }
};

window.cerrarModalDM = function() {
    const mDm = document.getElementById("modal-dm");
    if (mDm) mDm.classList.add("hidden");
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

        const arrayPrivado = [currentUser.usuario, otroUsuario];

        if (chatExistenteId) {
            abrirSalaChat(chatExistenteId, otroUsuario, "Chat privado", arrayPrivado);
        } else {
            const nuevoChatPrivado = {
                tipo: "individual",
                nombre: "",
                participantes: arrayPrivado,
                ultimaFecha: serverTimestamp(),
                ultimoRemitente: currentUser.usuario
            };
            const docRef = await addDoc(collection(db, "chats"), nuevoChatPrivado);
            abrirSalaChat(docRef.id, otroUsuario, "Chat privado", arrayPrivado);
        }
    } catch(e) { console.error(e); }
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
    const placeholderOriginal = msgInput ? msgInput.placeholder : "";
    if (msgInput) {
        msgInput.disabled = true;
        msgInput.placeholder = "Subiendo imagen familiar... ⏳";
    }

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
                fecha: serverTimestamp(),
                leido: false
            };

            if (replyTarget) nuevoMensaje.replyTo = replyTarget;

            cancelarRespuesta();
            await addDoc(collection(db, "chats", activeChatId, "mensajes"), nuevoMensaje);
            await updateDoc(doc(db, "chats", activeChatId), { 
                ultimaFecha: serverTimestamp(),
                ultimoRemitente: currentUser.usuario 
            });
        } else { throw new Error(); }
    } catch (e) {
        alert("Hubo un problema al subir la foto.");
    } finally {
        if (msgInput) {
            msgInput.disabled = false;
            msgInput.placeholder = placeholderOriginal;
        }
        elementoInput.value = ""; 
    }
};
    window.eliminarMensaje = async function(idDoc) {
    if (!confirm("¿Quieres eliminar este mensaje para todos?")) return;
    try { await deleteDoc(doc(db, "chats", activeChatId, "mensajes", idDoc)); } 
    catch (e) { console.error(e); }
};

window.seleccionarRespuesta = function(id, texto, remitente) {
    replyTarget = { msgId: id, texto: texto, remitente: remitente };
    const rUser = document.getElementById("reply-preview-user");
    const rText = document.getElementById("reply-preview-text");
    const rBox = document.getElementById("reply-preview-box");
    const mInput = document.getElementById("msg-input");

    if (rUser) rUser.innerText = `Respondiendo a ${remitente}`;
    if (rText) rText.innerText = texto;
    if (rBox) rBox.classList.remove("hidden");
    if (mInput) mInput.focus();
};

window.cancelarRespuesta = function() {
    replyTarget = null;
    const rBox = document.getElementById("reply-preview-box");
    if (rBox) rBox.classList.add("hidden");
};

function escucharUsuariosAdmin() {
    if (unsubscribeUsuariosAdmin) unsubscribeUsuariosAdmin();
    const listaBox = document.getElementById("lista-usuarios");
    if (!listaBox) return;

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

    if (adminRegMsg) adminRegMsg.innerText = "";

    if (!usuario || !password) {
        if (adminRegMsg) {
            adminRegMsg.style.color = "red";
            adminRegMsg.innerText = "Por favor, completa el nombre de usuario y la contraseña.";
        }
        return;
    }

    try {
        await registrarNuevoUsuario(usuario, password, rol);
        if (adminRegMsg) {
            adminRegMsg.style.color = "green";
            adminRegMsg.innerText = `¡Familiar '${usuario}' registrado con éxito como ${rol}!`;
        }
        document.getElementById("reg-usuario").value = "";
        document.getElementById("reg-password").value = "";
    } catch (e) {
        if (adminRegMsg) {
            adminRegMsg.style.color = "red";
            adminRegMsg.innerText = e.message;
        }
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
    if (adminMsg) adminMsg.innerText = "";

    try {
        const nombreFinal = await actualizarNombreUsuario(actual, nuevo);
        if (adminMsg) {
            adminMsg.style.color = "green";
            adminMsg.innerText = `¡Cambiado con éxito!`;
        }

        if (currentUser && currentUser.usuario === actual.trim().toLowerCase()) {
            currentUser.usuario = nombreFinal;
            localStorage.setItem("user", JSON.stringify(currentUser));
        }
        document.getElementById("edit-usuario-actual").value = "";
        document.getElementById("edit-usuario-nuevo").value = "";
    } catch (e) {
        if (adminMsg) {
            adminMsg.style.color = "red";
            adminMsg.innerText = e.message;
        }
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
    if (adminMsg) adminMsg.innerText = "";

    try {
        const nombreFinal = await actualizarNombreUsuario(actual, nuevo);
        if (adminMsg) {
            adminMsg.style.color = "green";
            adminMsg.innerText = `¡Cambiado con éxito!`;
        }

        if (currentUser && currentUser.usuario === actual.trim().toLowerCase()) {
            currentUser.usuario = nombreFinal;
            localStorage.setItem("user", JSON.stringify(currentUser));
        }
        document.getElementById("edit-usuario-actual").value = "";
        document.getElementById("edit-usuario-nuevo").value = "";
    } catch (e) {
        if (adminMsg) {
            adminMsg.style.color = "red";
            adminMsg.innerText = e.message;
        }
    }
};

window.abrirPanelAdmin = function() {
    const elLista = document.getElementById("chats-list-view");
    const elAdmin = document.getElementById("admin-panel");
    if (elLista) elLista.classList.add("hidden");
    if (elAdmin) elAdmin.classList.remove("hidden");
    escucharUsuariosAdmin(); 
};

window.volverAlAppDesdeAdmin = function() {
    if (unsubscribeUsuariosAdmin) unsubscribeUsuariosAdmin(); 
    const elAdmin = document.getElementById("admin-panel");
    const elLista = document.getElementById("chats-list-view");
    if (elAdmin) elAdmin.classList.add("hidden");
    if (elLista) elLista.classList.remove("hidden");
};

window.togglePicker = function(idDoc) {
    const picker = document.getElementById(`picker-${idDoc}`);
    if (picker) { picker.classList.toggle("hidden"); }
};

window.enviarReaccion = async function(idDoc, emoji, reaccionActual) {
    if (!activeChatId || !currentUser) return;
    const picker = document.getElementById(`picker-${idDoc}`);
    if (picker) picker.classList.add("hidden");

    try {
        const docRef = doc(db, "chats", activeChatId, "mensajes", idDoc);
        if (reaccionActual === emoji) {
            await updateDoc(docRef, { [`reacciones.${currentUser.usuario}`]: deleteField() });
        } else {
            await updateDoc(docRef, { [`reacciones.${currentUser.usuario}`]: emoji });
        }
    } catch (e) { console.error("Error gestionando reacción:", e); }
};

// --- FUNCIONES EXCLUSIVAS DE AGREGAR MIEMBROS ---
window.abrirModalAgregarIntegrante = async function() {
    const modal = document.getElementById("modal-agregar-integrante");
    const container = document.getElementById("lista-usuarios-agregar");
    if (!modal || !container || !activeChatId) return;

    modal.classList.remove("hidden");
    container.innerHTML = "Cargando familiares... ⏳";

    try {
        const chatsSnap = await getDocs(query(collection(db, "chats")));
        let participantesActuales = [];
        chatsSnap.forEach(d => {
            if (d.id === activeChatId) participantesActuales = d.data().participantes || [];
        });

        const usersSnap = await getDocs(collection(db, "usuarios"));
        container.innerHTML = "";
        let contadorOpciones = 0;

        usersSnap.forEach(docSnap => {
            const u = docSnap.data().usuario;
            if (!participantesActuales.includes(u)) {
                contadorOpciones++;
                const label = document.createElement("label");
                label.style.display = "flex";
                label.style.alignItems = "center";
                label.style.gap = "10px";
                label.style.cursor = "pointer";
                label.innerHTML = `<input type="checkbox" class="add-user-checkbox" value="${u}"> <span style="color:#111b21;">${u}</span>`;
                container.appendChild(label);
            }
        });

        if (contadorOpciones === 0) {
            container.innerHTML = "<div style='color:#667781; font-size:0.9rem; text-align:center;'>Todos los familiares ya son miembros.</div>";
        }
    } catch (e) {
        console.error("Error al abrir listado:", e);
        container.innerHTML = "Error al cargar la lista.";
    }
};

window.cerrarModalAgregarIntegrante = function() {
    const modal = document.getElementById("modal-agregar-integrante");
    if (modal) modal.classList.add("hidden");
};

window.ejecutarAgregarIntegrantes = async function() {
    if (!activeChatId) return;
    const checkboxes = document.querySelectorAll(".add-user-checkbox:checked");
    if (checkboxes.length === 0) {
        alert("Por favor, selecciona al menos a un familiar.");
        return;
    }

    const seleccionados = Array.from(checkboxes).map(cb => cb.value);

    try {
        const chatRef = doc(db, "chats", activeChatId);
        await updateDoc(chatRef, { participantes: arrayUnion(...seleccionados) });
        alert("¡Familiares agregados con éxito al grupo! 🎉");
        cerrarModalAgregarIntegrante();
    } catch (err) {
        alert("No se pudieron añadir los integrantes: " + err.message);
    }
};

// ⌨️ ATAJOS DE TECLADO
document.addEventListener("keydown", function(e) {
    if (e.key === "Enter") {
        const msgIn = document.getElementById("msg-input");
        const passIn = document.getElementById("password");
        const userIn = document.getElementById("usuario");

        if (document.activeElement === msgIn) {
            window.enviarMensaje();
        } else if (document.activeElement === passIn || document.activeElement === userIn) {
            window.login();
        }
    }
});

// ⚡ INICIALIZACIÓN
async function inicializarApp() {
    try { await verificarYCrearUsuarioDefecto(); } catch (err) {}
    
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('Service Worker registrado'))
            .catch(err => console.error('Fallo al registrar:', err));
    }
    
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
        localStorage.removeItem("user");
    }
}
inicializarApp();
