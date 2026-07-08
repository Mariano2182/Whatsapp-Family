import { db } from "./firebase.js";
import { collection, query, where, getDocs, addDoc } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// Función para encriptar en formato SHA-256 nativo
export async function sha256(text) {
    const msgBuffer = new TextEncoder().encode(text);
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Función para iniciar sesión
export async function loginUser(usuario, password) {
    const usuarioLimpio = (typeof usuario === 'string') ? usuario.trim() : String(usuario || "").trim();
    
    if (!usuarioLimpio) {
        throw new Error("El nombre de usuario no puede estar vacío");
    }

    const q = query(collection(db, "usuarios"), where("usuario", "==", usuarioLimpio));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
        throw new Error("Usuario no existe");
    }

    const docSnap = querySnapshot.docs[0];
    const userData = docSnap.data();

    const hash = await sha256(password);
    if (userData.passwordHash !== hash) {
        throw new Error("Contraseña incorrecta");
    }

    return userData;
}

// NUEVA FUNCIÓN: Registra un nuevo miembro familiar en Firebase
export async function registrarNuevoUsuario(usuario, password, rol) {
    const userLimpio = usuario.trim().toLowerCase();
    
    if (!userLimpio || !password.trim()) {
        throw new Error("El nombre de usuario y la contraseña no pueden estar vacíos.");
    }

    // Validación preventiva: verificar si ya existe ese familiar en la red
    const q = query(collection(db, "usuarios"), where("usuario", "==", userLimpio));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
        throw new Error("Ese nombre de usuario ya está registrado en la familia.");
    }

    // Encriptamos la contraseña del familiar antes de guardarla
    const hashContrasena = await sha256(password.trim());

    // Guardamos el nuevo documento con la estructura perfecta
    await addDoc(collection(db, "usuarios"), {
        usuario: userLimpio,
        passwordHash: hashContrasena,
        rol: rol
    });

    return true;
}

// CREADOR AUTOMÁTICO DE SEGURIDAD
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
