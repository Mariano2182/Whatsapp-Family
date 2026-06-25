import { loginUser } from "./auth.js";

let currentUser = null;

window.login = async function(){

    // Corregido: ID debe ser "usuario" (singular) según tu HTML
    const usuario = document.getElementById("usuario").value; 
    const password = document.getElementById("password").value;

    const error = document.getElementById("error");

    try{
        // Corregido: pasamos la variable 'usuario'
        const user = await loginUser(usuario, password);

        currentUser = user;

        localStorage.setItem("user", JSON.stringify(user));

        document.getElementById("login-container").classList.add("hidden");
        document.getElementById("app").classList.remove("hidden");

        // Corregido: accedemos al campo 'usuario' (singular)
        document.getElementById("user-info").innerText =
            `Usuario: ${user.usuario} | Rol: ${user.rol}`;

    }catch(e){
        error.innerText = e.message;
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

        // Corregido: acceso al campo 'usuario'
        document.getElementById("user-info").innerText =
            `Usuario: ${user.usuario} | Rol: ${user.rol}`;
    }
};
