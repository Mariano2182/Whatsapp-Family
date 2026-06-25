import { db } from "./firebase.js";
// Agrupamos todos los imports de Firestore al principio
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// Función para encriptar la contraseña
export async function sha256(text){
    const msgBuffer = new TextEncoder().encode(text);
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2,'0')).join('');
}

// Función para iniciar sesión
export async function loginUser(usuario, password){
    // Convertimos a string por seguridad absoluta
    const usuarioLimpio = String(usuario).trim(); 
    
    // 1. Buscamos el documento usando el ID limpio
    const ref = doc(db, "usuarios", usuarioLimpio);
    const snap = await getDoc(ref);

    // 2. Si el documento no existe...
    if(!snap.exists()){
        throw new Error("Usuario no existe");
    }

    const userData = snap.data();

    // 4. Encriptamos y comparamos
    const hash = await sha256(password);

    if(userData.passwordHash !== hash){
        throw new Error("Contraseña incorrecta");
    }

    return userData;
}
