import { loginUser } from "./auth.js";

let currentUser = null;

window.login = async function(){
    const usuario = document.getElementById("usuario").value;
    const password = document.getElementById("password").value;
    const error = document.getElementById("error");

    // Limpiamos errores anteriores antes de intentar el login
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
        // Muestra de manera efectiva el error en la interfaz en caso de fallo
        error.innerText = e.message;
    }
};

window.logout = function(){
    localStorage.removeItem("user");
    location.reload();
};

window.onload = function(){
    const saved = localStorage.getItem("user");

    if (saved) {
        document.getElementById("login-container").classList.add("hidden");
        document.getElementById("app").classList.remove("hidden");

        const user = JSON.parse(saved);

        document.getElementById("user-info").innerText =
            `Usuario: ${user.usuario} | Rol: ${user.rol}`;
    }
};
