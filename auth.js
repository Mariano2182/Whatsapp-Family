import { db } from "./firebase.js";
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// Encriptador de contraseñas
export async function sha256(text) {
    const msgBuffer = new TextEncoder().encode(text);
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Lógica de Ingreso
export async function loginUser(usuario, password) {
    // 🚨 ESTA LÍNEA ARREGLA EL PROBLEMA DEL CELULAR (toLowerCase)
    const usuarioLimpio = String(usuario || "").trim().toLowerCase();
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

// Creación del usuario Admin por defecto
export async function verificarYCrearUsuarioDefecto() {
    const querySnapshot = await getDocs(collection(db, "usuarios"));
    if (querySnapshot.empty) {
        const hashContrasena = await sha256("marian123");
        await addDoc(collection(db, "usuarios"), {
            usuario: "marian",
            passwordHash: hashContrasena,
            rol: "superadmin"
        });
        return true;
    }
    return false;
}

// =========================================================
// ⚙️ FUNCIONES FALTANTES PARA EL PANEL DE ADMINISTRADOR
// =========================================================

export async function registrarNuevoUsuario(usuario, password, rol) {
    const usuarioLimpio = String(usuario || "").trim().toLowerCase();
    if (!usuarioLimpio || !password) throw new Error("Faltan datos.");

    // Verificar que no exista ya
    const q = query(collection(db, "usuarios"), where("usuario", "==", usuarioLimpio));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) throw new Error("Este familiar ya está registrado.");

    const hashContrasena = await sha256(password);
    await addDoc(collection(db, "usuarios"), {
        usuario: usuarioLimpio,
        passwordHash: hashContrasena,
        rol: rol || "user"
    });
    return true;
}

export async function actualizarNombreUsuario(nombreActual, nombreNuevo) {
    const actualClean = String(nombreActual || "").trim().toLowerCase();
    const nuevoClean = String(nombreNuevo || "").trim().toLowerCase();

    if (!nuevoClean) throw new Error("El nuevo nombre no puede estar vacío.");

    // Revisar si alguien más ya usa el nombre nuevo
    const qCheck = query(collection(db, "usuarios"), where("usuario", "==", nuevoClean));
    const snapCheck = await getDocs(qCheck);
    if (!snapCheck.empty) throw new Error("Ese nombre ya está ocupado.");

    // Buscar el usuario actual
    const q = query(collection(db, "usuarios"), where("usuario", "==", actualClean));
    const snapshot = await getDocs(q);
    if (snapshot.empty) throw new Error("No se encontró el usuario actual en la base de datos.");

    // Actualizar el nombre
    let nombreFinal = nuevoClean;
    snapshot.forEach(async (docSnap) => {
        await updateDoc(docSnap.ref, { usuario: nuevoClean });
    });

    return nombreFinal;
}

export async function eliminarUsuario(usuario) {
    const usuarioLimpio = String(usuario || "").trim().toLowerCase();
    const q = query(collection(db, "usuarios"), where("usuario", "==", usuarioLimpio));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) throw new Error("No se encontró al usuario.");

    snapshot.forEach(async (docSnap) => {
        await deleteDoc(docSnap.ref);
    });
    return true;
}

export async function cambiarPasswordUsuario(usuario, nuevaClave) {
    const usuarioLimpio = String(usuario || "").trim().toLowerCase();
    const q = query(collection(db, "usuarios"), where("usuario", "==", usuarioLimpio));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) throw new Error("No se encontró al usuario.");

    const hashNuevo = await sha256(nuevaClave);
    snapshot.forEach(async (docSnap) => {
        await updateDoc(docSnap.ref, { passwordHash: hashNuevo });
    });
    return true;
}
