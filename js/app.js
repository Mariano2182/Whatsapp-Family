import { loginUser, verificarYCrearUsuarioDefecto } from "./auth.js";

let currentUser = null;

window.login = async function(){
    const usuario = document.getElementById("usuario").value;
    const password = document.getElementById("password").value;
    const error = document.getElementById("error");

    error.innerText = "";

    try {
        const user = await loginUser(usuario, password);
        currentUser = user;

        localStorage.setItem("user", JSON.stringify(user));

        document.getElementById("login-container").classList.add("hidden");
        document.getElementById("app").classList.remove("hidden");

        document.getElementById("user-info").innerText =
            `Usuario: ${user.usuario} | Rol: ${user.rol}`;

    } catch(e) {
        error.innerText = e.message;
    }
};

window.logout = function(){
    localStorage.removeItem("user");
    location.reload();
};

window.onload = async function(){
    const setupMsg = document.getElementById("setup-msg");

    // Ejecuta la auto-creación si la base de datos está vacía
    try {
        const creado = await verificarYCrearUsuarioDefecto();
        if (creado && setupMsg) {
            setupMsg.innerText = "¡Base de datos vacía! Se ha creado automáticamente el usuario 'nano' con contraseña 'nano123'.";
        }
    } catch (err) {
        console.error("Error al inicializar datos:", err);
    }

    // Gestiona las sesiones activas del navegador
    const saved = localStorage.getItem("user");
    if (saved) {
        document.getElementById("login-container").classList.add("hidden");
        document.getElementById("app").classList.remove("hidden");

        const user = JSON.parse(saved);
        document.getElementById("user-info").innerText =
            `Usuario: ${user.usuario} | Rol: ${user.rol}`;
    }
};
