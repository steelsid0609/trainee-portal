// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDMeQ7TkAR17QNZrgs-KIh8Q1KunDVKpQY",
  authDomain: "trainee-portal-rcftemp.firebaseapp.com",
  projectId: "trainee-portal-rcftemp",
  storageBucket: "trainee-portal-rcftemp.firebasestorage.app",
  messagingSenderId: "956429923771",
  appId: "1:956429923771:web:54d42b95cf7c214f1ec09e",
  measurementId: "G-MZMRL2VM46"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
