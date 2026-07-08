import { db } from "./firebase.js";
import { collection, query, where, getDocs, addDoc } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// Función para encriptar en formato SHA-256 nativo
export async function sha256(text) {
    const msgBuffer = new TextEncoder().encode(text);
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Función estándar para el inicio de sesión
export async function loginUser(usuario, password) {
    const usuarioLimpio = (typeof usuario === 'string') ? usuario.trim() : String(usuario || "").trim();
    
    if (!usuarioLimpio) {
        throw new Error("El nombre de usuario no puede estar vacío");
    }

    // Consulta exacta apuntando al campo 'usuario' en singular
    const q = query(collection(db, "usuarios"), where("usuario", "==", usuarioLimpio));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
        throw new Error("Usuario no existe");
    }

    const docSnap = querySnapshot.docs[0];
    const userData = docSnap.data();

    // Verificación de hashes de contraseñas
    const hash = await sha256(password);
    if (userData.passwordHash !== hash) {
        throw new Error("Contraseña incorrecta");
    }

    return userData;
}

// CREADOR AUTOMÁTICO: Modificado para asignar 'superadmin'
export async function verificarYCrearUsuarioDefecto() {
    const querySnapshot = await getDocs(collection(db, "usuarios"));
    
    if (querySnapshot.empty) {
        const hashContrasena = await sha256("nano123");
        
        await addDoc(collection(db, "usuarios"), {
            usuario: "nano",
            passwordHash: hashContrasena,
            rol: "superadmin" // <-- Cambiado de "admin" a "superadmin"
        });
        return true;
    }
    return false;
}
