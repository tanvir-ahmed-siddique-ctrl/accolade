import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore-lite.js";

const firebaseConfig = {
  apiKey: "AIzaSyBetOxdCsPktBSw741-xkLtV0lpkF51ZVw",
  authDomain: "accolade-e431c.firebaseapp.com",
  projectId: "accolade-e431c",
  storageBucket: "accolade-e431c.firebasestorage.app",
  messagingSenderId: "802057129966",
  appId: "1:802057129966:web:a3f34af5990b8556fac8ff",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { collection, db, doc, getDoc, getDocs };
