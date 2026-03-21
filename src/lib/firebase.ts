import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Configuración de Firebase - Estudios WooW
const firebaseConfig = {
  apiKey: "AIzaSyAdIcsycSKE2I-pMwB79DdWlp_x_8hdxbc",
  authDomain: "estudioswoow-7288e.firebaseapp.com",
  projectId: "estudioswoow-7288e",
  storageBucket: "estudioswoow-7288e.firebasestorage.app",
  messagingSenderId: "621394494383",
  appId: "1:621394494383:web:5b103638a7bcd759e1655a"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;
