import { db } from "./firebase.js";
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// Función para encriptar la contraseña
export async function sha256(text) {
    const msgBuffer = new TextEncoder().encode(text);
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Función para iniciar sesión
export async function loginUser(usuario, password) {
    
    // 1. Creamos una consulta para buscar el documento donde el campo 'usuario' coincida
    // Aseguramos que el valor de entrada no tenga espacios extra
    const q = query(collection(db, "usuarios"), where("usuario", "==", usuario.trim()));
    const querySnapshot = await getDocs(q);

    // 2. Si no encontramos nada, el usuario no existe
    if (querySnapshot.empty) {
        throw new Error("Usuario no existe");
    }

    // 3. Obtenemos los datos del primer documento que coincide
    const docSnap = querySnapshot.docs[0];
    const userData = docSnap.data();

    // 4. Encriptamos la contraseña que ingresó el usuario para compararla
    const hash = await sha256(password);

    // 5. Comparamos los hashes
    if (userData.passwordHash !== hash) {
        throw new Error("Contraseña incorrecta");
    }

    // 6. Si todo está correcto, devolvemos los datos del usuario
    return userData;
}
