import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

// REPLACE THIS WITH YOUR ACTUAL FIREBASE CONFIG
const firebaseConfig = {
  apiKey: "AIzaSyDh00RIcMwa-Efyinh1hqKFvh0RctKuLV0",
  authDomain: "dibs-eb67c.firebaseapp.com",
  databaseURL: "https://dibs-eb67c-default-rtdb.asia-southeast1.firebasedatabase.app", // <--- CRITICAL
  projectId: "dibs-eb67c",
  storageBucket: "dibs-eb67c.firebasestorage.app",
  messagingSenderId: "981257191424",
  appId: "1:981257191424:web:3789da5f70129adf44d8e5",
  measurementId: "G-BSKCMDEF25"
};


// Initialize Firebase only once
const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);