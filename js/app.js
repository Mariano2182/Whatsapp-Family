import { loginUser, verificarYCrearUsuarioDefecto, registrarNuevoUsuario } from "./auth.js";

let currentUser = null;

// Controla qué elementos gráficos mostrar basados en los permisos
function mostrarPantallaSegunRol(user) {
    document.getElementById("login-container").classList.add("hidden");
    document.getElementById("admin-panel").classList.add("hidden");
    document.getElementById("app").classList.remove("hidden");

    document.getElementById("user-info").innerText = `Usuario: ${user.usuario} | Rol: ${user.rol}`;

    // FILTRO DE SEGURIDAD: Si es superadmin, revelamos el botón secreto
    const adminBtn = document.getElementById("admin-btn");
    if (user.rol === "superadmin") {
        adminBtn.classList.remove("hidden");
    } else {
        adminBtn.classList.add("hidden");
    }
}

window.login = async function(){
    const usuario = document.getElementById("usuario").value;
    const password = document.getElementById("password").value;
    const error = document.getElementById("error");
    error.innerText = "";

    try {
        const user = await loginUser(usuario, password);
        currentUser = user;
        localStorage.setItem("user", JSON.stringify(user));
        mostrarPantallaSegunRol(user);
    } catch(e) {
        error.innerText = e.message;
    }
};

window.logout = function(){
    localStorage.removeItem("user");
    location.reload();
};

// --- NAVEGACIÓN Y ACCIONES DEL PANEL SECRETO ---

window.abrirPanelAdmin = function() {
    document.getElementById("app").classList.add("hidden");
    document.getElementById("admin-panel").classList.remove("hidden");
    document.getElementById("admin-msg").innerText = "";
};

window.volverAlApp = function() {
    document.getElementById("admin-panel").classList.add("hidden");
    document.getElementById("app").classList.remove("hidden");
};

window.crearFamiliar = async function() {
    const nuevoUser = document.getElementById("nuevo-usuario").value;
    const nuevaPass = document.getElementById("nueva-password").value;
    const nuevoRol = document.getElementById("nuevo-rol").value;
    const adminMsg = document.getElementById("admin-msg");

    adminMsg.innerText = "";
    adminMsg.style.color = "black";

    try {
        // Ejecutamos el registro hacia Firebase
        await registrarNuevoUsuario(nuevoUser, nuevaPass, nuevoRol);
        
        // Mensaje de éxito
        adminMsg.style.color = "green";
        adminMsg.innerText = `¡Éxito! Cuenta de '${nuevoUser}' creada como [${nuevoRol}].`;
        
        // Limpiamos los casilleros del formulario
        document.getElementById("nuevo-usuario").value = "";
        document.getElementById("nueva-password").value = "";
    } catch (e) {
        adminMsg.style.color = "red";
        adminMsg.innerText = e.message;
    }
};

window.onload = async function(){
    const setupMsg = document.getElementById("setup-msg");
    try {
        await verificarYCrearUsuarioDefecto();
    } catch (err) {
        console.error("Error al inicializar datos:", err);
    }

    const saved = localStorage.getItem("user");
    if (saved) {
        const user = JSON.parse(saved);
        currentUser = user;
        mostrarPantallaSegunRol(user);
    }
};
