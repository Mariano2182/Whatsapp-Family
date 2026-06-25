import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyALKug8P2-KqgL8xfKj16So4MgRysmGVV4",
  authDomain: "chat-familiar-app.firebaseapp.com",
  projectId: "chat-familiar-app",
  storageBucket: "chat-familiar-app.firebasestorage.app",
  messagingSenderId: "638014957754",
  appId: "1:638014957754:web:c3437cf4310050bfbb7a83"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
