import { loginUser } from "./auth.js";

let currentUser = null;

window.login = async function(){
    // Alerta 1: Para saber si el botón realmente responde al clic
    alert("1. ¡El botón funciona! Entrando a la función de login.");

    const usuarioEl = document.getElementById("usuario");
    const passwordEl = document.getElementById("password");
    const errorEl = document.getElementById("error");

    // Alerta 2: Comprobamos si el HTML tiene los IDs correctos
    if (!usuarioEl || !passwordEl || !errorEl) {
        alert("ERROR: Tu HTML no tiene los IDs correctos. Asegúrate de que tus inputs tengan exactamente id='usuario', id='password' e id='error'.");
        return;
    }

    const usuario = usuarioEl.value;
    const password = passwordEl.value;

    errorEl.innerText = "";

    try {
        // Alerta 3: Justo antes de llamar a Firebase
        alert(`2. Conectando con Firebase para el usuario: ${usuario}...`);
        
        const user = await loginUser(usuario, password);
        
        // Alerta 4: Si Firebase responde bien
        alert("3. ¡Firebase respondió con éxito! El usuario existe y la contraseña es correcta. Cambiando de pantalla...");

        currentUser = user;
        localStorage.setItem("user", JSON.stringify(user));

        document.getElementById("login-container").classList.add("hidden");
        document.getElementById("app").classList.remove("hidden");

        document.getElementById("user-info").innerText =
            `Usuario: ${user.usuario} | Rol: ${user.rol}`;

    } catch(e) {
        // Alerta 5: Si Firebase o la contraseña fallan
        alert("ALERTA DE ERROR capturado: " + e.message);
        errorEl.innerText = e.message;
    }
};

window.logout = function(){
    localStorage.removeItem("user");
    location.reload();
};

window.onload = function(){
    const saved = localStorage.getItem("user");
    if(saved){
        document.getElementById("login-container").classList.add("hidden");
        document.getElementById("app").classList.remove("hidden");
        const user = JSON.parse(saved);
        document.getElementById("user-info").innerText =
            `Usuario: ${user.usuario} | Rol: ${user.rol}`;
    }
};
