import { db } from "./firebase.js";
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// Función para encriptar la contraseña
export async function sha256(text) {
    const msgBuffer = new TextEncoder().encode(text);
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Función para iniciar sesión (Adaptada al campo real de tu Firebase: 'usuarios')
export async function loginUser(usuario, password) {
    const usuarioLimpio = (typeof usuario === 'string') ? usuario.trim() : String(usuario || "").trim();
    
    if (!usuarioLimpio) {
        throw new Error("El nombre de usuario no puede estar vacío");
    }

    // Buscamos apuntando exactamente al campo 'usuarios' (plural) que tiene tu base de datos
    const q = query(collection(db, "usuarios"), where("usuarios", "==", usuarioLimpio));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
        throw new Error("Usuario no existe");
    }

    const docSnap = querySnapshot.docs[0];
    const userData = docSnap.data();

    // Validamos la contraseña encriptada
    const hash = await sha256(password);
    if (userData.passwordHash !== hash) {
        throw new Error("Contraseña incorrecta");
    }

    // Devolvemos el objeto mapeando 'usuario' para que app.js lo reconozca sin errores
    return {
        ...userData,
        usuario: userData.usuarios, // Forzamos compatibilidad
    };
}
