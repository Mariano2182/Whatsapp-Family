import { db } from "./firebase.js";
import {
    collection,
    query,
    where,
    getDocs
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

export async function sha256(text){
    const msgBuffer = new TextEncoder().encode(text);
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2,'0')).join('');
}

export async function loginUser(usuario, password){

    const q = query(collection(db,"usuarios"), where("usuario","==",usuario));
    const snap = await getDocs(q);

    if(snap.empty){
        throw new Error("Usuario no existe");
    }

    let userData = null;

    snap.forEach(doc=>{
        userData = doc.data();
    });

    const hash = await sha256(password);

    if(userData.passwordHash !== hash){
        throw new Error("Contraseña incorrecta");
    }

    return userData;
}
