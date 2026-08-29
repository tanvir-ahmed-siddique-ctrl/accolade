import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  serverTimestamp,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBetOxdCsPktBSw741-xkLtV0lpkF51ZVw",
  authDomain: "accolade-e431c.firebaseapp.com",
  projectId: "accolade-e431c",
  storageBucket: "accolade-e431c.firebasestorage.app",
  messagingSenderId: "802057129966",
  appId: "1:802057129966:web:a3f34af5990b8556fac8ff",
  measurementId: "G-2QWYB7DLBE"
};



const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export {
  addDoc,
  auth,
  collection,
  db,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onAuthStateChanged,
  serverTimestamp,
  signInWithEmailAndPassword,
  signOut,
  updateDoc,
};
