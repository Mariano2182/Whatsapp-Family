 import { db } from "./firebase.js";
// MODIFICADO: Se agrega 'deleteDoc' a las herramientas importadas de Firestore
import { collection, query, where, getDocs, addDoc, doc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

export async function sha256(text) {
    const msgBuffer = new TextEncoder().encode(text);
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function loginUser(usuario, password) {
    const usuarioLimpio = (typeof usuario === 'string') ? usuario.trim() : String(usuario || "").trim();
    if (!usuarioLimpio) throw new Error("El nombre de usuario no puede estar vacío");

    const q = query(collection(db, "usuarios"), where("usuario", "==", usuarioLimpio));
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) throw new Error("Usuario no existe");

    const docSnap = querySnapshot.docs[0];
    const userData = docSnap.data();

    const hash = await sha256(password);
    if (userData.passwordHash !== hash) throw new Error("Contraseña incorrecta");

    return userData;
}

export async function registrarNuevoUsuario(usuario, password, rol) {
    const userLimpio = usuario.trim().toLowerCase();
    if (!userLimpio || !password.trim()) throw new Error("El nombre y contraseña no pueden estar vacíos.");

    const q = query(collection(db, "usuarios"), where("usuario", "==", userLimpio));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) throw new Error("Ese nombre de usuario ya está registrado.");

    const hashContrasena = await sha256(password.trim());
    await addDoc(collection(db, "usuarios"), {
        usuario: userLimpio,
        passwordHash: hashContrasena,
        rol: rol
    });
    return true;
}

export async function actualizarNombreUsuario(usuarioActual, nuevoUsuario) {
    const actualLimpio = usuarioActual.trim().toLowerCase();
    const nuevoLimpio = nuevoUsuario.trim().toLowerCase();

    if (!actualLimpio || !nuevoLimpio) throw new Error("Ambos campos son obligatorios.");
    if (actualLimpio === nuevoLimpio) throw new Error("El nombre nuevo debe ser diferente al actual.");

    const qNuevo = query(collection(db, "usuarios"), where("usuario", "==", nuevoLimpio));
    const snapNuevo = await getDocs(qNuevo);
    if (!snapNuevo.empty) throw new Error("El nuevo nombre de usuario ya está en uso por alguien más.");

    const qActual = query(collection(db, "usuarios"), where("usuario", "==", actualLimpio));
    const snapActual = await getDocs(qActual);
    if (snapActual.empty) throw new Error("El usuario que intentas modificar no existe.");

    const idUsuarioDoc = snapActual.docs[0].id;
    const userDocRef = doc(db, "usuarios", idUsuarioDoc);
    
    await updateDoc(userDocRef, { usuario: nuevoLimpio });

    const qMensajes = query(collection(db, "mensajes"), where("remitente", "==", actualLimpio));
    const snapMensajes = await getDocs(qMensajes);
    
    const promesasActualizacion = snapMensajes.docs.map(msgDoc => {
        const msgRef = doc(db, "mensajes", msgDoc.id);
        return updateDoc(msgRef, { remitente: nuevoLimpio });
    });
    
    await Promise.all(promesasActualizacion);
    return nuevoLimpio;
}

// NUEVA FUNCIÓN: Elimina una cuenta familiar físicamente de Firestore
export async function eliminarUsuario(usuarioAEliminar) {
    const uLimpio = usuarioAEliminar.trim().toLowerCase();
    if (uLimpio === "nano") throw new Error("Filtro de seguridad: No puedes eliminar la cuenta raíz de superadmin.");

    const q = query(collection(db, "usuarios"), where("usuario", "==", uLimpio));
    const snap = await getDocs(q);
    if (snap.empty) throw new Error("El usuario seleccionado ya no existe en el sistema.");

    const idDoc = snap.docs[0].id;
    await deleteDoc(doc(db, "usuarios", idDoc));
    return true;
}

// NUEVA FUNCIÓN: Encripta una nueva clave y reemplaza la anterior del familiar
export async function cambiarPasswordUsuario(usuarioAEditar, nuevaPassword) {
    const uLimpio = usuarioAEditar.trim().toLowerCase();
    if (!nuevaPassword.trim()) throw new Error("La contraseña no puede guardarse en blanco.");

    const q = query(collection(db, "usuarios"), where("usuario", "==", uLimpio));
    const snap = await getDocs(q);
    if (snap.empty) throw new Error("El usuario no existe.");

    const idDoc = snap.docs[0].id;
    const nuevoHash = await sha256(nuevaPassword.trim());
    
    await updateDoc(doc(db, "usuarios", idDoc), { passwordHash: nuevoHash });
    return true;
}

export async function verificarYCrearUsuarioDefecto() {
    const querySnapshot = await getDocs(collection(db, "usuarios"));
    if (querySnapshot.empty) {
        const hashContrasena = await sha256("nano123");
        await addDoc(collection(db, "usuarios"), {
            usuario: "nano",
            passwordHash: hashContrasena,
            rol: "superadmin"
        });
        return true;
    }
    return false;
}
