import { db } from "./firebase.js";
// MODIFICADO: Se agregan 'doc' y 'updateDoc' a las herramientas importadas
import { collection, query, where, getDocs, addDoc, doc, updateDoc } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

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

// NUEVA FUNCIÓN: Modifica el nombre de usuario y actualiza en cascada sus mensajes de chat
export async function actualizarNombreUsuario(usuarioActual, nuevoUsuario) {
    const actualLimpio = usuarioActual.trim().toLowerCase();
    const nuevoLimpio = nuevoUsuario.trim().toLowerCase();

    if (!actualLimpio || !nuevoLimpio) throw new Error("Ambos campos son obligatorios.");
    if (actualLimpio === nuevoLimpio) throw new Error("El nombre nuevo debe ser diferente al actual.");

    // 1. Validar que el nuevo nombre no esté ocupado por otro familiar
    const qNuevo = query(collection(db, "usuarios"), where("usuario", "==", nuevoLimpio));
    const snapNuevo = await getDocs(qNuevo);
    if (!snapNuevo.empty) throw new Error("El nuevo nombre de usuario ya está en uso por alguien más.");

    // 2. Buscar el documento de la cuenta a modificar
    const qActual = query(collection(db, "usuarios"), where("usuario", "==", actualLimpio));
    const snapActual = await getDocs(qActual);
    if (snapActual.empty) throw new Error("El usuario que intentas modificar no existe.");

    const idUsuarioDoc = snapActual.docs[0].id;
    const userDocRef = doc(db, "usuarios", idUsuarioDoc);
    
    // 3. Modificar el nombre en la cuenta de usuario
    await updateDoc(userDocRef, { usuario: nuevoLimpio });

    // 4. ACTUALIZACIÓN EN CASCADA: Buscar todos los mensajes del chat enviados por este usuario
    const qMensajes = query(collection(db, "mensajes"), where("remitente", "==", actualLimpio));
    const snapMensajes = await getDocs(qMensajes);
    
    // Editamos todos sus mensajes en paralelo de forma eficiente
    const promesasActualizacion = snapMensajes.docs.map(msgDoc => {
        const msgRef = doc(db, "mensajes", msgDoc.id);
        return updateDoc(msgRef, { remitente: nuevoLimpio });
    });
    
    await Promise.all(promesasActualizacion);

    return nuevoLimpio;
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
