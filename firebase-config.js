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
  apiKey: "AIzaSyBHZfsYdmWvtacR6QmeWKcV70t0BTek24U",
  authDomain: "accolade-clo.firebaseapp.com",
  projectId: "accolade-clo",
  storageBucket: "accolade-clo.firebasestorage.app",
  messagingSenderId: "467911820664",
  appId: "1:467911820664:web:fa7b3062c7c33c1276748d",
  measurementId: "G-HS0KR9DZR8",
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
