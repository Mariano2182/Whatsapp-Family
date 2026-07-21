

export async function sha256(text) {
    const msgBuffer = new TextEncoder().encode(text);
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

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
