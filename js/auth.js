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
    const usuarioLimpio = (typeof usuario === 'string') ? usuario.trim() : String(usuario || "").trim();
    
    if (!usuarioLimpio) {
        throw new Error("El nombre de usuario no puede estar vacío");
    }

    // PRUEBA 1: Buscamos por el campo 'usuario' (singular)
    let q = query(collection(db, "usuarios"), where("usuario", "==", usuarioLimpio));
    let querySnapshot = await getDocs(q);

    // PRUEBA 2: Si no lo encuentra, intentamos buscar por 'usuarios' (plural) por si acaso
    if (querySnapshot.empty) {
        q = query(collection(db, "usuarios"), where("usuarios", "==", usuarioLimpio));
        querySnapshot = await getDocs(q);
    }

    // SI SIGUE VACÍO: Escaneamos la base de datos para ver qué hay escrito dentro
    if (querySnapshot.empty) {
        const todosDocs = await getDocs(collection(db, "usuarios"));
        let listaDeUsuariosExistentes = [];
        
        todosDocs.forEach(doc => {
            const data = doc.data();
            listaDeUsuariosExistentes.push(
                `- En campo 'usuario': "${data.usuario || 'no existe'}" | En campo 'usuarios': "${data.usuarios || 'no existe'}"`
            );
        });

        // Mostramos el escáner en la pantalla del usuario
        alert(
            `🕵️‍♂️ ESCÁNER DE FIREBASE:\n` +
            `Buscaste: "${usuarioLimpio}" pero no coincide exactamente.\n\n` +
            `Los datos reales que tienes guardados en Firebase son:\n` +
            listaDeUsuariosExistentes.join("\n")
        );

        throw new Error("Usuario no existe");
    }

    const docSnap = querySnapshot.docs[0];
    const userData = docSnap.data();

    // Validamos la contraseña
    const hash = await sha256(password);
    if (userData.passwordHash !== hash) {
        throw new Error("Contraseña incorrecta");
    }

    // Devolvemos el objeto asegurando ambos nombres para que app.js no falle
    return {
        ...userData,
        usuario: userData.usuario || userData.usuarios,
        usuarios: userData.usuario || userData.usuarios
    };
}
